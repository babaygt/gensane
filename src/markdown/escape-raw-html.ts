/**
 * Turns all raw HTML in a tree into visible text. Used for the `rawHtml: "escape"` option,
 * for sites that should show HTML in their content instead of running it.
 */
import { assertNever } from "../diagnostics/index.ts";
import type { Block, Document, Inline, TableRow } from "./ast.ts";

export function escapeRawHtml(document: Document): Document {
  const footnotes = document.footnotes?.map((footnote) => ({
    ...footnote,
    children: footnote.children.map(escapeBlock),
  }));
  return {
    ...document,
    children: document.children.map(escapeBlock),
    ...(footnotes === undefined ? {} : { footnotes }),
  };
}

function escapeBlock(block: Block): Block {
  switch (block.kind) {
    case "html-block": {
      const { text, span } = block;
      return {
        kind: "paragraph",
        text,
        segments: [{ index: 0, position: span.start }],
        inlines: [{ kind: "text", text, span }],
        span,
      };
    }
    case "heading":
    case "paragraph":
      return { ...block, inlines: escapeInlines(block.inlines ?? []) };
    case "block-quote":
    case "footnote-definition":
      return { ...block, children: block.children.map(escapeBlock) };
    case "list": {
      const items = block.items.map((item) => ({
        ...item,
        children: item.children.map(escapeBlock),
      }));
      return { ...block, items };
    }
    case "table":
      return { ...block, header: escapeRow(block.header), rows: block.rows.map(escapeRow) };
    case "code":
    case "thematic-break":
      return block;
    default:
      return assertNever(block);
  }
}

function escapeRow(row: TableRow): TableRow {
  const cells = row.cells.map((cell) => ({
    ...cell,
    inlines: escapeInlines(cell.inlines ?? []),
  }));
  return { ...row, cells };
}

function escapeInlines(inlines: readonly Inline[]): Inline[] {
  return inlines.map((inline) => {
    switch (inline.kind) {
      case "raw-html":
        return { kind: "text", text: inline.text, span: inline.span };
      case "emphasis":
      case "strong":
      case "strikethrough":
      case "link":
      case "image":
        return { ...inline, children: escapeInlines(inline.children) };
      case "footnote-reference":
      case "text":
      case "code-span":
      case "hard-break":
      case "soft-break":
        return inline;
      default:
        return assertNever(inline);
    }
  });
}
