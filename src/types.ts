import type {
  CellSelectionState,
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

/** Persistence state of an individual cell. */
export type DataGridCellStatus = "idle" | "saving" | "error";

export type DataGridAlignment = "left" | "center" | "right";
export type DataGridDensity = "compact" | "comfortable" | "spacious";
/**
 * How the viewport paints overflow.
 *
 * - `overlay` (default) hides the OS gutter and draws inset thumbs on the rows.
 * - `native` keeps platform scrollbars, styled to the grid tokens on Chromium.
 */
export type DataGridScrollbar = "native" | "overlay";

/** A single known value a column can be filtered by or edited to. */
export interface DataGridOption {
  label: string;
  value: string;
}

/** @deprecated Use {@link DataGridOption}; filters and editors share one option shape. */
export type DataGridFilterOption = DataGridOption;

export interface DataGridColumnFilterConfig {
  format?: "currency" | "number";
  max?: number;
  min?: number;
  options?: readonly DataGridOption[];
  placeholder?: string;
  /** Overrides `meta.renderValue` for this filter's option list only. */
  renderOption?: (option: DataGridOption) => ReactNode;
  step?: number;
  type: "boolean" | "date-range" | "multi-select" | "number-range" | "single-select" | "text";
}

/**
 * How a column's cells are edited in place. The `type` picks the control, the
 * same way `filter.type` picks the filter UI.
 *
 * `single-select` and `multi-select` need known options. They fall back to
 * `filter.options` when this config omits its own, so a column that already
 * declares a select filter becomes editable without repeating the list.
 */
export interface DataGridColumnEditorConfig {
  /** Lets a typed value that matches no option be committed as-is. */
  allowCustomValue?: boolean;
  /**
   * Which control a `boolean` column draws. Defaults to `"switch"`.
   *
   * A switch reads as a setting that takes effect at once; a checkbox reads as
   * a value in a record. Both commit on click and on Space, and both are the
   * whole editor — a boolean has nothing to draft.
   */
  control?: "checkbox" | "switch";
  /** Set `false` to render the editor's display form without allowing edits. */
  editable?: boolean;
  max?: number;
  min?: number;
  /** Defaults to `filter.options` when omitted. */
  options?: readonly DataGridOption[];
  placeholder?: string;
  /** Overrides `meta.renderValue` for this editor's option list only. */
  renderOption?: (option: DataGridOption) => ReactNode;
  /** Rejects an empty commit and keeps the editor open. */
  required?: boolean;
  step?: number;
  type: "boolean" | "date" | "multi-select" | "number" | "single-select" | "text";
  /** Return a message to reject the value; return nothing to accept it. */
  validate?: (value: unknown) => string | undefined;
}

/**
 * How a numeric column is written, in the cell and in its editor.
 *
 * The grid owns both the formatting and the parsing so the two cannot drift: a
 * cell that reads `$40,845.00` opens an editor that reads `$40,845.00`, not a
 * bare `40845` in whatever the browser felt like.
 */
export interface DataGridNumberFormat {
  /** An ISO code, e.g. `USD`. Setting it implies the `currency` style. */
  currency?: string;
  /** Defaults to the host locale. */
  locale?: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  style?: "currency" | "decimal" | "percent";
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
  editor?: DataGridColumnEditorConfig;
  filter?: DataGridColumnFilterConfig;
  headerAlign?: DataGridAlignment;
  headerClassName?: string;
  headerTooltip?: ReactNode;
  maxWidth?: number;
  minWidth?: number;
  numberFormat?: DataGridNumberFormat;
  numericSort?: boolean;
  prefix?: string;
  /**
   * How one of this column's values is drawn, wherever it appears.
   *
   * A status badge is a property of the value, not of the body cell, so
   * declaring it once here paints it in the cell, in the filter's option list,
   * in the editor's option list, and on a multi-select chip. Without it those
   * surfaces fall back to the option label and the cell falls back to text, and
   * the same value reads three different ways.
   *
   * A `cell` renderer still wins in the body, where it has the whole row to
   * work with; this covers everywhere that only has the value.
   */
  renderValue?: (value: string) => ReactNode;
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
  | "cellEditor"
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
  /** External cell persistence state. In-flight edits and failures take precedence. */
  getCellStatus?: (context: {
    columnId: string;
    row: TData;
    rowId: string;
  }) => DataGridCellStatus | undefined;
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

/**
 * How an optimistic value is written back onto a row.
 *
 * The default writes the value at the column ID, which is correct for every
 * `accessorKey` column, dotted paths included. A column with a custom
 * `accessorFn` has no matching property, so those columns need this.
 */
export type DataGridApplyCellEdit<TData extends RowData> = (
  row: TData,
  columnId: string,
  value: unknown,
) => TData;

/** One committed cell change, reported to `onCellEdit`. */
export interface DataGridCellEdit<TData extends RowData> {
  columnId: string;
  previousValue: unknown;
  /** The row as it was before the edit. */
  row: TData;
  rowId: string;
  value: unknown;
}

/**
 * Inline editing is a discriminated contract, like selection. Turning it on
 * makes `getRowId` mandatory — the optimistic overlay and the focused-cell
 * coordinate are both addressed by row ID, so an index-based identity would
 * drift the moment a server sort or an appended page rearranged the rows.
 */
export type DataGridEditingProps<TData extends RowData> =
  | {
      applyCellEdit?: DataGridApplyCellEdit<TData>;
      cellSelection?: CellSelectionState;
      defaultCellSelection?: CellSelectionState;
      enableInlineEditing: true;
      getRowId: (row: TData, index: number) => string;
      isCellEditable?: (context: { columnId: string; row: TData }) => boolean;
      onCellEdit: (edit: DataGridCellEdit<TData>) => void | Promise<void>;
      onCellSelectionChange?: (selection: CellSelectionState) => void;
    }
  | {
      applyCellEdit?: never;
      cellSelection?: never;
      defaultCellSelection?: never;
      enableInlineEditing?: false;
      isCellEditable?: never;
      onCellEdit?: never;
      onCellSelectionChange?: never;
    };

export type DataGridProps<TData extends RowData> = DataGridBaseProps<TData> &
  DataGridSelectionProps<TData> &
  DataGridEditingProps<TData>;
