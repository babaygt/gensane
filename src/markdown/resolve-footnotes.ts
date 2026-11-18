/**
 * Connects footnote references to their definitions. Notes are numbered in the order they are
 * first referenced, and move from where they were written to a list at the end of the document.
 */
import {
  type Diagnostic,
  type DiagnosticCode,
  type SourceSpan,
  assertNever,
} from "../diagnostics/index.ts";
import type { Block, Document, Footnote, FootnoteDefinition, Inline, TableRow } from "./ast.ts";
import { DiagnosticCodes } from "./diagnostic-codes.ts";
import { normalizeLabel } from "./link-syntax.ts";

export interface FootnoteResolution {
  readonly document: Document;
  readonly diagnostics: readonly Diagnostic[];
}

interface UsedFootnote {
  readonly definition: FootnoteDefinition;
  readonly number: number;
  referenceCount: number;
}

export function resolveFootnotes(document: Document): FootnoteResolution {
  const definitions = new Map<string, FootnoteDefinition>();
  const used = new Map<string, UsedFootnote>();
  const diagnostics: Diagnostic[] = [];

  function warn(code: DiagnosticCode, span: SourceSpan, message: string, hint: string): void {
    diagnostics.push({ code, severity: "warning", message, span, hint });
  }

  /** Removes definitions from the tree and remembers them. The first one of a label wins. */
  function collectDefinitions(blocks: readonly Block[]): Block[] {
    return blocks.flatMap((block): Block[] => {
      switch (block.kind) {
        case "footnote-definition": {
          const key = normalizeLabel(block.label);
          if (definitions.has(key)) {
            warn(
              DiagnosticCodes.duplicateFootnote,
              block.span,
              `footnote "${block.label}" is defined more than once; the first definition is used`,
              "give this footnote a different label, or remove it",
            );
          } else {
            definitions.set(key, { ...block, children: collectDefinitions(block.children) });
          }
          return [];
        }
        case "block-quote":
          return [{ ...block, children: collectDefinitions(block.children) }];
        case "list": {
          const items = block.items.map((item) => ({
            ...item,
            children: collectDefinitions(item.children),
          }));
          return [{ ...block, items }];
        }
        case "heading":
        case "paragraph":
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

  function resolveInline(inline: Inline): Inline {
    switch (inline.kind) {
      case "footnote-reference": {
        const key = normalizeLabel(inline.label);
        const definition = definitions.get(key);
        if (definition === undefined) {
          warn(
            DiagnosticCodes.undefinedFootnote,
            inline.span,
            `footnote "${inline.label}" has no definition; it is shown as text`,
            `add a line such as \`[^${inline.label}]: The note.\` to this file`,
          );
          return { kind: "text", text: `[^${inline.label}]`, span: inline.span };
        }
        const footnote = used.get(key) ?? { definition, number: used.size + 1, referenceCount: 0 };
        used.set(key, footnote);
        footnote.referenceCount++;
        return { ...inline, number: footnote.number, referenceIndex: footnote.referenceCount };
      }
      case "emphasis":
      case "strong":
      case "strikethrough":
      case "link":
      case "image":
        return { ...inline, children: inline.children.map(resolveInline) };
      case "text":
      case "code-span":
      case "raw-html":
      case "hard-break":
      case "soft-break":
        return inline;
      default:
        return assertNever(inline);
    }
  }

  function resolveRow(row: TableRow): TableRow {
    const cells = row.cells.map((cell) => ({
      ...cell,
      inlines: (cell.inlines ?? []).map(resolveInline),
    }));
    return { ...row, cells };
  }

  function resolveBlock(block: Block): Block {
    switch (block.kind) {
      case "heading":
      case "paragraph":
        return { ...block, inlines: (block.inlines ?? []).map(resolveInline) };
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
      case "footnote-definition":
      case "code":
      case "thematic-break":
      case "html-block":
        return block;
      default:
        return assertNever(block);
    }
  }

  const children = collectDefinitions(document.children).map(resolveBlock);

  // A note can reference another note, so this list can grow while it is being processed.
  const contents: (readonly Block[])[] = [];
  const queue = used.values();
  for (let next = queue.next(); !next.done; next = queue.next()) {
    contents.push(next.value.definition.children.map(resolveBlock));
  }

  for (const [key, definition] of definitions) {
    if (used.has(key)) continue;
    warn(
      DiagnosticCodes.unusedFootnote,
      definition.span,
      `footnote "${definition.label}" is never referenced, so it is not shown`,
      `refer to it with \`[^${definition.label}]\`, or remove it`,
    );
  }

  const footnotes = [...used.values()].map(
    ({ definition, number, referenceCount }, position): Footnote => ({
      kind: "footnote",
      label: definition.label,
      number,
      referenceCount,
      children: contents[position] ?? [],
      span: definition.span,
    }),
  );
  return {
    document: { ...document, children, ...(footnotes.length > 0 ? { footnotes } : {}) },
    diagnostics,
  };
}
