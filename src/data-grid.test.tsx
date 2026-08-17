import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataGrid } from "./data-grid";
import type { DataGridColumnDef } from "./features";
import { defined } from "./test/defined";
import type { DataGridPreferences } from "./types";

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

function mockViewportOverflow(box: {
  clientHeight: number;
  clientWidth: number;
  scrollHeight: number;
  scrollWidth: number;
}) {
  const isViewport = (element: HTMLElement) => element.classList.contains("jt-grid__viewport");
  const spies = [
    vi
      .spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockImplementation(function viewportHeight(this: HTMLElement) {
        return isViewport(this) ? box.clientHeight : 0;
      }),
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function viewportWidth(
      this: HTMLElement,
    ) {
      return isViewport(this) ? box.clientWidth : 0;
    }),
    vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockImplementation(function viewportScrollHeight(this: HTMLElement) {
        return isViewport(this) ? box.scrollHeight : 0;
      }),
    vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockImplementation(function viewportScrollWidth(this: HTMLElement) {
        return isViewport(this) ? box.scrollWidth : 0;
      }),
  ];
  return () => {
    for (const spy of spies) spy.mockRestore();
  };
}

interface FilterRecord {
  active: boolean;
  amount: number;
  date: string;
  id: string;
  status: string;
  tags: string[];
}

