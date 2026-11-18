/**
 * Stage 3 of the compiler: parse the text inside a block (emphasis, code spans, ...).
 *
 * Unlike block structure, inline syntax is scanned character by character. Emphasis
 * cannot be decided while scanning, because whether a `*` opens anything depends on what
 * comes later. So the scanner first records delimiter runs, and `#processEmphasis` then
 * pairs them using the algorithm from the CommonMark spec's appendix.
 */
import type { SourcePosition, SourceSpan } from "../diagnostics/index.ts";
import type { Inline, TextSegment } from "./ast.ts";
import { decodeCharacterReference } from "./character-references.ts";
import {
  normalizeLabel,
  parseAutolink,
  parseLinkDestination,
  parseLinkLabel,
  parseLinkTitle,
  skipWhitespace,
} from "./link-syntax.ts";

type DelimiterChar = "*" | "_" | "~";

/** A run of delimiter characters. `start` and `end` shrink as characters get paired. */
interface DelimiterRun {
  readonly char: DelimiterChar;
  readonly length: number;
  readonly canOpen: boolean;
  readonly canClose: boolean;
  /** Increases from left to right; used to compare positions in the run list. */
  readonly order: number;
  readonly entry: Entry;
  start: number;
  end: number;
  previous: DelimiterRun | undefined;
  next: DelimiterRun | undefined;
}

/** A linked list keeps inserting and removing nodes cheap while emphasis is paired. */
interface Entry {
  inline: Inline | undefined;
  /** How many levels of emphasis this node contains. */
  depth: number;
  run: DelimiterRun | undefined;
  previous: Entry | undefined;
  next: Entry | undefined;
}

/** A `[` or `![` that may still become the start of a link or image. */
interface Bracket {
  readonly entry: Entry;
  readonly image: boolean;
  readonly start: number;
  readonly contentStart: number;
  /** The last delimiter run before this bracket; emphasis inside the link stops there. */
  readonly runBelow: DelimiterRun | undefined;
  readonly previous: Bracket | undefined;
  /** Links cannot contain links, so a finished link deactivates the `[` brackets before it. */
  active: boolean;
}

export interface LinkReference {
  readonly url: string;
  readonly title: string | undefined;
}

interface LinkTarget extends LinkReference {
  readonly end: number;
}

export function parseInlines(
  text: string,
  segments: readonly TextSegment[],
  file: string,
  references: ReadonlyMap<string, LinkReference>,
): Inline[] {
  return new InlineParser(text, segments, file, references).parse();
}

/** Rendering is recursive, so unlimited nesting would overflow the call stack. */
const MAX_EMPHASIS_DEPTH = 256;

