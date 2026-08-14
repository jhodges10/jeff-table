import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker, DateRangePickerPanel } from "./date-range-picker";
import { defined } from "./test/defined";

function localIso(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

describe("DateRangePicker", () => {
  it("formats empty, full-range, and single-day trigger labels", () => {
    const { rerender } = render(<DateRangePicker onChange={vi.fn()} placeholder="Order date" />);
    expect(screen.getByText("Order date")).toBeVisible();

    rerender(<DateRangePicker from="2026-04-01" onChange={vi.fn()} to="2026-04-30" />);
    expect(screen.getByText("Apr 1, 2026 – Apr 30, 2026")).toBeVisible();

    rerender(<DateRangePicker from="2026-05-12" onChange={vi.fn()} to="2026-05-12" />);
    expect(screen.getByText("May 12, 2026")).toBeVisible();
  });

  it("commits presets immediately and closes the standalone popover", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Pick a date range/ }));
    await user.click(screen.getByRole("button", { name: "Today" }));

    const today = localIso(new Date());
    expect(onChange).toHaveBeenCalledWith({ from: today, to: today });
    expect(screen.queryByRole("dialog", { name: "Date range picker" })).not.toBeInTheDocument();
  });

  it("refocuses the visible months to include the selected preset", async () => {
    const user = userEvent.setup();
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const followingMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    render(<DateRangePickerPanel onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Last month" }));

    expect(screen.getByText(monthLabel(lastMonth))).toBeVisible();
    expect(screen.getByText(monthLabel(followingMonth))).toBeVisible();
  });

  it("keeps calendar changes as a draft until Apply", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<DateRangePickerPanel onChange={onChange} />);
    const today = localIso(new Date());
    const day = container.querySelector<HTMLElement>(`[data-day="${today}"] button`);

    await user.click(defined(day));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onChange).toHaveBeenCalledWith({ from: today, to: today });
  });

  it("clears an existing range from the panel", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePickerPanel from="2026-04-01" onChange={onChange} to="2026-04-30" />);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith({});
  });
});
