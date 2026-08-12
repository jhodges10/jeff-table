import type { Preview } from "@storybook/react-vite";
import "../src/styles.css";
import "../stories/storybook.css";

const preview: Preview = {
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
