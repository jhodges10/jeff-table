import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataGrid } from "./data-grid";
import type { DataGridColumnDef } from "./features";

interface TestPerson {
  id: string;
  name: string;
  email: string;
  team: "A" | "B";
}

const rows: TestPerson[] = [
  { id: "1", name: "Ada Lovelace", email: "ada@example.com", team: "A" },
  { id: "2", name: "Grace Hopper", email: "grace@example.com", team: "A" },
  { id: "3", name: "Margaret Hamilton", email: "margaret@example.com", team: "B" },
];

const columns: DataGridColumnDef<TestPerson>[] = [
  {
    accessorKey: "name",
    enableHiding: false,
    header: "Name",
    meta: { filter: { type: "text" }, width: "180px" },
  },
  {
    accessorKey: "email",
    header: "Email",
    meta: { skeleton: { minWidth: 40, maxWidth: 70 }, width: "220px" },
  },
  { accessorKey: "team", header: "Team", meta: { width: "100px" } },
];

interface FilterRecord {
  active: boolean;
  amount: number;
  date: string;
  id: string;
  status: string;
  tags: string[];
}

const filterRows: FilterRecord[] = [
  { active: true, amount: 75, date: "2026-06-01", id: "a", status: "Active", tags: ["Red", "Blue"] },
  { active: false, amount: 25, date: "2025-06-01", id: "b", status: "Paused", tags: ["Green"] },
];

