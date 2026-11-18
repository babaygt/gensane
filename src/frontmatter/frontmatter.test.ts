import { describe, expect, it } from "vitest";
import { FrontmatterCodes, parseFrontmatter, toPlainData } from "./index.ts";

function parse(yaml: string) {
  return parseFrontmatter(`---\n${yaml}\n---\nBody`, "post.md");
}

function data(yaml: string): unknown {
  const result = parse(yaml);
  if (!result.ok) throw new Error(result.error.map((error) => error.message).join("\n"));
  return toPlainData(result.value.data);
}

function errorCodes(yaml: string): string[] {
  const result = parse(yaml);
  return result.ok ? [] : result.error.map((error) => error.code);
}

function nested(levels: number): string {
  return Array.from({ length: levels + 1 }, (_, level) => `${" ".repeat(level)}a:`).join("\n");
}

describe("finding the frontmatter", () => {
  it("separates the data from the body", () => {
    const result = parseFrontmatter("---\ntitle: Hi\n---\n# Body\n", "a.md");
    expect(result).toMatchObject({ ok: true, value: { body: "# Body\n" } });
  });

  it("reports where the body starts", () => {
    const result = parseFrontmatter("---\na: 1\n---\nBody", "a.md");
    expect(result.ok && result.value.bodyStart).toEqual({ line: 4, column: 1, offset: 13 });
  });

  it("treats a file without frontmatter as all body", () => {
    const result = parseFrontmatter("# Title\n\n---\n", "a.md");
    expect(result.ok && toPlainData(result.value.data)).toEqual({});
    expect(result.ok && result.value.body).toBe("# Title\n\n---\n");
    expect(result.ok && result.value.bodyStart).toEqual({ line: 1, column: 1, offset: 0 });
  });

  it("handles an empty file", () => {
    expect(parseFrontmatter("", "a.md")).toMatchObject({ ok: true, value: { body: "" } });
  });

  it("allows empty frontmatter", () => {
    const result = parseFrontmatter("---\n---\nBody", "a.md");
    expect(result.ok && toPlainData(result.value.data)).toEqual({});
  });

  it("allows nothing after the closing line", () => {
    expect(parseFrontmatter("---\na: 1\n---", "a.md")).toMatchObject({
      ok: true,
      value: { body: "" },
    });
  });

  it("accepts Windows line endings", () => {
    const result = parseFrontmatter("---\r\na: 1\r\n---\r\nBody", "a.md");
    expect(result.ok && toPlainData(result.value.data)).toEqual({ a: 1 });
    expect(result.ok && result.value.body).toBe("Body");
  });

  it("ignores a byte order mark at the start of the file", () => {
    const result = parseFrontmatter("\uFEFF---\na: 1\n---\nBody", "a.md");
    expect(result.ok && toPlainData(result.value.data)).toEqual({ a: 1 });
  });

  it("allows spaces after the fences", () => {
    const result = parseFrontmatter("---  \na: 1\n---  \nBody", "a.md");
    expect(result.ok && result.value.body).toBe("Body");
  });

  it("does not treat a longer line of dashes as a fence", () => {
    const result = parseFrontmatter("----\na: 1\n----\n", "a.md");
    expect(result.ok && result.value.body).toBe("----\na: 1\n----\n");
  });

  it("reports frontmatter that is never closed", () => {
    const result = parseFrontmatter("---\ntitle: Hi\n\nBody", "post.md");
    expect(result).toMatchObject({
      ok: false,
      error: [
        {
          code: FrontmatterCodes.unclosedFrontmatter,
          severity: "error",
          span: { file: "post.md", start: { line: 1, column: 1, offset: 0 } },
        },
      ],
    });
  });
});

describe("scalar values", () => {
  it.each([
    ["a: hello world", "hello world"],
    ["a: 42", 42],
    ["a: -7", -7],
    ["a: 3.14", 3.14],
    ["a: 0", 0],
    ["a: true", true],
    ["a: false", false],
    ["a: null", null],
    ["a: ~", null],
    ["a:", null],
    ["a:   # only a comment", null],
    ["a: hello # a comment", "hello"],
    ["a: C#", "C#"],
    ["a: https://example.com/x", "https://example.com/x"],
    ["a: 12:30", "12:30"],
    ["a: -5 degrees", "-5 degrees"],
  ])("%s", (yaml, expected) => {
    expect(data(yaml)).toEqual({ a: expected });
  });

  // YAML 1.1 reads these as booleans or numbers, which surprises people.
  it.each(["yes", "no", "on", "off", "True", "NULL", "007", "1e3", "1.", ".5", "0x10", "+1"])(
    "keeps %s as text",
    (text) => {
      expect(data(`a: ${text}`)).toEqual({ a: text });
    },
  );

  it("keeps an integer too large to store exactly as text", () => {
    expect(data("a: 12345678901234567890")).toEqual({ a: "12345678901234567890" });
  });
});

