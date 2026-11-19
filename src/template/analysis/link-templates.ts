/**
 * Checks how templates use each other, once every file has been read: included and extended
 * templates must exist, no template may use itself in a circle, and a template that extends another
 * may only fill blocks that the other one has.
 *
 * It also works out what each template shows: the nodes of the template at the top of its chain,
 * with each block taken from the closest template that fills it.
 */
import {
  type Diagnostic,
  type DiagnosticCode,
  type SourcePosition,
  type SourceSpan,
  closestMatch,
  positionAt,
} from "../../diagnostics/index.ts";
import type { BlockNode, ExtendsNode, TemplateNode, TextNode } from "../ast.ts";
import { TemplateCodes } from "../diagnostic-codes.ts";

export interface Layout {
  readonly nodes: readonly TemplateNode[];
  readonly blocks: ReadonlyMap<string, readonly TemplateNode[]>;
}

export interface LinkResult {
  readonly layouts: ReadonlyMap<string, Layout>;
  readonly diagnostics: readonly Diagnostic[];
}

type Files = ReadonlyMap<string, readonly TemplateNode[]>;

interface Reference {
  readonly target: string;
  readonly span: SourceSpan;
}

const MAX_LISTED_NAMES = 10;

function childrenOf(node: TemplateNode): readonly TemplateNode[] {
  switch (node.kind) {
    case "if":
      return [...node.branches.flatMap((branch) => branch.body), ...node.otherwise];
    case "for":
      return [...node.body, ...node.otherwise];
    case "block":
      return node.body;
    default:
      return [];
  }
}

/** Every node, including the ones inside blocks, in the order they were written. */
function allNodes(nodes: readonly TemplateNode[]): TemplateNode[] {
  return nodes.flatMap((node) => [node, ...allNodes(childrenOf(node))]);
}

function blocksOf(nodes: readonly TemplateNode[]): BlockNode[] {
  return allNodes(nodes).filter((node) => node.kind === "block");
}

function isBlank(node: TemplateNode): boolean {
  return node.kind === "text" && node.value.trim() === "";
}

/** A template extends another only when `extends` comes before everything else. */
function extendsOf(nodes: readonly TemplateNode[]): ExtendsNode | undefined {
  const first = nodes.find((node) => !isBlank(node));
  return first?.kind === "extends" ? first : undefined;
}

/** The position a number of characters into a text node. */
function positionIn({ value, span }: TextNode, index: number): SourcePosition {
  const inside = positionAt(value, index);
  return {
    line: span.start.line + inside.line - 1,
    column: inside.line === 1 ? span.start.column + inside.column - 1 : inside.column,
    offset: span.start.offset + index,
  };
}

/** For text, only the part that isn't blank, so that a problem doesn't point at an empty line. */
function contentSpan(node: TemplateNode): SourceSpan {
  if (node.kind !== "text") return node.span;
  const start = node.value.length - node.value.trimStart().length;
  const end = node.value.trimEnd().length;
  return { file: node.span.file, start: positionIn(node, start), end: positionIn(node, end) };
}

function listed(names: readonly string[]): string {
  return names.slice(0, MAX_LISTED_NAMES).join(", ");
}

class TemplateLinker {
  readonly #files: Files;
  readonly #diagnostics: Diagnostic[] = [];

  constructor(files: Files) {
    this.#files = files;
  }

