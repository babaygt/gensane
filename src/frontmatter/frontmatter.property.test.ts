// Property-based tests: fast-check generates random data and random text, and these rules must
// hold for all of it.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type SourceSpan, positionAt } from "../diagnostics/index.ts";
import { type FrontmatterValue, parseFrontmatter, toPlainData } from "./index.ts";

type Data = string | number | boolean | null | readonly Data[] | { readonly [key: string]: Data };

const key = fc.stringMatching(/^[a-z][a-z0-9_-]{0,6}$/);

const scalar: fc.Arbitrary<Data> = fc.oneof(
  fc.string({ unit: "binary", maxLength: 12 }),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
);

const data = fc.letrec<{ value: Data; map: Data }>((tie) => ({
  value: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    scalar,
    fc.array(tie("value"), { maxLength: 3 }),
    tie("map"),
  ),
  map: fc.dictionary(key, tie("value"), { minKeys: 1, maxKeys: 3, noNullPrototype: false }),
})).map;

function isMap(value: Data): value is { readonly [key: string]: Data } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scalarText(value: Data): string {
  return Array.isArray(value) ? "[]" : JSON.stringify(value);
}

/** Writes data the way a person would, with blocks for nested values. */
function toYamlLines(value: Data): string[] {
  if (isMap(value)) {
    return Object.entries(value).flatMap(([name, item]) => {
      const nested = isMap(item) || (Array.isArray(item) && item.length > 0);
      if (!nested) return [`${name}: ${scalarText(item)}`];
      return [`${name}:`, ...toYamlLines(item).map((line) => `  ${line}`)];
    });
  }
  if (Array.isArray(value) && value.length > 0) {
    return (value as readonly Data[]).flatMap((item) => {
      const [first = "", ...rest] = isNested(item) ? toYamlLines(item) : [scalarText(item)];
      return [`- ${first}`, ...rest.map((line) => `  ${line}`)];
    });
  }
  return [scalarText(value)];
}

function isNested(value: Data): boolean {
  return isMap(value) || (Array.isArray(value) && value.length > 0);
}

function allSpans(value: FrontmatterValue): SourceSpan[] {
  if (value.kind === "list") return [value.span, ...value.items.flatMap(allSpans)];
  if (value.kind === "map") {
    return [
      value.span,
      ...value.entries.flatMap((entry) => [entry.keySpan, ...allSpans(entry.value)]),
    ];
  }
  return [value.span];
}

const yamlLike = fc.string({
  unit: fc.constantFrom(
    "\n",
    "\r\n",
    " ",
    "  ",
    "\t",
    "a",
    "key: ",
    "b: 1",
    "- ",
    "-",
    ":",
    "#",
    " # x",
    '"',
    "'",
    "\\",
    "[",
    "]",
    ",",
    "{",
    "&",
    "*",
    "|",
    "2026-02-30",
    "2026-11-18",
    "true",
    "null",
    "42",
  ),
  maxLength: 50,
});

describe("frontmatter properties", () => {
  it("reads back any data that was written as frontmatter", () => {
    fc.assert(
      fc.property(data, (value) => {
        const source = `---\n${toYamlLines(value).join("\n")}\n---\nBody`;
        const result = parseFrontmatter(source, "x.md");
        expect(result.ok && toPlainData(result.value.data)).toEqual(value);
      }),
    );
  });

  it("never throws, whatever the input", () => {
    fc.assert(
      fc.property(fc.oneof(yamlLike, fc.string({ unit: "binary" })), (text) => {
        expect(() => parseFrontmatter(`---\n${text}\n---\n`, "x.md")).not.toThrow();
      }),
    );
  });

  it("gives every value and error the same position as an independent calculation", () => {
    fc.assert(
      fc.property(yamlLike, (text) => {
        const source = `---\n${text}\n---\n`;
        const result = parseFrontmatter(source, "x.md");
        const spans = result.ok
          ? allSpans(result.value.data)
          : result.error.map((error) => error.span);
        for (const span of spans) {
          expect(span.start).toEqual(positionAt(source, span.start.offset));
          expect(span.end).toEqual(positionAt(source, span.end.offset));
          expect(span.end.offset).toBeGreaterThanOrEqual(span.start.offset);
        }
      }),
    );
  });

  it("returns the body unchanged", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (body) => {
        const result = parseFrontmatter(`---\na: 1\n---\n${body}`, "x.md");
        expect(result.ok && result.value.body).toBe(body);
      }),
    );
  });
});