describe("dates", () => {
  it.each([
    ["2026-11-18", { year: 2026, month: 11, day: 18 }],
    ["2024-06", { year: 2024, month: 6 }],
    ["2024-02-29", { year: 2024, month: 2, day: 29 }],
    ["2000-02-29", { year: 2000, month: 2, day: 29 }],
    ["2026-11-18T10:30:00Z", { year: 2026, month: 11, day: 18, time: "10:30:00Z" }],
    ["2026-11-18T10:30:00+01:00", { year: 2026, month: 11, day: 18, time: "10:30:00+01:00" }],
  ])("%s", (text, expected) => {
    const result = parse(`a: ${text}`);
    const entry = result.ok ? result.value.data.entries[0] : undefined;
    expect(entry?.value).toMatchObject({ kind: "date", text, ...expected });
  });

  it("gives plain data the text of the date", () => {
    expect(data("a: 2026-11-18")).toEqual({ a: "2026-11-18" });
  });

  it.each([
    "2026-13-01",
    "2026-00-10",
    "2026-02-30",
    "2025-02-29",
    "1900-02-29",
    "2026-04-31",
    "2026-11-00",
  ])("rejects the impossible date %s", (text) => {
    expect(errorCodes(`a: ${text}`)).toEqual([FrontmatterCodes.invalidDate]);
  });

  it.each(["2026-1-5", "26-11-18", "2026/11/18"])("keeps %s as text", (text) => {
    expect(data(`a: ${text}`)).toEqual({ a: text });
  });
});

describe("quoted strings", () => {
  it.each([
    [String.raw`a: "hello: world"`, "hello: world"],
    [String.raw`a: "# not a comment"`, "# not a comment"],
    [String.raw`a: "true"`, "true"],
    [String.raw`a: "42"`, "42"],
    [String.raw`a: ""`, ""],
    [String.raw`a: "line\nbreak\ttab"`, "line\nbreak\ttab"],
    [String.raw`a: "quote \" and \\ slash \/"`, 'quote " and \\ slash /'],
    [String.raw`a: "\u00e9"`, "é"],
    [String.raw`a: "x" # comment`, "x"],
    ["a: 'it''s'", "it's"],
    [String.raw`a: 'no \n escapes'`, String.raw`no \n escapes`],
    ["a: ''", ""],
  ])("%s", (yaml, expected) => {
    expect(data(yaml)).toEqual({ a: expected });
  });

  it.each([
    [String.raw`a: "open`, FrontmatterCodes.unterminatedString],
    ["a: 'open", FrontmatterCodes.unterminatedString],
    [String.raw`a: "ends with \"`, FrontmatterCodes.unterminatedString],
    [String.raw`a: "bad \q"`, FrontmatterCodes.invalidEscape],
    [String.raw`a: "bad \u12"`, FrontmatterCodes.invalidEscape],
    [String.raw`a: "x" y`, FrontmatterCodes.textAfterValue],
  ])("%s is an error", (yaml, code) => {
    expect(errorCodes(yaml)).toEqual([code]);
  });
});

describe("maps", () => {
  it("reads several keys", () => {
    expect(data("title: Hi\ndraft: false\nviews: 3")).toEqual({
      title: "Hi",
      draft: false,
      views: 3,
    });
  });

  it("reads nested maps", () => {
    expect(data("a:\n  b:\n    c: 1\n  d: 2\ne: 3")).toEqual({ a: { b: { c: 1 }, d: 2 }, e: 3 });
  });

  it("skips comments and blank lines", () => {
    expect(data("# start\na: 1\n\n  # indented comment\nb: 2\n")).toEqual({ a: 1, b: 2 });
  });

  it("allows dots, dashes and underscores in keys", () => {
    expect(data("a-b: 1\nc_d: 2\ne.f: 3")).toEqual({ "a-b": 1, c_d: 2, "e.f": 3 });
  });

  it("keeps the order of the keys", () => {
    expect(Object.keys(data("z: 1\na: 2") as object)).toEqual(["z", "a"]);
  });

  it("stores a key named __proto__ as ordinary data", () => {
    const value = data("__proto__: 1") as Record<string, unknown>;
    expect(Object.getOwnPropertyNames(value)).toEqual(["__proto__"]);
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  });
});

