import type { RowData } from "@tanstack/react-table";
import * as React from "react";
import { DateRangePickerPanel } from "./date-range-picker";
import type { DataGridColumn, DataGridInstance } from "./features";
import { IndeterminateCheckbox } from "./indeterminate-checkbox";
import type { DataGridColumnFilterConfig, DataGridFilterOption } from "./types";

type FilterValue = string | string[] | undefined;

interface ColumnFilterEditorProps {
  config: DataGridColumnFilterConfig;
  onChange: (value: FilterValue) => void;
  onDone?: () => void;
  value: FilterValue;
}

interface InlineFilterProps<TData extends RowData> {
  column: DataGridColumn<TData>;
  config: DataGridColumnFilterConfig;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  popoverGroup: string;
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
      <path
        d="m5 12 4 4L19 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ChevronIcon({ direction = "right" }: { direction?: "left" | "right" }) {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function normalizeFilterValue(value: unknown): FilterValue {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function isFilterValueActive(value: FilterValue): boolean {
  return Array.isArray(value) ? value.some(Boolean) : Boolean(value);
}

function getActiveCount(value: FilterValue, config: DataGridColumnFilterConfig): number {
  if (!isFilterValueActive(value)) return 0;
  if (config.type === "multi-select") return Array.isArray(value) ? value.length : 0;
  if ((config.type === "date-range" || config.type === "number-range") && Array.isArray(value)) {
    return value.filter(Boolean).length;
  }
  return 1;
}

function FilterClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="jt-filter-editor__clear" onClick={onClick} type="button">
      <span aria-hidden="true">×</span>
      {label}
    </button>
  );
}

function OptionContent({
  config,
  option,
}: {
  config: DataGridColumnFilterConfig;
  option: DataGridFilterOption;
}) {
  return config.renderOption?.(option) ?? option.label;
}

function SelectFilterEditor({ config, onChange, onDone, value }: ColumnFilterEditorProps) {
  const [search, setSearch] = React.useState("");
  const options = config.options ?? [];
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const isMulti = config.type === "multi-select";
  const filteredOptions = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query
      ? options.filter((option) => option.label.toLocaleLowerCase().includes(query))
      : options;
  }, [options, search]);

  const select = (optionValue: string) => {
    if (!isMulti) {
      onChange(optionValue);
      onDone?.();
      return;
    }
    const next = selected.includes(optionValue)
      ? selected.filter((item) => item !== optionValue)
      : [...selected, optionValue];
    onChange(next.length > 0 ? next : undefined);
  };

  return (
    <div className="jt-filter-editor">
      {options.length >= 8 ? (
        <label className="jt-filter-editor__search">
          <SearchIcon />
          <span className="jt-sr-only">Search filter options</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search options…"
            type="search"
            value={search}
          />
        </label>
      ) : null}
      <div className="jt-filter-editor__options">
        {filteredOptions.length === 0 ? (
          <p className="jt-filter-editor__empty">No options found</p>
        ) : (
          filteredOptions.map((option) => {
            const checked = selected.includes(option.value);
            return isMulti ? (
              // biome-ignore lint/a11y/noLabelWithoutControl: IndeterminateCheckbox renders the nested checkbox input
              <label
                className="jt-filter-editor__option"
                data-selected={checked || undefined}
                key={option.value}
              >
                <span>
                  <OptionContent config={config} option={option} />
                </span>
                <IndeterminateCheckbox checked={checked} onChange={() => select(option.value)} />
              </label>
            ) : (
              <button
                className="jt-filter-editor__option"
                data-selected={checked || undefined}
                key={option.value}
                onClick={() => select(option.value)}
                type="button"
              >
                <span>
                  <OptionContent config={config} option={option} />
                </span>
                <span className="jt-filter-editor__check" data-visible={checked || undefined}>
                  <CheckIcon />
                </span>
              </button>
            );
          })
        )}
      </div>
      {selected.length > 0 ? (
        <FilterClearButton
          label={isMulti ? "Clear filters" : "Clear filter"}
          onClick={() => {
            onChange(undefined);
            if (!isMulti) onDone?.();
          }}
        />
      ) : null}
    </div>
  );
}

