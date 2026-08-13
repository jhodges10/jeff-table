import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataGrid, type DataGridProps } from "../src";
import { type Person, people, personColumns } from "./fixtures";

function PersonGrid(props: DataGridProps<Person>) {
  return <DataGrid {...props} />;
}

const meta = {
  title: "DataGrid/States",
  component: PersonGrid,
  args: {
    columns: personColumns,
    data: people.slice(0, 30),
    getRowId: (row) => row.id,
    totalCount: 30,
  },
} satisfies Meta<typeof PersonGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InitialSkeletonRows: Story = {
  args: {
    data: [],
    isLoading: true,
    skeletonRowCount: 9,
    totalCount: 250,
  },
};

export const RefreshingLoadedRows: Story = {
  args: {
    isLoading: true,
    slots: {
      footerEnd: <span>Refreshing this saved view…</span>,
    },
  },
};

export const LoadingMoreWithVirtualPlaceholders: Story = {
  args: {
    data: people.slice(0, 18),
    isLoadingMore: true,
    totalCount: 2_500,
  },
};

export const CustomLoadingIndicator: Story = {
  args: {
    isLoadingMore: true,
    slots: {
      loadingIndicator: (
        <span aria-label="Loading" role="status">
          Fetching…
        </span>
      ),
    },
    totalCount: 300,
  },
};

export const Empty: Story = {
  args: {
    data: [],
    emptyMessage: "No people match this view.",
    totalCount: 0,
  },
};

export const CustomEmptySlot: Story = {
  args: {
    data: [],
    slots: {
      empty: ({ resetPreferences }) => (
        <div>
          <strong>Nothing to show</strong>
          <p>Try resetting the saved columns and filters.</p>
          <button className="story-toolbar-button" onClick={resetPreferences} type="button">
            Reset view
          </button>
        </div>
      ),
    },
    totalCount: 0,
  },
};

export const ErrorState: Story = {
  args: {
    data: [],
    error: new Error("The people service did not respond."),
    totalCount: 0,
  },
};
