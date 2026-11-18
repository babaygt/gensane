/**
 * Reads the value written on one line: a plain word, a quoted string or a `[flow, list]`.
 * After a problem the rest of the line is skipped, so each line reports at most one error.
 */
import type { DiagnosticCode, SourceSpan } from "../diagnostics/index.ts";
import { FrontmatterCodes } from "./diagnostic-codes.ts";
import { type SourceLine, positionInLine } from "./source-lines.ts";
import type { DateValue, FrontmatterValue } from "./values.ts";

export type ReportProblem = (
  code: DiagnosticCode,
  message: string,
  span: SourceSpan,
  hint: string,
) => void;

/** Recursive values must not overflow the call stack on hostile input. */
export const MAX_NESTING_DEPTH = 64;

const UNSUPPORTED_START: Readonly<Record<string, string>> = {
  "{": "inline maps are not supported",
  "&": "anchors are not supported",
  "*": "aliases are not supported",
  "!": "tags are not supported",
  "|": "multi-line text blocks are not supported",
  ">": "multi-line text blocks are not supported",
  "%": "a value cannot start with `%`",
  "@": "a value cannot start with `@`",
  "`": "a value cannot start with a backtick",
};

const ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  "0": "\0",
};

const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const DATE =
  /^(\d{4})-(\d{2})(?:-(\d{2})(?:T((?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:Z|[+-]\d{2}:\d{2})?))?)?$/;

/** Reads the value that starts at `start` in `text`, which is part of `line`. */
export function readInlineValue(
  text: string,
  textOffset: number,
  line: SourceLine,
  file: string,
  report: ReportProblem,
): FrontmatterValue {
  return new InlineValueReader(text, textOffset, line, file, report).read();
}

class InlineValueReader {
  readonly #text: string;
  readonly #textOffset: number;
  readonly #line: SourceLine;
  readonly #file: string;
  readonly #report: ReportProblem;
  #cursor = 0;
  #failed = false;

  constructor(
    text: string,
    textOffset: number,
    line: SourceLine,
    file: string,
    report: ReportProblem,
  ) {
    this.#text = text;
    this.#textOffset = textOffset;
    this.#line = line;
    this.#file = file;
    this.#report = report;
  }

  read(): FrontmatterValue {
    const value = this.#readValue(0, false);
    if (this.#failed) return value;
    this.#skipSpaces();
    const rest = this.#text.slice(this.#cursor);
    if (rest !== "" && !rest.startsWith("#")) {
      this.#fail(
        FrontmatterCodes.textAfterValue,
        "unexpected text after this value",
        this.#cursor,
        this.#text.length,
        "put the whole value in quotes, or move the extra text into a `# comment`",
      );
    }
    return value;
  }

  #readValue(depth: number, inList: boolean): FrontmatterValue {
    const start = this.#cursor;
    const first = this.#text[start] ?? "";
    if (first === '"') return this.#readDoubleQuoted();
    if (first === "'") return this.#readSingleQuoted();
    if (first === "[") return this.#readList(depth);

