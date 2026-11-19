import { describe, expect, it } from "vitest";
import type { Expression, TemplateNode } from "../ast.ts";
import { TemplateCodes } from "../diagnostic-codes.ts";
import { tokenize } from "../lexing/lexer.ts";
import { MAX_BLOCK_DEPTH, parseTemplate } from "./parser.ts";

function parse(source: string) {
  return parseTemplate(tokenize(source, "page.html").tokens);
}

function showExpression(expression: Expression): string {
  switch (expression.kind) {
    case "literal":
      return JSON.stringify(expression.value);
    case "variable":
      return expression.name;
    case "member":
      return `${showExpression(expression.object)}.${expression.name}`;
    case "filter":
      return `${expression.name}(${[expression.input, ...expression.arguments].map(showExpression).join(", ")})`;
    default:
      return expression.kind;
  }
}

/** Writes the block structure on one line, so tests can compare it. */
function show(nodes: readonly TemplateNode[]): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
          return JSON.stringify(node.value);
        case "output":
          return `{${showExpression(node.expression)}}`;
        case "if": {
          const branches = node.branches.map(
            (branch, index) =>
              `${index === 0 ? "if" : "elif"} ${showExpression(branch.condition)} [${show(branch.body)}]`,
          );
          const otherwise = node.otherwise.length > 0 ? ` else [${show(node.otherwise)}]` : "";
          return branches.join(" ") + otherwise;
        }
        case "for": {
          const otherwise = node.otherwise.length > 0 ? ` else [${show(node.otherwise)}]` : "";
          return `for ${node.variable} in ${showExpression(node.iterable)} [${show(node.body)}]${otherwise}`;
        }
      }
    })
    .join(" ");
}

function structure(source: string): string {
  const { nodes, diagnostics } = parse(source);
  expect(diagnostics).toEqual([]);
  return show(nodes);
}

function problems(source: string): string[] {
  return parse(source).diagnostics.map((diagnostic) => diagnostic.code);
}

describe("conditions", () => {
  it("reads an if with its body", () => {
    expect(structure("{% if a %}yes{% endif %}")).toBe('if a ["yes"]');
  });

  it("reads elif and else branches in order", () => {
    expect(structure("{% if a %}1{% elif b %}2{% elif c %}3{% else %}4{% endif %}")).toBe(
      'if a ["1"] elif b ["2"] elif c ["3"] else ["4"]',
    );
  });

  it("reads a full expression as the condition", () => {
    const { nodes } = parse("{% if page.tags | length %}{% endif %}");
    expect(show(nodes)).toBe("if length(page.tags) []");
  });

  it("keeps text and output inside the branches", () => {
    expect(structure("a{% if b %}{{ c }}{% else %}d{% endif %}e")).toBe(
      '"a" if b [{c}] else ["d"] "e"',
    );
  });

  it("gives the node the span of its opening tag", () => {
    expect(parse("ab{% if a %}x{% endif %}").nodes[1]?.span).toMatchObject({
      start: { column: 3 },
      end: { column: 13 },
    });
  });
});

describe("loops", () => {
  it("reads the loop variable and the list", () => {
    expect(structure("{% for post in posts %}{{ post.title }}{% endfor %}")).toBe(
      "for post in posts [{post.title}]",
    );
  });

  it("reads an else for an empty list", () => {
    expect(structure("{% for a in b %}x{% else %}none{% endfor %}")).toBe(
      'for a in b ["x"] else ["none"]',
    );
  });

  it("reads filters on the list", () => {
    expect(structure('{% for a in b | where("draft", false) | take(2) %}{% endfor %}')).toBe(
      'for a in take(where(b, "draft", false), 2) []',
    );
  });

  it("reads blocks inside blocks", () => {
    expect(
      structure(
        "{% for a in b %}{% if a %}{% for c in a %}{{ c }}{% endfor %}{% endif %}{% endfor %}",
      ),
    ).toBe("for a in b [if a [for c in a [{c}]]]");
  });
});

