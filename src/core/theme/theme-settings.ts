/** The settings of the default theme, as a site writes them, and with the default for each one left out. */
import { type Colors, PALETTES, type PaletteName } from "./palettes.ts";

/** Every choice a setting has, so the config can be checked against them. */
export const THEME_CHOICES = {
  palette: Object.keys(PALETTES) as PaletteName[],
  colorScheme: ["auto", "light", "dark"],
  font: ["sans", "serif", "mono"],
  width: ["narrow", "normal", "wide"],
  blogLayout: ["list", "grid"],
  homeSections: ["intro", "recent-posts", "featured-projects", "talks"],
} as const;

type Choice<Name extends keyof typeof THEME_CHOICES> = (typeof THEME_CHOICES)[Name][number];

export interface ThemeSettings {
  /** The colors; see `PALETTES`. Defaults to `default`. */
  readonly palette?: PaletteName;
  /** One color for links in both light and dark, such as `#6d5dfc`, instead of the palette's. */
  readonly accent?: string;
  /** `auto` follows the reader's system, with a switch. Defaults to `auto`. */
  readonly colorScheme?: Choice<"colorScheme">;
  /** Fonts of the reader's system, so nothing is downloaded. Defaults to `sans`. */
  readonly font?: Choice<"font">;
  /** How wide the text is. Defaults to `normal`. */
  readonly width?: Choice<"width">;
  readonly blog?: { readonly layout?: Choice<"blogLayout"> };
  /** The parts of the home page, in this order. */
  readonly home?: { readonly sections?: readonly Choice<"homeSections">[] };
  /** A table of contents on posts with at least 3 headings. Defaults to `true`. */
  readonly toc?: boolean;
}

/** Every setting, with its default filled in, as templates see it as `theme`. */
export interface Theme {
  readonly palette: PaletteName;
  readonly colorScheme: Choice<"colorScheme">;
  readonly font: Choice<"font">;
  readonly width: Choice<"width">;
  readonly blog: { readonly layout: Choice<"blogLayout"> };
  readonly home: { readonly sections: readonly Choice<"homeSections">[] };
  readonly toc: boolean;
  readonly colors: { readonly light: Colors; readonly dark: Colors };
}

export function themeOf(settings: ThemeSettings = {}): Theme {
  const palette = settings.palette ?? "default";
  const { light, dark } = PALETTES[palette];
  const accent = settings.accent;
  return {
    palette,
    colorScheme: settings.colorScheme ?? "auto",
    font: settings.font ?? "sans",
    width: settings.width ?? "normal",
    blog: { layout: settings.blog?.layout ?? "list" },
    home: { sections: settings.home?.sections ?? THEME_CHOICES.homeSections },
    toc: settings.toc ?? true,
    colors: {
      light: accent === undefined ? light : { ...light, accent },
      dark: accent === undefined ? dark : { ...dark, accent },
    },
  };
}
