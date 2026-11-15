import type { RowData } from "@tanstack/react-table";
import * as React from "react";
import type { DataGridCell, DataGridInstance } from "./features";
import type { DataGridDisplayItem } from "./utils";

export type CellNavigationDirection = "down" | "left" | "right" | "up";

interface CellCoordinate {
  columnId: string;
  displayIndex: number;
  rowId: string;
}

/**
 * Where a step landed.
 *
 * `blocked` means the move ran off the end of the loaded rows, which is the
 * grid's cue to ask for the next page rather than to sit silent under a screen
 * of skeletons.
 */
type StepOutcome = { kind: "blocked" } | { kind: "moved"; target: CellCoordinate } | undefined;

function findCellElement(root: HTMLElement | null, cellId: string): HTMLElement | null {
  if (!root) return null;
  // The rendered window is small, and a row ID may contain anything a
  // consumer's `getRowId` returns, so scan rather than build a selector.
  for (const element of root.querySelectorAll<HTMLElement>("[data-cell-id]")) {
    if (element.dataset.cellId === cellId) return element;
  }
  return null;
}

interface CellNavigationOptions<TData extends RowData> {
  displayItems: readonly DataGridDisplayItem<TData>[];
  enabled: boolean;
  hasMore: boolean;
  onLoadMore: (() => void) | undefined;
  scrollToIndex: ((index: number) => void) | undefined;
  table: DataGridInstance<TData>;
  viewportReference: React.RefObject<HTMLDivElement | null>;
}

export interface CellNavigationController<TData extends RowData> {
  /** Display-order index of every row, for scrolling a focused cell into view. */
  displayIndexByRowId: ReadonlyMap<string, number>;
  focusCell: (cell: DataGridCell<TData>) => void;
  focusFirstCell: () => void;
  /**
   * Asks for focus to return to the focused cell after the next commit.
   *
   * Closing an editor unmounts the control that holds focus, so the cell has
   * to reclaim it once React has re-rendered — not during the event handler,
   * when the input is still mounted.
   */
  requestFocus: () => void;
  step: (direction: CellNavigationDirection) => void;
  stepToEdge: (direction: "left" | "right", wholeGrid: boolean) => void;
}

/**
 * Cell focus over the grid's own display order.
 *
 * TanStack's `moveCellSelection` walks `getRowModel().rows`, but `sections`
 * regroups those rows into `displayItems` — so in a sectioned grid the row
 * after this one in the model can be several sections away on screen. Stepping
 * over `displayItems` instead keeps arrow keys matching what the reader sees,
 * costs a map lookup rather than a scan of every row, and yields the display
 * index the virtualizer needs to scroll the target into view.
 */
