// Property-based tests: fast-check generates random templates and values, and these rules must
// hold for all of them.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { positionAt } from "../diagnostics/index.ts";
import { compileTemplate, renderTemplate } from "./index.ts";
import { tokenize } from "./lexing/lexer.ts";

const templatePiece = fc.oneof(
  fc.constantFrom("{{", "}}", "{%", "%}", "{#", "#}", "|", ".", "(", ")", "[", "]", '"', "'", "\\"),
  fc.constantFrom("a", "page", "upper", "not", "and", "or", "true", "null", "0", "1.5", "+", "-"),
  fc.constantFrom(" ", "\n", "\r\n", "\r", "<p>", "/", "%", "==", "<", "@", "😀"),
  fc.string({ maxLength: 4 }),
);

const templateSource = fc.array(templatePiece, { maxLength: 40 }).map((pieces) => pieces.join(""));

type Arithmetic =
  | { readonly kind: "number"; readonly value: number }
  | {
      readonly kind: "operation";
      readonly operator: "+" | "-" | "*";
      readonly left: Arithmetic;
      readonly right: Arithmetic;
    };

const arithmetic = fc.letrec<{ node: Arithmetic }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    fc.nat(20).map((value): Arithmetic => ({ kind: "number", value })),
    fc.record({
      kind: fc.constant("operation" as const),
      operator: fc.constantFrom("+" as const, "-" as const, "*" as const),
      left: tie("node"),
      right: tie("node"),
    }),
  ),
})).node;

function calculate(node: Arithmetic): number {
  if (node.kind === "number") return node.value;
  const left = calculate(node.left);
  const right = calculate(node.right);
  if (node.operator === "+") return left + right;
  return node.operator === "-" ? left - right : left * right;
}

const precedence = { "+": 1, "-": 1, "*": 2 };

/** Writes only the brackets that are needed, so the parser must get precedence right. */
function write(node: Arithmetic, parent = 0, isRightSide = false): string {
  if (node.kind === "number") return String(node.value);
  const level = precedence[node.operator];
  const text = `${write(node.left, level)} ${node.operator} ${write(node.right, level, true)}`;
  return level < parent || (level === parent && isRightSide) ? `(${text})` : text;
}

function decodeHtml(html: string): string {
  return html
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

describe("template properties", () => {
  it("never throws, whatever the template", () => {
    fc.assert(
      fc.property(templateSource, (source) => {
        expect(() => {
          const compiled = compileTemplate(source, "page.html");
          if (compiled.ok) renderTemplate(compiled.value, { a: 1, page: { a: [1] } });
        }).not.toThrow();
      }),
    );
  });

  it("gives every token the same position as an independent calculation", () => {
    fc.assert(
      fc.property(templateSource, (source) => {
        for (const token of tokenize(source, "page.html").tokens) {
          expect(token.span.start).toEqual(positionAt(source, token.span.start.offset));
          expect(token.span.end).toEqual(positionAt(source, token.span.end.offset));
        }
      }),
    );
  });

  it("reports problems in file order", () => {
    fc.assert(
      fc.property(templateSource, (source) => {
        const compiled = compileTemplate(source, "page.html");
        if (compiled.ok) return;
        const offsets = compiled.error.map((problem) => problem.span.start.offset);
        expect(offsets).toEqual(offsets.toSorted((first, second) => first - second));
      }),
    );
  });

  it("returns text without delimiters unchanged", () => {
    const text = fc.string().filter((value) => !/\{[{%#]/.test(value));
    fc.assert(
      fc.property(text, (source) => {
        const compiled = compileTemplate(source, "page.html");
        expect(compiled.ok && renderTemplate(compiled.value, {})).toMatchObject({
          ok: true,
          value: { html: source },
        });
      }),
    );
  });

  it("escapes any text so that it cannot become HTML, and loses nothing", () => {
    const compiled = compileTemplate("{{ value }}", "page.html");
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (value) => {
        const rendered = compiled.ok && renderTemplate(compiled.value, { value });
        const html = rendered && rendered.ok ? rendered.value.html : undefined;
        expect(html).not.toMatch(/[<>"']/);
        expect(decodeHtml(html ?? "")).toBe(value);
      }),
    );
  });

  it("calculates the same result as an independent evaluator", () => {
    fc.assert(
      fc.property(arithmetic, (node) => {
        const compiled = compileTemplate(`{{ ${write(node)} }}`, "page.html");
        expect(compiled.ok && renderTemplate(compiled.value, {})).toMatchObject({
          ok: true,
          value: { html: String(calculate(node)) },
        });
      }),
    );
  });
});
