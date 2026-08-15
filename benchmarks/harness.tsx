import { render } from "@testing-library/react";
import { Profiler, type ReactElement } from "react";
import { expect } from "vitest";
import type { DataGridColumnDef, DataGridRow } from "../src";

/**
 * Benchmarks here count *work*, never elapsed time.
 *
 * Wall-clock numbers depend on the machine, the other processes on it, and the
 * JIT's mood, so asserting on them produces a suite that fails for reasons
 * nobody can act on. Counting renders, committed DOM nodes, comparator calls,
 * and filter evaluations gives the same early warning — "this change made the
 * grid do more work per row" — with an identical answer on every machine.
 */

/**
 * jsdom reports every element as 0x0, and TanStack Virtual measures the scroll
 * element with `offsetWidth`/`offsetHeight`. The benchmark setup pins both to
 * these numbers so the rendered window is the same everywhere.
 */
export const BENCHMARK_VIEWPORT = { height: 600, width: 1_000 } as const;

/** Row height every scenario passes, so the window maths below is exact. */
export const BENCHMARK_ROW_HEIGHT = 44;
/** `overscan` the grid defaults to. */
export const BENCHMARK_OVERSCAN = 10;
/** Columns `benchmarkColumns()` returns. */
export const BENCHMARK_COLUMN_COUNT = 6;
/** Rows that fit the pinned viewport. */
export const VISIBLE_ROWS = Math.ceil(BENCHMARK_VIEWPORT.height / BENCHMARK_ROW_HEIGHT);
/** At scroll offset 0 there is no overscan above, only below. */
export const TOP_WINDOW_ROWS = VISIBLE_ROWS + BENCHMARK_OVERSCAN;
/** Mid-list there is overscan on both sides, plus one partially visible row. */
export const SCROLLED_WINDOW_ROWS = VISIBLE_ROWS + BENCHMARK_OVERSCAN * 2 + 1;
/**
 * Mount renders twice: once from the virtualizer's initial rect, then once more
 * after it measures the real scroll element. A third pass means something is
 * writing state during layout.
 */
export const MOUNT_RENDER_PASSES = 2;
/** Cell renders for one full pass over the window at scroll offset 0. */
export const TOP_WINDOW_CELLS = TOP_WINDOW_ROWS * BENCHMARK_COLUMN_COUNT;

export interface BenchmarkRow {
  balance: number;
  city: string;
  department: string;
  email: string;
  id: string;
  joined: string;
  name: string;
  status: string;
}

const FIRST_NAMES = ["Ada", "Grace", "Linus", "Margaret", "Edsger", "Barbara", "Donald", "Radia"];
const LAST_NAMES = ["Lovelace", "Hopper", "Torvalds", "Hamilton", "Dijkstra", "Liskov", "Knuth"];
const CITIES = ["Seattle", "Vancouver", "Portland", "Boston", "Austin"];
const DEPARTMENTS = ["Engineering", "Finance", "Operations", "Sales"];
const STATUSES = ["Active", "Invited", "Paused"];

function pick(values: readonly string[], index: number): string {
  return values[index % values.length] as string;
}

/** Deterministic fixture data: index-derived, never randomised. */
export function makeBenchmarkRows(count: number): BenchmarkRow[] {
  return Array.from({ length: count }, (_, index) => {
    const first = pick(FIRST_NAMES, index);
    const last = pick(LAST_NAMES, index * 3);
    return {
      balance: 1_250 + ((index * 7_919) % 98_000),
      city: pick(CITIES, index),
      department: pick(DEPARTMENTS, index),
      email: `${first}.${last}.${index}@example.com`.toLowerCase(),
      id: `row-${index + 1}`,
      joined: `20${20 + (index % 6)}-${String((index % 12) + 1).padStart(2, "0")}-${String(
        (index % 27) + 1,
      ).padStart(2, "0")}`,
      name: `${first} ${last}`,
      status: pick(STATUSES, index),
    };
  });
}

export interface BenchmarkCounters {
  /** Cell render functions invoked. */
  cellRenders: number;
  /** React commits of the grid subtree. */
  commits: number;
  /** Sort comparator invocations. */
  comparisons: number;
  /** Column filter predicate invocations. */
  filterEvaluations: number;
}

export function createCounters(): BenchmarkCounters {
  return { cellRenders: 0, commits: 0, comparisons: 0, filterEvaluations: 0 };
}

/**
 * Columns wired to a counter set. Every cell renders through a counting
 * function so "cells rendered" is measured rather than inferred from the DOM.
 */
