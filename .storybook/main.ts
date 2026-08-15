import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  staticDirs: ["../public"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (viteConfig) => {
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
