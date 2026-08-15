/**
 * Minimal WCAG contrast maths for play functions.
 *
 * The a11y addon already audits rendered stories; these helpers exist so a
 * story can make a specific, readable assertion — "this grid actually turned
 * dark", "this text clears 4.5:1 against the surface behind it" — instead of
 * asserting on a hex value that any theme change would invalidate.
 */

export interface Rgb {
  b: number;
  g: number;
  r: number;
}

export function parseColor(value: string): Rgb {
  const parts = value.match(/[\d.]+/g);
  if (!parts || parts.length < 3) throw new Error(`Could not parse the colour "${value}".`);
  const [r, g, b] = parts.map(Number) as [number, number, number];
  return { b, g, r };
}

export function relativeLuminance(color: Rgb): number {
  const channel = (value: number) => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(parseColor(foreground));
  const second = relativeLuminance(parseColor(background));
  const [lighter, darker] = first > second ? [first, second] : [second, first];
  return ((lighter as number) + 0.05) / ((darker as number) + 0.05);
}

/** True when a surface reads as dark, which is what a dark scheme must produce. */
export function isDarkSurface(background: string): boolean {
  return relativeLuminance(parseColor(background)) < 0.2;
}

/**
 * Walks up from an element until it finds a non-transparent background, which
 * is what a reader actually sees behind the text.
 */
export function effectiveBackground(element: Element): string {
  let current: Element | null = element;
  while (current) {
    const background = getComputedStyle(current).backgroundColor;
    const alpha = background.match(/[\d.]+/g)?.[3];
    if (background && background !== "transparent" && alpha !== "0") return background;
    current = current.parentElement;
  }
  return "rgb(255, 255, 255)";
}
