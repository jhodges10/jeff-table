import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataGrid, reconcileColumnOrder } from "../src";
import {
  BENCHMARK_COLUMN_COUNT,
  BENCHMARK_ROW_HEIGHT,
  BENCHMARK_VIEWPORT,
  benchmarkColumns,
  createCounters,
  makeBenchmarkRows,
  recordBenchmark,
  renderBenchmark,
  TOP_WINDOW_ROWS,
} from "./harness";

const ROW_HEIGHT = BENCHMARK_ROW_HEIGHT;
const ROW_COUNT = 5_000;

describe("data work", () => {
  it("evaluates a column filter once per row per committed value", () => {
    const counters = createCounters();
    const rows = makeBenchmarkRows(ROW_COUNT);
    const columns = benchmarkColumns(counters);
    const grid = renderBenchmark(
      <DataGrid
        columnFilters={[]}
        columns={columns}
        data={rows}
        enableColumnFiltering
        getRowId={(row) => row.id}
        height={BENCHMARK_VIEWPORT.height}
        preferenceStorage={null}
        rowHeight={ROW_HEIGHT}
        totalCount={ROW_COUNT}
      />,
      counters,
    );

    const before = counters.filterEvaluations;
    grid.rerender(
      <DataGrid
        columnFilters={[{ id: "name", value: "Lovelace" }]}
        columns={columns}
        data={rows}
        enableColumnFiltering
        getRowId={(row) => row.id}
        height={BENCHMARK_VIEWPORT.height}
        preferenceStorage={null}
        rowHeight={ROW_HEIGHT}
        totalCount={ROW_COUNT}
      />,
    );
    const evaluations = counters.filterEvaluations - before;

    recordBenchmark({
      name: "filter/single-column-pass",
      metrics: {
        filterEvaluations: evaluations,
        filterEvaluationsPerRow: Number((evaluations / ROW_COUNT).toFixed(3)),
        rowElements: grid.rowElements(),
      },
      budgets: {
        filterEvaluations: ROW_COUNT * 1.5,
        filterEvaluationsPerRow: 1.5,
        rowElements: TOP_WINDOW_ROWS,
      },
      floors: { filterEvaluations: ROW_COUNT, rowElements: 1 },
      notes:
        "One pass over the row model per committed filter value. More than one evaluation per row means the filtered row model is rebuilt more than once for a single change.",
    });
  });

  it("sorts with a comparison count in the n log n band", () => {
    const counters = createCounters();
    const grid = renderBenchmark(
      <DataGrid
        columns={benchmarkColumns(counters)}
        data={makeBenchmarkRows(ROW_COUNT)}
        getRowId={(row) => row.id}
        height={BENCHMARK_VIEWPORT.height}
        preferenceStorage={null}
        rowHeight={ROW_HEIGHT}
        totalCount={ROW_COUNT}
      />,
      counters,
    );

    const before = counters.comparisons;
    const sortButton = [...grid.grid.querySelectorAll<HTMLElement>(".jt-grid__sort-button")].find(
      (button) => button.textContent?.includes("Balance"),
    );
    expect(sortButton).toBeDefined();
    if (!sortButton) return;
    fireEvent.click(sortButton);

    const comparisons = counters.comparisons - before;
    const nLogN = ROW_COUNT * Math.log2(ROW_COUNT);

    recordBenchmark({
      name: "sort/first-toggle",
      metrics: {
        comparisons,
        comparisonsPerNLogN: Number((comparisons / nLogN).toFixed(3)),
        rowElements: grid.rowElements(),
      },
      // The exact comparison count belongs to the engine's sort implementation,
      // so the budget is a band around n log n rather than a fixed number.
      budgets: {
        comparisons: Math.ceil(nLogN * 1.2),
        comparisonsPerNLogN: 1.2,
        rowElements: TOP_WINDOW_ROWS,
      },
      floors: { comparisons: ROW_COUNT, rowElements: 1 },
      notes: "Sorting runs once per committed sorting state, not once per rendered row.",
    });
  });

  it("keeps global search proportional to the loaded rows, not the total count", () => {
    const counters = createCounters();
    const grid = renderBenchmark(
      <DataGrid
        columns={benchmarkColumns(counters)}
        data={makeBenchmarkRows(ROW_COUNT)}
        enableGlobalFilter
        getRowId={(row) => row.id}
        height={BENCHMARK_VIEWPORT.height}
        preferenceStorage={null}
        rowHeight={ROW_HEIGHT}
        totalCount={1_000_000}
      />,
      counters,
    );

    const search = grid.grid.querySelector<HTMLInputElement>('.jt-search input[type="search"]');
    expect(search).not.toBeNull();
    if (!search) return;

    const beforeCells = counters.cellRenders;
    const beforeCommits = counters.commits;
    const query = "Lovelace";
    for (let length = 1; length <= query.length; length += 1) {
      fireEvent.change(search, { target: { value: query.slice(0, length) } });
    }

    recordBenchmark({
      name: "search/eight-keystrokes",
      metrics: {
        cellRendersPerKeystroke: Number(
          ((counters.cellRenders - beforeCells) / query.length).toFixed(2),
        ),
        commitsPerKeystroke: Number(((counters.commits - beforeCommits) / query.length).toFixed(2)),
        rowElements: grid.rowElements(),
      },
      budgets: {
        cellRendersPerKeystroke: TOP_WINDOW_ROWS * BENCHMARK_COLUMN_COUNT,
        commitsPerKeystroke: 2,
        rowElements: TOP_WINDOW_ROWS,
      },
      floors: { cellRendersPerKeystroke: 1, rowElements: 1 },
      notes:
        "A 1,000,000 totalCount with 5,000 loaded rows costs exactly what the loaded page costs.",
    });
  });

  it("reconciles stored column order in a single pass", () => {
    const columnIds = Array.from({ length: 200 }, (_, index) => `column-${index}`);
    const storedOrder = [...columnIds].reverse().slice(0, 150);
    let columnReads = 0;
    const observed = new Proxy(columnIds, {
      get(target, key) {
        if (typeof key === "string" && /^\d+$/.test(key)) columnReads += 1;
        return Reflect.get(target, key);
      },
    });

    const order = reconcileColumnOrder(observed, storedOrder);

    recordBenchmark({
      name: "preferences/reconcile-column-order",
      metrics: { columnReads, resultLength: order.length },
      budgets: { columnReads: columnIds.length * 3, resultLength: columnIds.length },
      floors: { columnReads: columnIds.length, resultLength: columnIds.length },
      notes: "Linear in the number of columns; never quadratic over the stored order.",
    });
    expect(order).toHaveLength(columnIds.length);
  });

  it("groups sections in one pass over the row model", () => {
    const counters = createCounters();
    const rowCount = 2_000;
    let sectionKeyReads = 0;
    const grid = renderBenchmark(
      <DataGrid
        columns={benchmarkColumns(counters)}
        data={makeBenchmarkRows(rowCount)}
        getRowId={(row) => row.id}
        height={BENCHMARK_VIEWPORT.height}
        preferenceStorage={null}
        rowHeight={ROW_HEIGHT}
        sections={{
          getKey: (row) => {
            sectionKeyReads += 1;
            return row.department;
          },
          renderHeader: ({ key }) => key,
        }}
        totalCount={rowCount}
      />,
      counters,
    );

    recordBenchmark({
      name: "sections/group-2k-rows",
      metrics: {
        sectionKeyReads,
        sectionKeyReadsPerRow: Number((sectionKeyReads / rowCount).toFixed(2)),
        rowElements: grid.rowElements(),
        domNodes: grid.domNodes(),
      },
      budgets: {
        sectionKeyReads: rowCount * 1.5,
        sectionKeyReadsPerRow: 1.5,
        rowElements: TOP_WINDOW_ROWS,
        domNodes: 260,
      },
      floors: { sectionKeyReads: rowCount, rowElements: 1 },
      notes: "Grouping is memoised on the row model, so re-renders reuse it.",
    });
  });
});
