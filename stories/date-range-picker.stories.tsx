import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { DateRangePicker, DateRangePickerPanel } from "../src";

interface DateRangeDemoProps {
  initialFrom?: string;
  initialTo?: string;
  panel?: boolean;
  placeholder?: string;
}

function DateRangeDemo({ initialFrom, initialTo, panel, placeholder }: DateRangeDemoProps) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const pickerProps = {
    ...(from ? { from } : {}),
    onChange: (next: { from?: string; to?: string }) => {
      setFrom(next.from);
      setTo(next.to);
    },
    ...(to ? { to } : {}),
  };

  return (
    <div className="story-date-range-demo">
      {panel ? (
        <DateRangePickerPanel {...pickerProps} />
      ) : (
        <DateRangePicker {...pickerProps} {...(placeholder ? { placeholder } : {})} />
      )}
      <code data-testid="date-range-value">
        from={from ?? "—"} · to={to ?? "—"}
      </code>
    </div>
  );
}

const meta = {
  title: "DataGrid/Components/Date Range Picker",
  component: DateRangeDemo,
  parameters: { layout: "centered" },
} satisfies Meta<typeof DateRangeDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { placeholder: "Order date" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Order date/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Last 7 days" }));
    await expect(canvas.getByTestId("date-range-value")).not.toHaveTextContent("from=—");
  },
};

export const Prefilled: Story = {
  args: { initialFrom: "2026-04-01", initialTo: "2026-04-30" },
};

export const SingleDay: Story = {
  args: { initialFrom: "2026-05-12", initialTo: "2026-05-12" },
};

export const EmbeddedPanel: Story = {
  args: { initialFrom: "2026-04-01", initialTo: "2026-04-30", panel: true },
};
