import type { ContentDate } from "../../frontmatter/index.ts";

const TIME = /^(\d{2}:\d{2})(:\d{2})?(.*)$/;

function twoDigits(number: number): string {
  return String(number).padStart(2, "0");
}

/** Posts always have a day; the defaults only keep the type honest. */
function day({ year, month = 1, day: dayOfMonth = 1 }: ContentDate): string {
  return `${year}-${twoDigits(month)}-${twoDigits(dayOfMonth)}`;
}

/** Feeds need seconds and a time zone. A time without a zone is read as UTC. */
export function dateTime(date: ContentDate): string {
  const [, hoursAndMinutes = "00:00", seconds = ":00", zone = ""] =
    TIME.exec(date.time ?? "") ?? [];
  return `${day(date)}T${hoursAndMinutes}${seconds}${zone === "" ? "Z" : zone}`;
}

/** Sitemaps allow a day on its own. */
export function dayOrDateTime(date: ContentDate): string {
  return date.time === undefined ? day(date) : dateTime(date);
}
