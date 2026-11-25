/** What each type of content file must contain. The data types are inferred from these schemas. */
import type { Diagnostic, Result } from "../../diagnostics/index.ts";
import { FrontmatterCodes } from "../diagnostic-codes.ts";
import {
  type ContentDate,
  type FieldRule,
  type Infer,
  type ObjectSchema,
  type Validated,
  boolean,
  choice,
  dateOrPresent,
  fullDate,
  integer,
  listOf,
  monthOrDate,
  object,
  optional,
  ruleProblem,
  text,
  url,
  validate,
  withDefault,
  withRule,
} from "./schema.ts";
import type { MapValue } from "../values.ts";

const tags = () => withDefault(listOf(text()), []);

/** Whether `end` is earlier. Months and days only count when both dates have them. */
function isBefore(end: ContentDate, start: ContentDate): boolean {
  if (end.year !== start.year) return end.year < start.year;
  if (end.month === undefined || start.month === undefined) return false;
  if (end.month !== start.month) return end.month < start.month;
  return end.day !== undefined && start.day !== undefined && end.day < start.day;
}

const endsAfterStart: FieldRule<{
  readonly start: ContentDate;
  readonly end: ContentDate | "present";
}> = ({ start, end }, data) => {
  if (end === "present" || !isBefore(end, start)) return undefined;
  const span = data.entries.find((entry) => entry.key === "end")?.value.span ?? data.span;
  return ruleProblem(
    FrontmatterCodes.invalidDateRange,
    `"end" (${end.text}) is before "start" (${start.text})`,
    span,
    "check the two dates, or use `end: present` if this is still going on",
  );
};

const post = object({
  title: text(),
  slug: optional(text()),
  date: fullDate(),
  updated: optional(fullDate()),
  description: optional(text()),
  tags: tags(),
  draft: withDefault(boolean(), false),
  cover: optional(text()),
  /** What the cover shows, for screen readers. Without it, the cover is only decoration. */
  coverAlt: optional(text()),
});

const page = object({
  title: text(),
  slug: optional(text()),
  description: optional(text()),
  draft: withDefault(boolean(), false),
  /** Where the page comes in its section: lower first, then by title. */
  order: optional(integer()),
});

const project = object({
  title: text(),
  slug: optional(text()),
  description: optional(text()),
  stack: tags(),
  repo: optional(url()),
  /** Not `url`, which templates use for the address of the page itself. */
  website: optional(url()),
  links: withDefault(listOf(object({ name: text(), url: url() })), []),
  status: optional(choice("active", "paused", "archived")),
  featured: withDefault(boolean(), false),
  draft: withDefault(boolean(), false),
  cover: optional(text()),
  /** What the cover shows, for screen readers. Without it, the cover is only decoration. */
  coverAlt: optional(text()),
  order: optional(integer()),
});

const talk = object({
  title: text(),
  event: text(),
  date: fullDate(),
  description: optional(text()),
  location: optional(text()),
  slides: optional(url()),
  video: optional(url()),
});

const experience = withRule(
  object({
    company: text(),
    role: text(),
    start: monthOrDate(),
    end: withDefault(dateOrPresent(), "present"),
    location: optional(text()),
    /** One line after the dates and the place, such as "Part-time". */
    note: optional(text()),
    stack: tags(),
    order: optional(integer()),
  }),
  endsAfterStart,
);

const education = withRule(
  object({
    school: text(),
    degree: text(),
    field: optional(text()),
    start: monthOrDate(),
    end: withDefault(dateOrPresent(), "present"),
    location: optional(text()),
    /** One line after the dates and the place, such as "Incomplete". */
    note: optional(text()),
    order: optional(integer()),
  }),
  endsAfterStart,
);

export const contentSchemas = { post, page, project, talk, experience, education };

export type ContentType = keyof typeof contentSchemas;

export type ContentFields<Type extends ContentType> = Infer<(typeof contentSchemas)[Type]>;

/** Checks the frontmatter of a content file against the rules for its type. */
export function validateContent<Type extends ContentType>(
  type: Type,
  data: MapValue,
): Result<Validated<ContentFields<Type>>, readonly Diagnostic[]> {
  return validate(contentSchemas[type] as ObjectSchema<ContentFields<Type>>, data);
}
