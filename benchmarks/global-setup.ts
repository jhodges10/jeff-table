import { rmSync } from "node:fs";
import { resolve } from "node:path";

/** Starts every run from an empty ledger so stale scenarios cannot linger. */
export default function setup(): void {
  rmSync(resolve(process.cwd(), "benchmarks/report.jsonl"), { force: true });
}
