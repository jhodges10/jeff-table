import { useEffect, useRef, useState } from "react";
import { dataGridThemeTokens } from "../src";

/**
 * Live token reference for the docs pages.
 *
 * Rows come from `dataGridThemeTokens` — the same map `createThemeStyle` writes
 * through — so the table cannot drift from the API. Values are measured from
 * two hidden probe sets, one pinned to each colour scheme, so both halves of
 * every `light-dark()` pair are shown as the colour a reader would actually see.
 */
const TOKENS = Object.entries(dataGridThemeTokens) as [string, `--jt-${string}`][];
const SCHEMES = ["light", "dark"] as const;

type Scheme = (typeof SCHEMES)[number];

/** Lengths, keywords, and shadows are shown as declared; colours get resolved. */
function isMeasurement(value: string): boolean {
  return value === "" || /^(0|[\d.]|inherit)/.test(value) || /\d(rem|px|em)/.test(value);
}

interface TokenValue {
  dark?: string;
  declared: string;
  light?: string;
}

export function TokenTable() {
  const reference = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, TokenValue>>({});

  useEffect(() => {
    const root = reference.current;
    if (!root) return;

    const resolve = (scheme: Scheme, token: string) => {
      const probe = root.querySelector<HTMLElement>(
        `[data-scheme="${scheme}"][data-token="${token}"]`,
      );
      const color = probe ? getComputedStyle(probe).backgroundColor : undefined;
      return color === undefined || color === "rgba(0, 0, 0, 0)" ? undefined : color;
    };

    setValues(
      Object.fromEntries(
        TOKENS.map(([key, token]) => {
          const declared = getComputedStyle(root).getPropertyValue(token).trim();
          if (isMeasurement(declared)) return [key, { declared }];
          return [key, { dark: resolve("dark", token), declared, light: resolve("light", token) }];
        }),
      ),
    );
  }, []);

  return (
    <div className="jt-theme" ref={reference}>
      {/*
        Clipped rather than hidden: a `display: none` element resolves colours
        to transparent, and these probes exist to be measured.
      */}
      <div aria-hidden="true" style={{ height: 0, overflow: "hidden" }}>
        {SCHEMES.map((scheme) => (
          <div className="jt-theme" data-color-scheme={scheme} key={scheme}>
            {TOKENS.map(([key, token]) => (
              <span
                data-scheme={scheme}
                data-token={token}
                key={key}
                style={{ backgroundColor: `var(${token})`, display: "block", height: 1, width: 1 }}
              />
            ))}
          </div>
        ))}
      </div>

      <table className="story-token-table">
        <thead>
          <tr>
            <th>Theme key</th>
            <th>Custom property</th>
            <th>Light</th>
            <th>Dark</th>
          </tr>
        </thead>
        <tbody>
          {TOKENS.map(([key, token]) => {
            const value = values[key];
            return (
              <tr key={key}>
                <td>
                  <code>{key}</code>
                </td>
                <td>
                  <code>{token}</code>
                </td>
                {value?.light === undefined && value?.dark === undefined ? (
                  <td colSpan={2}>
                    <code>{value?.declared ?? ""}</code>
                  </td>
                ) : (
                  SCHEMES.map((scheme) => (
                    <td key={scheme}>
                      <span
                        aria-hidden="true"
                        className="story-token-swatch"
                        data-color-scheme={scheme}
                        style={{ background: value?.[scheme] }}
                      />{" "}
                      <code>{value?.[scheme]}</code>
                    </td>
                  ))
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
