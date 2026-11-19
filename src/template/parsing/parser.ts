/**
 * A recursive descent parser. A block such as `{% if %}` reads its body with the same method that
 * reads the whole template, so blocks can contain blocks. In expressions, each level of the grammar
 * is one method, and a level calls the next one for its operands, so operators lower down bind more
 * tightly:
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
  closestMatch,
} from "../../diagnostics/index.ts";
import type {
  BinaryOperator,
  ConditionalBranch,
  Expression,
  ForNode,
  IfNode,
  TemplateNode,
} from "../ast.ts";
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

/** Every stage after the parser also visits blocks recursively. */
export const MAX_BLOCK_DEPTH = 64;

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

const TAG_NAMES = ["if", "elif", "else", "endif", "for", "endfor"];
const LISTED_TAGS = `${TAG_NAMES.slice(0, -1).join(", ")} and ${TAG_NAMES.at(-1)}`;
/** Tags that continue or close a block, and what a stray one would need before it. */
const BRANCH_TAGS: ReadonlyMap<string, { readonly block: string; readonly opening: string }> =
  new Map([
    ["elif", { block: "`if`", opening: "`{% if condition %}`" }],
    ["else", { block: "`if` or `for`", opening: "an `if` or a `for`" }],
    ["endif", { block: "`if`", opening: "`{% if condition %}`" }],
    ["endfor", { block: "`for`", opening: "`{% for item in list %}`" }],
  ]);

/** A block that has been opened and not closed yet. */
interface OpenBlock {
  readonly kind: "if" | "for";
  /** Whether its `{% else %}` has been read. */
  inOtherwise: boolean;
}

function accepts(block: OpenBlock, tagName: string): boolean {
  const branches = block.kind === "if" ? ["elif", "else"] : ["else"];
  return tagName === `end${block.kind}` || (!block.inOtherwise && branches.includes(tagName));
}

/** An `else` or `elif` after the `else` of the same block. */
function isRepeatedBranch(block: OpenBlock, tagName: string): boolean {
  return block.inOtherwise && (tagName === "else" || (block.kind === "if" && tagName === "elif"));
}

