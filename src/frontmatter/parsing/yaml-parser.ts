/**
 * Parses the supported subset of YAML. Structure comes from indentation, so this is a recursive
 * descent parser over lines: a map or list reads the lines at its own indentation, and a deeper
 * line starts a nested value. After an error it skips the broken entry and continues, so one run
 * reports every problem in the file.
 */
import type {
  Diagnostic,
  DiagnosticCode,
  SourcePosition,
  SourceSpan,
} from "../../diagnostics/index.ts";
import { FrontmatterCodes } from "../diagnostic-codes.ts";
import { MAX_NESTING_DEPTH, type ReportProblem, readInlineValue } from "./inline-values.ts";
import { type SourceLine, positionInLine } from "./source-lines.ts";
import type { FrontmatterValue, ListValue, MapEntry, MapValue } from "../values.ts";

/** A line with content. A list item's text is a line of its own, indented past the dash. */
interface ContentLine {
  readonly source: SourceLine;
  readonly indent: number;
  readonly text: string;
  /** Offset of `text` in the file. */
  readonly offset: number;
}

export interface YamlParseResult {
  readonly data: MapValue;
  readonly diagnostics: readonly Diagnostic[];
}

export function parseYamlSubset(
  lines: readonly SourceLine[],
  file: string,
  start: SourcePosition,
): YamlParseResult {
  return new YamlParser(lines, file, start).parse();
}

const ENTRY = /^([A-Za-z_][\w.-]*):(?:[ \t]+(.*))?$/;
const MISSING_SPACE = /^[A-Za-z_][\w.-]*:\S/;

function isListItem(text: string): boolean {
  return text === "-" || text.startsWith("- ") || text.startsWith("-\t");
}

class YamlParser {
  readonly #file: string;
  readonly #start: SourcePosition;
  readonly #diagnostics: Diagnostic[] = [];
  readonly #lines: ContentLine[];
  #index = 0;

  constructor(lines: readonly SourceLine[], file: string, start: SourcePosition) {
    this.#file = file;
    this.#start = start;
    this.#lines = lines.flatMap((line) => this.#toContentLine(line));
  }

