/** HTML that the template has marked as safe to print without escaping. */
export class SafeHtml {
  readonly html: string;

  constructor(html: string) {
    this.html = html;
  }
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof SafeHtml)
  );
}

/** Empty values count as false, so `{% if tags %}` is true only when there are tags. */
export function isTruthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof SafeHtml) return value.html !== "";
  if (isRecord(value)) return Object.keys(value).length > 0;
  return Boolean(value);
}

/** Only the fields of the value itself, so that `page.constructor` gives nothing. */
export function ownField(object: unknown, key: string | number): unknown {
  if (!Array.isArray(object) && !isRecord(object)) return undefined;
  return Object.hasOwn(object, key) ? Reflect.get(object, key) : undefined;
}

/** A date from frontmatter: the text as it was written, and its parts. */
export interface TemplateDate {
  readonly text: string;
  readonly year: number;
  readonly month: number;
  readonly day?: number;
  readonly time?: string;
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export function asDate(value: unknown): TemplateDate | undefined {
  if (!isRecord(value)) return undefined;
  const { text, year, month, day, time } = value;
  const isDate =
    typeof text === "string" &&
    isWholeNumber(year) &&
    isWholeNumber(month) &&
    month >= 1 &&
    month <= 12 &&
    (day === undefined || isWholeNumber(day)) &&
    (time === undefined || typeof time === "string");
  if (!isDate) return undefined;
  return {
    text,
    year,
    month,
    ...(day === undefined ? {} : { day }),
    ...(time === undefined ? {} : { time }),
  };
}

/** A month comes before the days in it, because it has no day. */
export function compareDates(first: TemplateDate, second: TemplateDate): number {
  const parts = [
    first.year - second.year,
    first.month - second.month,
    (first.day ?? 0) - (second.day ?? 0),
  ];
  const difference = parts.find((part) => part !== 0);
  if (difference !== undefined) return difference;
  const [firstTime, secondTime] = [first.time ?? "", second.time ?? ""];
  if (firstTime === secondTime) return 0;
  return firstTime < secondTime ? -1 : 1;
}

/** `==` in templates: nothing equals nothing, and dates are equal when they are the same day. */
export function areEqual(left: unknown, right: unknown): boolean {
  const [leftDate, rightDate] = [asDate(left), asDate(right)];
  if (leftDate !== undefined && rightDate !== undefined) {
    return compareDates(leftDate, rightDate) === 0;
  }
  return (left ?? null) === (right ?? null);
}

export function describeValue(value: unknown): string {
  if (value === null || value === undefined) return "nothing";
  if (typeof value === "string") return "text";
  if (typeof value === "number") return "a number";
  if (typeof value === "boolean") return "true or false";
  if (Array.isArray(value)) return "a list";
  if (value instanceof SafeHtml) return "raw HTML";
  return asDate(value) === undefined ? "a group of fields" : "a date";
}

/** The text of a value that can be printed. Lists and groups of fields have none. */
export function printableText(value: unknown): string | undefined {
  if (value === null || value === undefined) return "";
  if (value instanceof SafeHtml) return value.html;
  const date = asDate(value);
  if (date !== undefined) return date.text;
  const type = typeof value;
  return type === "string" || type === "number" || type === "boolean" ? String(value) : undefined;
}

const HTML_ESCAPES: ReadonlyMap<string, string> = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#39;"],
]);

/** Makes text safe in HTML content and in attributes with either kind of quotes. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES.get(character) ?? character);
}
