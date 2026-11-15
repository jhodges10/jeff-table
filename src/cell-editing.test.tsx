import type { ColumnFiltersState } from "@tanstack/react-table";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { DataGrid } from "./data-grid";
import type { DataGridColumnDef } from "./features";
import { defined } from "./test/defined";
import type { DataGridCellEdit, DataGridCellStatus } from "./types";

interface Task {
  id: string;
  title: string;
  points: number;
  status: string;
  tags: string[];
  done: boolean;
  due: string;
}

const statusOptions = [
  { label: "Backlog", value: "backlog" },
  { label: "Building", value: "building" },
  { label: "Blocked", value: "blocked" },
];

const tagOptions = [
  { label: "Api", value: "api" },
  { label: "Docs", value: "docs" },
];

const tasks: Task[] = [
  {
    done: false,
    due: "2026-03-01",
    id: "t1",
    points: 3,
    status: "backlog",
    tags: ["api"],
    title: "Ship the grid",
  },
  {
    done: true,
    due: "2026-03-02",
    id: "t2",
    points: 5,
    status: "building",
    tags: [],
    title: "Write the docs",
  },
  {
    done: false,
    due: "2026-03-03",
    id: "t3",
    points: 8,
    status: "blocked",
    tags: ["docs"],
    title: "Cut a release",
  },
];

const editableColumns: DataGridColumnDef<Task>[] = [
  { accessorKey: "title", header: "Title", meta: { editor: { type: "text" } } },
  { accessorKey: "points", header: "Points", meta: { editor: { type: "number" } } },
  {
    accessorKey: "status",
    header: "Status",
    // No editor options: the select editor falls back to the filter's.
    meta: {
      editor: { type: "single-select" },
      filter: { options: statusOptions, type: "single-select" },
    },
  },
  {
    accessorKey: "tags",
    header: "Tags",
    meta: { editor: { options: tagOptions, type: "multi-select" } },
    cell: ({ getValue }) => (getValue() as string[]).join(", "),
  },
  { accessorKey: "done", header: "Done", meta: { editor: { type: "boolean" } } },
  { accessorKey: "due", header: "Due", meta: { editor: { type: "date" } } },
];

interface EditableGridProps {
  applyCellEdit?: (row: Task, columnId: string, value: unknown) => Task;
  columns?: DataGridColumnDef<Task>[];
  defaultColumnFilters?: ColumnFiltersState;
  enableColumnFiltering?: boolean;
  isCellEditable?: (context: { columnId: string; row: Task }) => boolean;
  onCellEdit?: (edit: DataGridCellEdit<Task>) => void | Promise<void>;
}

function EditableGrid({ columns = editableColumns, onCellEdit, ...rest }: EditableGridProps) {
  const [data, setData] = React.useState(tasks);
  return (
    <DataGrid
      columns={columns}
      data={data}
      enableInlineEditing
      getRowId={(task) => task.id}
      onCellEdit={(edit) => {
        const apply = () =>
          setData((current) =>
            current.map((task) =>
              task.id === edit.rowId ? { ...task, [edit.columnId]: edit.value } : task,
            ),
          );
        const result = onCellEdit?.(edit);
        if (result instanceof Promise) return result.then(apply);
        apply();
      }}
      totalCount={tasks.length}
      virtualize={false}
      {...rest}
    />
  );
}

function cellAt(rowId: string, columnId: string): HTMLElement {
  return defined(document.querySelector<HTMLElement>(`[data-cell-id="${rowId}_${columnId}"]`));
}

const viewport = () => defined(document.querySelector<HTMLElement>('[data-slot="viewport"]'));

/** Sort buttons come first in tab order, so tests enter the grid by pointer. */
/**
 * Focus a cell without editing it.
 *
 * A single click opens the editor, so getting to a cell that is focused but
 * closed means stepping back out of the editor the click opened — which is
 * also the only way a pointer user reaches that state.
 */
async function focusCell(
  user: ReturnType<typeof userEvent.setup>,
  rowId: string,
  columnId: string,
) {
  await user.click(cellAt(rowId, columnId));
  if (cellAt(rowId, columnId).dataset.editing === "true") await user.keyboard("{Escape}");
}

