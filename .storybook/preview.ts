import type { Preview } from "@storybook/react-vite";
import { createElement } from "react";
import "../src/styles.css";
import "../stories/storybook.css";

const preview: Preview = {
  decorators: [
    (Story, context) =>
      createElement(
        "main",
        { "aria-label": `${context.title}: ${context.name}` },
        createElement("h1", { className: "jt-sr-only" }, `${context.title}: ${context.name}`),
        createElement(Story),
      ),
  ],
  parameters: {
    controls: { expanded: true },
    layout: "padded",
    a11y: { test: "todo" },
    options: {
      storySort: {
        order: ["DataGrid", ["Overview", "Features", "States", "Theming"]],
      },
    },
  },
};

export default preview;