    const unsupported = UNSUPPORTED_START[first];
    if (unsupported !== undefined) {
      return this.#fail(
        FrontmatterCodes.unsupportedSyntax,
        unsupported,
        start,
        this.#text.length,
        first === "{"
          ? "write the keys on their own indented lines, or use a list"
          : "if this is text, put it in quotes on one line",
      );
    }
    return this.#readPlain(inList);
  }

  #readPlain(inList: boolean): FrontmatterValue {
    const start = this.#cursor;
    let end = start;
    while (end < this.#text.length && !this.#endsPlain(end, inList)) end++;
    const text = this.#text.slice(start, end).trimEnd();
    this.#cursor = start + text.length;

    if (text === "") {
      return this.#fail(
        FrontmatterCodes.invalidEntry,
        "this list has an empty item",
        start,
        start + 1,
        "remove the extra comma",
      );
    }
    if (/:(?:\s|$)/.test(text) || text.startsWith("- ")) {
      return this.#fail(
        FrontmatterCodes.valueNeedsQuotes,
        "this text contains characters that have a special meaning here",
        start,
        start + text.length,
        `put the value in quotes: "${text}"`,
      );
    }
    return this.#classify(text, this.#span(start, start + text.length));
  }

  /** A comment needs a space before it, so that `C#` stays text. */
  #endsPlain(index: number, inList: boolean): boolean {
    const character = this.#text[index];
    if (inList && (character === "," || character === "]")) return true;
    return character === "#" && /[ \t]/.test(this.#text[index - 1] ?? "");
  }

  #classify(text: string, span: SourceSpan): FrontmatterValue {
    if (text === "null" || text === "~") return { kind: "null", span };
    if (text === "true" || text === "false")
      return { kind: "boolean", value: text === "true", span };
    if (NUMBER.test(text) && isExactNumber(text))
      return { kind: "number", value: Number(text), span };
    const date = DATE.exec(text);
    if (date !== null) return this.#readDate(text, date, span);
    return { kind: "string", value: text, span };
  }

  #readDate(text: string, match: RegExpExecArray, span: SourceSpan): FrontmatterValue {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = match[3] === undefined ? undefined : Number(match[3]);
    if (
      month < 1 ||
      month > 12 ||
      (day !== undefined && (day < 1 || day > daysInMonth(year, month)))
    ) {
      this.#report(
        FrontmatterCodes.invalidDate,
        `${text} is not a real date`,
        span,
        "write dates as YYYY-MM-DD or YYYY-MM, or put the value in quotes if it is text",
      );
      this.#failed = true;
      return { kind: "null", span };
    }
    const date: DateValue = {
      kind: "date",
      text,
      year,
      month,
      ...(day === undefined ? {} : { day }),
      ...(match[4] === undefined ? {} : { time: match[4] }),
      span,
    };
    return date;
  }

  #readDoubleQuoted(): FrontmatterValue {
    const start = this.#cursor;
    let value = "";
    for (let index = start + 1; index < this.#text.length; index++) {
      const character = this.#text[index] ?? "";
      if (character === '"') {
        this.#cursor = index + 1;
        return { kind: "string", value, span: this.#span(start, index + 1) };
      }
      if (character !== "\\") {
        value += character;
        continue;
      }
      const escape = this.#readEscape(index);
      if (escape === undefined) {
        // A backslash at the very end of the line leaves the string open.
        if (index + 1 >= this.#text.length) break;
        return this.#fail(
          FrontmatterCodes.invalidEscape,
          `\`${this.#text.slice(index, index + 2)}\` is not a valid escape`,
          index,
          index + 2,
          "write a backslash as `\\\\`, or use single quotes, where nothing is escaped",
        );
      }
      value += escape.text;
      index += escape.length - 1;
    }
    return this.#failUnterminated(start, '"');
  }

  #readEscape(index: number): { text: string; length: number } | undefined {
    const next = this.#text[index + 1] ?? "";
    const simple = ESCAPES[next];
    if (simple !== undefined) return { text: simple, length: 2 };
    const hex = /^u([0-9a-fA-F]{4})/.exec(this.#text.slice(index + 1, index + 6))?.[1];
    if (hex === undefined) return undefined;
    return { text: String.fromCharCode(Number.parseInt(hex, 16)), length: 6 };
  }

  #readSingleQuoted(): FrontmatterValue {
    const start = this.#cursor;
    let value = "";
    for (let index = start + 1; index < this.#text.length; index++) {
      const character = this.#text[index] ?? "";
      if (character !== "'") {
        value += character;
      } else if (this.#text[index + 1] === "'") {
        value += "'";
        index++;
      } else {
        this.#cursor = index + 1;
        return { kind: "string", value, span: this.#span(start, index + 1) };
      }
    }
    return this.#failUnterminated(start, "'");
  }

  #failUnterminated(start: number, quote: string): FrontmatterValue {
    return this.#fail(
      FrontmatterCodes.unterminatedString,
      "this string is never closed",
      start,
      this.#text.length,
      `add a closing ${quote} at the end of the value`,
    );
  }

  #readList(depth: number): FrontmatterValue {
    const start = this.#cursor;
    if (depth >= MAX_NESTING_DEPTH) {
      return this.#fail(
        FrontmatterCodes.nestingTooDeep,
        `lists are nested more than ${MAX_NESTING_DEPTH} levels deep`,
        start,
        this.#text.length,
        "reduce the nesting",
      );
    }
    this.#cursor++;
    const items: FrontmatterValue[] = [];
    while (!this.#failed) {
      this.#skipSpaces();
      if (this.#cursor >= this.#text.length) break;
      if (this.#text[this.#cursor] === "]") {
        this.#cursor++;
        return { kind: "list", items, span: this.#span(start, this.#cursor) };
      }
      items.push(this.#readValue(depth + 1, true));
      if (this.#failed) break;
      this.#skipSpaces();
      const separator = this.#text[this.#cursor];
      if (separator === ",") {
        this.#cursor++;
      } else if (separator !== "]" && separator !== undefined) {
        return this.#fail(
          FrontmatterCodes.textAfterValue,
          "expected a comma between list items",
          this.#cursor,
          this.#text.length,
          "separate the items with commas",
        );
      }
    }
    if (this.#failed) return { kind: "null", span: this.#span(start, this.#text.length) };
    return this.#fail(
      FrontmatterCodes.unterminatedList,
      "this list is never closed",
      start,
      this.#text.length,
      "add a closing `]` on the same line",
    );
  }

  #skipSpaces(): void {
    while (this.#text[this.#cursor] === " " || this.#text[this.#cursor] === "\t") this.#cursor++;
  }

  #fail(
    code: DiagnosticCode,
    message: string,
    start: number,
    end: number,
    hint: string,
  ): FrontmatterValue {
    const span = this.#span(start, end);
    this.#report(code, message, span, hint);
    this.#failed = true;
    this.#cursor = this.#text.length;
    return { kind: "null", span };
  }

  #span(start: number, end: number): SourceSpan {
    return {
      file: this.#file,
      start: positionInLine(this.#line, this.#textOffset + start),
      end: positionInLine(this.#line, this.#textOffset + end),
    };
  }
}

/** Integers beyond what a number can store exactly stay text, so no digits are lost. */
function isExactNumber(text: string): boolean {
  return text.includes(".") || Number.isSafeInteger(Number(text));
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}