describe("mistakes in blocks", () => {
  it.each([
    ["{% if a %}", TemplateCodes.unclosedBlock],
    ["{% for a in b %}", TemplateCodes.unclosedBlock],
    ["{% if a %}{% else %}", TemplateCodes.unclosedBlock],
    ["{% endif %}", TemplateCodes.noOpenBlock],
    ["{% endfor %}", TemplateCodes.noOpenBlock],
    ["{% else %}", TemplateCodes.noOpenBlock],
    ["{% elif a %}", TemplateCodes.noOpenBlock],
    ["{% for a in b %}{% elif c %}{% endfor %}", TemplateCodes.noOpenBlock],
    ["{% if a %}{% endfor %}{% endif %}", TemplateCodes.noOpenBlock],
    ["{% if a %}{% else %}{% else %}{% endif %}", TemplateCodes.misplacedBranch],
    ["{% if a %}{% else %}{% elif b %}{% endif %}", TemplateCodes.misplacedBranch],
    ["{% for a in b %}{% else %}{% else %}{% endfor %}", TemplateCodes.misplacedBranch],
    ["{% if %}{% endif %}", TemplateCodes.expectedValue],
    ["{% if a b %}{% endif %}", TemplateCodes.unexpectedToken],
    ["{% if a %}{% elif %}{% endif %}", TemplateCodes.expectedValue],
    ["{% if a %}{% else b %}{% endif %}", TemplateCodes.unexpectedToken],
    ["{% if a %}{% endif b %}", TemplateCodes.unexpectedToken],
    ["{% for %}{% endfor %}", TemplateCodes.unexpectedToken],
    ["{% for 1 in b %}{% endfor %}", TemplateCodes.unexpectedToken],
    ["{% for true in b %}{% endfor %}", TemplateCodes.unexpectedToken],
    ["{% for not in b %}{% endfor %}", TemplateCodes.unexpectedToken],
    ["{% for a b %}{% endfor %}", TemplateCodes.unexpectedToken],
    ["{% for a in %}{% endfor %}", TemplateCodes.expectedValue],
    ["{% for a in b c %}{% endfor %}", TemplateCodes.unexpectedToken],
    ["{% for a in b %}{% endfor c %}", TemplateCodes.unexpectedToken],
    ["{% for loop in b %}{% endfor %}", TemplateCodes.reservedName],
    ["{% fi a %}", TemplateCodes.unknownTag],
  ])("%s", (source, code) => {
    expect(problems(source)).toEqual([code]);
  });

  it("names the block that is never closed, and says how to close it", () => {
    expect(parse("{% if a %}").diagnostics).toMatchObject([
      {
        message: "this `if` is never closed",
        hint: "add `{% endif %}` where it should end",
        span: { start: { column: 4 }, end: { column: 6 } },
      },
    ]);
    expect(parse("{% for a in b %}").diagnostics).toMatchObject([
      { message: "this `for` is never closed", hint: "add `{% endfor %}` where it should end" },
    ]);
  });

  it.each([
    ["{% endif %}", "there is no open `if` for this `endif`", "`{% if condition %}`"],
    ["{% endfor %}", "there is no open `for` for this `endfor`", "`{% for item in list %}`"],
    ["{% elif a %}", "there is no open `if` for this `elif`", "`{% if condition %}`"],
    ["{% else %}", "there is no open `if` or `for` for this `else`", "an `if` or a `for`"],
  ])("explains a closing tag without a block: %s", (source, message, opening) => {
    expect(parse(source).diagnostics).toMatchObject([
      { message, hint: `remove it, or add ${opening} before it`, span: { start: { column: 4 } } },
    ]);
  });

  it.each([
    [
      "{% if a %}{% else %}{% else %}{% endif %}",
      "this `if` already has an `else`",
      "remove one of the `else` tags",
    ],
    [
      "{% if a %}{% else %}{% elif b %}{% endif %}",
      "`elif` must come before `else`",
      "move this `elif` above the `else`",
    ],
    [
      "{% for a in b %}{% else %}{% else %}{% endfor %}",
      "this `for` already has an `else`",
      "remove one of the `else` tags",
    ],
  ])("explains a branch after else: %s", (source, message, hint) => {
    expect(parse(source).diagnostics).toMatchObject([{ message, hint }]);
  });

  it("closes the outer block when an inner one is never closed", () => {
    const result = parse("{% if a %}{% for b in c %}x{% endif %}y");
    expect(result.diagnostics).toMatchObject([
      { code: TemplateCodes.unclosedBlock, span: { start: { column: 14 } } },
    ]);
    expect(show(result.nodes)).toBe('if a [for b in c ["x"]] "y"');
  });

  it("closes the outer loop when an inner condition is never closed", () => {
    expect(problems("{% for a in b %}{% if c %}{% endfor %}")).toEqual([
      TemplateCodes.unclosedBlock,
    ]);
  });

  it("keeps the blocks when a condition is broken, so the end tag still matches", () => {
    expect(problems("{% if a + %}x{% endif %}")).toEqual([TemplateCodes.expectedValue]);
    expect(problems("{% for a in %}x{% else %}y{% endfor %}")).toEqual([
      TemplateCodes.expectedValue,
    ]);
  });

  it("does not report a tag again when the lexer has reported its characters", () => {
    expect(problems("{% if a @ %}x{% endif %}")).toEqual([]);
    expect(problems("{% for a in @ %}x{% endfor %}")).toEqual([]);
    expect(problems("{% if a %}{% endif @ %}")).toEqual([]);
  });

  it("suggests elif for else if", () => {
    expect(parse("{% if a %}{% else if b %}{% endif %}").diagnostics).toMatchObject([
      { code: TemplateCodes.unexpectedToken, hint: "write `elif` instead of `else if`" },
    ]);
  });

  it.each([
    ["{% endfi %}", 'did you mean "endif"?'],
    ["{% elseif a %}", 'did you mean "elif"?'],
    ["{% elsif a %}", 'did you mean "elif"?'],
    ["{% nothing %}", "the tags are: if, elif, else, endif, for and endfor"],
    ["{% %}", "the tags are: if, elif, else, endif, for and endfor"],
  ])("suggests a tag for %s", (source, hint) => {
    expect(parse(source).diagnostics[0]?.hint).toBe(hint);
  });

  it("says that loop is already taken", () => {
    expect(parse("{% for loop in b %}{% endfor %}").diagnostics).toMatchObject([
      {
        message: "`loop` is already the name of the information about the current loop",
        hint: "choose another name, such as `item`",
      },
    ]);
  });

  it("continues after a stray tag", () => {
    expect(problems("{% endif %}{{ a b }}{% if c %}{% endif %}")).toEqual([
      TemplateCodes.noOpenBlock,
      TemplateCodes.unexpectedToken,
    ]);
  });
});