describe("lists", () => {
  it.each([
    ["a:\n  - x\n  - 2\n  - true", ["x", 2, true]],
    ["a:\n- x\n- y", ["x", "y"]],
    ["a: [x, 2, true]", ["x", 2, true]],
    ["a: []", []],
    ["a: [ x , y ]", ["x", "y"]],
    ["a: [x, y,]", ["x", "y"]],
    ["a: [\"x, y\", 'z']", ["x, y", "z"]],
    ["a: [[1, 2], [3]]", [[1, 2], [3]]],
    ["a: [2026-11-18, null]", ["2026-11-18", null]],
    ["a: [x] # comment", ["x"]],
    ["a: [C#, F#]", ["C#", "F#"]],
    ["a:\n  -\n  - x", [null, "x"]],
    ["a:\n  - [1, 2]\n  - y", [[1, 2], "y"]],
    ['a:\n  - "quoted"', ["quoted"]],
  ])("%j", (yaml, expected) => {
    expect(data(yaml)).toEqual({ a: expected });
  });

  it("accepts a tab after the dash", () => {
    expect(data("a:\n  -\tx")).toEqual({ a: ["x"] });
  });

  it("lines up a map with its first key, however far that is from the dash", () => {
    expect(data("a:\n  -   b: 1\n      c: 2")).toEqual({ a: [{ b: 1, c: 2 }] });
  });

  it("reads a list of maps", () => {
    expect(data("a:\n  - name: x\n    url: y\n  - name: z")).toEqual({
      a: [{ name: "x", url: "y" }, { name: "z" }],
    });
  });

  it("reads a map nested under a list item", () => {
    expect(data("a:\n  - b:\n      c: 1\n    d: 2")).toEqual({ a: [{ b: { c: 1 }, d: 2 }] });
  });

  it("reads a value on the lines after a dash", () => {
    expect(data("a:\n  -\n    b: 1\n  -\n    - 2")).toEqual({ a: [{ b: 1 }, [2]] });
  });

  it("reads lists inside lists", () => {
    expect(data("a:\n  - - 1\n    - 2\n  - - 3")).toEqual({ a: [[1, 2], [3]] });
  });

  it("continues with the next key after a list at the same indentation", () => {
    expect(data("a:\n- x\nb: 1")).toEqual({ a: ["x"], b: 1 });
  });

  it("keeps a dash without a space as text", () => {
    expect(data("a:\n  - -x")).toEqual({ a: ["-x"] });
  });
});

