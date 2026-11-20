/**
 * How readable one color is on another, as WCAG measures it: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio.
 * Text needs at least 4.5 to 1 on its background (level AA).
 */

export const READABLE_CONTRAST = 4.5;

const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

/** `#5b4bdb` or `#fff`. */
export function isHexColor(text: string): boolean {
  return HEX_COLOR.test(text);
}

/** How bright a color looks, from 0 (black) to 1 (white). */
export function luminance(color: string): number {
  const digits = color.slice(1);
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
  const [red = 0, green = 0, blue = 0] = [0, 2, 4].map((at) => {
    const channel = Number.parseInt(full.slice(at, at + 2), 16) / 255;
    return channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** From 1 (the same color) to 21 (black on white). The order of the colors doesn't matter. */
export function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].toSorted((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}