function nested(depth: number): string {
  return "{% if a %}".repeat(depth) + "x" + "{% endif %}".repeat(depth);
}

describe("limits on blocks", () => {
  it("limits the nesting of blocks", () => {
    expect(problems(nested(MAX_BLOCK_DEPTH))).toEqual([]);
    expect(problems(nested(MAX_BLOCK_DEPTH + 1))).toEqual([TemplateCodes.nestingTooDeep]);
  });

  it("counts loops and conditions together", () => {
    const depth = MAX_BLOCK_DEPTH / 2;
    const source =
      "{% for a in b %}{% if a %}".repeat(depth) + "{% endif %}{% endfor %}".repeat(depth);
    expect(problems(source)).toEqual([]);
    expect(problems(`{% if a %}${source}{% endif %}`)).toEqual([TemplateCodes.nestingTooDeep]);
  });

  it("counts only nesting, not blocks side by side", () => {
    expect(problems("{% if a %}{% endif %}".repeat(MAX_BLOCK_DEPTH + 1))).toEqual([]);
  });

  it("survives extremely deep nesting", () => {
    expect(problems("{% if a %}".repeat(100_000))).toEqual([TemplateCodes.nestingTooDeep]);
  });

  it("handles very many blocks", () => {
    expect(parse("{% for a in b %}{% endfor %}".repeat(20_000)).nodes).toHaveLength(20_000);
  });
});
