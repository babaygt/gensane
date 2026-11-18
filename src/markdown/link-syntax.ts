/**
 * The building blocks of links: labels, destinations, titles, reference definitions and
 * autolinks. Each function reads from a position and reports where it stopped.
 */
import { unescapeString } from "./character-references.ts";

const MAX_LABEL_LENGTH = 999;
const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/;

/** Labels match regardless of case and of how whitespace is written. */
export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase().toUpperCase();
}

export function skipWhitespace(text: string, pos: number): number {
  let i = pos;
  while (text[i] === " " || text[i] === "\t" || text[i] === "\n") i++;
  return i;
}

/** `[label]`: no unescaped brackets inside, and at least one non-space character. */
export function parseLinkLabel(
  text: string,
  pos: number,
): { label: string; end: number } | undefined {
  if (text[pos] !== "[") return undefined;
  for (let i = pos + 1; i - pos - 1 <= MAX_LABEL_LENGTH && i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") {
      i++;
    } else if (ch === "[") {
      return undefined;
    } else if (ch === "]") {
      const label = text.slice(pos + 1, i);
      return label.trim() === "" ? undefined : { label, end: i + 1 };
    }
  }
  return undefined;
}

/** `<with spaces>` or a run of characters without spaces and with balanced parentheses. */
export function parseLinkDestination(
  text: string,
  pos: number,
): { url: string; end: number } | undefined {
  const end =
    text[pos] === "<" ? endOfAngleDestination(text, pos) : endOfBareDestination(text, pos);
  if (end === undefined) return undefined;
  const raw = text[pos] === "<" ? text.slice(pos + 1, end - 1) : text.slice(pos, end);
  return { url: unescapeString(raw), end };
}

function endOfAngleDestination(text: string, pos: number): number | undefined {
  for (let i = pos + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n" || ch === "<") return undefined;
    if (ch === ">") return i + 1;
    if (ch === "\\" && ASCII_PUNCTUATION.test(text[i + 1] ?? "")) i++;
  }
  return undefined;
}

function endOfBareDestination(text: string, pos: number): number | undefined {
  let depth = 0;
  let i = pos;
  for (; i < text.length; i++) {
    const ch = text[i] ?? "";
    if (ch <= " " || ch === "\x7f") break;
    if (ch === "\\" && ASCII_PUNCTUATION.test(text[i + 1] ?? "")) i++;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      if (depth === 0) break;
      depth--;
    }
  }
  return i === pos || depth !== 0 ? undefined : i;
}

const TITLE_CLOSERS: Readonly<Record<string, string>> = { '"': '"', "'": "'", "(": ")" };

/** `"title"`, `'title'` or `(title)`. */
export function parseLinkTitle(
  text: string,
  pos: number,
): { title: string; end: number } | undefined {
  const opener = text[pos] ?? "";
  const closer = TITLE_CLOSERS[opener];
  if (closer === undefined) return undefined;
  for (let i = pos + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") i++;
    else if (ch === closer) return { title: unescapeString(text.slice(pos + 1, i)), end: i + 1 };
    else if (ch === "(" && opener === "(") return undefined;
  }
  return undefined;
}

export interface ReferenceDefinition {
  /** Already normalized, ready to use as a lookup key. */
  readonly label: string;
  readonly url: string;
  readonly title: string | undefined;
  /** Where the text after the definition starts. */
  readonly end: number;
}

/** `[label]: destination "optional title"`, each part may be on its own line. */
export function parseReferenceDefinition(
  text: string,
  pos: number,
): ReferenceDefinition | undefined {
  const label = parseLinkLabel(text, pos);
  if (label === undefined || text[label.end] !== ":") return undefined;
  const destination = parseLinkDestination(text, skipToNextLine(text, label.end + 1));
  if (destination === undefined) return undefined;

  const key = normalizeLabel(label.label);
  const titleStart = skipToNextLine(text, destination.end);
  const title = titleStart > destination.end ? parseLinkTitle(text, titleStart) : undefined;
  const afterTitle = title === undefined ? undefined : endOfLine(text, title.end);
  if (title !== undefined && afterTitle !== undefined) {
    return { label: key, url: destination.url, title: title.title, end: afterTitle };
  }
  // A failed title on the next line is ordinary text; the definition ends before it.
  const end = endOfLine(text, destination.end);
  return end === undefined
    ? undefined
    : { label: key, url: destination.url, title: undefined, end };
}

/** Skips spaces and at most one line ending. */
function skipToNextLine(text: string, pos: number): number {
  let i = pos;
  while (text[i] === " " || text[i] === "\t") i++;
  if (text[i] !== "\n") return i;
  i++;
  while (text[i] === " " || text[i] === "\t") i++;
  return i;
}

/** The start of the next line, if only spaces remain on this one. */
function endOfLine(text: string, pos: number): number | undefined {
  let i = pos;
  while (text[i] === " " || text[i] === "\t") i++;
  if (i >= text.length) return i;
  return text[i] === "\n" ? i + 1 : undefined;
}

// Both patterns come from the CommonMark spec, section "Autolinks".
const URI_SCHEME = /<[A-Za-z][A-Za-z0-9.+-]{1,31}:/y;
const EMAIL_AUTOLINK =
  /<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/y;

/** `<https://example.com>` or `<me@example.com>`. */
export function parseAutolink(
  text: string,
  pos: number,
): { url: string; text: string; end: number } | undefined {
  const uriEnd = endOfUriAutolink(text, pos);
  if (uriEnd !== undefined) {
    const url = text.slice(pos + 1, uriEnd - 1);
    return { url, text: url, end: uriEnd };
  }
  EMAIL_AUTOLINK.lastIndex = pos;
  const email = EMAIL_AUTOLINK.exec(text);
  if (email?.[1] === undefined) return undefined;
  return { url: `mailto:${email[1]}`, text: email[1], end: pos + email[0].length };
}

/** After the scheme, anything goes except spaces, control characters, `<` and `>`. */
function endOfUriAutolink(text: string, pos: number): number | undefined {
  URI_SCHEME.lastIndex = pos;
  if (!URI_SCHEME.test(text)) return undefined;
  for (let i = URI_SCHEME.lastIndex; i < text.length; i++) {
    const ch = text[i] ?? "";
    if (ch === ">") return i + 1;
    if (ch === "<" || ch <= " " || ch === "\x7f") return undefined;
  }
  return undefined;
}
