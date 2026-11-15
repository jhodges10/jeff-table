import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DataGrid, type DataGridCellEdit, type DataGridColumnDef } from "../src";
import { defined } from "../src/test/defined";
import { editablePersonColumns, makePeople, type Person } from "./fixtures";

const seed = makePeople(24);

/**
 * The grid never owns the data. It reports a commit and shows the new value
 * optimistically; the application decides what actually happened.
 */
function EditablePeopleGrid({
  columns = editablePersonColumns,
  onCellEdit,
  ...rest
}: {
  columns?: DataGridColumnDef<Person>[];
  onCellEdit?: (edit: DataGridCellEdit<Person>) => void | Promise<void>;
} & Partial<{ density: "comfortable" | "compact" | "spacious"; height: number }>) {
  const [people, setPeople] = React.useState(seed);
  const [log, setLog] = React.useState<string>();

  return (
    <div className="story-stack">
      <DataGrid
        aria-label="Editable people"
        columns={columns}
        data={people}
        enableInlineEditing
        getRowId={(person) => person.id}
        onCellEdit={async (edit) => {
          const description = `${edit.columnId} → ${JSON.stringify(edit.value)}`;
          setLog(`Saving: ${description}`);
          try {
            await onCellEdit?.(edit);
          } catch (error) {
            setLog(`Failed: ${description}`);
            throw error;
          }
          setLog(`Saved: ${description}`);
          setPeople((current) =>
            current.map((person) =>
              person.id === edit.rowId ? { ...person, [edit.columnId]: edit.value } : person,
            ),
          );
        }}
        totalCount={people.length}
        {...rest}
      />
      <p className="story-note" data-testid="last-edit">
        {log ?? "Changes save automatically. Use Undo last edit to reverse a saved change."}
      </p>
    </div>
  );
}

const meta = {
  title: "DataGrid/Editing",
  component: EditablePeopleGrid,
} satisfies Meta<typeof EditablePeopleGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every editor type at once: text, number, single- and multi-select typeahead,
 * a boolean switch, and a date.
 */
export const EveryEditorType: Story = {};

/** A slow save keeps the entire record visibly pending until persistence finishes. */
export const SavingStatus: Story = {
  args: { onCellEdit: () => new Promise<void>((resolve) => setTimeout(resolve, 1600)) },
  play: async ({ canvasElement }) => {
    const cell = defined(
      canvasElement.querySelector<HTMLElement>('[data-cell-id="person-1_city"]'),
    );
    const row = defined(cell.closest<HTMLElement>('[role="row"]'));
    await userEvent.click(cell);
    await userEvent.keyboard("Portland{Enter}");
    await expect(cell).toHaveAttribute("data-status", "saving");
    await expect(row).toHaveAttribute("aria-busy", "true");
    const style = getComputedStyle(row);
    await expect(Number(style.opacity)).toBeLessThanOrEqual(0.65);
    await expect(style.animationName).toBe(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "none" : "jt-row-saving",
    );
    await waitFor(() => expect(cell).toHaveAttribute("data-status", "idle"), { timeout: 3000 });
    await expect(row).not.toHaveAttribute("aria-busy");
    await expect(getComputedStyle(row).opacity).toBe("1");
    await expect(getComputedStyle(row).animationName).toBe("none");
  },
};

export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const cell = (rowId: string, columnId: string) =>
      defined(canvasElement.querySelector<HTMLElement>(`[data-cell-id="${rowId}_${columnId}"]`));

    // A click edits, so Escape steps back out to leave the cell itself focused.
    await userEvent.click(cell("person-1", "name"));
    await userEvent.keyboard("{Escape}");
    await expect(cell("person-1", "name")).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await expect(cell("person-3", "name")).toHaveFocus();

    // Exactly one tab stop, so the grid is a single stop in the page's order.
    await expect(canvasElement.querySelectorAll('.jt-grid [tabindex="0"]')).toHaveLength(1);
  },
};

