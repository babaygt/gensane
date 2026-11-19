import { describe, expect, it } from "vitest";
import { positionAt } from "../../diagnostics/index.ts";
import { TemplateCodes } from "../diagnostic-codes.ts";
import { tokenize } from "./lexer.ts";
import type { Token } from "./tokens.ts";

function brief(token: Token): unknown {
  return "value" in token ? [token.kind, token.value] : token.kind;
}

function tokens(source: string): unknown[] {
  return tokenize(source, "page.html").tokens.map(brief);
}

function problems(source: string): string[] {
  return tokenize(source, "page.html").diagnostics.map((diagnostic) => diagnostic.code);
}

function inOutput(code: string): unknown[] {
  return tokens(`{{ ${code} }}`).slice(1, -2);
}

describe("text", () => {
  it("keeps text outside of tags exactly as written", () => {
    expect(tokens("<p>\n  Hello { world }\n</p>")).toEqual([
      ["text", "<p>\n  Hello { world }\n</p>"],
      "end",
    ]);
  });

  it("produces only the end for an empty template", () => {
    expect(tokens("")).toEqual(["end"]);
  });
});

describe("delimiters", () => {
  it("separates output from the text around it", () => {
    expect(tokens("a{{ b }}c")).toEqual([
      ["text", "a"],
      "outputOpen",
      ["name", "b"],
      "outputClose",
      ["text", "c"],
      "end",
    ]);
  });

  it("reads a tag", () => {
    expect(tokens("{% name %}")).toEqual(["tagOpen", ["name", "name"], "tagClose", "end"]);
  });

  it("allows code to continue over several lines", () => {
    expect(tokens("{{\n  a\n}}")).toEqual(["outputOpen", ["name", "a"], "outputClose", "end"]);
  });

  it("does not need spaces inside the delimiters", () => {
    expect(tokens("{{a}}")).toEqual(["outputOpen", ["name", "a"], "outputClose", "end"]);
  });

  it("does not end the output at a closing delimiter inside a string", () => {
    expect(tokens('{{ "}}" }}')).toEqual(["outputOpen", ["string", "}}"], "outputClose", "end"]);
  });

  it("does not end the output at an escaped quote inside a string", () => {
    expect(tokens(String.raw`{{ "a\"}}" }}`)).toEqual([
      "outputOpen",
      ["string", 'a"}}'],
      "outputClose",
      "end",
    ]);
  });

  it.each(["\n", "\r"])(
    "does not look for the end of a string past the line break %j",
    (lineBreak) => {
      expect(problems(`{{ "open${lineBreak}}} " }}`)).toEqual([TemplateCodes.unterminatedString]);
    },
  );

  it("does not end the output at the closing delimiter of a tag", () => {
    expect(problems("{{ a %} }}")).toEqual([TemplateCodes.unexpectedCharacter]);
  });
});

describe("comments", () => {
  it("removes comments", () => {
    expect(tokens("a{# {{ not code }} #}b")).toEqual([["text", "a"], ["text", "b"], "end"]);
  });

  it("reports a comment that is never closed", () => {
    expect(tokenize("a {# oops", "page.html").diagnostics).toMatchObject([
      {
        code: TemplateCodes.unclosedComment,
        severity: "error",
        span: { start: { line: 1, column: 3 }, end: { line: 1, column: 5 } },
      },
    ]);
  });
});

describe("names", () => {
  it.each(["page", "_private", "post2", "camelCase"])("reads %s", (name) => {
    expect(inOutput(name)).toEqual([["name", name]]);
  });
});

describe("numbers", () => {
  it.each([
    ["0", 0],
    ["42", 42],
    ["3.14", 3.14],
  ])("reads %s", (code, value) => {
    expect(inOutput(code)).toEqual([["number", value]]);
  });

  it("leaves a dot after a number for member access", () => {
    expect(inOutput("1.name")).toEqual([
      ["number", 1],
      ["symbol", "."],
      ["name", "name"],
    ]);
  });
});

describe("strings", () => {
  it.each([
    ['"hello"', "hello"],
    ["'hello'", "hello"],
    ['""', ""],
    [`"it's"`, "it's"],
    [`'say "hi"'`, 'say "hi"'],
    [String.raw`"a\"b"`, 'a"b'],
    [String.raw`'a\'b'`, "a'b"],
    [String.raw`"a\\b"`, "a\\b"],
    [String.raw`"a\nb\tc"`, "a\nb\tc"],
  ])("reads %s", (code, value) => {
    expect(inOutput(code)).toEqual([["string", value]]);
  });

  it("reports a string that is not closed before the end of the output", () => {
    expect(problems('{{ "open }}')).toEqual([TemplateCodes.unterminatedString]);
  });

  it("reports a string that is not closed on its line", () => {
    expect(problems('{{ "open\nnext" }}')).toContain(TemplateCodes.unterminatedString);
  });

  it("reports an unknown escape at the backslash", () => {
    expect(tokenize(String.raw`{{ "a\q" }}`, "page.html").diagnostics).toMatchObject([
      { code: TemplateCodes.invalidEscape, span: { start: { column: 6 }, end: { column: 8 } } },
    ]);
  });
});

