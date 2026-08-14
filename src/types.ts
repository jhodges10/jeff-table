import type {
  ColumnFiltersState,
  ColumnOrderState,
  ColumnSizingState,
  ColumnVisibilityState,
  RowData,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import type { CSSProperties, ReactNode } from "react";
import type { DataGridColumnDef, DataGridInstance, DataGridRow } from "./features";

export type DataGridAlignment = "left" | "center" | "right";
export type DataGridDensity = "compact" | "comfortable" | "spacious";

export interface DataGridFilterOption {
  label: string;
  value: string;
}

export interface DataGridColumnFilterConfig {
  format?: "currency" | "number";
  max?: number;
  min?: number;
  options?: readonly DataGridFilterOption[];
  placeholder?: string;
  renderOption?: (option: DataGridFilterOption) => ReactNode;
  step?: number;
  type: "boolean" | "date-range" | "multi-select" | "number-range" | "single-select" | "text";
}

export interface DataGridSkeletonConfig {
  maxWidth?: number;
  minWidth?: number;
  shape?: "bar" | "circle" | "square";
  size?: number;
}

export interface DataGridColumnMeta {
  cellAlign?: DataGridAlignment;
  cellClassName?: string;
  filter?: DataGridColumnFilterConfig;
  headerAlign?: DataGridAlignment;
  headerClassName?: string;
  headerTooltip?: ReactNode;
  maxWidth?: number;
  minWidth?: number;
  numericSort?: boolean;
  prefix?: string;
  reorderable?: boolean;
  resizable?: boolean;
  skeleton?: false | DataGridSkeletonConfig;
  suffix?: string;
  width?: string;
}

export interface DataGridPreferences {
  columnOrder: ColumnOrderState;
  columnSizing: ColumnSizingState;
  columnVisibility: ColumnVisibilityState;
}

export interface DataGridPreferenceStorage {
  load: (tableId: string) => DataGridPreferences | undefined;
  remove?: (tableId: string) => void;
  save: (tableId: string, preferences: DataGridPreferences) => void;
}

export interface DataGridTheme {
  accent: string;
  accentForeground: string;
  background: string;
  border: string;
  danger: string;
  foreground: string;
  headerBackground: string;
  hover: string;
  muted: string;
  mutedForeground: string;
  radius: string;
  selected: string;
  shadow: string;
}

export type DataGridClassNameSlot =
  | "root"
  | "header"
  | "headerStart"
  | "headerEnd"
  | "viewport"
  | "columnHeaders"
  | "columnHeader"
  | "filter"
  | "body"
  | "row"
  | "cell"
  | "sectionHeader"
  | "skeleton"
  | "empty"
  | "error"
  | "footer"
  | "footerStart"
  | "footerEnd"
  | "columnMenu";

export type DataGridClassNames = Partial<Record<DataGridClassNameSlot, string>>;

export interface DataGridSectionSelectionContext<TData extends RowData> {
  checked: boolean;
  disabled: boolean;
  indeterminate: boolean;
  key: string;
  rows: readonly TData[];
  selectedRows: readonly TData[];
  toggle: (selected?: boolean) => void;
}

export interface DataGridSections<TData extends RowData> {
  getKey: (row: TData) => string;
  renderHeader: (context: { key: string; rows: readonly TData[] }) => ReactNode;
  renderSelection?: (context: DataGridSectionSelectionContext<TData>) => ReactNode;
  headerHeight?: number;
}

export interface DataGridRenderContext<TData extends RowData> {
  isLoading: boolean;
  loadedCount: number;
  resetPreferences: () => void;
  selectedRows: readonly TData[];
  table: DataGridInstance<TData>;
  totalCount: number;
}

export type DataGridSlot<TData extends RowData> =
  | ReactNode
  | ((context: DataGridRenderContext<TData>) => ReactNode);

export interface DataGridSlots<TData extends RowData> {
  columnHeaderEnd?: DataGridSlot<TData>;
  empty?: DataGridSlot<TData>;
  error?: DataGridSlot<TData>;
  footerEnd?: DataGridSlot<TData>;
  footerStart?: DataGridSlot<TData>;
  headerEnd?: DataGridSlot<TData>;
  headerStart?: DataGridSlot<TData>;
  loadingIndicator?: DataGridSlot<TData>;
}

export interface DataGridBaseProps<TData extends RowData> {
  "aria-label"?: string;
  className?: string;
  classNames?: DataGridClassNames;
  columnFilters?: ColumnFiltersState;
  columns: readonly DataGridColumnDef<TData>[];
  data: readonly TData[];
  defaultColumnFilters?: ColumnFiltersState;
  defaultColumnVisibility?: ColumnVisibilityState;
  defaultGlobalFilter?: string;
  defaultSorting?: SortingState;
  density?: DataGridDensity;
  emptyMessage?: string;
  enableColumnFiltering?: boolean;
  enableColumnReordering?: boolean;
  enableColumnResizing?: boolean;
  enableColumnVisibility?: boolean;
  enableGlobalFilter?: boolean;
  error?: unknown;
  globalFilter?: string;
  hasMore?: boolean;
  height?: number | string;
  initialPreferences?: Partial<DataGridPreferences>;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  loadMoreThreshold?: number;
  manualFiltering?: boolean;
  manualSorting?: boolean;
  maxVisibleRows?: number;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  onGlobalFilterChange?: (value: string) => void;
  onLoadMore?: (context: { loadedCount: number; totalCount: number }) => void | Promise<void>;
  onPreferencesChange?: (preferences: DataGridPreferences) => void;
  onRowClick?: (row: DataGridRow<TData>) => void;
  onSortingChange?: (sorting: SortingState) => void;
  overscan?: number;
  preferenceStorage?: DataGridPreferenceStorage | null;
  rowClassName?: string | ((row: DataGridRow<TData>) => string | undefined);
  rowHeight?: number;
  searchPlaceholder?: string;
  sections?: DataGridSections<TData>;
  showFooter?: boolean;
  skeletonRowCount?: number;
  slots?: DataGridSlots<TData>;
  sorting?: SortingState;
  style?: CSSProperties;
  tableId?: string;
  testId?: string;
  theme?: Partial<DataGridTheme>;
  /** The complete server-side record count. Required to size virtualization and report progress. */
  totalCount: number;
  virtualize?: boolean;
}

export type DataGridSelectionProps<TData extends RowData> =
  | {
      enableRowSelection: true;
      getRowId: (row: TData, index: number) => string;
      isRowSelectable?: (row: TData) => boolean;
      onRowSelectionChange?: (selection: RowSelectionState, rows: readonly TData[]) => void;
      rowSelection?: RowSelectionState;
    }
  | {
      enableRowSelection?: false;
      getRowId?: (row: TData, index: number) => string;
      isRowSelectable?: never;
      onRowSelectionChange?: never;
      rowSelection?: never;
    };

export type DataGridProps<TData extends RowData> = DataGridBaseProps<TData> &
  DataGridSelectionProps<TData>;
