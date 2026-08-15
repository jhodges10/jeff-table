import type { Preview } from "@storybook/react-vite";
import { createElement } from "react";
import "../src/styles.css";
import "../stories/storybook.css";

/**
 * The scheme toolbar toggles the class a host app would own, not a grid prop.
 * That is the point: with `colorScheme` left at its default the grid inherits
 * whatever the page declares, so flipping this control is the honest test of
 * dark mode.
 */
const preview: Preview = {
  globalTypes: {
    colorScheme: {
      description: "Colour scheme of the host page the grid is embedded in",
      toolbar: {
        title: "Scheme",
        icon: "sun",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    colorScheme: "light",
  },
  decorators: [
    (Story, context) => {
      const scheme = context.globals.colorScheme === "dark" ? "dark" : "light";
      return createElement(
        "main",
        {
          "aria-label": `${context.title}: ${context.name}`,
          className: `story-canvas ${scheme}`,
          "data-story-scheme": scheme,
        },
        createElement("h1", { className: "jt-sr-only" }, `${context.title}: ${context.name}`),
        createElement(Story),
      );
    },
  ],
  parameters: {
    controls: { expanded: true },
    layout: "padded",
    a11y: { test: "error" },
    options: {
      storySort: {
        order: [
          "DataGrid",
          ["Overview", "Features", "Components", "States", "Theming", "Dark Mode", "Performance"],
        ],
      },
    },
  },
};

export default preview;
