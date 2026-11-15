import type { RowData } from "@tanstack/react-table";
import * as React from "react";
import type { DataGridCell } from "./features";
import type { DataGridApplyCellEdit, DataGridCellEdit } from "./types";

/**
 * A commit the grid is showing before the data prop confirms it.
 *
 * - `saving` — the handler is still running.
 * - `settled` — the handler resolved, but `data` has not come back yet. The
 *   value keeps applying until it does, so the cell never flashes the old
 *   value for a frame between the promise and the parent's re-render.
 * - `error` — the handler rejected. The value stops applying, so the row
 *   reverts, and the entry survives only to paint the failure.
 */
export interface PendingCellEdit {
  attempt: number;
  isUndo: boolean;
  columnId: string;
  /** The `data` array this edit was committed against. */
  committedAgainst: unknown;
  /** Set only once `status` is `error`. */
  message: string | undefined;
  rowId: string;
  status: "error" | "saving" | "settled";
  value: unknown;
}

/** The cell whose editor is open, and the character that opened it. */
export interface ActiveCellEditor {
  cellId: string;
  /** The printable character that started type-to-edit, when there was one. */
  seed: string | undefined;
}

const NO_PENDING_EDITS: ReadonlyMap<string, PendingCellEdit> = new Map();

function editErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "This change could not be saved.";
}

export function isSameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return left.length === right.length && left.every((item, index) => Object.is(item, right[index]));
}

/**
 * Writes a value at a column ID, which TanStack also accepts as a dotted path
 * into a nested accessor. Every object along the path is copied, so the patched
 * row shares nothing mutable with the row the caller passed in.
 */
function setValueAtPath<TData>(row: TData, path: string, value: unknown): TData {
  const separator = path.indexOf(".");
  const source = row as Record<string, unknown>;
  if (separator === -1) return { ...source, [path]: value } as TData;

  const head = path.slice(0, separator);
  const nested = source[head];
  return {
    ...source,
    [head]: setValueAtPath(
      (typeof nested === "object" && nested !== null ? nested : {}) as Record<string, unknown>,
      path.slice(separator + 1),
      value,
    ),
  } as TData;
}

/**
 * Applies one row's optimistic values.
 *
 * The overlay is applied to the data the table is built from rather than at
 * render time, so custom `cell` renderers, sorting, and filtering all agree
 * with what the cell shows. A failed edit keeps its entry — the cell still owes
 * the reader an error — but contributes no value, so the row reverts.
 */
export function applyPendingEdits<TData extends RowData>(
  row: TData,
  edits: readonly PendingCellEdit[] | undefined,
  applyCellEdit: DataGridApplyCellEdit<TData>,
): TData {
  if (!edits) return row;
  let next = row;
  for (const edit of edits) {
    if (edit.status === "error") continue;
    next = applyCellEdit(next, edit.columnId, edit.value);
  }
  return next;
}

/**
 * The default patch: write the value at the column ID.
 *
 * Correct for `accessorKey` columns, including dotted paths. A column with a
 * custom `accessorFn` has no property to write, so those need the grid's
 * `applyCellEdit` prop.
 */
export function defaultApplyCellEdit<TData extends RowData>(
  row: TData,
  columnId: string,
  value: unknown,
): TData {
  return setValueAtPath(row, columnId, value);
}

interface CellEditingOptions<TData extends RowData> {
  data: readonly TData[];
  onCellEdit: ((edit: DataGridCellEdit<TData>) => void | Promise<void>) | undefined;
}

export interface CellEditingController<TData extends RowData> {
  cancel: () => void;
  discard: (cellId: string) => void;
  invalid: React.RefObject<boolean>;
  setInvalid: (invalid: boolean) => void;
  undoEdit: DataGridCellEdit<TData> | undefined;
  undo: (cell: DataGridCell<TData>) => void;
  commit: (cell: DataGridCell<TData>, value: unknown, isUndo?: boolean) => void;
  editor: ActiveCellEditor | undefined;
  /** Pending edits grouped by row ID, or `undefined` when there are none. */
  editsByRow: ReadonlyMap<string, PendingCellEdit[]> | undefined;
  open: (cellId: string, seed?: string) => void;
  pending: ReadonlyMap<string, PendingCellEdit>;
}

