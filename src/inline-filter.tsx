import type { RowData } from "@tanstack/react-table";
import type { ChangeEvent } from "react";
import type { DataGridColumn } from "./features";
import type { DataGridColumnFilterConfig } from "./types";

interface InlineFilterProps<TData extends RowData> {
  column: DataGridColumn<TData>;
  config: DataGridColumnFilterConfig;
}

function RangeFilter<TData extends RowData>({
  column,
  config,
}: InlineFilterProps<TData>) {
  const current = column.getFilterValue();
  const values = Array.isArray(current) ? current.map(String) : ["", ""];
  const inputType = config.type === "date-range" ? "date" : "number";
  const labels = config.type === "date-range" ? ["Start", "End"] : ["Minimum", "Maximum"];

  const update = (index: number, value: string) => {
    const next = [values[0] ?? "", values[1] ?? ""];
    next[index] = value;
    column.setFilterValue(next.every((entry) => entry === "") ? undefined : next);
  };

  return (
    <details className="jt-filter jt-filter--range" onClick={(event) => event.stopPropagation()}>
      <summary aria-label={`Filter ${column.id}`}>
        {values.some(Boolean) ? "Filtered" : config.placeholder ?? "Any"}
      </summary>
      <div className="jt-filter__popover">
        {labels.map((label, index) => (
          <label key={label}>
            <span>{label}</span>
            <input
              max={config.max}
              min={config.min}
              onChange={(event) => update(index, event.target.value)}
              step={config.step}
              type={inputType}
              value={values[index] ?? ""}
            />
          </label>
        ))}
      </div>
    </details>
  );
}

function MultiSelectFilter<TData extends RowData>({
  column,
  config,
}: InlineFilterProps<TData>) {
  const current = column.getFilterValue();
  const selected = new Set(Array.isArray(current) ? current.map(String) : []);

  return (
    <details className="jt-filter jt-filter--multi" onClick={(event) => event.stopPropagation()}>
      <summary aria-label={`Filter ${column.id}`}>
        {selected.size > 0 ? `${selected.size} selected` : config.placeholder ?? "Any"}
      </summary>
      <div className="jt-filter__popover">
        {config.options?.map((option) => (
          <label key={option.value}>
            <input
              checked={selected.has(option.value)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(option.value);
                else next.delete(option.value);
                column.setFilterValue(next.size > 0 ? [...next] : undefined);
              }}
              type="checkbox"
            />
            <span>{config.renderOption?.(option) ?? option.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

export function InlineFilter<TData extends RowData>({ column, config }: InlineFilterProps<TData>) {
  if (config.type === "multi-select") {
    return <MultiSelectFilter column={column} config={config} />;
  }
  if (config.type === "date-range" || config.type === "number-range") {
    return <RangeFilter column={column} config={config} />;
  }

  if (config.type === "text") {
    return (
      <input
        aria-label={`Filter ${column.id}`}
        className="jt-filter jt-filter--text"
        onChange={(event) => column.setFilterValue(event.target.value || undefined)}
        onClick={(event) => event.stopPropagation()}
        placeholder={config.placeholder ?? "Filter…"}
        type="search"
        value={String(column.getFilterValue() ?? "")}
      />
    );
  }

  const options =
    config.type === "boolean"
      ? [
          { label: "Yes", value: "true" },
          { label: "No", value: "false" },
        ]
      : (config.options ?? []);

  return (
    <select
      aria-label={`Filter ${column.id}`}
      className="jt-filter jt-filter--select"
      onChange={(event: ChangeEvent<HTMLSelectElement>) =>
        column.setFilterValue(event.target.value || undefined)
      }
      onClick={(event) => event.stopPropagation()}
      value={String(column.getFilterValue() ?? "")}
    >
      <option value="">{config.placeholder ?? "Any"}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
