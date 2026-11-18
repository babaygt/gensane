/**
 * Runs after the block structure is known, and builds a new tree in two steps:
 *
 * 1. Collect link reference definitions. A link can refer to a definition further down
 *    the file, so all of them must be known before any text is parsed.
 * 2. Run the inline parser over every block that contains text.
 */
import { assertNever } from "../diagnostics/index.ts";
import type { Block, Document, Paragraph, TableRow } from "./ast.ts";
import { type LinkReference, parseInlines } from "./inline-parser.ts";
import { parseReferenceDefinition } from "./link-syntax.ts";

export function resolveInlines(document: Document): Document {
  const file = document.span.file;
  const references = new Map<string, LinkReference>();

  function extractDefinitions(blocks: readonly Block[]): Block[] {
    return blocks.flatMap((block): Block[] => {
      switch (block.kind) {
        case "paragraph":
          return withoutDefinitions(block, references);
        case "block-quote":
          return [{ ...block, children: extractDefinitions(block.children) }];
        case "list": {
          const items = block.items.map((item) => ({
            ...item,
            children: extractDefinitions(item.children),
          }));
          return [{ ...block, items }];
        }
        case "heading":
        case "code":
        case "thematic-break":
        case "table":
        case "html-block":
          return [block];
        default:
          return assertNever(block);
      }
    });
  }

  function resolveBlock(block: Block): Block {
    switch (block.kind) {
      case "heading":
      case "paragraph":
        return { ...block, inlines: parseInlines(block.text, block.segments, file, references) };
      case "block-quote":
        return { ...block, children: block.children.map(resolveBlock) };
      case "list": {
        const items = block.items.map((item) => ({
          ...item,
          children: item.children.map(resolveBlock),
        }));
        return { ...block, items };
      }
      case "table":
        return { ...block, header: resolveRow(block.header), rows: block.rows.map(resolveRow) };
      case "code":
      case "thematic-break":
      case "html-block":
        return block;
      default:
        return assertNever(block);
    }
  }

  function resolveRow(row: TableRow): TableRow {
    const cells = row.cells.map((cell) => ({
      ...cell,
      inlines: parseInlines(cell.text, cell.segments, file, references),
    }));
    return { ...row, cells };
  }

  const children = extractDefinitions(document.children).map(resolveBlock);
  return { ...document, children };
}

/**
 * Definitions can only stand at the start of a paragraph. Returns what is left of the
 * paragraph, or nothing if it held only definitions. The first definition of a label wins.
 */
function withoutDefinitions(
  paragraph: Paragraph,
  references: Map<string, LinkReference>,
): Paragraph[] {
  let consumed = 0;
  let definition = parseReferenceDefinition(paragraph.text, consumed);
  while (definition !== undefined) {
    if (!references.has(definition.label)) references.set(definition.label, definition);
    consumed = definition.end;
    definition = parseReferenceDefinition(paragraph.text, consumed);
  }
  if (consumed === 0) return [paragraph];

  const text = paragraph.text.slice(consumed);
  const segments = paragraph.segments
    .filter((segment) => segment.index >= consumed)
    .map((segment) => ({ ...segment, index: segment.index - consumed }));
  const start = segments[0]?.position;
  if (text.trim() === "" || start === undefined) return [];
  return [{ ...paragraph, text, segments, span: { ...paragraph.span, start } }];
}
