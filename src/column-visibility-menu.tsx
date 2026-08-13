import type { RowData } from "@tanstack/react-table";
import type { DataGridInstance } from "./features";
import { ColumnsIcon } from "./icons";
import { cx, reconcileColumnOrder } from "./utils";

interface ColumnVisibilityMenuProps<TData extends RowData> {
  className?: string;
  columnOrder: readonly string[];
  columnVisibility: Record<string, boolean>;
  table: DataGridInstance<TData>;
}

export function ColumnVisibilityMenu<TData extends RowData>({
  className,
  columnOrder,
  columnVisibility,
  table,
}: ColumnVisibilityMenuProps<TData>) {
  const allColumns = table.getAllLeafColumns();
  const order = reconcileColumnOrder(
    allColumns.map((column) => column.id),
    columnOrder,
  );
  const rank = new Map(order.map((id, index) => [id, index]));
  const columns = [...allColumns].sort(
    (left, right) =>
      (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
  const visibleCount = columns.filter((column) => column.getIsVisible()).length;

  if (!columns.some((column) => column.getCanHide())) return null;

  return (
    <details className={cx("jt-column-menu", className)} data-slot="column-menu">
      <summary aria-label="Show or hide columns" className="jt-icon-button" title="Columns">
        <ColumnsIcon />
      </summary>
      <fieldset className="jt-column-menu__content">
        <legend className="jt-column-menu__title">Columns</legend>
        {columns.map((column) => {
          const header = column.columnDef.header;
          const label = typeof header === "string" ? header : column.id;
          const locked = !column.getCanHide() || (column.getIsVisible() && visibleCount <= 1);

          return (
            <label
              className="jt-column-menu__item"
              data-disabled={locked || undefined}
              key={column.id}
            >
              <span>{label}</span>
              <input
                checked={columnVisibility[column.id] !== false}
                disabled={locked}
                onChange={() => column.toggleVisibility(!column.getIsVisible())}
                type="checkbox"
              />
            </label>
          );
        })}
      </fieldset>
    </details>
  );
}
