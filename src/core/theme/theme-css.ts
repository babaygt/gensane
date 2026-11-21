/**
 * The theme settings as CSS custom properties, in one file the default theme's stylesheet uses. This
 * way the stylesheet has no code for each setting.
 */
import { CALLOUT_COLORS, type CalloutColors, type Colors } from "./palettes.ts";
import type { Theme } from "./theme-settings.ts";

/** Where the file is written in the site. */
export const THEME_CSS_PATH = "assets/settings.css";

const FONTS = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: '"Iowan Old Style", Charter, Georgia, serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;

const WIDTHS = { narrow: "36rem", normal: "42rem", wide: "52rem" } as const;

function colorsOf(colors: Colors | CalloutColors, indent: string): string[] {
  return Object.entries(colors).map(([name, value]) => `${indent}--${name}: ${value};`);
}

export function themeCss(theme: Theme): string {
  const { light, dark } = theme.colors;
  const scheme = theme.colorScheme === "auto" ? "light dark" : theme.colorScheme;
  const lines = [
    "/* Made by gensane from the theme settings in the config. */",
    ":root {",
    `  color-scheme: ${scheme};`,
    `  --font: ${FONTS[theme.font]};`,
    `  --width: ${WIDTHS[theme.width]};`,
    ...colorsOf(theme.colorScheme === "dark" ? dark : light, "  "),
    ...colorsOf(CALLOUT_COLORS[theme.colorScheme === "dark" ? "dark" : "light"], "  "),
    "}",
  ];
  if (theme.colorScheme === "auto") {
    // The switch on the page sets `data-color-scheme`, which wins over the system.
    lines.push(
      "@media (prefers-color-scheme: dark) {",
      '  :root:not([data-color-scheme="light"]) {',
      ...colorsOf(dark, "    "),
      ...colorsOf(CALLOUT_COLORS.dark, "    "),
      "  }",
      "}",
      ':root[data-color-scheme="dark"] {',
      ...colorsOf(dark, "  "),
      ...colorsOf(CALLOUT_COLORS.dark, "  "),
      "}",
    );
  }
  return `${lines.join("\n")}\n`;
}
