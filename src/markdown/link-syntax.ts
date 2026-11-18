/**
 * The building blocks of links: labels, destinations, titles, reference definitions and
 * autolinks. Each function reads from a position and reports where it stopped.
 */
import { unescapeString } from "./character-references.ts";

const MAX_LABEL_LENGTH = 999;
/** The spec allows a limit here, because unclosed parentheses are slow to rule out. */
const MAX_DESTINATION_PARENTHESES = 32;
const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/;

/** Labels match regardless of case and of how whitespace is written. */
export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase().toUpperCase();
}

export function skipWhitespace(text: string, position: number): number {
  let index = position;
  while (text[index] === " " || text[index] === "\t" || text[index] === "\n") index++;
  return index;
}

/** `[label]`: no unescaped brackets inside, and at least one non-space character. */
export function parseLinkLabel(
  text: string,
  position: number,
): { label: string; end: number } | undefined {
  if (text[position] !== "[") return undefined;
  for (
    let index = position + 1;
    index - position - 1 <= MAX_LABEL_LENGTH && index < text.length;
    index++
  ) {
    const character = text[index];
    if (character === "\\") {
      index++;
    } else if (character === "[") {
      return undefined;
    } else if (character === "]") {
      const label = text.slice(position + 1, index);
      return label.trim() === "" ? undefined : { label, end: index + 1 };
    }
  }
  return undefined;
}

/** `<with spaces>` or a run of characters without spaces and with balanced parentheses. */
export function parseLinkDestination(
  text: string,
  position: number,
): { url: string; end: number } | undefined {
  const end =
    text[position] === "<"
      ? endOfAngleDestination(text, position)
      : endOfBareDestination(text, position);
  if (end === undefined) return undefined;
  const raw =
    text[position] === "<" ? text.slice(position + 1, end - 1) : text.slice(position, end);
  return { url: unescapeString(raw), end };
}

function endOfAngleDestination(text: string, position: number): number | undefined {
  for (let index = position + 1; index < text.length; index++) {
    const character = text[index];
    if (character === "\n" || character === "<") return undefined;
    if (character === ">") return index + 1;
    if (character === "\\" && ASCII_PUNCTUATION.test(text[index + 1] ?? "")) index++;
  }
  return undefined;
}

function endOfBareDestination(text: string, position: number): number | undefined {
  let depth = 0;
  let index = position;
  for (; index < text.length; index++) {
    const character = text[index] ?? "";
    if (character <= " " || character === "\x7f") break;
    if (character === "\\" && ASCII_PUNCTUATION.test(text[index + 1] ?? "")) index++;
    else if (character === "(") {
      depth++;
      if (depth > MAX_DESTINATION_PARENTHESES) return undefined;
    } else if (character === ")") {
      if (depth === 0) break;
      depth--;
    }
  }
  return index === position || depth !== 0 ? undefined : index;
}

const TITLE_CLOSERS: Readonly<Record<string, string>> = { '"': '"', "'": "'", "(": ")" };

/** `"title"`, `'title'` or `(title)`. */
export function parseLinkTitle(
  text: string,
  position: number,
): { title: string; end: number } | undefined {
  const opener = text[position] ?? "";
  const closer = TITLE_CLOSERS[opener];
  if (closer === undefined) return undefined;
  for (let index = position + 1; index < text.length; index++) {
    const character = text[index];
    if (character === "\\") index++;
    else if (character === closer)
      return { title: unescapeString(text.slice(position + 1, index)), end: index + 1 };
    else if (character === "(" && opener === "(") return undefined;
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
  position: number,
): ReferenceDefinition | undefined {
  const label = parseLinkLabel(text, position);
  if (label === undefined || text[label.end] !== ":") return undefined;
  // `[^label]:` is the syntax of a footnote, never of a link.
  if (label.label.startsWith("^")) return undefined;
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
function skipToNextLine(text: string, position: number): number {
  let index = position;
  while (text[index] === " " || text[index] === "\t") index++;
  if (text[index] !== "\n") return index;
  index++;
  while (text[index] === " " || text[index] === "\t") index++;
  return index;
}

/** The start of the next line, if only spaces remain on this one. */
function endOfLine(text: string, position: number): number | undefined {
  let index = position;
  while (text[index] === " " || text[index] === "\t") index++;
  if (index >= text.length) return index;
  return text[index] === "\n" ? index + 1 : undefined;
}

// Both patterns come from the CommonMark spec, section "Autolinks".
const URI_SCHEME = /<[A-Za-z][A-Za-z0-9.+-]{1,31}:/y;
const EMAIL_AUTOLINK =
  /<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/y;

/** `<https://example.com>` or `<me@example.com>`. */
export function parseAutolink(
  text: string,
  position: number,
): { url: string; text: string; end: number } | undefined {
  const uriEnd = endOfUriAutolink(text, position);
  if (uriEnd !== undefined) {
    const url = text.slice(position + 1, uriEnd - 1);
    return { url, text: url, end: uriEnd };
  }
  EMAIL_AUTOLINK.lastIndex = position;
  const email = EMAIL_AUTOLINK.exec(text);
  if (email?.[1] === undefined) return undefined;
  return { url: `mailto:${email[1]}`, text: email[1], end: position + email[0].length };
}

/** After the scheme, anything goes except spaces, control characters, `<` and `>`. */
function endOfUriAutolink(text: string, position: number): number | undefined {
  URI_SCHEME.lastIndex = position;
  if (!URI_SCHEME.test(text)) return undefined;
  for (let index = URI_SCHEME.lastIndex; index < text.length; index++) {
    const character = text[index] ?? "";
    if (character === ">") return index + 1;
    if (character === "<" || character <= " " || character === "\x7f") return undefined;
  }
  return undefined;
}