const filterColumns: DataGridColumnDef<FilterRecord>[] = [
  {
    accessorKey: "status",
    header: "Status",
    meta: {
      filter: {
        options: [
          { label: "Active", value: "Active" },
          { label: "Paused", value: "Paused" },
        ],
        type: "single-select",
      },
    },
  },
  { accessorKey: "active", header: "Active", meta: { filter: { type: "boolean" } } },
  {
    accessorKey: "tags",
    header: "Tags",
    meta: {
      filter: {
        options: [
          { label: "Red", value: "Red" },
          { label: "Green", value: "Green" },
        ],
        type: "multi-select",
      },
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { filter: { min: 0, max: 100, step: 5, type: "number-range" } },
  },
  { accessorKey: "date", header: "Date", meta: { filter: { type: "date-range" } } },
];

describe("DataGrid", () => {
  it("renders typed data, headers, and the required total count", () => {
    render(<DataGrid columns={columns} data={rows} totalCount={3} virtualize={false} />);
    expect(screen.getByRole("columnheader", { name: /Name/ })).toBeVisible();
    expect(screen.getByText("Ada Lovelace")).toBeVisible();
    expect(screen.getByText("3 records")).toBeVisible();
  });

  it("renders section headers without changing the flat column contract", () => {
    render(
      <DataGrid
        columns={columns}
        data={rows}
        sections={{
          getKey: (row) => row.team,
          renderHeader: ({ key, rows: sectionRows }) => `${key}: ${sectionRows.length}`,
        }}
        totalCount={3}
        virtualize={false}
      />,
    );
    expect(screen.getByText("A: 2")).toBeVisible();
    expect(screen.getByText("B: 1")).toBeVisible();
  });

  it("shows deterministic skeleton rows for an initial load", () => {
    const { container, rerender } = render(
      <DataGrid columns={columns} data={[]} isLoading skeletonRowCount={4} totalCount={100} virtualize={false} />,
    );
    const firstWidths = [...container.querySelectorAll<HTMLElement>(".jt-skeleton")].map(
      (element) => element.style.width,
    );
    expect(firstWidths).toHaveLength(12);
    rerender(
      <DataGrid columns={columns} data={[]} isLoading skeletonRowCount={4} totalCount={100} virtualize={false} />,
    );
    expect([...container.querySelectorAll<HTMLElement>(".jt-skeleton")].map((element) => element.style.width))
      .toEqual(firstWidths);
  });

  it("puts the loading indicator immediately beside the record count", () => {
    render(<DataGrid columns={columns} data={rows} isLoadingMore totalCount={100} virtualize={false} />);
    const count = screen.getByText(/3 of 100 records/);
    expect(count.nextElementSibling).toHaveAttribute("role", "status");
  });

  it("client-filters from the global search", async () => {
    const user = userEvent.setup();
    render(
      <DataGrid columns={columns} data={rows} enableGlobalFilter totalCount={3} virtualize={false} />,
    );
    await user.type(screen.getByRole("searchbox", { name: "Search records" }), "Grace");
    expect(screen.getByText("Grace Hopper")).toBeVisible();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("uses the same state for inline filters", async () => {
    const user = userEvent.setup();
    render(
      <DataGrid columns={columns} data={rows} enableColumnFiltering totalCount={3} virtualize={false} />,
    );
    await user.type(screen.getByRole("searchbox", { name: "Filter name" }), "Margaret");
    expect(screen.getByText("Margaret Hamilton")).toBeVisible();
    expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument();
  });

  it("supports select, boolean, multi-select, number-range, and date-range filters", async () => {
    const user = userEvent.setup();
    render(
      <DataGrid
        columns={filterColumns}
        data={filterRows}
        enableColumnFiltering
        totalCount={2}
        virtualize={false}
      />,
    );

    const status = screen.getByRole("combobox", { name: "Filter status" });
    await user.selectOptions(status, "Active");
    expect(screen.getByText("75")).toBeVisible();
    expect(screen.queryByText("25")).not.toBeInTheDocument();
    await user.selectOptions(status, "");

    const active = screen.getByRole("combobox", { name: "Filter active" });
    await user.selectOptions(active, "true");
    expect(screen.getByText("75")).toBeVisible();
    await user.selectOptions(active, "");

    const tagsSummary = screen.getByLabelText("Filter tags");
    await user.click(tagsSummary);
    const tagsDetails = tagsSummary.closest("details");
    expect(tagsDetails).not.toBeNull();
    await user.click(within(tagsDetails as HTMLElement).getByRole("checkbox", { name: "Red" }));
    expect(screen.getByText("75")).toBeVisible();

    const amountSummary = screen.getByLabelText("Filter amount");
    await user.click(amountSummary);
    const amountDetails = amountSummary.closest("details");
    const minimum = within(amountDetails as HTMLElement).getByRole("spinbutton", { name: "Minimum" });
    await user.type(minimum, "50");
    expect(screen.getByText("75")).toBeVisible();

    const dateSummary = screen.getByLabelText("Filter date");
    await user.click(dateSummary);
    const dateDetails = dateSummary.closest("details");
    fireEvent.change(within(dateDetails as HTMLElement).getByLabelText("Start"), {
      target: { value: "2026-01-01" },
    });
    expect(screen.getByText("2026-06-01")).toBeVisible();
  });

  it("sorts client-side through an accessible header button", async () => {
    const user = userEvent.setup();
    render(<DataGrid columns={columns} data={[rows[1]!, rows[0]!]} totalCount={2} virtualize={false} />);
    await user.click(screen.getByRole("button", { name: /Name/ }));
    const renderedNames = screen.getAllByRole("gridcell")
      .map((cell) => cell.textContent)
      .filter((value) => value?.includes("Lovelace") || value?.includes("Hopper"));
    expect(renderedNames).toEqual(["Ada Lovelace", "Grace Hopper"]);
  });

  it("shows and hides columns from the pinned far-right menu", async () => {
    const user = userEvent.setup();
    render(
      <DataGrid columns={columns} data={rows} enableColumnVisibility totalCount={3} virtualize={false} />,
    );
    await user.click(screen.getByLabelText("Show or hide columns"));
    await user.click(screen.getByLabelText("Email"));
    expect(screen.queryByRole("columnheader", { name: /Email/ })).not.toBeInTheDocument();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
  });

  it("requires stable IDs for selection and supports v9 shift-range selection", () => {
    const onSelectionChange = vi.fn();
    render(
      <DataGrid
        columns={columns}
        data={rows}
        enableRowSelection
        getRowId={(row) => row.id}
        onRowSelectionChange={onSelectionChange}
        totalCount={3}
        virtualize={false}
      />,
    );
    const checkboxes = screen.getAllByRole("checkbox", { name: /Select row/ });
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[2]!, { shiftKey: true });
    expect(checkboxes.every((checkbox) => (checkbox as HTMLInputElement).checked)).toBe(true);
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      { "1": true, "2": true, "3": true },
      rows,
    );
  });

  it("disables selection through a row predicate", () => {
    render(
      <DataGrid
        columns={columns}
        data={rows}
        enableRowSelection
        getRowId={(row) => row.id}
        isRowSelectable={(row) => row.team === "A"}
        totalCount={3}
        virtualize={false}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Select row 3" })).toBeDisabled();
  });

  it("moves columns with the keyboard-accessible drag handle", () => {
    render(
      <DataGrid columns={columns} data={rows} enableColumnReordering totalCount={3} virtualize={false} />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Move name column" }), {
      altKey: true,
      key: "ArrowRight",
    });
    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent?.trim());
    expect(headers.slice(0, 3)).toEqual(["Email", "Name", "Team"]);
  });

  it("moves columns through native pointer drag-and-drop", () => {
    render(
      <DataGrid columns={columns} data={rows} enableColumnReordering totalCount={3} virtualize={false} />,
    );
    const transfer = {
      dropEffect: "none",
      effectAllowed: "none",
      setData: vi.fn(),
    };
    const source = screen.getByRole("button", { name: "Move email column" });
    const target = screen.getByRole("columnheader", { name: /Team/ });
    fireEvent.dragStart(source, { dataTransfer: transfer });
    fireEvent.dragOver(target, { clientX: 100, dataTransfer: transfer });
    fireEvent.drop(target, { clientX: 100, dataTransfer: transfer });
    fireEvent.dragEnd(source, { dataTransfer: transfer });
    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent?.trim());
    expect(headers.slice(0, 3)).toEqual(["Name", "Team", "Email"]);
    expect(transfer.setData).toHaveBeenCalledWith("text/plain", "email");
  });

  it("selects all loaded rows and reports an indeterminate state after one is cleared", () => {
    const { container } = render(
      <DataGrid
        columns={columns}
        data={rows}
        enableRowSelection
        getRowId={(row) => row.id}
        totalCount={3}
        virtualize={false}
      />,
    );
    const selectAll = screen.getByRole("checkbox", { name: "Select all loaded rows" });
    fireEvent.click(selectAll);
    expect(screen.getAllByRole("checkbox", { name: /Select row/ }).every((item) => (item as HTMLInputElement).checked))
      .toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 2" }));
    expect((selectAll as HTMLInputElement).indeterminate).toBe(true);
    expect(container.querySelector(".jt-grid__selection-count")).toHaveTextContent("2 selected");
  });

  it("renders independent header and footer slots", () => {
    render(
      <DataGrid
        columns={columns}
        data={rows}
        slots={{
          headerStart: <button type="button">Saved view</button>,
          headerEnd: <button type="button">Export</button>,
          footerEnd: ({ loadedCount }) => <span>Loaded {loadedCount}</span>,
        }}
        totalCount={3}
        virtualize={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Saved view" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Export" })).toBeVisible();
    expect(screen.getByText("Loaded 3")).toBeVisible();
  });

  it("loads more when virtualization approaches the loaded boundary", async () => {
    const onLoadMore = vi.fn();
    render(
      <DataGrid
        columns={columns}
        data={rows.slice(0, 2)}
        hasMore
        height={400}
        onLoadMore={onLoadMore}
        totalCount={100}
      />,
    );
    await waitFor(() =>
      expect(onLoadMore).toHaveBeenCalledWith({ loadedCount: 2, totalCount: 100 }),
    );
  });

  it("renders custom empty and error state slots", () => {
    const { rerender } = render(
      <DataGrid
        columns={columns}
        data={[]}
        slots={{ empty: <strong>Create the first record</strong> }}
        totalCount={0}
        virtualize={false}
      />,
    );
    expect(screen.getByText("Create the first record")).toBeVisible();
    rerender(
      <DataGrid
        columns={columns}
        data={[]}
        error={new Error("Offline")}
        slots={{ error: <strong>Try again later</strong> }}
        totalCount={0}
        virtualize={false}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Try again later");
  });
});
