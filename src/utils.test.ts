import { describe, expect, it } from "vitest";
import { matchesColumnFilter, matchesGlobalFilter } from "./filtering";
import { parseDataGridPreferences } from "./preferences";
import type { DataGridNumberFormat } from "./types";
import {
  calculateViewportHeight,
  deterministicSkeletonWidth,
  formatNumberValue,
  maskNumberText,
  moveColumn,
  parseNumberText,
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

describe("number formatting", () => {
  const usd: DataGridNumberFormat = { currency: "USD", locale: "en-US" };
  const plain: DataGridNumberFormat = { locale: "en-US", maximumFractionDigits: 2 };

  it("writes a value the way the column writes it", () => {
    expect(formatNumberValue(usd, 40_845)).toBe("$40,845.00");
    expect(formatNumberValue(plain, 1234.5)).toBe("1,234.5");
    expect(formatNumberValue(usd, undefined)).toBe("");
    expect(formatNumberValue(usd, "not a number")).toBe("");
  });

  it("keeps a partly typed number in the column's own shape", () => {
    expect(maskNumberText(usd, "49000")).toBe("$49,000");
    expect(maskNumberText(usd, "49000.5")).toBe("$49,000.5");
    // The fraction is left as typed: reformatting to the minimum digits on
    // every keystroke would make the field impossible to type into.
    expect(maskNumberText(usd, "$40,845.00")).toBe("$40,845.00");
    expect(maskNumberText(usd, "-1234")).toBe("-$1,234");
    expect(maskNumberText(usd, "")).toBe("");
    expect(maskNumberText(usd, "abc")).toBe("");
  });

  it("caps the fraction at what the format will show", () => {
    expect(maskNumberText(usd, "1.239")).toBe("$1.23");
  });

  it("reads back what it wrote", () => {
    expect(parseNumberText(usd, "$40,845.00")).toBe(40_845);
    expect(parseNumberText(usd, "$49,000")).toBe(49_000);
    expect(parseNumberText(usd, "-$1,234.50")).toBe(-1234.5);
    expect(parseNumberText(usd, "")).toBeUndefined();
    expect(parseNumberText(usd, "$")).toBeUndefined();
  });

  it("round-trips a locale that groups and decimalises differently", () => {
    const euro: DataGridNumberFormat = { currency: "EUR", locale: "de-DE" };
    const written = formatNumberValue(euro, 1234.5);
    expect(parseNumberText(euro, written)).toBe(1234.5);
    expect(maskNumberText(euro, written)).toBe(written);
  });
});
