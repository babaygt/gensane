/**
 * Small schemas that combine into bigger ones, and describe what a content file must contain:
 *
 *   const post = object({ title: text(), tags: withDefault(listOf(text()), []) });
 *
 * Each function returns a value of the generic type `Schema<T>`, so TypeScript infers the type of
 * the validated data from the schema, and the two can never disagree. Checks don't stop at the
 * first problem: every wrong field in a file is reported in one run.
 */
import {
  type Diagnostic,
  type DiagnosticCode,
  type Result,
  type SourceSpan,
  closestMatch,
  err,
  ok,
} from "../../diagnostics/index.ts";
import { FrontmatterCodes } from "../diagnostic-codes.ts";
import { daysInMonth } from "../parsing/inline-values.ts";
import { toPlainData } from "../plain-data.ts";
import type { DateValue, FrontmatterValue, MapEntry, MapValue } from "../values.ts";

/** The outcome of checking one value. Warnings don't make a value invalid. */
export type Checked<T> =
  | { readonly valid: true; readonly value: T; readonly warnings: readonly Diagnostic[] }
  | { readonly valid: false; readonly diagnostics: readonly Diagnostic[] };

export interface Schema<T> {
  /** `path` names the value in messages, such as `links[0].url`. */
  readonly check: (value: FrontmatterValue, path: string) => Checked<T>;
  /** The value to use when the field is missing. Without this, the field is required. */
  readonly whenMissing?: { readonly value: T };
}

export interface ObjectSchema<T> extends Schema<T> {
  readonly fields: readonly string[];
}

/** The type of the data that a schema accepts. */
export type Infer<S> = S extends Schema<infer T> ? T : never;

/** A date without its position in the file. */
export interface ContentDate {
  readonly text: string;
  readonly year: number;
  readonly month: number;
  readonly day?: number;
  readonly time?: string;
}

function pass<T>(value: T, warnings: readonly Diagnostic[] = []): Checked<T> {
  return { valid: true, value, warnings };
}

function problem(
  code: DiagnosticCode,
  message: string,
  span: SourceSpan,
  hint: string,
): Diagnostic {
  return { code, severity: "error", message, span, hint };
}

function fail(
  code: DiagnosticCode,
  message: string,
  span: SourceSpan,
  hint: string,
): Checked<never> {
  return { valid: false, diagnostics: [problem(code, message, span, hint)] };
}

/** What was found, for the second half of a message such as `"age" must be a number, but ...`. */
function describeValue(value: FrontmatterValue): string {
  switch (value.kind) {
    case "string":
      return `"${value.value}" is text`;
    case "number":
      return `${value.value} is a number`;
    case "boolean":
      return `${value.value} is a boolean`;
    case "date":
      return `${value.text} is a date`;
    case "list":
      return "it is a list";
    case "map":
      return "it is a group of settings";
    default:
      return "it is empty";
  }
}

function wrongType(
  value: FrontmatterValue,
  path: string,
  expected: string,
  hint = `write ${expected} here`,
): Checked<never> {
  const message = `"${path}" must be ${expected}, but ${describeValue(value)}`;
  return fail(FrontmatterCodes.wrongType, message, value.span, hint);
}

/** A number, boolean or date as it was written, if the value is one of those. */
function scalarText(value: FrontmatterValue): string | undefined {
  if (value.kind === "number" || value.kind === "boolean") return String(value.value);
  return value.kind === "date" ? value.text : undefined;
}

export function text(): Schema<string> {
  return {
    check(value, path) {
      if (value.kind !== "string") {
        const written = scalarText(value);
        const hint = written === undefined ? undefined : `put the value in quotes: "${written}"`;
        return wrongType(value, path, "text", hint);
      }
      if (value.value.trim() !== "") return pass(value.value);
      const hint = "write some text, or remove this line if the field is optional";
      return fail(FrontmatterCodes.emptyField, `"${path}" is empty`, value.span, hint);
    },
  };
}

export function integer(): Schema<number> {
  return {
    check(value, path) {
      if (value.kind === "number" && Number.isInteger(value.value)) return pass(value.value);
      return wrongType(value, path, "a whole number");
    },
  };
}

export function boolean(): Schema<boolean> {
  return {
    check(value, path) {
      return value.kind === "boolean" ? pass(value.value) : wrongType(value, path, "true or false");
    },
  };
}

function toContentDate({ text: dateText, year, month, day, time }: DateValue): ContentDate {
  return {
    text: dateText,
    year,
    month,
    ...(day === undefined ? {} : { day }),
    ...(time === undefined ? {} : { time }),
  };
}

