import { describe, expect, it } from "vitest";
import { type ContentType, FrontmatterCodes, parseFrontmatter, validateContent } from "./index.ts";

function validated(type: ContentType, yaml: string) {
  const result = parseFrontmatter(`---\n${yaml}\n---\n`, "content.md");
  if (!result.ok) throw new Error(result.error[0]?.message);
  return validateContent(type, result.value.data);
}

function codes(type: ContentType, yaml: string): string[] {
  const result = validated(type, yaml);
  return result.ok ? [] : result.error.map((error) => error.code);
}

describe("post", () => {
  it("fills in the defaults", () => {
    const result = validated("post", "title: Hello\ndate: 2026-11-18");
    expect(result).toMatchObject({
      ok: true,
      value: {
        value: { title: "Hello", tags: [], draft: false, description: undefined, cover: undefined },
      },
    });
  });

  it("reads every field", () => {
    const yaml =
      "title: A\ndate: 2026-11-18\nupdated: 2026-11-19\ndescription: B\ntags: [x]\ndraft: true\ncover: /c.png";
    expect(validated("post", yaml)).toMatchObject({
      ok: true,
      value: { value: { description: "B", tags: ["x"], draft: true, cover: "/c.png" } },
    });
  });

  it("requires a title and a date", () => {
    expect(codes("post", "draft: true")).toEqual([
      FrontmatterCodes.missingField,
      FrontmatterCodes.missingField,
    ]);
  });

  it("needs a date with a day", () => {
    expect(codes("post", "title: A\ndate: 2026-11")).toEqual([FrontmatterCodes.wrongType]);
  });

  it("explains a day-first date", () => {
    const result = validated("post", "title: A\ndate: 18-11-2026");
    expect(result.ok ? undefined : result.error[0]).toMatchObject({
      message: '"date" must be a date, but "18-11-2026" is text',
      hint: "write it as 2026-11-18",
      span: { start: { line: 3, column: 7 } },
    });
  });
});

describe("page", () => {
  it("needs only a title", () => {
    expect(validated("page", "title: About")).toMatchObject({
      ok: true,
      value: { value: { title: "About", draft: false } },
    });
  });
});

describe("project", () => {
  it("reads links, stack and status", () => {
    const yaml =
      "title: Gensane\nstack: [TypeScript]\nrepo: https://github.com/a/b\nurl: https://a.dev\nstatus: active\nfeatured: true\norder: 2\nlinks:\n  - name: Docs\n    url: /docs";
    expect(validated("project", yaml)).toMatchObject({
      ok: true,
      value: {
        value: {
          stack: ["TypeScript"],
          status: "active",
          featured: true,
          order: 2,
          links: [{ name: "Docs", url: "/docs" }],
        },
      },
    });
  });

  it("has sensible defaults", () => {
    expect(validated("project", "title: A")).toMatchObject({
      ok: true,
      value: { value: { stack: [], links: [], featured: false } },
    });
  });

  it.each([
    ["title: A\nstatus: finished", FrontmatterCodes.invalidChoice],
    ["title: A\nrepo: github.com/a", FrontmatterCodes.invalidUrl],
    ["title: A\nlinks:\n  - name: Docs", FrontmatterCodes.missingField],
  ])("rejects %j", (yaml, code) => {
    expect(codes("project", yaml)).toEqual([code]);
  });
});

describe("talk", () => {
  it("reads a talk", () => {
    const yaml =
      "title: T\nevent: JSConf\ndate: 2026-06-12\nlocation: Berlin\nslides: https://a.dev/s\nvideo: https://a.dev/v";
    expect(validated("talk", yaml)).toMatchObject({
      ok: true,
      value: { value: { event: "JSConf" } },
    });
  });

  it("requires a title, an event and a date", () => {
    expect(codes("talk", "location: Berlin")).toHaveLength(3);
  });
});

describe("experience", () => {
  const job = "company: Acme\nrole: Engineer\nstart: 2024-06";

  it("reads a job that has ended", () => {
    expect(
      validated("experience", `${job}\nend: 2025-01\nstack: [Go]\nlocation: Berlin\norder: 1`),
    ).toMatchObject({
      ok: true,
      value: { value: { company: "Acme", stack: ["Go"], end: { year: 2025, month: 1 } } },
    });
  });

  it("reads a current job", () => {
    expect(validated("experience", `${job}\nend: present`)).toMatchObject({
      ok: true,
      value: { value: { end: "present" } },
    });
  });

  it("treats a job without an end as current", () => {
    expect(validated("experience", job)).toMatchObject({
      ok: true,
      value: { value: { end: "present" } },
    });
  });

  it("requires a company, a role and a start", () => {
    expect(codes("experience", "location: Berlin")).toHaveLength(3);
  });

  it("rejects an end before the start, and points at the end", () => {
    const result = validated("experience", `${job}\nend: 2024-05`);
    expect(result.ok ? undefined : result.error[0]).toMatchObject({
      code: FrontmatterCodes.invalidDateRange,
      span: { start: { line: 5, column: 6 } },
    });
  });

  it.each(["2024-06", "2024-06-30", "2024-07"])("accepts an end of %s", (end) => {
    expect(validated("experience", `${job}\nend: ${end}`)).toMatchObject({ ok: true });
  });

  it("compares days when both dates have one", () => {
    const yaml = "company: A\nrole: B\nstart: 2024-06-15\nend: 2024-06-14";
    expect(codes("experience", yaml)).toEqual([FrontmatterCodes.invalidDateRange]);
  });

  it("does not compare days when one date is only a month", () => {
    const yaml = "company: A\nrole: B\nstart: 2024-06-15\nend: 2024-06";
    expect(codes("experience", yaml)).toEqual([]);
  });

  it("compares years first", () => {
    const yaml = "company: A\nrole: B\nstart: 2024-06\nend: 2023-12";
    expect(codes("experience", yaml)).toEqual([FrontmatterCodes.invalidDateRange]);
  });
});

describe("education", () => {
  it("reads a degree", () => {
    const yaml = "school: CODE\ndegree: BSc\nfield: Software\nstart: 2023-09\nend: present";
    expect(validated("education", yaml)).toMatchObject({
      ok: true,
      value: { value: { school: "CODE", field: "Software" } },
    });
  });

  it("rejects an end before the start", () => {
    const yaml = "school: A\ndegree: B\nstart: 2024-06\nend: 2024-01";
    expect(codes("education", yaml)).toEqual([FrontmatterCodes.invalidDateRange]);
  });

  it("requires a school, a degree and a start", () => {
    expect(codes("education", "field: x")).toHaveLength(3);
  });
});

describe("custom fields", () => {
  it("are kept for templates", () => {
    expect(validated("page", "title: A\nmood: happy")).toMatchObject({
      ok: true,
      value: { extra: { mood: "happy" } },
    });
  });
});
