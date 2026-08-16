import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { createLocalStoragePreferenceStorage, DataGrid, type DataGridProps } from "../src";
import { defined } from "../src/test/defined";
import { makePeople, type Person, people, personColumns } from "./fixtures";

function PersonGrid(props: DataGridProps<Person>) {
  return <DataGrid {...props} />;
}

/** The name cell of the first rendered row. */
function firstName(canvasElement: HTMLElement): string {
  const row = defined(canvasElement.querySelector("[data-row-id]"));
  // Cell 0 is the avatar column.
  return defined(row.querySelectorAll(".jt-grid__cell")[1]).textContent ?? "";
}

/** Header labels in their current left-to-right order. */
function headerOrder(canvasElement: HTMLElement): string[] {
  return [...canvasElement.querySelectorAll("[data-column-header]")].map((header) =>
    (header.textContent ?? "").replace(/\?.*$/, "").trim(),
  );
}

const meta = {
  title: "DataGrid/Interactions",
  component: PersonGrid,
  parameters: {
    docs: {
      description: {
        component:
          "Behaviour, exercised rather than described. Every story here runs its play function in a real browser under `bun run test:storybook`, once against a light host page and once against a dark one.",
      },
    },
  },
  args: {
    columns: personColumns,
    data: people,
    getRowId: (row) => row.id,
    preferenceStorage: null,
    totalCount: people.length,
  },
} satisfies Meta<typeof PersonGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SortFromTheKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole("columnheader", { name: /Name/ });
    const sortButton = within(header).getByRole("button", { name: /Name/ });

    await expect(header).toHaveAttribute("aria-sort", "none");

    sortButton.focus();
    await expect(sortButton).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(header).toHaveAttribute("aria-sort", "ascending"));

    // "Ada" is the alphabetically first given name in the fixture, so it leads
    // the ascending order and cannot lead the descending one.
    await expect(firstName(canvasElement)).toMatch(/^Ada /);

    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(header).toHaveAttribute("aria-sort", "descending"));
    await expect(firstName(canvasElement)).not.toMatch(/^Ada /);

    // A third activation clears the sort rather than cycling back to ascending.
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(header).toHaveAttribute("aria-sort", "none"));
  },
};

export const ToggleColumnsFromTheMenu: Story = {
  args: { enableColumnVisibility: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("columnheader", { name: /Email/ })).toBeVisible();
    await userEvent.click(canvas.getByLabelText("Show or hide columns"));

    const menu = defined(canvasElement.querySelector<HTMLElement>(".jt-column-menu__content"));
    await userEvent.click(within(menu).getByRole("checkbox", { name: "Email" }));
    await waitFor(() =>
      expect(canvas.queryByRole("columnheader", { name: /Email/ })).not.toBeInTheDocument(),
    );

    await userEvent.click(within(menu).getByRole("checkbox", { name: "Email" }));
    await waitFor(() => expect(canvas.getByRole("columnheader", { name: /Email/ })).toBeVisible());

    // Escape leaves the menu and hands focus back to the trigger it came from.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.getByLabelText("Show or hide columns")).toHaveFocus());
  },
};

export const DismissAFilterPopoverWithEscape: Story = {
  args: { enableColumnFiltering: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByLabelText("Filter department");

    await userEvent.click(trigger);
    const popover = defined(canvasElement.querySelector<HTMLElement>(".jt-filter__popover"));
    await userEvent.click(within(popover).getByRole("checkbox", { name: /Engineering/ }));
    await waitFor(() =>
      expect(canvasElement.querySelectorAll("[data-row-id]").length).toBeLessThan(people.length),
    );

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(canvasElement.querySelector(".jt-filter__popover")).not.toBeInTheDocument(),
    );
    await expect(trigger).toHaveFocus();
    // Dismissing the popover keeps the filter: only the surface went away.
    await expect(within(trigger).getByText("1")).toBeVisible();
  },
};

export const MoveAColumnWithAltArrows: Story = {
  args: { enableColumnReordering: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const before = headerOrder(canvasElement);
    const handle = canvas.getByRole("button", { name: "Move email column" });

    handle.focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");

    await waitFor(() => {
      const after = headerOrder(canvasElement);
      expect(after.indexOf("Email")).toBe(before.indexOf("Email") + 1);
    });

    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await waitFor(() => expect(headerOrder(canvasElement)).toEqual(before));
  },
};

export const SelectEveryLoadedRowThenClear: Story = {
  args: {
    data: people.slice(0, 12),
    enableRowSelection: true,
    onRowSelectionChange: fn(),
    totalCount: 12,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const selectAll = canvas.getByRole("checkbox", { name: "Select all loaded rows" });

    await userEvent.click(selectAll);
    await waitFor(() => expect(canvas.getByText("12 selected")).toBeVisible());
    await expect(args.onRowSelectionChange).toHaveBeenCalled();

    const firstRow = canvas.getByRole("checkbox", { name: "Select row person-1" });
    await userEvent.click(firstRow);
    await waitFor(() => expect(canvas.getByText("11 selected")).toBeVisible());
    await expect(selectAll).toHaveAttribute("aria-checked", "mixed");

    // From a partial selection the header checkbox completes it, and only the
    // click after that clears everything.
    await userEvent.click(selectAll);
    await waitFor(() => expect(canvas.getByText("12 selected")).toBeVisible());
    await userEvent.click(selectAll);
    await waitFor(() => expect(canvas.queryByText(/selected/)).not.toBeInTheDocument());
  },
};