describe("symbols", () => {
  it.each([".", ",", "(", ")", "[", "]", "|", "+", "-", "*", "/", "%", "<", ">"])(
    "reads %s",
    (symbol) => {
      expect(inOutput(symbol)).toEqual([["symbol", symbol]]);
    },
  );

  it.each(["==", "!=", "<=", ">="])("reads %s as one symbol", (symbol) => {
    expect(inOutput(symbol)).toEqual([["symbol", symbol]]);
  });

  it("reads symbols without spaces between them", () => {
    expect(inOutput("a|b")).toEqual([
      ["name", "a"],
      ["symbol", "|"],
      ["name", "b"],
    ]);
  });
});

describe("mistakes", () => {
  it.each([
    ["&&", "and"],
    ["||", "or"],
    ["!", "not"],
    ["=", "=="],
  ])("suggests a replacement for %s", (symbol, replacement) => {
    expect(tokenize(`{{ a ${symbol} b }}`, "page.html").diagnostics).toMatchObject([
      { code: TemplateCodes.unexpectedCharacter, hint: `use \`${replacement}\` instead` },
    ]);
  });

  it("reports an unknown character and continues", () => {
    const result = tokenize("{{ a @ b }}", "page.html");
    expect(result.diagnostics).toMatchObject([
      {
        code: TemplateCodes.unexpectedCharacter,
        message: "`@` cannot be used here",
        span: { start: { column: 6 } },
      },
    ]);
    expect(result.tokens.map(brief)).toContain("outputClose");
  });

  it.each(["@", '"open', String.raw`"a\q"`])("marks the place of the mistake in %s", (code) => {
    expect(tokenize(`{{ ${code} }}`, "page.html").tokens.map((token) => token.kind)).toContain(
      "invalid",
    );
  });

  it("names a character outside the basic plane in full", () => {
    expect(tokenize("{{ 😀 }}", "page.html").diagnostics).toMatchObject([
      { message: "`😀` cannot be used here" },
    ]);
  });

  it("reports every problem in one run", () => {
    expect(problems("{{ @ }} {{ # }} {# open")).toEqual([
      TemplateCodes.unexpectedCharacter,
      TemplateCodes.unexpectedCharacter,
      TemplateCodes.unclosedComment,
    ]);
  });
});

describe("delimiters that are never closed", () => {
  it.each([
    ["{{ title", "}}"],
    ["{% name", "%}"],
  ])("reports %s at its opening", (source, closer) => {
    expect(tokenize(source, "page.html").diagnostics).toMatchObject([
      {
        code: TemplateCodes.unclosedDelimiter,
        span: { start: { column: 1 }, end: { column: 3 } },
        hint: `add \`${closer}\` at the end`,
      },
    ]);
  });

  it("reports one problem, not one for each character after it", () => {
    expect(problems("{{ title\n<p>@ & $</p>")).toEqual([TemplateCodes.unclosedDelimiter]);
  });

  it("stops at the opening of a tag", () => {
    const result = tokenize("{{ a {% b %}", "page.html");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      TemplateCodes.unclosedDelimiter,
    ]);
    expect(result.tokens.map(brief)).toEqual(["tagOpen", ["name", "b"], "tagClose", "end"]);
  });

  it("continues at the next delimiter", () => {
    const result = tokenize("{{ a <p>{{ b }}", "page.html");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      TemplateCodes.unclosedDelimiter,
    ]);
    expect(result.tokens.map(brief)).toEqual(["outputOpen", ["name", "b"], "outputClose", "end"]);
  });
});

describe("positions", () => {
  it("gives each token its exact span", () => {
    const { tokens: found } = tokenize("a\n{{ name }}", "page.html");
    expect(found[2]).toMatchObject({
      kind: "name",
      span: {
        file: "page.html",
        start: { line: 2, column: 4, offset: 5 },
        end: { line: 2, column: 8, offset: 9 },
      },
    });
  });

  it.each(["a\r\n{{ b }}", "a\r{{ b }}", "a\n\n{{ b }}\n{{ c }}"])(
    "agrees with the shared position rule for %j",
    (source) => {
      for (const token of tokenize(source, "page.html").tokens) {
        expect(token.span.start).toEqual(positionAt(source, token.span.start.offset));
        expect(token.span.end).toEqual(positionAt(source, token.span.end.offset));
      }
    },
  );
});

describe("hostile input", () => {
  it("handles very many unclosed delimiters", () => {
    expect(problems("{{ ".repeat(50_000))).toHaveLength(50_000);
  });

  it("handles very many tokens on many lines", () => {
    const source = "{{ a }}\n".repeat(50_000);
    expect(tokenize(source, "page.html").tokens).toHaveLength(200_001);
  });

  it("handles very many escaped quotes without a closing quote", () => {
    expect(problems(`{{ "${String.raw`\"`.repeat(100_000)}`)).toEqual([
      TemplateCodes.unclosedDelimiter,
    ]);
  });

  it("handles a very long unterminated string", () => {
    expect(problems(`{{ "${"a".repeat(200_000)}`)).toEqual([TemplateCodes.unclosedDelimiter]);
  });
});
