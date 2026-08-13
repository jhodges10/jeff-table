import type { DataGridPreferenceStorage, DataGridPreferences } from "./types";

const STORAGE_PREFIX = "jeff-table:v1:";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseDataGridPreferences(
  value: string | null | undefined,
): DataGridPreferences | undefined {
  if (!value) return undefined;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return undefined;
    const { columnOrder, columnSizing, columnVisibility } = parsed;

    if (!Array.isArray(columnOrder) || !columnOrder.every((id) => typeof id === "string")) {
      return undefined;
    }
    if (
      !isRecord(columnSizing) ||
      !Object.values(columnSizing).every(
        (size) => typeof size === "number" && Number.isFinite(size),
      )
    ) {
      return undefined;
    }
    if (
      !isRecord(columnVisibility) ||
      !Object.values(columnVisibility).every((visible) => typeof visible === "boolean")
    ) {
      return undefined;
    }

    return {
      columnOrder,
      columnSizing: columnSizing as Record<string, number>,
      columnVisibility: columnVisibility as Record<string, boolean>,
    };
  } catch {
    return undefined;
  }
}

export function createLocalStoragePreferenceStorage(
  prefix = STORAGE_PREFIX,
): DataGridPreferenceStorage {
  return {
    load(tableId) {
      if (typeof window === "undefined") return undefined;
      try {
        return parseDataGridPreferences(window.localStorage.getItem(`${prefix}${tableId}`));
      } catch {
        return undefined;
      }
    },
    remove(tableId) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.removeItem(`${prefix}${tableId}`);
      } catch {
        // Storage may be blocked. In-memory state is still reset by the caller.
      }
    },
    save(tableId, preferences) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(`${prefix}${tableId}`, JSON.stringify(preferences));
      } catch {
        // Storage may be unavailable or full. The grid remains usable in memory.
      }
    },
  };
}

export const defaultPreferenceStorage = createLocalStoragePreferenceStorage();
