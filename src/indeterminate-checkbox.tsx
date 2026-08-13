import * as React from "react";

export interface IndeterminateCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  indeterminate?: boolean;
}

export function IndeterminateCheckbox({
  checked,
  className,
  disabled,
  indeterminate = false,
  ...props
}: IndeterminateCheckboxProps) {
  const reference = React.useRef<HTMLInputElement>(null);
  const state = indeterminate ? "indeterminate" : checked ? "checked" : "unchecked";

  React.useEffect(() => {
    if (reference.current) reference.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span
      className={["jt-check", className].filter(Boolean).join(" ")}
      data-disabled={disabled || undefined}
      data-state={state}
    >
      <input
        {...props}
        aria-checked={indeterminate ? "mixed" : undefined}
        checked={checked}
        className="jt-check__input"
        disabled={disabled}
        ref={reference}
        type="checkbox"
      />
      <span aria-hidden="true" className="jt-check__visual">
        {indeterminate ? (
          <svg
            aria-hidden="true"
            className="jt-check__icon jt-check__icon--indeterminate"
            viewBox="0 0 24 24"
          >
            <path d="M5 12h14" />
          </svg>
        ) : checked ? (
          <svg
            aria-hidden="true"
            className="jt-check__icon jt-check__icon--checked"
            viewBox="0 0 24 24"
          >
            <path d="M4 11l5 5L20 6" pathLength={1} />
          </svg>
        ) : null}
      </span>
    </span>
  );
}
