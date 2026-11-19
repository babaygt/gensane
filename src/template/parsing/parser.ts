/**
 * A recursive descent parser. Each level of the grammar is one method, and a level calls the next
 * one for its operands, so operators lower down bind more tightly:
 *
 *   or → and → not → comparison → additive → multiplicative → unary → postfix → primary
 *
 * After a mistake it skips to the end of the delimiters and continues with the rest of the template.
 */
import {
  type Diagnostic,
  type DiagnosticCode,
  InternalError,
  type SourceSpan,
} from "../../diagnostics/index.ts";
import type { BinaryOperator, Expression, TemplateNode } from "../ast.ts";
import { TemplateCodes } from "../diagnostic-codes.ts";
import type { TemplateSymbol, Token } from "../lexing/tokens.ts";

export interface ParseResult {
  readonly nodes: readonly TemplateNode[];
  readonly diagnostics: readonly Diagnostic[];
}

/** Recursive stages must not overflow the call stack on hostile input. */
export const MAX_EXPRESSION_DEPTH = 64;

/** A long chain such as `a + a + a` builds a deep tree without any brackets. */
export const MAX_EXPRESSION_TOKENS = 1000;

export function parseTemplate(tokens: readonly Token[]): ParseResult {
  return new TemplateParser(tokens).parse();
}

const COMPARISONS: readonly BinaryOperator[] = ["==", "!=", "<", "<=", ">", ">="];
const ADDITIVE: readonly BinaryOperator[] = ["+", "-"];
const MULTIPLICATIVE: readonly BinaryOperator[] = ["*", "/", "%"];
const LITERAL_NAMES: ReadonlyMap<string, boolean | null> = new Map([
  ["true", true],
  ["false", false],
  ["null", null],
]);
const OPERATOR_NAMES: ReadonlySet<string> = new Set(["and", "or", "not"]);

function spanBetween(start: SourceSpan, end: SourceSpan): SourceSpan {
  return { file: start.file, start: start.start, end: end.end };
}

function describeToken(token: Token): string {
  switch (token.kind) {
    case "outputClose":
      return "the end of the output";
    case "tagClose":
      return "the end of the tag";
    case "string":
      return `the text "${token.value}"`;
    case "name":
    case "number":
    case "symbol":
      return `\`${token.value}\``;
    default:
      return "something else";
  }
}

class TemplateParser {
  readonly #tokens: readonly Token[];
  readonly #diagnostics: Diagnostic[] = [];
  #index = 0;
  #depth = 0;
  #failed = false;

  constructor(tokens: readonly Token[]) {
    this.#tokens = tokens;
  }

  parse(): ParseResult {
    const nodes: TemplateNode[] = [];
    for (let token = this.#current(); token.kind !== "end"; token = this.#current()) {
      if (token.kind === "text") {
        nodes.push({ kind: "text", value: token.value, span: token.span });
        this.#index++;
      } else if (token.kind === "outputOpen") {
        const output = this.#parseOutput(token.span);
        if (output !== undefined) nodes.push(output);
      } else {
        this.#parseTag(token.span);
      }
    }
    return { nodes, diagnostics: this.#diagnostics };
  }

  #parseOutput(open: SourceSpan): TemplateNode | undefined {
    const close = this.#closingIndex("outputClose");
    this.#index++;
    if (!this.#canParseUpTo(close, open)) return this.#skipTo(close);

    this.#failed = false;
    const expression = this.#parseOr();
    if (!this.#failed && this.#index !== close) this.#failExpected("`}}`");
    if (this.#failed) return this.#skipTo(close);

    const span = spanBetween(open, this.#tokens[close]?.span ?? open);
    this.#index = close + 1;
    return { kind: "output", expression, span };
  }

  #parseTag(open: SourceSpan): void {
    const close = this.#closingIndex("tagClose");
    this.#index++;
    const name = this.#current();
    if (name.kind === "invalid") return this.#skipTo(close);
    const described =
      name.kind === "name" ? `there is no tag named "${name.value}"` : "expected the name of a tag";
    const span = name.kind === "tagClose" ? open : name.span;
    this.#report(TemplateCodes.unknownTag, described, span, "check the spelling of the tag");
    this.#skipTo(close);
  }

  #closingIndex(kind: "outputClose" | "tagClose"): number {
    let index = this.#index;
    while (index < this.#tokens.length && this.#tokens[index]?.kind !== kind) index++;
    return index;
  }

  /** Mistakes in the characters are already reported, and long code is rejected before parsing. */
  #canParseUpTo(close: number, open: SourceSpan): boolean {
    const code = this.#tokens.slice(this.#index, close);
    if (code.some((token) => token.kind === "invalid")) return false;
    if (code.length <= MAX_EXPRESSION_TOKENS) return true;
    this.#report(
      TemplateCodes.expressionTooLong,
      `this expression has more than ${MAX_EXPRESSION_TOKENS} parts`,
      open,
      "split the work over several steps, or do it in a filter",
    );
    return false;
  }

  #skipTo(close: number): undefined {
    this.#index = close + 1;
    return undefined;
  }

