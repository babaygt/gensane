import { describe, expect, it } from "vitest";
import { TemplateCodes } from "../index.ts";
import { compileCodes, renderProblems, value } from "../test-helpers.ts";

const day = { text: "2026-03-07", year: 2026, month: 3, day: 7 };
const month = { text: "2024-06", year: 2024, month: 6 };
const withTime = {
  text: "2026-11-18T10:30:00Z",
  year: 2026,
  month: 11,
  day: 18,
  time: "10:30:00Z",
};

function formatted(format: string, date: unknown = day): string {
  return value(`date | date("${format}")`, { date });
}

describe("formatting dates", () => {
  it.each([
    ["MMM d, yyyy", "Mar 7, 2026"],
    ["MMMM d, yyyy", "March 7, 2026"],
    ["d MMMM yyyy", "7 March 2026"],
    ["yyyy-MM-dd", "2026-03-07"],
    ["dd.MM.yyyy", "07.03.2026"],
    ["M/d/yyyy", "3/7/2026"],
    ["yyyy", "2026"],
    ["MMMMd", "March7"],
  ])("%s gives %s", (format, shown) => {
    expect(formatted(format)).toBe(shown);
  });

  it.each([
    [1, "January"],
    [5, "May"],
    [9, "September"],
    [12, "December"],
  ])("names month %i", (number, name) => {
    const date = { text: "", year: 2026, month: number, day: 1 };
    expect(formatted("MMMM", date)).toBe(name);
    expect(formatted("MMM", date)).toBe(name.slice(0, 3));
  });

  it("formats a month without a day", () => {
    expect(formatted("MMMM yyyy", month)).toBe("June 2024");
  });

  it("formats only the day of a date with a time", () => {
    expect(formatted("MMM d, yyyy", withTime)).toBe("Nov 18, 2026");
  });

  it("keeps other characters as they are, and escapes them", () => {
    expect(formatted("<yyyy> & 'MM'")).toBe("&lt;2026&gt; &amp; &#39;03&#39;");
  });

  it("gives nothing for a date that is not there", () => {
    expect(value('page.updated | date("yyyy")', { page: {} })).toBe("");
  });
});

function problem(format: string, date: unknown = day) {
  return renderProblems(`{{ date | date("${format}") }}`, { date });
}

describe("mistakes with dates", () => {
  it("explains that a month has no day", () => {
    expect(problem("d MMMM yyyy", month)).toMatchObject([
      {
        code: TemplateCodes.filterFailed,
        message: 'this date is only a month, so it has no day for "d"',
        hint: 'use a format without the day, such as "MMMM yyyy"',
      },
    ]);
  });

  it.each(["yy", "MMMMM", "ddd", "D", "EEE", "h:mm"])("rejects the letters in %s", (format) => {
    expect(problem(format)).toMatchObject([
      {
        code: TemplateCodes.filterFailed,
        message: expect.stringMatching(/^"[A-Za-z]+" is not a part of a date$/),
        hint: "use yyyy, M, MM, MMM, MMMM, d or dd, and only other characters between them",
      },
    ]);
  });

  it("names the letters it does not know", () => {
    expect(problem("yy")[0]?.message).toBe('"yy" is not a part of a date');
  });

  it.each([
    ["text", '"2026-03-07"', "text"],
    ["a number", "2026", "a number"],
    ["a group of fields", "page", "a group of fields"],
  ])("rejects %s as the date", (_, code, found) => {
    expect(renderProblems(`{{ ${code} | date("yyyy") }}`, { page: { a: 1 } })).toMatchObject([
      {
        code: TemplateCodes.filterFailed,
        message: `"date" needs a date, but found ${found}`,
        hint: "dates come from fields such as `page.date`",
      },
    ]);
  });

  it("needs the format as text", () => {
    expect(renderProblems("{{ date | date(1) }}", { date: day })).toMatchObject([
      { message: '"date" needs a format such as "MMM d, yyyy", but found a number' },
    ]);
  });

  it("needs exactly one format", () => {
    expect(compileCodes("{{ a | date }}")).toEqual([TemplateCodes.wrongArgumentCount]);
  });
});

describe("dates as values", () => {
  it("prints a date as it was written", () => {
    expect(value("date", { date: day })).toBe("2026-03-07");
    expect(value("date", { date: withTime })).toBe("2026-11-18T10:30:00Z");
  });

  it("compares dates by their value", () => {
    expect(value("a == b", { a: day, b: { ...day } })).toBe("true");
    expect(value("a != b", { a: day, b: month })).toBe("true");
  });

  it("describes a date as a date", () => {
    expect(renderProblems("{{ date | upper }}", { date: day })[0]?.message).toBe(
      '"upper" needs text, but found a date',
    );
  });
});