export function useCellEditing<TData extends RowData>({
  data,
  onCellEdit,
}: CellEditingOptions<TData>): CellEditingController<TData> {
  const [pending, setPending] = React.useState(NO_PENDING_EDITS);
  const [editor, setEditor] = React.useState<ActiveCellEditor>();
  const invalid = React.useRef(false);
  const setInvalid = React.useCallback((value: boolean) => {
    invalid.current = value;
  }, []);
  const attempts = React.useRef(new Map<string, number>());
  const sequence = React.useRef(0);
  const [undoEdit, setUndoEdit] = React.useState<DataGridCellEdit<TData>>();

  const editsByRow = React.useMemo(() => {
    if (pending.size === 0) return undefined;
    const grouped = new Map<string, PendingCellEdit[]>();
    for (const edit of pending.values()) {
      const existing = grouped.get(edit.rowId);
      if (existing) existing.push(edit);
      else grouped.set(edit.rowId, [edit]);
    }
    return grouped;
  }, [pending]);

  const clear = React.useCallback((cellId: string) => {
    setPending((current) => {
      if (!current.has(cellId)) return current;
      const next = new Map(current);
      next.delete(cellId);
      return next;
    });
  }, []);

  const mark = React.useCallback((cellId: string, edit: PendingCellEdit) => {
    setPending((current) => new Map(current).set(cellId, edit));
  }, []);

  const open = React.useCallback((cellId: string, seed?: string) => {
    if (invalid.current) return;
    setEditor({ cellId, seed });
  }, []);

  const cancel = React.useCallback(() => {
    invalid.current = false;
    setEditor(undefined);
  }, []);

  // A settled edit keeps applying until the parent's `data` comes back, so the
  // cell never flashes the old value between the promise resolving and the
  // re-render that carries the saved one.
  const latestData = React.useRef<unknown>(data);
  React.useEffect(() => {
    if (latestData.current === data) return;
    latestData.current = data;
    setPending((current) => {
      if (current.size === 0) return current;
      const next = new Map(current);
      for (const [cellId, edit] of current) {
        if (edit.status === "settled" && edit.committedAgainst !== data) next.delete(cellId);
      }
      return next.size === current.size ? current : next;
    });
  }, [data]);

  const commit = React.useCallback(
    (cell: DataGridCell<TData>, value: unknown, isUndo = false) => {
      invalid.current = false;
      setEditor(undefined);
      const cellId = cell.id;
      const previousValue = cell.getValue();
      if (!onCellEdit || isSameValue(previousValue, value)) {
        clear(cellId);
        return;
      }
      const attempt = ++sequence.current;
      attempts.current.set(cellId, attempt);
      setUndoEdit(undefined);
      const edit: DataGridCellEdit<TData> = {
        columnId: cell.column.id,
        previousValue,
        row: cell.row.original,
        rowId: cell.row.id,
        value,
      };
      const entry: PendingCellEdit = {
        attempt,
        isUndo,
        columnId: edit.columnId,
        committedAgainst: latestData.current,
        message: undefined,
        rowId: edit.rowId,
        status: "saving",
        value,
      };
      mark(cellId, entry);
      const isCurrent = () => attempts.current.get(cellId) === attempt;
      const fail = (error: unknown) => {
        if (isCurrent()) {
          attempts.current.delete(cellId);
          mark(cellId, { ...entry, message: editErrorMessage(error), status: "error" });
        }
      };
      const succeed = (async: boolean) => {
        if (!isCurrent()) return;
        attempts.current.delete(cellId);
        if (!isUndo && sequence.current === attempt) setUndoEdit(edit);
        if (!async || latestData.current !== entry.committedAgainst) clear(cellId);
        else mark(cellId, { ...entry, status: "settled" });
      };
      try {
        const result = onCellEdit(edit);
        if (result && typeof result.then === "function")
          void result.then(() => succeed(true), fail);
        else succeed(false);
      } catch (error) {
        fail(error);
      }
    },
    [clear, mark, onCellEdit],
  );

  const undo = (cell: DataGridCell<TData>) => {
    if (!undoEdit || !isSameValue(cell.getValue(), undoEdit.value)) return;
    commit(cell, undoEdit.previousValue, true);
    setUndoEdit(undefined);
  };

  const discard = (cellId: string) => {
    attempts.current.delete(cellId);
    clear(cellId);
    cancel();
  };

  return {
    cancel,
    commit,
    discard,
    editor,
    editsByRow,
    invalid,
    open,
    pending,
    setInvalid,
    undo,
    undoEdit,
  };
}
