import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataGrid } from "../src";
import {
  BENCHMARK_COLUMN_COUNT,
  BENCHMARK_OVERSCAN,
  BENCHMARK_ROW_HEIGHT,
  BENCHMARK_VIEWPORT,
  type BenchmarkCounters,
  benchmarkColumns,
  createCounters,
  MOUNT_RENDER_PASSES,
  makeBenchmarkRows,
  recordBenchmark,
  renderBenchmark,
  SCROLLED_WINDOW_ROWS,
  TOP_WINDOW_CELLS,
  TOP_WINDOW_ROWS,
} from "./harness";

/**
 * The benchmark setup pins the measured viewport (see `benchmarks/setup.ts`),
 * so the rendered window is a fixed 600px tall on every machine and every count
 * below is reproducible rather than layout-dependent.
 */
const VIEWPORT_HEIGHT = BENCHMARK_VIEWPORT.height;
const ROW_HEIGHT = BENCHMARK_ROW_HEIGHT;
const OVERSCAN = BENCHMARK_OVERSCAN;
/** Budgets are the modelled cost, not a rounded guess at it. */
const MOUNT_CELL_BUDGET = TOP_WINDOW_CELLS * MOUNT_RENDER_PASSES;

function mountGrid(rowCount: number, counters: BenchmarkCounters) {
  const rows = makeBenchmarkRows(rowCount);
  return renderBenchmark(
    <DataGrid
      columns={benchmarkColumns(counters)}
      data={rows}
      getRowId={(row) => row.id}
      height={VIEWPORT_HEIGHT}
      overscan={OVERSCAN}
      preferenceStorage={null}
      rowHeight={ROW_HEIGHT}
      totalCount={rowCount}
    />,
    counters,
  );
}

