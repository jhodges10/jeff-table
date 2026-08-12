import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DataGrid, type DataGridProps } from "../src";
import { makePeople, people, personColumns, type Person } from "./fixtures";

function PersonGrid(props: DataGridProps<Person>) {
  return <DataGrid {...props} />;
}

const meta = {
  title: "DataGrid/Overview",
  component: PersonGrid,
  parameters: {
    docs: {
      description: {
        component:
          "One strongly typed grid surface backed by TanStack Table v9. The complete `totalCount` is required so virtualization is correct before every page is loaded.",
      },
    },
  },
  args: {
    columns: personColumns,
    data: people.slice(0, 40),
    getRowId: (row) => row.id,
    totalCount: 40,
  },
} satisfies Meta<typeof PersonGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TenThousandVirtualRows: Story = {
  args: {
    data: makePeople(120),
    totalCount: 10_000,
    isLoadingMore: true,
  },
  render: (args) => (
    <div className="story-shell">
      <p className="story-note">Only 120 records are loaded; the 10,000-row scroll model exists immediately.</p>
      <PersonGrid {...args} height={560} />
    </div>
  ),
};

export const KitchenSink: Story = {
  args: {
    "aria-label": "People directory",
    data: people,
    enableColumnFiltering: true,
    enableColumnReordering: true,
    enableColumnResizing: true,
    enableColumnVisibility: true,
    enableGlobalFilter: true,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    onRowClick: fn(),
    sections: {
      getKey: (row) => row.department,
      renderHeader: ({ key, rows }) => (
        <div className="story-section"><strong>{key}</strong><span>{rows.length} loaded</span></div>
      ),
    },
    slots: {
      headerEnd: <button className="story-toolbar-button" type="button">Export</button>,
      footerEnd: ({ resetPreferences }) => (
        <button className="story-toolbar-button" onClick={resetPreferences} type="button">Reset columns</button>
      ),
    },
    tableId: "storybook-kitchen-sink",
    totalCount: people.length,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole("searchbox", { name: "Search records" });
    await userEvent.type(search, "Ada");
    await expect(search).toHaveValue("Ada");
    await expect(canvas.getByText(/Ada/)).toBeVisible();
  },
};

export const NoVirtualizationForSmallData: Story = {
  args: {
    data: people.slice(0, 5),
    maxVisibleRows: 8,
    totalCount: 5,
    virtualize: false,
  },
};
