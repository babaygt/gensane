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

export function parseInlines(
  text: string,
  segments: readonly TextSegment[],
  file: string,
): Inline[] {
  return new InlineParser(text, segments, file).parse();
}

/** Rendering is recursive, so unlimited nesting would overflow the call stack. */
const MAX_EMPHASIS_DEPTH = 256;

const PLAIN_TEXT = /[^\\`*_~\n]+/y;
const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/;
const WHITESPACE = /\s/u;
const PUNCTUATION = /[\p{P}\p{S}]/u;

class InlineParser {
  readonly #text: string;
  readonly #segments: readonly TextSegment[];
  readonly #file: string;
  readonly #head: Entry = {
    inline: undefined,
    depth: 0,
    run: undefined,
    previous: undefined,
    next: undefined,
  };
  #tail: Entry = this.#head;
  #firstRun: DelimiterRun | undefined;
  #lastRun: DelimiterRun | undefined;
  #runCount = 0;
  #pos = 0;
  #backticks: Map<number, { starts: number[]; cursor: number }> | undefined;

  constructor(text: string, segments: readonly TextSegment[], file: string) {
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
      else this.#parsePlainText();
    }
    this.#processEmphasis();
    return this.#collect(this.#head.next, undefined);
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

  /** Pairs delimiter runs into emphasis, strong emphasis and strikethrough. */
  #processEmphasis(): void {
    // Where the search for an opener can stop, so long documents stay fast.
    const openersBottom = new Map<string, number>();
    let closer = this.#firstRun;

    while (closer !== undefined) {
      if (!closer.canClose) {
        closer = closer.next;
        continue;
      }
      const key = `${closer.char}${closer.canOpen}${closer.length % 3}`;
      const opener = this.#findOpener(closer, openersBottom.get(key) ?? -1);
      if (opener === undefined) {
        openersBottom.set(key, closer.previous?.order ?? -1);
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
