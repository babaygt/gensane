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

export function describeValue(value: unknown): string {
  if (value === null || value === undefined) return "nothing";
  if (typeof value === "string") return "text";
  if (typeof value === "number") return "a number";
  if (typeof value === "boolean") return "true or false";
  if (Array.isArray(value)) return "a list";
  return value instanceof SafeHtml ? "raw HTML" : "a group of fields";
}

/** The text of a value that can be printed. Lists and groups of fields have none. */
export function printableText(value: unknown): string | undefined {
  if (value === null || value === undefined) return "";
  if (value instanceof SafeHtml) return value.html;
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
