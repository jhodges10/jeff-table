import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createThemeStyle, dataGridThemeTokens } from "./theme";
import type { DataGridTheme } from "./types";

// Read as text rather than imported: the stylesheet is the contract under test,
// and Vitest strips CSS out of the module graph.
const stylesheet = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

/** Every `--jt-*` custom property the stylesheet declares (`--jt-name:`). */
const declaredTokens = new Set(
  [...stylesheet.matchAll(/(--jt-[a-z-]+)\s*:/g)].map(([, token]) => token as string),
);
/** Every `--jt-*` custom property the stylesheet reads (`var(--jt-name…)`). */
const referencedTokens = new Set(
  [...stylesheet.matchAll(/var\(\s*(--jt-[a-z-]+)/g)].map(([, token]) => token as string),
);

const themeKeys = Object.keys(dataGridThemeTokens) as (keyof DataGridTheme)[];

describe("design tokens", () => {
  it("maps every theme key to a distinct custom property", () => {
    const tokens = Object.values(dataGridThemeTokens);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("declares a default in the stylesheet for every themeable token", () => {
    const undeclared = themeKeys.filter((key) => !declaredTokens.has(dataGridThemeTokens[key]));
    expect(undeclared).toEqual([]);
  });

  it("reads every themeable token somewhere in the stylesheet", () => {
    // A token nothing consumes is a promise the theme prop cannot keep.
    const unused = themeKeys.filter((key) => !referencedTokens.has(dataGridThemeTokens[key]));
    expect(unused).toEqual([]);
  });

  it("declares every custom property the stylesheet reads", () => {
    // Guards against a typo in a `var()` silently falling back to nothing.
    // `--jt-cell-inline-padding` is deliberately undeclared: it is the pre-token
    // name kept readable so existing consumers keep working.
    const aliases = new Set(["--jt-cell-inline-padding"]);
    const undeclared = [...referencedTokens].filter(
      (token) => !declaredTokens.has(token) && !aliases.has(token),
    );
    expect(undeclared).toEqual([]);
  });

  it("gives every built-in colour a light and a dark value", () => {
    const scheme = ["dark", "light", "light dark"];
    for (const value of scheme) expect(stylesheet).toContain(`color-scheme: ${value};`);
    // The palette is expressed as light-dark() pairs rather than a duplicated
    // dark block, so a missing pair means a token that cannot follow the host.
    expect(stylesheet.match(/light-dark\(/g)?.length ?? 0).toBeGreaterThanOrEqual(12);
  });
});

describe("createThemeStyle", () => {
  it("returns the caller style untouched when no theme is supplied", () => {
    expect(createThemeStyle(undefined, { height: 400 })).toEqual({ height: 400 });
    expect(createThemeStyle(undefined, undefined)).toEqual({});
  });

  it("writes only the tokens the caller supplied", () => {
    const style = createThemeStyle({ accent: "#123456", radius: "1rem" }, { height: 400 });

    expect(style).toEqual({
      height: 400,
      "--jt-accent": "#123456",
      "--jt-radius": "1rem",
    });
  });

  it("supports every documented token", () => {
    const theme = Object.fromEntries(
      themeKeys.map((key) => [key, `value-${key}`]),
    ) as unknown as DataGridTheme;
    const style = createThemeStyle(theme, undefined) as Record<string, string>;

    for (const key of themeKeys) {
      expect(style[dataGridThemeTokens[key]]).toBe(`value-${key}`);
    }
  });

  it("lets caller styles keep custom properties the theme does not set", () => {
    const style = createThemeStyle({ accent: "#123456" }, {
      "--jt-row-accent": "#abcdef",
    } as React.CSSProperties) as Record<string, string>;

    expect(style["--jt-row-accent"]).toBe("#abcdef");
    expect(style["--jt-accent"]).toBe("#123456");
  });
});