export const TypeaheadSelect: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = defined(
      canvasElement.querySelector<HTMLElement>('[data-cell-id="person-1_status"]'),
    );

    await userEvent.click(cell);

    // The option list draws values the way the cell does, so the badge a reader
    // recognises in the column is the badge they pick from.
    const listbox = await canvas.findByRole("listbox", { name: "Status" });
    await expect(listbox.querySelectorAll(".story-status")).toHaveLength(3);

    const combobox = canvas.getByRole("combobox", { name: "Status" });
    await userEvent.type(combobox, "pau");
    await waitFor(async () => {
      await expect(canvas.getAllByRole("option")[0]).toHaveTextContent("Paused");
    });

    await userEvent.keyboard("{Enter}");
    await waitFor(async () => {
      await expect(canvas.getByTestId("last-edit")).toHaveTextContent('status → "Paused"');
    });
  },
};

/**
 * Entering edit mode must not move the value. The cell and the open combobox
 * inset their content by the same padding, so the badge stays put and only the
 * caret and the list appear.
 */
export const ValueStaysPut: Story = {
  play: async ({ canvasElement }) => {
    const cell = () =>
      defined(canvasElement.querySelector<HTMLElement>('[data-cell-id="person-1_status"]'));
    const badge = () => defined(cell().querySelector<HTMLElement>(".story-status"));

    const chevron = () => defined(cell().querySelector<SVGSVGElement>(".jt-cell-chevron"));
    const before = badge().getBoundingClientRect();
    const beforeChevron = chevron().getBoundingClientRect();
    await userEvent.click(cell());

    const afterChevron = chevron().getBoundingClientRect();
    await expect(afterChevron.left).toBe(beforeChevron.left);
    await expect(afterChevron.right).toBe(beforeChevron.right);
    const after = badge().getBoundingClientRect();
    await expect(after.left).toBeCloseTo(before.left, 0);
    await expect(after.top).toBeCloseTo(before.top, 0);
    // And it is not clipped by the caret that now shares the cell with it.
    await expect(after.width).toBeCloseTo(before.width, 0);
  },
};

/**
 * The lock, in the case that breaks it: a held value wider than its column.
 * In view the value truncates and the chevron sits at the cell's trailing edge;
 * opening the combobox must not let the value shove the chevron along in front
 * of it and out of the cell.
 */
export const ChevronStaysPut: Story = {
  args: {
    columns: editablePersonColumns.map((column) =>
      "accessorKey" in column && column.accessorKey === "status"
        ? { ...column, meta: { ...column.meta, width: "88px" } }
        : column,
    ),
  },
  play: async ({ canvasElement }) => {
    const cell = () =>
      defined(canvasElement.querySelector<HTMLElement>('[data-cell-id="person-1_status"]'));
    const chevron = () => defined(cell().querySelector<SVGSVGElement>(".jt-cell-chevron"));

    const before = chevron().getBoundingClientRect();
    await userEvent.click(cell());

    // Opened at the value it holds — nothing typed, so the value is still there
    // competing for the same row of space the chevron sits in.
    const after = chevron().getBoundingClientRect();
    await expect(after.left).toBe(before.left);
    await expect(after.right).toBe(before.right);
    await expect(after.right).toBeLessThanOrEqual(cell().getBoundingClientRect().right);
  },
};

/**
 * A column that draws its own values keeps drawing them: the chip is a wrapper,
 * not a second pill around the first.
 */
