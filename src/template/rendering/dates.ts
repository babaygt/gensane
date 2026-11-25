/**
 * The `date` filter. Dates are always written as `2026-11-18` in frontmatter, and a template
 * decides how they look: `{{ page.date | date("MMM d, yyyy") }}` gives `Nov 18, 2026`.
 */
import { FilterError, type TemplateFilter } from "./filter-types.ts";
import { type TemplateDate, asDate, describeValue } from "./values.ts";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function twoDigits(number: number): string {
  return String(number).padStart(2, "0");
}

/** A year alone has no month; a template shows it with "yyyy". */
function monthOf(date: TemplateDate, letters: string): number {
  if (date.month === undefined) {
    throw new FilterError(
      `this date is only a year, so it has no month for "${letters}"`,
      'use "yyyy" alone, or check the date\'s `month` first',
    );
  }
  return date.month;
}

/** Every other letter is a mistake rather than text, so that `Today` never becomes `To18ay`. */
function datePart(date: TemplateDate, letters: string): string {
  switch (letters) {
    case "yyyy":
      return String(date.year).padStart(4, "0");
    case "M":
      return String(monthOf(date, letters));
    case "MM":
      return twoDigits(monthOf(date, letters));
    case "MMM":
      return (MONTHS[monthOf(date, letters) - 1] ?? "").slice(0, 3);
    case "MMMM":
      return MONTHS[monthOf(date, letters) - 1] ?? "";
    case "d":
    case "dd":
      if (date.day === undefined) {
        const only = date.month === undefined ? "a year" : "a month";
        throw new FilterError(
          `this date is only ${only}, so it has no day for "${letters}"`,
          'use a format without the day, such as "MMMM yyyy"',
        );
      }
      return letters === "d" ? String(date.day) : twoDigits(date.day);
    default:
      throw new FilterError(
        `"${letters}" is not a part of a date`,
        "use yyyy, M, MM, MMM, MMMM, d or dd, and only other characters between them",
      );
  }
}

export function formatDate(date: TemplateDate, format: string): string {
  return format.replace(/([A-Za-z])\1*/g, (letters) => datePart(date, letters));
}

export const dateFilter: TemplateFilter = (value, format) => {
  if (value === null || value === undefined) return "";
  const date = asDate(value);
  if (date === undefined) {
    throw new FilterError(
      `"date" needs a date, but found ${describeValue(value)}`,
      "dates come from fields such as `page.date`",
    );
  }
  if (typeof format !== "string") {
    throw new FilterError(
      `"date" needs a format such as "MMM d, yyyy", but found ${describeValue(format)}`,
    );
  }
  return formatDate(date, format);
};