const PLAIN_TEXT = /[^\\`*_~\n[\]!<&]+/y;
const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/;
const WHITESPACE = /\s/u;
const PUNCTUATION = /[\p{P}\p{S}]/u;

class InlineParser {
  readonly #text: string;
  readonly #segments: readonly TextSegment[];
  readonly #file: string;
  readonly #references: ReadonlyMap<string, LinkReference>;
  readonly #head: Entry = {
    inline: undefined,
    depth: 0,
    run: undefined,
    previous: undefined,
    next: undefined,
  };
  #tail: Entry = this.#head;
  #bracket: Bracket | undefined;
  /** Set when images nest too deeply; all later brackets then stay as text. */
  #tooDeep = false;
  #firstRun: DelimiterRun | undefined;
  #lastRun: DelimiterRun | undefined;
  #runCount = 0;
  #pos = 0;
  #backticks: Map<number, { starts: number[]; cursor: number }> | undefined;

  constructor(
    text: string,
    segments: readonly TextSegment[],
    file: string,
    references: ReadonlyMap<string, LinkReference>,
  ) {
    this.#references = references;
    this.#text = text;
    this.#segments = segments;
    this.#file = file;
  }

  parse(): Inline[] {
    while (this.#pos < this.#text.length) {
      const ch = this.#text[this.#pos];
      if (ch === "\\") this.#parseEscape();
      else if (ch === "`") this.#parseCodeSpan();
      else if (ch === "*" || ch === "_" || ch === "~") this.#parseDelimiterRun(ch);
      else if (ch === "\n") this.#parseLineBreak();
      else if (ch === "[") this.#openBracket(false);
      else if (ch === "!" && this.#text[this.#pos + 1] === "[") this.#openBracket(true);
      else if (ch === "]") this.#closeBracket();
      else if (ch === "<") this.#parseAutolink();
      else if (ch === "&") this.#parseCharacterReference();
      else if (ch === "!") this.#pushLiteral(1);
      else this.#parsePlainText();
    }
    this.#processEmphasis(undefined);
    return this.#collect(this.#head.next, undefined);
  }

  #pushLiteral(length: number): void {
    const end = this.#pos + length;
    this.#pushText(this.#text.slice(this.#pos, end), this.#pos, end);
    this.#pos = end;
  }

  #parseCharacterReference(): void {
    const reference = decodeCharacterReference(this.#text, this.#pos);
    if (reference === undefined) {
      this.#pushLiteral(1);
      return;
    }
    this.#pushText(reference.text, this.#pos, reference.end);
    this.#pos = reference.end;
  }

  #parseAutolink(): void {
    const autolink = parseAutolink(this.#text, this.#pos);
    if (autolink === undefined) {
      this.#pushLiteral(1);
      return;
    }
    const { url, text, end } = autolink;
    const children: Inline[] = [{ kind: "text", text, span: this.#span(this.#pos + 1, end - 1) }];
    this.#append({ kind: "link", url, children, span: this.#span(this.#pos, end) });
    this.#pos = end;
  }

  #openBracket(image: boolean): void {
    const start = this.#pos;
    const length = image ? 2 : 1;
    this.#pushLiteral(length);
    this.#bracket = {
      entry: this.#tail,
      image,
      start,
      contentStart: start + length,
      runBelow: this.#lastRun,
      previous: this.#bracket,
      active: true,
    };
  }

  /** A `]` either completes a link or image, or is plain text. */
  #closeBracket(): void {
    const opener = this.#bracket;
    if (opener === undefined) {
      this.#pushLiteral(1);
      return;
    }
    this.#bracket = opener.previous;
    const target = opener.active && !this.#tooDeep ? this.#linkTarget(opener) : undefined;
    const depth = target === undefined ? 0 : this.#depthAfter(opener.entry) + 1;
    this.#tooDeep ||= depth > MAX_EMPHASIS_DEPTH;
    if (target === undefined || this.#tooDeep) {
      this.#pushLiteral(1);
      return;
    }

    this.#processEmphasis(opener.runBelow);
    const children = this.#collect(opener.entry.next, undefined);
    this.#tail = opener.entry.previous ?? this.#head;
    this.#tail.next = undefined;

    const { url, title, end } = target;
    const span = this.#span(opener.start, end);
    const optionalTitle = title === undefined ? {} : { title };
    const kind = opener.image ? "image" : "link";
    this.#appendEntry({ kind, url, ...optionalTitle, children, span }).depth = depth;
    this.#pos = end;

    if (!opener.image) {
      for (let bracket = this.#bracket; bracket !== undefined; bracket = bracket.previous) {
        if (!bracket.image) bracket.active = false;
      }
    }
  }

  /** Tries the three link forms after `]`: `(/url)`, `[label]`, and the text as its own label. */
  #linkTarget(opener: Bracket): LinkTarget | undefined {
    const after = this.#pos + 1;
    if (this.#text[after] === "(") {
      const inline = this.#inlineLinkTarget(after);
      if (inline !== undefined) return inline;
    }
    const full = parseLinkLabel(this.#text, after);
    if (full !== undefined) return this.#referenceTarget(full.label, full.end);

    const own = parseLinkLabel(this.#text, opener.contentStart - 1);
    if (own?.end !== after) return undefined;
    const end = this.#text.startsWith("[]", after) ? after + 2 : after;
    return this.#referenceTarget(own.label, end);
  }

  #referenceTarget(label: string, end: number): LinkTarget | undefined {
    const reference = this.#references.get(normalizeLabel(label));
    return reference === undefined
      ? undefined
      : { url: reference.url, title: reference.title, end };
  }

  /** `(destination "title")`, where both parts are optional. */
  #inlineLinkTarget(open: number): LinkTarget | undefined {
    let i = skipWhitespace(this.#text, open + 1);
    const destination = parseLinkDestination(this.#text, i);
    if (destination !== undefined) i = destination.end;

    const titleStart = skipWhitespace(this.#text, i);
    const title = titleStart > i ? parseLinkTitle(this.#text, titleStart) : undefined;
    i = skipWhitespace(this.#text, title?.end ?? titleStart);
    if (this.#text[i] !== ")") return undefined;
    return { url: destination?.url ?? "", title: title?.title, end: i + 1 };
  }

  #parsePlainText(): void {
    PLAIN_TEXT.lastIndex = this.#pos;
    PLAIN_TEXT.test(this.#text);
    const end = PLAIN_TEXT.lastIndex;
    // Spaces before a line ending are not part of the text.
    const content = this.#text.slice(this.#pos, end);
    const kept = this.#text[end] === "\n" ? content.replace(/[ \t]+$/, "") : content;
    if (kept !== "") this.#pushText(kept, this.#pos, this.#pos + kept.length);
    this.#pos = end;
  }

  #parseEscape(): void {
    const start = this.#pos;
    const next = this.#text[start + 1];
    if (next === "\n") {
      this.#append({ kind: "hard-break", span: this.#span(start, start + 1) });
      this.#pos = start + 2;
    } else if (next !== undefined && ASCII_PUNCTUATION.test(next)) {
      this.#pushText(next, start, start + 2);
      this.#pos = start + 2;
    } else {
      this.#pushText("\\", start, start + 1);
      this.#pos = start + 1;
    }
  }

  #parseCodeSpan(): void {
    const start = this.#pos;
    let contentStart = start;
    while (this.#text[contentStart] === "`") contentStart++;
    const length = contentStart - start;

    const closing = this.#findClosingBackticks(length, contentStart);
    if (closing === undefined) {
      this.#pushText(this.#text.slice(start, contentStart), start, contentStart);
      this.#pos = contentStart;
      return;
    }
    const end = closing + length;
    const text = normalizeCodeSpan(this.#text.slice(contentStart, closing));
    this.#append({ kind: "code-span", text, span: this.#span(start, end) });
    this.#pos = end;
  }

  /** Finds the next backtick run of exactly `length`, without rescanning the text each time. */
  #findClosingBackticks(length: number, from: number): number | undefined {
    if (this.#backticks === undefined) {
      this.#backticks = new Map();
      for (const match of this.#text.matchAll(/`+/g)) {
        const runs = this.#backticks.get(match[0].length) ?? { starts: [], cursor: 0 };
        runs.starts.push(match.index);
        this.#backticks.set(match[0].length, runs);
      }
    }
    const runs = this.#backticks.get(length);
    if (runs === undefined) return undefined;
    while ((runs.starts[runs.cursor] ?? Infinity) < from) runs.cursor++;
    return runs.starts[runs.cursor];
  }

  #parseDelimiterRun(char: DelimiterChar): void {
    const start = this.#pos;
    let end = start;
    while (this.#text[end] === char) end++;
    this.#pos = end;

    // Only `~~` is strikethrough, so that `~5 minutes` stays plain text.
    if (char === "~" && end - start !== 2) {
      this.#pushText(this.#text.slice(start, end), start, end);
      return;
    }

    const before = characterBefore(this.#text, start);
    const after = characterAfter(this.#text, end);
    const beforeSpace = WHITESPACE.test(before);
    const afterSpace = WHITESPACE.test(after);
    const beforePunctuation = PUNCTUATION.test(before);
    const afterPunctuation = PUNCTUATION.test(after);
    const leftFlanking = !afterSpace && (!afterPunctuation || beforeSpace || beforePunctuation);
    const rightFlanking = !beforeSpace && (!beforePunctuation || afterSpace || afterPunctuation);

    // `_` is stricter than `*`, so that snake_case_names are not emphasised.
    const canOpen =
      char === "_" ? leftFlanking && (!rightFlanking || beforePunctuation) : leftFlanking;
    const canClose =
      char === "_" ? rightFlanking && (!leftFlanking || afterPunctuation) : rightFlanking;

    const entry = this.#appendEntry(undefined);
    const run: DelimiterRun = {
      char,
      length: end - start,
      canOpen,
      canClose,
      order: this.#runCount++,
      entry,
      start,
      end,
      previous: this.#lastRun,
      next: undefined,
    };
    entry.run = run;
    if (this.#lastRun === undefined) this.#firstRun = run;
    else this.#lastRun.next = run;
    this.#lastRun = run;
  }

  #parseLineBreak(): void {
    const end = this.#pos;
    let start = end;
    while (this.#text[start - 1] === " ") start--;
    const kind = end - start >= 2 ? "hard-break" : "soft-break";
    this.#append({ kind, span: this.#span(start, end) });
    this.#pos = end + 1;
  }

  /**
   * Pairs delimiter runs above `bottom` into emphasis, strong emphasis and strikethrough.
   * Afterwards those runs are finished: what is left of them is plain text.
   */
  #processEmphasis(bottom: DelimiterRun | undefined): void {
    this.#pairDelimiters(bottom);
    if (bottom === undefined) this.#firstRun = undefined;
    else bottom.next = undefined;
    this.#lastRun = bottom;
  }

  #pairDelimiters(bottom: DelimiterRun | undefined): void {
    // Where the search for an opener can stop, so long documents stay fast.
    const openersBottom = new Map<string, number>();
    const floor = bottom?.order ?? -1;
    let closer = bottom === undefined ? this.#firstRun : bottom.next;

    while (closer !== undefined) {
      if (!closer.canClose) {
        closer = closer.next;
        continue;
      }
      const key = `${closer.char}${closer.canOpen}${closer.length % 3}`;
      const opener = this.#findOpener(closer, openersBottom.get(key) ?? floor);
      if (opener === undefined) {
        openersBottom.set(key, closer.previous?.order ?? floor);
        const next: DelimiterRun | undefined = closer.next;
        if (!closer.canOpen) this.#removeRun(closer);
        closer = next;
        continue;
      }
      // Past the limit, all remaining delimiters simply stay as text.
      const depth = this.#depthBetween(opener, closer) + 1;
      if (depth > MAX_EMPHASIS_DEPTH) return;
      this.#wrap(opener, closer, depth);
      if (opener.end === opener.start) this.#removeRunAndEntry(opener);
      if (closer.end === closer.start) {
        const next: DelimiterRun | undefined = closer.next;
        this.#removeRunAndEntry(closer);
        closer = next;
      }
    }
  }

  #findOpener(closer: DelimiterRun, bottom: number): DelimiterRun | undefined {
    for (let run = closer.previous; run !== undefined && run.order > bottom; run = run.previous) {
      if (run.char === closer.char && run.canOpen && !breaksRuleOfThree(run, closer)) return run;
    }
    return undefined;
  }

  #depthAfter(start: Entry): number {
    let depth = 0;
    for (let entry = start.next; entry !== undefined; entry = entry.next) {
      depth = Math.max(depth, entry.depth);
    }
    return depth;
  }

  #depthBetween(opener: DelimiterRun, closer: DelimiterRun): number {
    let depth = 0;
    for (let entry = opener.entry.next; entry !== closer.entry; entry = entry?.next) {
      depth = Math.max(depth, entry?.depth ?? 0);
    }
    return depth;
  }

  /** Moves everything between two runs into a new node, using up delimiter characters. */
  #wrap(opener: DelimiterRun, closer: DelimiterRun, depth: number): void {
    const bothDouble = opener.end - opener.start >= 2 && closer.end - closer.start >= 2;
    const used = bothDouble ? 2 : 1;
    const children = this.#collect(opener.entry.next, closer.entry);
    opener.end -= used;
    closer.start += used;

    const span = this.#span(opener.end, closer.start);
    let inline: Inline;
    if (opener.char === "~") inline = { kind: "strikethrough", children, span };
    else if (used === 2) inline = { kind: "strong", children, span };
    else inline = { kind: "emphasis", children, span };

    const entry: Entry = {
      inline,
      depth,
      run: undefined,
      previous: opener.entry,
      next: closer.entry,
    };
    opener.entry.next = entry;
    closer.entry.previous = entry;
    opener.next = closer;
    closer.previous = opener;
  }

  #removeRun(run: DelimiterRun): void {
    if (run.previous === undefined) this.#firstRun = run.next;
    else run.previous.next = run.next;
    if (run.next !== undefined) run.next.previous = run.previous;
  }

  #removeRunAndEntry(run: DelimiterRun): void {
    this.#removeRun(run);
    const { previous, next } = run.entry;
    if (previous !== undefined) previous.next = next;
    if (next !== undefined) next.previous = previous;
  }

  /** The nodes from `first` up to `stop`; unpaired delimiters become text. */
  #collect(first: Entry | undefined, stop: Entry | undefined): Inline[] {
    const inlines: Inline[] = [];
    for (let entry = first; entry !== undefined && entry !== stop; entry = entry.next) {
      const inline = entry.inline ?? this.#runAsText(entry.run);
      if (inline !== undefined) pushMerged(inlines, inline);
    }
    return inlines;
  }

  #runAsText(run: DelimiterRun | undefined): Inline | undefined {
    if (run === undefined || run.start === run.end) return undefined;
    const text = this.#text.slice(run.start, run.end);
    return { kind: "text", text, span: this.#span(run.start, run.end) };
  }

  #pushText(text: string, start: number, end: number): void {
    this.#append({ kind: "text", text, span: this.#span(start, end) });
  }

  #append(inline: Inline): void {
    this.#appendEntry(inline);
  }

  #appendEntry(inline: Inline | undefined): Entry {
    const entry: Entry = {
      inline,
      depth: 0,
      run: undefined,
      previous: this.#tail,
      next: undefined,
    };
    this.#tail.next = entry;
    this.#tail = entry;
    return entry;
  }

  #span(start: number, end: number): SourceSpan {
    return { file: this.#file, start: this.#position(start), end: this.#position(end) };
  }

  /** Maps an index in the block's text back to the original file. */
  #position(index: number): SourcePosition {
    let low = 0;
    let high = this.#segments.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((this.#segments[middle]?.index ?? 0) <= index) low = middle;
      else high = middle - 1;
    }
    const segment = this.#segments[low];
    const distance = index - (segment?.index ?? 0);
    const { line = 1, column = 1, offset = 0 } = segment?.position ?? {};
    return { line, column: column + distance, offset: offset + distance };
  }
}

