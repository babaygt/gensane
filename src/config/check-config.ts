/**
 * Checks the value a config file exports. A config written in JavaScript has no type checking, and
 * even a TypeScript one is only run, not checked, so every setting is checked here before a build.
 */
import {
  type Diagnostic,
  type Result,
  closestMatch,
  err,
  hasErrors,
  ok,
} from "../diagnostics/index.ts";
import { PALETTES, READABLE_CONTRAST, THEME_CHOICES, contrast, isHexColor } from "../core/index.ts";
import type { GensaneConfig } from "./config.ts";
import { ConfigCodes } from "./diagnostic-codes.ts";

export interface CheckedConfig {
  readonly config: GensaneConfig;
  readonly warnings: readonly Diagnostic[];
}

const SETTINGS = ["site", "perPage", "markdown", "filters", "theme", "llms", "nav", "analytics"];
const NAV_ITEM_SETTINGS = ["title", "url"];
/** A page of the site, or an address on another site; a relative address has no page to start from. */
const NAV_URL = /^(?:\/|https:\/\/|http:\/\/|mailto:)/;
const SITE_SETTINGS = ["title", "url", "description", "author"];
/** The profiles the default theme shows as icons. Known here, so a misspelled one gets a warning. */
const PROFILES = ["github", "gitlab", "codeberg", "mastodon", "bluesky", "linkedin", "email"];
const MARKDOWN_SETTINGS = ["rawHtml", "headingIds", "highlight"];
const FILTER_NAME = /^[A-Za-z_]\w*$/;

/** What each service's snippet names the site with, and what to write when it doesn't look like it. */
const ANALYTICS: Readonly<
  Record<
    string,
    { readonly looks: RegExp; readonly what: string; readonly hint: (value: string) => string }
  >
> = {
  google: {
    looks: /^G-[A-Z0-9]+$/,
    what: "a measurement ID of Google Analytics",
    hint: (value) =>
      value.startsWith("UA-")
        ? 'IDs that start with "UA-" stopped counting in 2023; write the measurement ID of the site\'s data stream, which starts with "G-"'
        : 'write the measurement ID of the site\'s data stream, which starts with "G-", such as "G-ABC123DEF4"',
  },
  plausible: {
    looks: /^pa-[\w-]+$/,
    what: "the name of a Plausible script",
    hint: (value) =>
      value.includes(".")
        ? 'write the name of the script in the snippet Plausible gives the site, such as "pa-AbC123", not the domain'
        : 'write the name of the script in the snippet Plausible gives the site, such as "pa-AbC123"',
  },
  cloudflare: {
    looks: /^[0-9a-f]{32}$/,
    what: "a token of Cloudflare's Web Analytics",
    hint: () =>
      "write the token in the snippet Cloudflare's Web Analytics gives the site: 32 letters and digits",
  },
};
const EXPORT_HINT = "end the config with `export default defineConfig({ ... })`";

type Group = Readonly<Record<string, unknown>>;

