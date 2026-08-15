import type { CSSProperties } from "react";
import type { DataGridTheme } from "./types";

/**
 * Every themeable design token, mapped from its `DataGridTheme` key to the CSS
 * custom property it writes. The `satisfies` clause keeps the table exhaustive:
 * adding a key to `DataGridTheme` without a token here fails typecheck.
 */
export const dataGridThemeTokens = {
  accent: "--jt-accent",
  accentForeground: "--jt-accent-foreground",
  background: "--jt-background",
  border: "--jt-border",
  cellPaddingBlock: "--jt-cell-padding-block",
  cellPaddingInline: "--jt-cell-padding-inline",
  controlRadius: "--jt-control-radius",
  danger: "--jt-danger",
  focusRing: "--jt-focus-ring",
  fontFamily: "--jt-font-family",
  fontSize: "--jt-font-size",
  foreground: "--jt-foreground",
  gridLine: "--jt-grid-line",
  headerBackground: "--jt-header-background",
  headerForeground: "--jt-header-foreground",
  hover: "--jt-hover",
  muted: "--jt-muted",
  mutedForeground: "--jt-muted-foreground",
  overlayBackground: "--jt-overlay-background",
  overlayShadow: "--jt-overlay-shadow",
  radius: "--jt-radius",
  scrollbarThumb: "--jt-scrollbar-thumb",
  sectionBackground: "--jt-section-background",
  selected: "--jt-selected",
  shadow: "--jt-shadow",
  skeleton: "--jt-skeleton",
  stickyShadow: "--jt-sticky-shadow",
  tooltipBackground: "--jt-tooltip-background",
  tooltipForeground: "--jt-tooltip-foreground",
} as const satisfies Record<keyof DataGridTheme, `--jt-${string}`>;

export type DataGridThemeTokenName = (typeof dataGridThemeTokens)[keyof typeof dataGridThemeTokens];

const THEME_KEYS = Object.keys(dataGridThemeTokens) as (keyof DataGridTheme)[];

/**
 * Turns a partial theme into inline custom properties. Only the keys a caller
 * supplies are written, so every other token keeps resolving through the
 * stylesheet — host app variable first, then the built-in light/dark pair.
 */
export function createThemeStyle(
  theme: Partial<DataGridTheme> | undefined,
  style: CSSProperties | undefined,
): CSSProperties {
  if (!theme) return style ?? {};

  const next: Record<string, unknown> = { ...style };
  for (const key of THEME_KEYS) {
    const value = theme[key];
    if (value !== undefined) next[dataGridThemeTokens[key]] = value;
  }
  return next as CSSProperties;
}
