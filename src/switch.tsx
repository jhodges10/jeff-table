import type * as React from "react";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

/**
 * A boolean toggle built the same way as `IndeterminateCheckbox`: a real
 * checkbox carries the state and the keyboard, and a sibling span draws it.
 *
 * Inside an editable grid the *cell* is the tab stop, so the grid passes
 * `tabIndex={-1}` — the input stays in the accessibility tree and keeps
 * announcing its state, it just does not add a second stop per row.
 */
export function Switch({ checked, className, disabled, ...props }: SwitchProps) {
  return (
    <span
      className={["jt-switch", className].filter(Boolean).join(" ")}
      data-disabled={disabled || undefined}
      data-state={checked ? "on" : "off"}
    >
      <input
        {...props}
        // A checkbox already maps `checked` onto `aria-checked`, but `role`
        // overrides the implicit mapping, so the switch has to state it.
        aria-checked={checked === true}
        checked={checked}
        className="jt-switch__input"
        disabled={disabled}
        role="switch"
        type="checkbox"
      />
      <span aria-hidden="true" className="jt-switch__visual">
        <span className="jt-switch__thumb" />
      </span>
    </span>
  );
}