function isGroup(value: unknown): value is Group {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** What was found, for the second half of a message such as `"perPage" must be a number, but ...`. */
function describeFound(value: unknown): string {
  if (value === undefined) return "it is missing";
  if (value === null) return "it is null";
  if (typeof value === "string") return `${JSON.stringify(value)} is text`;
  if (typeof value === "number" || typeof value === "bigint") return `${String(value)} is a number`;
  if (typeof value === "boolean") return `${String(value)} is true or false`;
  if (typeof value === "function") return "it is a function";
  if (Array.isArray(value)) return "it is a list";
  if (typeof value === "symbol") return "it is a symbol";
  return "it is a group of settings";
}

/** `to-upper` → `to_upper`, a name a template can use. */
function filterNameLike(name: string): string {
  const replaced = name.replaceAll(/\W/g, "_");
  return /^\d/.test(replaced) ? `_${replaced}` : replaced;
}

function listed(names: readonly string[], last = "and"): string {
  if (names.length === 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ${last} ${names.at(-1) ?? ""}`;
}

/** A loaded config has no line numbers, so a problem with it points at the start of its file. */
export function configProblem(
  file: string,
  code: Diagnostic["code"],
  message: string,
  hint: string,
  severity: Diagnostic["severity"] = "error",
): Diagnostic {
  const start = { line: 1, column: 1, offset: 0 };
  return { code, severity, message, span: { file, start, end: start }, hint };
}

class ConfigCheck {
  readonly #file: string;
  readonly problems: Diagnostic[] = [];

  constructor(file: string) {
    this.#file = file;
  }

  report(
    code: Diagnostic["code"],
    message: string,
    hint: string,
    severity: Diagnostic["severity"] = "error",
  ): void {
    this.problems.push(configProblem(this.#file, code, message, hint, severity));
  }

  wrongValue(path: string, expected: string, value: unknown, hint: string): void {
    const message = `${JSON.stringify(path)} must be ${expected}, but ${describeFound(value)}`;
    this.report(ConfigCodes.wrongValue, message, hint);
  }

  unknownSetting(path: string, name: string, known: readonly string[], otherwise: string): void {
    const suggestion = closestMatch(name, known);
    const hint = suggestion === undefined ? otherwise : `did you mean "${suggestion}"?`;
    this.report(ConfigCodes.unknownSetting, `${JSON.stringify(path)} is not a setting`, hint);
  }

  group(path: string, value: unknown): value is Group {
    if (isGroup(value)) return true;
    this.wrongValue(path, "a group of settings", value, "write the settings between { and }");
    return false;
  }

  trueOrFalse(path: string, value: unknown): void {
    if (typeof value !== "boolean")
      this.wrongValue(path, "true or false", value, "write true or false");
  }

  text(path: string, value: unknown): void {
    if (typeof value !== "string") this.wrongValue(path, "text", value, "write the text in quotes");
  }

  perPage(value: unknown): void {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) return;
    this.wrongValue("perPage", "a whole number above 0", value, "write a number such as 10");
  }

  site(value: unknown): void {
    if (!this.group("site", value)) return;
    const known = [...SITE_SETTINGS, ...PROFILES];
    const unused = known.filter((name) => !Object.hasOwn(value, name));
    for (const [name, setting] of Object.entries(value)) {
      if (name === "author") this.author(setting);
      else if (known.includes(name)) this.text(`site.${name}`, setting);
      else this.siteTypo(name, unused);
    }
  }

  /** Other settings of the site are for the templates, unless one looks like a misspelled known one. */
  siteTypo(name: string, unused: readonly string[]): void {
    const suggestion = closestMatch(name, unused);
    if (suggestion === undefined) return;
    this.report(
      ConfigCodes.misspelledSiteSetting,
      `${JSON.stringify(`site.${name}`)} is not a known setting`,
      `did you mean "${suggestion}"? Other settings of the site are fine, for the templates`,
      "warning",
    );
  }

  author(value: unknown): void {
    if (typeof value === "string") return;
    if (!isGroup(value)) {
      const expected = 'text or a group of settings with a "name"';
      this.wrongValue("site.author", expected, value, 'write a name, or { name: "..." }');
      return;
    }
    this.text("site.author.name", value["name"]);
  }

  markdown(value: unknown): void {
    if (!this.group("markdown", value)) return;
    for (const [name, setting] of Object.entries(value)) {
      const path = `markdown.${name}`;
      if (name === "rawHtml") {
        if (setting === "allow" || setting === "escape") continue;
        this.wrongValue(path, '"allow" or "escape"', setting, 'write "allow" or "escape"');
      } else if (name === "highlight") {
        if (typeof setting !== "function" && setting !== false) {
          this.wrongValue(
            path,
            "a function, or false",
            setting,
            "write a function, such as (code, language) => undefined, or false to color no code",
          );
        }
      } else if (name === "headingIds") {
        if (typeof setting !== "boolean")
          this.wrongValue(path, "true or false", setting, "write true or false");
      } else {
        this.unknownSetting(
          path,
          name,
          MARKDOWN_SETTINGS,
          `the settings of markdown are ${listed(MARKDOWN_SETTINGS)}`,
        );
      }
    }
  }

  /** One of a few words, with "did you mean" for a misspelled one. */
  choice(path: string, value: unknown, choices: readonly string[]): boolean {
    if (typeof value === "string" && choices.includes(value)) return true;
    const suggestion = typeof value === "string" ? closestMatch(value, choices) : undefined;
    const quoted = choices.map((choice) => JSON.stringify(choice));
    const hint =
      suggestion === undefined ? `write ${listed(quoted, "or")}` : `did you mean "${suggestion}"?`;
    this.wrongValue(path, listed(quoted, "or"), value, hint);
    return false;
  }

  /** Settings of a group of the theme, such as `theme.blog`, each checked by its own rule. */
  themeGroup(
    path: string,
    value: unknown,
    rules: Readonly<Record<string, (setting: unknown) => void>>,
  ): void {
    if (!this.group(path, value)) return;
    const names = Object.keys(rules);
    for (const [name, setting] of Object.entries(value)) {
      const rule = rules[name];
      if (rule !== undefined) rule(setting);
      else
        this.unknownSetting(
          `${path}.${name}`,
          name,
          names,
          `the settings of ${path} are ${listed(names)}`,
        );
    }
  }

  sections(value: unknown): void {
    const path = "theme.home.sections";
    if (!Array.isArray(value)) {
      this.wrongValue(path, "a list", value, `write a list, such as ["intro", "recent-posts"]`);
      return;
    }
    const seen = new Set<unknown>();
    value.forEach((section: unknown, index) => {
      if (!this.choice(`${path}[${index}]`, section, THEME_CHOICES.homeSections)) return;
      if (seen.has(section)) {
        const message = `${JSON.stringify(path)} has "${String(section)}" more than once`;
        this.report(ConfigCodes.wrongValue, message, "list each part of the home page once");
      }
      seen.add(section);
    });
  }

  theme(value: unknown): void {
    if (!this.group("theme", value)) return;
    const theme = value;
    this.themeGroup("theme", theme, {
      palette: (setting) => this.choice("theme.palette", setting, THEME_CHOICES.palette),
      accent: (setting) => {
        if (typeof setting === "string" && isHexColor(setting)) return;
        this.wrongValue(
          "theme.accent",
          'a color such as "#6d5dfc"',
          setting,
          "write the color as # and 3 or 6 hexadecimal digits",
        );
      },
      colorScheme: (setting) =>
        this.choice("theme.colorScheme", setting, THEME_CHOICES.colorScheme),
      font: (setting) => this.choice("theme.font", setting, THEME_CHOICES.font),
      width: (setting) => this.choice("theme.width", setting, THEME_CHOICES.width),
      blog: (setting) =>
        this.themeGroup("theme.blog", setting, {
          layout: (layout) => this.choice("theme.blog.layout", layout, THEME_CHOICES.blogLayout),
          cover: (cover) => {
            if (typeof cover !== "boolean")
              this.wrongValue("theme.blog.cover", "true or false", cover, "write true or false");
          },
        }),
      home: (setting) =>
        this.themeGroup("theme.home", setting, { sections: (sections) => this.sections(sections) }),
      toc: (setting) => {
        if (typeof setting !== "boolean")
          this.wrongValue("theme.toc", "true or false", setting, "write true or false");
      },
    });
    this.readableAccent(theme);
  }

  /** An accent of your own replaces the palette's, so it must still be readable on the palette's backgrounds. */
  readableAccent(theme: Group): void {
    const { accent, palette = "default", colorScheme = "auto" } = theme;
    if (typeof accent !== "string" || !isHexColor(accent)) return;
    const name = THEME_CHOICES.palette.find((known) => known === palette);
    if (name === undefined) return;
    const colors = PALETTES[name];
    const modes: readonly ("light" | "dark")[] =
      colorScheme === "light" || colorScheme === "dark" ? [colorScheme] : ["light", "dark"];
    for (const mode of modes) {
      const { background, surface } = colors[mode];
      const ratio = Math.min(contrast(accent, background), contrast(accent, surface));
      if (ratio >= READABLE_CONTRAST) continue;
      this.report(
        ConfigCodes.hardToRead,
        `"theme.accent" is hard to read in the ${mode} colors of the "${name}" palette: ${ratio.toFixed(1)} to 1, and text needs ${READABLE_CONTRAST} to 1`,
        mode === "dark"
          ? "choose a lighter color, or leave accent out to use the palette's own"
          : "choose a darker color, or leave accent out to use the palette's own",
        "warning",
      );
    }
  }

  /** The menu: whether each page of the site is there is checked by the build, which knows the pages. */
  nav(value: unknown): void {
    if (!Array.isArray(value)) {
      const hint = 'write a list, such as [{ title: "Uses", url: "/uses/" }]';
      this.wrongValue("nav", "a list", value, hint);
      return;
    }
    value.forEach((item: unknown, index) => {
      const path = `nav[${index}]`;
      if (!isGroup(item)) {
        this.wrongValue(
          path,
          "a group of settings",
          item,
          'write { title: "Uses", url: "/uses/" }',
        );
        return;
      }
      this.text(`${path}.title`, item["title"]);
      const url = item["url"];
      if (typeof url !== "string" || !NAV_URL.test(url)) {
        this.wrongValue(
          `${path}.url`,
          'an address that starts with "/", "https://", "http://" or "mailto:"',
          url,
          'start it with "/" for a page of this site, such as "/uses/"',
        );
      }
      for (const name of Object.keys(item).filter((key) => !NAV_ITEM_SETTINGS.includes(key)))
        this.unknownSetting(
          `${path}.${name}`,
          name,
          NAV_ITEM_SETTINGS,
          `the settings of an item of nav are ${listed(NAV_ITEM_SETTINGS)}`,
        );
    });
  }

  /** A wrong ID still builds, so it is a warning: the site works, only the visits aren't counted. */
  analytics(value: unknown): void {
    if (!this.group("analytics", value)) return;
    const services = Object.keys(ANALYTICS);
    for (const [name, setting] of Object.entries(value)) {
      const path = `analytics.${name}`;
      const service = ANALYTICS[name];
      if (service === undefined) {
        this.unknownSetting(
          path,
          name,
          services,
          `the settings of analytics are ${listed(services)}`,
        );
      } else if (typeof setting !== "string") {
        this.wrongValue(path, "text", setting, "write the text in quotes");
      } else if (!service.looks.test(setting)) {
        this.report(
          ConfigCodes.unlikelyAnalyticsId,
          `${JSON.stringify(path)} doesn't look like ${service.what}: ${JSON.stringify(setting)}`,
          service.hint(setting),
          "warning",
        );
      }
    }
  }

  filters(value: unknown): void {
    if (!this.group("filters", value)) return;
    for (const [name, filter] of Object.entries(value)) {
      if (!FILTER_NAME.test(name)) {
        const message = `${JSON.stringify(name)} can't be the name of a filter, which only has letters, digits and _`;
        this.report(ConfigCodes.wrongValue, message, `name it "${filterNameLike(name)}"`);
      } else if (typeof filter !== "function") {
        this.wrongValue(
          `filters.${name}`,
          "a function",
          filter,
          "write a function, such as (value) => value",
        );
      }
    }
  }
}