describe("rendering work", () => {
  it("renders a fixed row window regardless of how much data is loaded", () => {
    const small = createCounters();
    const large = createCounters();
    const smallGrid = mountGrid(1_000, small);
    const smallRows = smallGrid.rowElements();
    const smallCells = small.cellRenders;
    const smallNodes = smallGrid.domNodes();
    smallGrid.container.remove();

    const largeGrid = mountGrid(50_000, large);

    recordBenchmark({
      name: "mount/1k-rows",
      metrics: {
        rowElements: smallRows,
        cellRenders: smallCells,
        domNodes: smallNodes,
        commits: small.commits,
      },
      budgets: {
        rowElements: TOP_WINDOW_ROWS,
        cellRenders: MOUNT_CELL_BUDGET,
        domNodes: 260,
        commits: MOUNT_RENDER_PASSES,
      },
      floors: { rowElements: TOP_WINDOW_ROWS, cellRenders: TOP_WINDOW_CELLS, commits: 1 },
    });

    recordBenchmark({
      name: "mount/50k-rows",
      metrics: {
        rowElements: largeGrid.rowElements(),
        cellRenders: large.cellRenders,
        domNodes: largeGrid.domNodes(),
        commits: large.commits,
      },
      budgets: {
        rowElements: TOP_WINDOW_ROWS,
        cellRenders: MOUNT_CELL_BUDGET,
        domNodes: 260,
        commits: MOUNT_RENDER_PASSES,
      },
      floors: { rowElements: TOP_WINDOW_ROWS, cellRenders: TOP_WINDOW_CELLS, commits: 1 },
      notes: "Must match the 1k scenario exactly: virtualization is O(viewport), not O(rows).",
    });

    // The invariant that matters more than any single budget.
    expect(largeGrid.rowElements()).toBe(smallRows);
    expect(large.cellRenders).toBe(smallCells);
    expect(largeGrid.domNodes()).toBe(smallNodes);
  });

  it("renders a bounded amount of new work per scroll step", () => {
    const counters = createCounters();
    const grid = mountGrid(10_000, counters);
    const viewport = grid.grid.querySelector<HTMLElement>('[data-slot="viewport"]');
    expect(viewport).not.toBeNull();
    if (!viewport) return;

    const mountedCells = counters.cellRenders;
    const mountedCommits = counters.commits;
    const steps = 20;
    for (let step = 1; step <= steps; step += 1) {
      viewport.scrollTop = step * VIEWPORT_HEIGHT;
      fireEvent.scroll(viewport);
    }

    const cellsPerStep = (counters.cellRenders - mountedCells) / steps;
    const commitsPerStep = (counters.commits - mountedCommits) / steps;

    recordBenchmark({
      name: "scroll/one-viewport-per-step",
      metrics: {
        cellRendersPerStep: cellsPerStep,
        commitsPerStep,
        rowElements: grid.rowElements(),
        domNodes: grid.domNodes(),
      },
      budgets: {
        cellRendersPerStep: SCROLLED_WINDOW_ROWS * BENCHMARK_COLUMN_COUNT,
        commitsPerStep: 2,
        rowElements: SCROLLED_WINDOW_ROWS,
        domNodes: 340,
      },
      floors: { cellRendersPerStep: 1, rowElements: TOP_WINDOW_ROWS },
      notes: "A step jumps a full viewport, so the whole window is legitimately replaced.",
    });
  });

  it("keeps the committed DOM flat as columns and chrome are added", () => {
    const plain = createCounters();
    const plainGrid = mountGrid(1_000, plain);
    const plainNodes = plainGrid.domNodes();
    plainGrid.container.remove();

    const decorated = createCounters();
    const grid = renderBenchmark(
      <DataGrid
        columns={benchmarkColumns(decorated)}
        data={makeBenchmarkRows(1_000)}
        enableColumnFiltering
        enableColumnResizing
        enableColumnVisibility
        enableGlobalFilter
        enableRowSelection
        getRowId={(row) => row.id}
        height={VIEWPORT_HEIGHT}
        overscan={OVERSCAN}
        preferenceStorage={null}
        rowHeight={ROW_HEIGHT}
        totalCount={1_000}
      />,
      decorated,
    );

    recordBenchmark({
      name: "mount/every-feature-enabled",
      metrics: {
        rowElements: grid.rowElements(),
        cellRenders: decorated.cellRenders,
        domNodes: grid.domNodes(),
        domNodesAddedByChrome: grid.domNodes() - plainNodes,
        commits: decorated.commits,
      },
      budgets: {
        rowElements: TOP_WINDOW_ROWS,
        cellRenders: MOUNT_CELL_BUDGET,
        domNodes: 470,
        domNodesAddedByChrome: 240,
        commits: MOUNT_RENDER_PASSES,
      },
      floors: {
        rowElements: TOP_WINDOW_ROWS,
        cellRenders: TOP_WINDOW_CELLS,
        domNodesAddedByChrome: 1,
      },
      notes: "Filters, resize handles, selection, and menus are per-column, never per-row.",
    });
  });

  it("re-renders only the visible window when one row is selected", () => {
    const counters = createCounters();
    const grid = renderBenchmark(
      <DataGrid
        columns={benchmarkColumns(counters)}
        data={makeBenchmarkRows(10_000)}
        enableRowSelection
        getRowId={(row) => row.id}
        height={VIEWPORT_HEIGHT}
        overscan={OVERSCAN}
        preferenceStorage={null}
        rowHeight={ROW_HEIGHT}
        totalCount={10_000}
      />,
      counters,
    );

    const beforeCells = counters.cellRenders;
    const beforeCommits = counters.commits;
    const checkbox = grid.grid.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    if (!checkbox) return;
    fireEvent.click(checkbox);

    recordBenchmark({
      name: "selection/toggle-one-row",
      metrics: {
        cellRenders: counters.cellRenders - beforeCells,
        commits: counters.commits - beforeCommits,
      },
      budgets: { cellRenders: TOP_WINDOW_CELLS, commits: 2 },
      floors: { cellRenders: 1, commits: 1 },
      notes: "Selection state lives on the table instance, so unrendered rows cost nothing.",
    });
  });
});
