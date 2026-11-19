/** The orders that lists of content are shown in. Every order ends with a unique key, so a build never changes. */
import type { ContentDate } from "../../frontmatter/index.ts";

export function compareStrings(first: string, second: string): number {
  if (first === second) return 0;
  return first < second ? -1 : 1;
}

/** Ignores capital letters first, so that "apple" comes before "Banana". */
export function compareText(first: string, second: string): number {
  return compareStrings(first.toLowerCase(), second.toLowerCase()) || compareStrings(first, second);
}

/** A month comes before the days in it, because it has no day. */
export function compareDates(first: ContentDate, second: ContentDate): number {
  return (
    first.year - second.year ||
    first.month - second.month ||
    (first.day ?? 0) - (second.day ?? 0) ||
    compareStrings(first.time ?? "", second.time ?? "")
  );
}

/** Entries with an `order` come first, lowest first. */
export function compareOrder(first: number | undefined, second: number | undefined): number {
  if (first === undefined || second === undefined) {
    return Number(first === undefined) - Number(second === undefined);
  }
  return first - second;
}
