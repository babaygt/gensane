/** Gives every heading a unique `id`, so that links can point at a section of a page. */
import { assertNever } from "../../diagnostics/index.ts";
import type { Block, Document } from "../ast.ts";
import { plainTextOf } from "../output/inline-text.ts";

/** `What's New?` → `whats-new`. Letters of every alphabet are kept. */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
  return slug === "" ? "section" : slug;
}

export function assignHeadingIds(document: Document): Document {
  const usedIds = new Set<string>();
  // Continues counting where the last repeat of a slug stopped.
  const nextNumbers = new Map<string, number>();

  function uniqueId(text: string): string {
    const slug = slugify(text);
    let number = nextNumbers.get(slug) ?? 1;
    let id = slug;
    while (usedIds.has(id)) {
      id = `${slug}-${number}`;
      number++;
    }
    nextNumbers.set(slug, number);
    usedIds.add(id);
    return id;
  }

  function assign(block: Block): Block {
    switch (block.kind) {
      case "heading":
        return { ...block, id: uniqueId(plainTextOf(block.inlines ?? [])) };
      case "block-quote":
      case "footnote-definition":
        return { ...block, children: block.children.map(assign) };
      case "list": {
        const items = block.items.map((item) => ({
          ...item,
          children: item.children.map(assign),
        }));
        return { ...block, items };
      }
      case "paragraph":
      case "code":
      case "thematic-break":
      case "table":
      case "html-block":
        return block;
      default:
        return assertNever(block);
    }
  }

  return { ...document, children: document.children.map(assign) };
}
