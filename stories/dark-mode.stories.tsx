import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties, ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DataGrid, type DataGridProps } from "../src";
import { defined } from "../src/test/defined";
import { contrastRatio, effectiveBackground, isDarkSurface } from "./contrast";
import { type Person, people, personColumns } from "./fixtures";

function PersonGrid(props: DataGridProps<Person>) {
  return <DataGrid {...props} />;
}

/** The class a Tailwind or shadcn/ui app puts on `<html>` for dark mode. */
function HostPage({ children, scheme }: { children: ReactNode; scheme: "dark" | "light" }) {
  return (
    <div className={`story-scheme-panel ${scheme}`} data-testid={`host-${scheme}`}>
      {children}
    </div>
  );
}

const meta = {
  title: "DataGrid/Dark Mode",
  component: PersonGrid,
  parameters: {
    docs: {
      description: {
        component:
          'Dark mode is a property of the page, not a prop. Every built-in token is a `light-dark()` pair keyed off `color-scheme`, so the grid follows its host — including the `.dark` and `[data-theme="dark"]` conventions — and `colorScheme` is only needed when a grid must differ from the page around it.',
      },
    },
  },
  args: {
    columns: personColumns,
    data: people.slice(0, 18),
    getRowId: (row) => row.id,
    totalCount: 18,
  },
} satisfies Meta<typeof PersonGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FollowsTheHostPage: Story = {
  args: {
    enableColumnFiltering: true,
    enableGlobalFilter: true,
    enableRowSelection: true,
  },
  render: (args) => (
    <HostPage scheme="dark">
      <h2>.dark host page</h2>
      <PersonGrid {...args} />
    </HostPage>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByTestId("data-grid");
    const styles = getComputedStyle(grid);

    // No prop was passed: the `.dark` ancestor alone flipped every token.
    await expect(grid).not.toHaveAttribute("data-color-scheme");
    await expect(isDarkSurface(styles.backgroundColor)).toBe(true);
    await expect(contrastRatio(styles.color, styles.backgroundColor)).toBeGreaterThanOrEqual(4.5);

    const header = defined(canvas.getAllByRole("columnheader", { name: /Name/ })[0]);
    await expect(
      contrastRatio(getComputedStyle(header).color, effectiveBackground(header)),
    ).toBeGreaterThanOrEqual(4.5);
  },
};

export const OverlaysStayLegible: Story = {
  args: {
    enableColumnFiltering: true,
    enableColumnVisibility: true,
  },
  render: (args) => (
    <HostPage scheme="dark">
      <h2>Popovers on a dark page</h2>
      <PersonGrid {...args} />
    </HostPage>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByTestId("data-grid");

    await userEvent.click(canvas.getByLabelText("Filter name"));
    const popover = await waitFor(() =>
      defined(canvasElement.querySelector<HTMLElement>(".jt-filter__popover")),
    );
    const popoverBackground = getComputedStyle(popover).backgroundColor;

    // An overlay has to lift off the grid it covers, not blend into it.
    await expect(isDarkSurface(popoverBackground)).toBe(true);
    await expect(popoverBackground).not.toBe(getComputedStyle(grid).backgroundColor);

    const search = canvas.getByRole("searchbox", { name: "Filter value" });
    await expect(
      contrastRatio(getComputedStyle(search).color, effectiveBackground(search)),
    ).toBeGreaterThanOrEqual(4.5);
    await userEvent.click(canvas.getByLabelText("Filter name"));
  },
};

export const PinnedAgainstTheHostPage: Story = {
  args: { colorScheme: "dark" },
  render: (args) => (
    <HostPage scheme="light">
      <h2>Light page, pinned dark grid</h2>
      <PersonGrid {...args} />
    </HostPage>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByTestId("data-grid");
    const host = canvas.getByTestId("host-light");

    await expect(grid).toHaveAttribute("data-color-scheme", "dark");
    await expect(isDarkSurface(getComputedStyle(grid).backgroundColor)).toBe(true);
    // The prop wins over the page in both directions.
    await expect(isDarkSurface(getComputedStyle(host).backgroundColor)).toBe(false);
  },
};

export const PinnedLightOnADarkPage: Story = {
  args: { colorScheme: "light" },
  render: (args) => (
    <HostPage scheme="dark">
      <h2>Dark page, pinned light grid</h2>
      <PersonGrid {...args} />
    </HostPage>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByTestId("data-grid");

    await expect(grid).toHaveAttribute("data-color-scheme", "light");
    await expect(isDarkSurface(getComputedStyle(grid).backgroundColor)).toBe(false);
  },
};

export const InheritsShadcnVariables: Story = {
  args: {
    enableGlobalFilter: true,
  },
  render: (args) => (
    <div
      className="story-scheme-panel dark"
      style={
        {
          // What a shadcn/ui app already defines. The grid reads these before it
          // reaches for any built-in value.
          "--background": "#131a2b",
          "--foreground": "#e8ecf6",
          "--border": "#2f3b52",
          "--muted": "#1b2436",
          "--muted-foreground": "#a4b0c4",
          "--primary": "#8ab4ff",
          "--radius": "0.35rem",
        } as CSSProperties
      }
    >
      <h2>Host app variables</h2>
      <PersonGrid {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByTestId("data-grid");
    const styles = getComputedStyle(grid);

    await expect(styles.backgroundColor).toBe("rgb(19, 26, 43)");
    await expect(styles.color).toBe("rgb(232, 236, 246)");
    await expect(styles.borderTopLeftRadius).toBe("5.6px");
    await expect(contrastRatio(styles.color, styles.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  },
};

export const SideBySide: Story = {
  args: { enableRowSelection: true },
  parameters: {
    docs: {
      description: {
        story:
          "Both schemes at once, which no host page can produce on its own — each grid pins `colorScheme` so the comparison holds however the toolbar is set.",
      },
    },
  },
  render: (args) => (
    <div className="story-scheme-grid">
      <HostPage scheme="light">
        <h2>Light</h2>
        <PersonGrid
          {...args}
          colorScheme="light"
          data={people.slice(0, 6)}
          totalCount={6}
          virtualize={false}
        />
      </HostPage>
      <HostPage scheme="dark">
        <h2>Dark</h2>
        <PersonGrid
          {...args}
          colorScheme="dark"
          data={people.slice(0, 6)}
          totalCount={6}
          virtualize={false}
        />
      </HostPage>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [light, dark] = canvas.getAllByTestId("data-grid");

    await expect(isDarkSurface(getComputedStyle(defined(light)).backgroundColor)).toBe(false);
    await expect(isDarkSurface(getComputedStyle(defined(dark)).backgroundColor)).toBe(true);
  },
};
