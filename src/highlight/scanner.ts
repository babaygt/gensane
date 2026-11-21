/**
 * One scanner for every language but HTML, driven by a table of what each language has: its comments,
 * its quotes and its keywords. At each place in the code it tries a comment, a string, a number and a
 * word, in that order, and otherwise takes one character as plain text.
 */
import type { Token } from "./tokens.ts";

export interface LanguageSpec {
  /** Comments to the end of the line, such as `//` or `#`. */
  readonly lineComments: readonly string[];
  readonly blockComments: readonly (readonly [open: string, close: string])[];
  /** Quotes that start a string; a string ends at the same quote, and only a backtick may span lines. */
  readonly quotes: readonly string[];
  /** Python's `"""` and `'''`. */
  readonly tripleQuotes?: boolean;
  /** Rust's and Go's `'a'`: a quote is a string only around one character, so a Rust lifetime isn't. */
  readonly characterQuotes?: boolean;
  /** Shell: `#` starts a comment only at the start of a word, so `a#b` isn't one. */
  readonly commentsStartWords?: boolean;
  /** CSS: `@media` is a keyword, a unit belongs to its number, and `#fff` is a number. */
  readonly css?: boolean;
  readonly keywords: ReadonlySet<string>;
}

const WORD = /[A-Za-z_$][\w$]*/y;
const NUMBER =
  /0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?/y;
const CSS_UNIT = /[a-zA-Z%]*/y;
const CSS_COLOR = /#[\da-fA-F]{3,8}(?![\w-])/y;
const CHARACTER = /'(?:\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]{1,6}\}|.)|[^'\\\n])'/y;

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\w$]/.test(character);
}

function matchAt(pattern: RegExp, code: string, at: number): string | undefined {
  pattern.lastIndex = at;
  return pattern.exec(code)?.[0];
}

/** The end of a string that starts at `at` with `quote`: after the closing quote, or at the end of the line. */
function stringEnd(code: string, at: number, quote: string): number {
  const multiline = quote === "`" || quote.length === 3;
  let index = at + quote.length;
  while (index < code.length) {
    if (code.startsWith(quote, index)) return index + quote.length;
    const character = code[index];
    if (character === "\\") index += 2;
    else if (character === "\n" && !multiline) return index;
    else index += 1;
  }
  return code.length;
}

export function scan(code: string, spec: LanguageSpec): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  const take = (kind: Token["kind"], end: number) => {
    tokens.push({ kind, text: code.slice(at, end) });
    at = end;
  };
  while (at < code.length) {
    const before = code[at - 1];
    const lineComment = spec.lineComments.find((open) => code.startsWith(open, at));
    if (
      lineComment !== undefined &&
      (!spec.commentsStartWords || before === undefined || /\s/.test(before))
    ) {
      const end = code.indexOf("\n", at);
      take("comment", end === -1 ? code.length : end);
      continue;
    }
    const block = spec.blockComments.find(([open]) => code.startsWith(open, at));
    if (block !== undefined) {
      const end = code.indexOf(block[1], at + block[0].length);
      take("comment", end === -1 ? code.length : end + block[1].length);
      continue;
    }
    if (spec.characterQuotes && code[at] === "'") {
      const character = matchAt(CHARACTER, code, at);
      if (character !== undefined) take("string", at + character.length);
      else take("plain", at + 1);
      continue;
    }
    const triple = spec.tripleQuotes
      ? ['"""', "'''"].find((quote) => code.startsWith(quote, at))
      : undefined;
    const quote = triple ?? spec.quotes.find((open) => code[at] === open);
    if (quote !== undefined) {
      take("string", stringEnd(code, at, quote));
      continue;
    }
    if (spec.css) {
      const color = isWordCharacter(before) ? undefined : matchAt(CSS_COLOR, code, at);
      if (color !== undefined) {
        take("number", at + color.length);
        continue;
      }
      if (code[at] === "@") {
        const word = matchAt(WORD, code, at + 1);
        if (word !== undefined) {
          take("keyword", at + 1 + word.length);
          continue;
        }
      }
    }
    if (!isWordCharacter(before)) {
      const number = matchAt(NUMBER, code, at);
      if (number !== undefined) {
        const unit = spec.css ? (matchAt(CSS_UNIT, code, at + number.length) ?? "") : "";
        take("number", at + number.length + unit.length);
        continue;
      }
    }
    const word = isWordCharacter(before) ? undefined : matchAt(WORD, code, at);
    if (word !== undefined) {
      take(spec.keywords.has(word) ? "keyword" : "plain", at + word.length);
      continue;
    }
    take("plain", at + 1);
  }
  return tokens;
}