const filterRows: FilterRecord[] = [
  {
    active: true,
    amount: 75,
    date: "2026-06-01",
    id: "a",
    status: "Active",
    tags: ["Red", "Blue"],
  },
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
    const { container } = render(
      <DataGrid columns={columns} data={rows} totalCount={3} virtualize={false} />,
    );
    const grid = screen.getByRole("grid", { name: "Data grid" });
    const rowsViewport = defined(document.querySelector<HTMLElement>('[data-slot="viewport"]'));
    const header = screen.getByRole("columnheader", { name: /Name/ });
    const headerViewport = container.querySelector('[data-slot="column-header-viewport"]');
    const headerCanvas = container.querySelector<HTMLElement>(".jt-grid__header-canvas");

    expect(header).toBeVisible();
    expect(screen.getByText("Ada Lovelace")).toBeVisible();
    expect(screen.getByText("3 records")).toBeVisible();
    expect(grid).toContainElement(headerViewport as HTMLElement);
    expect(grid).toContainElement(rowsViewport);
    expect(rowsViewport).toContainElement(screen.getByText("Ada Lovelace"));
    expect(rowsViewport).not.toContainElement(header);

    fireEvent.scroll(rowsViewport, { target: { scrollLeft: 90 } });
    expect(headerCanvas?.style.transform).toBe("translate3d(-90px, 0, 0)");
  });

  it("uses the rows canvas width for the separately rendered column headers", () => {
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function mockGridBounds(this: HTMLElement) {
        const width = this.classList.contains("jt-grid__rows-canvas") ? 980 : 1000;
        return {
          bottom: 0,
          height: 0,
          left: 0,
          right: width,
          toJSON: () => ({}),
          top: 0,
          width,
          x: 0,
          y: 0,
        };
      });

    try {
      const { container } = render(
        <DataGrid columns={columns} data={rows} totalCount={3} virtualize={false} />,
      );
      const headerCanvas = container.querySelector<HTMLElement>(".jt-grid__header-canvas");
      const rowsCanvas = container.querySelector<HTMLElement>(".jt-grid__rows-canvas");

      expect(rowsCanvas?.getBoundingClientRect().width).toBe(980);
      expect(headerCanvas?.style.width).toBe("980px");
    } finally {
      getBoundingClientRect.mockRestore();
    }
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

  it("provides a section selection slot that selects its selectable nested rows", async () => {
    const user = userEvent.setup();
    render(
      <DataGrid
        columns={columns}
        data={rows}
        enableRowSelection
        getRowId={(row) => row.id}
        sections={{
          getKey: (row) => row.team,
          renderHeader: ({ key }) => `Group ${key}`,
          renderSelection: ({ checked, indeterminate, key, toggle }) => (
            <button
              aria-label={`Toggle group ${key}`}
              aria-pressed={checked}
              data-indeterminate={indeterminate}
              onClick={() => toggle()}
              type="button"
            />
          ),
        }}
        totalCount={3}
        virtualize={false}
      />,
    );

    const groupASelection = screen.getByRole("button", { name: "Toggle group A" });
    await user.click(screen.getByRole("checkbox", { name: "Select row 1" }));
    expect(groupASelection).toHaveAttribute("data-indeterminate", "true");

    const groupASelectionCell = groupASelection.closest<HTMLElement>(".jt-grid__section-selection");
    expect(groupASelectionCell).not.toBeNull();
    await user.click(defined(groupASelectionCell));
    expect(groupASelection).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Select row 1" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select row 2" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select row 3" })).not.toBeChecked();
    expect(screen.getByText("2 selected")).toBeVisible();
  });

  it("keeps the active section sticky while virtualized and hands off to the next group", async () => {
    const offsetHeight = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(240);
    const groupedRows: TestPerson[] = Array.from({ length: 40 }, (_, index) => ({
      email: `person-${index}@example.com`,
      id: String(index),
      name: `Person ${index}`,
      team: index < 20 ? "A" : "B",
    }));
    try {
      const { container } = render(
        <DataGrid
          columns={columns}
          data={groupedRows}
          height={240}
          overscan={0}
          rowHeight={40}
          sections={{
            getKey: (row) => row.team,
            headerHeight: 40,
            renderHeader: ({ key }) => `Group ${key}`,
          }}
          totalCount={groupedRows.length}
        />,
      );
      const viewport = defined(container.querySelector<HTMLElement>('[data-slot="viewport"]'));
      const groupA = (await screen.findByText("Group A")).closest('[data-slot="section-header"]');
      expect(groupA).toHaveAttribute("data-sticky", "true");
      const firstNestedRow = container.querySelector<HTMLElement>('[data-row-id="0"]');
      expect(firstNestedRow?.style.position).toBe("absolute");
      expect(firstNestedRow?.style.top).toBe("0px");
      expect(firstNestedRow?.style.transform).toBe("translateY(40px)");

      Object.defineProperty(viewport, "scrollTop", { configurable: true, value: 850 });
      fireEvent.scroll(viewport);

      await waitFor(() => {
        const groupB = screen.getByText("Group B").closest('[data-slot="section-header"]');
        expect(groupB).toHaveAttribute("data-sticky", "true");
        expect(screen.queryByText("Group A")).not.toBeInTheDocument();
      });
    } finally {
      offsetHeight.mockRestore();
    }
  });

  it("shows deterministic skeleton rows for an initial load", () => {
    const { container, rerender } = render(
      <DataGrid
        columns={columns}
        data={[]}
        isLoading
        skeletonRowCount={4}
        totalCount={100}
        virtualize={false}
      />,
    );
    const firstWidths = [...container.querySelectorAll<HTMLElement>(".jt-skeleton")].map(
      (element) => element.style.width,
    );
    expect(firstWidths).toHaveLength(12);
    rerender(
      <DataGrid
        columns={columns}
        data={[]}
        isLoading
        skeletonRowCount={4}
        totalCount={100}
        virtualize={false}
      />,
    );
    expect(
      [...container.querySelectorAll<HTMLElement>(".jt-skeleton")].map(
        (element) => element.style.width,
      ),
    ).toEqual(firstWidths);
  });

  it("puts the loading indicator immediately beside the record count", () => {
    render(
      <DataGrid columns={columns} data={rows} isLoadingMore totalCount={100} virtualize={false} />,
    );
    const count = screen.getByText(/3 of 100 records/);
    expect(count.nextElementSibling).toHaveClass("jt-loading-indicator");
    expect(within(count.nextElementSibling as HTMLElement).getByRole("status")).toBeVisible();
  });

  it("keeps the loading indicator visible for 1.5 seconds before fading it out", async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <DataGrid
          columns={columns}
          data={rows}
          isLoadingMore
          totalCount={100}
          virtualize={false}
        />,
      );
      const status = screen.getByRole("status", { name: "Loading" });
      const indicator = status.closest(".jt-loading-indicator");
      expect(indicator).toHaveAttribute("data-state", "visible");

      rerender(<DataGrid columns={columns} data={rows} totalCount={100} virtualize={false} />);
      await act(() => vi.advanceTimersByTimeAsync(1_499));
      expect(indicator).toHaveAttribute("data-state", "visible");

      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(indicator).toHaveAttribute("data-state", "exiting");
      expect(status).toBeInTheDocument();

      await act(() => vi.advanceTimersByTimeAsync(200));
      expect(status).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("client-filters from the global search", async () => {
    const user = userEvent.setup();
    render(
      <DataGrid
        columns={columns}
        data={rows}
        enableGlobalFilter
        totalCount={3}
        virtualize={false}
      />,
    );
    await user.type(screen.getByRole("searchbox", { name: "Search records" }), "Grace");
    expect(screen.getByText("Grace Hopper")).toBeVisible();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("shares filter state between the Compflow-style header popover and toolbar menu", async () => {
    const user = userEvent.setup();
    render(
      <DataGrid
        columns={columns}
        data={rows}
        enableColumnFiltering
        totalCount={3}
        virtualize={false}
      />,
    );
    const nameTrigger = screen.getByLabelText("Filter name");
    expect(screen.queryByRole("searchbox", { name: "Filter value" })).not.toBeInTheDocument();
    await user.click(nameTrigger);
    await user.type(screen.getByRole("searchbox", { name: "Filter value" }), "Margaret");
    await waitFor(() => {
      expect(screen.getByText("Margaret Hamilton")).toBeVisible();
      expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument();
    });

    await user.click(nameTrigger);
    const menuTrigger = screen.getByLabelText("Column filters");
    expect(within(menuTrigger).getByText("1")).toBeVisible();
    await user.click(menuTrigger);
    const menu = menuTrigger.closest("details");
    expect(menu).not.toBeNull();
    expect(within(menu as HTMLElement).getByText("1 active")).toBeVisible();
    await user.click(
      within(menu as HTMLElement).getByRole("button", { name: "Clear all filters" }),
    );
    expect(screen.getByText("Grace Hopper")).toBeVisible();
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

    const status = screen.getByLabelText("Filter status");
    await user.click(status);
    const statusDetails = status.closest("details");
    expect(statusDetails).not.toBeNull();
    await user.click(within(statusDetails as HTMLElement).getByRole("button", { name: "Active" }));
    expect(screen.getByText("75")).toBeVisible();
    expect(screen.queryByText("25")).not.toBeInTheDocument();
    await user.click(status);
    await user.click(
      within(statusDetails as HTMLElement).getByRole("button", { name: "Clear filter" }),
    );

    const active = screen.getByLabelText("Filter active");
    await user.click(active);
    const activeDetails = active.closest("details");
    expect(activeDetails).not.toBeNull();
    await user.click(within(activeDetails as HTMLElement).getByRole("button", { name: "Yes" }));
    expect(screen.getByText("75")).toBeVisible();
    await user.click(active);
    await user.click(
      within(activeDetails as HTMLElement).getByRole("button", { name: "Clear filter" }),
    );

    const tagsSummary = screen.getByLabelText("Filter tags");
    await user.click(tagsSummary);
    const tagsDetails = tagsSummary.closest("details");
    expect(tagsDetails).not.toBeNull();
    const redFilter = within(tagsDetails as HTMLElement).getByRole("checkbox", { name: "Red" });
    expect(redFilter).toHaveClass("jt-check__input");
    expect(redFilter.closest(".jt-check")).toHaveAttribute("data-state", "unchecked");
    await user.click(redFilter);
    expect(tagsDetails).not.toHaveAttribute("open");
    expect(screen.queryByRole("checkbox", { name: "Red" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
    expect(screen.getByText("75")).toBeVisible();

    const amountSummary = screen.getByLabelText("Filter amount");
    await user.click(amountSummary);
    const amountDetails = amountSummary.closest("details");
    const minimum = within(amountDetails as HTMLElement).getByRole("spinbutton", {
      name: "Minimum",
    });
    await user.type(minimum, "50");
    expect(screen.getByText("75")).toBeVisible();

    const dateSummary = screen.getByLabelText("Filter date");
    await user.click(dateSummary);
    expect(screen.getByRole("group", { name: "Choose date range" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(dateSummary).toHaveAttribute("data-active", "true");
    expect(within(dateSummary).getByText("2")).toBeVisible();
  });

  it("sorts client-side through an accessible header button", async () => {
    const user = userEvent.setup();
    render(
      <DataGrid
        columns={columns}
        data={[defined(rows[1]), defined(rows[0])]}
        totalCount={2}
        virtualize={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Name/ }));
    const renderedNames = screen
      .getAllByRole("gridcell")
      .map((cell) => cell.textContent)
      .filter((value) => value?.includes("Lovelace") || value?.includes("Hopper"));
    expect(renderedNames).toEqual(["Ada Lovelace", "Grace Hopper"]);
  });

  it("shows and hides columns from the pinned far-right menu", async () => {
    const user = userEvent.setup();
    render(
      <DataGrid
        columns={columns}
        data={rows}
        enableColumnVisibility
        totalCount={3}
        virtualize={false}
      />,
    );
    await user.click(screen.getByLabelText("Show or hide columns"));
    await user.click(screen.getByLabelText("Email"));
    expect(screen.queryByRole("columnheader", { name: /Email/ })).not.toBeInTheDocument();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
  });

  it("keeps only one grid popover open at a time", async () => {
    const user = userEvent.setup();
    render(
      <DataGrid
        columns={columns}
        data={rows}
        enableColumnFiltering
        enableColumnVisibility
        totalCount={3}
        virtualize={false}
      />,
    );

    const inlineFilter = screen.getByLabelText("Filter name").closest("details");
    const filtersMenu = screen.getByLabelText("Column filters").closest("details");
    const columnsMenu = screen.getByLabelText("Show or hide columns").closest("details");

    expect(inlineFilter).not.toBeNull();
    expect(filtersMenu).not.toBeNull();
    expect(columnsMenu).not.toBeNull();
    expect(inlineFilter).toHaveAttribute("name", filtersMenu?.getAttribute("name"));
    expect(columnsMenu).toHaveAttribute("name", filtersMenu?.getAttribute("name"));

    await user.click(screen.getByLabelText("Filter name"));
    expect(inlineFilter).toHaveAttribute("open");

    await user.click(screen.getByLabelText("Show or hide columns"));
    expect(columnsMenu).toHaveAttribute("open");
    expect(inlineFilter).not.toHaveAttribute("open");
    expect(screen.getByRole("group", { name: "Columns" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Email" })).toHaveClass("jt-check__input");

    await user.click(screen.getByLabelText("Column filters"));
    expect(filtersMenu).toHaveAttribute("open");
    expect(columnsMenu).not.toHaveAttribute("open");
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
    fireEvent.click(defined(checkboxes[0]));
    fireEvent.click(defined(checkboxes[2]), { shiftKey: true });
    expect(checkboxes.every((checkbox) => (checkbox as HTMLInputElement).checked)).toBe(true);
    expect(onSelectionChange).toHaveBeenLastCalledWith({ "1": true, "2": true, "3": true }, rows);
  });

  it("uses the entire row selection cell as the click target without firing the row", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataGrid
        columns={columns}
        data={rows}
        enableRowSelection
        getRowId={(row) => row.id}
        onRowClick={onRowClick}
        totalCount={3}
        virtualize={false}
      />,
    );
    const rowCheckbox = screen.getByRole("checkbox", { name: "Select row 1" });
    const selectionCell = rowCheckbox.closest<HTMLElement>(".jt-grid__selection-cell");

    await user.click(defined(selectionCell));

    expect(rowCheckbox).toBeChecked();
    expect(onRowClick).not.toHaveBeenCalled();
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
      <DataGrid
        columns={columns}
        data={rows}
        enableColumnReordering
        totalCount={3}
        virtualize={false}
      />,
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
      <DataGrid
        columns={columns}
        data={rows}
        enableColumnReordering
        totalCount={3}
        virtualize={false}
      />,
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

  it("resizes columns during the drag and keeps header and body tracks aligned", () => {
    render(
      <DataGrid
        columns={columns}
        data={rows}
        enableColumnResizing
        preferenceStorage={null}
        totalCount={3}
        virtualize={false}
      />,
    );
    const header = screen.getByRole("columnheader", { name: /Name/ });
    const headerRow = header.parentElement as HTMLElement;
    const bodyRow = screen.getByText("Ada Lovelace").closest("[role=row]") as HTMLElement;
    const resizeHandle = screen.getByRole("button", { name: "Resize name column" });
    const resizeIndicator = resizeHandle.querySelector(".jt-grid__resize-indicator");

    expect(headerRow.style.gridTemplateColumns).toBe("180px 220px 100px");
    expect(resizeHandle).not.toHaveAttribute("data-resizing");
    expect(resizeHandle).toHaveAttribute("draggable", "false");
    expect(resizeIndicator).toHaveAttribute("aria-hidden", "true");
    fireEvent.mouseDown(resizeHandle, { clientX: 180 });
    expect(resizeHandle).toHaveAttribute("data-resizing", "true");
    fireEvent.mouseMove(document, { clientX: 240 });

    expect(headerRow.style.gridTemplateColumns).toBe("240px 220px 100px");
    expect(bodyRow.style.gridTemplateColumns).toBe(headerRow.style.gridTemplateColumns);
    fireEvent.mouseUp(document, { clientX: 240 });
    expect(resizeHandle).not.toHaveAttribute("data-resizing");
    expect(headerRow.style.gridTemplateColumns).toBe("240px 220px 100px");

    fireEvent.mouseMove(document, { clientX: 300 });
    expect(headerRow.style.gridTemplateColumns).toBe("240px 220px 100px");
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
    const selectAllCell = selectAll.closest<HTMLElement>(".jt-grid__selection-cell");
    fireEvent.click(defined(selectAllCell));
    expect(
      screen
        .getAllByRole("checkbox", { name: /Select row/ })
        .every((item) => (item as HTMLInputElement).checked),
    ).toBe(true);
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

  it("leaves theme defaults to CSS and only applies explicit theme overrides inline", () => {
    const { rerender } = render(
      <DataGrid columns={columns} data={rows} totalCount={3} virtualize={false} />,
    );
    const grid = screen.getByTestId("data-grid");

    expect(grid.style.getPropertyValue("--jt-accent")).toBe("");
    expect(grid.style.getPropertyValue("--jt-background")).toBe("");

    rerender(
      <DataGrid
        columns={columns}
        data={rows}
        theme={{ accent: "oklch(0.6 0.2 250)" }}
        totalCount={3}
        virtualize={false}
      />,
    );

    expect(grid.style.getPropertyValue("--jt-accent")).toBe("oklch(0.6 0.2 250)");
    expect(grid.style.getPropertyValue("--jt-background")).toBe("");
  });

  it("sizes the row canvas from the column tracks, not from row content", () => {
    // jsdom lays nothing out, so rows only exist here without virtualization.
    // The real layout consequence is covered by a browser story test.
    const { container } = render(
      <DataGrid columns={columns} data={rows} totalCount={3} virtualize={false} />,
    );
    const sizer = defined(container.querySelector<HTMLElement>('[data-slot="track-sizer"]'));
    const row = defined(container.querySelector<HTMLElement>("[data-row-id]"));
    const headerRow = defined(container.querySelector<HTMLElement>(".jt-grid__column-header-row"));

    // Virtualized rows are absolutely positioned and contribute nothing to the
    // canvas's intrinsic width. The sizer is the one in-flow element that does,
    // and it must carry exactly the same tracks as the rows and the header.
    expect(sizer.style.gridTemplateColumns).toBe(row.style.gridTemplateColumns);
    expect(sizer.style.gridTemplateColumns).toBe(headerRow.style.gridTemplateColumns);
    expect(sizer.children).toHaveLength(columns.length);
    expect(sizer).toHaveAttribute("aria-hidden", "true");
  });

  it("gives the track sizer a cell for the selection column too", () => {
    const { container } = render(
      <DataGrid
        columns={columns}
        data={rows}
        enableRowSelection
        getRowId={(row) => row.id}
        totalCount={3}
      />,
    );
    const sizer = defined(container.querySelector<HTMLElement>('[data-slot="track-sizer"]'));

    expect(sizer.children).toHaveLength(columns.length + 1);
    expect(sizer.style.gridTemplateColumns.startsWith("44px ")).toBe(true);
  });

  it("carries a column's minWidth into its CSS track", () => {
    const flexibleColumns: DataGridColumnDef<TestPerson>[] = [
      { accessorKey: "name", header: "Name", meta: { minWidth: 220, width: "1.5fr" } },
      {
        accessorKey: "email",
        header: "Email",
        meta: { width: "minmax(300px, 2fr)", minWidth: 90 },
      },
      { accessorKey: "team", header: "Team", meta: { width: "100px" } },
    ];
    const { container } = render(<DataGrid columns={flexibleColumns} data={rows} totalCount={3} />);
    const sizer = defined(container.querySelector<HTMLElement>('[data-slot="track-sizer"]'));

    // Without this a flexible track floors at zero and the column disappears
    // the moment the viewport is narrower than the table.
    expect(sizer.style.gridTemplateColumns).toBe("minmax(220px, 1.5fr) minmax(300px, 2fr) 100px");
  });

  it("keeps the grid role's children valid for assistive technology", () => {
    const { container } = render(
      <DataGrid
        columns={columns}
        data={rows}
        enableColumnVisibility
        totalCount={3}
        virtualize={false}
      />,
    );
    const grid = screen.getByRole("grid", { name: "Data grid" });

    // A grid may only own rows and rowgroups. The column menu is a `details`
    // element and the viewport is focusable, so neither may sit inside it.
    expect(container.querySelector(".jt-grid__column-tools")).not.toBeNull();
    expect(grid.querySelector(".jt-grid__column-tools")).toBeNull();
    expect(grid.querySelectorAll('[role="rowgroup"]')).toHaveLength(2);
    for (const rowgroup of grid.querySelectorAll('[role="rowgroup"]')) {
      expect(rowgroup.querySelector('[role="row"]')).not.toBeNull();
    }
    // The scrollable viewport stays keyboard reachable without taking a role
    // that ARIA forbids between a grid and its rows.
    const viewport = defined(container.querySelector<HTMLElement>('[data-slot="viewport"]'));
    expect(viewport.tabIndex).toBe(0);
    expect(viewport).toHaveAttribute("role", "rowgroup");
    expect(screen.getByTestId("data-grid")).toHaveAttribute("data-scrollbar", "overlay");
    expect(grid.querySelector('[data-slot="overlay-scrollbars"]')).toBeNull();
    expect(container.querySelector('[data-slot="overlay-scrollbars"]')).not.toBeNull();
  });

  it("overlays inset scrollbars when the rows overflow", () => {
    const restore = mockViewportOverflow({
      clientHeight: 200,
      clientWidth: 400,
      scrollHeight: 800,
      scrollWidth: 400,
    });
    try {
      const { container } = render(
        <DataGrid columns={columns} data={rows} totalCount={3} virtualize={false} />,
      );
      const grid = screen.getByRole("grid", { name: "Data grid" });
      const vertical = defined(
        container.querySelector<HTMLElement>('[data-slot="overlay-scrollbar-vertical"]'),
      );
      const thumb = defined(
        vertical.querySelector<HTMLElement>(".jt-grid__overlay-scrollbar-thumb"),
      );
      const viewport = defined(container.querySelector<HTMLElement>('[data-slot="viewport"]'));

      expect(grid.contains(vertical)).toBe(false);
      expect(screen.getByTestId("data-grid")).toHaveAttribute("data-scrollbar", "overlay");
      expect(vertical.hidden).toBe(false);
      expect(
        container.querySelector<HTMLElement>('[data-slot="overlay-scrollbar-horizontal"]')?.hidden,
      ).toBe(true);
      expect(thumb.style.height).toBe("48px");

      viewport.scrollTop = 300;
      fireEvent.scroll(viewport);
      expect(thumb.style.transform).toBe("translate3d(0, 72px, 0)");
    } finally {
      restore();
    }
  });

  it("keeps native viewport scrollbars when configured", () => {
    const restore = mockViewportOverflow({
      clientHeight: 200,
      clientWidth: 400,
      scrollHeight: 800,
      scrollWidth: 400,
    });
    try {
      const { container } = render(
        <DataGrid
          columns={columns}
          data={rows}
          scrollbar="native"
          totalCount={3}
          virtualize={false}
        />,
      );

      expect(screen.getByTestId("data-grid")).toHaveAttribute("data-scrollbar", "native");
      expect(container.querySelector('[data-slot="overlay-scrollbars"]')).toBeNull();
    } finally {
      restore();
    }
  });

  it("renders empty and error states as rows so the rowgroup stays valid", () => {
    const { rerender } = render(
      <DataGrid columns={columns} data={[]} emptyMessage="Nothing here." totalCount={0} />,
    );
    expect(screen.getByText("Nothing here.")).toHaveAttribute("role", "gridcell");
    expect(screen.getByText("Nothing here.").closest('[role="row"]')).not.toBeNull();

    rerender(
      <DataGrid columns={columns} data={[]} error={new Error("Service down.")} totalCount={0} />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Service down.");
    expect(alert.closest('[role="gridcell"]')).not.toBeNull();
    expect(alert.closest('[role="row"]')).not.toBeNull();
  });

  it("clears stored preferences on reset instead of saving the defaults back", async () => {
    const user = userEvent.setup();
    const store = new Map<string, DataGridPreferences>();
    const storage = {
      load: (tableId: string) => store.get(tableId),
      remove: vi.fn((tableId: string) => {
        store.delete(tableId);
      }),
      save: vi.fn((tableId: string, preferences: DataGridPreferences) => {
        store.set(tableId, preferences);
      }),
    };

    render(
      <DataGrid
        columns={columns}
        data={rows}
        enableColumnVisibility
        preferenceStorage={storage}
        slots={{
          footerEnd: ({ resetPreferences }) => (
            <button onClick={resetPreferences} type="button">
              Reset
            </button>
          ),
        }}
        tableId="reset-test"
        totalCount={3}
        virtualize={false}
      />,
    );

    await user.click(screen.getByLabelText("Show or hide columns"));
    await user.click(screen.getByRole("checkbox", { name: "Email" }));
    expect(store.get("reset-test")?.columnVisibility.email).toBe(false);

    await user.click(screen.getByRole("button", { name: "Reset" }));

    // Storage is empty, not repopulated: a saved copy of today's defaults would
    // outrank whatever defaults the app ships tomorrow.
    expect(storage.remove).toHaveBeenCalledWith("reset-test");
    expect(store.has("reset-test")).toBe(false);
    expect(screen.getByRole("columnheader", { name: /Email/ })).toBeVisible();
  });

  it("inherits the host colour scheme until one is pinned", () => {
    const { rerender } = render(
      <DataGrid columns={columns} data={rows} totalCount={3} virtualize={false} />,
    );
    const grid = screen.getByTestId("data-grid");

    // No attribute means `color-scheme` inherits, so a grid dropped into a dark
    // app follows it without the consumer wiring anything up.
    expect(grid).not.toHaveAttribute("data-color-scheme");

    for (const scheme of ["dark", "light", "system"] as const) {
      rerender(
        <DataGrid
          colorScheme={scheme}
          columns={columns}
          data={rows}
          totalCount={3}
          virtualize={false}
        />,
      );
      expect(grid).toHaveAttribute("data-color-scheme", scheme);
    }

    rerender(
      <DataGrid
        colorScheme="inherit"
        columns={columns}
        data={rows}
        totalCount={3}
        virtualize={false}
      />,
    );
    expect(grid).not.toHaveAttribute("data-color-scheme");
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
