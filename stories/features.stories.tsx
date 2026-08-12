import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataGrid, type DataGridProps } from "../src";
import { people, personColumns, type Person } from "./fixtures";

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
    sections: {
      getKey: (row) => row.department,
      headerHeight: 44,
      renderHeader: ({ key, rows }) => (
        <div className="story-section">
          <strong>{key}</strong>
          <span>{rows.length} people in this loaded section</span>
        </div>
      ),
    },
  },
};

export const InlineFilters: Story = {
  args: {
    enableColumnFiltering: true,
    height: 560,
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
      headerStart: <span className="story-note">Drag the six-dot handles, or focus one and press Alt+←/→.</span>,
    },
    tableId: "storybook-column-order",
  },
};

export const ResizableColumns: Story = {
  args: {
    enableColumnResizing: true,
    tableId: "storybook-column-sizing",
  },
};

export const AllColumnControls: Story = {
  args: {
    enableColumnFiltering: true,
    enableColumnReordering: true,
    enableColumnResizing: true,
    enableColumnVisibility: true,
    tableId: "storybook-all-column-controls",
  },
};

export const StableSelectionAndRangeSelection: Story = {
  args: {
    enableRowSelection: true,
    getRowId: (row) => row.id,
    isRowSelectable: (row) => row.status !== "Paused",
    slots: {
      footerEnd: ({ selectedRows }) => (
        <span>{selectedRows.length > 0 ? selectedRows.map((row) => row.name).join(", ") : "No selection"}</span>
      ),
    },
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
      headerStart: <button className="story-toolbar-button" type="button">Saved view</button>,
      headerEnd: <button className="story-toolbar-button" type="button">Add person</button>,
      columnHeaderEnd: <span className="story-note">Live</span>,
      footerStart: <span>Synced moments ago</span>,
      footerEnd: <button className="story-toolbar-button" type="button">Next page</button>,
    },
  },
};
