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
  readonly char: "`" | "~";
  readonly length: number;
  /** Spaces before the fence; this many are removed from each content line. */
  readonly indent: number;
  /** Text after the fence, trimmed, e.g. `ts title=demo`. Its first word is the language. */
  readonly info: string;
}

// Groups: (indent) (3+ backticks OR 3+ tildes, never mixed) (info string).
const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;
// Same shape, but only whitespace may follow: a closing fence has no info string.
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

export function matchFenceOpen(text: string): FenceOpen | undefined {
  const match = FENCE_OPEN.exec(text);
  if (match === null) return undefined;
  const fence = match[2] ?? "";
  const char = fence[0] === "~" ? "~" : "`";
  const info = (match[3] ?? "").trim();
  // Otherwise inline code such as ```foo``` at the start of a line would open a fence.
  if (char === "`" && info.includes("`")) return undefined;
  return { char, length: fence.length, indent: (match[1] ?? "").length, info };
}

/**
 * Same character and at least as long as the opening fence. The length rule lets a
 * ```` block contain a ``` line as plain content.
 */
export function isFenceClose(text: string, open: FenceOpen): boolean {
  const fence = FENCE_CLOSE.exec(text)?.[1];
  return fence !== undefined && fence[0] === open.char && fence.length >= open.length;
}

// Only `=` or only `-`, with no spaces between them (so `- - -` is not an underline).
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;

/** Used only to warn about unsupported Setext headings; `---` is also a thematic break. */
export function isSetextUnderline(text: string): "=" | "-" | undefined {
  const underline = SETEXT_UNDERLINE.exec(text)?.[1];
  if (underline === undefined) return undefined;
  return underline[0] === "=" ? "=" : "-";
}
