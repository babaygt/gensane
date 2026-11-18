import type { Document, HeadingLevel } from "./ast.ts";
import { plainTextOf } from "./inline-text.ts";

export interface TableOfContentsEntry {
  readonly id: string;
  readonly text: string;
  readonly level: HeadingLevel;
  readonly children: readonly TableOfContentsEntry[];
}

interface OpenEntry extends TableOfContentsEntry {
  readonly children: OpenEntry[];
}

/**
 * Nests the document's top-level headings by level. Headings inside block quotes and lists
 * are not sections of the page, so they are left out.
 */
export function buildTableOfContents(document: Document): TableOfContentsEntry[] {
  const roots: OpenEntry[] = [];
  const parents: OpenEntry[] = [];

  for (const block of document.children) {
    if (block.kind !== "heading" || block.id === undefined) continue;
    const entry: OpenEntry = {
      id: block.id,
      text: plainTextOf(block.inlines ?? []),
      level: block.level,
      children: [],
    };
    while ((parents.at(-1)?.level ?? 0) >= entry.level) parents.pop();
    (parents.at(-1)?.children ?? roots).push(entry);
    parents.push(entry);
  }
  return roots;
}
