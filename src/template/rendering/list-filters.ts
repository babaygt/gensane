/**
 * Filters for lists of content, such as `posts | where("draft", false) | sort("date") | take(5)`.
 * Each one returns a new list and leaves the one it received unchanged.
 */
import { InternalError } from "../../diagnostics/index.ts";
import { FilterError, type TemplateFilter } from "./filter-types.ts";
import {
  type TemplateDate,
  areEqual,
  asDate,
  compareDates,
  describeValue,
  isRecord,
  isTruthy,
  ownField,
} from "./values.ts";

function listInput(filterName: string, value: unknown): readonly unknown[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  throw new FilterError(`"${filterName}" needs a list, but found ${describeValue(value)}`);
}

function fieldName(filterName: string, field: unknown): string {
  if (typeof field === "string") return field;
  throw new FilterError(
    `"${filterName}" needs the name of a field, but found ${describeValue(field)}`,
  );
}

function fieldOf(filterName: string, item: unknown, name: string): unknown {
  if (isRecord(item)) return ownField(item, name);
  throw new FilterError(
    `"${filterName}" needs items with fields, but the list contains ${describeValue(item)}`,
  );
}

function count(filterName: string, value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  const found = typeof value === "number" ? String(value) : describeValue(value);
  throw new FilterError(
    `"${filterName}" needs a whole number that is not negative, but found ${found}`,
  );
}

/** With only a field, keeps the items where that field is true. */
export const where: TemplateFilter = (value, field, ...expected) => {
  const items = listInput("where", value);
  const name = fieldName("where", field);
  return items.filter((item) => {
    const found = fieldOf("where", item, name);
    return expected.length === 0 ? isTruthy(found) : areEqual(found, expected[0]);
  });
};

export const take: TemplateFilter = (value, amount) =>
  listInput("take", value).slice(0, count("take", amount));

export const skip: TemplateFilter = (value, amount) =>
  listInput("skip", value).slice(count("skip", amount));

export const reverse: TemplateFilter = (value) => listInput("reverse", value).toReversed();

type SortKey =
  | { readonly kind: "empty" }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "date"; readonly value: TemplateDate };

const KIND_NAMES = { number: "a number", text: "text", date: "a date" } as const;

function sortKey(value: unknown): SortKey {
  if (value === null || value === undefined) return { kind: "empty" };
  if (typeof value === "number") return { kind: "number", value };
  if (typeof value === "string") return { kind: "text", value };
  const date = asDate(value);
  if (date !== undefined) return { kind: "date", value: date };
  const [field] = isRecord(value) ? Object.keys(value) : [];
  throw new FilterError(
    `"sort" cannot sort ${describeValue(value)}`,
    field === undefined ? undefined : `sort by one of its fields, such as \`sort("${field}")\``,
  );
}

function checkOneKind(keys: readonly SortKey[]): void {
  const [first, ...others] = keys.filter(
    (key): key is Exclude<SortKey, { kind: "empty" }> => key.kind !== "empty",
  );
  const different = others.find((key) => key.kind !== first?.kind);
  if (first === undefined || different === undefined) return;
  throw new FilterError(
    `"sort" cannot compare ${KIND_NAMES[first.kind]} with ${KIND_NAMES[different.kind]}`,
    "make sure every item has the same kind of value",
  );
}

/** Ignores capital letters first, so that "apple" comes before "Banana". */
function compareText(first: string, second: string): number {
  for (const [left, right] of [
    [first.toLowerCase(), second.toLowerCase()],
    [first, second],
  ] as const) {
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

/** Items without a value go last. */
function compareKeys(first: SortKey, second: SortKey): number {
  if (first.kind === "empty" || second.kind === "empty") {
    return Number(first.kind === "empty") - Number(second.kind === "empty");
  }
  if (first.kind === "number" && second.kind === "number") return first.value - second.value;
  if (first.kind === "text" && second.kind === "text")
    return compareText(first.value, second.value);
  if (first.kind === "date" && second.kind === "date")
    return compareDates(first.value, second.value);
  throw new InternalError("Sort keys are checked to be of one kind");
}

/** Sorts the items, or the items by one of their fields. Equal items keep their order. */
export const sort: TemplateFilter = (value, ...field) => {
  const items = listInput("sort", value);
  const name = field.length === 0 ? undefined : fieldName("sort", field[0]);
  const keyed = items.map((item) => ({
    item,
    key: sortKey(name === undefined ? item : fieldOf("sort", item, name)),
  }));
  checkOneKind(keyed.map(({ key }) => key));
  return keyed
    .toSorted((first, second) => compareKeys(first.key, second.key))
    .map(({ item }) => item);
};
