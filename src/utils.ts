import type { RowData } from "@tanstack/react-table";
import type { ReactNode } from "react";
import type { DataGridColumn, DataGridColumnDef, DataGridRow } from "./features";
import type {
  DataGridColumnMeta,
  DataGridNumberFormat,
  DataGridOption,
  DataGridSections,
} from "./types";

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

/**
 * Draws one value the way its column draws values.
 *
 * Every surface that shows a bare value — the body cell, both option lists, a
 * multi-select chip — goes through here, so a column that declares
 * `meta.renderValue` looks the same in all of them.
 */
export function renderColumnValue(meta: DataGridColumnMeta | undefined, value: string): ReactNode {
  return meta?.renderValue?.(value) ?? value;
}

/** The node for one option: a per-surface override, else the column's own. */
export function renderColumnOption(
  meta: DataGridColumnMeta | undefined,
  option: DataGridOption,
  renderOption: ((option: DataGridOption) => ReactNode) | undefined,
): ReactNode {
  return renderOption?.(option) ?? meta?.renderValue?.(option.value) ?? option.label;
}

/** A column's visible label, falling back to its ID when the header is a node. */
export function getColumnLabel<TData extends RowData>(column: DataGridColumn<TData>): string {
  return typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;
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

interface NumberFormatShape {
  decimal: string;
  group: string;
  maximumFractionDigits: number;
  prefix: string;
  suffix: string;
}

const numberFormatterCache = new WeakMap<DataGridNumberFormat, Intl.NumberFormat>();
const numberShapeCache = new WeakMap<DataGridNumberFormat, NumberFormatShape>();

export function createNumberFormatter(format: DataGridNumberFormat): Intl.NumberFormat {
  const cached = numberFormatterCache.get(format);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(format.locale, {
    style: format.style ?? (format.currency === undefined ? "decimal" : "currency"),
    ...(format.currency === undefined ? {} : { currency: format.currency }),
    ...(format.minimumFractionDigits === undefined
      ? {}
      : { minimumFractionDigits: format.minimumFractionDigits }),
    ...(format.maximumFractionDigits === undefined
      ? {}
      : { maximumFractionDigits: format.maximumFractionDigits }),
  });
  numberFormatterCache.set(format, formatter);
  return formatter;
}

/**
 * What the formatter puts around and between the digits.
 *
 * Read off a probe rather than assumed, so a locale that groups with a space
 * and decimalises with a comma masks correctly without a table of exceptions.
 */
function describeNumberFormat(format: DataGridNumberFormat): NumberFormatShape {
  const cached = numberShapeCache.get(format);
  if (cached) return cached;

  const formatter = createNumberFormatter(format);
  const parts = formatter.formatToParts(11_111.11);
  let prefix = "";
  let suffix = "";
  let decimal = ".";
  let group = ",";
  let seenDigits = false;

  for (const part of parts) {
    if (part.type === "integer" || part.type === "fraction") {
      seenDigits = true;
      continue;
    }
    if (part.type === "group") {
      group = part.value;
      continue;
    }
    if (part.type === "decimal") {
      decimal = part.value;
      continue;
    }
    if (seenDigits) suffix += part.value;
    else prefix += part.value;
  }

  const shape: NumberFormatShape = {
    decimal,
    group,
    maximumFractionDigits: formatter.resolvedOptions().maximumFractionDigits ?? 3,
    prefix,
    suffix,
  };
  numberShapeCache.set(format, shape);
  return shape;
}

interface TypedNumber {
  fraction: string;
  hasDecimal: boolean;
  integer: string;
  sign: string;
}

function readTypedNumber(text: string, shape: NumberFormatShape): TypedNumber {
  const sign = text.includes("-") ? "-" : "";
  // A period is accepted as a decimal mark even where the locale writes one of
  // its own — it is what a number pad emits — but never where the locale is
  // already using it to group, or "1.234" would read as one and a bit.
  const fallback = shape.group === "." ? undefined : ".";
  const separator = text.includes(shape.decimal) ? shape.decimal : fallback;
  const cut = separator === undefined ? -1 : text.lastIndexOf(separator);
  const head = cut === -1 ? text : text.slice(0, cut);
  const tail = cut === -1 || separator === undefined ? "" : text.slice(cut + separator.length);
  const digits = (value: string) => value.replace(/\D/g, "");
  return {
    fraction: digits(tail).slice(0, shape.maximumFractionDigits),
    hasDecimal: cut !== -1,
    integer: digits(head),
    sign,
  };
}

function groupDigits(digits: string, group: string): string {
  if (group === "") return digits;
  let grouped = "";
  for (let index = 0; index < digits.length; index += 1) {
    const fromEnd = digits.length - index;
    grouped += digits[index];
    if (fromEnd > 1 && fromEnd % 3 === 1) grouped += group;
  }
  return grouped;
}

/** A number as the column writes it. */
export function formatNumberValue(format: DataGridNumberFormat, value: unknown): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(numeric)) return "";
  return createNumberFormatter(format).format(numeric);
}

/**
 * Keeps a partly typed number looking like the column's own numbers.
 *
 * The integer side is grouped as it is typed while the fraction is left exactly
 * as typed — reformatting the whole value on every keystroke would append the
 * minimum fraction digits and make the field impossible to type into.
 */
export function maskNumberText(format: DataGridNumberFormat, text: string): string {
  const shape = describeNumberFormat(format);
  const typed = readTypedNumber(text, shape);
  if (typed.integer === "" && typed.fraction === "" && !typed.hasDecimal) {
    return typed.sign;
  }
  const body =
    groupDigits(typed.integer, shape.group) +
    (typed.hasDecimal ? shape.decimal + typed.fraction : "");
  // The sign leads, which is where every locale this formats for puts it.
  return `${typed.sign}${shape.prefix}${body}${shape.suffix}`;
}

/** The number behind text the column wrote, or that someone typed into it. */
export function parseNumberText(format: DataGridNumberFormat, text: string): number | undefined {
  const shape = describeNumberFormat(format);
  const typed = readTypedNumber(text, shape);
  if (typed.integer === "" && typed.fraction === "") return undefined;
  const numeric = Number(`${typed.sign}${typed.integer || "0"}.${typed.fraction || "0"}`);
  return Number.isFinite(numeric) ? numeric : undefined;
}
