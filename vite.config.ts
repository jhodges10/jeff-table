import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const libraryCssPath = resolve(import.meta.dirname, "src/styles.css");

const injectLibraryCss: Plugin = {
  name: "inject-library-css",
  generateBundle(_options, bundle) {
    this.emitFile({
      fileName: "styles.css",
      source: readFileSync(libraryCssPath, "utf8"),
      type: "asset",
    });
    for (const output of Object.values(bundle)) {
      if (output.type === "chunk" && output.isEntry) {
        output.code = `import "./styles.css";\n${output.code}`;
      }
    }
  },
};

export default defineConfig({
  plugins: [react(), injectLibraryCss],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@tanstack/react-table",
        "@tanstack/react-virtual",
      ],
      output: {
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
