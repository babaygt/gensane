import type { SourceSpan } from "../diagnostics/index.ts";
import { parseBlocks } from "./block-parser.ts";

/** Removes every `span`, at any depth, so tests can compare tree structure only. */
export function withoutSpans(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSpans);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "span")
      .map(([key, v]) => [key, withoutSpans(v)]),
  );
}

/** Parses a document and returns its blocks without spans. */
export function blocks(source: string): unknown[] {
  return parseBlocks(source, "test.md").document.children.map(withoutSpans);
}

/** Collects every `span` in a tree, at any depth. */
export function allSpans(value: unknown): SourceSpan[] {
  if (Array.isArray(value)) return value.flatMap(allSpans);
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, v]) =>
    key === "span" ? [v as SourceSpan] : allSpans(v),
  );
}