export const LoadMoreWhenScrollingNearTheEnd: Story = {
  args: {
    data: makePeople(40),
    hasMore: true,
    height: 420,
    onLoadMore: fn(),
    totalCount: 4_000,
  },
  play: async ({ args, canvasElement }) => {
    const viewport = defined(canvasElement.querySelector<HTMLElement>('[data-slot="viewport"]'));

    await expect(args.onLoadMore).not.toHaveBeenCalled();
    viewport.scrollTop = viewport.scrollHeight;

    await waitFor(() =>
      expect(args.onLoadMore).toHaveBeenCalledWith({ loadedCount: 40, totalCount: 4_000 }),
    );
    // The grid asks once per loaded page, not once per scroll event.
    viewport.scrollTop = viewport.scrollHeight - 10;
    await expect(args.onLoadMore).toHaveBeenCalledTimes(1);
  },
};

export const OpenARowFromTheKeyboard: Story = {
  args: {
    data: people.slice(0, 10),
    onRowClick: fn(),
    totalCount: 10,
  },
  play: async ({ args, canvasElement }) => {
    const row = defined(canvasElement.querySelector<HTMLElement>('[data-row-id="person-2"]'));

    row.focus();
    await expect(row).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onRowClick).toHaveBeenCalledTimes(1);

    await userEvent.click(row);
    await expect(args.onRowClick).toHaveBeenCalledTimes(2);
  },
};

export const RememberAndResetColumnPreferences: Story = {
  args: {
    enableColumnVisibility: true,
    preferenceStorage: createLocalStoragePreferenceStorage(),
    slots: {
      footerEnd: ({ resetPreferences }) => (
        <button className="story-toolbar-button" onClick={resetPreferences} type="button">
          Reset columns
        </button>
      ),
    },
    tableId: "storybook-interaction-preferences",
  },
  loaders: [
    () => {
      // Start from a clean slate: the story asserts on what this run writes.
      window.localStorage.removeItem("jeff-table:v1:storybook-interaction-preferences");
      return {};
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const storageKey = "jeff-table:v1:storybook-interaction-preferences";

    await userEvent.click(canvas.getByLabelText("Show or hide columns"));
    const menu = defined(canvasElement.querySelector<HTMLElement>(".jt-column-menu__content"));
    await userEvent.click(within(menu).getByRole("checkbox", { name: "City" }));

    await waitFor(() => {
      const stored = window.localStorage.getItem(storageKey);
      expect(stored).not.toBeNull();
      expect(JSON.parse(defined(stored)).columnVisibility.city).toBe(false);
    });

    await userEvent.click(canvas.getByRole("button", { name: "Reset columns" }));
    await waitFor(() => expect(canvas.getByRole("columnheader", { name: /City/ })).toBeVisible());
    await expect(window.localStorage.getItem(storageKey)).toBeNull();
  },
};

export const NarrowContainerKeepsColumnsAligned: Story = {
  args: {
    data: people.slice(0, 30),
    enableColumnFiltering: true,
    height: 420,
    totalCount: 30,
  },
  parameters: {
    docs: {
      description: {
        story:
          "A container narrower than the table's natural width. Virtualized rows are absolutely positioned, so they contribute nothing to the canvas's intrinsic width — without the in-flow track sizer the canvas collapses to the container and every row resolves the shared tracks against its own content, which is what produced ragged rows and a squeezed header on phones.",
      },
    },
  },
  render: (args) => (
    <div className="story-narrow-frame">
      <p className="story-note">
        360px frame — the grid scrolls horizontally instead of squeezing.
      </p>
      <PersonGrid {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByTestId("data-grid");
    const rows = [...canvasElement.querySelectorAll<HTMLElement>("[data-row-id]")];
    const headerRow = defined(
      canvasElement.querySelector<HTMLElement>(".jt-grid__column-header-row"),
    );
    const width = (element: Element) => Math.round(element.getBoundingClientRect().width);

    await expect(rows.length).toBeGreaterThan(1);

    // Every row is exactly as wide as every other, whatever it contains.
    const distinctWidths = new Set(rows.map(width));
    await expect([...distinctWidths]).toHaveLength(1);

    // And the canvas is wider than the frame, so the grid scrolls rather than
    // compressing the columns to fit.
    const canvasWidth = width(defined(grid.querySelector(".jt-grid__rows-canvas")));
    const viewport = defined(grid.querySelector<HTMLElement>('[data-slot="viewport"]'));
    await expect(canvasWidth).toBe(width(defined(rows[0])));
    await expect(canvasWidth).toBeGreaterThan(width(viewport));

    // Header and cells resolve the identical template, so nothing drifts.
    const firstRow = defined(rows[0]);
    await expect(getComputedStyle(headerRow).gridTemplateColumns).toBe(
      getComputedStyle(firstRow).gridTemplateColumns,
    );
    const cells = [...firstRow.querySelectorAll<HTMLElement>(".jt-grid__cell")];
    const headers = [...canvasElement.querySelectorAll<HTMLElement>("[data-column-header]")];
    for (const [index, header] of headers.entries()) {
      const cell = cells[index];
      if (!cell) continue;
      await expect(Math.round(header.getBoundingClientRect().left)).toBe(
        Math.round(cell.getBoundingClientRect().left),
      );
    }
  },
};
