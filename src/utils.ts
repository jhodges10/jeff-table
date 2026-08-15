import type { RowData } from "@tanstack/react-table";
import type { DataGridColumnDef, DataGridRow } from "./features";
import type { DataGridSections } from "./types";

export type DataGridDisplayItem<TData extends RowData> =
  | {
      key: string;
      kind: "section";
      rowModels: readonly DataGridRow<TData>[];
      rows: readonly TData[];
    }
  | { kind: "row"; row: DataGridRow<TData> };

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/**
 * Closes a `<details>` popover on Escape and returns focus to its summary, so
 * a keyboard user is never stranded inside an open menu.
 */
export function closeDetailsOnEscape(
  event: { currentTarget: EventTarget | null; key: string; preventDefault: () => void },
  close: () => void,
): void {
  if (event.key !== "Escape") return;
  event.preventDefault();
  close();
  const summary =
    event.currentTarget instanceof Element ? event.currentTarget.querySelector("summary") : null;
  if (summary instanceof HTMLElement) summary.focus();
}

export function getColumnDefinitionId<TData extends RowData>(
  column: DataGridColumnDef<TData>,
): string | undefined {
  if ("id" in column && column.id) return column.id;
  const accessorKey = "accessorKey" in column ? column.accessorKey : undefined;
  return typeof accessorKey === "string" || typeof accessorKey === "number"
    ? String(accessorKey)
    : undefined;
}

export function reconcileColumnOrder(
  columnIds: readonly string[],
  storedOrder: readonly string[] | null | undefined,
): string[] {
  if (!storedOrder || storedOrder.length === 0) return [...columnIds];
  const validIds = new Set(columnIds);
  const seen = new Set<string>();
  const order: string[] = [];

  for (const id of storedOrder) {
    if (validIds.has(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of columnIds) {
    if (!seen.has(id)) order.push(id);
  }
  return order;
}

export interface ColumnDropTarget {
  id: string;
  side: "left" | "right";
}

export function resolveColumnDropTarget(
  order: readonly string[],
  hoveredId: string,
  isLeftHalf: boolean,
): ColumnDropTarget {
  const index = order.indexOf(hoveredId);
  if (isLeftHalf && index > 0) {
    const previousId = order[index - 1];
    if (previousId) return { id: previousId, side: "right" };
  }
  return { id: hoveredId, side: isLeftHalf ? "left" : "right" };
}

export function moveColumn(
  order: readonly string[],
  sourceId: string,
  targetId: string,
  side: "left" | "right",
): string[] {
  if (sourceId === targetId) return [...order];
  const next = order.filter((id) => id !== sourceId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex === -1) return [...order];
  next.splice(side === "left" ? targetIndex : targetIndex + 1, 0, sourceId);
  return next;
}

export function deterministicSkeletonWidth(
  rowIndex: number,
  columnId: string,
  minWidth = 38,
  maxWidth = 88,
): number {
  let hash = (rowIndex + 1) * 2_654_435_761;
  for (let index = 0; index < columnId.length; index += 1) {
    hash = Math.imul(hash ^ (columnId.charCodeAt(index) + index), 1_597_334_677);
  }
  const normalized = ((hash >>> 0) % 10_000) / 10_000;
  return Math.round(minWidth + normalized * Math.max(0, maxWidth - minWidth));
}

export function calculateViewportHeight(options: {
  headerRows?: number;
  maxVisibleRows?: number;
  rowHeight: number;
  totalCount: number;
}): number {
  const headerRows = options.headerRows ?? 1;
  const maxVisibleRows = options.maxVisibleRows ?? 12;
  const visibleRows = Math.max(1, Math.min(options.totalCount, maxVisibleRows));
  return visibleRows * options.rowHeight + headerRows * options.rowHeight;
}

export function buildSectionItems<TData extends RowData>(
  rows: readonly DataGridRow<TData>[],
  sections: DataGridSections<TData> | undefined,
): DataGridDisplayItem<TData>[] {
  if (!sections) return rows.map((row) => ({ kind: "row", row }));

  const groups = new Map<string, DataGridRow<TData>[]>();
  for (const row of rows) {
    const key = sections.getKey(row.original);
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }

  const items: DataGridDisplayItem<TData>[] = [];
  for (const [key, groupRows] of groups) {
    items.push({
      key,
      kind: "section",
      rowModels: groupRows,
      rows: groupRows.map((row) => row.original),
    });
    for (const row of groupRows) items.push({ kind: "row", row });
  }
  return items;
}
