import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { DataGrid, type DataGridProps, IndeterminateCheckbox } from "../src";
import { defined } from "../src/test/defined";
import { type Person, people, personColumns } from "./fixtures";

function PersonGrid(props: DataGridProps<Person>) {
  return <DataGrid {...props} />;
}

const meta = {
  title: "DataGrid/Features",
  component: PersonGrid,
  args: {
    columns: personColumns,
    data: people,
    getRowId: (row) => row.id,
    totalCount: people.length,
  },
} satisfies Meta<typeof PersonGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sections: Story = {
  args: {
    enableRowSelection: true,
    sections: {
      getKey: (row) => row.department,
      headerHeight: 44,
      renderHeader: ({ key, rows }) => (
        <div className="story-section">
          <strong>{key}</strong>
          <span>{rows.length} people in this loaded section</span>
        </div>
      ),
      renderSelection: ({ checked, disabled, indeterminate, key, toggle }) => (
        <IndeterminateCheckbox
          aria-label={`Select ${key} section`}
          checked={checked}
          disabled={disabled}
          indeterminate={indeterminate}
          onChange={(event) => toggle(event.currentTarget.checked)}
        />
      ),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = defined(canvasElement.querySelector<HTMLElement>('[data-slot="viewport"]'));
    const engineeringCount = people.filter((person) => person.department === "Engineering").length;
    // Query the section by its key: "Engineering" is also a department cell
    // value, so a text query matches many elements once rows are rendered.
    const engineering = canvasElement.querySelector<HTMLElement>(
      '[data-section-key="Engineering"]',
    );
    await expect(engineering).toHaveAttribute("data-sticky", "true");
    const engineeringSelection = canvas.getByRole("checkbox", {
      name: "Select Engineering section",
    });
    await userEvent.click(engineeringSelection);
    await expect(engineeringSelection).toBeChecked();
    await expect(canvas.getByText(`${engineeringCount} selected`)).toBeVisible();

    viewport.scrollTop = (engineeringCount + 1) * 44 + 1;
    fireEvent.scroll(viewport);
    await waitFor(() => {
      const finance = canvasElement.querySelector<HTMLElement>('[data-section-key="Finance"]');
      expect(finance).toHaveAttribute("data-sticky", "true");
    });

    viewport.scrollTop = 0;
    fireEvent.scroll(viewport);
    await waitFor(() => {
      const restored = canvasElement.querySelector<HTMLElement>('[data-section-key="Engineering"]');
      expect(restored).toHaveAttribute("data-sticky", "true");
    });
  },
};

export const InlineFilters: Story = {
  args: {
    enableColumnFiltering: true,
    height: 560,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nameFilter = canvas.getByLabelText("Filter name");

    await userEvent.click(nameFilter);
    await userEvent.type(canvas.getByRole("searchbox", { name: "Filter value" }), "Margaret");
    await waitFor(() => {
      expect(canvas.getAllByText("Margaret Borg").length).toBeGreaterThan(0);
      expect(canvas.queryByText("Grace Hamilton")).not.toBeInTheDocument();
    });

    await userEvent.click(nameFilter);
    const filtersMenu = canvas.getByLabelText("Column filters");
    await expect(within(filtersMenu).getByText("1")).toBeVisible();
    await userEvent.click(filtersMenu);
    const menu = filtersMenu.closest("details");
    await expect(menu).not.toBeNull();
    await expect(within(defined(menu)).getByText("1 active")).toBeVisible();
    await userEvent.click(within(defined(menu)).getByRole("button", { name: "Clear all filters" }));
    await expect(canvas.getAllByText("Grace Hamilton").length).toBeGreaterThan(0);
    await userEvent.click(filtersMenu);

    const departmentFilter = canvas.getByLabelText("Filter department");
    const departmentMenu = defined(departmentFilter.closest("details"));
    await userEvent.click(departmentFilter);
    const engineering = canvas.getByRole("checkbox", { name: "Engineering" });
    await userEvent.click(engineering);
    await expect(departmentMenu).not.toHaveAttribute("open");
    await expect(canvas.queryByRole("checkbox", { name: "Engineering" })).not.toBeInTheDocument();
    await expect(document.activeElement).toBe(document.body);
  },
};

export const GlobalSearch: Story = {
  args: {
    enableGlobalFilter: true,
    searchPlaceholder: "Search every visible field…",
  },
};

export const ColumnVisibilityAtFarRight: Story = {
  args: {
    defaultColumnVisibility: { city: false, joined: false },
    enableColumnVisibility: true,
    tableId: "storybook-column-visibility",
  },
};

export const DragAndDropColumns: Story = {
  args: {
    enableColumnReordering: true,
    slots: {
      headerStart: (
        <span className="story-note">
          Drag the six-dot handles, or focus one and press Alt+←/→.
        </span>
      ),
    },
    tableId: "storybook-column-order",
  },
};

export const ResizableColumns: Story = {
  args: {
    enableColumnResizing: true,
    preferenceStorage: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole("columnheader", { name: /Name/ });
    const cell = defined(canvas.getAllByRole("gridcell", { name: "Ada Lovelace" })[0]);
    const resizeHandle = canvas.getByRole("button", { name: "Resize name column" });
    const handleRect = resizeHandle.getBoundingClientRect();
    const startWidth = header.getBoundingClientRect().width;
    const startX = handleRect.left + handleRect.width / 2;
    const y = handleRect.top + handleRect.height / 2;

    await userEvent.pointer([
      { coords: { clientX: startX, clientY: y }, keys: "[MouseLeft>]", target: resizeHandle },
      { coords: { clientX: startX + 80, clientY: y }, target: resizeHandle },
      {
        coords: { clientX: startX + 80, clientY: y },
        keys: "[/MouseLeft]",
        target: resizeHandle,
      },
    ]);

    const resizedWidth = header.getBoundingClientRect().width;
    await expect(resizedWidth).toBeGreaterThanOrEqual(startWidth + 79);
    await expect(cell.getBoundingClientRect().width).toBeCloseTo(resizedWidth, 0);
    await expect(resizeHandle).not.toHaveAttribute("data-resizing");

    await userEvent.dblClick(resizeHandle);
    await expect(header.getBoundingClientRect().width).toBeCloseTo(startWidth, 0);
    await expect(cell.getBoundingClientRect().width).toBeCloseTo(startWidth, 0);
    await expect(resizeHandle).not.toHaveAttribute("data-resizing");
  },
};

export const AllColumnControls: Story = {
  args: {
    enableColumnFiltering: true,
    enableColumnReordering: true,
    enableColumnResizing: true,
    enableColumnVisibility: true,
    preferenceStorage: null,
    tableId: "storybook-all-column-controls",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of ["Name", "Email", "Department", "Status", "Joined", "Balance"]) {
      const header = canvas.getByRole("columnheader", { name: new RegExp(label) });
      const sortButton = within(header).getByRole("button", { name: label });
      const title = defined(sortButton.querySelector("span"));
      const controls = defined(header.querySelector<HTMLElement>(".jt-grid__header-controls"));
      const headerBounds = header.getBoundingClientRect();

      await expect(title.getBoundingClientRect().left).toBeCloseTo(headerBounds.left + 12, 0);
      await expect(controls.getBoundingClientRect().right).toBeCloseTo(headerBounds.right - 12, 0);
    }

    const trigger = canvas.getByLabelText("Column filters");
    await userEvent.click(trigger);

    const menu = defined(trigger.closest("details"));
    const getPopover = () => defined(menu.querySelector<HTMLElement>(".jt-filters-menu__popover"));
    const rootWidth = getPopover().getBoundingClientRect().width;
    await expect(rootWidth).toBeGreaterThan(0);

    for (const column of ["Name", "Email", "Department", "Status", "Balance"]) {
      await userEvent.click(within(getPopover()).getByRole("button", { name: column }));
      await expect(getPopover().getBoundingClientRect().width).toBeCloseTo(rootWidth, 0);
      await userEvent.click(within(getPopover()).getByRole("button", { name: column }));
      await expect(getPopover().getBoundingClientRect().width).toBeCloseTo(rootWidth, 0);
    }

    await userEvent.click(trigger);
  },
};

