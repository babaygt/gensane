/**
 * The data in a file's frontmatter. Every value remembers where it was written, so that later
 * checks, such as a missing title or a wrong type, can point at the exact place in the file.
 */
import type { SourceSpan } from "../diagnostics/index.ts";

export interface StringValue {
  readonly kind: "string";
  readonly value: string;
  readonly span: SourceSpan;
}

export interface NumberValue {
  readonly kind: "number";
  readonly value: number;
  readonly span: SourceSpan;
}

export interface BooleanValue {
  readonly kind: "boolean";
  readonly value: boolean;
  readonly span: SourceSpan;
}

export interface NullValue {
  readonly kind: "null";
  readonly span: SourceSpan;
}

/** `2026-11-18`, `2024-06` (a month, as used for jobs) or `2026-11-18T10:30:00Z`. */
export interface DateValue {
  readonly kind: "date";
  readonly text: string;
  readonly year: number;
  readonly month: number;
  readonly day?: number;
  readonly time?: string;
  readonly span: SourceSpan;
}

export interface ListValue {
  readonly kind: "list";
  readonly items: readonly FrontmatterValue[];
  readonly span: SourceSpan;
}

export interface MapEntry {
  readonly key: string;
  readonly keySpan: SourceSpan;
  readonly value: FrontmatterValue;
}

export interface MapValue {
  readonly kind: "map";
  readonly entries: readonly MapEntry[];
  readonly span: SourceSpan;
}

export type FrontmatterValue =
  | StringValue
  | NumberValue
  | BooleanValue
  | NullValue
  | DateValue
  | ListValue
  | MapValue;
