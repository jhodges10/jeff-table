import {
  type Column,
  type ColumnDef,
  columnFilteringFeature,
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  type Header,
  metaHelper,
  type ReactTable,
  type Row,
  type RowData,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_text,
  type Table,
  tableFeatures,
} from "@tanstack/react-table";
import type { DataGridColumnMeta } from "./types";

export const dataGridFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
  columnMeta: metaHelper<DataGridColumnMeta>(),
});

export type DataGridFeatures = typeof dataGridFeatures;
export type DataGridColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<
  DataGridFeatures,
  TData,
  TValue
>;
export type DataGridColumn<TData extends RowData, TValue = unknown> = Column<
  DataGridFeatures,
  TData,
  TValue
>;
export type DataGridHeader<TData extends RowData, TValue = unknown> = Header<
  DataGridFeatures,
  TData,
  TValue
>;
export type DataGridInstance<TData extends RowData> = ReactTable<DataGridFeatures, TData>;
export type DataGridRow<TData extends RowData> = Row<DataGridFeatures, TData>;
export type DataGridTable<TData extends RowData> = Table<DataGridFeatures, TData>;