interface TagStart {
  readonly open: SourceSpan;
  readonly name: Token;
  readonly close: number;
}

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
  readonly #openBlocks: OpenBlock[] = [];
  #index = 0;
  #depth = 0;
  #failed = false;
  /** Set when blocks are nested too deeply, because nothing after that can be read reliably. */
  #stopped = false;

  constructor(tokens: readonly Token[]) {
    this.#tokens = tokens;
  }

  parse(): ParseResult {
    const nodes = this.#parseBody();
    return { nodes, diagnostics: this.#diagnostics };
  }

  /** Reads nodes until the end, or until a tag that continues or closes an open block. */
  #parseBody(): TemplateNode[] {
    const nodes: TemplateNode[] = [];
    for (
      let token = this.#current();
      token.kind !== "end" && !this.#stopped;
      token = this.#current()
    ) {
      const tagName = this.#peekTagName();
      if (token.kind === "text") {
        nodes.push({ kind: "text", value: token.value, span: token.span });
        this.#index++;
      } else if (token.kind === "outputOpen") {
        const output = this.#parseOutput(token.span);
        if (output !== undefined) nodes.push(output);
      } else if (tagName !== undefined && BRANCH_TAGS.has(tagName)) {
        if (this.#belongsToOpenBlock(tagName)) break;
        this.#rejectBranch(tagName);
      } else {
        const node = this.#parseTag();
        if (node !== undefined) nodes.push(node);
      }
    }
    return nodes;
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

  #parseTag(): TemplateNode | undefined {
    const tag = this.#startTag();
    const { name } = tag;
    if (name.kind === "name" && name.value === "if") return this.#parseIf(tag);
    if (name.kind === "name" && name.value === "for") return this.#parseFor(tag);
    if (name.kind !== "invalid") this.#reportUnknownTag(tag);
    return this.#skipTo(tag.close);
  }

  #reportUnknownTag({ open, name }: TagStart): void {
    const suggestion = name.kind === "name" ? closestMatch(name.value, TAG_NAMES) : undefined;
    this.#report(
      TemplateCodes.unknownTag,
      name.kind === "name" ? `there is no tag named "${name.value}"` : "expected the name of a tag",
      name.kind === "tagClose" ? open : name.span,
      suggestion === undefined ? `the tags are: ${LISTED_TAGS}` : `did you mean "${suggestion}"?`,
    );
  }

  #parseIf(tag: TagStart): IfNode | undefined {
    const condition = this.#tagExpression(tag);
    this.#endTag(tag.close);
    const block = this.#openBlock("if", tag);
    if (block === undefined) return undefined;

    const branches: ConditionalBranch[] = [{ condition, body: this.#parseBody() }];
    let otherwise: readonly TemplateNode[] = [];
    for (let name = this.#peekTagName(); this.#continues(block, name); name = this.#peekTagName()) {
      const branch = this.#startTag();
      if (name === "elif") {
        const elifCondition = this.#tagExpression(branch);
        this.#endTag(branch.close);
        branches.push({ condition: elifCondition, body: this.#parseBody() });
      } else {
        if (!this.#failed && this.#matchesName("if")) {
          this.#fail(
            TemplateCodes.unexpectedToken,
            "expected `%}`, but found `if`",
            this.#current().span,
            "write `elif` instead of `else if`",
          );
        }
        this.#endTag(branch.close);
        block.inOtherwise = true;
        otherwise = this.#parseBody();
      }
    }
    this.#closeBlock(block, tag);
    return { kind: "if", branches, otherwise, span: this.#tagSpan(tag) };
  }

  #parseFor(tag: TagStart): ForNode | undefined {
    const variable = this.#loopVariable();
    if (this.#matchesName("in")) this.#index++;
    else if (!this.#failed) this.#failExpected("`in`");
    const iterable = this.#tagExpression(tag);
    this.#endTag(tag.close);
    const block = this.#openBlock("for", tag);
    if (block === undefined) return undefined;

    const body = this.#parseBody();
    let otherwise: readonly TemplateNode[] = [];
    if (this.#continues(block, this.#peekTagName())) {
      this.#endTag(this.#startTag().close);
      block.inOtherwise = true;
      otherwise = this.#parseBody();
    }
    this.#closeBlock(block, tag);
    return { kind: "for", variable, iterable, body, otherwise, span: this.#tagSpan(tag) };
  }

  #loopVariable(): string {
    const token = this.#current();
    if (this.#failed) return "";
    if (token.kind === "name" && token.value === "loop") {
      this.#fail(
        TemplateCodes.reservedName,
        "`loop` is already the name of the information about the current loop",
        token.span,
        "choose another name, such as `item`",
      );
      return "";
    }
    if (
      token.kind !== "name" ||
      LITERAL_NAMES.has(token.value) ||
      OPERATOR_NAMES.has(token.value)
    ) {
      this.#failExpected("the name of the loop variable");
      return "";
    }
    this.#index++;
    return token.value;
  }

  /** Whether the next tag is an `elif` or `else` of this block. */
  #continues(block: OpenBlock, tagName: string | undefined): boolean {
    return !this.#stopped && (tagName === "elif" || tagName === "else") && accepts(block, tagName);
  }

  #openBlock(kind: OpenBlock["kind"], { name }: TagStart): OpenBlock | undefined {
    if (this.#openBlocks.length >= MAX_BLOCK_DEPTH) {
      this.#report(
        TemplateCodes.nestingTooDeep,
        `blocks are nested more than ${MAX_BLOCK_DEPTH} levels deep`,
        name.span,
        "reduce the nesting",
      );
      this.#stopped = true;
      return undefined;
    }
    const block: OpenBlock = { kind, inOtherwise: false };
    this.#openBlocks.push(block);
    return block;
  }

  #closeBlock(block: OpenBlock, { name }: TagStart): void {
    this.#openBlocks.pop();
    if (this.#stopped) return;
    const end = `end${block.kind}`;
    if (this.#peekTagName() === end) {
      this.#endTag(this.#startTag().close);
      return;
    }
    this.#report(
      TemplateCodes.unclosedBlock,
      `this \`${block.kind}\` is never closed`,
      name.span,
      `add \`{% ${end} %}\` where it should end`,
    );
  }

  /** A closing tag that doesn't match the block it is in may still close a block around it. */
  #belongsToOpenBlock(tagName: string): boolean {
    const current = this.#openBlocks.at(-1);
    if (current === undefined || isRepeatedBranch(current, tagName)) return false;
    return this.#openBlocks.some((block) => accepts(block, tagName));
  }

  #rejectBranch(tagName: string): void {
    const { name, close } = this.#startTag();
    const current = this.#openBlocks.at(-1);
    if (current !== undefined && isRepeatedBranch(current, tagName)) {
      const isElif = tagName === "elif";
      this.#report(
        TemplateCodes.misplacedBranch,
        isElif
          ? "`elif` must come before `else`"
          : `this \`${current.kind}\` already has an \`else\``,
        name.span,
        isElif ? "move this `elif` above the `else`" : "remove one of the `else` tags",
      );
    } else {
      const stray = BRANCH_TAGS.get(tagName);
      if (stray === undefined) throw new InternalError(`Not a branch tag: ${tagName}`);
      this.#report(
        TemplateCodes.noOpenBlock,
        `there is no open ${stray.block} for this \`${tagName}\``,
        name.span,
        `remove it, or add ${stray.opening} before it`,
      );
    }
    this.#skipTo(close);
  }

  #peekTagName(): string | undefined {
    const name = this.#tokens[this.#index + 1];
    return this.#current().kind === "tagOpen" && name?.kind === "name" ? name.value : undefined;
  }

  #startTag(): TagStart {
    const open = this.#current().span;
    const close = this.#closingIndex("tagClose");
    this.#index++;
    const name = this.#current();
    if (name.kind === "name") this.#index++;
    this.#failed = this.#hasLexerProblem(close);
    return { open, name, close };
  }

  #tagExpression({ open, close }: TagStart): Expression {
    if (this.#failed || !this.#canParseUpTo(close, open)) {
      this.#failed = true;
      return { kind: "literal", value: null, span: open };
    }
    return this.#parseOr();
  }

  #endTag(close: number): void {
    if (!this.#failed && this.#index !== close) this.#failExpected("`%}`");
    this.#index = close + 1;
  }

  #tagSpan({ open, close }: TagStart): SourceSpan {
    return spanBetween(open, this.#tokens[close]?.span ?? open);
  }

  #closingIndex(kind: "outputClose" | "tagClose"): number {
    let index = this.#index;
    while (index < this.#tokens.length && this.#tokens[index]?.kind !== kind) index++;
    return index;
  }

  /** Mistakes in the characters are already reported, and long code is rejected before parsing. */
  #canParseUpTo(close: number, open: SourceSpan): boolean {
    if (this.#hasLexerProblem(close)) return false;
    if (close - this.#index <= MAX_EXPRESSION_TOKENS) return true;
    this.#report(
      TemplateCodes.expressionTooLong,
      `this expression has more than ${MAX_EXPRESSION_TOKENS} parts`,
      open,
      "split the work over several steps, or do it in a filter",
    );
    return false;
  }

  #hasLexerProblem(close: number): boolean {
    return this.#tokens.slice(this.#index, close).some((token) => token.kind === "invalid");
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
