/**
 * Syntax that GitHub adds on top of block quotes and list items. Both forms are ordinary
 * Markdown first, so they are recognised in a pass over the finished block tree:
 *
 *   - [x] a task list item
 *
 *   > [!NOTE]
 *   > a callout
 */
import { assertNever } from "../diagnostics/index.ts";
import type {
  Block,
  BlockQuote,
  CalloutKind,
  Document,
  ListItem,
  Paragraph,
  TextSegment,
} from "./ast.ts";

export function applyBlockExtensions(document: Document): Document {
  return { ...document, children: document.children.map(applyToBlock) };
}

function applyToBlock(block: Block): Block {
  switch (block.kind) {
    case "block-quote":
      return recogniseCallout({ ...block, children: block.children.map(applyToBlock) });
    case "list": {
      const items = block.items.map((item) =>
        recogniseTask({ ...item, children: item.children.map(applyToBlock) }),
      );
      return { ...block, items };
    }
    case "footnote-definition":
      return { ...block, children: block.children.map(applyToBlock) };
    case "heading":
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

// `[ ]` or `[x]`, then whitespace and more text on the same line.
const TASK_MARKER = /^\[([ xX])\][ \t]+(?=\S)/;

function recogniseTask(item: ListItem): ListItem {
  const [first, ...rest] = item.children;
  if (first?.kind !== "paragraph") return item;
  const marker = TASK_MARKER.exec(first.text);
  const remaining = marker === null ? undefined : sliceParagraph(first, marker[0].length);
  if (marker === null || remaining === undefined) return item;
  return { ...item, checked: marker[1] !== " ", children: [remaining, ...rest] };
}

// The marker must be alone on the first line of the block quote.
const CALLOUT_MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i;

function recogniseCallout(quote: BlockQuote): BlockQuote {
  const [first, ...rest] = quote.children;
  if (first?.kind !== "paragraph") return quote;
  const marker = CALLOUT_MARKER.exec(first.text);
  if (marker === null) return quote;
  const callout = (marker[1] ?? "").toLowerCase() as CalloutKind;
  const remaining = sliceParagraph(first, marker[0].length);
  return { ...quote, callout, children: remaining === undefined ? rest : [remaining, ...rest] };
}

/** Removes text from the start of a paragraph, keeping positions exact. Empty results vanish. */
export function sliceParagraph(paragraph: Paragraph, consumed: number): Paragraph | undefined {
  const text = paragraph.text.slice(consumed);
  if (text.trim() === "") return undefined;
  const segments = paragraph.segments.flatMap((segment, position): TextSegment[] => {
    const next = paragraph.segments[position + 1];
    if (next !== undefined && next.index <= consumed) return [];
    return [moveSegment(segment, consumed)];
  });
  const start = segments[0]?.position ?? paragraph.span.start;
  return { ...paragraph, text, segments, span: { ...paragraph.span, start } };
}

function moveSegment(segment: TextSegment, consumed: number): TextSegment {
  const distance = Math.max(0, consumed - segment.index);
  const { line, column, offset } = segment.position;
  return {
    index: Math.max(0, segment.index - consumed),
    position: { line, column: column + distance, offset: offset + distance },
  };
}
