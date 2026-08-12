import * as React from "react";

export interface IndeterminateCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  indeterminate?: boolean;
}

export function IndeterminateCheckbox({
  indeterminate = false,
  ...props
}: IndeterminateCheckboxProps) {
  const reference = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (reference.current) reference.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return <input {...props} ref={reference} type="checkbox" />;
}
