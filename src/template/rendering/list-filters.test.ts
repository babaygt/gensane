import { describe, expect, it } from "vitest";
import { TemplateCodes } from "../index.ts";
import { compileCodes, errorCodes, html, renderProblems, value } from "../test-helpers.ts";

type Variables = Readonly<Record<string, unknown>>;

const posts = [
  {
    title: "Banana",
    draft: false,
    views: 3,
    date: { text: "2026-03-01", year: 2026, month: 3, day: 1 },
  },
  { title: "apple", draft: true, views: 10, date: { text: "2025-12", year: 2025, month: 12 } },
  {
    title: "Cherry",
    draft: false,
    views: 1,
    date: { text: "2025-12-24", year: 2025, month: 12, day: 24 },
  },
  {
    title: "date",
    views: 3,
    date: { text: "2026-11-18T10:30:00Z", year: 2026, month: 11, day: 18, time: "10:30:00Z" },
  },
];

function onNewYear(time: string) {
  return { text: "", year: 2026, month: 1, day: 1, time };
}

/** The titles of the posts that a list expression gives, in order. */
function titles(code: string, variables: Variables = { posts }): string {
  return html(
    `{% for post in ${code} %}{{ post.title }}{% if not loop.last %},{% endif %}{% endfor %}`,
    variables,
  );
}

function failure(code: string, variables: Variables) {
  return renderProblems(`{{ ${code} }}`, variables);
}

describe("where", () => {
  it("keeps the items whose field has the value", () => {
    expect(titles('posts | where("draft", false)')).toBe("Banana,Cherry");
    expect(titles('posts | where("views", 3)')).toBe("Banana,date");
  });

  it("keeps the items whose field is true, when there is no value", () => {
    expect(titles('posts | where("draft")')).toBe("apple");
  });

  it("treats a missing field as nothing", () => {
    expect(titles('posts | where("draft", null)')).toBe("date");
  });

  it("compares dates by their value", () => {
    const day = { text: "2025-12-24", year: 2025, month: 12, day: 24 };
    expect(titles('posts | where("date", day)', { posts, day })).toBe("Cherry");
  });

  it("gives an empty list for nothing", () => {
    expect(value('page.posts | where("draft") | length', { page: {} })).toBe("0");
  });

  it("only reads the fields of the items themselves", () => {
    expect(titles('posts | where("constructor")')).toBe("");
  });

  it.each([
    ['"text" | where("draft")', '"where" needs a list, but found text'],
    ['list | where("draft")', '"where" needs items with fields, but the list contains a number'],
    ["posts | where(1)", '"where" needs the name of a field, but found a number'],
  ])("explains %s", (code, message) => {
    expect(failure(code, { posts, list: [1] })).toMatchObject([
      { code: TemplateCodes.filterFailed, message },
    ]);
  });
});

describe("take and skip", () => {
  const list = [1, 2, 3];

  it.each([
    ["take(2)", "1,2"],
    ["take(0)", ""],
    ["take(10)", "1,2,3"],
    ["skip(1)", "2,3"],
    ["skip(0)", "1,2,3"],
    ["skip(10)", ""],
    ["skip(1) | take(1)", "2"],
  ])("%s", (filters, shown) => {
    expect(value(`list | ${filters} | join(",")`, { list })).toBe(shown);
  });

  it("gives an empty list for nothing", () => {
    expect(value("page.posts | take(2) | length", { page: {} })).toBe("0");
  });

  it.each([
    ["take(-1)", '"take" needs a whole number that is not negative, but found -1'],
    ["take(1.5)", '"take" needs a whole number that is not negative, but found 1.5'],
    ['take("2")', '"take" needs a whole number that is not negative, but found text'],
    ["skip(-1)", '"skip" needs a whole number that is not negative, but found -1'],
  ])("rejects %s", (filters, message) => {
    expect(failure(`list | ${filters}`, { list })).toMatchObject([
      { code: TemplateCodes.filterFailed, message },
    ]);
  });
});