export const StableSelectionAndRangeSelection: Story = {
  args: {
    enableRowSelection: true,
    getRowId: (row) => row.id,
    isRowSelectable: (row) => row.status !== "Paused",
    slots: {
      footerEnd: ({ selectedRows }) => (
        <span>
          {selectedRows.length > 0
            ? selectedRows.map((row) => row.name).join(", ")
            : "No selection"}
        </span>
      ),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstRow = canvas.getByRole("checkbox", { name: "Select row person-1" });
    const selectAll = canvas.getByRole("checkbox", { name: "Select all loaded rows" });

    await expect(firstRow.closest(".jt-check")).toHaveAttribute("data-state", "unchecked");
    await userEvent.click(firstRow);
    await expect(firstRow.closest(".jt-check")).toHaveAttribute("data-state", "checked");
    await expect(
      firstRow.closest(".jt-check")?.querySelector(".jt-check__icon--checked path"),
    ).toHaveAttribute("pathLength", "1");
    await expect(selectAll).toHaveAttribute("aria-checked", "mixed");
    await expect(selectAll.closest(".jt-check")).toHaveAttribute("data-state", "indeterminate");
  },
};

export const SeparateHeaderAndFooterSlots: Story = {
  args: {
    classNames: {
      footer: "story-custom-footer",
      header: "story-custom-header",
      row: "story-custom-row",
    },
    enableGlobalFilter: true,
    slots: {
      headerStart: (
        <button className="story-toolbar-button" type="button">
          Saved view
        </button>
      ),
      headerEnd: (
        <button className="story-toolbar-button" type="button">
          Add person
        </button>
      ),
      columnHeaderEnd: <span className="story-note">Live</span>,
      footerStart: <span>Synced moments ago</span>,
      footerEnd: (
        <button className="story-toolbar-button" type="button">
          Next page
        </button>
      ),
    },
  },
};
