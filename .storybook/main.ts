import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.@(ts|tsx)"],
  staticDirs: ["../public"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (viteConfig) => {
    // The published stylesheet is copied verbatim, so it keeps `light-dark()`.
    // Storybook's build minifies CSS, and at the default target Lightning CSS
    // lowers `light-dark()` into variables that only resolve where it also
    // emitted a `color-scheme` rule — which is not how the shipped CSS behaves.
    // Targeting the browsers that support it natively keeps the demo honest.
    viteConfig.build = {
      ...viteConfig.build,
      cssTarget: ["chrome123", "edge123", "firefox120", "safari17.5"],
    };

    viteConfig.plugins = viteConfig.plugins?.filter(
      (plugin) =>
        !(
          typeof plugin === "object" &&
          plugin !== null &&
          "name" in plugin &&
          plugin.name === "inject-library-css"
        ),
    );

    return viteConfig;
  },
};

export default config;