describe("errors", () => {
  it.each([
    ["no colon here", FrontmatterCodes.invalidEntry],
    ["a:b", FrontmatterCodes.invalidEntry],
    ["my key: 1", FrontmatterCodes.invalidEntry],
    ["a: 1\na: 2", FrontmatterCodes.duplicateKey],
    ["\ta: 1", FrontmatterCodes.tabIndentation],
    ["a:\n\tb: 1", FrontmatterCodes.tabIndentation],
    ["a: [1, 2", FrontmatterCodes.unterminatedList],
    ["a: [1 2] x", FrontmatterCodes.textAfterValue],
    ["a: 1\n  b: 2", FrontmatterCodes.unexpectedIndentation],
    ["  a: 1\nb: 2", FrontmatterCodes.unexpectedIndentation],
    ["a:\n    b: 1\n  c: 2", FrontmatterCodes.unexpectedIndentation],
    ["a:\n  - x\n    y: 1", FrontmatterCodes.unexpectedIndentation],
    ["a: Hello: World", FrontmatterCodes.valueNeedsQuotes],
    ["a: - x", FrontmatterCodes.valueNeedsQuotes],
    ['a: ["x" "y"]', FrontmatterCodes.textAfterValue],
    ["a: [x,,y]", FrontmatterCodes.invalidEntry],
    ["a: ends with colon:", FrontmatterCodes.valueNeedsQuotes],
    ["a: {b: 1}", FrontmatterCodes.unsupportedSyntax],
    ["a: &anchor x", FrontmatterCodes.unsupportedSyntax],
    ["a: *alias", FrontmatterCodes.unsupportedSyntax],
    ["a: !tag x", FrontmatterCodes.unsupportedSyntax],
    ["a: |", FrontmatterCodes.unsupportedSyntax],
    ["a: >", FrontmatterCodes.unsupportedSyntax],
    ["a: %x", FrontmatterCodes.unsupportedSyntax],
    ["a: @x", FrontmatterCodes.unsupportedSyntax],
    ["a: `x`", FrontmatterCodes.unsupportedSyntax],
    ["a: [{b: 1}]", FrontmatterCodes.unsupportedSyntax],
    ["- a\n- b", FrontmatterCodes.invalidEntry],
  ])("%j", (yaml, code) => {
    expect(errorCodes(yaml)).toContain(code);
  });

  it("reports every problem in one run", () => {
    expect(errorCodes('bad line\nb: "open\nc: ok\nd: {x}\nb: 1')).toEqual([
      FrontmatterCodes.invalidEntry,
      FrontmatterCodes.unterminatedString,
      FrontmatterCodes.unsupportedSyntax,
      FrontmatterCodes.duplicateKey,
    ]);
  });

  it("reports problems in the order they appear in the file", () => {
    expect(errorCodes("bad line\n\tb: 1")).toEqual([
      FrontmatterCodes.invalidEntry,
      FrontmatterCodes.tabIndentation,
    ]);
  });

  it("reports one error for an impossible date inside a list", () => {
    expect(errorCodes("a: [2026-13-01, x]")).toEqual([FrontmatterCodes.invalidDate]);
  });

  it.each(["a: 1\n  b: 2", "a:\n  - x\n    y: 1"])(
    "explains that the entry above %j already has a value",
    (yaml) => {
      const result = parse(yaml);
      expect(result.ok ? "" : result.error[0]?.message).toContain("already has a value");
    },
  );

  it("does not report the nested lines of a broken entry again", () => {
    expect(errorCodes("bad line\n  a: 1\n  b: 2\nc: 3")).toEqual([FrontmatterCodes.invalidEntry]);
  });

  it("points at the exact position", () => {
    const result = parseFrontmatter('---\ntitle: ok\nname: "open\n---\n', "post.md");
    expect(result.ok ? [] : result.error[0]?.span).toEqual({
      file: "post.md",
      start: { line: 3, column: 7, offset: 20 },
      end: { line: 3, column: 12, offset: 25 },
    });
  });

  it.each([
    ["a: Hello: World", "quotes"],
    ["a:b", "space"],
    ["a: {b: 1}", "list"],
    ["a: |", "quotes"],
    ["\ta: 1", "spaces"],
  ])("gives %j a hint that mentions %s", (yaml, word) => {
    const result = parse(yaml);
    expect(result.ok ? "" : result.error[0]?.hint).toContain(word);
  });

  it("limits nesting instead of crashing", () => {
    const deepFlow = `a: ${"[".repeat(50_000)}`;
    const deepList = `a:\n  ${"- ".repeat(50_000)}x`;
    expect(errorCodes(deepFlow)).toContain(FrontmatterCodes.nestingTooDeep);
    expect(errorCodes(deepList)).toContain(FrontmatterCodes.nestingTooDeep);
  });

  it("allows 64 levels of nested maps", () => {
    expect(errorCodes(nested(64))).toEqual([]);
    expect(errorCodes(nested(65))).toEqual([FrontmatterCodes.nestingTooDeep]);
  });

  it("allows 64 levels of nesting", () => {
    expect(errorCodes(`a: ${"[".repeat(64)}${"]".repeat(64)}`)).toEqual([]);
    expect(errorCodes(`a: ${"[".repeat(65)}${"]".repeat(65)}`)).toEqual([
      FrontmatterCodes.nestingTooDeep,
    ]);
  });
});

describe("source positions of values", () => {
  it("cover a key and its value", () => {
    const result = parseFrontmatter("---\ntitle: Hello\n---\n", "a.md");
    const entry = result.ok ? result.value.data.entries[0] : undefined;
    expect(entry?.keySpan).toMatchObject({
      start: { line: 2, column: 1, offset: 4 },
      end: { line: 2, column: 6, offset: 9 },
    });
    expect(entry?.value.span).toMatchObject({
      start: { line: 2, column: 8, offset: 11 },
      end: { line: 2, column: 13, offset: 16 },
    });
  });

  it("leave out a trailing comment", () => {
    const result = parseFrontmatter("---\na: b  # note\n---\n", "a.md");
    const entry = result.ok ? result.value.data.entries[0] : undefined;
    expect(entry?.value.span.end.column).toBe(5);
  });

  it("cover a whole list, including the nested lines of its last item", () => {
    const result = parseFrontmatter("---\na:\n  - b: 1\n    c: 2\n---\n", "a.md");
    const list = result.ok ? result.value.data.entries[0]?.value : undefined;
    expect(list?.span).toMatchObject({
      start: { line: 3, column: 3 },
      end: { line: 4, column: 9 },
    });
  });

  it("are exact inside a list item", () => {
    const result = parseFrontmatter("---\na:\n  - name: x\n---\n", "a.md");
    const list = result.ok ? result.value.data.entries[0]?.value : undefined;
    const item = list?.kind === "list" ? list.items[0] : undefined;
    const entry = item?.kind === "map" ? item.entries[0] : undefined;
    expect(entry?.value.span.start).toMatchObject({ line: 3, column: 11 });
  });
});