  #parseExpression(): Expression {
    return this.#nested(() => this.#parseOr());
  }

  #nested(parse: () => Expression): Expression {
    if (this.#depth >= MAX_EXPRESSION_DEPTH) {
      return this.#fail(
        TemplateCodes.nestingTooDeep,
        `this expression is nested more than ${MAX_EXPRESSION_DEPTH} levels deep`,
        this.#current().span,
        "reduce the nesting",
      );
    }
    this.#depth++;
    const expression = parse();
    this.#depth--;
    return expression;
  }

  #parseOr(): Expression {
    let left = this.#parseAnd();
    while (!this.#failed && this.#matchesName("or")) {
      this.#index++;
      const right = this.#parseAnd();
      left = {
        kind: "logical",
        operator: "or",
        left,
        right,
        span: spanBetween(left.span, right.span),
      };
    }
    return left;
  }

  #parseAnd(): Expression {
    let left = this.#parseNot();
    while (!this.#failed && this.#matchesName("and")) {
      this.#index++;
      const right = this.#parseNot();
      left = {
        kind: "logical",
        operator: "and",
        left,
        right,
        span: spanBetween(left.span, right.span),
      };
    }
    return left;
  }

  #parseNot(): Expression {
    const token = this.#current();
    if (!this.#matchesName("not")) return this.#parseComparison();
    this.#index++;
    const operand = this.#nested(() => this.#parseNot());
    return { kind: "unary", operator: "not", operand, span: spanBetween(token.span, operand.span) };
  }

  #parseComparison(): Expression {
    const left = this.#parseBinary(ADDITIVE, () =>
      this.#parseBinary(MULTIPLICATIVE, () => this.#parseUnary()),
    );
    const operator = this.#matchingOperator(COMPARISONS);
    if (this.#failed || operator === undefined) return left;
    this.#index++;
    const right = this.#parseBinary(ADDITIVE, () =>
      this.#parseBinary(MULTIPLICATIVE, () => this.#parseUnary()),
    );
    if (!this.#failed && this.#matchingOperator(COMPARISONS) !== undefined) {
      return this.#fail(
        TemplateCodes.chainedComparison,
        "comparisons cannot be chained",
        this.#current().span,
        "compare one pair at a time: `a < b and b < c`",
      );
    }
    return { kind: "binary", operator, left, right, span: spanBetween(left.span, right.span) };
  }

  #parseBinary(operators: readonly BinaryOperator[], parseOperand: () => Expression): Expression {
    let left = parseOperand();
    for (
      let operator = this.#matchingOperator(operators);
      !this.#failed && operator !== undefined;
      operator = this.#matchingOperator(operators)
    ) {
      this.#index++;
      const right = parseOperand();
      left = { kind: "binary", operator, left, right, span: spanBetween(left.span, right.span) };
    }
    return left;
  }

  #parseUnary(): Expression {
    const token = this.#current();
    if (!this.#matchesSymbol("-")) return this.#parsePostfix();
    this.#index++;
    const operand = this.#nested(() => this.#parseUnary());
    return { kind: "unary", operator: "-", operand, span: spanBetween(token.span, operand.span) };
  }

  /** Member access, indexes and filters bind most tightly, so `posts | length > 0` works. */
  #parsePostfix(): Expression {
    let expression = this.#parsePrimary();
    while (!this.#failed) {
      if (this.#matchesSymbol(".")) expression = this.#parseMember(expression);
      else if (this.#matchesSymbol("[")) expression = this.#parseIndex(expression);
      else if (this.#matchesSymbol("|")) expression = this.#parseFilter(expression);
      else break;
    }
    return expression;
  }

  #parseMember(object: Expression): Expression {
    this.#index++;
    const name = this.#current();
    if (name.kind !== "name") return this.#failExpected("the name of a field");
    this.#index++;
    return {
      kind: "member",
      object,
      name: name.value,
      nameSpan: name.span,
      span: spanBetween(object.span, name.span),
    };
  }

  #parseIndex(object: Expression): Expression {
    this.#index++;
    const index = this.#parseExpression();
    if (this.#failed) return index;
    const close = this.#current();
    if (!this.#matchesSymbol("]")) return this.#failExpected("`]`");
    this.#index++;
    return { kind: "index", object, index, span: spanBetween(object.span, close.span) };
  }

  #parseFilter(input: Expression): Expression {
    this.#index++;
    const name = this.#current();
    if (name.kind !== "name") return this.#failExpected("the name of a filter");
    this.#index++;
    const filterArguments: Expression[] = [];
    let end = name.span;
    if (this.#matchesSymbol("(")) {
      this.#index++;
      while (!this.#failed && !this.#matchesSymbol(")")) {
        filterArguments.push(this.#parseExpression());
        if (this.#failed || this.#matchesSymbol(")")) break;
        if (!this.#matchesSymbol(",")) return this.#failExpected("`,` or `)`");
        this.#index++;
        if (this.#matchesSymbol(")")) return this.#failExpected("a value");
      }
      if (this.#failed) return input;
      end = this.#current().span;
      this.#index++;
    }
    return {
      kind: "filter",
      input,
      name: name.value,
      nameSpan: name.span,
      arguments: filterArguments,
      span: spanBetween(input.span, end),
    };
  }

  #parsePrimary(): Expression {
    const token = this.#current();
    if (token.kind === "string" || token.kind === "number") {
      this.#index++;
      return { kind: "literal", value: token.value, span: token.span };
    }
    if (this.#matchesSymbol("(")) {
      this.#index++;
      const expression = this.#parseExpression();
      if (this.#failed) return expression;
      if (!this.#matchesSymbol(")")) return this.#failExpected("`)`");
      this.#index++;
      return expression;
    }
    if (token.kind !== "name" || OPERATOR_NAMES.has(token.value))
      return this.#failExpected("a value");
    this.#index++;
    const literal = LITERAL_NAMES.get(token.value);
    return literal === undefined
      ? { kind: "variable", name: token.value, span: token.span }
      : { kind: "literal", value: literal, span: token.span };
  }

  #matchingOperator(operators: readonly BinaryOperator[]): BinaryOperator | undefined {
    const token = this.#current();
    if (token.kind !== "symbol") return undefined;
    return operators.find((operator) => operator === token.value);
  }

  #matchesSymbol(symbol: TemplateSymbol): boolean {
    const token = this.#current();
    return token.kind === "symbol" && token.value === symbol;
  }

  #matchesName(name: string): boolean {
    const token = this.#current();
    return token.kind === "name" && token.value === name;
  }

  #current(): Token {
    const token = this.#tokens[this.#index] ?? this.#tokens.at(-1);
    if (token === undefined) throw new InternalError("the lexer always produces an end token");
    return token;
  }

  #failExpected(expected: string): Expression {
    const token = this.#current();
    const code =
      expected === "a value" ? TemplateCodes.expectedValue : TemplateCodes.unexpectedToken;
    const hint =
      code === TemplateCodes.expectedValue
        ? "write a value here, such as a name, a number or text in quotes"
        : `add ${expected} here`;
    return this.#fail(
      code,
      `expected ${expected}, but found ${describeToken(token)}`,
      token.span,
      hint,
    );
  }

  #fail(code: DiagnosticCode, message: string, span: SourceSpan, hint: string): Expression {
    this.#report(code, message, span, hint);
    this.#failed = true;
    return { kind: "literal", value: null, span };
  }

  #report(code: DiagnosticCode, message: string, span: SourceSpan, hint: string): void {
    this.#diagnostics.push({ code, severity: "error", message, span, hint });
  }
}
