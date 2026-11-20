import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { contrast, isHexColor, luminance } from "./contrast.ts";

describe("contrast", () => {
  it.each([
    ["#000000", "#ffffff", 21],
    ["#ffffff", "#ffffff", 1],
    ["#777777", "#ffffff", 4.48],
    ["#5b4bdb", "#ffffff", 6.04],
  ])("%s on %s is %s to 1", (first, second, ratio) => {
    expect(contrast(first, second)).toBeCloseTo(ratio, 2);
  });

  it("reads three digits as six", () => {
    expect(luminance("#fff")).toBe(luminance("#ffffff"));
    expect(luminance("#a3c")).toBe(luminance("#aa33cc"));
  });

  it("reads upper and lower case the same", () => {
    expect(luminance("#ABCDEF")).toBe(luminance("#abcdef"));
  });

  const color = fc
    .array(fc.integer({ min: 0, max: 15 }), { minLength: 6, maxLength: 6 })
    .map((digits) => `#${digits.map((digit) => digit.toString(16)).join("")}`);

  it("is between 1 and 21, whichever color comes first", () => {
    fc.assert(
      fc.property(color, color, (first, second) => {
        const ratio = contrast(first, second);
        expect(ratio).toBeGreaterThanOrEqual(1);
        expect(ratio).toBeLessThanOrEqual(21 + 1e-9);
        expect(contrast(second, first)).toBe(ratio);
      }),
    );
  });

  it("is greater for a lighter color on black", () => {
    fc.assert(
      fc.property(color, color, (first, second) => {
        if (luminance(first) === luminance(second)) return;
        const [darker, lighter] =
          luminance(first) < luminance(second) ? [first, second] : [second, first];
        expect(contrast(lighter, "#000000")).toBeGreaterThan(contrast(darker, "#000000"));
      }),
    );
  });
});

describe("isHexColor", () => {
  it.each(["#fff", "#FFFFFF", "#5b4bdb"])("accepts %s", (text) => {
    expect(isHexColor(text)).toBe(true);
  });

  it.each(["fff", "#ffff", "#gggggg", "red", "rgb(0, 0, 0)", "#5b4bdb "])("refuses %s", (text) => {
    expect(isHexColor(text)).toBe(false);
  });
});
