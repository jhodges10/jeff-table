import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { afterAll } from "vitest";
import "../src/test/setup";
import { BENCHMARK_VIEWPORT, collectedResults } from "./harness";

// jsdom lays nothing out, so the virtualizer would measure a 0px viewport and
// render an empty window. Pinning the layout box keeps the rendered row count
// identical on every machine, which is the whole premise of these numbers.
for (const [property, value] of [
  ["offsetHeight", BENCHMARK_VIEWPORT.height],
  ["offsetWidth", BENCHMARK_VIEWPORT.width],
] as const) {
  Object.defineProperty(HTMLElement.prototype, property, {
    configurable: true,
    get: () => value,
  });
}

export const REPORT_PATH = resolve(process.cwd(), "benchmarks/report.jsonl");

/**
 * Each benchmark file appends its own results as JSON lines, so files stay
 * independent and no run has to read what another wrote. `bun run bench`
 * truncates the file first (see `global-setup.ts`).
 */
afterAll(() => {
  const results = collectedResults();
  if (results.length === 0) return;

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  appendFileSync(
    REPORT_PATH,
    `${results.map((result) => JSON.stringify(result)).join("\n")}\n`,
    "utf8",
  );

  const rows = Object.fromEntries(
    results.map((result) => [
      result.name,
      Object.fromEntries(
        Object.entries(result.metrics).map(([metric, value]) => [
          metric,
          result.budgets[metric] === undefined ? value : `${value} / ${result.budgets[metric]}`,
        ]),
      ),
    ]),
  );
  console.table(rows);
});
