import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/**
 * Runs every story's play function in a real browser, once per colour scheme.
 *
 * The two projects differ only in the `colorScheme` global the toolbar sets, so
 * dark mode is not a story someone has to remember to look at — the whole suite
 * is executed against it.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

const provider = playwright({
  ...(executablePath ? { launchOptions: { executablePath } } : {}),
});

async function schemeProject(scheme: "dark" | "light") {
  return {
    plugins: await storybookTest({
      configDir: ".storybook",
      initialGlobals: { colorScheme: scheme },
    }),
    test: {
      browser: {
        enabled: true,
        headless: true,
        provider,
        instances: [{ browser: "chromium" as const, name: `storybook:${scheme}` }],
      },
    },
  };
}

export default defineConfig({
  test: {
    projects: [await schemeProject("light"), await schemeProject("dark")],
  },
});
