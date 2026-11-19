import { describe, expect, it } from "vitest";
import type { Expression } from "../ast.ts";
import { TemplateCodes } from "../diagnostic-codes.ts";
import { tokenize } from "../lexing/lexer.ts";
import { MAX_EXPRESSION_DEPTH, MAX_EXPRESSION_TOKENS, parseTemplate } from "./parser.ts";

function parse(source: string) {
  return parseTemplate(tokenize(source, "page.html").tokens);
}

/** Writes an expression with explicit grouping, so tests can compare its structure. */
function show(node: Expression): string {
  switch (node.kind) {
    case "literal":
      return JSON.stringify(node.value);
    case "variable":
      return node.name;
    case "member":
      return `${show(node.object)}.${node.name}`;
    case "index":
      return `${show(node.object)}[${show(node.index)}]`;
    case "unary":
      return `(${node.operator} ${show(node.operand)})`;
    case "binary":
    case "logical":
      return `(${show(node.left)} ${node.operator} ${show(node.right)})`;
    case "filter": {
      const values = [show(node.input), ...node.arguments.map(show)];
      return `${node.name}(${values.join(", ")})`;
    }
  }
}

function expression(code: string): string {
  const { nodes, diagnostics } = parse(`{{ ${code} }}`);
  expect(diagnostics).toEqual([]);
  const [node] = nodes;
  return node?.kind === "output" ? show(node.expression) : "";
}

function problems(source: string): string[] {
  return parse(source).diagnostics.map((diagnostic) => diagnostic.code);
}

describe("template structure", () => {
  it("keeps text and output in order", () => {
    expect(parse("a{{ b }}c").nodes.map((node) => node.kind)).toEqual(["text", "output", "text"]);
  });

  it("has no nodes for an empty template", () => {
    expect(parse("").nodes).toEqual([]);
  });

  it("gives output the span of its delimiters", () => {
    expect(parse("a {{ b }}").nodes[1]?.span).toMatchObject({
      start: { column: 3 },
      end: { column: 10 },
    });
  });
});

describe("values", () => {
  it.each([
    ['"text"', '"text"'],
    ["42", "42"],
    ["true", "true"],
    ["false", "false"],
    ["null", "null"],
    ["page", "page"],
  ])("reads %s", (code, shown) => {
    expect(expression(code)).toBe(shown);
  });
});

describe("member access", () => {
  it.each([
    ["page.title", "page.title"],
    ["site.author.name", "site.author.name"],
    ["posts[0]", "posts[0]"],
    ['page["title"]', 'page["title"]'],
    ["posts[0].tags[1]", "posts[0].tags[1]"],
    ["posts[index + 1]", "posts[(index + 1)]"],
  ])("reads %s", (code, shown) => {
    expect(expression(code)).toBe(shown);
  });

  it("allows a field with the name of an operator", () => {
    expect(expression("page.not.and")).toBe("page.not.and");
  });
});

describe("filters", () => {
  it.each([
    ["title | upper", "upper(title)"],
    ["title | upper()", "upper(title)"],
    ['title | truncate(40, "...")', 'truncate(title, 40, "...")'],
    ["title | trim | upper", "upper(trim(title))"],
    ["page.title | upper", "upper(page.title)"],
    ["a | b(c | d)", "b(a, d(c))"],
  ])("reads %s", (code, shown) => {
    expect(expression(code)).toBe(shown);
  });
});

describe("operator precedence", () => {
  it.each([
    ["1 + 2 * 3", "(1 + (2 * 3))"],
    ["1 * 2 + 3", "((1 * 2) + 3)"],
    ["(1 + 2) * 3", "((1 + 2) * 3)"],
    ["10 / 2 % 3", "((10 / 2) % 3)"],
    ["-a * b", "((- a) * b)"],
    ["a + b == c", "((a + b) == c)"],
    ["a == b and c == d", "((a == b) and (c == d))"],
    ["a or b and c", "(a or (b and c))"],
    ["a and b or c", "((a and b) or c)"],
    ["not a and b", "((not a) and b)"],
    ["not a == b", "(not (a == b))"],
    ["not not a", "(not (not a))"],
    ["- - a", "(- (- a))"],
    ["-a.b", "(- a.b)"],
    ["a + b | upper", "(a + upper(b))"],
    ["(a + b) | upper", "upper((a + b))"],
    ["posts | length > 0", "(length(posts) > 0)"],
    ["-a | abs", "(- abs(a))"],
  ])("reads %s", (code, shown) => {
    expect(expression(code)).toBe(shown);
  });

  it.each([
    ["a - b - c", "((a - b) - c)"],
    ["a / b / c", "((a / b) / c)"],
    ["a or b or c", "((a or b) or c)"],
    ["a and b and c", "((a and b) and c)"],
  ])("groups %s from the left", (code, shown) => {
    expect(expression(code)).toBe(shown);
  });

  it.each(["==", "!=", "<", "<=", ">", ">="])("reads the comparison %s", (operator) => {
    expect(expression(`a ${operator} b`)).toBe(`(a ${operator} b)`);
  });
});

