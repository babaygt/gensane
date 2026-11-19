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
import type { GensaneConfig } from "./config.ts";
import { ConfigCodes } from "./diagnostic-codes.ts";

export interface CheckedConfig {
  readonly config: GensaneConfig;
  readonly warnings: readonly Diagnostic[];
}

const SETTINGS = ["site", "perPage", "markdown", "filters"];
const SITE_SETTINGS = ["title", "url", "description", "author"];
const MARKDOWN_SETTINGS = ["rawHtml", "headingIds"];
const FILTER_NAME = /^[A-Za-z_]\w*$/;
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

function listed(names: readonly string[]): string {
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
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

  text(path: string, value: unknown): void {
    if (typeof value !== "string") this.wrongValue(path, "text", value, "write the text in quotes");
  }

  perPage(value: unknown): void {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) return;
    this.wrongValue("perPage", "a whole number above 0", value, "write a number such as 10");
  }

  site(value: unknown): void {
    if (!this.group("site", value)) return;
    const unused = SITE_SETTINGS.filter((name) => !Object.hasOwn(value, name));
    for (const [name, setting] of Object.entries(value)) {
      if (name === "author") this.author(setting);
      else if (SITE_SETTINGS.includes(name)) this.text(`site.${name}`, setting);
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
    else check.unknownSetting(name, name, SETTINGS, `the settings are ${listed(SETTINGS)}`);
  }
  if (hasErrors(check.problems)) return err(check.problems);
  // Every setting has been checked against the types of GensaneConfig.
  return ok({ config: value as GensaneConfig, warnings: check.problems });
}
