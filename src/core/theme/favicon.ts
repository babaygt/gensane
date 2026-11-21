/** The icon a browser shows in the tab: the first letter of the site's name, in the palette's colors. */
import { escapeXml } from "../feeds/xml.ts";
import type { Colors } from "./palettes.ts";

/** Where the made icon is written in the site. */
export const FAVICON_PATH = "assets/favicon.svg";

/** Icons of the site's own, in `public/`, which are used instead. */
export const OWN_FAVICONS = ["favicon.svg", "favicon.ico"] as const;

/** The first letter of the title, or nothing when the title has none. */
export function initialOf(title: string): string | undefined {
  const [first] = title.trim();
  return first === undefined ? undefined : first.toLocaleUpperCase();
}

/** A rounded square in the accent color, with the letter in the color of the background. */
export function faviconSvg(letter: string, colors: Colors): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    `<rect width="64" height="64" rx="14" fill="${colors.accent}"/>`,
    `<text x="32" y="45" font-family="system-ui, sans-serif" font-size="38" font-weight="700" text-anchor="middle" fill="${colors.background}">${escapeXml(letter)}</text>`,
    "</svg>",
    "",
  ].join("\n");
}