describe("mistakes", () => {
  it.each([
    ["{{ }}", TemplateCodes.expectedValue],
    ["{{ a + }}", TemplateCodes.expectedValue],
    ["{{ * a }}", TemplateCodes.expectedValue],
    ["{{ and }}", TemplateCodes.expectedValue],
    ["{{ (a }}", TemplateCodes.unexpectedToken],
    ["{{ a[0 }}", TemplateCodes.unexpectedToken],
    ["{{ a. }}", TemplateCodes.unexpectedToken],
    ["{{ a.1 }}", TemplateCodes.unexpectedToken],
    ["{{ a | }}", TemplateCodes.unexpectedToken],
    ["{{ a | 1 }}", TemplateCodes.unexpectedToken],
    ["{{ a | b(1 }}", TemplateCodes.unexpectedToken],
    ["{{ a | b(1,) }}", TemplateCodes.expectedValue],
    ["{{ a b }}", TemplateCodes.unexpectedToken],
    ["{{ a < b < c }}", TemplateCodes.chainedComparison],
    ["{{ a == b != c }}", TemplateCodes.chainedComparison],
    ["{% nothing %}", TemplateCodes.unknownTag],
    ["{% %}", TemplateCodes.unknownTag],
    ["{% 1 %}", TemplateCodes.unknownTag],
  ])("%s", (source, code) => {
    expect(problems(source)).toEqual([code]);
  });

  it("says what it expected and what it found", () => {
    expect(parse("{{ a b }}").diagnostics).toMatchObject([
      {
        severity: "error",
        message: "expected `}}`, but found `b`",
        span: { start: { column: 6 }, end: { column: 7 } },
      },
    ]);
  });

  it("describes the end of the code", () => {
    expect(parse("{{ a + }}").diagnostics[0]?.message).toBe(
      "expected a value, but found the end of the output",
    );
  });

  it("points at the opening of a tag without a name", () => {
    expect(parse("a {% %}").diagnostics[0]?.span.start.column).toBe(3);
  });

  it("does not report a tag whose name the lexer has already reported", () => {
    expect(problems("{% @ %}")).toEqual([]);
  });

  it("names the unknown tag", () => {
    expect(parse("{% nothing %}").diagnostics[0]?.message).toBe('there is no tag named "nothing"');
  });

  it("explains how to replace a chained comparison", () => {
    expect(parse("{{ a < b < c }}").diagnostics[0]?.hint).toBe(
      "compare one pair at a time: `a < b and b < c`",
    );
  });

  it("continues after a mistake, and reports every one", () => {
    const result = parse("{{ a b }}text{{ + }}{{ c }}{% nope %}{{ d }}");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      TemplateCodes.unexpectedToken,
      TemplateCodes.expectedValue,
      TemplateCodes.unknownTag,
    ]);
    expect(result.nodes.map((node) => node.kind)).toEqual(["text", "output", "output"]);
  });

  it("does not report a mistake that the lexer has already reported", () => {
    expect(problems("{{ a @ b }}")).toEqual([]);
    expect(parse("{{ a @ b }}").nodes).toEqual([]);
  });
});

describe("limits", () => {
  it.each([
    ["parentheses", (depth: number) => `${"(".repeat(depth)}a${")".repeat(depth)}`],
    ["not", (depth: number) => `${"not ".repeat(depth)}a`],
    ["minus signs", (depth: number) => `${"- ".repeat(depth)}a`],
    ["indexes", (depth: number) => `${"a[".repeat(depth)}0${"]".repeat(depth)}`],
    ["filter arguments", (depth: number) => `${"a | b(".repeat(depth)}0${")".repeat(depth)}`],
  ])("limits the nesting of %s", (_, nested) => {
    expect(problems(`{{ ${nested(MAX_EXPRESSION_DEPTH)} }}`)).toEqual([]);
    expect(problems(`{{ ${nested(MAX_EXPRESSION_DEPTH + 1)} }}`)).toEqual([
      TemplateCodes.nestingTooDeep,
    ]);
  });

  it("limits the length of an expression", () => {
    const allowed = Array.from(
      { length: Math.floor((MAX_EXPRESSION_TOKENS + 1) / 2) },
      () => "a",
    ).join("+");
    expect(problems(`{{ ${allowed} }}`)).toEqual([]);
    expect(problems(`{{ ${allowed}+a }}`)).toEqual([TemplateCodes.expressionTooLong]);
  });

  it("allows exactly the longest expression", () => {
    const parts = Array.from({ length: 500 }, () => "a").join("+");
    expect(problems(`{{ -${parts} }}`)).toEqual([]);
    expect(problems(`{{ - -${parts} }}`)).toEqual([TemplateCodes.expressionTooLong]);
  });

  it("counts only nesting, not values side by side", () => {
    const parts = Array.from({ length: MAX_EXPRESSION_DEPTH + 1 }, () => "(a)").join(" + ");
    expect(problems(`{{ ${parts} }}`)).toEqual([]);
  });

  it("survives extremely deep nesting", () => {
    expect(problems(`{{ ${"(".repeat(100_000)} }}`)).toEqual([TemplateCodes.expressionTooLong]);
  });

  it("handles very many nodes", () => {
    expect(parse("{{ a }}\n".repeat(50_000)).nodes).toHaveLength(100_000);
  });
});