const NUMERIC_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;

/** Only suggests a date that exists, when it is clear which number is the day. */
function dateHint(written: string): string {
  const fallback = "write the date as YYYY-MM-DD, with the year first";
  const match = NUMERIC_DATE.exec(written);
  if (match === null) return fallback;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const firstIsDay = first > 12;
  const secondIsDay = second > 12;
  if (firstIsDay === secondIsDay) return fallback;
  const [day, month] = firstIsDay ? [first, second] : [second, first];
  const year = Number(match[3]);
  if (month < 1 || day > daysInMonth(year, month)) return fallback;
  return `write it as ${match[3]}-${String(month).padStart(2, "0")}-${day}`;
}

function notADate(value: FrontmatterValue, path: string, expected: string): Checked<never> {
  return value.kind === "string"
    ? wrongType(value, path, expected, dateHint(value.value))
    : wrongType(value, path, expected);
}

/** A date with a day, such as the publication date of a post. */
export function fullDate(): Schema<ContentDate> {
  return {
    check(value, path) {
      if (value.kind !== "date") return notADate(value, path, "a date");
      if (value.day !== undefined) return pass(toContentDate(value));
      return fail(
        FrontmatterCodes.wrongType,
        `"${path}" must be a date with a day, but ${value.text} is only a month`,
        value.span,
        `add the day, for example ${value.text}-01`,
      );
    },
  };
}

/** A date or just a month, as used for the start and end of a job. */
export function monthOrDate(): Schema<ContentDate> {
  return {
    check(value, path) {
      return value.kind === "date" ? pass(toContentDate(value)) : notADate(value, path, "a date");
    },
  };
}

/** A date or month, or the word `present` for something that is still going on. */
export function dateOrPresent(): Schema<ContentDate | "present"> {
  return {
    check(value, path) {
      if (value.kind === "date") return pass(toContentDate(value));
      if (value.kind === "string" && value.value === "present") return pass("present");
      return notADate(value, path, 'a date or "present"');
    },
  };
}

const URL_PATTERN = /^(?:https?:\/\/[^\s/]\S*|\/\S*)$/;

/** A full web address or a path on the same site. */
export function url(): Schema<string> {
  return {
    check(value, path) {
      if (value.kind !== "string") return wrongType(value, path, "a web address");
      if (URL_PATTERN.test(value.value)) return pass(value.value);
      return fail(
        FrontmatterCodes.invalidUrl,
        `"${path}" must be a web address, but "${value.value}" is not one`,
        value.span,
        "start it with https://, or with / for a page on this site",
      );
    },
  };
}

/** One of a fixed list of words. */
export function choice<const Choices extends readonly string[]>(
  ...choices: Choices
): Schema<Choices[number]> {
  const listed = choices.map((option) => `"${option}"`).join(", ");
  return {
    check(value, path) {
      if (value.kind !== "string") return wrongType(value, path, `one of ${listed}`);
      const selected = choices.find((option) => option === value.value);
      if (selected !== undefined) return pass(selected);
      const suggestion = closestMatch(value.value, choices);
      return fail(
        FrontmatterCodes.invalidChoice,
        `"${path}" cannot be "${value.value}"`,
        value.span,
        suggestion === undefined ? `use one of: ${listed}` : `did you mean "${suggestion}"?`,
      );
    },
  };
}

export function listOf<T>(item: Schema<T>): Schema<readonly T[]> {
  return {
    check(value, path) {
      if (value.kind !== "list") {
        const written = value.kind === "string" ? value.value : scalarText(value);
        const hint = written === undefined ? undefined : `write it as a list: [${written}]`;
        return wrongType(value, path, "a list", hint);
      }
      const results = value.items.map((entry, index) => item.check(entry, `${path}[${index}]`));
      return combine(results, (values) => values);
    },
  };
}

/** Collects the results of several checks, and keeps every problem they found. */
function combine<T, R>(
  results: readonly Checked<T>[],
  build: (values: readonly T[]) => R,
): Checked<R> {
  const values: T[] = [];
  const diagnostics: Diagnostic[] = [];
  let valid = true;
  for (const result of results) {
    if (result.valid) {
      values.push(result.value);
      diagnostics.push(...result.warnings);
    } else {
      valid = false;
      diagnostics.push(...result.diagnostics);
    }
  }
  return valid ? pass(build(values), diagnostics) : { valid: false, diagnostics };
}

