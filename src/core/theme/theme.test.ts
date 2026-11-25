import { describe, expect, it } from "vitest";
import { CALLOUT_COLORS, type CalloutColors, type Colors, PALETTES } from "./palettes.ts";
import { themeCss } from "./theme-css.ts";
import { themeOf } from "./theme-settings.ts";

describe("themeOf", () => {
  it("fills in every default", () => {
    expect(themeOf()).toEqual({
      palette: "default",
      colorScheme: "auto",
      font: "sans",
      width: "normal",
      blog: { layout: "list", cover: true },
      home: { sections: ["intro", "recent-posts", "featured-projects", "talks"] },
      toc: true,
      colors: PALETTES.default,
    });
  });

  it("keeps what a site sets", () => {
    const theme = themeOf({
      palette: "paper",
      colorScheme: "dark",
      font: "mono",
      width: "narrow",
      blog: { layout: "grid" },
      home: { sections: ["talks", "intro"] },
      toc: false,
    });
    expect(theme).toMatchObject({
      palette: "paper",
      colorScheme: "dark",
      font: "mono",
      width: "narrow",
      blog: { layout: "grid" },
      home: { sections: ["talks", "intro"] },
      toc: false,
      colors: PALETTES.paper,
    });
  });

  it("uses an accent of the site's own on both sides, and keeps the other colors of the palette", () => {
    const { colors } = themeOf({ palette: "nord", accent: "#6d5dfc" });
    expect(colors.light).toEqual({ ...PALETTES.nord.light, accent: "#6d5dfc" });
    expect(colors.dark).toEqual({ ...PALETTES.nord.dark, accent: "#6d5dfc" });
  });

  it("fills in a setting of a group that is left out", () => {
    expect(themeOf({ blog: {}, home: {} })).toMatchObject({
      blog: { layout: "list" },
      home: { sections: ["intro", "recent-posts", "featured-projects", "talks"] },
    });
  });
});

/** The custom properties of some colors, as the generated file writes them. */
function lines(colors: Colors | CalloutColors, indent: string): string[] {
  return Object.entries(colors).map(([name, value]) => `${indent}--${name}: ${value};`);
}

describe("themeCss", () => {
  const light = PALETTES.default.light;
  const dark = PALETTES.default.dark;

  it("follows the system, and lets the switch on the page win", () => {
    expect(themeCss(themeOf())).toBe(
      [
        "/* Made by gensane from the theme settings in the config. */",
        ":root {",
        "  color-scheme: light dark;",
        '  --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',
        "  --width: 42rem;",
        ...lines(light, "  "),
        ...lines(CALLOUT_COLORS.light, "  "),
        "}",
        "@media (prefers-color-scheme: dark) {",
        '  :root:not([data-color-scheme="light"]) {',
        ...lines(dark, "    "),
        ...lines(CALLOUT_COLORS.dark, "    "),
        "  }",
        "}",
        ':root[data-color-scheme="dark"] {',
        ...lines(dark, "  "),
        ...lines(CALLOUT_COLORS.dark, "  "),
        "}",
        "",
      ].join("\n"),
    );
  });

  it("has only the light colors for a light site", () => {
    const css = themeCss(themeOf({ colorScheme: "light" }));
    expect(css).toContain("color-scheme: light;");
    expect(css).toContain(`--background: ${light.background};`);
    expect(css).not.toContain(dark.background);
    expect(css).toContain(`--caution: ${CALLOUT_COLORS.light.caution};`);
    expect(css).not.toContain(CALLOUT_COLORS.dark.caution);
    expect(css).not.toContain("prefers-color-scheme");
  });

  it("has only the dark colors for a dark site", () => {
    const css = themeCss(themeOf({ colorScheme: "dark" }));
    expect(css).toContain("color-scheme: dark;");
    expect(css).toContain(`--background: ${dark.background};`);
    expect(css).not.toContain(light.background);
    expect(css).not.toContain("prefers-color-scheme");
  });

  it.each([
    ["serif", '"Iowan Old Style", Charter, Georgia, serif'],
    ["mono", 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'],
  ] as const)("writes the %s font", (font, stack) => {
    expect(themeCss(themeOf({ font }))).toContain(`--font: ${stack};`);
  });

  it.each([
    ["narrow", "36rem"],
    ["wide", "52rem"],
  ] as const)("writes the %s width", (width, size) => {
    expect(themeCss(themeOf({ width }))).toContain(`--width: ${size};`);
  });
});
