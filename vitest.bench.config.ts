import { defineConfig } from "vitest/config";

/**
 * Benchmarks are ordinary Vitest runs that assert counted work rather than
 * elapsed time (see `benchmarks/harness.tsx`). They stay out of `bun run test`
 * so the unit suite keeps its coverage thresholds and its speed.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    globalSetup: ["./benchmarks/global-setup.ts"],
    setupFiles: ["./benchmarks/setup.ts"],
    include: ["benchmarks/**/*.bench.test.{ts,tsx}"],
    // Results are appended to one report, and the scenarios are heavy enough
    // that running them side by side only adds noise.
    fileParallelism: false,
  },
});