/** Line endings become spaces, and one space is removed from each side if both have one. */
function normalizeCodeSpan(raw: string): string {
  const text = raw.replaceAll("\n", " ");
  const padded = text.startsWith(" ") && text.endsWith(" ") && text.trim() !== "";
  return padded ? text.slice(1, -1) : text;
}

/**
 * CommonMark's "rule of 3": if one run can both open and close, the two run lengths must
 * not add up to a multiple of 3, unless both lengths are multiples of 3.
 */
function breaksRuleOfThree(opener: DelimiterRun, closer: DelimiterRun): boolean {
  return (
    (opener.canClose || closer.canOpen) &&
    closer.length % 3 !== 0 &&
    (opener.length + closer.length) % 3 === 0
  );
}

/** Text next to other text becomes one node. */
function pushMerged(inlines: Inline[], inline: Inline): void {
  const last = inlines.at(-1);
  if (last?.kind === "text" && inline.kind === "text") {
    inlines[inlines.length - 1] = {
      kind: "text",
      text: last.text + inline.text,
      span: { file: last.span.file, start: last.span.start, end: inline.span.end },
    };
  } else {
    inlines.push(inline);
  }
}

/** The start and end of the text count as whitespace. */
function characterBefore(text: string, index: number): string {
  if (index === 0) return "\n";
  return Array.from(text.slice(Math.max(0, index - 2), index)).at(-1) ?? "\n";
}

function characterAfter(text: string, index: number): string {
  const codePoint = text.codePointAt(index);
  return codePoint === undefined ? "\n" : String.fromCodePoint(codePoint);
}
