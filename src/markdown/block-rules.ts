/**
 * Recognisers for single lines: "is this line the start of a heading / fence / break?"
 *
 * Each rule looks at one line only and accepts a regular language, so regexes are the
 * right tool. Grouping lines into blocks needs context and is the block parser's job.
 *
 * Every rule allows at most 3 spaces of indentation (` {0,3}`): in CommonMark, 4 spaces
 * would make an indented code block.
 *
 * Names follow the CommonMark spec. Its two heading styles are named after older formats:
 * ATX headings use `#` (`## Title`); Setext headings underline the text with `===` or
 * `---`. Gensane supports only ATX headings.
 */

import { unescapeString } from "./character-references.ts";
import { leadingIndent } from "./lines.ts";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface AtxHeadingMatch {
  readonly level: HeadingLevel;
  readonly content: string;
}

// 1-6 `#`, then end of line or whitespace + content. The required space rejects `#hashtag`.
const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;
// Optional closing `#`s (`## Title ##`). They need whitespace before them, so `# C#` stays.
const ATX_CLOSING_SEQUENCE = /(?:^|[ \t]+)#+[ \t]*$/;

/** `## Title ##` → `{ level: 2, content: "Title" }`. */
export function matchAtxHeading(text: string): AtxHeadingMatch | undefined {
  const match = ATX_HEADING.exec(text);
  if (match === null) return undefined;
  const hashes = match[1] ?? "";
  const content = (match[2] ?? "").replace(ATX_CLOSING_SEQUENCE, "").trim();
  return { level: hashes.length as HeadingLevel, content };
}

// Thematic break = horizontal rule (`<hr />`): 3+ of the same `-`, `*` or `_`, spaces allowed
// between. `\1` means "the same character as group 1", which rejects `*-*`.
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

export function isThematicBreak(text: string): boolean {
  return THEMATIC_BREAK.test(text);
}

/** An opening fence of a fenced code block, e.g. ```` ```ts ````. */
export interface FenceOpen {
  readonly character: "`" | "~";
  readonly length: number;
  /** Spaces before the fence; this many are removed from each content line. */
  readonly indent: number;
  /** Text after the fence, trimmed, e.g. `ts title=demo`. Its first word is the language. */
  readonly infoString: string;
}

// Groups: (indent) (3+ backticks OR 3+ tildes, never mixed) (info string).
const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;
// Same shape, but only whitespace may follow: a closing fence has no info string.
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

export function matchFenceOpen(text: string): FenceOpen | undefined {
  const match = FENCE_OPEN.exec(text);
  if (match === null) return undefined;
  const fence = match[2] ?? "";
  const character = fence[0] === "~" ? "~" : "`";
  const infoString = (match[3] ?? "").trim();
  // Otherwise inline code such as ```foo``` at the start of a line would open a fence.
  if (character === "`" && infoString.includes("`")) return undefined;
  return {
    character,
    length: fence.length,
    indent: (match[1] ?? "").length,
    infoString: unescapeString(infoString),
  };
}

/**
 * Same character and at least as long as the opening fence. The length rule lets a
 * ```` block contain a ``` line as plain content.
 */
export function isFenceClose(text: string, open: FenceOpen): boolean {
  const fence = FENCE_CLOSE.exec(text)?.[1];
  return fence !== undefined && fence[0] === open.character && fence.length >= open.length;
}

// Only `=` or only `-`, with no spaces between them (so `- - -` is not an underline).
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;

/** Used only to warn about unsupported Setext headings; `---` is also a thematic break. */
export function isSetextUnderline(text: string): "=" | "-" | undefined {
  const underline = SETEXT_UNDERLINE.exec(text)?.[1];
  if (underline === undefined) return undefined;
  return underline[0] === "=" ? "=" : "-";
}

// `>` plus one optional space or tab. The result is how many characters to strip.
const BLOCK_QUOTE = /^ {0,3}>[ \t]?/;

export function matchBlockQuote(text: string): number | undefined {
  return BLOCK_QUOTE.exec(text)?.[0].length;
}

export type ListType =
  | { readonly kind: "bullet"; readonly character: "-" | "+" | "*" }
  | { readonly kind: "ordered"; readonly start: number; readonly delimiter: "." | ")" };

export interface ListMarkerMatch {
  readonly type: ListType;
  /** Column where the item's content starts; continuation lines must be indented this far. */
  readonly contentColumn: number;
  /** Index in the line where the content of the first line starts. */
  readonly contentStart: number;
  /** True when nothing follows the marker on this line. */
  readonly empty: boolean;
}

// A bullet (`-` `+` `*`) or 1-9 digits followed by `.` or `)`, then a space, tab or end of line.
const LIST_MARKER = /^( {0,3})(?:([-+*])|(\d{1,9})([.)]))(?=[ \t]|$)/;

/** Spaces after the marker that still belong to it; more means the content is indented code. */
const MAX_MARKER_SPACES = 4;

export function matchListMarker(text: string): ListMarkerMatch | undefined {
  const match = LIST_MARKER.exec(text);
  if (match === null) return undefined;
  const type: ListType =
    match[2] === undefined
      ? { kind: "ordered", start: Number(match[3]), delimiter: match[4] === ")" ? ")" : "." }
      : { kind: "bullet", character: match[2] as "-" | "+" | "*" };

  const markerEnd = match[0].length;
  const spaces = leadingIndent(text.slice(markerEnd));
  if (markerEnd + spaces.length === text.length) {
    return { type, contentColumn: markerEnd + 1, contentStart: text.length, empty: true };
  }
  if (spaces.width > MAX_MARKER_SPACES) {
    return { type, contentColumn: markerEnd + 1, contentStart: markerEnd + 1, empty: false };
  }
  return {
    type,
    contentColumn: markerEnd + spaces.width,
    contentStart: markerEnd + spaces.length,
    empty: false,
  };
}

/** Items belong to the same list only if they use the same bullet or the same number delimiter. */
export function isSameListType(first: ListType, second: ListType): boolean {
  if (first.kind === "bullet" && second.kind === "bullet") {
    return first.character === second.character;
  }
  if (first.kind === "ordered" && second.kind === "ordered") {
    return first.delimiter === second.delimiter;
  }
  return false;
}

// `[^label]:` at the start of a line; the label has no spaces or brackets.
const FOOTNOTE_DEFINITION = /^ {0,3}\[\^([^\][\s]{1,999})\]:[ \t]*/;

export interface FootnoteDefinitionMatch {
  readonly label: string;
  /** Index in the line where the text of the note starts. */
  readonly contentStart: number;
}

export function matchFootnoteDefinition(text: string): FootnoteDefinitionMatch | undefined {
  const match = FOOTNOTE_DEFINITION.exec(text);
  if (match === null) return undefined;
  return { label: match[1] ?? "", contentStart: match[0].length };
}
