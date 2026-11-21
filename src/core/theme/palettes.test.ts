// Every palette must be readable: each color text is written in, on each background of its side.
import { describe, expect, it } from "vitest";
import { READABLE_CONTRAST, contrast, isHexColor, luminance } from "./contrast.ts";
import { CALLOUT_COLORS, PALETTES } from "./palettes.ts";

const sides = Object.entries(PALETTES).flatMap(([name, palette]) =>
  (["light", "dark"] as const).map((mode) => ({ name, mode, colors: palette[mode] })),
);

describe.each(sides)("the $mode side of $name", ({ colors }) => {
  it.each(["text", "muted", "accent"] as const)(
    "has %s readable on the background and the surface",
    (color) => {
      expect(contrast(colors[color], colors.background)).toBeGreaterThanOrEqual(READABLE_CONTRAST);
      expect(contrast(colors[color], colors.surface)).toBeGreaterThanOrEqual(READABLE_CONTRAST);
    },
  );

  it("writes every color as #rrggbb", () => {
    for (const value of Object.values(colors)) expect(isHexColor(value)).toBe(true);
  });
});

describe.each(Object.entries(PALETTES))("%s", (_, palette) => {
  it("is light on its light side and dark on its dark side", () => {
    expect(luminance(palette.light.background)).toBeGreaterThan(luminance(palette.dark.background));
    expect(luminance(palette.light.text)).toBeLessThan(luminance(palette.light.background));
    expect(luminance(palette.dark.text)).toBeGreaterThan(luminance(palette.dark.background));
  });
});

it("has six palettes", () => {
  expect(Object.keys(PALETTES)).toEqual([
    "default",
    "paper",
    "nord",
    "solarized",
    "gruvbox",
    "midnight",
  ]);
});

describe.each(sides)("callouts on the $mode side of $name", ({ mode, colors }) => {
  it.each(Object.entries(CALLOUT_COLORS[mode]))(
    "has %s readable on the background and the surface",
    (_, color) => {
      expect(contrast(color, colors.background)).toBeGreaterThanOrEqual(READABLE_CONTRAST);
      expect(contrast(color, colors.surface)).toBeGreaterThanOrEqual(READABLE_CONTRAST);
      expect(isHexColor(color)).toBe(true);
    },
  );
});
