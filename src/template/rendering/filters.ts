/** Filters for text and single values, and the list of every built-in filter. */
import { dateFilter } from "./dates.ts";
import {
  type FilterDefinition,
  FilterError,
  type TemplateFilter,
  defineFilter,
} from "./filter-types.ts";
import { reverse, skip, sort, take, where } from "./list-filters.ts";
import { SafeHtml, describeValue, isRecord, printableText } from "./values.ts";

function textInput(filterName: string, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  throw new FilterError(
    `"${filterName}" needs text, but found ${describeValue(value)}`,
    value instanceof SafeHtml ? "put `raw` last, after the other filters" : undefined,
  );
}

function textFilter(filterName: string, transform: (text: string) => string): TemplateFilter {
  return (value) => transform(textInput(filterName, value));
}

function capitalize(text: string): string {
  const [first = ""] = text;
  return first.toUpperCase() + text.slice(first.length);
}

/** Counts whole characters, so that an emoji is never cut in half. */
const truncate: TemplateFilter = (value, length, ending = "…") => {
  const text = textInput("truncate", value);
  if (typeof length !== "number" || !Number.isInteger(length) || length < 0) {
    throw new FilterError(`"truncate" needs a whole number, but found ${describeValue(length)}`);
  }
  if (typeof ending !== "string") {
    throw new FilterError(`"truncate" needs text to end with, but found ${describeValue(ending)}`);
  }
  const characters = Array.from(text);
  if (characters.length <= length) return text;
  return characters.slice(0, length).join("").trimEnd() + ending;
};

const fallbackWhenEmpty: TemplateFilter = (value, fallback) =>
  value === null || value === undefined || value === "" ? fallback : value;

const length: TemplateFilter = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string" || Array.isArray(value)) return Array.from(value).length;
  if (isRecord(value)) return Object.keys(value).length;
  throw new FilterError(`"length" needs text or a list, but found ${describeValue(value)}`);
};

const join: TemplateFilter = (value, separator = ", ") => {
  if (value === null || value === undefined) return "";
  if (!Array.isArray(value)) {
    throw new FilterError(`"join" needs a list, but found ${describeValue(value)}`);
  }
  if (typeof separator !== "string") {
    throw new FilterError(
      `"join" needs text to separate with, but found ${describeValue(separator)}`,
    );
  }
  const items = value.map((item: unknown) => {
    const text = printableText(item);
    if (text !== undefined) return text;
    throw new FilterError(`"join" cannot print ${describeValue(item)} inside a list`);
  });
  return items.join(separator);
};

function itemsOf(filterName: string, value: unknown): readonly unknown[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string" || Array.isArray(value)) return Array.from(value);
  throw new FilterError(`"${filterName}" needs text or a list, but found ${describeValue(value)}`);
}

const raw: TemplateFilter = (value) => {
  const text = printableText(value);
  if (text !== undefined) return new SafeHtml(text);
  throw new FilterError(`"raw" cannot print ${describeValue(value)}`);
};

export const builtInFilters: ReadonlyMap<string, FilterDefinition> = new Map([
  ["upper", defineFilter(textFilter("upper", (text) => text.toUpperCase()))],
  ["lower", defineFilter(textFilter("lower", (text) => text.toLowerCase()))],
  ["capitalize", defineFilter(textFilter("capitalize", capitalize))],
  ["trim", defineFilter(textFilter("trim", (text) => text.trim()))],
  ["truncate", defineFilter(truncate, 1, 2)],
  ["default", defineFilter(fallbackWhenEmpty, 1)],
  ["length", defineFilter(length)],
  ["join", defineFilter(join, 0, 1)],
  ["first", defineFilter((value) => itemsOf("first", value).at(0))],
  ["last", defineFilter((value) => itemsOf("last", value).at(-1))],
  ["raw", defineFilter(raw)],
  ["where", defineFilter(where, 1, 2)],
  ["take", defineFilter(take, 1)],
  ["skip", defineFilter(skip, 1)],
  ["sort", defineFilter(sort, 0, 1)],
  ["reverse", defineFilter(reverse)],
  ["date", defineFilter(dateFilter, 1)],
]);

/** Custom filters can take any number of arguments, because only their author knows how many. */
export function withCustomFilters(
  custom: Readonly<Record<string, TemplateFilter>>,
): ReadonlyMap<string, FilterDefinition> {
  const entries = Object.entries(custom).map(
    ([name, apply]) => [name, defineFilter(apply, 0, Number.POSITIVE_INFINITY)] as const,
  );
  return new Map([...builtInFilters, ...entries]);
}
