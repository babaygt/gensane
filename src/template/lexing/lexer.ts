/**
 * Turns a template into tokens. Outside of delimiters everything is text. Inside `{{ }}` and
 * `{% %}` the lexer reads code, so it works in two modes. Mistakes are collected, and reading
 * continues, so one run reports every problem in the template.
 */
import type {
  Diagnostic,
  DiagnosticCode,
  SourcePosition,
  SourceSpan,
} from "../../diagnostics/index.ts";
import { TemplateCodes } from "../diagnostic-codes.ts";
import { createPositionFinder } from "./source-positions.ts";
import type { TemplateSymbol, Token } from "./tokens.ts";

export interface LexResult {
  readonly tokens: readonly Token[];
  readonly diagnostics: readonly Diagnostic[];
}

export function tokenize(source: string, file: string): LexResult {
  return new TemplateLexer(source, file).tokenize();
}

const OPENER = /\{[{%#]/g;
const NAME = /[A-Za-z_]\w*/y;
const NUMBER = /\d+(?:\.\d+)?/y;

const SYMBOLS: ReadonlyMap<string, TemplateSymbol> = new Map(
  (
    [
      ".",
      ",",
      "(",
      ")",
      "[",
      "]",
      "|",
      "+",
      "-",
      "*",
      "/",
      "%",
      "==",
      "!=",
      "<",
      "<=",
      ">",
      ">=",
    ] as const
  ).map((symbol) => [symbol, symbol]),
);

/** Symbols that people know from other languages, and what to write here instead. */
const REPLACEMENTS: ReadonlyMap<string, string> = new Map([
  ["&&", "and"],
  ["||", "or"],
  ["!", "not"],
  ["=", "=="],
]);

const ESCAPES: ReadonlyMap<string, string> = new Map([
  ['"', '"'],
  ["'", "'"],
  ["\\", "\\"],
  ["n", "\n"],
  ["t", "\t"],
]);

function isLineBreak(character: string | undefined): boolean {
  return character === "\n" || character === "\r";
}

class TemplateLexer {
  readonly #source: string;
  readonly #file: string;
  readonly #positionAt: (offset: number) => SourcePosition;
  readonly #tokens: Token[] = [];
  readonly #diagnostics: Diagnostic[] = [];
  #cursor = 0;

  constructor(source: string, file: string) {
    this.#source = source;
    this.#file = file;
    this.#positionAt = createPositionFinder(source);
  }

  tokenize(): LexResult {
    while (this.#cursor < this.#source.length) {
      this.#readText();
      if (this.#source.startsWith("{#", this.#cursor)) this.#readComment();
      else if (this.#cursor < this.#source.length) this.#readCode();
    }
    const end = this.#span(this.#source.length, this.#source.length);
    this.#tokens.push({ kind: "end", span: end });
    return { tokens: this.#tokens, diagnostics: this.#diagnostics };
  }

  #readText(): void {
    const start = this.#cursor;
    const end = this.#nextOpener(start);
    if (end > start) {
      const value = this.#source.slice(start, end);
      this.#tokens.push({ kind: "text", value, span: this.#span(start, end) });
    }
    this.#cursor = end;
  }

  #nextOpener(from: number): number {
    OPENER.lastIndex = from;
    return OPENER.exec(this.#source)?.index ?? this.#source.length;
  }

  #readComment(): void {
    const start = this.#cursor;
    const end = this.#source.indexOf("#}", start + 2);
    if (end !== -1) {
      this.#cursor = end + 2;
      return;
    }
    this.#report(
      TemplateCodes.unclosedComment,
      "this comment is never closed",
      start,
      start + 2,
      "add `#}` at the end of the comment",
    );
    this.#cursor = this.#source.length;
  }

  #readCode(): void {
    const start = this.#cursor;
    const isOutput = this.#source.startsWith("{{", start);
    const closer = isOutput ? "}}" : "%}";
    const close = this.#findCloser(start + 2, closer);
    if (!close.found) {
      this.#report(
        TemplateCodes.unclosedDelimiter,
        `this \`${this.#source.slice(start, start + 2)}\` is never closed`,
        start,
        start + 2,
        `add \`${closer}\` at the end`,
      );
      this.#cursor = close.index;
      return;
    }

    const openSpan = this.#span(start, start + 2);
    this.#tokens.push({ kind: isOutput ? "outputOpen" : "tagOpen", span: openSpan });
    this.#cursor = start + 2;
    for (this.#skipSpaces(close.index); this.#cursor < close.index; this.#skipSpaces(close.index)) {
      this.#readCodeToken(close.index);
    }
    const closeSpan = this.#span(close.index, close.index + 2);
    this.#tokens.push({ kind: isOutput ? "outputClose" : "tagClose", span: closeSpan });
    this.#cursor = close.index + 2;
  }

  /**
   * Finds where code ends, ignoring anything inside strings. A new opening delimiter means this
   * one was never closed, so a forgotten `}}` is reported once instead of reading the page as code.
   */
  #findCloser(from: number, closer: string): { found: boolean; index: number } {
    let index = from;
    while (index < this.#source.length) {
      const character = this.#source[index];
      if (character === "\\") {
        index += 2;
      } else if (character === '"' || character === "'") {
        index = this.#endOfString(index) ?? index + 1;
      } else if (this.#source.startsWith(closer, index)) {
        return { found: true, index };
      } else if (this.#source.startsWith("{{", index) || this.#source.startsWith("{%", index)) {
        return { found: false, index };
      } else {
        index++;
      }
    }
    return { found: false, index: this.#source.length };
  }

  #endOfString(start: number): number | undefined {
    const quote = this.#source[start];
    for (let index = start + 1; index < this.#source.length; index++) {
      const character = this.#source[index];
      if (character === "\\") index++;
      else if (isLineBreak(character)) return undefined;
      else if (character === quote) return index + 1;
    }
    return undefined;
  }

  #skipSpaces(limit: number): void {
    while (this.#cursor < limit && /\s/.test(this.#source[this.#cursor] ?? "")) this.#cursor++;
  }

  #readCodeToken(limit: number): void {
    const character = this.#source[this.#cursor] ?? "";
    if (character === '"' || character === "'") this.#readString(limit);
    else if (/\d/.test(character)) this.#readNumber();
    else if (/[A-Za-z_]/.test(character)) this.#readName();
    else this.#readSymbol();
  }

  #readName(): void {
    const start = this.#cursor;
    NAME.lastIndex = start;
    const value = NAME.exec(this.#source)?.[0] ?? "";
    this.#cursor = start + value.length;
    this.#tokens.push({ kind: "name", value, span: this.#span(start, this.#cursor) });
  }

  #readNumber(): void {
    const start = this.#cursor;
    NUMBER.lastIndex = start;
    const text = NUMBER.exec(this.#source)?.[0] ?? "";
    this.#cursor = start + text.length;
    const span = this.#span(start, this.#cursor);
    this.#tokens.push({ kind: "number", value: Number(text), span });
  }

  #readString(limit: number): void {
    const start = this.#cursor;
    const quote = this.#source[start];
    let value = "";
    let index = start + 1;
    while (index < limit && !isLineBreak(this.#source[index])) {
      const character = this.#source[index] ?? "";
      if (character === quote) {
        this.#cursor = index + 1;
        this.#tokens.push({ kind: "string", value, span: this.#span(start, this.#cursor) });
        return;
      }
      if (character !== "\\") {
        value += character;
        index++;
        continue;
      }
      const escaped = ESCAPES.get(this.#source[index + 1] ?? "");
      if (escaped === undefined) {
        this.#report(
          TemplateCodes.invalidEscape,
          `\`${this.#source.slice(index, index + 2)}\` is not a valid escape`,
          index,
          index + 2,
          "the valid escapes are `\\\"`, `\\'`, `\\\\`, `\\n` and `\\t`",
        );
        this.#tokens.push({ kind: "invalid", span: this.#span(index, index + 2) });
      }
      value += escaped ?? "";
      index += 2;
    }
    this.#report(
      TemplateCodes.unterminatedString,
      "this string is never closed",
      start,
      index,
      `add a closing ${quote} on the same line`,
    );
    this.#tokens.push({ kind: "invalid", span: this.#span(start, index) });
    this.#cursor = index;
  }

  #readSymbol(): void {
    const start = this.#cursor;
    for (const length of [2, 1]) {
      const text = this.#source.slice(start, start + length);
      const symbol = SYMBOLS.get(text);
      if (symbol !== undefined) {
        this.#cursor = start + length;
        this.#tokens.push({ kind: "symbol", value: symbol, span: this.#span(start, this.#cursor) });
        return;
      }
      const replacement = REPLACEMENTS.get(text);
      if (replacement !== undefined) {
        this.#reportCharacter(text, `use \`${replacement}\` instead`);
        return;
      }
    }
    const character = String.fromCodePoint(this.#source.codePointAt(start) ?? 0);
    this.#reportCharacter(character, "remove it, or put it in quotes if it is text");
  }

  #reportCharacter(text: string, hint: string): void {
    const start = this.#cursor;
    this.#cursor = start + text.length;
    const message = `\`${text}\` cannot be used here`;
    this.#report(TemplateCodes.unexpectedCharacter, message, start, this.#cursor, hint);
    this.#tokens.push({ kind: "invalid", span: this.#span(start, this.#cursor) });
  }

  #report(code: DiagnosticCode, message: string, start: number, end: number, hint: string): void {
    this.#diagnostics.push({
      code,
      severity: "error",
      message,
      span: this.#span(start, end),
      hint,
    });
  }

  #span(start: number, end: number): SourceSpan {
    return { file: this.#file, start: this.#positionAt(start), end: this.#positionAt(end) };
  }
}
