/**
 * The colors of the default theme. Each palette has a light and a dark side, and every color that text
 * is written in is readable on both backgrounds of its side; the tests check that for every palette.
 */

export interface Colors {
  /** Behind everything. */
  readonly background: string;
  /** Behind code, cards and the search box. */
  readonly surface: string;
  readonly text: string;
  /** Dates, reading time and other text that matters less. */
  readonly muted: string;
  readonly border: string;
  /** Links and the parts that stand out. */
  readonly accent: string;
}

export interface Palette {
  readonly light: Colors;
  readonly dark: Colors;
}

export const PALETTES = {
  default: {
    light: {
      background: "#ffffff",
      surface: "#f4f4f7",
      text: "#1c1c21",
      muted: "#5c5c68",
      border: "#dcdce3",
      accent: "#5b4bdb",
    },
    dark: {
      background: "#16161b",
      surface: "#202028",
      text: "#ececf1",
      muted: "#a6a6b4",
      border: "#33333d",
      accent: "#a99cff",
    },
  },
  /** Cream and ink. */
  paper: {
    light: {
      background: "#fbf7ee",
      surface: "#f2ecdf",
      text: "#2b2620",
      muted: "#6b6052",
      border: "#e2d9c6",
      accent: "#9a3b1a",
    },
    dark: {
      background: "#1f1b16",
      surface: "#2a251e",
      text: "#efe6d6",
      muted: "#b8ab95",
      border: "#3b342a",
      accent: "#f0a36b",
    },
  },
  /** Cool blue greys, after Nord. */
  nord: {
    light: {
      background: "#eceff4",
      surface: "#e5e9f0",
      text: "#2e3440",
      muted: "#4c566a",
      border: "#d8dee9",
      accent: "#3b5f8f",
    },
    dark: {
      background: "#2e3440",
      surface: "#3b4252",
      text: "#eceff4",
      muted: "#c2c9d6",
      border: "#434c5e",
      accent: "#88c0d0",
    },
  },
  /** After Solarized, with the accents made darker or lighter to be readable. */
  solarized: {
    light: {
      background: "#fdf6e3",
      surface: "#eee8d5",
      text: "#073642",
      muted: "#4f5f63",
      border: "#e0d9c2",
      accent: "#1d6aa5",
    },
    dark: {
      background: "#002b36",
      surface: "#073642",
      text: "#eee8d5",
      muted: "#a3b0b1",
      border: "#0e4250",
      accent: "#5fb3e8",
    },
  },
  /** Warm and earthy, after Gruvbox. */
  gruvbox: {
    light: {
      background: "#fbf1c7",
      surface: "#f2e5bc",
      text: "#3c3836",
      muted: "#5f5450",
      border: "#e0d2a6",
      accent: "#076678",
    },
    dark: {
      background: "#282828",
      surface: "#32302f",
      text: "#ebdbb2",
      muted: "#bdae93",
      border: "#3c3836",
      accent: "#83a598",
    },
  },
  /** Navy and soft gold. */
  midnight: {
    light: {
      background: "#f6f7fb",
      surface: "#eceef6",
      text: "#151a33",
      muted: "#4d5372",
      border: "#d9dceb",
      accent: "#7a5a00",
    },
    dark: {
      background: "#0f1426",
      surface: "#171d33",
      text: "#e7e9f4",
      muted: "#a5abc7",
      border: "#262d4a",
      accent: "#e6c27a",
    },
  },
} as const satisfies Readonly<Record<string, Palette>>;

export type PaletteName = keyof typeof PALETTES;
