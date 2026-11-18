/**
 * Reads the block of settings at the top of a content file:
 *
 *   ---
 *   title: Hello
 *   tags: [typescript, testing]
 *   ---
 *
 * The settings use a documented subset of YAML.
 */
import {
  type Diagnostic,
  type Result,
  type SourcePosition,
  err,
  ok,
} from "../diagnostics/index.ts";
import { FrontmatterCodes } from "./diagnostic-codes.ts";
import { type SourceLine, positionInLine, splitSourceLines } from "./parsing/source-lines.ts";
import type { MapValue } from "./values.ts";
import { parseYamlSubset } from "./parsing/yaml-parser.ts";

export {
  type ContentFields,
  type ContentType,
  contentSchemas,
  validateContent,
} from "./validation/content-types.ts";
export { FrontmatterCodes } from "./diagnostic-codes.ts";
export { toPlainData } from "./plain-data.ts";
export type { ContentDate, Validated } from "./validation/schema.ts";
export type {
  BooleanValue,
  DateValue,
  FrontmatterValue,
  ListValue,
  MapEntry,
  MapValue,
  NullValue,
  NumberValue,
  StringValue,
} from "./values.ts";

export interface FrontmatterFile {
  readonly data: MapValue;
  /** The content after the frontmatter. */
  readonly body: string;
  /** Where the body starts in the file, so warnings about it can use real positions. */
  readonly bodyStart: SourcePosition;
}

const FENCE = /^---[ \t]*$/;
const BYTE_ORDER_MARK = "﻿";

/** Separates the frontmatter from the body. A file without frontmatter is all body. */
export function parseFrontmatter(
  source: string,
  file: string,
): Result<FrontmatterFile, readonly Diagnostic[]> {
  const lines = splitSourceLines(source);
  const start: SourcePosition = { line: 1, column: 1, offset: 0 };
  const opening = lines[0];
  if (opening === undefined || !FENCE.test(withoutByteOrderMark(opening.text))) {
    const data: MapValue = { kind: "map", entries: [], span: { file, start, end: start } };
    return ok({ data, body: source, bodyStart: start });
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && FENCE.test(line.text));
  const closing = lines[closingIndex];
  if (closing === undefined) return err([unclosedFrontmatter(opening, file)]);

  const { data, diagnostics } = parseYamlSubset(lines.slice(1, closingIndex), file, start);
  if (diagnostics.length > 0) {
    return err(diagnostics.toSorted((a, b) => a.span.start.offset - b.span.start.offset));
  }
  return ok({
    data,
    body: source.slice(closing.nextStart),
    bodyStart: { line: closing.number + 1, column: 1, offset: closing.nextStart },
  });
}

function withoutByteOrderMark(text: string): string {
  return text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
}

function unclosedFrontmatter(opening: SourceLine, file: string): Diagnostic {
  return {
    code: FrontmatterCodes.unclosedFrontmatter,
    severity: "error",
    message: "the frontmatter is never closed",
    span: {
      file,
      start: positionInLine(opening, opening.start),
      end: positionInLine(opening, opening.start + opening.text.length),
    },
    hint: "add a line with `---` after the last setting",
  };
}
