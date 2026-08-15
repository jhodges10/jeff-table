import {
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnSizingState,
  type ColumnVisibilityState,
  functionalUpdate,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import * as React from "react";
import { defaultPreferenceStorage } from "./preferences";
import type { DataGridPreferenceStorage, DataGridPreferences } from "./types";
import { reconcileColumnOrder } from "./utils";

interface DataGridStateOptions {
  columnIds: readonly string[];
  columnFilters: ColumnFiltersState | undefined;
  defaultColumnFilters: ColumnFiltersState | undefined;
  defaultColumnVisibility: ColumnVisibilityState | undefined;
  defaultGlobalFilter: string | undefined;
  defaultSorting: SortingState | undefined;
  globalFilter: string | undefined;
  initialPreferences: Partial<DataGridPreferences> | undefined;
  onColumnFiltersChange: ((filters: ColumnFiltersState) => void) | undefined;
  onGlobalFilterChange: ((value: string) => void) | undefined;
  onPreferencesChange: ((preferences: DataGridPreferences) => void) | undefined;
  onSortingChange: ((sorting: SortingState) => void) | undefined;
  preferenceStorage: DataGridPreferenceStorage | null | undefined;
  rowSelection: RowSelectionState | undefined;
  sorting: SortingState | undefined;
  tableId: string | undefined;
}

export function useDataGridState(options: DataGridStateOptions) {
  const storage =
    options.preferenceStorage === undefined ? defaultPreferenceStorage : options.preferenceStorage;
  const [seed] = React.useState(() => {
    const stored = options.tableId && storage ? storage.load(options.tableId) : undefined;
    return {
      ...options.initialPreferences,
      ...stored,
      columnVisibility: {
        ...options.defaultColumnVisibility,
        ...options.initialPreferences?.columnVisibility,
        ...stored?.columnVisibility,
      },
    };
  });

  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(() =>
    reconcileColumnOrder(options.columnIds, seed.columnOrder),
  );
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(
    () => seed.columnSizing ?? {},
  );
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>(
    () => seed.columnVisibility ?? {},
  );
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    () => options.defaultSorting ?? [],
  );
  const [internalColumnFilters, setInternalColumnFilters] = React.useState<ColumnFiltersState>(
    () => options.defaultColumnFilters ?? [],
  );
  const [internalGlobalFilter, setInternalGlobalFilter] = React.useState(
    () => options.defaultGlobalFilter ?? "",
  );
  const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({});

  const sorting = options.sorting ?? internalSorting;
  const columnFilters = options.columnFilters ?? internalColumnFilters;
  const globalFilter = options.globalFilter ?? internalGlobalFilter;
  const rowSelection = options.rowSelection ?? internalRowSelection;

  React.useEffect(() => {
    setColumnOrder((current) => reconcileColumnOrder(options.columnIds, current));
  }, [options.columnIds]);

  const preferences = React.useMemo<DataGridPreferences>(
    () => ({ columnOrder, columnSizing, columnVisibility }),
    [columnOrder, columnSizing, columnVisibility],
  );

  const hasMounted = React.useRef(false);
  // A reset clears storage, and the state change it causes must not immediately
  // write the current defaults back: a stored copy of today's defaults would
  // silently outrank tomorrow's.
  const skipNextSave = React.useRef(false);
  React.useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (skipNextSave.current) {
      skipNextSave.current = false;
      options.onPreferencesChange?.(preferences);
      return;
    }
    if (options.tableId && storage) storage.save(options.tableId, preferences);
    options.onPreferencesChange?.(preferences);
  }, [options.onPreferencesChange, options.tableId, preferences, storage]);

  const onSortingChange = React.useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      const next = functionalUpdate(updater, sorting);
      if (options.sorting === undefined) setInternalSorting(next);
      options.onSortingChange?.(next);
    },
    [options.onSortingChange, options.sorting, sorting],
  );
  const onColumnFiltersChange = React.useCallback<OnChangeFn<ColumnFiltersState>>(
    (updater) => {
      const next = functionalUpdate(updater, columnFilters);
      if (options.columnFilters === undefined) setInternalColumnFilters(next);
      options.onColumnFiltersChange?.(next);
    },
    [columnFilters, options.columnFilters, options.onColumnFiltersChange],
  );
  const onGlobalFilterChange = React.useCallback<OnChangeFn<string>>(
    (updater) => {
      const next = functionalUpdate(updater, globalFilter);
      if (options.globalFilter === undefined) setInternalGlobalFilter(next);
      options.onGlobalFilterChange?.(next);
    },
    [globalFilter, options.globalFilter, options.onGlobalFilterChange],
  );
  const onRowSelectionChange = React.useCallback<OnChangeFn<RowSelectionState>>(
    (updater) => {
      const next = functionalUpdate(updater, rowSelection);
      if (options.rowSelection === undefined) setInternalRowSelection(next);
    },
    [options.rowSelection, rowSelection],
  );

  const resetPreferences = React.useCallback(() => {
    skipNextSave.current = true;
    setColumnOrder([...options.columnIds]);
    setColumnSizing({});
    setColumnVisibility(options.defaultColumnVisibility ?? {});
    if (options.tableId && storage?.remove) storage.remove(options.tableId);
  }, [options.columnIds, options.defaultColumnVisibility, options.tableId, storage]);

  return {
    columnFilters,
    columnOrder,
    columnSizing,
    columnVisibility,
    globalFilter,
    onColumnFiltersChange,
    onColumnOrderChange: setColumnOrder as OnChangeFn<ColumnOrderState>,
    onColumnSizingChange: setColumnSizing as OnChangeFn<ColumnSizingState>,
    onColumnVisibilityChange: setColumnVisibility as OnChangeFn<ColumnVisibilityState>,
    onGlobalFilterChange,
    onRowSelectionChange,
    onSortingChange,
    preferences,
    resetPreferences,
    rowSelection,
    sorting,
  };
}