/** Checks every setting, and reports every problem at once. */
export function checkConfig(
  value: unknown,
  file: string,
): Result<CheckedConfig, readonly Diagnostic[]> {
  const check = new ConfigCheck(file);
  if (value === undefined) {
    check.report(ConfigCodes.noSettings, "the config doesn't export its settings", EXPORT_HINT);
    return err(check.problems);
  }
  if (!isGroup(value)) {
    const message = `the config must export a group of settings, but ${describeFound(value)}`;
    check.report(ConfigCodes.noSettings, message, EXPORT_HINT);
    return err(check.problems);
  }

  for (const [name, setting] of Object.entries(value)) {
    if (name === "site") check.site(setting);
    else if (name === "perPage") check.perPage(setting);
    else if (name === "markdown") check.markdown(setting);
    else if (name === "filters") check.filters(setting);
    else if (name === "theme") check.theme(setting);
    else if (name === "llms") check.trueOrFalse("llms", setting);
    else if (name === "nav") check.nav(setting);
    else if (name === "analytics") check.analytics(setting);
    else check.unknownSetting(name, name, SETTINGS, `the settings are ${listed(SETTINGS)}`);
  }
  if (hasErrors(check.problems)) return err(check.problems);
  // Every setting has been checked against the types of GensaneConfig.
  return ok({ config: value as GensaneConfig, warnings: check.problems });
}
