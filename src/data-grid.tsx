"use client";

import { flexRender, type RowData, useTable } from "@tanstack/react-table";
import { defaultRangeExtractor, type Range, useVirtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { ColumnVisibilityMenu } from "./column-visibility-menu";
import {
  type DataGridColumn,
  type DataGridColumnDef,
  type DataGridRow,
  dataGridFeatures,
} from "./features";
import { matchesColumnFilter, matchesGlobalFilter } from "./filtering";
import { DragIcon, SearchIcon, SortIcon, SpinnerIcon } from "./icons";
import { IndeterminateCheckbox } from "./indeterminate-checkbox";
import { DataGridFiltersMenu, InlineFilter } from "./inline-filter";
import type { DataGridProps, DataGridRenderContext, DataGridSlot, DataGridTheme } from "./types";
import { useColumnReordering } from "./use-column-reordering";
import { useDataGridState } from "./use-data-grid-state";
import {
  buildSectionItems,
  calculateViewportHeight,
  cx,
  deterministicSkeletonWidth,
  getColumnDefinitionId,
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
  return column.columnDef.meta?.width ?? `${column.getSize()}px`;
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

function createThemeStyle(
  theme: Partial<DataGridTheme> | undefined,
  style: React.CSSProperties | undefined,
): React.CSSProperties {
  return {
    ...style,
    ...(theme?.accent === undefined ? {} : { "--jt-accent": theme.accent }),
    ...(theme?.accentForeground === undefined
      ? {}
      : { "--jt-accent-foreground": theme.accentForeground }),
    ...(theme?.background === undefined ? {} : { "--jt-background": theme.background }),
    ...(theme?.border === undefined ? {} : { "--jt-border": theme.border }),
    ...(theme?.danger === undefined ? {} : { "--jt-danger": theme.danger }),
    ...(theme?.foreground === undefined ? {} : { "--jt-foreground": theme.foreground }),
    ...(theme?.headerBackground === undefined
      ? {}
      : { "--jt-header-background": theme.headerBackground }),
    ...(theme?.hover === undefined ? {} : { "--jt-hover": theme.hover }),
    ...(theme?.muted === undefined ? {} : { "--jt-muted": theme.muted }),
    ...(theme?.mutedForeground === undefined
      ? {}
      : { "--jt-muted-foreground": theme.mutedForeground }),
    ...(theme?.radius === undefined ? {} : { "--jt-radius": theme.radius }),
    ...(theme?.selected === undefined ? {} : { "--jt-selected": theme.selected }),
    ...(theme?.shadow === undefined ? {} : { "--jt-shadow": theme.shadow }),
  } as React.CSSProperties;
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
    sections,
    showFooter = true,
    skeletonRowCount,
    slots = {},
    testId = "data-grid",
    virtualize = true,
  } = props;
  const rowHeight = rowHeightProp ?? DENSITY_ROW_HEIGHT[density];
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
    columnIds,
    columnFilters: props.columnFilters,
    defaultColumnFilters: props.defaultColumnFilters,
    defaultColumnVisibility: props.defaultColumnVisibility,
    defaultGlobalFilter: props.defaultGlobalFilter,
    defaultSorting: props.defaultSorting,
    globalFilter: props.globalFilter,
    initialPreferences: props.initialPreferences,
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
  const tableData = React.useMemo(() => [...data], [data]);

  const table = useTable({
    features: dataGridFeatures,
    columns: processedColumns,
    data: tableData,
    defaultColumn: { minSize: 72, maxSize: 1200, size: 160 },
    columnResizeMode: "onChange",
    enableColumnResizing,
    enableRowSelection: props.enableRowSelection
      ? (row) => props.isRowSelectable?.(row.original) ?? true
      : false,
    ...(props.getRowId ? { getRowId: props.getRowId } : {}),
    globalFilterFn: (row, columnId, value) =>
      matchesGlobalFilter(row.getValue(columnId), String(value ?? "")),
    manualFiltering,
    manualSorting,
    onColumnFiltersChange: gridState.onColumnFiltersChange,
    onColumnOrderChange: gridState.onColumnOrderChange,
    onColumnSizingChange: gridState.onColumnSizingChange,
    onColumnVisibilityChange: gridState.onColumnVisibilityChange,
    onGlobalFilterChange: gridState.onGlobalFilterChange,
    onRowSelectionChange: gridState.onRowSelectionChange,
    onSortingChange: gridState.onSortingChange,
    state: {
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
  const extractStickyRange = React.useCallback((range: Range) => {
    let activeSectionIndex: number | undefined;
    for (const sectionIndex of sectionIndexesReference.current) {
      if (sectionIndex > range.startIndex) break;
      activeSectionIndex = sectionIndex;
    }
    activeSectionIndexReference.current = activeSectionIndex;

    const indexes = defaultRangeExtractor(range);
    if (activeSectionIndex === undefined || indexes.includes(activeSectionIndex)) return indexes;
    return [...indexes, activeSectionIndex].sort((left, right) => left - right);
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

  return (
    <div
      className={cx("jt-grid", classNames.root, className)}
      data-density={density}
      data-loading={isLoading || isLoadingMore || undefined}
      data-testid={testId}
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
        aria-busy={isLoading || isLoadingMore}
        aria-colcount={visibleColumns.length + (props.enableRowSelection ? 1 : 0)}
        aria-label={gridLabel}
        aria-rowcount={totalCount}
        className="jt-grid__viewport-shell"
        role="grid"
        style={{
          height: typeof computedHeight === "number" ? `${computedHeight}px` : computedHeight,
        }}
      >
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
        <div className="jt-grid__column-header-viewport" data-slot="column-header-viewport">
          <div className="jt-grid__canvas jt-grid__header-canvas" ref={headerCanvasReference}>
            <div
              className={cx("jt-grid__column-headers", classNames.columnHeaders)}
              data-slot="column-headers"
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
                          sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
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
                          {isLeaf && drag.draggable ? (
                            <button
                              aria-label={`Move ${header.column.id} column`}
                              className="jt-grid__drag-handle"
                              draggable
                              onDragEnd={drag.onDragEnd}
                              onDragStart={drag.onDragStart}
                              onKeyDown={(event) => {
                                if (!event.altKey) return;
                                if (event.key === "ArrowLeft") reorder.moveBy(header.column.id, -1);
                                if (event.key === "ArrowRight") reorder.moveBy(header.column.id, 1);
                              }}
                              title="Drag to reorder; Alt+Arrow keys also move this column"
                              type="button"
                            >
                              <DragIcon />
                            </button>
                          ) : null}
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

        <div
          {...KEYBOARD_SCROLL_PROPS}
          aria-label={`${gridLabel} rows`}
          className={cx("jt-grid__viewport", "jt-grid__rows-viewport", classNames.viewport)}
          data-slot="viewport"
          onScroll={handleRowsScroll}
          ref={scrollReference}
          role="region"
        >
          <div className="jt-grid__canvas jt-grid__rows-canvas" ref={rowsCanvasReference}>
            <div
              className={cx("jt-grid__body", classNames.body)}
              data-slot="body"
              role="rowgroup"
              style={{ height: bodyHeight }}
            >
              {props.error ? (
                <div
                  className={cx("jt-grid__state", "jt-grid__error", classNames.error)}
                  role="alert"
                >
                  {renderSlot(slots.error, context) ?? errorMessage(props.error)}
                </div>
              ) : !initialLoading && displayItems.length === 0 ? (
                <div
                  className={cx("jt-grid__state", "jt-grid__empty", classNames.empty)}
                  role="row"
                >
                  {renderSlot(slots.empty, context) ?? props.emptyMessage ?? "No records found."}
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
                  const canSelect = props.enableRowSelection ? row.getCanSelect() : true;
                  const rowClass =
                    typeof props.rowClassName === "function"
                      ? props.rowClassName(row)
                      : props.rowClassName;
                  return (
                    <div
                      className={cx("jt-grid__row", classNames.row, rowClass)}
                      aria-rowindex={virtualItem.index + 1}
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
                      tabIndex={props.onRowClick ? 0 : undefined}
                    >
                      {props.enableRowSelection ? (
                        // biome-ignore lint/a11y/useKeyWithClickEvents: the nested checkbox remains the keyboard target; this expands only its pointer target
                        <div
                          className="jt-grid__selection-cell"
                          data-disabled={!canSelect || undefined}
                          data-selection-target="true"
                          onClick={(event) =>
                            handleSelectionCellClick(event, !canSelect, () => row.toggleSelected())
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
                        const content = cell.column.columnDef.cell
                          ? flexRender(cell.column.columnDef.cell, cell.getContext())
                          : `${meta?.prefix ?? ""}${value === null || value === undefined ? "" : String(value)}${
                              meta?.suffix ?? ""
                            }`;
                        return (
                          <div
                            className={cx("jt-grid__cell", classNames.cell, meta?.cellClassName)}
                            data-align={meta?.cellAlign ?? meta?.headerAlign ?? "left"}
                            key={cell.id}
                            role="gridcell"
                            title={typeof content === "string" ? content : undefined}
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
