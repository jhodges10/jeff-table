"use client";

import { flexRender, type RowData, useTable } from "@tanstack/react-table";
import { defaultRangeExtractor, type Range, useVirtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { CellEditor, type CellEditorMove } from "./cell-editor";
import { ColumnVisibilityMenu } from "./column-visibility-menu";
import {
  type DataGridCell,
  type DataGridColumn,
  type DataGridColumnDef,
  type DataGridRow,
  dataGridFeatures,
} from "./features";
import { matchesColumnFilter, matchesGlobalFilter } from "./filtering";
import { ChevronIcon, DragIcon, SearchIcon, SortIcon, SpinnerIcon } from "./icons";
import { IndeterminateCheckbox } from "./indeterminate-checkbox";
import { DataGridFiltersMenu, InlineFilter } from "./inline-filter";
import { OverlayScrollbars } from "./overlay-scrollbar";
import { Switch } from "./switch";
import { createThemeStyle } from "./theme";
import type {
  DataGridColumnMeta,
  DataGridOption,
  DataGridProps,
  DataGridRenderContext,
  DataGridSlot,
} from "./types";
import {
  applyPendingEdits,
  defaultApplyCellEdit,
  isSameValue,
  useCellEditing,
} from "./use-cell-editing";
import { useCellNavigation } from "./use-cell-navigation";
import { useColumnReordering } from "./use-column-reordering";
import { useDataGridState } from "./use-data-grid-state";
import {
  buildSectionItems,
  calculateViewportHeight,
  cx,
  deterministicSkeletonWidth,
  formatNumberValue,
  getColumnDefinitionId,
  getColumnLabel,
  renderColumnValue,
} from "./utils";

const DENSITY_ROW_HEIGHT = {
  compact: 36,
  comfortable: 44,
  spacious: 52,
} as const;

const LOADING_INDICATOR_MINIMUM_MS = 1_500;
const LOADING_INDICATOR_FADE_MS = 200;

const KEYBOARD_SCROLL_PROPS: React.HTMLAttributes<HTMLDivElement> = { tabIndex: 0 };

const PIXEL_WIDTH_PATTERN = /^(\d+(?:\.\d+)?)px$/;
const NO_EDITOR_OPTIONS: readonly DataGridOption[] = [];
/** Content that handles its own clicks, so the cell must not handle them too. */
const INTERACTIVE_CELL_CONTENT =
  "a,button,input,select,textarea,[contenteditable='true'],[role='switch']";
const ARROW_DIRECTIONS = {
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
} as const;

/**
 * A select editor falls back to the column's filter options, so a column that
 * already declares what it can be filtered by does not repeat the list to
 * declare what it can be edited to.
 */
function resolveEditorOptions(meta: DataGridColumnMeta | undefined): readonly DataGridOption[] {
  return meta?.editor?.options ?? meta?.filter?.options ?? NO_EDITOR_OPTIONS;
}

/** A cell value through `meta.renderValue`, one node per entry for a list. */
function renderColumnValues(meta: DataGridColumnMeta, value: unknown): React.ReactNode {
  if (Array.isArray(value)) {
    return (
      <span className="jt-cell-values">
        {value.map((item) => (
          <React.Fragment key={String(item)}>
            {renderColumnValue(meta, String(item))}
          </React.Fragment>
        ))}
      </span>
    );
  }
  return renderColumnValue(meta, value === null || value === undefined ? "" : String(value));
}

const INTERACTIVE_SELECTION_TARGET = "a, button, input, label, select, textarea";

function handleSelectionCellClick(
  event: React.MouseEvent<HTMLDivElement>,
  disabled: boolean,
  toggle: () => void,
) {
  event.stopPropagation();
  if (disabled) return;
  const target = event.target;
  if (target instanceof Element && target.closest(INTERACTIVE_SELECTION_TARGET)) return;
  toggle();
}

function numericSort<TData extends RowData>(
  left: DataGridRow<TData>,
  right: DataGridRow<TData>,
  columnId: string,
): number {
  const parse = (value: unknown) => {
    if (typeof value === "number") return value;
    const numeric = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  };
  return parse(left.getValue(columnId)) - parse(right.getValue(columnId));
}

function prepareColumns<TData extends RowData>(
  columns: readonly DataGridColumnDef<TData>[],
): DataGridColumnDef<TData>[] {
  return columns.map((column) => {
    const filterConfig = column.meta?.filter;
    const pixelWidth = column.meta?.width?.match(PIXEL_WIDTH_PATTERN)?.[1];
    const pixelSize = pixelWidth === undefined ? undefined : Number(pixelWidth);
    const inferredMinSize =
      column.meta?.minWidth ??
      (column.minSize === undefined && pixelSize !== undefined && pixelSize < 72
        ? pixelSize
        : undefined);
    const next: DataGridColumnDef<TData> = {
      ...column,
      ...(column.size === undefined && pixelSize !== undefined ? { size: pixelSize } : {}),
      ...(inferredMinSize !== undefined ? { minSize: inferredMinSize } : {}),
      ...(column.meta?.maxWidth !== undefined ? { maxSize: column.meta.maxWidth } : {}),
      ...(column.meta?.numericSort && !column.sortFn ? { sortFn: numericSort<TData> } : {}),
      ...(filterConfig && !column.filterFn
        ? {
            filterFn: (row, columnId, value) =>
              matchesColumnFilter(row.getValue(columnId), value, filterConfig),
          }
        : {}),
    };
    return next;
  });
}

function resolveTrack<TData extends RowData>(
  column: DataGridColumn<TData>,
  enableColumnResizing: boolean,
): string {
  if (enableColumnResizing) return `${column.getSize()}px`;

  const meta = column.columnDef.meta;
  const width = meta?.width ?? `${column.getSize()}px`;
  // A flexible track floors at zero unless it is told otherwise, so `minWidth`
  // has to reach the CSS track — without it a `1fr` column collapses to nothing
  // as soon as the viewport is narrower than the table.
  if (meta?.minWidth === undefined || width.startsWith("minmax(")) return width;
  return `minmax(${meta.minWidth}px, ${width})`;
}

function renderSlot<TData extends RowData>(
  slot: DataGridSlot<TData> | undefined,
  context: DataGridRenderContext<TData>,
): React.ReactNode {
  return typeof slot === "function" ? slot(context) : slot;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Something went wrong while loading these records.";
}

function LoadingIndicator({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [phase, setPhase] = React.useState<"exiting" | "hidden" | "visible">(
    active ? "visible" : "hidden",
  );
  const shownAtReference = React.useRef(active ? Date.now() : 0);
  const wasActiveReference = React.useRef(active);

  React.useEffect(() => {
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (active) {
      if (!wasActiveReference.current) shownAtReference.current = Date.now();
      setPhase("visible");
    } else if (wasActiveReference.current) {
      const elapsed = Date.now() - shownAtReference.current;
      const remaining = Math.max(0, LOADING_INDICATOR_MINIMUM_MS - elapsed);
      exitTimer = setTimeout(() => setPhase("exiting"), remaining);
      hideTimer = setTimeout(() => setPhase("hidden"), remaining + LOADING_INDICATOR_FADE_MS);
    }

    wasActiveReference.current = active;
    return () => {
      if (exitTimer !== undefined) clearTimeout(exitTimer);
      if (hideTimer !== undefined) clearTimeout(hideTimer);
    };
  }, [active]);

  return phase === "hidden" ? null : (
    <span className="jt-loading-indicator" data-state={phase}>
      {children}
    </span>
  );
}

/**
 * A virtualized, themeable data grid. `totalCount` is deliberately required:
 * it sizes the scroll model before every server page has loaded and keeps the
 * footer honest about the complete result set.
 */
export function DataGrid<TData extends RowData>(props: DataGridProps<TData>) {
  const {
    columns,
    data,
    totalCount,
    className,
    classNames = {},
    colorScheme = "inherit",
    density = "comfortable",
    enableColumnFiltering = false,
    enableColumnReordering = false,
    enableColumnResizing = false,
    enableColumnVisibility = false,
    enableGlobalFilter = false,
    hasMore = data.length < totalCount,
    height,
    isLoading = false,
    isLoadingMore = false,
    loadMoreThreshold = 8,
    manualFiltering = false,
    manualSorting = false,
    maxVisibleRows = 12,
    overscan = 10,
    rowHeight: rowHeightProp,
    searchPlaceholder = "Search records…",
    scrollbar = "overlay",
    sections,
    showFooter = true,
    skeletonRowCount,
    slots = {},
    testId = "data-grid",
    virtualize = true,
  } = props;
  const rowHeight = rowHeightProp ?? DENSITY_ROW_HEIGHT[density];
  const editingEnabled = props.enableInlineEditing === true;
  const popoverGroup = React.useId();
  const [openPopover, setOpenPopover] = React.useState<string>();
  const scrollReference = React.useRef<HTMLDivElement>(null);
  const headerCanvasReference = React.useRef<HTMLDivElement>(null);
  const rowsCanvasReference = React.useRef<HTMLDivElement>(null);
  const columnIds = React.useMemo(
    () => columns.map(getColumnDefinitionId).filter((id): id is string => Boolean(id)),
    [columns],
  );
  const gridState = useDataGridState({
    cellSelection: props.cellSelection,
    columnIds,
    columnFilters: props.columnFilters,
    defaultCellSelection: props.defaultCellSelection,
    defaultColumnFilters: props.defaultColumnFilters,
    defaultColumnVisibility: props.defaultColumnVisibility,
    defaultGlobalFilter: props.defaultGlobalFilter,
    defaultSorting: props.defaultSorting,
    globalFilter: props.globalFilter,
    initialPreferences: props.initialPreferences,
    onCellSelectionChange: props.onCellSelectionChange,
    onColumnFiltersChange: props.onColumnFiltersChange,
    onGlobalFilterChange: props.onGlobalFilterChange,
    onPreferencesChange: props.onPreferencesChange,
    onSortingChange: props.onSortingChange,
    preferenceStorage: props.preferenceStorage,
    rowSelection: props.rowSelection,
    sorting: props.sorting,
    tableId: props.tableId,
  });
  const processedColumns = React.useMemo(() => prepareColumns(columns), [columns]);
  // TanStack fills in a default `cell` renderer, so `columnDef.cell` is always
  // set by the time a cell renders and cannot answer "did the author write
  // one?". The raw column defs can, and only they decide whether the grid is
  // free to draw the value itself.
  const authoredCellColumnIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const column of columns) {
      const id = column.cell === undefined ? undefined : getColumnDefinitionId(column);
      if (id !== undefined) ids.add(id);
    }
    return ids;
  }, [columns]);
  const editing = useCellEditing<TData>({ data, onCellEdit: props.onCellEdit });
  const applyCellEdit = props.applyCellEdit ?? defaultApplyCellEdit;
  const { editsByRow } = editing;
  const getRowId = props.getRowId;
  // The optimistic overlay is applied to the data the table is built from, not
  // at render time: a custom `cell` renderer, a sort comparator, and a filter
  // all read through `getValue`, and they have to agree with what the cell
  // shows. The empty case keeps today's plain copy.
  const tableData = React.useMemo(() => {
    if (!editsByRow || !getRowId) return [...data];
    return data.map((row, index) =>
      applyPendingEdits(row, editsByRow.get(getRowId(row, index)), applyCellEdit),
    );
  }, [applyCellEdit, data, editsByRow, getRowId]);

  const table = useTable({
    features: dataGridFeatures,
    columns: processedColumns,
    data: tableData,
    defaultColumn: { minSize: 72, maxSize: 1200, size: 160 },
    columnResizeMode: "onChange",
    // Cell selection is the focus model behind inline editing, not a feature of
    // its own yet: it stays off unless editing is on, and range selection,
    // drag, and multi-range stay off entirely until there is a UI for them.
    autoResetCellSelection: false,
    enableCellRangeSelection: false,
    enableCellSelection: editingEnabled,
    enableCellSelectionDrag: false,
    enableMultiCellRangeSelection: false,
    enableColumnResizing,
    enableRowSelection: props.enableRowSelection
      ? (row) => props.isRowSelectable?.(row.original) ?? true
      : false,
    ...(props.getRowId ? { getRowId: props.getRowId } : {}),
    globalFilterFn: (row, columnId, value) =>
      matchesGlobalFilter(row.getValue(columnId), String(value ?? "")),
    manualFiltering,
    manualSorting,
    onCellSelectionChange: gridState.onCellSelectionChange,
    onColumnFiltersChange: gridState.onColumnFiltersChange,
    onColumnOrderChange: gridState.onColumnOrderChange,
    onColumnSizingChange: gridState.onColumnSizingChange,
    onColumnVisibilityChange: gridState.onColumnVisibilityChange,
    onGlobalFilterChange: gridState.onGlobalFilterChange,
    onRowSelectionChange: gridState.onRowSelectionChange,
    onSortingChange: gridState.onSortingChange,
    state: {
      cellSelection: gridState.cellSelection,
      columnFilters: gridState.columnFilters,
      columnOrder: gridState.columnOrder,
      columnSizing: gridState.columnSizing,
      columnVisibility: gridState.columnVisibility,
      globalFilter: gridState.globalFilter,
      rowSelection: gridState.rowSelection,
      sorting: gridState.sorting,
    },
  });

  const reorder = useColumnReordering(table, enableColumnReordering);
  const tableRows = table.getRowModel().rows;
  const displayItems = React.useMemo(
    () => buildSectionItems(tableRows, sections),
    [sections, tableRows],
  );
  const hasClientFilters =
    !manualFiltering &&
    (gridState.columnFilters.length > 0 || String(gridState.globalFilter).trim().length > 0);
  const effectiveTotalCount = hasClientFilters
    ? tableRows.length
    : Math.max(totalCount, data.length);
  const initialLoading = isLoading && data.length === 0;
  const initialSkeletonCount =
    skeletonRowCount ??
    Math.max(1, Math.min(effectiveTotalCount || maxVisibleRows, maxVisibleRows));
  const unloadedCount = Math.max(0, effectiveTotalCount - tableRows.length);
  const itemCount = initialLoading
    ? initialSkeletonCount
    : displayItems.length + (virtualize ? unloadedCount : 0);
  const sectionHeaderHeight = sections?.headerHeight ?? rowHeight;
  const sectionIndexes = React.useMemo(() => {
    const indexes: number[] = [];
    for (let index = 0; index < displayItems.length; index += 1) {
      if (displayItems[index]?.kind === "section") indexes.push(index);
    }
    return indexes;
  }, [displayItems]);
  const sectionIndexesReference = React.useRef(sectionIndexes);
  sectionIndexesReference.current = sectionIndexes;
  const activeSectionIndexReference = React.useRef<number | undefined>(sectionIndexes[0]);
  // An open editor anchors its popover to its cell, so that row has to stay
  // mounted even if a scroll carries it out of the window. Same mechanism the
  // sticky section header already uses.
  const pinnedRowIndexReference = React.useRef<number | undefined>(undefined);
  const extractStickyRange = React.useCallback((range: Range) => {
    let activeSectionIndex: number | undefined;
    for (const sectionIndex of sectionIndexesReference.current) {
      if (sectionIndex > range.startIndex) break;
      activeSectionIndex = sectionIndex;
    }
    activeSectionIndexReference.current = activeSectionIndex;

    const indexes = defaultRangeExtractor(range);
    const extra = [activeSectionIndex, pinnedRowIndexReference.current].filter(
      (index): index is number => index !== undefined && !indexes.includes(index),
    );
    if (extra.length === 0) return indexes;
    return [...indexes, ...extra].sort((left, right) => left - right);
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: itemCount,
    enabled: virtualize,
    estimateSize: (index) =>
      !initialLoading && displayItems[index]?.kind === "section" ? sectionHeaderHeight : rowHeight,
    getItemKey: (index) => {
      if (initialLoading) return `initial-skeleton-${index}`;
      const item = displayItems[index];
      if (!item) return `unloaded-${index}`;
      return item.kind === "section" ? `section-${item.key}` : item.row.id;
    },
    getScrollElement: () => scrollReference.current,
    initialRect: { height: 600, width: 1000 },
    overscan,
    rangeExtractor: extractStickyRange,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const renderItems = virtualize
    ? virtualItems
    : Array.from({ length: itemCount }, (_, index) => ({
        end: (index + 1) * rowHeight,
        index,
        key: index,
        lane: 0,
        size: rowHeight,
        start: index * rowHeight,
      }));

  const [editorLayer, setEditorLayer] = React.useState<HTMLDivElement | null>(null);
  const loadMore = props.onLoadMore;
  const requestLoadMore = React.useCallback(() => {
    void loadMore?.({ loadedCount: data.length, totalCount });
  }, [data.length, loadMore, totalCount]);
  const scrollToIndex = React.useCallback(
    (index: number) => rowVirtualizer.scrollToIndex(index, { align: "auto" }),
    [rowVirtualizer],
  );
  const navigation = useCellNavigation<TData>({
    displayItems,
    enabled: editingEnabled,
    hasMore,
    onLoadMore: loadMore ? requestLoadMore : undefined,
    scrollToIndex: virtualize ? scrollToIndex : undefined,
    table,
    viewportReference: scrollReference,
  });
  const focusedCell = editingEnabled ? table.getFocusedCell() : undefined;
  pinnedRowIndexReference.current =
    editing.editor && focusedCell
      ? navigation.displayIndexByRowId.get(focusedCell.row.id)
      : undefined;

  const canEditCell = React.useCallback(
    (cell: DataGridCell<TData>) => {
      const config = cell.column.columnDef.meta?.editor;
      if (!config || config.editable === false) return false;
      return props.isCellEditable?.({ columnId: cell.column.id, row: cell.row.original }) ?? true;
    },
    [props.isCellEditable],
  );

  const requestedAtCount = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (
      !virtualize ||
      initialLoading ||
      !hasMore ||
      isLoadingMore ||
      !props.onLoadMore ||
      data.length >= totalCount
    ) {
      return;
    }
    const lastItem = renderItems.at(-1);
    if (!lastItem || lastItem.index < Math.max(0, displayItems.length - loadMoreThreshold)) return;
    if (requestedAtCount.current === data.length) return;
    requestedAtCount.current = data.length;
    void props.onLoadMore({ loadedCount: data.length, totalCount });
  }, [
    data.length,
    displayItems.length,
    hasMore,
    initialLoading,
    isLoadingMore,
    loadMoreThreshold,
    props.onLoadMore,
    renderItems,
    totalCount,
    virtualize,
  ]);

  React.useEffect(() => {
    if (requestedAtCount.current !== null && requestedAtCount.current !== data.length) {
      requestedAtCount.current = null;
    }
  }, [data.length]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: selection and data change the table model without replacing the instance
  const selectedRows = React.useMemo(
    () => table.getSelectedRowModel().flatRows.map((row) => row.original),
    [data, gridState.rowSelection, table],
  );
  const selectionCallback = props.onRowSelectionChange;
  const selectionMounted = React.useRef(false);
  React.useEffect(() => {
    if (!selectionMounted.current) {
      selectionMounted.current = true;
      return;
    }
    selectionCallback?.(gridState.rowSelection, selectedRows);
  }, [gridState.rowSelection, selectedRows, selectionCallback]);

  const context: DataGridRenderContext<TData> = {
    isLoading: isLoading || isLoadingMore,
    loadedCount: data.length,
    resetPreferences: gridState.resetPreferences,
    selectedRows,
    table,
    totalCount,
  };
  const visibleColumns = table.getVisibleLeafColumns();
  const gridTemplate = [
    props.enableRowSelection ? "44px" : null,
    ...visibleColumns.map((column) => resolveTrack(column, enableColumnResizing)),
  ]
    .filter(Boolean)
    .join(" ");
  const headerGroups = table.getHeaderGroups();
  const computedHeight =
    height ??
    calculateViewportHeight({
      headerRows: 1,
      maxVisibleRows,
      rowHeight,
      totalCount: initialLoading ? initialSkeletonCount : Math.max(1, effectiveTotalCount),
    });
  const themeStyle = React.useMemo(
    () => createThemeStyle(props.theme, props.style),
    [props.style, props.theme],
  );
  const loadingIndicator = renderSlot(slots.loadingIndicator, context) ?? (
    <SpinnerIcon aria-label="Loading" role="status" />
  );
  const showHeaderBand =
    enableColumnFiltering ||
    enableGlobalFilter ||
    slots.headerStart !== undefined ||
    slots.headerEnd !== undefined;
  const bodyHeight = virtualize ? rowVirtualizer.getTotalSize() : undefined;
  const gridLabel = props["aria-label"] ?? "Data grid";
  const synchronizeHeaderCanvas = React.useCallback(() => {
    const headerCanvas = headerCanvasReference.current;
    const rowsCanvas = rowsCanvasReference.current;
    const rowsViewport = scrollReference.current;
    if (!headerCanvas || !rowsCanvas || !rowsViewport) return;

    const rowsCanvasWidth = rowsCanvas.getBoundingClientRect().width;
    if (rowsCanvasWidth > 0) headerCanvas.style.width = `${rowsCanvasWidth}px`;
    headerCanvas.style.transform = `translate3d(${-rowsViewport.scrollLeft}px, 0, 0)`;
  }, []);

  React.useLayoutEffect(() => {
    synchronizeHeaderCanvas();
    const rowsCanvas = rowsCanvasReference.current;
    const rowsViewport = scrollReference.current;
    if (!rowsCanvas || !rowsViewport || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(synchronizeHeaderCanvas);
    observer.observe(rowsCanvas);
    observer.observe(rowsViewport);
    return () => observer.disconnect();
  }, [synchronizeHeaderCanvas]);

  const handleRowsScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const headerCanvas = headerCanvasReference.current;
    if (!headerCanvas) return;
    headerCanvas.style.transform = `translate3d(${-event.currentTarget.scrollLeft}px, 0, 0)`;
  }, []);
  const handlePopoverChange = React.useCallback((id: string, open: boolean) => {
    setOpenPopover((current) => (open ? id : current === id ? undefined : current));
  }, []);

  const openEditor = (cell: DataGridCell<TData>, seed?: string) => {
    if (editing.invalid.current || !canEditCell(cell)) return;
    const config = cell.column.columnDef.meta?.editor;
    // A boolean has nothing to draft, so activating it is the commit.
    if (config?.type === "boolean") {
      editing.commit(cell, !cell.getValue());
      navigation.focusCell(cell);
      return;
    }
    // An editor is a popover too: it joins the one-at-a-time rule.
    setOpenPopover(undefined);
    editing.open(cell.id, seed);
  };

  /**
   * A single click edits, and the whole cell is the target — clicking the
   * padding beside a value opens it too.
   *
   * Anything interactive already inside the cell is exempt. A boolean's switch
   * commits on its own change event, and a link or button in a custom `cell`
   * renderer has its own job; letting the cell act on those clicks as well
   * would run two activations for one click, which for a boolean means
   * toggling it straight back.
   */
  const handleCellClick = (
    cell: DataGridCell<TData>,
    isEditing: boolean,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (isEditing || editing.invalid.current) return;
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest(INTERACTIVE_CELL_CONTENT);
    if (control && event.currentTarget.contains(control)) return;
    openEditor(cell);
  };

  const handleCellCommit = (cell: DataGridCell<TData>, value: unknown, move: CellEditorMove) => {
    editing.commit(cell, value);
    if (move === "none") navigation.requestFocus();
    else navigation.step(move);
  };

  const findEditableCell = (rowId: string, columnId: string) =>
    table
      .getCoreRowModel()
      .rowsById[rowId]?.getAllCells()
      .find((cell) => cell.column.id === columnId);
  const undoCell = editing.undoEdit
    ? findEditableCell(editing.undoEdit.rowId, editing.undoEdit.columnId)
    : undefined;
  const canUndo = Boolean(
    undoCell &&
      canEditCell(undoCell) &&
      !editing.editor &&
      ![...editing.pending.values()].some((edit) => edit.status === "saving") &&
      isSameValue(undoCell.getValue(), editing.undoEdit?.value),
  );
  const undoLastEdit = () => {
    if (canUndo && undoCell) editing.undo(undoCell);
  };
  const errors = [...editing.pending.entries()].filter(([, edit]) => edit.status === "error");
  const savingCount = [...editing.pending.values()].filter(
    (edit) => edit.status === "saving",
  ).length;

  const handleViewportKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // An open editor owns its own keys and reports back through `onCommit`.
    if (!editingEnabled || editing.editor) return;
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
      if (canUndo) {
        event.preventDefault();
        undoLastEdit();
      }
      return;
    }
    const cell = table.getFocusedCell();
    if (!cell) return;

    const direction = ARROW_DIRECTIONS[event.key as keyof typeof ARROW_DIRECTIONS];
    if (direction) {
      event.preventDefault();
      navigation.step(direction);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      navigation.stepToEdge(
        event.key === "Home" ? "left" : "right",
        event.ctrlKey || event.metaKey,
      );
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      table.resetCellSelection(true);
      scrollReference.current?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === "F2" || event.key === " ") {
      event.preventDefault();
      openEditor(cell);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      if (!canEditCell(cell)) return;
      event.preventDefault();
      const config = cell.column.columnDef.meta?.editor;
      if (config?.required || config?.validate) {
        openEditor(cell, "");
        return;
      }
      editing.commit(cell, config?.type === "multi-select" ? [] : undefined);
      return;
    }
    // Type-to-edit: one printable character, no modifier claiming it.
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      openEditor(cell, event.key);
    }
  };

  const handleViewportFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    // The viewport is the way in only until a cell owns the tab stop.
    if (!editingEnabled || event.target !== event.currentTarget) return;
    if (gridState.cellSelection.length === 0) navigation.focusFirstCell();
  };

  return (
    <div
      className={cx("jt-grid", classNames.root, className)}
      data-color-scheme={colorScheme === "inherit" ? undefined : colorScheme}
      data-density={density}
      data-loading={isLoading || isLoadingMore || undefined}
      data-scrollbar={scrollbar}
      data-testid={testId}
      onClickCapture={(event) => {
        if (
          editing.invalid.current &&
          event.target instanceof Element &&
          !event.target.closest("[data-editing=true], [data-editor-owner]")
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onMouseDownCapture={(event) => {
        if (!editing.editor || !(event.target instanceof Element)) return;
        if (event.target.closest("[data-editing=true], [data-editor-owner]")) return;
        const input = event.currentTarget.querySelector<HTMLInputElement>(
          "[data-editing=true] input, .jt-editor-search input",
        );
        input?.blur();
        if (editing.invalid.current) {
          event.preventDefault();
          event.stopPropagation();
          input?.focus();
        }
      }}
      style={themeStyle}
    >
      {showHeaderBand ? (
        <div className={cx("jt-grid__header", classNames.header)} data-slot="header">
          <div className={cx("jt-grid__header-start", classNames.headerStart)}>
            {enableGlobalFilter ? (
              <label className="jt-search">
                <SearchIcon />
                <span className="jt-sr-only">Search records</span>
                <input
                  onChange={(event) => table.setGlobalFilter(event.target.value)}
                  placeholder={searchPlaceholder}
                  type="search"
                  value={String(gridState.globalFilter ?? "")}
                />
              </label>
            ) : null}
            {enableColumnFiltering ? (
              <DataGridFiltersMenu
                onOpenChange={(open) => handlePopoverChange("filters-menu", open)}
                open={openPopover === "filters-menu"}
                popoverGroup={popoverGroup}
                table={table}
              />
            ) : null}
            {renderSlot(slots.headerStart, context)}
          </div>
          <div className={cx("jt-grid__header-end", classNames.headerEnd)}>
            {renderSlot(slots.headerEnd, context)}
          </div>
        </div>
      ) : null}

      <div
        className="jt-grid__viewport-shell"
        style={{
          height: typeof computedHeight === "number" ? `${computedHeight}px` : computedHeight,
        }}
      >
        {/*
          The column tools sit outside the grid role on purpose: a `details`
          menu is not a valid child of `role="grid"`, and `display: contents`
          lets the grid wrapper own exactly the header and body rowgroups
          without adding a box to the layout.
        */}
        <div className="jt-grid__column-tools">
          {renderSlot(slots.columnHeaderEnd, context)}
          {enableColumnVisibility ? (
            <ColumnVisibilityMenu
              {...(classNames.columnMenu ? { className: classNames.columnMenu } : {})}
              columnOrder={gridState.columnOrder}
              columnVisibility={gridState.columnVisibility}
              onOpenChange={(open) => handlePopoverChange("columns-menu", open)}
              open={openPopover === "columns-menu"}
              popoverGroup={popoverGroup}
              table={table}
            />
          ) : null}
        </div>
        <div
          aria-busy={isLoading || isLoadingMore}
          aria-colcount={visibleColumns.length + (props.enableRowSelection ? 1 : 0)}
          aria-label={gridLabel}
          aria-rowcount={totalCount}
          className="jt-grid__grid"
          role="grid"
        >
          <div className="jt-grid__column-header-viewport" data-slot="column-header-viewport">
            <div className="jt-grid__canvas jt-grid__header-canvas" ref={headerCanvasReference}>
              <div
                className={cx("jt-grid__column-headers", classNames.columnHeaders)}
                data-slot="column-headers"
                role="rowgroup"
              >
                {headerGroups.map((headerGroup, groupIndex) => (
                  <div
                    className="jt-grid__column-header-row"
                    key={headerGroup.id}
                    role="row"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {props.enableRowSelection ? (
                      // biome-ignore lint/a11y/useKeyWithClickEvents: the nested checkbox remains the keyboard target; this expands only its pointer target
                      <div
                        className="jt-grid__selection-cell"
                        data-selection-target={groupIndex === headerGroups.length - 1 || undefined}
                        onClick={
                          groupIndex === headerGroups.length - 1
                            ? (event) =>
                                handleSelectionCellClick(event, false, () =>
                                  table.toggleAllRowsSelected(!table.getIsAllRowsSelected()),
                                )
                            : undefined
                        }
                        role="columnheader"
                      >
                        {groupIndex === headerGroups.length - 1 ? (
                          <IndeterminateCheckbox
                            aria-label="Select all loaded rows"
                            checked={table.getIsAllRowsSelected()}
                            indeterminate={table.getIsSomeRowsSelected()}
                            onChange={table.getToggleAllRowsSelectedHandler()}
                          />
                        ) : null}
                      </div>
                    ) : null}
                    {headerGroup.headers.map((header) => {
                      const sorted = header.column.getIsSorted();
                      const meta = header.column.columnDef.meta;
                      const drag = reorder.getDragProps(header);
                      const isLeaf = header.subHeaders.length === 0;
                      const sortDirection = sorted === false ? undefined : sorted;
                      return (
                        <div
                          aria-sort={
                            sorted === "asc"
                              ? "ascending"
                              : sorted === "desc"
                                ? "descending"
                                : "none"
                          }
                          className={cx(
                            "jt-grid__column-header",
                            classNames.columnHeader,
                            meta?.headerClassName,
                          )}
                          data-align={meta?.headerAlign ?? "left"}
                          data-column-header=""
                          data-drag-source={drag.isDragSource || undefined}
                          data-drop-side={drag.dropSide}
                          key={header.id}
                          onDragOver={drag.onDragOver}
                          onDrop={drag.onDrop}
                          role="columnheader"
                          style={{
                            gridColumn: header.colSpan > 1 ? `span ${header.colSpan}` : undefined,
                          }}
                        >
                          <div className="jt-grid__column-title-row">
                            {header.isPlaceholder ? null : header.column.getCanSort() ? (
                              <button
                                className="jt-grid__sort-button"
                                onClick={header.column.getToggleSortingHandler()}
                                type="button"
                              >
                                <span>
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                </span>
                                <SortIcon direction={sortDirection} />
                              </button>
                            ) : (
                              <div className="jt-grid__column-label">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </div>
                            )}
                            <div className="jt-grid__header-controls">
                              {isLeaf && drag.draggable ? (
                                <button
                                  aria-label={`Move ${header.column.id} column`}
                                  className="jt-grid__drag-handle"
                                  draggable
                                  onDragEnd={drag.onDragEnd}
                                  onDragStart={drag.onDragStart}
                                  onKeyDown={(event) => {
                                    if (!event.altKey) return;
                                    if (event.key === "ArrowLeft")
                                      reorder.moveBy(header.column.id, -1);
                                    if (event.key === "ArrowRight")
                                      reorder.moveBy(header.column.id, 1);
                                  }}
                                  title="Drag to reorder; Alt+Arrow keys also move this column"
                                  type="button"
                                >
                                  <DragIcon />
                                </button>
                              ) : null}
                              {meta?.headerTooltip ? (
                                <button
                                  aria-label={`About ${header.column.id}`}
                                  className="jt-grid__header-tooltip"
                                  type="button"
                                >
                                  <span aria-hidden="true">?</span>
                                  <span className="jt-grid__header-tooltip-content" role="tooltip">
                                    {meta.headerTooltip}
                                  </span>
                                </button>
                              ) : null}
                              {enableColumnFiltering && isLeaf && meta?.filter ? (
                                <div className={cx("jt-grid__filter", classNames.filter)}>
                                  <InlineFilter
                                    column={header.column}
                                    config={meta.filter}
                                    onOpenChange={(open) =>
                                      handlePopoverChange(`filter-${header.column.id}`, open)
                                    }
                                    open={openPopover === `filter-${header.column.id}`}
                                    popoverGroup={popoverGroup}
                                  />
                                </div>
                              ) : null}
                            </div>
                          </div>
                          {enableColumnResizing && isLeaf && meta?.resizable !== false ? (
                            <button
                              aria-label={`Resize ${header.column.id} column`}
                              className="jt-grid__resize-handle"
                              data-resizing={header.column.getIsResizing() || undefined}
                              draggable={false}
                              onClick={(event) => event.stopPropagation()}
                              onDoubleClick={() => header.column.resetSize()}
                              onDragStart={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              type="button"
                            >
                              <span
                                aria-hidden="true"
                                className="jt-grid__resize-indicator"
                                style={{
                                  height:
                                    typeof computedHeight === "number"
                                      ? `${computedHeight}px`
                                      : computedHeight,
                                }}
                              />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/*
          Scrollable and focusable, but deliberately unnamed and role-less: a
          `role="region"` — or even a bare `aria-label`, which promotes a div out
          of generic — would sit between the grid and its rowgroup, which ARIA
          does not allow. Keyboard scrolling comes from tabIndex, not the role.
        */}
          <div
            {...KEYBOARD_SCROLL_PROPS}
            className={cx("jt-grid__viewport", "jt-grid__rows-viewport", classNames.viewport)}
            data-slot="viewport"
            onFocus={editingEnabled ? handleViewportFocus : undefined}
            onKeyDown={editingEnabled ? handleViewportKeyDown : undefined}
            onScroll={handleRowsScroll}
            ref={scrollReference}
            role="rowgroup"
            // Exactly one tab stop. The viewport is the way in until a cell is
            // focused; from then on the focused cell carries it, so Tab does
            // not land twice on the same grid.
            tabIndex={editingEnabled && gridState.cellSelection.length > 0 ? -1 : 0}
          >
            <div className="jt-grid__canvas jt-grid__rows-canvas" ref={rowsCanvasReference}>
              <div
                className={cx("jt-grid__body", classNames.body)}
                data-slot="body"
                style={{ height: bodyHeight }}
              >
                {/*
                  Virtualized rows are absolutely positioned, so they contribute
                  nothing to the canvas's intrinsic width and it collapses to the
                  viewport — leaving every row to resolve the shared track
                  template against its own content. This in-flow, zero-height row
                  carries no content, so its width is exactly the sum of the
                  track minimums: the narrowest the grid may be, and the one
                  width every row and the header band then agree on.
                */}
                <div
                  aria-hidden="true"
                  className="jt-grid__track-sizer"
                  data-slot="track-sizer"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {props.enableRowSelection ? <span /> : null}
                  {visibleColumns.map((column) => (
                    <span key={column.id} />
                  ))}
                </div>
                {props.error ? (
                  // A rowgroup may only contain rows, so a state message is a
                  // full-width cell rather than a bare div inside the body.
                  <div className="jt-grid__state-row" role="row">
                    <div
                      className={cx("jt-grid__state", "jt-grid__error", classNames.error)}
                      role="gridcell"
                    >
                      <span role="alert">
                        {renderSlot(slots.error, context) ?? errorMessage(props.error)}
                      </span>
                    </div>
                  </div>
                ) : !initialLoading && displayItems.length === 0 ? (
                  <div className="jt-grid__state-row" role="row">
                    <div
                      className={cx("jt-grid__state", "jt-grid__empty", classNames.empty)}
                      role="gridcell"
                    >
                      {renderSlot(slots.empty, context) ??
                        props.emptyMessage ??
                        "No records found."}
                    </div>
                  </div>
                ) : (
                  renderItems.map((virtualItem) => {
                    const item = initialLoading ? undefined : displayItems[virtualItem.index];
                    const isStickySection =
                      virtualize &&
                      item?.kind === "section" &&
                      activeSectionIndexReference.current === virtualItem.index;
                    const virtualStyle: React.CSSProperties = virtualize
                      ? isStickySection
                        ? {
                            height: `${virtualItem.size}px`,
                            position: "sticky",
                            top: 0,
                          }
                        : {
                            height: `${virtualItem.size}px`,
                            position: "absolute",
                            top: 0,
                            transform: `translateY(${virtualItem.start}px)`,
                          }
                      : {
                          minHeight: `${item?.kind === "section" ? sectionHeaderHeight : rowHeight}px`,
                        };

                    if (item?.kind === "section") {
                      const selectableRows: (typeof item.rowModels)[number][] = [];
                      const selectedRows: (typeof item.rowModels)[number][] = [];
                      for (const row of item.rowModels) {
                        if (!row.getCanSelect()) continue;
                        selectableRows.push(row);
                        if (row.getIsSelected()) selectedRows.push(row);
                      }
                      const checked =
                        selectableRows.length > 0 && selectedRows.length === selectableRows.length;
                      const indeterminate = selectedRows.length > 0 && !checked;
                      const toggle = (selected = !checked) => {
                        table.setRowSelection((current) => {
                          const next = { ...current };
                          for (const row of selectableRows) {
                            if (selected) next[row.id] = true;
                            else delete next[row.id];
                          }
                          return next;
                        });
                      };
                      const selectionContext = {
                        checked,
                        disabled: selectableRows.length === 0,
                        indeterminate,
                        key: item.key,
                        rows: item.rows,
                        selectedRows: selectedRows.map((row) => row.original),
                        toggle,
                      };
                      return (
                        <div
                          className={cx("jt-grid__section", classNames.sectionHeader)}
                          data-section-key={item.key}
                          data-selection={props.enableRowSelection || undefined}
                          data-slot="section-header"
                          data-sticky={isStickySection || undefined}
                          key={virtualItem.key}
                          role="row"
                          style={{ ...virtualStyle, gridTemplateColumns: gridTemplate }}
                        >
                          {props.enableRowSelection ? (
                            // biome-ignore lint/a11y/useKeyWithClickEvents: the nested control remains the single keyboard target; this only expands its pointer target
                            <div
                              className="jt-grid__selection-cell jt-grid__section-selection"
                              data-disabled={selectionContext.disabled || undefined}
                              data-selection-target="true"
                              onClick={(event) =>
                                handleSelectionCellClick(event, selectionContext.disabled, toggle)
                              }
                              role="gridcell"
                            >
                              {sections?.renderSelection ? (
                                sections.renderSelection(selectionContext)
                              ) : (
                                <IndeterminateCheckbox
                                  aria-label={`Select all rows in ${item.key}`}
                                  checked={checked}
                                  disabled={selectionContext.disabled}
                                  indeterminate={indeterminate}
                                  onChange={(event) => toggle(event.currentTarget.checked)}
                                />
                              )}
                            </div>
                          ) : null}
                          <div
                            className="jt-grid__section-content"
                            role="gridcell"
                            style={{ gridColumn: `span ${Math.max(1, visibleColumns.length)}` }}
                          >
                            {sections?.renderHeader({ key: item.key, rows: item.rows })}
                          </div>
                        </div>
                      );
                    }

                    if (!item || initialLoading) {
                      return (
                        <div
                          aria-hidden="true"
                          className={cx("jt-grid__row", "jt-grid__row--skeleton")}
                          data-index={virtualItem.index}
                          key={virtualItem.key}
                          role="row"
                          style={{ ...virtualStyle, gridTemplateColumns: gridTemplate }}
                        >
                          {props.enableRowSelection ? (
                            <div className="jt-grid__selection-cell" />
                          ) : null}
                          {visibleColumns.map((column) => {
                            const config = column.columnDef.meta?.skeleton;
                            const skeletonConfig = config === false ? undefined : config;
                            const shape =
                              config === false ? undefined : (skeletonConfig?.shape ?? "bar");
                            const width = deterministicSkeletonWidth(
                              virtualItem.index,
                              column.id,
                              config === false ? 0 : skeletonConfig?.minWidth,
                              config === false ? 0 : skeletonConfig?.maxWidth,
                            );
                            return (
                              <div
                                className={cx("jt-grid__cell", classNames.cell)}
                                data-align={
                                  column.columnDef.meta?.cellAlign ??
                                  column.columnDef.meta?.headerAlign ??
                                  "left"
                                }
                                key={column.id}
                                role="gridcell"
                              >
                                {shape ? (
                                  <span
                                    className={cx("jt-skeleton", classNames.skeleton)}
                                    data-shape={shape}
                                    style={
                                      shape === "bar"
                                        ? {
                                            height: skeletonConfig?.size,
                                            width: `${width}%`,
                                          }
                                        : {
                                            height: skeletonConfig?.size ?? 28,
                                            width: skeletonConfig?.size ?? 28,
                                          }
                                    }
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    const row = item.row;
                    const cellStatuses = new Map(
                      row.getAllCells().map((cell) => {
                        const pending = editingEnabled ? editing.pending.get(cell.id) : undefined;
                        const status =
                          pending?.status === "saving" || pending?.status === "error"
                            ? pending.status
                            : (props.getCellStatus?.({
                                columnId: cell.column.id,
                                row: row.original,
                                rowId: row.id,
                              }) ?? "idle");
                        return [cell.id, status] as const;
                      }),
                    );
                    const rowSaving = [...cellStatuses.values()].includes("saving");
                    const canSelect = props.enableRowSelection ? row.getCanSelect() : true;
                    const rowClass =
                      typeof props.rowClassName === "function"
                        ? props.rowClassName(row)
                        : props.rowClassName;
                    return (
                      <div
                        className={cx("jt-grid__row", classNames.row, rowClass)}
                        aria-rowindex={virtualItem.index + 1}
                        aria-busy={rowSaving || undefined}
                        data-status={rowSaving ? "saving" : undefined}
                        data-disabled={!canSelect || undefined}
                        data-index={virtualItem.index}
                        data-row-id={row.id}
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        key={virtualItem.key}
                        onClick={() => props.onRowClick?.(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && props.onRowClick) props.onRowClick(row);
                        }}
                        role="row"
                        style={{ ...virtualStyle, gridTemplateColumns: gridTemplate }}
                        tabIndex={props.onRowClick && !editingEnabled ? 0 : undefined}
                      >
                        {props.enableRowSelection ? (
                          // biome-ignore lint/a11y/useKeyWithClickEvents: the nested checkbox remains the keyboard target; this expands only its pointer target
                          <div
                            className="jt-grid__selection-cell"
                            data-disabled={!canSelect || undefined}
                            data-selection-target="true"
                            onClick={(event) =>
                              handleSelectionCellClick(event, !canSelect, () =>
                                row.toggleSelected(),
                              )
                            }
                            role="gridcell"
                          >
                            <IndeterminateCheckbox
                              aria-label={`Select row ${row.id}`}
                              checked={row.getIsSelected()}
                              disabled={!canSelect}
                              onChange={row.getToggleSelectedHandler()}
                              onClick={(event) => event.stopPropagation()}
                            />
                          </div>
                        ) : null}
                        {row.getVisibleCells().map((cell) => {
                          const meta = cell.column.columnDef.meta;
                          const value = cell.getValue();
                          const editorConfig = editingEnabled ? meta?.editor : undefined;
                          const pending = editingEnabled ? editing.pending.get(cell.id) : undefined;
                          const status = cellStatuses.get(cell.id) ?? "idle";
                          const isEditing = editing.editor?.cellId === cell.id;
                          const display = authoredCellColumnIds.has(cell.column.id)
                            ? flexRender(cell.column.columnDef.cell, cell.getContext())
                            : meta?.renderValue
                              ? renderColumnValues(meta, value)
                              : meta?.numberFormat
                                ? formatNumberValue(meta.numberFormat, value)
                                : `${meta?.prefix ?? ""}${value === null || value === undefined ? "" : String(value)}${
                                    meta?.suffix ?? ""
                                  }`;
                          const summary =
                            editorConfig?.type === "multi-select" &&
                            Array.isArray(value) &&
                            value.length > 1 &&
                            !authoredCellColumnIds.has(cell.column.id) ? (
                              <span className="jt-cell-values">
                                <span className="jt-cell-summary">
                                  {meta?.renderValue
                                    ? renderColumnValue(meta, String(value[0]))
                                    : String(value[0])}
                                </span>
                                <span className="jt-cell-more">+{value.length - 1}</span>
                              </span>
                            ) : (
                              display
                            );
                          let content: React.ReactNode = summary;
                          // A single-select advertises itself before it is
                          // touched: the reader should know the cell opens a
                          // list without having to try it first.
                          if (
                            !isEditing &&
                            (editorConfig?.type === "single-select" ||
                              editorConfig?.type === "multi-select") &&
                            canEditCell(cell)
                          ) {
                            content = (
                              <>
                                <span className="jt-cell-value">{summary}</span>
                                <ChevronIcon
                                  className="jt-cell-chevron"
                                  direction="down"
                                  height={14}
                                  width={14}
                                />
                              </>
                            );
                          }
                          if (isEditing && editorConfig) {
                            content = (
                              <CellEditor
                                config={editorConfig}
                                label={getColumnLabel(cell.column)}
                                layer={editorLayer}
                                meta={meta}
                                onCancel={() => {
                                  editing.cancel();
                                  navigation.requestFocus();
                                }}
                                onCommit={(next, move) => handleCellCommit(cell, next, move)}
                                onValidationChange={editing.setInvalid}
                                options={resolveEditorOptions(meta)}
                                seed={editing.editor?.seed}
                                value={pending?.status === "error" ? pending.value : value}
                                viewport={scrollReference.current}
                              />
                            );
                          } else if (editorConfig?.type === "boolean") {
                            // The cell is the tab stop; the control keeps
                            // announcing its state without adding a second
                            // stop to every row.
                            const booleanProps = {
                              "aria-label": getColumnLabel(cell.column),
                              checked: value === true,
                              disabled: !canEditCell(cell) || status === "saving",
                              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                                editing.commit(cell, event.currentTarget.checked),
                              tabIndex: -1,
                            };
                            content =
                              editorConfig.control === "checkbox" ? (
                                <IndeterminateCheckbox {...booleanProps} />
                              ) : (
                                <Switch {...booleanProps} />
                              );
                          }
                          return (
                            // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard equivalent is Enter/F2/type-to-edit on the focused cell, handled once on the viewport rather than once per cell
                            <div
                              className={cx("jt-grid__cell", classNames.cell, meta?.cellClassName)}
                              data-align={meta?.cellAlign ?? meta?.headerAlign ?? "left"}
                              data-cell-id={editingEnabled ? cell.id : undefined}
                              data-edit-status={pending?.status}
                              data-status={status}
                              aria-busy={status === "saving" || undefined}
                              data-editable={(editingEnabled && canEditCell(cell)) || undefined}
                              data-editor-type={editorConfig?.type}
                              data-editing={isEditing || undefined}
                              data-focused={(editingEnabled && cell.getIsFocused()) || undefined}
                              key={cell.id}
                              onClick={
                                editingEnabled
                                  ? (event) => handleCellClick(cell, isEditing, event)
                                  : undefined
                              }
                              onMouseDown={
                                editingEnabled
                                  ? (event) => {
                                      if (!isEditing && !editing.invalid.current)
                                        cell.getSelectionStartHandler()(event);
                                    }
                                  : undefined
                              }
                              role="gridcell"
                              tabIndex={editingEnabled ? cell.getTabIndex() : undefined}
                              title={
                                pending?.message ??
                                (typeof display === "string" ? display : undefined)
                              }
                            >
                              {content}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
        {editingEnabled ? (
          <div aria-hidden={false} className="jt-grid__editor-layer" ref={setEditorLayer} />
        ) : null}
        {scrollbar === "overlay" ? <OverlayScrollbars viewportRef={scrollReference} /> : null}
      </div>

      {editingEnabled ? (
        <div className="jt-grid__editing-status">
          <div className="jt-grid__editing-status-line">
            <span aria-live="polite" role="status">
              {savingCount
                ? `Saving ${savingCount} ${savingCount === 1 ? "change" : "changes"}…`
                : errors.length
                  ? `${errors.length} ${errors.length === 1 ? "change" : "changes"} could not be saved`
                  : editing.undoEdit
                    ? "Changes saved"
                    : null}
            </span>
            <button
              className="jt-editor-button"
              disabled={!canUndo}
              onClick={undoLastEdit}
              type="button"
              title="Undo last edit (Ctrl+Z / ⌘Z)"
            >
              Undo last edit
            </button>
          </div>
          {errors.map(([cellId, edit]) => {
            const cell = findEditableCell(edit.rowId, edit.columnId);
            const index = navigation.displayIndexByRowId.get(edit.rowId);
            return (
              <div className="jt-grid__save-error" key={cellId}>
                <span role="alert">
                  {index !== undefined ? `Row ${index + 1} · ` : ""}
                  {cell ? getColumnLabel(cell.column) : "Field"}:{" "}
                  {edit.message ?? "Couldn't save this change."}
                </span>
                <button
                  className="jt-editor-button"
                  disabled={!cell || !canEditCell(cell)}
                  onClick={() => {
                    if (cell) editing.commit(cell, edit.value, edit.isUndo);
                  }}
                  type="button"
                >
                  Retry
                </button>
                <button
                  className="jt-editor-button"
                  onClick={() => editing.discard(cellId)}
                  type="button"
                >
                  Discard
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
      {showFooter ? (
        <div className={cx("jt-grid__footer", classNames.footer)} data-slot="footer">
          <div className={cx("jt-grid__footer-start", classNames.footerStart)}>
            <span className="jt-grid__record-count">
              {data.length < totalCount ? `${data.length.toLocaleString()} of ` : ""}
              {totalCount.toLocaleString()} {totalCount === 1 ? "record" : "records"}
            </span>
            <LoadingIndicator active={isLoading || isLoadingMore}>
              {loadingIndicator}
            </LoadingIndicator>
            {selectedRows.length > 0 ? (
              <span className="jt-grid__selection-count">{selectedRows.length} selected</span>
            ) : null}
            {renderSlot(slots.footerStart, context)}
          </div>
          <div className={cx("jt-grid__footer-end", classNames.footerEnd)}>
            {renderSlot(slots.footerEnd, context)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
