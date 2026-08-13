import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IndeterminateCheckbox } from "./indeterminate-checkbox";

describe("IndeterminateCheckbox", () => {
  it("uses the animated custom check treatment without replacing native input semantics", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <IndeterminateCheckbox aria-label="Select record" checked={false} onChange={onChange} />,
    );
    const input = screen.getByRole("checkbox", { name: "Select record" });
    const root = input.closest(".jt-check");

    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(root).toHaveAttribute("data-state", "unchecked");
    expect(container.querySelector(".jt-check__icon")).not.toBeInTheDocument();
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledOnce();

    rerender(<IndeterminateCheckbox aria-label="Select record" checked onChange={onChange} />);
    expect(root).toHaveAttribute("data-state", "checked");
    expect(container.querySelector(".jt-check__icon--checked path")).toHaveAttribute(
      "pathLength",
      "1",
    );

    rerender(
      <IndeterminateCheckbox aria-label="Select record" indeterminate onChange={onChange} />,
    );
    expect(input).toHaveProperty("indeterminate", true);
    expect(input).toHaveAttribute("aria-checked", "mixed");
    expect(root).toHaveAttribute("data-state", "indeterminate");
    expect(container.querySelector(".jt-check__icon--indeterminate")).toBeInTheDocument();
  });

  it("preserves the disabled state", () => {
    render(<IndeterminateCheckbox aria-label="Unavailable record" disabled />);
    const input = screen.getByRole("checkbox", { name: "Unavailable record" });
    expect(input).toBeDisabled();
    expect(input.closest(".jt-check")).toHaveAttribute("data-disabled", "true");
  });
});
