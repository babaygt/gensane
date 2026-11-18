import { describe, expect, expectTypeOf, it } from "vitest";
import {
  type ContentDate,
  type Infer,
  type Schema,
  boolean,
  choice,
  dateOrPresent,
  fullDate,
  integer,
  listOf,
  monthOrDate,
  object,
  optional,
  text,
  url,
  validate,
  withDefault,
} from "./schema.ts";
import { FrontmatterCodes, type MapValue, parseFrontmatter } from "./index.ts";

function dataOf(yaml: string): MapValue {
  const result = parseFrontmatter(`---\n${yaml}\n---\n`, "post.md");
  if (!result.ok) throw new Error(result.error[0]?.message);
  return result.value.data;
}

function check(field: Schema<unknown>, yaml: string) {
  return validate(object({ field }), dataOf(yaml));
}

function firstError(field: Schema<unknown>, yaml: string) {
  const result = check(field, yaml);
  return result.ok ? undefined : result.error[0];
}

describe("text", () => {
  it("accepts text", () => {
    expect(check(text(), "field: hello")).toMatchObject({
      ok: true,
      value: { value: { field: "hello" } },
    });
  });

  it.each([
    ["field: 1984", '"1984"'],
    ["field: true", '"true"'],
    ["field: 2026-11-18", '"2026-11-18"'],
  ])("explains how to keep %s as text", (yaml, quoted) => {
    expect(firstError(text(), yaml)).toMatchObject({
      code: FrontmatterCodes.wrongType,
      severity: "error",
      hint: expect.stringContaining(quoted),
    });
  });

  it.each(['field: ""', 'field: "   "'])("rejects the empty text in %s", (yaml) => {
    expect(firstError(text(), yaml)?.code).toBe(FrontmatterCodes.emptyField);
  });

  it("names the field and what was found", () => {
    expect(firstError(text(), "field: 42")?.message).toBe(
      '"field" must be text, but 42 is a number',
    );
  });
});

describe("integer and boolean", () => {
  it.each([
    ["field: 3", 3],
    ["field: -2", -2],
  ])("%s", (yaml, value) => {
    expect(check(integer(), yaml)).toMatchObject({ ok: true, value: { value: { field: value } } });
  });

  it.each(["field: 1.5", "field: three"])("rejects %s as a whole number", (yaml) => {
    expect(firstError(integer(), yaml)?.code).toBe(FrontmatterCodes.wrongType);
  });

  it("accepts true and false only", () => {
    expect(check(boolean(), "field: false")).toMatchObject({ ok: true });
    expect(firstError(boolean(), "field: yes")?.message).toContain("true or false");
  });
});

describe("dates", () => {
  it("returns the parts of a date without its position", () => {
    expect(check(fullDate(), "field: 2026-11-18")).toMatchObject({
      ok: true,
      value: { value: { field: { text: "2026-11-18", year: 2026, month: 11, day: 18 } } },
    });
  });

  it("requires a day in a full date", () => {
    const error = firstError(fullDate(), "field: 2026-11");
    expect(error?.code).toBe(FrontmatterCodes.wrongType);
    expect(error?.hint).toContain("2026-11-01");
  });

  it("accepts a month or a full date", () => {
    expect(check(monthOrDate(), "field: 2024-06")).toMatchObject({ ok: true });
    expect(check(monthOrDate(), "field: 2024-06-15")).toMatchObject({ ok: true });
  });

  it.each([
    ["18-11-2026", "2026-11-18"],
    ["18/11/2026", "2026-11-18"],
    ["18.11.2026", "2026-11-18"],
    ["11-18-2026", "2026-11-18"],
    ["5-13-2026", "2026-05-13"],
  ])("suggests the right form for %s", (written, suggestion) => {
    const error = firstError(fullDate(), `field: ${written}`);
    expect(error?.message).toBe(`"field" must be a date, but "${written}" is text`);
    expect(error?.hint).toBe(`write it as ${suggestion}`);
  });

  it("does not guess when the day and month could be swapped", () => {
    expect(firstError(fullDate(), "field: 03-04-2026")?.hint).toBe(
      "write the date as YYYY-MM-DD, with the year first",
    );
  });

  it("accepts the word present for something that is still going on", () => {
    expect(check(dateOrPresent(), "field: present")).toMatchObject({
      ok: true,
      value: { value: { field: "present" } },
    });
    expect(check(dateOrPresent(), "field: 2024-06")).toMatchObject({ ok: true });
    expect(firstError(dateOrPresent(), "field: now")?.code).toBe(FrontmatterCodes.wrongType);
  });
});

describe("url", () => {
  it.each(["https://example.com/a?b=1", "http://localhost:3000", "/about", "/"])(
    "accepts %s",
    (link) => {
      expect(check(url(), `field: ${link}`)).toMatchObject({ ok: true });
    },
  );

  it.each(["example.com", "ftp://example.com", "https://", "https://a b"])("rejects %s", (link) => {
    expect(firstError(url(), `field: "${link}"`)?.code).toBe(FrontmatterCodes.invalidUrl);
  });

  it("rejects something that is not text", () => {
    expect(firstError(url(), "field: 42")?.code).toBe(FrontmatterCodes.wrongType);
  });
});

describe("choice", () => {
  const status = choice("active", "archived");

  it("accepts a listed value", () => {
    expect(check(status, "field: archived")).toMatchObject({ ok: true });
  });

  it("lists the choices", () => {
    expect(firstError(status, "field: done")).toMatchObject({
      code: FrontmatterCodes.invalidChoice,
      hint: 'use one of: "active", "archived"',
    });
  });

  it("suggests the closest choice for a typo", () => {
    expect(firstError(status, "field: activ")?.hint).toBe('did you mean "active"?');
  });

  it("rejects something that is not text", () => {
    expect(firstError(status, "field: 1")?.code).toBe(FrontmatterCodes.wrongType);
  });
});