export function benchmarkColumns(counters: BenchmarkCounters): DataGridColumnDef<BenchmarkRow>[] {
  const countingCell =
    (key: keyof BenchmarkRow) =>
    ({ row }: { row: DataGridRow<BenchmarkRow> }) => {
      counters.cellRenders += 1;
      return String(row.original[key]);
    };

  return [
    {
      accessorKey: "name",
      cell: countingCell("name"),
      enableHiding: false,
      header: "Name",
      meta: { filter: { placeholder: "Find a name…", type: "text" }, width: "200px" },
      filterFn: (row, columnId, value) => {
        counters.filterEvaluations += 1;
        return String(row.getValue(columnId))
          .toLowerCase()
          .includes(String(value ?? "").toLowerCase());
      },
    },
    {
      accessorKey: "email",
      cell: countingCell("email"),
      header: "Email",
      meta: { width: "260px" },
    },
    {
      accessorKey: "department",
      cell: countingCell("department"),
      header: "Department",
      meta: { width: "160px" },
    },
    {
      accessorKey: "city",
      cell: countingCell("city"),
      header: "City",
      meta: { width: "140px" },
    },
    {
      accessorKey: "balance",
      cell: countingCell("balance"),
      header: "Balance",
      meta: { cellAlign: "right", width: "140px" },
      sortFn: (left, right, columnId) => {
        counters.comparisons += 1;
        return Number(left.getValue(columnId)) - Number(right.getValue(columnId));
      },
    },
    {
      accessorKey: "status",
      cell: countingCell("status"),
      header: "Status",
      meta: { width: "120px" },
    },
  ];
}

export interface RenderedBenchmark {
  container: HTMLElement;
  counters: BenchmarkCounters;
  grid: HTMLElement;
  /** Data rows currently committed to the DOM (skeleton rows excluded). */
  rowElements: () => number;
  /** Every element inside the grid, including chrome. */
  domNodes: () => number;
  rerender: (element: ReactElement) => void;
}

/** Renders a grid wrapped in a Profiler so commits are counted, not guessed. */
export function renderBenchmark(
  element: ReactElement,
  counters: BenchmarkCounters,
): RenderedBenchmark {
  const withProfiler = (node: ReactElement) => (
    <Profiler
      id="benchmark"
      onRender={() => {
        counters.commits += 1;
      }}
    >
      {node}
    </Profiler>
  );

  const { container, rerender } = render(withProfiler(element));
  const grid = container.querySelector<HTMLElement>('[data-testid="data-grid"]');
  if (!grid) throw new Error("The benchmark grid did not render.");

  return {
    container,
    counters,
    grid,
    domNodes: () => grid.querySelectorAll("*").length,
    rowElements: () => grid.querySelectorAll("[data-row-id]").length,
    rerender: (next) => rerender(withProfiler(next)),
  };
}

export type BenchmarkMetrics = Record<string, number>;

export interface BenchmarkResult {
  /** Ceilings. A metric above its budget fails the run. */
  budgets: BenchmarkMetrics;
  /**
   * Floors. A scenario that renders nothing would otherwise sail under every
   * ceiling, so anything the benchmark depends on having happened belongs here.
   */
  floors?: BenchmarkMetrics;
  metrics: BenchmarkMetrics;
  name: string;
  notes?: string;
}

const results: BenchmarkResult[] = [];

export function collectedResults(): readonly BenchmarkResult[] {
  return results;
}

/**
 * Records a scenario and asserts every measured metric stays inside its budget.
 *
 * Budgets are ceilings, not targets: a metric coming in under budget is fine
 * and only worth tightening when the headroom stops being useful.
 */
export function recordBenchmark(result: BenchmarkResult): void {
  results.push(result);

  // `BENCH_REPORT_ONLY=1 bun run bench` prints the table without failing, which
  // is how you read the new numbers when you are deliberately re-baselining.
  if (process.env.BENCH_REPORT_ONLY) return;

  const overBudget = Object.entries(result.budgets)
    .filter(([metric, budget]) => (result.metrics[metric] ?? 0) > budget)
    .map(([metric, budget]) => `${metric}: ${result.metrics[metric]} > budget ${budget}`);
  expect(overBudget, `${result.name} exceeded its work budget`).toEqual([]);

  const underFloor = Object.entries(result.floors ?? {})
    .filter(([metric, floor]) => (result.metrics[metric] ?? 0) < floor)
    .map(([metric, floor]) => `${metric}: ${result.metrics[metric]} < floor ${floor}`);
  expect(underFloor, `${result.name} did not do the work it claims to measure`).toEqual([]);
}
