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
/**
 * How the viewport paints overflow.
 *
 * - `overlay` (default) hides the OS gutter and draws inset thumbs on the rows.
 * - `native` keeps platform scrollbars, styled to the grid tokens on Chromium.
 */
export type DataGridScrollbar = "native" | "overlay";

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

/**
 * The complete design-token surface. Every field maps to one `--jt-*` custom
 * property (see `dataGridThemeTokens`); pass any subset through the `theme`
 * prop, or set the same custom properties in CSS.
 */
export interface DataGridTheme {
  /** Primary action colour: sort affordances, focus rings, selected checkboxes. */
  accent: string;
  /** Text/icon colour drawn on top of `accent`. */
  accentForeground: string;
  /** Grid surface behind rows. */
  background: string;
  /** Outer border of the grid, header band, footer, and popovers. */
  border: string;
  /** Vertical padding inside body cells. */
  cellPaddingBlock: string;
  /** Horizontal padding inside header and body cells. */
  cellPaddingInline: string;
  /** Corner radius for inputs, buttons, and menu items. */
  controlRadius: string;
  /** Error text colour. */
  danger: string;
  /** Focus ring colour. Defaults to `accent`. */
  focusRing: string;
  /** Font stack for the whole grid. Defaults to `inherit`. */
  fontFamily: string;
  /** Base font size for body cells. Density presets adjust this. */
  fontSize: string;
  /** Primary text colour. */
  foreground: string;
  /** Cell separator colour. Defaults to `border`. */
  gridLine: string;
  /** Column header band background. */
  headerBackground: string;
  /** Column header label colour. Defaults to `mutedForeground`. */
  headerForeground: string;
  /** Row hover background. */
  hover: string;
  /** Subdued fill for section headers, menu hover, and skeleton bases. */
  muted: string;
  /** Secondary text colour. */
  mutedForeground: string;
  /** Background for popovers, menus, and the date-range panel. */
  overlayBackground: string;
  /** Complete `box-shadow` value for popovers and menus. */
  overlayShadow: string;
  /** Corner radius of the grid shell. */
  radius: string;
  /** Viewport scrollbar thumb colour. */
  scrollbarThumb: string;
  /** Section header background. Defaults to `muted`. */
  sectionBackground: string;
  /** Selected row background. */
  selected: string;
  /** Complete `box-shadow` value for the grid shell. */
  shadow: string;
  /** Skeleton placeholder fill. */
  skeleton: string;
  /** Complete `box-shadow` value for a pinned section header. */
  stickyShadow: string;
  /** Header tooltip background. */
  tooltipBackground: string;
  /** Header tooltip text colour. */
  tooltipForeground: string;
}

/**
 * How the grid resolves its built-in light/dark token pairs.
 *
 * - `inherit` (default) follows the host page's `color-scheme`, including the
 *   `.dark` and `[data-theme="dark"]` class conventions.
 * - `system` follows the operating system regardless of the host page.
 * - `light` / `dark` pin the grid.
 */
export type DataGridColorScheme = "dark" | "inherit" | "light" | "system";

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
  colorScheme?: DataGridColorScheme;
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
  scrollbar?: DataGridScrollbar;
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