describe("listOf", () => {
  it("checks every item", () => {
    expect(check(listOf(text()), "field: [a, b]")).toMatchObject({
      ok: true,
      value: { value: { field: ["a", "b"] } },
    });
  });

  it("reports every wrong item, with its position in the list", () => {
    const result = check(listOf(text()), "field: [a, 1, 2]");
    expect(result.ok ? [] : result.error.map((error) => error.message)).toEqual([
      '"field[1]" must be text, but 1 is a number',
      '"field[2]" must be text, but 2 is a number',
    ]);
  });

  it("shows how to turn a single value into a list", () => {
    expect(firstError(listOf(text()), "field: typescript")?.hint).toBe(
      "write it as a list: [typescript]",
    );
  });
});

describe("object", () => {
  const person = object({ name: text(), age: optional(integer()) });

  it("checks nested settings", () => {
    expect(check(person, "field:\n  name: Ada")).toMatchObject({
      ok: true,
      value: { value: { field: { name: "Ada" } } },
    });
  });

  it("names nested fields with a path", () => {
    expect(firstError(listOf(person), "field:\n  - name: 1")?.message).toContain('"field[0].name"');
  });

  it("reports a missing field at the settings it belongs to", () => {
    const error = firstError(person, "field:\n  age: 3");
    expect(error).toMatchObject({
      code: FrontmatterCodes.missingField,
      message: 'the required field "field.name" is missing',
      span: { start: { line: 3, column: 3 } },
    });
  });

  it("treats an empty value as missing", () => {
    expect(firstError(person, "field:\n  name:\n  age: 3")?.code).toBe(
      FrontmatterCodes.missingField,
    );
  });

  it("reports every problem at once", () => {
    const schema = object({ a: text(), b: integer(), c: boolean() });
    const result = validate(schema, dataOf("b: x\nc: 1"));
    expect(result.ok ? [] : result.error.map((error) => error.code)).toEqual([
      FrontmatterCodes.missingField,
      FrontmatterCodes.wrongType,
      FrontmatterCodes.wrongType,
    ]);
  });

  it("rejects a value that is not a group of settings", () => {
    expect(firstError(person, "field: Ada")?.code).toBe(FrontmatterCodes.wrongType);
  });
});

describe("optional and withDefault", () => {
  it("gives undefined for a missing optional field", () => {
    const result = validate(object({ a: optional(text()) }), dataOf("b: 1"));
    expect(result.ok && result.value.value).toEqual({ a: undefined });
  });

  it("uses the default for a missing or empty field", () => {
    const schema = object({ a: withDefault(boolean(), false) });
    expect(validate(schema, dataOf("b: 1"))).toMatchObject({
      ok: true,
      value: { value: { a: false } },
    });
    expect(validate(schema, dataOf("a:"))).toMatchObject({
      ok: true,
      value: { value: { a: false } },
    });
  });

  it("still checks a value that is present", () => {
    const schema = object({ a: optional(text()), b: withDefault(boolean(), false) });
    expect(validate(schema, dataOf("a: 1\nb: 2"))).toMatchObject({ ok: false });
  });
});

describe("unknown fields", () => {
  const schema = object({ title: text(), tags: withDefault(listOf(text()), []) });

  it("warns about a likely typo and suggests the field", () => {
    const result = validate(schema, dataOf("title: A\ntag: [x]"));
    expect(result.ok && result.value.warnings).toEqual([
      expect.objectContaining({
        code: FrontmatterCodes.unknownField,
        severity: "warning",
        hint: 'did you mean "tags"?',
        span: expect.objectContaining({ start: expect.objectContaining({ line: 3, column: 1 }) }),
      }),
    ]);
  });

  it("notices a different case", () => {
    const result = validate(schema, dataOf("title: A\nTags: [x]"));
    expect(result.ok && result.value.warnings[0]?.hint).toBe('did you mean "tags"?');
  });

  it("allows other custom fields for use in templates", () => {
    const result = validate(schema, dataOf("title: A\nmood: happy"));
    expect(result.ok && result.value.warnings).toEqual([]);
    expect(result.ok && result.value.extra).toEqual({ mood: "happy" });
  });

  it("does not suggest a field that is already used", () => {
    const result = validate(schema, dataOf("title: A\ntitles: B"));
    expect(result.ok && result.value.warnings).toEqual([]);
  });

  it("keeps warnings together with errors", () => {
    const result = validate(schema, dataOf("titel: B"));
    expect(result.ok ? [] : result.error.map((error) => error.severity).toSorted()).toEqual([
      "error",
      "warning",
    ]);
  });
});

describe("inferred types", () => {
  it("derives the result type from the schema", () => {
    const schema = object({
      title: text(),
      views: optional(integer()),
      draft: withDefault(boolean(), false),
      status: choice("active", "archived"),
      tags: listOf(text()),
      date: fullDate(),
      end: dateOrPresent(),
      author: object({ name: text() }),
    });
    expectTypeOf<Infer<typeof schema>>().toEqualTypeOf<{
      readonly title: string;
      readonly views: number | undefined;
      readonly draft: boolean;
      readonly status: "active" | "archived";
      readonly tags: readonly string[];
      readonly date: ContentDate;
      readonly end: ContentDate | "present";
      readonly author: { readonly name: string };
    }>();
  });
});