export const MultiSelectChips: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = defined(
      canvasElement.querySelector<HTMLElement>('[data-cell-id="person-1_skills"]'),
    );

    await userEvent.click(cell);

    const chip = defined(cell.querySelector<HTMLElement>(".jt-chip"));
    await expect(chip).toHaveAttribute("data-drawn");
    await expect(getComputedStyle(chip).backgroundImage).toBe("none");
    await expect(chip.querySelector(".story-tag")).not.toBeNull();
    await expect(canvas.getAllByRole("option").length).toBeGreaterThan(1);

    // The remove control is a button, so it carries the browser's own padding
    // and border until the stylesheet resets them — which is exactly how the
    // cross once collapsed to nothing inside an empty ring.
    const remove = defined(chip.querySelector<HTMLElement>(".jt-chip__remove"));
    const cross = defined(remove.querySelector<SVGSVGElement>("svg"));
    await expect(getComputedStyle(remove).borderTopWidth).toBe("0px");
    await expect(cross.getBoundingClientRect().width).toBeGreaterThan(6);
    await expect(cross.getBoundingClientRect().height).toBeGreaterThan(6);

    // And the pill and its cross read as one chip, not as a pill with a stray
    // cross beside it: a hairline capsule encloses both, tightly.
    const enclosure = chip.getBoundingClientRect();
    const drawn = defined(chip.querySelector<HTMLElement>(".story-tag")).getBoundingClientRect();
    await expect(getComputedStyle(chip).borderTopWidth).toBe("1px");
    await expect(drawn.left - enclosure.left).toBeLessThan(4);
    await expect(enclosure.right - remove.getBoundingClientRect().right).toBeLessThan(6);
    await expect(remove.getBoundingClientRect().left - drawn.right).toBeLessThan(6);

    // The cross turns a quarter turn on hover. `:hover` follows the real
    // pointer, which a synthetic event does not move, so what is checkable here
    // is that the transform is wired to animate rather than to snap.
    await expect(getComputedStyle(cross).transitionProperty).toContain("transform");
    await expect(getComputedStyle(cross).transitionDuration).not.toBe("0s");
  },
};

/**
 * The same data type, two controls. A switch reads as a setting that takes
 * effect at once; a checkbox reads as a value in a record. Both commit on
 * click and on Enter, and neither has an edit mode to enter.
 */
export const BooleanControls: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = () =>
      defined(canvas.getAllByRole<HTMLInputElement>("checkbox", { name: "Verified" })[0]);
    const before = box().checked;

    // The cell owns the tab stop; the control never adds a second one per row.
    await expect(box()).toHaveAttribute("tabindex", "-1");
    await expect(canvas.getAllByRole("switch", { name: "On call" }).length).toBeGreaterThan(0);

    await userEvent.click(box());
    await waitFor(async () => {
      await expect(box().checked).toBe(!before);
    });
  },
};

/**
 * A currency cell keeps its symbol, its grouping, its decimals, and its
 * right alignment while it is edited. The caret opens at the far right, where a
 * number is amended from, and nothing on the row shifts.
 */
export const CurrencyEditor: Story = {
  play: async ({ canvasElement }) => {
    const cell = () =>
      defined(canvasElement.querySelector<HTMLElement>('[data-cell-id="person-1_balance"]'));
    const displayed = defined(cell().textContent);
    const before = cell().getBoundingClientRect();

    await userEvent.click(cell());

    const editor = defined(cell().querySelector<HTMLInputElement>("input"));
    await expect(editor.value).toBe(displayed);
    await expect(editor).toHaveAttribute("type", "text");
    await expect(getComputedStyle(editor).textAlign).toBe("right");
    await expect(editor.selectionStart).toBe(displayed.length);

    const after = cell().getBoundingClientRect();
    await expect(after.width).toBeCloseTo(before.width, 0);
    await expect(after.left).toBeCloseTo(before.left, 0);
  },
};

export const BooleanSwitch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggles = canvas.getAllByRole("switch", { name: "On call" });
    const first = defined(toggles[0]);
    const before = first.getAttribute("aria-checked");

    await userEvent.click(first);
    await waitFor(async () => {
      await expect(canvas.getAllByRole("switch", { name: "On call" })[0]).not.toHaveAttribute(
        "aria-checked",
        before,
      );
    });
  },
};

/**
 * One calendar, one format. `<input type="date">` would add the platform's own
 * picker beside this one and re-render the text in the browser's locale.
 */