function TextFilterEditor({ config, onChange, value }: ColumnFilterEditorProps) {
  const [localValue, setLocalValue] = React.useState(typeof value === "string" ? value : "");
  const inputReference = React.useRef<HTMLInputElement>(null);
  const timerReference = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    inputReference.current?.focus();
  }, []);

  React.useEffect(() => {
    setLocalValue(typeof value === "string" ? value : "");
  }, [value]);

  React.useEffect(
    () => () => {
      if (timerReference.current) clearTimeout(timerReference.current);
    },
    [],
  );

  const update = (nextValue: string) => {
    setLocalValue(nextValue);
    if (timerReference.current) clearTimeout(timerReference.current);
    timerReference.current = setTimeout(() => onChange(nextValue || undefined), 250);
  };

  return (
    <div className="jt-filter-editor jt-filter-editor--text">
      <label className="jt-filter-editor__search">
        <SearchIcon />
        <span className="jt-sr-only">Filter value</span>
        <input
          onChange={(event) => update(event.target.value)}
          placeholder={config.placeholder ?? "Filter…"}
          ref={inputReference}
          type="search"
          value={localValue}
        />
      </label>
      {localValue ? (
        <button
          aria-label="Clear filter"
          className="jt-filter-editor__input-clear"
          onClick={() => {
            if (timerReference.current) clearTimeout(timerReference.current);
            setLocalValue("");
            onChange(undefined);
          }}
          type="button"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function BooleanFilterEditor({ onChange, onDone, value }: ColumnFilterEditorProps) {
  const selected = Array.isArray(value) ? value[0] : value;
  return (
    <div className="jt-filter-editor">
      <div className="jt-filter-editor__options">
        {[
          { label: "Yes", value: "true" },
          { label: "No", value: "false" },
        ].map((option) => {
          const checked = selected === option.value;
          return (
            <button
              className="jt-filter-editor__option"
              data-selected={checked || undefined}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                onDone?.();
              }}
              type="button"
            >
              <span>{option.label}</span>
              <span className="jt-filter-editor__check" data-visible={checked || undefined}>
                <CheckIcon />
              </span>
            </button>
          );
        })}
      </div>
      {selected !== undefined ? (
        <FilterClearButton
          label="Clear filter"
          onClick={() => {
            onChange(undefined);
            onDone?.();
          }}
        />
      ) : null}
    </div>
  );
}

function RangeFilterEditor({ config, onChange, value }: ColumnFilterEditorProps) {
  const values = Array.isArray(value) ? value : ["", ""];
  const labels = ["Minimum", "Maximum"];
  const update = (index: number, nextValue: string) => {
    const next = [values[0] ?? "", values[1] ?? ""];
    next[index] = nextValue;
    onChange(next.some(Boolean) ? next : undefined);
  };

  return (
    <div className="jt-filter-editor jt-filter-editor--range">
      <div className="jt-filter-editor__range-fields">
        {labels.map((label, index) => (
          <label key={label}>
            <span>{label}</span>
            <input
              max={config.max}
              min={config.min}
              onChange={(event) => update(index, event.target.value)}
              step={config.step}
              type="number"
              value={values[index] ?? ""}
            />
          </label>
        ))}
      </div>
      {values.some(Boolean) ? (
        <FilterClearButton label="Clear range" onClick={() => onChange(undefined)} />
      ) : null}
    </div>
  );
}

function DateRangeFilterEditor({ onChange, onDone, value }: ColumnFilterEditorProps) {
  const values = Array.isArray(value) ? value : [value ?? "", ""];
  return (
    <DateRangePickerPanel
      {...(values[0] ? { from: values[0] } : {})}
      onChange={(next) =>
        onChange(next.from || next.to ? [next.from ?? "", next.to ?? ""] : undefined)
      }
      {...(onDone ? { onCommit: onDone } : {})}
      testId="date-filter"
      {...(values[1] ? { to: values[1] } : {})}
    />
  );
}

function ColumnFilterEditor(props: ColumnFilterEditorProps) {
  if (props.config.type === "text") return <TextFilterEditor {...props} />;
  if (props.config.type === "boolean") return <BooleanFilterEditor {...props} />;
  if (props.config.type === "date-range") return <DateRangeFilterEditor {...props} />;
  if (props.config.type === "number-range") return <RangeFilterEditor {...props} />;
  return <SelectFilterEditor {...props} />;
}

function stopHeaderActivation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function InlineFilter<TData extends RowData>({
  column,
  config,
  onOpenChange,
  open,
  popoverGroup,
}: InlineFilterProps<TData>) {
  const value = normalizeFilterValue(column.getFilterValue());
  const activeCount = getActiveCount(value, config);
  const close = () => onOpenChange(false);

  return (
    <details
      className="jt-column-filter"
      onClick={stopHeaderActivation}
      onKeyDown={stopHeaderActivation}
      name={popoverGroup}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      open={open}
    >
      <summary
        aria-label={`Filter ${column.id}`}
        className="jt-column-filter__trigger"
        data-active={activeCount > 0 || undefined}
      >
        <FilterIcon />
        {activeCount > 0 ? <span className="jt-filter-count">{activeCount}</span> : null}
      </summary>
      {open ? (
        <div
          className={`jt-filter__popover${config.type === "date-range" ? " jt-filter__popover--date" : ""}`}
        >
          <ColumnFilterEditor
            config={config}
            onChange={(nextValue) => column.setFilterValue(nextValue)}
            onDone={close}
            value={value}
          />
        </div>
      ) : null}
    </details>
  );
}

function getColumnLabel<TData extends RowData>(column: DataGridColumn<TData>): string {
  return typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;
}

export function DataGridFiltersMenu<TData extends RowData>({
  onOpenChange,
  open,
  popoverGroup,
  table,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  popoverGroup: string;
  table: DataGridInstance<TData>;
}) {
  const [activeColumnId, setActiveColumnId] = React.useState<string>();
  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.columnDef.meta?.filter !== undefined);
  if (columns.length === 0) return null;

  const filters = new Map<string, FilterValue>(
    table.state.columnFilters.map((filter) => [filter.id, normalizeFilterValue(filter.value)]),
  );
  const activeCount = columns.reduce((count, column) => {
    const config = column.columnDef.meta?.filter;
    return config ? count + getActiveCount(filters.get(column.id), config) : count;
  }, 0);
  const activeColumn = columns.find((column) => column.id === activeColumnId);
  const activeConfig = activeColumn?.columnDef.meta?.filter;

  return (
    <details
      className="jt-filters-menu"
      onToggle={(event) => {
        onOpenChange(event.currentTarget.open);
        if (!event.currentTarget.open) setActiveColumnId(undefined);
      }}
      name={popoverGroup}
      open={open}
    >
      <summary aria-label="Column filters" className="jt-filters-menu__trigger">
        <FilterIcon />
        <span>Filters</span>
        {activeCount > 0 ? <span className="jt-filter-count">{activeCount}</span> : null}
      </summary>
      {open ? (
        <div
          className={`jt-filter__popover jt-filters-menu__popover${activeConfig?.type === "date-range" ? " jt-filter__popover--date" : ""}`}
        >
          {activeColumn && activeConfig ? (
            <>
              <button
                className="jt-filters-menu__back"
                onClick={() => setActiveColumnId(undefined)}
                type="button"
              >
                <ChevronIcon direction="left" />
                {getColumnLabel(activeColumn)}
              </button>
              <div className="jt-filters-menu__separator" />
              <ColumnFilterEditor
                config={activeConfig}
                onChange={(nextValue) => activeColumn.setFilterValue(nextValue)}
                onDone={() => setActiveColumnId(undefined)}
                value={filters.get(activeColumn.id)}
              />
            </>
          ) : (
            <>
              <div className="jt-filters-menu__columns">
                {columns.map((column) => {
                  const config = column.columnDef.meta?.filter;
                  const count = config ? getActiveCount(filters.get(column.id), config) : 0;
                  return (
                    <button
                      className="jt-filters-menu__column"
                      key={column.id}
                      onClick={() => setActiveColumnId(column.id)}
                      type="button"
                    >
                      <span>{getColumnLabel(column)}</span>
                      <span className="jt-filters-menu__column-status">
                        {count > 0 ? `${count} active` : null}
                        <ChevronIcon />
                      </span>
                    </button>
                  );
                })}
              </div>
              {activeCount > 0 ? (
                <FilterClearButton
                  label="Clear all filters"
                  onClick={() => table.setColumnFilters([])}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </details>
  );
}
