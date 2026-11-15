import * as React from "react";
import { CellEditorPopover } from "./cell-editor-layer";
import { DatePickerPanel } from "./date-range-picker";
import { scoreOptionMatch } from "./filtering";
import { CheckIcon, ChevronIcon, CloseIcon } from "./icons";
import type { DataGridColumnEditorConfig, DataGridColumnMeta, DataGridOption } from "./types";
import { formatNumberValue, maskNumberText, parseNumberText, renderColumnOption } from "./utils";

/** Where focus goes once a commit lands. */
export type CellEditorMove = "down" | "left" | "none" | "right";

export interface CellEditorProps {
  config: DataGridColumnEditorConfig;
  /** The column's label, so the control has an accessible name. */
  label: string;
  layer: HTMLElement | null;
  /** The whole column meta, so the editor draws values the way the column does. */
  meta: DataGridColumnMeta | undefined;
  onCancel: () => void;
  onCommit: (value: unknown, move: CellEditorMove) => void;
  onValidationChange: (invalid: boolean) => void;
  options: readonly DataGridOption[];
  /** The printable character that opened the editor, when typing started it. */
  seed: string | undefined;
  value: unknown;
  viewport: HTMLElement | null;
}

/**
 * Resolves the cell a popup editor hangs from.
 *
 * The editor renders inside the cell, so it can find its own anchor rather
 * than have one threaded down through the grid's cell loop. State rather than
 * a ref: the popover positions in a layout effect and needs a render once the
 * host node exists.
 */
function useAnchorCell(): [HTMLElement | null, (node: HTMLElement | null) => void] {
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  return [host?.closest<HTMLElement>(".jt-grid__cell") ?? null, setHost];
}

function toText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function toSelectedValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return value === null || value === undefined || value === "" ? [] : [String(value)];
}

/** Keep validation local while letting the grid protect an unfinished draft. */
function useValidation(onValidationChange: CellEditorProps["onValidationChange"]) {
  const [error, setError] = React.useState<string>();
  const id = React.useId();
  const report = (message: string | undefined) => {
    setError(message);
    onValidationChange(message !== undefined);
    return message === undefined;
  };
  return { error, id, report };
}

function EditorFeedback({ error, id }: { error: string | undefined; id: string }) {
  if (!error) return null;
  return (
    <div className="jt-editor-feedback">
      <p id={id} role="alert" data-error>
        {error}
      </p>
    </div>
  );
}

function staysInEditor(event: React.FocusEvent, anchor: HTMLElement | null): boolean {
  const next = event.relatedTarget;
  if (!(next instanceof Element)) return false;
  return (
    Boolean(anchor?.contains(next)) ||
    next.closest<HTMLElement>("[data-editor-owner]")?.dataset.editorOwner === anchor?.dataset.cellId
  );
}

/** Moves that a plain text-like editor shares. Returns `true` when handled. */
function handleTextKey(
  event: React.KeyboardEvent,
  commit: (move: CellEditorMove) => void,
  onCancel: () => void,
): boolean {
  if (event.key === "Escape") {
    onCancel();
    return true;
  }
  if (event.key === "Enter") {
    commit("down");
    return true;
  }
  if (event.key === "Tab") {
    commit(event.shiftKey ? "left" : "right");
    return true;
  }
  if (event.key === "F2") {
    commit("none");
    return true;
  }
  return false;
}

/**
 * A number that keeps the column's own notation while it is edited.
 *
 * A bare `<input type="number">` throws away the currency symbol, the grouping,
 * and the alignment the moment a cell is opened, so the value visibly changes
 * shape just for being looked at. This field shows exactly what the cell showed
 * and keeps masking as it is typed.
 */
