"use client";

import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
} from "date-fns";
import * as React from "react";
import { DayPicker, type DateRange as DayPickerRange } from "react-day-picker";

export interface DateRangeValue {
  from?: string;
  to?: string;
}

export interface DateRangePickerPanelProps extends DateRangeValue {
  onChange: (next: DateRangeValue) => void;
  onCommit?: () => void;
  testId?: string;
}

export interface DateRangePickerProps extends DateRangePickerPanelProps {
  placeholder?: string;
}

interface DateRangePreset {
  key: string;
  label: string;
  resolve: (now: Date) => { from: Date; to: Date };
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
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

function ChevronIcon({ orientation }: { orientation: "left" | "right" }) {
  const path = orientation === "left" ? "m14 18-6-6 6-6" : "m10 6 6 6-6 6";
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d={path}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function isoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatRange(from?: Date, to?: Date): string | null {
  if (from && to) {
    if (isoDate(from) === isoDate(to)) return format(from, "MMM d, yyyy");
    return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
  }
  if (from) return `From ${format(from, "MMM d, yyyy")}`;
  if (to) return `Until ${format(to, "MMM d, yyyy")}`;
  return null;
}

function buildPresets(now: Date): DateRangePreset[] {
  const presets: DateRangePreset[] = [
    { key: "today", label: "Today", resolve: () => ({ from: now, to: now }) },
    {
      key: "yesterday",
      label: "Yesterday",
      resolve: () => {
        const yesterday = subDays(now, 1);
        return { from: yesterday, to: yesterday };
      },
    },
    {
      key: "last7",
      label: "Last 7 days",
      resolve: () => ({ from: subDays(now, 6), to: now }),
    },
    {
      key: "last14",
      label: "Last 14 days",
      resolve: () => ({ from: subDays(now, 13), to: now }),
    },
    {
      key: "this-week",
      label: "This week",
      resolve: () => ({
        from: startOfWeek(now, { weekStartsOn: 0 }),
        to: endOfWeek(now, { weekStartsOn: 0 }),
      }),
    },
    {
      key: "this-month",
      label: "This month",
      resolve: () => ({ from: startOfMonth(now), to: endOfMonth(now) }),
    },
    {
      key: "last-month",
      label: "Last month",
      resolve: () => {
        const lastMonth = subMonths(now, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      },
    },
    {
      key: "this-quarter",
      label: "This quarter",
      resolve: () => ({ from: startOfQuarter(now), to: endOfQuarter(now) }),
    },
    {
      key: "last-quarter",
      label: "Last quarter",
      resolve: () => {
        const lastQuarter = subQuarters(now, 1);
        return { from: startOfQuarter(lastQuarter), to: endOfQuarter(lastQuarter) };
      },
    },
    {
      key: "ytd",
      label: "Year to date",
      resolve: () => ({ from: startOfYear(now), to: now }),
    },
  ];

  const currentYear = now.getFullYear();
  for (let index = 0; index < 5; index += 1) {
    const year = currentYear - index;
    const anchor = new Date(year, 0, 1);
    presets.push({
      key: `year-${year}`,
      label: String(year),
      resolve: () => ({ from: startOfYear(anchor), to: endOfYear(anchor) }),
    });
  }
  return presets;
}

function getActivePreset(
  presets: readonly DateRangePreset[],
  now: Date,
  range: DayPickerRange | undefined,
): string | undefined {
  if (!range?.from || !range.to) return undefined;
  const from = isoDate(range.from);
  const to = isoDate(range.to);
  return presets.find((preset) => {
    const resolved = preset.resolve(now);
    return isoDate(resolved.from) === from && isoDate(resolved.to) === to;
  })?.key;
}

export function DateRangePickerPanel({
  from,
  onChange,
  onCommit,
  testId = "date-range-picker",
  to,
}: DateRangePickerPanelProps) {
  const now = React.useMemo(() => new Date(), []);
  const presets = React.useMemo(() => buildPresets(now), [now]);
  const fromDate = React.useMemo(() => parseDate(from), [from]);
  const toDate = React.useMemo(() => parseDate(to), [to]);
  const initialMonth = fromDate ?? toDate ?? now;
  const [draft, setDraft] = React.useState<DayPickerRange | undefined>(() =>
    fromDate || toDate ? { from: fromDate, to: toDate } : undefined,
  );
  const [visibleMonth, setVisibleMonth] = React.useState(() => startOfMonth(initialMonth));

  React.useEffect(() => {
    setDraft(fromDate || toDate ? { from: fromDate, to: toDate } : undefined);
    if (fromDate || toDate) {
      setVisibleMonth(startOfMonth(fromDate ?? toDate ?? now));
    }
  }, [fromDate, now, toDate]);

  const commit = React.useCallback(
    (next: DayPickerRange | undefined) => {
      const value: DateRangeValue = {};
      if (next?.from) value.from = isoDate(next.from);
      if (next?.to) value.to = isoDate(next.to);
      onChange(value);
    },
    [onChange],
  );
  const activePreset = getActivePreset(presets, now, draft);

  return (
    <fieldset
      aria-label="Choose date range"
      className="jt-date-range-panel"
      data-testid={`${testId}-content`}
    >
      <div className="jt-date-range-panel__presets">
        {presets.map((preset) => {
          const active = activePreset === preset.key;
          return (
            <button
              className="jt-date-range-panel__preset"
              data-active={active || undefined}
              data-testid={`${testId}-preset-${preset.key}`}
              key={preset.key}
              onClick={() => {
                const next = preset.resolve(now);
                const range = { from: next.from, to: next.to };
                setDraft(range);
                setVisibleMonth(startOfMonth(next.from));
                commit(range);
                onCommit?.();
              }}
              type="button"
            >
              <span>{preset.label}</span>
              {active ? <CheckIcon /> : null}
            </button>
          );
        })}
      </div>
      <div className="jt-date-range-panel__main">
        <DayPicker
          className="jt-date-range-calendar"
          fixedWeeks
          mode="range"
          month={visibleMonth}
          numberOfMonths={2}
          onMonthChange={setVisibleMonth}
          onSelect={setDraft}
          selected={draft}
          showOutsideDays
          components={{
            Chevron: ({ orientation }) => (
              <ChevronIcon orientation={orientation === "left" ? "left" : "right"} />
            ),
          }}
        />
        <div className="jt-date-range-panel__footer">
          <span className="jt-date-range-panel__summary" data-testid={`${testId}-summary`}>
            {formatRange(draft?.from, draft?.to) ?? "No range selected"}
          </span>
          <div className="jt-date-range-panel__actions">
            <button
              className="jt-date-range-panel__button jt-date-range-panel__button--ghost"
              data-testid={`${testId}-clear-action`}
              onClick={() => {
                setDraft(undefined);
                commit(undefined);
                onCommit?.();
              }}
              type="button"
            >
              Clear
            </button>
            <button
              className="jt-date-range-panel__button"
              data-testid={`${testId}-apply`}
              disabled={!draft?.from && !draft?.to}
              onClick={() => {
                commit(draft);
                onCommit?.();
              }}
              type="button"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

export function DateRangePicker({
  from,
  onChange,
  placeholder = "Pick a date range",
  testId = "date-range-picker",
  to,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const rootReference = React.useRef<HTMLDivElement>(null);
  const fromDate = React.useMemo(() => parseDate(from), [from]);
  const toDate = React.useMemo(() => parseDate(to), [to]);
  const label = formatRange(fromDate, toDate);

  React.useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (!rootReference.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [open]);

  return (
    <div className="jt-date-range-picker" ref={rootReference}>
      <div className="jt-date-range-picker__control">
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          className="jt-date-range-picker__trigger"
          data-empty={!label || undefined}
          data-testid={`${testId}-trigger`}
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <CalendarIcon />
          <span>{label ?? placeholder}</span>
        </button>
        {label ? (
          <button
            aria-label="Clear date range"
            className="jt-date-range-picker__clear"
            data-testid={`${testId}-clear`}
            onClick={() => {
              onChange({});
              setOpen(false);
            }}
            type="button"
          >
            ×
          </button>
        ) : null}
      </div>
      {open ? (
        <div aria-label="Date range picker" className="jt-date-range-picker__popover" role="dialog">
          <DateRangePickerPanel
            {...(from ? { from } : {})}
            onChange={onChange}
            onCommit={() => setOpen(false)}
            testId={testId}
            {...(to ? { to } : {})}
          />
        </div>
      ) : null}
    </div>
  );
}