describe("sort and reverse", () => {
  it("sorts numbers, and text without caring about capital letters", () => {
    expect(value('list | sort | join(",")', { list: [3, 1, 2] })).toBe("1,2,3");
    expect(value('list | sort | join(",")', { list: ["b", "C", "a", "B"] })).toBe("a,B,b,C");
  });

  it("sorts by a field", () => {
    expect(titles('posts | sort("title")')).toBe("apple,Banana,Cherry,date");
    expect(titles('posts | sort("views")')).toBe("Cherry,Banana,date,apple");
  });

  it("sorts dates, with a month before the days in it", () => {
    expect(titles('posts | sort("date")')).toBe("apple,Cherry,Banana,date");
  });

  it("sorts dates on the same day by their time", () => {
    const list = [
      { title: "late", date: onNewYear("18:00:00Z") },
      { title: "early", date: onNewYear("08:00:00Z") },
      { title: "noon", date: onNewYear("12:00:00Z") },
    ];
    expect(titles('posts | sort("date")', { posts: list })).toBe("early,noon,late");
  });

  it("puts items without the field last", () => {
    const list = [{ title: "a", rank: 2 }, { title: "b" }, { title: "c", rank: 1 }];
    expect(titles('posts | sort("rank")', { posts: list })).toBe("c,a,b");
    expect(value('list | sort | join(",")', { list: [2, null, 1] })).toBe("1,2,");
  });

  it("keeps the order of equal items", () => {
    const list = [
      { title: "first", group: 1 },
      { title: "second", group: 0 },
      { title: "third", group: 1 },
    ];
    expect(titles('posts | sort("group")', { posts: list })).toBe("second,first,third");
  });

  it("reverses a list", () => {
    expect(value('list | reverse | join(",")', { list: [1, 2, 3] })).toBe("3,2,1");
    expect(titles('posts | sort("date") | reverse | take(2)')).toBe("date,Banana");
  });

  it("does not change the list it was given", () => {
    const list = [3, 1, 2];
    value('list | sort | reverse | join(",")', { list });
    expect(list).toEqual([3, 1, 2]);
  });

  it.each([
    ["list | sort", [1, "a"], '"sort" cannot compare a number with text'],
    ["list | sort", [true, false], '"sort" cannot sort true or false'],
    ["list | sort", [{ a: 1 }], '"sort" cannot sort a group of fields'],
    ['list | sort("a")', [1], '"sort" needs items with fields, but the list contains a number'],
    ["list | sort(1)", [], '"sort" needs the name of a field, but found a number'],
    ['"abc" | reverse', [], '"reverse" needs a list, but found text'],
  ])("explains %s with %j", (code, list, message) => {
    expect(failure(code, { list })).toMatchObject([{ code: TemplateCodes.filterFailed, message }]);
  });

  it("suggests a field to sort by", () => {
    expect(failure("list | sort", { list: [{ title: "a" }] })[0]?.hint).toBe(
      'sort by one of its fields, such as `sort("title")`',
    );
  });
});

describe("number of arguments", () => {
  it.each([
    "a | where",
    'a | where("a", 1, 2)',
    "a | take",
    "a | skip(1, 2)",
    'a | sort("a", "b")',
    "a | reverse(1)",
  ])("checks %s", (code) => {
    expect(compileCodes(`{{ ${code} }}`)).toEqual([TemplateCodes.wrongArgumentCount]);
  });
});

describe("chains of filters", () => {
  it("filters, sorts and limits a list in one expression", () => {
    expect(titles('posts | where("draft", false) | sort("date") | reverse | take(1)')).toBe(
      "Banana",
    );
  });

  it("reports the first filter that fails, once", () => {
    expect(errorCodes('"text" | where("a") | take(1) | sort')).toEqual([
      TemplateCodes.filterFailed,
    ]);
  });
});