  link(): LinkResult {
    const references = new Map(
      [...this.#files].map(([file, nodes]) => [file, this.#checkReferences(nodes)]),
    );
    this.#checkCircles(references);
    for (const [file, nodes] of this.#files) {
      this.#checkExtendsComesFirst(nodes);
      this.#checkBlockNames(nodes);
      const [, parent, ...ancestors] = this.#chainOf(file) ?? [];
      if (parent !== undefined) this.#checkChild(nodes, parent, [parent, ...ancestors]);
    }
    if (this.#diagnostics.length > 0) return { layouts: new Map(), diagnostics: this.#diagnostics };
    const layouts = new Map(
      [...this.#files.keys()].map((file) => [file, this.#layoutOf(this.#chainOf(file) ?? [file])]),
    );
    return { layouts, diagnostics: [] };
  }

  /** Reports missing templates, and returns the references to templates that exist. */
  #checkReferences(nodes: readonly TemplateNode[]): Reference[] {
    const references: Reference[] = [];
    for (const node of allNodes(nodes)) {
      if (node.kind !== "include" && node.kind !== "extends") continue;
      if (this.#files.has(node.template)) {
        references.push({ target: node.template, span: node.templateSpan });
      } else {
        this.#reportMissingTemplate(node.template, node.templateSpan);
      }
    }
    return references;
  }

  #reportMissingTemplate(name: string, span: SourceSpan): void {
    const names = [...this.#files.keys()];
    const suggestion =
      names.find((candidate) => candidate.endsWith(`/${name}`)) ?? closestMatch(name, names);
    this.#report(
      TemplateCodes.unknownTemplate,
      `there is no template named "${name}"`,
      span,
      suggestion === undefined
        ? `the templates are: ${listed(names)}`
        : `did you mean "${suggestion}"?`,
    );
  }

  /**
   * A depth-first search with its own stack instead of recursion, so a long chain of templates
   * can't overflow the call stack. A reference back to a template still on the stack closes a circle.
   */
  #checkCircles(references: ReadonlyMap<string, readonly Reference[]>): void {
    const finished = new Set<string>();
    for (const start of this.#files.keys()) {
      if (finished.has(start)) continue;
      const stack = [{ file: start, next: 0 }];
      for (let top = stack.at(-1); top !== undefined; top = stack.at(-1)) {
        const reference = references.get(top.file)?.[top.next];
        top.next++;
        if (reference === undefined) {
          finished.add(top.file);
          stack.pop();
          continue;
        }
        const index = stack.findIndex((frame) => frame.file === reference.target);
        if (index >= 0) {
          const circle = [...stack.slice(index).map((frame) => frame.file), reference.target];
          this.#report(
            TemplateCodes.templateCycle,
            `templates cannot use each other in a circle: ${circle.join(" → ")}`,
            reference.span,
            "remove one of the `include` or `extends` tags in the circle",
          );
        } else if (!finished.has(reference.target)) {
          stack.push({ file: reference.target, next: 0 });
        }
      }
    }
  }

  #checkExtendsComesFirst(nodes: readonly TemplateNode[]): void {
    const first = extendsOf(nodes);
    for (const node of allNodes(nodes)) {
      if (node.kind !== "extends" || node === first) continue;
      this.#report(
        TemplateCodes.misplacedExtends,
        "`extends` must come before everything else",
        node.span,
        "move it to the top of the template",
      );
    }
  }

  #checkBlockNames(nodes: readonly TemplateNode[]): void {
    const seen = new Set<string>();
    for (const block of blocksOf(nodes)) {
      if (seen.has(block.name)) {
        this.#report(
          TemplateCodes.duplicateBlock,
          `there is already a block named "${block.name}" in this template`,
          block.nameSpan,
          "give each block its own name",
        );
      }
      seen.add(block.name);
    }
  }

  /** The template and the ones it extends, or nothing when the chain is broken or a circle. */
  #chainOf(file: string): string[] | undefined {
    const chain = [file];
    for (
      let parent = extendsOf(this.#files.get(file) ?? [])?.template;
      parent !== undefined;
      parent = extendsOf(this.#files.get(parent) ?? [])?.template
    ) {
      if (!this.#files.has(parent) || chain.includes(parent)) return undefined;
      chain.push(parent);
    }
    return chain;
  }

  /** Only blocks can be shown in a template that extends another. */
  #checkChild(nodes: readonly TemplateNode[], parent: string, ancestors: readonly string[]): void {
    const available = ancestors.flatMap((file) =>
      blocksOf(this.#files.get(file) ?? []).map((block) => block.name),
    );
    let outside: TemplateNode[] = [];
    for (const node of nodes) {
      if (node.kind !== "block" && node.kind !== "extends") {
        outside.push(node);
        continue;
      }
      this.#reportOutside(outside, parent);
      outside = [];
      if (node.kind === "block" && !available.includes(node.name)) {
        this.#reportUnknownBlock(node, parent, available);
      }
    }
    this.#reportOutside(outside, parent);
  }

  /** Everything between two blocks is one problem, such as a whole line of HTML. */
  #reportOutside(nodes: readonly TemplateNode[], parent: string): void {
    const content = nodes.filter((node) => !isBlank(node));
    const [first] = content;
    const last = content.at(-1);
    if (first === undefined || last === undefined) return;
    this.#report(
      TemplateCodes.contentOutsideBlock,
      "this is outside every block, so it is never shown",
      { file: first.span.file, start: contentSpan(first).start, end: contentSpan(last).end },
      `put it inside a \`{% block %}\`, because this template extends "${parent}"`,
    );
  }

  #reportUnknownBlock(block: BlockNode, parent: string, available: readonly string[]): void {
    const names = [...new Set(available)];
    const suggestion = closestMatch(block.name, names);
    let hint = `add \`{% block ${block.name} %}\` to "${parent}" where it should go`;
    if (suggestion !== undefined) hint = `did you mean "${suggestion}"?`;
    else if (names.length > 0) hint = `the blocks there are: ${listed(names)}`;
    this.#report(
      TemplateCodes.unknownBlock,
      `there is no block named "${block.name}" in "${parent}"`,
      block.nameSpan,
      hint,
    );
  }

  /** The closest template that fills a block wins. */
  #layoutOf(chain: readonly string[]): Layout {
    const blocks = new Map<string, readonly TemplateNode[]>();
    for (const file of chain) {
      for (const block of blocksOf(this.#files.get(file) ?? [])) {
        if (!blocks.has(block.name)) blocks.set(block.name, block.body);
      }
    }
    return { nodes: this.#files.get(chain.at(-1) ?? "") ?? [], blocks };
  }

  #report(code: DiagnosticCode, message: string, span: SourceSpan, hint: string): void {
    this.#diagnostics.push({ code, severity: "error", message, span, hint });
  }
}

export function linkTemplates(files: Files): LinkResult {
  return new TemplateLinker(files).link();
}