  parse(): YamlParseResult {
    return { data: this.#parseMap(0, 0), diagnostics: this.#diagnostics };
  }

  /** Blank lines and comments carry no content, and tabs can't be measured as indentation. */
  #toContentLine(source: SourceLine): ContentLine[] {
    const indentation = /^[ \t]*/.exec(source.text)?.[0] ?? "";
    const text = source.text.slice(indentation.length).trimEnd();
    if (text === "" || text.startsWith("#")) return [];
    if (indentation.includes("\t")) {
      this.#report(
        FrontmatterCodes.tabIndentation,
        "tabs cannot be used for indentation",
        this.#lineSpan(source, source.start, source.start + indentation.length),
        "indent with spaces instead",
      );
      return [];
    }
    const indent = indentation.length;
    return [{ source, indent, text, offset: source.start + indent }];
  }

  #parseMap(indent: number, depth: number): MapValue {
    const entries: MapEntry[] = [];
    const keys = new Set<string>();
    const first = this.#current();

    for (let line = first; line !== undefined && line.indent >= indent; line = this.#current()) {
      if (line.indent > indent) {
        this.#report(
          FrontmatterCodes.unexpectedIndentation,
          "this line is indented more than the lines around it",
          this.#textSpan(line),
          "line it up with the other keys at this level",
        );
        this.#skipEntry(line);
        continue;
      }
      const entry = this.#parseEntry(line, depth);
      if (entry === undefined) continue;
      if (keys.has(entry.key)) {
        this.#report(
          FrontmatterCodes.duplicateKey,
          `the key "${entry.key}" is used more than once`,
          entry.keySpan,
          "remove one of them, or rename it",
        );
      } else {
        keys.add(entry.key);
        entries.push(entry);
      }
    }
    return { kind: "map", entries, span: this.#mapSpan(entries) };
  }

  #parseEntry(line: ContentLine, depth: number): MapEntry | undefined {
    const match = ENTRY.exec(line.text);
    if (match?.[1] === undefined) {
      const missingSpace = MISSING_SPACE.test(line.text);
      this.#report(
        FrontmatterCodes.invalidEntry,
        "expected a `key: value` line",
        this.#textSpan(line),
        missingSpace
          ? "add a space after the colon"
          : "keys contain only letters, digits, `_`, `-` and `.`, and are followed by a colon",
      );
      this.#skipEntry(line);
      return undefined;
    }
    const key = match[1];
    const keySpan = this.#lineSpan(line.source, line.offset, line.offset + key.length);
    const inline = match[2] ?? "";
    this.#index++;

    if (inline !== "" && !inline.startsWith("#")) {
      const valueOffset = line.offset + line.text.length - inline.length;
      const value = readInlineValue(inline, valueOffset, line.source, this.#file, this.#reporter());
      this.#rejectDeeperLines(line.indent);
      return { key, keySpan, value };
    }
    return { key, keySpan, value: this.#parseNestedValue(line.indent, keySpan, depth) };
  }

  /** The value of `key:` on the following lines. A list may sit at the same indentation. */
  #parseNestedValue(indent: number, at: SourceSpan, depth: number): FrontmatterValue {
    const next = this.#current();
    if (next !== undefined && next.indent === indent && isListItem(next.text)) {
      return this.#parseList(next, depth + 1);
    }
    if (next !== undefined && next.indent > indent) return this.#parseBlock(next, depth + 1);
    return { kind: "null", span: { file: at.file, start: at.end, end: at.end } };
  }

  #parseBlock(line: ContentLine, depth: number): FrontmatterValue {
    if (depth > MAX_NESTING_DEPTH) {
      this.#report(
        FrontmatterCodes.nestingTooDeep,
        `values are nested more than ${MAX_NESTING_DEPTH} levels deep`,
        this.#textSpan(line),
        "reduce the nesting",
      );
      this.#skipEntry(line);
      return { kind: "null", span: this.#textSpan(line) };
    }
    return isListItem(line.text)
      ? this.#parseList(line, depth)
      : this.#parseMap(line.indent, depth);
  }

  #parseList(first: ContentLine, depth: number): ListValue {
    const items: FrontmatterValue[] = [];
    for (
      let line: ContentLine | undefined = first;
      line !== undefined && line.indent === first.indent && isListItem(line.text);
      line = this.#current()
    ) {
      items.push(this.#parseListItem(line, depth));
    }
    const start = this.#textSpan(first).start;
    const end = items.at(-1)?.span.end ?? start;
    return { kind: "list", items, span: { file: this.#file, start, end } };
  }

  #parseListItem(line: ContentLine, depth: number): FrontmatterValue {
    const afterDash = line.text.slice(1);
    const text = afterDash.trimStart();
    if (text === "") {
      this.#index++;
      const dash = this.#lineSpan(line.source, line.offset, line.offset + 1);
      const next = this.#current();
      if (next !== undefined && next.indent > line.indent) return this.#parseBlock(next, depth + 1);
      return { kind: "null", span: dash };
    }

    const distance = 1 + afterDash.length - text.length;
    const inner: ContentLine = {
      source: line.source,
      indent: line.indent + distance,
      text,
      offset: line.offset + distance,
    };
    if (isListItem(text) || ENTRY.test(text)) {
      // The item's text becomes a line of its own, so the lines below it can line up with it.
      this.#lines[this.#index] = inner;
      return this.#parseBlock(inner, depth + 1);
    }
    this.#index++;
    const value = readInlineValue(text, inner.offset, line.source, this.#file, this.#reporter());
    this.#rejectDeeperLines(line.indent);
    return value;
  }

  /** A value on the same line as its key can't also continue on the lines below. */
  #rejectDeeperLines(indent: number): void {
    const next = this.#current();
    if (next === undefined || next.indent <= indent) return;
    this.#report(
      FrontmatterCodes.unexpectedIndentation,
      "this line is indented, but the entry above already has a value",
      this.#textSpan(next),
      "put long text on one line in quotes, or line this up with the other keys",
    );
    this.#skipEntry(next);
  }

  /** Skips a broken line and everything nested under it. */
  #skipEntry(line: ContentLine): void {
    this.#index++;
    for (let next = this.#current(); next !== undefined && next.indent > line.indent;) {
      this.#index++;
      next = this.#current();
    }
  }

  #current(): ContentLine | undefined {
    return this.#lines[this.#index];
  }

  #reporter(): ReportProblem {
    return (code, message, span, hint) => this.#report(code, message, span, hint);
  }

  #report(code: DiagnosticCode, message: string, span: SourceSpan, hint: string): void {
    this.#diagnostics.push({ code, severity: "error", message, span, hint });
  }

  #textSpan(line: ContentLine): SourceSpan {
    return this.#lineSpan(line.source, line.offset, line.offset + line.text.length);
  }

  #lineSpan(line: SourceLine, start: number, end: number): SourceSpan {
    return {
      file: this.#file,
      start: positionInLine(line, start),
      end: positionInLine(line, end),
    };
  }

  #mapSpan(entries: readonly MapEntry[]): SourceSpan {
    const first = entries[0];
    const last = entries.at(-1);
    if (first === undefined || last === undefined) {
      return { file: this.#file, start: this.#start, end: this.#start };
    }
    return { file: this.#file, start: first.keySpan.start, end: last.value.span.end };
  }
}
