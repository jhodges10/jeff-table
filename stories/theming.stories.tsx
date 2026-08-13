import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { DataGrid, type DataGridProps } from "../src";
import { defined } from "../src/test/defined";
import { type Person, people, personColumns } from "./fixtures";

function PersonGrid(props: DataGridProps<Person>) {
  return <DataGrid {...props} />;
}

const meta = {
  title: "DataGrid/Theming",
  component: PersonGrid,
  args: {
    columns: personColumns,
    data: people.slice(0, 18),
    getRowId: (row) => row.id,
    totalCount: 18,
  },
} satisfies Meta<typeof PersonGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkTheme: Story = {
  args: {
    enableColumnVisibility: true,
    theme: {
      accent: "#a78bfa",
      background: "#111827",
      border: "#374151",
      foreground: "#f9fafb",
      headerBackground: "#1f2937",
      hover: "#1f2937",
      muted: "#253047",
      mutedForeground: "#9ca3af",
      selected: "#312e81",
      shadow: "0 16px 40px rgb(0 0 0 / .25)",
    },
  },
  render: (args) => (
    <div className="story-theme-card">
      <PersonGrid {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nameHeader = canvas.getByRole("columnheader", { name: /Name/ });
    const nameCell = defined(canvas.getAllByRole("gridcell", { name: "Ada Lovelace" })[0]);
    const balanceHeader = canvas.getByRole("columnheader", { name: /Balance/ });
    const balanceCell = canvas.getByRole("gridcell", { name: "$1,250.00" });

    await expect(getComputedStyle(nameHeader).paddingInlineStart).toBe(
      getComputedStyle(nameCell).paddingInlineStart,
    );
    await expect(getComputedStyle(balanceHeader).paddingInlineEnd).toBe(
      getComputedStyle(balanceCell).paddingInlineEnd,
    );
  },
};

export const BrandTheme: Story = {
  args: {
    enableGlobalFilter: true,
    theme: {
      accent: "#0f766e",
      border: "#99f6e4",
      headerBackground: "#f0fdfa",
      hover: "#f0fdfa",
      muted: "#ccfbf1",
      radius: "1rem",
      selected: "#ccfbf1",
      shadow: "0 12px 32px rgb(15 118 110 / .12)",
    },
  },
};

export const TailwindClassOverrides: Story = {
  args: {
    classNames: {
      columnHeader: "story-tailwind-header",
      root: "story-tailwind-root",
      row: "story-tailwind-row",
    },
    enableColumnVisibility: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Every major surface accepts a class slot. In a consuming Tailwind app these values can be utility classes; Storybook uses equivalent local classes so this package does not force a Tailwind runtime dependency.",
      },
    },
  },
};

export const DensityVariants: Story = {
  render: (args) => (
    <div className="story-density-stack">
      {(["compact", "comfortable", "spacious"] as const).map((density) => (
        <section key={density}>
          <h3>{density}</h3>
          <PersonGrid
            {...args}
            data={people.slice(0, 4)}
            density={density}
            totalCount={4}
            virtualize={false}
          />
        </section>
      ))}
    </div>
  ),
};