export const DateEditor: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = () =>
      defined(canvasElement.querySelector<HTMLElement>('[data-cell-id="person-1_joined"]'));
    const displayed = defined(cell().textContent);

    await userEvent.click(cell());

    const editor = defined(cell().querySelector<HTMLInputElement>("input"));
    await expect(editor).toHaveAttribute("type", "text");
    await expect(editor.value).toBe(displayed);
    await expect(document.querySelectorAll(".rdp-root")).toHaveLength(1);

    // Clicking the calendar must not blur-commit the field out from under the
    // click it is about to receive.
    const day = defined(document.querySelectorAll<HTMLElement>(".rdp-day_button")[20]);
    const label = defined(day.getAttribute("aria-label"));
    await userEvent.click(day);
    await waitFor(async () => {
      await expect(canvas.getByTestId("last-edit")).toHaveTextContent("joined →");
    });
    await expect(label).toContain(",");
  },
};

/**
 * A save that fails. The value shows immediately, then reverts with an error
 * ring once the handler rejects — the grid never pretends a write landed.
 */
export const FailingSave: Story = {
  args: {
    columns: editablePersonColumns.filter(
      (column) => "accessorKey" in column && column.accessorKey !== "avatar",
    ),
    onCellEdit: async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      throw new Error("The server rejected this change.");
    },
  },
  play: async ({ canvasElement }) => {
    const cell = defined(
      canvasElement.querySelector<HTMLElement>('[data-cell-id="person-1_city"]'),
    );

    await userEvent.click(cell);
    await userEvent.keyboard("Atlantis{Enter}");

    await waitFor(
      async () => {
        await expect(canvasElement.querySelector('[data-cell-id="person-1_city"]')).toHaveAttribute(
          "data-edit-status",
          "error",
        );
      },
      { timeout: 3_000 },
    );
  },
};

/** Invalid input stays visible until it is corrected or cancelled. */
export const ValidationFeedback: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = defined(
      canvasElement.querySelector<HTMLElement>('[data-cell-id="person-1_balance"]'),
    );
    await userEvent.click(cell);
    const input = canvas.getByRole("textbox", { name: "Balance" });
    await userEvent.clear(input);
    await userEvent.type(input, "-5{Enter}");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByRole("alert")).toHaveTextContent("0 or greater");
    await userEvent.clear(input);
    await userEvent.type(input, "100{Enter}");
    await expect(canvas.getByTestId("last-edit")).toHaveTextContent("Saved:");
    await expect(cell).toHaveTextContent("$100.00");
  },
};

/** Many selected values leave the search and completion controls available. */
export const MultiSelectDone: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = defined(
      canvasElement.querySelector<HTMLElement>('[data-cell-id="person-1_skills"]'),
    );
    await userEvent.click(cell);
    const input = canvas.getByRole("combobox", { name: "Skills" });
    for (const name of ["Infra", "Mobile", "Research", "Security"]) {
      await userEvent.click(canvas.getByRole("option", { name }));
    }
    await expect(input).toBeVisible();
    await expect(input.getBoundingClientRect().width).toBeGreaterThan(100);
    await expect(cell).toHaveTextContent("+4");
    await userEvent.click(canvas.getByRole("button", { name: "Done" }));
    await expect(canvas.queryByRole("listbox")).toBeNull();
    await expect(canvas.getByTestId("last-edit")).toHaveTextContent('"Security"');
  },
};

/** Undo persists the previous value through the normal editing callback. */
export const UndoLastEdit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = defined(
      canvasElement.querySelector<HTMLElement>('[data-cell-id="person-1_city"]'),
    );
    await userEvent.click(cell);
    await userEvent.keyboard("Portland{Enter}");
    await userEvent.click(await canvas.findByRole("button", { name: "Undo last edit" }));
    await expect(cell).toHaveTextContent("Seattle");
    await expect(canvas.getByTestId("last-edit")).toHaveTextContent("Saved: city");
  },
};