function NumberCellEditor({
  config,
  label,
  meta,
  layer,
  viewport,
  onCancel,
  onCommit,
  onValidationChange,
  seed,
  value,
}: CellEditorProps) {
  const validation = useValidation(onValidationChange);
  const [anchor, setHost] = useAnchorCell();
  const format = meta?.numberFormat;
  const reference = React.useRef<HTMLInputElement>(null);
  const committed = React.useRef(false);
  const [draft, setDraft] = React.useState(() => {
    if (seed !== undefined) return format ? maskNumberText(format, seed) : seed;
    return format ? formatNumberValue(format, value) : toText(value);
  });

  React.useEffect(() => {
    const input = reference.current;
    if (!input) return;
    input.focus();
    // The caret goes to the far right, where a number is amended from.
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  const commit = (move: CellEditorMove) => {
    if (committed.current) return;
    const text = draft.trim();
    if (text === "") {
      if (config.required) {
        validation.report(`${label} is required.`);
        return;
      }
      committed.current = true;
      if (!validation.report(config.validate?.(undefined))) {
        committed.current = false;
        return;
      }
      onCommit(undefined, move);
      return;
    }
    const numeric = format ? parseNumberText(format, text) : Number(text);
    if (numeric === undefined || !Number.isFinite(numeric)) {
      validation.report(`Enter a valid number for ${label}.`);
      return;
    }
    if (
      (config.min !== undefined && numeric < config.min) ||
      (config.max !== undefined && numeric > config.max)
    ) {
      validation.report(
        config.min !== undefined && numeric < config.min
          ? `${label} must be ${config.min} or greater.`
          : `${label} must be ${config.max} or less.`,
      );
      return;
    }
    if (!validation.report(config.validate?.(numeric))) return;
    committed.current = true;
    onCommit(numeric, move);
  };

  return (
    <span className="jt-cell-editor" ref={setHost}>
      <input
        aria-describedby={validation.error ? validation.id : undefined}
        aria-invalid={Boolean(validation.error)}
        aria-label={label}
        autoComplete="off"
        className="jt-cell-input"
        inputMode="decimal"
        onBlur={(event) => {
          if (!staysInEditor(event, anchor)) commit("none");
        }}
        onChange={(event) => {
          validation.report(undefined);
          setDraft(format ? maskNumberText(format, event.target.value) : event.target.value);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (handleTextKey(event, commit, onCancel)) event.preventDefault();
        }}
        placeholder={config.placeholder}
        ref={reference}
        // Deliberately not `type="number"`: its spinner and its own idea of what
        // a number looks like both fight the column's.
        type="text"
        value={draft}
      />
      {validation.error ? (
        <CellEditorPopover
          anchor={anchor}
          layer={layer}
          viewport={viewport}
          onCancel={onCancel}
          onLeave={() => commit("none")}
        >
          <EditorFeedback error={validation.error} id={validation.id} />
        </CellEditorPopover>
      ) : null}
    </span>
  );
}

function TextCellEditor({
  config,
  label,
  layer,
  viewport,
  onCancel,
  onCommit,
  onValidationChange,
  seed,
  value,
}: CellEditorProps) {
  const validation = useValidation(onValidationChange);
  const [anchor, setHost] = useAnchorCell();
  const [draft, setDraft] = React.useState(() => seed ?? toText(value));
  const reference = React.useRef<HTMLInputElement>(null);
  const committed = React.useRef(false);

  React.useEffect(() => {
    const input = reference.current;
    if (!input) return;
    input.focus();
    // Opening with Enter or F2 offers the whole value for replacement; opening
    // by typing has already replaced it, so the caret goes to the end.
    if (seed === undefined) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }, [seed]);

  const commit = (move: CellEditorMove) => {
    if (committed.current) return;
    const trimmed = draft.trim();
    if (config.required && trimmed === "") {
      validation.report(`${label} is required.`);
      return;
    }
    const next = trimmed === "" ? undefined : draft;
    if (!validation.report(config.validate?.(next))) return;
    committed.current = true;
    onCommit(next, move);
  };

  return (
    <span className="jt-cell-editor" ref={setHost}>
      <input
        aria-describedby={validation.error ? validation.id : undefined}
        aria-invalid={Boolean(validation.error)}
        aria-label={label}
        className="jt-cell-input"
        onBlur={(event) => {
          if (!staysInEditor(event, anchor)) commit("none");
        }}
        onChange={(event) => {
          validation.report(undefined);
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (handleTextKey(event, commit, onCancel)) event.preventDefault();
        }}
        placeholder={config.placeholder}
        ref={reference}
        type="text"
        value={draft}
      />
      {validation.error ? (
        <CellEditorPopover
          anchor={anchor}
          layer={layer}
          viewport={viewport}
          onCancel={onCancel}
          onLeave={() => commit("none")}
        >
          <EditorFeedback error={validation.error} id={validation.id} />
        </CellEditorPopover>
      ) : null}
    </span>
  );
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(text: string): boolean {
  if (!ISO_DATE_PATTERN.test(text)) return false;
  const date = new Date(`${text}T00:00:00`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(text.slice(0, 4)) &&
    date.getMonth() + 1 === Number(text.slice(5, 7)) &&
    date.getDate() === Number(text.slice(8, 10))
  );
}

/**
 * A date cell, edited without the browser's own date control.
 *
 * `<input type="date">` is the obvious choice and the wrong one here: it opens
 * the platform's calendar alongside the grid's, so two pickers answer one
 * click, and it renders in the browser's locale, so the text jumps format the
 * moment the cell goes from reading to editing. A text field holding exactly
 * the string the cell was showing keeps one picker and one format.
 */
function DateCellEditor({
  config,
  label,
  layer,
  meta,
  onCancel,
  onCommit,
  onValidationChange,
  seed,
  value,
  viewport,
}: CellEditorProps) {
  const validation = useValidation(onValidationChange);
  const reference = React.useRef<HTMLInputElement>(null);
  const committed = React.useRef(false);
  const [anchor, setHost] = useAnchorCell();
  const text = toText(value).slice(0, 10);
  // A column that draws its own dates keeps drawing them: the editor shows the
  // node the cell just showed, with the caret after it, exactly like a select.
  const drawsValue = meta?.renderValue !== undefined;
  const [held, setHeld] = React.useState(drawsValue && text ? text : undefined);
  const [draft, setDraft] = React.useState(() => seed ?? (drawsValue ? "" : text));
  const heldNode = held !== undefined && draft === "" ? meta?.renderValue?.(held) : undefined;
  const calendarValue = draft.trim() || held;

  React.useEffect(() => {
    const input = reference.current;
    if (!input) return;
    input.focus();
    if (seed === undefined) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }, [seed]);

  const commit = (move: CellEditorMove) => {
    if (committed.current) return;
    const typed = draft.trim();
    const next = typed === "" ? held : typed;
    // Half-typed dates are refused rather than saved: an unparseable value
    // would round-trip to the server as a real edit.
    if (next !== undefined && !isIsoDate(next)) {
      validation.report("Use a valid date in YYYY-MM-DD format.");
      return;
    }
    if (config.required && !next) {
      validation.report(`${label} is required.`);
      return;
    }
    if (!validation.report(config.validate?.(next))) return;
    committed.current = true;
    onCommit(next, move);
  };

  return (
    <span className="jt-cell-editor" ref={setHost}>
      <span className="jt-cell-combobox">
        {heldNode === undefined ? null : (
          <span className="jt-cell-combobox__value">{heldNode}</span>
        )}
        <input
          aria-describedby={validation.error ? validation.id : undefined}
          aria-invalid={Boolean(validation.error)}
          aria-label={label}
          autoComplete="off"
          className="jt-cell-combobox__input"
          onBlur={(event) => {
            if (!staysInEditor(event, anchor)) commit("none");
          }}
          onChange={(event) => {
            validation.report(undefined);
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (
              (event.key === "Backspace" || event.key === "Delete") &&
              draft === "" &&
              held !== undefined
            ) {
              event.preventDefault();
              setHeld(undefined);
              return;
            }
            if (event.altKey && event.key === "ArrowDown") {
              event.preventDefault();
              layer?.querySelector<HTMLElement>("select, .rdp-day_button")?.focus();
              return;
            }
            if (handleTextKey(event, commit, onCancel)) event.preventDefault();
          }}
          placeholder={heldNode === undefined ? (config.placeholder ?? "yyyy-mm-dd") : ""}
          ref={reference}
          type="text"
          value={draft}
        />
      </span>
      <CellEditorPopover
        anchor={anchor}
        layer={layer}
        viewport={viewport}
        onCancel={onCancel}
        onLeave={() => commit("none")}
      >
        <EditorFeedback error={validation.error} id={validation.id} />
        <DatePickerPanel
          onChange={(next) => {
            if (committed.current) return;
            if (config.required && !next) {
              validation.report(`${label} is required.`);
              return;
            }
            if (!validation.report(config.validate?.(next))) return;
            committed.current = true;
            onCommit(next, "none");
          }}
          {...(calendarValue && isIsoDate(calendarValue) ? { value: calendarValue } : {})}
        />
      </CellEditorPopover>
    </span>
  );
}

function SelectCellEditor({
  config,
  label,
  layer,
  meta,
  onCancel,
  onCommit,
  onValidationChange,
  options,
  seed,
  value,
  viewport,
}: CellEditorProps) {
  const validation = useValidation(onValidationChange);
  const multiple = config.type === "multi-select";
  const [selected, setSelected] = React.useState(() => toSelectedValues(value));
  const [query, setQuery] = React.useState(seed ?? "");
  // Opening a single-select expands the list *at* its current value, so Enter
  // straight after Enter is a no-op rather than a silent jump to the first
  // option. An empty query leaves `matches` in declared order, so the option
  // index and the declared index are the same one.
  const [activeIndex, setActiveIndex] = React.useState(() => {
    if (multiple || seed !== undefined) return 0;
    const current = toSelectedValues(value)[0];
    return Math.max(
      0,
      options.findIndex((option) => option.value === current),
    );
  });
  const listboxId = React.useId();
  const optionId = React.useId();
  const reference = React.useRef<HTMLInputElement>(null);
  const committed = React.useRef(false);
  const [anchor, setHost] = useAnchorCell();

  React.useEffect(() => reference.current?.focus(), []);

  const matches = React.useMemo(() => {
    const scored: { option: DataGridOption; score: number }[] = [];
    for (const option of options) {
      const score = scoreOptionMatch(option.label, query);
      if (score !== undefined) scored.push({ option, score });
    }
    // A stable sort keeps the author's declared order inside each score band.
    return scored.sort((left, right) => right.score - left.score).map((entry) => entry.option);
  }, [options, query]);

  const active = matches[Math.min(activeIndex, matches.length - 1)];
  const labelByValue = React.useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options],
  );
  const asOption = React.useCallback(
    (item: string): DataGridOption => ({ label: labelByValue.get(item) ?? item, value: item }),
    [labelByValue],
  );
  // When the column draws its own values, the chip is a wrapper and nothing
  // more: a pill inside a pill is the column's design shown twice.
  const drawsValue = config.renderOption !== undefined || meta?.renderValue !== undefined;
  const currentValue = multiple ? undefined : selected[0];
  // A single-select keeps showing its value until something is typed over it,
  // drawn the way the cell drew it a moment ago.
  const currentNode =
    currentValue === undefined || query !== ""
      ? undefined
      : renderColumnOption(meta, asOption(currentValue), config.renderOption);

  const commit = (next: readonly string[], move: CellEditorMove) => {
    if (committed.current) return;
    if (config.required && next.length === 0) {
      validation.report(`${label} is required.`);
      return;
    }
    const value = multiple ? [...next] : (next[0] ?? undefined);
    if (!validation.report(config.validate?.(value))) return;
    committed.current = true;
    onCommit(value, move);
  };

  const choose = (optionValue: string) => {
    validation.report(undefined);
    if (!multiple) {
      commit([optionValue], "down");
      return;
    }
    setSelected((current) =>
      current.includes(optionValue)
        ? current.filter((item) => item !== optionValue)
        : [...current, optionValue],
    );
    setQuery("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (matches.length === 0) return;
      setActiveIndex((current) => {
        const next = Math.min(current, matches.length - 1) + (event.key === "ArrowDown" ? 1 : -1);
        return (next + matches.length) % matches.length;
      });
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (multiple && (event.ctrlKey || event.metaKey)) commit(selected, "down");
      else if (active) choose(active.value);
      else if (config.allowCustomValue && query.trim()) choose(query.trim());
      else if (multiple) commit(selected, "down");
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      commit(selected, event.shiftKey ? "left" : "right");
      return;
    }
    // The caret sits after the value the cell already holds, so Backspace on an
    // empty query does what it does anywhere else: it deletes what is behind
    // the caret. For a multi-select that is the last chip; for a single-select
    // it is the whole value, which leaves the list open to pick a replacement.
    if (
      (event.key === "Backspace" || event.key === "Delete") &&
      query === "" &&
      selected.length > 0
    ) {
      event.preventDefault();
      setSelected((current) => current.slice(0, -1));
    }
  };

  const searchInput = (
    <input
      aria-activedescendant={active ? `${optionId}-${active.value}` : undefined}
      aria-autocomplete="list"
      aria-describedby={validation.error ? validation.id : undefined}
      aria-invalid={Boolean(validation.error)}
      aria-controls={listboxId}
      aria-expanded
      aria-label={label}
      className="jt-cell-combobox__input"
      onBlur={(event) => {
        if (!staysInEditor(event, anchor)) commit(selected, "none");
      }}
      onChange={(event) => {
        validation.report(undefined);
        setQuery(event.target.value);
        setActiveIndex(0);
      }}
      onKeyDown={handleKeyDown}
      // The cell keeps reading as itself while the list is open: the value
      // it already holds stays visible until something is typed over it.
      placeholder={!multiple && currentNode !== undefined ? "" : (config.placeholder ?? "Search…")}
      ref={reference}
      role="combobox"
      type="text"
      value={query}
    />
  );

  return (
    <span className="jt-cell-editor" ref={setHost}>
      <div className="jt-cell-combobox" data-chevron={!multiple}>
        {currentNode === undefined ? null : (
          <span className="jt-cell-combobox__value">{currentNode}</span>
        )}
        {multiple
          ? selected.slice(0, 1).map((item) => (
              <span className="jt-chip" data-drawn={drawsValue || undefined} key={item}>
                {renderColumnOption(meta, asOption(item), config.renderOption)}
                <button
                  aria-label={`Remove ${labelByValue.get(item) ?? item}`}
                  className="jt-chip__remove"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    validation.report(undefined);
                    setSelected((current) => current.filter((so) => so !== item));
                  }}
                  tabIndex={-1}
                  type="button"
                >
                  {/* A hairline cross disappears at this size; the heavier
                      stroke keeps it legible against the chip. */}
                  <CloseIcon height={10} strokeWidth={2.5} width={10} />
                </button>
              </span>
            ))
          : null}
        {multiple && selected.length > 1 ? (
          <span className="jt-cell-more">+{selected.length - 1}</span>
        ) : null}
        {multiple && selected.length === 0 ? (
          <span className="jt-cell-placeholder">Select…</span>
        ) : null}
        {multiple ? null : searchInput}
        {multiple ? null : (
          <ChevronIcon className="jt-cell-chevron" direction="up" height={14} width={14} />
        )}
      </div>
      <CellEditorPopover
        anchor={anchor}
        layer={layer}
        viewport={viewport}
        onCancel={onCancel}
        onLeave={() => commit(selected, "none")}
      >
        {multiple ? <div className="jt-editor-search">{searchInput}</div> : null}
        {matches.length === 0 ? <p className="jt-option-list__empty">No options found</p> : null}
        {
          <div
            aria-label={label}
            aria-multiselectable={multiple}
            className="jt-option-list"
            id={listboxId}
            role="listbox"
          >
            {matches.map((option, index) => {
              const checked = selected.includes(option.value);
              return (
                // biome-ignore lint/a11y/useFocusableInteractive: focus stays on the combobox input; the active option is announced through aria-activedescendant
                // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input owns every key; an option is a pointer target only
                <div
                  aria-selected={checked}
                  className="jt-option-list__option"
                  data-active={option === active || undefined}
                  data-selected={checked || undefined}
                  id={`${optionId}-${option.value}`}
                  key={option.value}
                  onClick={() => choose(option.value)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                >
                  <span>{renderColumnOption(meta, option, config.renderOption)}</span>
                  <span className="jt-option-list__check" data-visible={checked || undefined}>
                    <CheckIcon height={15} width={15} />
                  </span>
                </div>
              );
            })}
          </div>
        }
        {multiple ? (
          <div className="jt-editor-actions">
            <EditorFeedback error={validation.error} id={validation.id} />
            <button
              className="jt-editor-button jt-editor-button--primary"
              onClick={() => commit(selected, "none")}
              type="button"
            >
              Done
            </button>
          </div>
        ) : (
          <EditorFeedback error={validation.error} id={validation.id} />
        )}
      </CellEditorPopover>
    </span>
  );
}

/**
 * Picks the control for a column's editor type.
 *
 * The `if` chain mirrors `ColumnFilterEditor`, and the boolean type is absent
 * on purpose: a boolean cell renders a live switch rather than entering an
 * edit mode, so it never reaches here.
 */
export function CellEditor(props: CellEditorProps) {
  if (props.config.type === "single-select" || props.config.type === "multi-select") {
    return <SelectCellEditor {...props} />;
  }
  if (props.config.type === "date") return <DateCellEditor {...props} />;
  if (props.config.type === "number") return <NumberCellEditor {...props} />;
  return <TextCellEditor {...props} />;
}
