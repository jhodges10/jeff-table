import type { DataGridColumnFilterConfig } from "./types";

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function includesSelection(value: unknown, selected: readonly string[]): boolean {
  if (Array.isArray(value)) return value.some((item) => selected.includes(String(item)));
  return selected.includes(String(value ?? ""));
}

export function matchesColumnFilter(
  value: unknown,
  filterValue: unknown,
  config: DataGridColumnFilterConfig,
): boolean {
  if (filterValue === undefined || filterValue === null || filterValue === "") return true;

  switch (config.type) {
    case "text":
      return normalize(value).includes(normalize(filterValue));
    case "single-select":
    case "boolean":
      return String(value ?? "") === String(filterValue);
    case "multi-select": {
      const selected = Array.isArray(filterValue) ? filterValue.map(String) : [String(filterValue)];
      return selected.length === 0 || includesSelection(value, selected);
    }
    case "number-range": {
      const [rawMin, rawMax] = Array.isArray(filterValue) ? filterValue : [];
      const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
      if (!Number.isFinite(numeric)) return false;
      const min = rawMin === "" || rawMin === undefined ? undefined : Number(rawMin);
      const max = rawMax === "" || rawMax === undefined ? undefined : Number(rawMax);
      return (min === undefined || numeric >= min) && (max === undefined || numeric <= max);
    }
    case "date-range": {
      const [rawStart, rawEnd] = Array.isArray(filterValue) ? filterValue : [];
      const date = new Date(String(value)).getTime();
      if (!Number.isFinite(date)) return false;
      const start = rawStart ? new Date(String(rawStart)).getTime() : undefined;
      const end = rawEnd ? new Date(String(rawEnd)).getTime() : undefined;
      return (start === undefined || date >= start) && (end === undefined || date <= end);
    }
  }
}

export function matchesGlobalFilter(value: unknown, query: string): boolean {
  const normalizedQuery = normalize(query).trim();
  if (!normalizedQuery) return true;
  const candidate = normalize(value);
  if (candidate.includes(normalizedQuery)) return true;

  let queryIndex = 0;
  for (const character of candidate) {
    if (character === normalizedQuery[queryIndex]) queryIndex += 1;
    if (queryIndex === normalizedQuery.length) return true;
  }
  return false;
}