export function useCellNavigation<TData extends RowData>({
  displayItems,
  enabled,
  hasMore,
  onLoadMore,
  scrollToIndex,
  table,
  viewportReference,
}: CellNavigationOptions<TData>): CellNavigationController<TData> {
  const displayIndexByRowId = React.useMemo(() => {
    const indexes = new Map<string, number>();
    if (!enabled) return indexes;
    for (let index = 0; index < displayItems.length; index += 1) {
      const item = displayItems[index];
      if (item?.kind === "row") indexes.set(item.row.id, index);
    }
    return indexes;
  }, [displayItems, enabled]);

  const pendingFocus = React.useRef(false);

  const focusCell = React.useCallback(
    (cell: DataGridCell<TData>) => {
      const element = findCellElement(viewportReference.current, cell.id);
      if (element) element.focus();
    },
    [viewportReference],
  );

  const resolveStep = React.useCallback(
    (direction: CellNavigationDirection): StepOutcome => {
      const focused = table.getFocusedCell();
      if (!focused) return undefined;
      const columns = table.getVisibleLeafColumns();

      if (direction === "left" || direction === "right") {
        const columnIndex = columns.findIndex((column) => column.id === focused.column.id);
        const nextColumn = columns[columnIndex + (direction === "left" ? -1 : 1)];
        const displayIndex = displayIndexByRowId.get(focused.row.id);
        if (!nextColumn || columnIndex === -1 || displayIndex === undefined) return undefined;
        return {
          kind: "moved",
          target: { columnId: nextColumn.id, displayIndex, rowId: focused.row.id },
        };
      }

      const from = displayIndexByRowId.get(focused.row.id);
      if (from === undefined) return undefined;
      const stride = direction === "up" ? -1 : 1;
      // Section headers sit in the same list as rows and are not focusable, so
      // a step scans past them rather than counting them.
      for (let index = from + stride; index >= 0 && index < displayItems.length; index += stride) {
        const item = displayItems[index];
        if (item?.kind !== "row") continue;
        return {
          kind: "moved",
          target: { columnId: focused.column.id, displayIndex: index, rowId: item.row.id },
        };
      }
      return direction === "down" ? { kind: "blocked" } : undefined;
    },
    [displayIndexByRowId, displayItems, table],
  );

  const moveTo = React.useCallback(
    (target: CellCoordinate) => {
      pendingFocus.current = true;
      scrollToIndex?.(target.displayIndex);
      table.setFocusedCell(target.rowId, target.columnId);
    },
    [scrollToIndex, table],
  );

  const step = React.useCallback(
    (direction: CellNavigationDirection) => {
      const outcome = resolveStep(direction);
      if (!outcome) return;
      if (outcome.kind === "blocked") {
        if (hasMore) onLoadMore?.();
        return;
      }
      moveTo(outcome.target);
    },
    [hasMore, moveTo, onLoadMore, resolveStep],
  );

  const stepToEdge = React.useCallback(
    (direction: "left" | "right", wholeGrid: boolean) => {
      const focused = table.getFocusedCell();
      const columns = table.getVisibleLeafColumns();
      const column = direction === "left" ? columns[0] : columns.at(-1);
      if (!focused || !column) return;

      let displayIndex = displayIndexByRowId.get(focused.row.id);
      let rowId = focused.row.id;
      if (wholeGrid) {
        const stride = direction === "left" ? 1 : -1;
        const start = direction === "left" ? 0 : displayItems.length - 1;
        for (let index = start; index >= 0 && index < displayItems.length; index += stride) {
          const item = displayItems[index];
          if (item?.kind !== "row") continue;
          displayIndex = index;
          rowId = item.row.id;
          break;
        }
      }
      if (displayIndex === undefined) return;
      moveTo({ columnId: column.id, displayIndex, rowId });
    },
    [displayIndexByRowId, displayItems, moveTo, table],
  );

  const requestFocus = React.useCallback(() => {
    pendingFocus.current = true;
  }, []);

  const focusFirstCell = React.useCallback(() => {
    const firstRow = table.getRowModel().rows[0];
    const firstColumn = table.getVisibleLeafColumns()[0];
    if (!firstRow || !firstColumn) return;
    pendingFocus.current = true;
    table.setFocusedCell(firstRow.id, firstColumn.id);
  }, [table]);

  // Deliberately runs on every render rather than on a dependency list: a cell
  // scrolled in by `moveTo` only reaches the DOM on the commit *after* the
  // virtualizer re-ranges, which no state this hook can watch announces. The
  // ref guard makes the common case a single boolean read.
  React.useEffect(() => {
    if (!enabled || !pendingFocus.current) return;
    const focused = table.getFocusedCell();
    if (!focused) {
      pendingFocus.current = false;
      return;
    }
    const element = findCellElement(viewportReference.current, focused.id);
    if (element) {
      pendingFocus.current = false;
      element.focus();
      return;
    }
    // Still outside the rendered window. `moveTo` already asked the virtualizer
    // to scroll; stop retrying if the row is not in the display model at all.
    if (!displayIndexByRowId.has(focused.row.id)) pendingFocus.current = false;
  });

  // A commit can filter or re-sort the edited row out of the model entirely.
  // `getFocusedCell` still resolves it — the range is keyed by ID, not index —
  // so without this the focused cell has no DOM node and focus falls to <body>.
  const focusedRowId = table.getFocusedCell()?.row.id;
  React.useEffect(() => {
    if (!enabled || focusedRowId === undefined) return;
    if (displayIndexByRowId.has(focusedRowId)) return;
    table.resetCellSelection(true);
    viewportReference.current?.focus();
  }, [displayIndexByRowId, enabled, focusedRowId, table, viewportReference]);

  return { displayIndexByRowId, focusCell, focusFirstCell, requestFocus, step, stepToEdge };
}
