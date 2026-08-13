import { describe, expect, it } from "vitest";
import { matchesColumnFilter, matchesGlobalFilter } from "./filtering";
import { parseDataGridPreferences } from "./preferences";
import {
  calculateViewportHeight,
  deterministicSkeletonWidth,
  moveColumn,
  reconcileColumnOrder,
  resolveColumnDropTarget,
} from "./utils";

describe("data grid utilities", () => {
  it("reconciles removed, duplicate, and newly added columns", () => {
    expect(
      reconcileColumnOrder(["name", "status", "email"], ["status", "old", "status", "name"]),
    ).toEqual(["status", "name", "email"]);
  });

  it("moves a column on either side of a target", () => {
    expect(moveColumn(["a", "b", "c"], "a", "c", "right")).toEqual(["b", "c", "a"]);
    expect(moveColumn(["a", "b", "c"], "c", "a", "left")).toEqual(["c", "a", "b"]);
  });

  it("collapses adjacent drop areas to a single insertion edge", () => {
    expect(resolveColumnDropTarget(["a", "b", "c"], "b", true)).toEqual({ id: "a", side: "right" });
    expect(resolveColumnDropTarget(["a", "b", "c"], "a", true)).toEqual({ id: "a", side: "left" });
  });

  it("makes deterministic but varied skeleton widths", () => {
    const first = deterministicSkeletonWidth(4, "email");
    expect(deterministicSkeletonWidth(4, "email")).toBe(first);
    expect(deterministicSkeletonWidth(5, "email")).not.toBe(first);
    expect(first).toBeGreaterThanOrEqual(38);
    expect(first).toBeLessThanOrEqual(88);
  });

  it("caps the derived viewport at the visible row limit", () => {
    expect(calculateViewportHeight({ rowHeight: 40, totalCount: 100, maxVisibleRows: 10 })).toBe(
      440,
    );
    expect(calculateViewportHeight({ rowHeight: 40, totalCount: 2, maxVisibleRows: 10 })).toBe(120);
  });
});

describe("preference parsing", () => {
  it("accepts a complete preference document", () => {
    expect(
      parseDataGridPreferences(
        JSON.stringify({
          columnOrder: ["name"],
          columnSizing: { name: 220 },
          columnVisibility: { email: false },
        }),
      ),
    ).toEqual({
      columnOrder: ["name"],
      columnSizing: { name: 220 },
      columnVisibility: { email: false },
    });
  });

  it.each([
    undefined,
    "not-json",
    "[]",
    JSON.stringify({ columnOrder: [1], columnSizing: {}, columnVisibility: {} }),
    JSON.stringify({ columnOrder: [], columnSizing: { name: "wide" }, columnVisibility: {} }),
    JSON.stringify({ columnOrder: [], columnSizing: {}, columnVisibility: { name: "yes" } }),
  ])("rejects malformed preference input", (value) => {
    expect(parseDataGridPreferences(value)).toBeUndefined();
  });
});

describe("filter matching", () => {
  it("matches accent-insensitive text and fuzzy global queries", () => {
    expect(matchesColumnFilter("Montréal", "montreal", { type: "text" })).toBe(true);
    expect(matchesGlobalFilter("North Atlantic Technology", "nat")).toBe(true);
  });

  it("matches multi-select values", () => {
    const config = { type: "multi-select" as const };
    expect(matchesColumnFilter("Sales", ["Sales", "Finance"], config)).toBe(true);
    expect(matchesColumnFilter("Engineering", ["Sales"], config)).toBe(false);
  });

  it("matches select and boolean filters exactly", () => {
    expect(matchesColumnFilter("Active", "Active", { type: "single-select" })).toBe(true);
    expect(matchesColumnFilter("Paused", "Active", { type: "single-select" })).toBe(false);
    expect(matchesColumnFilter(true, "true", { type: "boolean" })).toBe(true);
  });

  it("matches inclusive number and date ranges", () => {
    expect(matchesColumnFilter(50, ["50", "100"], { type: "number-range" })).toBe(true);
    expect(matchesColumnFilter(101, ["50", "100"], { type: "number-range" })).toBe(false);
    expect(
      matchesColumnFilter("2026-06-15", ["2026-01-01", "2026-12-31"], { type: "date-range" }),
    ).toBe(true);
    expect(matchesColumnFilter("not-a-number", ["", ""], { type: "number-range" })).toBe(false);
    expect(matchesColumnFilter("not-a-date", ["2026-01-01", ""], { type: "date-range" })).toBe(
      false,
    );
  });
});