describe("DataGrid inline editing", () => {
  it("leaves the read-only cell contract untouched when editing is off", () => {
    render(<DataGrid columns={editableColumns} data={tasks} totalCount={3} virtualize={false} />);
    const cells = screen.getAllByRole("gridcell");

    expect(document.querySelectorAll("[data-cell-id]")).toHaveLength(0);
    expect(cells.every((cell) => !cell.hasAttribute("tabindex"))).toBe(true);
    expect(document.querySelector(".jt-grid__editor-layer")).toBeNull();
    expect(viewport()).toHaveAttribute("tabindex", "0");
  });

  it("moves the focused cell with the arrow keys and keeps exactly one tab stop", async () => {
    const user = userEvent.setup();
    render(<EditableGrid />);

    await focusCell(user, "t1", "title");
    expect(cellAt("t1", "title")).toHaveFocus();
    expect(viewport()).toHaveAttribute("tabindex", "-1");

    await user.keyboard("{ArrowDown}{ArrowRight}");
    expect(cellAt("t2", "points")).toHaveFocus();

    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(cellAt("t1", "title")).toHaveFocus();

    const tabbable = document.querySelectorAll('.jt-grid [tabindex="0"]');
    expect(tabbable).toHaveLength(1);

    // Arrows clamp at the edges rather than wrapping around.
    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(cellAt("t1", "title")).toHaveFocus();
  });

  it("jumps to the row and grid edges with Home and End", async () => {
    const user = userEvent.setup();
    render(<EditableGrid />);
    await focusCell(user, "t1", "title");

    await user.keyboard("{End}");
    expect(cellAt("t1", "due")).toHaveFocus();

    await user.keyboard("{Home}");
    expect(cellAt("t1", "title")).toHaveFocus();

    await user.keyboard("{Control>}{End}{/Control}");
    expect(cellAt("t3", "due")).toHaveFocus();
  });

  it("opens a text editor with Enter, cancels with Escape, and commits with Enter", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "title");

    await user.keyboard("{Enter}");
    const editor = within(cellAt("t1", "title")).getByRole("textbox", { name: "Title" });
    await user.keyboard("Renamed");
    await user.keyboard("{Escape}");

    expect(screen.getByText("Ship the grid")).toBeVisible();
    expect(onCellEdit).not.toHaveBeenCalled();
    expect(editor).not.toBeInTheDocument();
    expect(cellAt("t1", "title")).toHaveFocus();

    await user.keyboard("{Enter}Renamed{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: "title",
        previousValue: "Ship the grid",
        rowId: "t1",
        value: "Renamed",
      }),
    );
    expect(screen.getByText("Renamed")).toBeVisible();
    // Enter commits and steps down, the way a spreadsheet does.
    expect(cellAt("t2", "title")).toHaveFocus();
  });

  it("opens the editor seeded with the character that was typed", async () => {
    const user = userEvent.setup();
    render(<EditableGrid />);
    await focusCell(user, "t1", "title");

    await user.keyboard("Q");
    const editor = within(cellAt("t1", "title")).getByRole("textbox", { name: "Title" });
    expect(editor).toHaveValue("Q");
    expect(editor).toHaveFocus();
  });

  it("commits a number editor with Tab and steps to the next column", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "title");
    // Typing a digit opens the editor on that digit, replacing what was there.
    await user.keyboard("{ArrowRight}21{Tab}");

    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ value: 21 }));
    expect(cellAt("t1", "status")).toHaveFocus();
  });

  it("opens a number with the caret at the far right, so typing amends it", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "points");

    // t1 is 3. Enter puts the caret after it rather than selecting it.
    await user.keyboard("{Enter}1{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ value: 31 }));
  });

  it("keeps a currency cell's notation when it is edited", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    const columns: DataGridColumnDef<Task>[] = [
      {
        accessorKey: "points",
        header: "Cost",
        meta: {
          cellAlign: "right",
          editor: { type: "number" },
          numberFormat: { currency: "USD", locale: "en-US" },
        },
      },
    ];
    render(<EditableGrid columns={columns} onCellEdit={onCellEdit} />);

    const displayed = defined(cellAt("t1", "points").textContent);
    expect(displayed).toBe("$3.00");

    await focusCell(user, "t1", "points");
    await user.keyboard("{Enter}");
    const editor = defined(cellAt("t1", "points").querySelector<HTMLInputElement>("input"));

    // Same symbol, same separators, same string — and no spinner to nudge it.
    expect(editor.value).toBe(displayed);
    expect(editor).toHaveAttribute("type", "text");
    expect(editor).toHaveAttribute("inputmode", "decimal");
    expect(editor.selectionStart).toBe(displayed.length);
  });

  it("masks a currency as it is typed and commits the number behind it", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    const columns: DataGridColumnDef<Task>[] = [
      {
        accessorKey: "points",
        header: "Cost",
        meta: {
          editor: { type: "number" },
          numberFormat: { currency: "USD", locale: "en-US" },
        },
      },
    ];
    render(<EditableGrid columns={columns} onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "points");
    await user.keyboard("{Enter}");

    const editor = defined(cellAt("t1", "points").querySelector<HTMLInputElement>("input"));
    await user.clear(editor);
    await user.type(editor, "49000");
    expect(editor.value).toBe("$49,000");

    await user.keyboard("{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "points", value: 49_000 }),
    );
    expect(cellAt("t2", "points")).toHaveTextContent("$5.00");
  });

  it("refuses a number outside the editor's bounds", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    const columns: DataGridColumnDef<Task>[] = [
      {
        accessorKey: "points",
        header: "Points",
        meta: { editor: { max: 10, min: 0, type: "number" } },
      },
    ];
    render(<EditableGrid columns={columns} onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "points");
    await user.keyboard("99{Enter}");

    expect(onCellEdit).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Points" })).toHaveValue("99");
    expect(screen.getByRole("alert")).toHaveTextContent("Points must be 10 or less.");
  });

  it("clears a cell with Delete", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "title");
    await user.keyboard("{Delete}");

    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "title", value: undefined }),
    );
  });

  it("filters single-select options as you type and falls back to the filter options", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "title");
    await user.keyboard("{ArrowRight}{ArrowRight}{Enter}");

    const combobox = screen.getByRole("combobox", { name: "Status" });
    expect(screen.getAllByRole("option")).toHaveLength(3);

    // Matching stays fuzzy, the way the grid's own search is — "blo" is also a
    // subsequence of "Backlog" — so ranking, not exclusion, puts the obvious
    // answer first and under the Enter key.
    await user.type(combobox, "blo");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Blocked");
    expect(options.map((option) => option.textContent)).not.toContain("Building");

    await user.keyboard("{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "status", value: "blocked" }),
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("ranks a prefix match above a scattered one", async () => {
    const user = userEvent.setup();
    render(<EditableGrid />);
    await focusCell(user, "t1", "title");
    await user.keyboard("{ArrowRight}{ArrowRight}{Enter}");
    await user.type(screen.getByRole("combobox", { name: "Status" }), "b");

    // "Backlog", "Building" and "Blocked" all match; the prefix hits sort first
    // and the list stays in declared order inside each band.
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Backlog",
      "Building",
      "Blocked",
    ]);
  });

  it("toggles multi-select chips and commits an array", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "title");
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{Enter}");

    expect(defined(document.querySelector(".jt-chip"))).toHaveTextContent("Api");
    // Enter toggles and keeps the editor open, so several tags land in one pass.
    await user.keyboard("{ArrowDown}{Enter}");
    await user.keyboard("{Tab}");

    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "tags", value: ["api", "docs"] }),
    );
  });

  it("removes the last chip with Backspace on an empty query", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "title");
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{Enter}{Backspace}{Tab}");

    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "tags", value: [] }),
    );
  });

  it("opens the editor on a single click", async () => {
    const user = userEvent.setup();
    render(<EditableGrid />);
    await user.click(cellAt("t1", "title"));

    expect(cellAt("t1", "title")).toHaveAttribute("data-editing", "true");
    expect(within(cellAt("t1", "title")).getByRole("textbox")).toHaveFocus();
  });

  it("opens the editor from a click on the cell's padding, not just on the value", async () => {
    const user = userEvent.setup();
    render(<EditableGrid />);
    // The click lands on the cell itself rather than on the text inside it.
    await user.click(cellAt("t1", "status"));

    expect(screen.getByRole("listbox", { name: "Status" })).toBeInTheDocument();
  });

  it("leaves a click on a control inside the cell to that control", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    // The switch commits on its own change event. If the cell acted on the
    // same click too it would toggle straight back and commit twice.
    await user.click(within(cellAt("t1", "done")).getByRole("switch", { name: "Done" }));

    expect(onCellEdit).toHaveBeenCalledTimes(1);
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "done", value: true }),
    );
    expect(within(cellAt("t1", "done")).getByRole("switch")).toBeChecked();
  });

  it("does not reopen the editor when a click lands inside the one already open", async () => {
    const user = userEvent.setup();
    render(<EditableGrid />);
    await user.click(cellAt("t1", "title"));
    await user.keyboard("Rewritten");
    await user.click(cellAt("t1", "title"));

    // Reopening would seed a fresh draft and lose what was typed.
    expect(within(cellAt("t1", "title")).getByRole("textbox")).toHaveValue("Rewritten");
  });

  it("toggles a boolean with a switch, with no edit mode in between", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    const toggle = within(cellAt("t1", "done")).getByRole("switch", { name: "Done" });

    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "done", value: true }),
    );
    expect(within(cellAt("t1", "done")).getByRole("switch")).toBeChecked();

    // The cell is the tab stop; the switch never adds a second one per row.
    expect(toggle).toHaveAttribute("tabindex", "-1");
  });

  it("draws a boolean as a checkbox when the column asks for one", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    const columns = editableColumns.map((column) =>
      "accessorKey" in column && column.accessorKey === "done"
        ? {
            ...column,
            meta: { editor: { control: "checkbox" as const, type: "boolean" as const } },
          }
        : column,
    );
    render(<EditableGrid columns={columns} onCellEdit={onCellEdit} />);

    const box = within(cellAt("t1", "done")).getByRole("checkbox", { name: "Done" });
    expect(box).not.toBeChecked();
    // Same commit path as the switch, so the keyboard reaches it identically.
    await focusCell(user, "t1", "title");
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{Enter}");

    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "done", value: true }),
    );
    expect(within(cellAt("t1", "done")).getByRole("checkbox")).toBeChecked();
    expect(within(cellAt("t1", "done")).queryByRole("switch")).not.toBeInTheDocument();
  });

  it("toggles a boolean from the keyboard without opening an editor", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "title");
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{Enter}");

    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "done", value: true }),
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("edits a date in the format the cell was showing, with one calendar", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    const displayed = defined(cellAt("t1", "due").textContent);
    expect(displayed).toBe("2026-03-01");

    await focusCell(user, "t1", "due");
    await user.keyboard("{Enter}");

    const editor = defined(cellAt("t1", "due").querySelector<HTMLInputElement>("input"));
    // `type="date"` would open the platform calendar next to ours and re-render
    // the text in the browser's locale. Neither is acceptable.
    expect(editor).toHaveAttribute("type", "text");
    expect(editor.value).toBe(displayed);
    expect(document.querySelectorAll(".rdp-root")).toHaveLength(1);

    await user.clear(editor);
    await user.type(editor, "2026-12-25");
    // The field drafts while it is typed and commits on Enter.
    expect(onCellEdit).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "due", value: "2026-12-25" }),
    );
  });

  it("refuses a half-typed date rather than saving it", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "due");
    await user.keyboard("{Enter}");

    const editor = defined(cellAt("t1", "due").querySelector<HTMLInputElement>("input"));
    await user.clear(editor);
    await user.type(editor, "2026-12");
    await user.keyboard("{Enter}");

    expect(onCellEdit).not.toHaveBeenCalled();
    expect(editor).toHaveValue("2026-12");
    expect(editor).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("YYYY-MM-DD");
  });

  it("commits a date picked from the calendar", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "due");
    await user.keyboard("{Enter}");

    await user.click(screen.getByRole("button", { name: "Sunday, March 15th, 2026" }));
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "due", value: "2026-03-15" }),
    );
  });

  it("keeps a drawn date drawn while it is edited, and clears it with Backspace", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(
      <EditableGrid
        columns={[
          {
            accessorKey: "due",
            header: "Due",
            meta: {
              editor: { type: "date" },
              renderValue: (due) => <span data-testid={`due-${due}`}>{due}</span>,
            },
          },
        ]}
        onCellEdit={onCellEdit}
      />,
    );
    expect(within(cellAt("t1", "due")).getByTestId("due-2026-03-01")).toBeVisible();

    await focusCell(user, "t1", "due");
    await user.keyboard("{Enter}");
    // The same node the cell was showing, with the caret after it.
    expect(within(cellAt("t1", "due")).getByTestId("due-2026-03-01")).toBeVisible();

    await user.keyboard("{Backspace}");
    expect(cellAt("t1", "due").querySelector(".jt-cell-combobox__value")).toBeNull();

    await user.keyboard("{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "due", value: undefined }),
    );
  });

  it("shows the optimistic value while saving and reverts when the save rejects", async () => {
    const user = userEvent.setup();
    let reject: ((error: Error) => void) | undefined;
    render(
      <EditableGrid
        columns={[editableColumns[0] as DataGridColumnDef<Task>]}
        onCellEdit={() =>
          new Promise<void>((_resolve, promiseReject) => {
            reject = promiseReject;
          })
        }
      />,
    );
    await focusCell(user, "t1", "title");
    await user.keyboard("{Enter}Optimistic{Enter}");

    expect(screen.getByText("Optimistic")).toBeVisible();
    expect(cellAt("t1", "title")).toHaveAttribute("data-edit-status", "saving");
    expect(cellAt("t1", "title")).toHaveAttribute("data-status", "saving");
    expect(cellAt("t1", "title").closest('[role="row"]')).toHaveAttribute("aria-busy", "true");

    defined(reject)(new Error("Server said no"));
    await waitFor(() => {
      expect(cellAt("t1", "title")).toHaveAttribute("data-edit-status", "error");
    });
    expect(cellAt("t1", "title")).toHaveAttribute("title", "Server said no");
    expect(cellAt("t1", "title")).toHaveAttribute("data-status", "error");
    expect(cellAt("t1", "title").closest('[role="row"]')).not.toHaveAttribute("aria-busy");
  });

  it("keeps the record saving until every concurrent cell save settles", async () => {
    const user = userEvent.setup();
    const resolvers = new Map<string, () => void>();
    render(
      <EditableGrid
        onCellEdit={(edit) => new Promise<void>((resolve) => resolvers.set(edit.columnId, resolve))}
      />,
    );
    await user.click(cellAt("t1", "title"));
    await user.keyboard("Changed{Enter}");
    await user.click(cellAt("t1", "points"));
    await user.clear(screen.getByRole("textbox", { name: "Points" }));
    await user.keyboard("8{Enter}");
    const row = defined(cellAt("t1", "title").closest('[role="row"]'));
    expect(row).toHaveAttribute("data-status", "saving");
    expect(cellAt("t2", "title").closest('[role="row"]')).not.toHaveAttribute(
      "data-status",
      "saving",
    );
    await act(async () => defined(resolvers.get("title"))());
    expect(cellAt("t1", "title")).toHaveAttribute("data-status", "idle");
    expect(row).toHaveAttribute("data-status", "saving");
    await act(async () => defined(resolvers.get("points"))());
    expect(cellAt("t1", "points")).toHaveAttribute("data-status", "idle");
    expect(row).not.toHaveAttribute("data-status", "saving");
    expect(row).not.toHaveAttribute("aria-busy");
  });

  it("supports external cell status in read-only grids, including hidden saving columns", () => {
    const grid = (status: DataGridCellStatus, hidden = false) => (
      <DataGrid
        columns={editableColumns}
        data={tasks}
        totalCount={tasks.length}
        getRowId={(row) => row.id}
        defaultColumnVisibility={hidden ? { title: false } : {}}
        getCellStatus={({ rowId, columnId }) =>
          rowId === "t1" && columnId === "title" ? status : undefined
        }
        virtualize={false}
      />
    );
    const result = render(grid("saving"));
    const row = defined(result.container.querySelector('[data-row-id="t1"]'));
    expect(row).toHaveAttribute("aria-busy", "true");
    expect(row.querySelector('[data-status="saving"]')).toHaveAttribute("aria-busy", "true");
    result.rerender(grid("error"));
    expect(row).not.toHaveAttribute("aria-busy");
    expect(row.querySelector('[data-status="error"]')).not.toHaveAttribute("aria-busy");
    result.rerender(grid("idle"));
    expect(row.querySelector('[data-status="error"]')).toBeNull();
    result.unmount();
    const hidden = render(grid("saving", true));
    expect(hidden.container.querySelector('[data-row-id="t1"]')).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("refuses to edit a cell the grid says is not editable", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid isCellEditable={({ row }) => row.id !== "t1"} onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "title");
    await user.keyboard("{Enter}");

    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}Allowed{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ rowId: "t2" }));
  });

  it("keeps the grid role's children valid while an editor popup is open", async () => {
    const user = userEvent.setup();
    render(<EditableGrid />);
    await focusCell(user, "t1", "title");
    await user.keyboard("{ArrowRight}{ArrowRight}{Enter}");

    const grid = screen.getByRole("grid");
    const listbox = screen.getByRole("listbox", { name: "Status" });

    // The popup layer is a sibling of the grid role, not a child of a rowgroup:
    // a listbox inside role="row" would break the grid's containment.
    expect(grid).not.toContainElement(listbox);
    expect(defined(document.querySelector(".jt-grid__editor-layer"))).toContainElement(listbox);
    expect(listbox.closest('[role="row"]')).toBeNull();
    expect(listbox.closest('[role="rowgroup"]')).toBeNull();
  });

  it("recovers focus when a commit filters the edited row out of the model", async () => {
    const user = userEvent.setup();
    render(
      <EditableGrid
        columns={[
          {
            accessorKey: "title",
            header: "Title",
            meta: { editor: { type: "text" }, filter: { type: "text" } },
          },
        ]}
        defaultColumnFilters={[{ id: "title", value: "Ship" }]}
        enableColumnFiltering
      />,
    );
    await focusCell(user, "t1", "title");
    await user.keyboard("{Enter}Gone{Enter}");

    // The row no longer matches its own filter, so it leaves the model. Focus
    // has to come back to the viewport rather than fall out of the document.
    await waitFor(() => {
      expect(document.querySelectorAll("[data-cell-id]")).toHaveLength(0);
    });
    expect(document.body).not.toHaveFocus();
    expect(viewport()).toHaveFocus();
  });

  it("commits a typed value that matches no option when the editor allows it", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(
      <EditableGrid
        columns={[
          {
            accessorKey: "status",
            header: "Status",
            meta: {
              editor: { allowCustomValue: true, options: statusOptions, type: "single-select" },
            },
          },
        ]}
        onCellEdit={onCellEdit}
      />,
    );
    await focusCell(user, "t1", "status");
    await user.keyboard("{Enter}");
    await user.type(screen.getByRole("combobox", { name: "Status" }), "zzz");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ value: "zzz" }));
  });

  it("writes an optimistic value through applyCellEdit for a computed column", async () => {
    const user = userEvent.setup();
    let resolve: (() => void) | undefined;
    render(
      <EditableGrid
        applyCellEdit={(row, _columnId, value) => ({ ...row, title: String(value) })}
        columns={[
          {
            id: "computed",
            header: "Computed",
            accessorFn: (task) => task.title.toUpperCase(),
            meta: { editor: { type: "text" } },
          },
        ]}
        onCellEdit={() =>
          new Promise<void>((promiseResolve) => {
            resolve = promiseResolve;
          })
        }
      />,
    );
    await focusCell(user, "t1", "computed");
    await user.keyboard("{Enter}patched{Enter}");

    // The default patch would write `row.computed`, which the accessor never
    // reads. `applyCellEdit` puts the value where the accessor can find it.
    expect(screen.getByText("PATCHED")).toBeVisible();
    defined(resolve)();
    await waitFor(() => {
      expect(cellAt("t1", "computed")).not.toHaveAttribute("data-edit-status");
    });
  });

  it("keeps a resolved value on screen until the parent's data arrives", async () => {
    const user = userEvent.setup();
    let resolve: (() => void) | undefined;

    function ControlledGrid() {
      const [data, setData] = React.useState(tasks);
      return (
        <DataGrid
          columns={[editableColumns[0] as DataGridColumnDef<Task>]}
          data={data}
          enableInlineEditing
          getRowId={(task) => task.id}
          onCellEdit={(edit) =>
            new Promise<void>((promiseResolve) => {
              resolve = () => {
                promiseResolve();
                // The parent lands its update a tick after the promise, which
                // is exactly the gap a naive revert would flash through.
                setTimeout(() => {
                  setData((current) =>
                    current.map((task) =>
                      task.id === edit.rowId ? { ...task, title: String(edit.value) } : task,
                    ),
                  );
                }, 0);
              };
            })
          }
          totalCount={tasks.length}
          virtualize={false}
        />
      );
    }

    render(<ControlledGrid />);
    await focusCell(user, "t1", "title");
    await user.keyboard("{Enter}Landed{Enter}");
    expect(screen.getByText("Landed")).toBeVisible();

    defined(resolve)();
    await waitFor(() => {
      expect(cellAt("t1", "title")).not.toHaveAttribute("data-edit-status");
    });
    expect(screen.getByText("Landed")).toBeVisible();
    expect(screen.queryByText("Ship the grid")).not.toBeInTheDocument();
  });

  it("advertises a single-select cell with a chevron before it is touched", () => {
    render(<EditableGrid />);

    expect(cellAt("t1", "status").querySelector(".jt-cell-chevron")).not.toBeNull();
    // Only the columns that actually open a list get one.
    expect(cellAt("t1", "title").querySelector(".jt-cell-chevron")).toBeNull();
    expect(cellAt("t1", "tags").querySelector(".jt-cell-chevron")).not.toBeNull();
  });

  it("hides the chevron on a cell the grid refuses to edit", () => {
    render(<EditableGrid isCellEditable={({ row }) => row.id !== "t1"} />);

    expect(cellAt("t1", "status").querySelector(".jt-cell-chevron")).toBeNull();
    expect(cellAt("t2", "status").querySelector(".jt-cell-chevron")).not.toBeNull();
  });

  it("expands a single-select at its current value, so Enter keeps it", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t2", "status");

    // t2 is "building" — the second option, not the first.
    await user.keyboard("{Enter}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("data-active", "true");

    await user.keyboard("{Enter}");
    // Re-picking the value it already had is a no-op, not a jump to "Backlog".
    expect(onCellEdit).not.toHaveBeenCalled();
  });

  it("keeps a single-select value visible until it is typed over", async () => {
    const user = userEvent.setup();
    render(<EditableGrid />);
    await focusCell(user, "t1", "status");
    await user.keyboard("{Enter}");

    const combobox = screen.getByRole("combobox", { name: "Status" });
    const value = defined(cellAt("t1", "status").querySelector(".jt-cell-combobox__value"));
    expect(value).toHaveTextContent("Backlog");
    expect(combobox).toHaveAttribute("placeholder", "");

    await user.type(combobox, "bui");
    expect(cellAt("t1", "status").querySelector(".jt-cell-combobox__value")).toBeNull();
  });

  it("draws options the way the column draws its values, in the editor and the filter", async () => {
    const user = userEvent.setup();
    const columns: DataGridColumnDef<Task>[] = [
      {
        accessorKey: "status",
        header: "Status",
        meta: {
          editor: { type: "single-select" },
          filter: { options: statusOptions, type: "single-select" },
          renderValue: (status) => <span data-testid={`badge-${status}`}>{status}</span>,
        },
      },
    ];
    render(<EditableGrid columns={columns} enableColumnFiltering />);

    // The cell.
    expect(within(cellAt("t1", "status")).getByTestId("badge-backlog")).toBeVisible();

    // The editor's option list.
    await focusCell(user, "t1", "status");
    await user.keyboard("{Enter}");
    for (const option of statusOptions) {
      expect(
        within(screen.getByRole("listbox")).getByTestId(`badge-${option.value}`),
      ).toBeVisible();
    }
    await user.keyboard("{Escape}");

    // The filter's option list.
    await user.click(screen.getByLabelText("Filter status"));
    const popover = defined(document.querySelector<HTMLElement>(".jt-filter__popover"));
    for (const option of statusOptions) {
      expect(within(popover).getByTestId(`badge-${option.value}`)).toBeVisible();
    }
  });

  it("draws every entry of a multi-select value, in the cell and on its chips", async () => {
    const user = userEvent.setup();
    const columns: DataGridColumnDef<Task>[] = [
      {
        accessorKey: "tags",
        header: "Tags",
        meta: {
          editor: { options: tagOptions, type: "multi-select" },
          renderValue: (tag) => <span data-testid={`tag-${tag}`}>{tag}</span>,
        },
      },
    ];
    render(<EditableGrid columns={columns} />);
    expect(within(cellAt("t1", "tags")).getByTestId("tag-api")).toBeVisible();

    await focusCell(user, "t1", "tags");
    await user.keyboard("{Enter}");
    expect(
      within(defined(document.querySelector<HTMLElement>(".jt-chip"))).getByTestId("tag-api"),
    ).toBeVisible();
  });

  it("clears a single-select with Backspace and leaves the list open", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "status");
    await user.keyboard("{Enter}");

    const cell = cellAt("t1", "status");
    expect(cell.querySelector(".jt-cell-combobox__value")).toHaveTextContent("Backlog");

    await user.keyboard("{Backspace}");
    expect(cell.querySelector(".jt-cell-combobox__value")).toBeNull();
    // The list is still open, so a replacement is one arrow key away.
    expect(screen.getByRole("listbox")).toBeVisible();
    expect(
      screen
        .getAllByRole("option")
        .every((option) => option.getAttribute("aria-selected") === "false"),
    ).toBe(true);

    await user.keyboard("{Tab}");
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "status", value: undefined }),
    );
  });

  it("replaces a single-select value by arrowing down from the one it holds", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await focusCell(user, "t1", "status");

    // t1 is "backlog", the first option; one step down is "building".
    await user.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: "status", value: "building" }),
    );
    // Choosing commits and steps down, like every other editor.
    expect(cellAt("t2", "status")).toHaveFocus();
  });

  it("sizes the option list from the cell it opened over", async () => {
    const user = userEvent.setup();
    const widths = new Map<string, number>([
      ["jt-grid__editor-layer", 900],
      ["jt-grid__cell", 260],
    ]);
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function measure(this: HTMLElement) {
        const width =
          [...widths].find(([className]) => this.classList.contains(className))?.[1] ?? 0;
        return {
          bottom: 40,
          height: 40,
          left: 0,
          right: width,
          top: 0,
          width,
          x: 0,
          y: 0,
        } as DOMRect;
      });

    try {
      render(<EditableGrid />);
      await focusCell(user, "t1", "status");
      await user.keyboard("{Enter}");

      const popover = defined(document.querySelector<HTMLElement>(".jt-grid__editor-popover"));
      expect(popover.style.minWidth).toBe("260px");
    } finally {
      rect.mockRestore();
    }
  });

  it("keeps a narrow column's list wide enough to read", async () => {
    const user = userEvent.setup();
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function measure(this: HTMLElement) {
        const width = this.classList.contains("jt-grid__cell") ? 60 : 900;
        return {
          bottom: 40,
          height: 40,
          left: 0,
          right: width,
          top: 0,
          width,
          x: 0,
          y: 0,
        } as DOMRect;
      });

    try {
      render(<EditableGrid />);
      await focusCell(user, "t1", "status");
      await user.keyboard("{Enter}");

      const popover = defined(document.querySelector<HTMLElement>(".jt-grid__editor-popover"));
      expect(popover.style.minWidth).toBe("144px");
    } finally {
      rect.mockRestore();
    }
  });

  it("keeps an invalid draft when another cell is clicked, then accepts a correction", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(
      <EditableGrid
        columns={[
          { accessorKey: "points", header: "Points", meta: { editor: { type: "number", min: 0 } } },
        ]}
        onCellEdit={onCellEdit}
      />,
    );
    await user.click(cellAt("t1", "points"));
    const input = screen.getByRole("textbox", { name: "Points" });
    await user.clear(input);
    await user.type(input, "-5");
    await user.click(cellAt("t2", "points"));
    expect(input).toHaveValue("-5");
    expect(input).toHaveFocus();
    expect(onCellEdit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("0 or greater");
    await user.clear(input);
    await user.type(input, "8{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ rowId: "t1", value: 8 }));
    expect(cellAt("t2", "points")).toHaveFocus();
  });

  it.each(["text", "date", "single-select", "multi-select"] as const)(
    "explains a required %s field and allows cancel",
    async (type) => {
      const user = userEvent.setup();
      const onCellEdit = vi.fn();
      const key =
        type === "date"
          ? "due"
          : type === "multi-select"
            ? "tags"
            : type === "single-select"
              ? "status"
              : "title";
      render(
        <EditableGrid
          columns={[
            {
              accessorKey: key,
              header: "Required",
              meta: {
                editor: {
                  type,
                  required: true,
                  options: type === "multi-select" ? tagOptions : statusOptions,
                },
              },
            },
          ]}
          onCellEdit={onCellEdit}
        />,
      );
      await user.click(cellAt("t1", key));
      if (type === "text" || type === "date")
        await user.clear(screen.getByRole("textbox", { name: "Required" }));
      else await user.keyboard("{Backspace}");
      await user.keyboard("{Tab}");
      expect(screen.getByRole("alert")).toHaveTextContent("Required is required.");
      expect(onCellEdit).not.toHaveBeenCalled();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(cellAt("t1", key)).toHaveFocus();
    },
  );

  it("rejects impossible calendar dates and shows a custom validator's message", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(
      <EditableGrid
        columns={[
          {
            accessorKey: "due",
            header: "Due",
            meta: {
              editor: {
                type: "date",
                validate: (value) => (value === "2026-12-25" ? "Office is closed." : undefined),
              },
            },
          },
        ]}
        onCellEdit={onCellEdit}
      />,
    );
    await user.click(cellAt("t1", "due"));
    const input = screen.getByRole("textbox", { name: "Due" });
    await user.clear(input);
    await user.type(input, "2026-02-30{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("valid date");
    await user.clear(input);
    await user.type(input, "2026-12-25{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("Office is closed.");
    expect(onCellEdit).not.toHaveBeenCalled();
  });

  it("finishes a multi-select with Done, keeps search separate, and cancels changes", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await user.click(cellAt("t1", "tags"));
    const input = screen.getByRole("combobox", { name: "Tags" });
    expect(cellAt("t1", "tags")).not.toContainElement(input);
    expect(input).toHaveFocus();
    await user.click(screen.getByRole("option", { name: "Docs" }));
    expect(cellAt("t1", "tags")).toHaveTextContent("+1");
    await user.click(
      within(defined(document.querySelector<HTMLElement>(".jt-grid__editor-layer"))).getByRole(
        "button",
        { name: "Done" },
      ),
    );
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: ["api", "docs"] }),
    );
    await user.click(cellAt("t1", "tags"));
    await user.click(screen.getByRole("option", { name: "Docs" }));
    await user.keyboard("{Escape}");
    expect(cellAt("t1", "tags")).toHaveTextContent("api, docs");
    expect(onCellEdit).toHaveBeenCalledTimes(1);
  });

  it("commits multiple choices with Ctrl+Enter and does not toggle the active choice", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await user.click(cellAt("t1", "tags"));
    await user.keyboard("{ArrowDown}{Enter}{Control>}{Enter}{/Control}");
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: ["api", "docs"] }),
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("retains failed drafts, retries them, and offers a visible discard action", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Offline again"));
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await user.click(cellAt("t1", "title"));
    await user.keyboard("Retained{Enter}");
    await screen.findByRole("alert");
    expect(cellAt("t1", "title")).toHaveTextContent("Ship the grid");
    await user.click(cellAt("t1", "title"));
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Retained");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(cellAt("t1", "title")).toHaveTextContent("Retained");
    expect(onCellEdit).toHaveBeenCalledTimes(2);
    await user.click(cellAt("t1", "title"));
    await user.keyboard("Another{Enter}");
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(cellAt("t1", "title")).toHaveTextContent("Retained");
    expect(onCellEdit).toHaveBeenCalledTimes(3);
  });

  it("undoes the last text edit using the same save callback without creating a redo loop", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await user.click(cellAt("t1", "title"));
    await user.keyboard("Updated{Enter}{Control>}z{/Control}");
    expect(cellAt("t1", "title")).toHaveTextContent("Ship the grid");
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: "Ship the grid", previousValue: "Updated" }),
    );
    expect(screen.getByRole("button", { name: "Undo last edit" })).toBeDisabled();
  });

  it("undoes an immediate boolean edit", async () => {
    const user = userEvent.setup();
    render(<EditableGrid />);
    await user.click(within(cellAt("t1", "done")).getByRole("switch"));
    expect(within(cellAt("t1", "done")).getByRole("switch")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Undo last edit" }));
    expect(within(cellAt("t1", "done")).getByRole("switch")).not.toBeChecked();
  });

  it("lets the date picker navigate years without committing and cancel from calendar focus", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await user.click(cellAt("t1", "due"));
    const year = screen.getByRole("combobox", { name: "Choose the Year" });
    await user.selectOptions(year, "2030");
    expect(onCellEdit).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("combobox", { name: "Choose the Year" })).not.toBeInTheDocument();
    expect(cellAt("t1", "due")).toHaveFocus();
  });

  it("retries a failed undo without offering redo as another undo", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(undefined);
    render(<EditableGrid onCellEdit={onCellEdit} />);
    await user.click(cellAt("t1", "title"));
    await user.keyboard("Updated{Enter}");
    const undo = screen.getByRole("button", { name: "Undo last edit" });
    await waitFor(() => expect(undo).toBeEnabled());
    await user.click(undo);
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(cellAt("t1", "title")).toHaveTextContent("Ship the grid");
    expect(undo).toBeDisabled();
  });
});