/** The field may be left out. */
export function optional<T>(schema: Schema<T>): Schema<T | undefined> {
  return { check: schema.check, whenMissing: { value: undefined } };
}

/** The field may be left out, and then has this value. */
export function withDefault<T>(schema: Schema<T>, value: NoInfer<T>): Schema<T> {
  return { check: schema.check, whenMissing: { value } };
}

type Shape = Readonly<Record<string, Schema<unknown>>>;

type ShapeData<S extends Shape> = { readonly [Key in keyof S]: Infer<S[Key]> };

/** A group of named settings. Fields that the schema doesn't know are allowed. */
export function object<S extends Shape>(shape: S): ObjectSchema<ShapeData<S>> {
  const fields = Object.keys(shape);
  return {
    fields,
    check(value, path) {
      if (value.kind !== "map") return wrongType(value, path, "a group of settings");
      const entries = new Map(value.entries.map((entry) => [entry.key, entry]));
      const results = fields.map((field) =>
        checkField(field, shape[field], entries.get(field), value, childPath(path, field)),
      );
      const checked = combine(
        results,
        (values) =>
          Object.fromEntries(fields.map((field, index) => [field, values[index]])) as ShapeData<S>,
      );
      const warnings = typoWarnings(value.entries, fields, path);
      return checked.valid
        ? pass(checked.value, [...checked.warnings, ...warnings])
        : { valid: false, diagnostics: [...checked.diagnostics, ...warnings] };
    },
  };
}

function childPath(path: string, field: string): string {
  return path === "" ? field : `${path}.${field}`;
}

function checkField(
  field: string,
  schema: Schema<unknown> | undefined,
  entry: MapEntry | undefined,
  parent: MapValue,
  path: string,
): Checked<unknown> {
  if (entry !== undefined && entry.value.kind !== "null") {
    return schema?.check(entry.value, path) ?? pass(undefined);
  }
  if (schema?.whenMissing !== undefined) return pass(schema.whenMissing.value);
  return fail(
    FrontmatterCodes.missingField,
    `the required field "${path}" is missing`,
    entry?.keySpan ?? parent.span,
    `add a line such as \`${field}: ...\``,
  );
}

/** An unknown field is fine, unless it looks like a misspelled field that is still unused. */
function typoWarnings(
  entries: readonly MapEntry[],
  fields: readonly string[],
  path: string,
): Diagnostic[] {
  const used = new Set(entries.map((entry) => entry.key));
  const unused = fields.filter((field) => !used.has(field));
  return entries.flatMap((entry) => {
    const suggestion = fields.includes(entry.key) ? undefined : closestMatch(entry.key, unused);
    if (suggestion === undefined) return [];
    return [
      {
        code: FrontmatterCodes.unknownField,
        severity: "warning",
        message: `"${childPath(path, entry.key)}" is not a known field`,
        span: entry.keySpan,
        hint: `did you mean "${suggestion}"?`,
      },
    ];
  });
}

/** A rule across several fields of an object. It returns a problem, or nothing if all is well. */
export type FieldRule<T> = (value: T, data: MapValue) => Diagnostic | undefined;

export function withRule<T>(schema: ObjectSchema<T>, rule: FieldRule<T>): ObjectSchema<T> {
  return {
    ...schema,
    check(value, path) {
      const checked = schema.check(value, path);
      if (!checked.valid || value.kind !== "map") return checked;
      const broken = rule(checked.value, value);
      return broken === undefined
        ? checked
        : { valid: false, diagnostics: [...checked.warnings, broken] };
    },
  };
}

export { problem as ruleProblem };

export interface Validated<T> {
  readonly value: T;
  /** Fields the schema doesn't define, available to templates. */
  readonly extra: Readonly<Record<string, unknown>>;
  readonly warnings: readonly Diagnostic[];
}

/** Checks a file's frontmatter. On failure the result holds every problem, in file order. */
export function validate<T>(
  schema: ObjectSchema<T>,
  data: MapValue,
): Result<Validated<T>, readonly Diagnostic[]> {
  const checked = schema.check(data, "");
  if (!checked.valid) return err(inFileOrder(checked.diagnostics));
  const extra = data.entries.filter((entry) => !schema.fields.includes(entry.key));
  return ok({
    value: checked.value,
    extra: Object.fromEntries(extra.map((entry) => [entry.key, toPlainData(entry.value)])),
    warnings: inFileOrder(checked.warnings),
  });
}

function inFileOrder(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.toSorted(
    (first, second) => first.span.start.offset - second.span.start.offset,
  );
}
