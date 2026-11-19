/**
 * The template language for layouts:
 *
 *   <h1>{{ page.title | upper }}</h1>
 *
 * A template is compiled once, in stages: lexer, parser, then checks that need no data. It can then
 * be rendered many times with different variables.
 */
import { type Diagnostic, type Result, err, hasErrors, ok } from "../diagnostics/index.ts";
import { checkFilters } from "./analysis/check-filters.ts";
import type { TemplateNode } from "./ast.ts";
import { tokenize } from "./lexing/lexer.ts";
import { parseTemplate } from "./parsing/parser.ts";
import type { FilterDefinition, TemplateFilter } from "./rendering/filter-types.ts";
import { withCustomFilters } from "./rendering/filters.ts";
import { interpret } from "./rendering/interpreter.ts";

export { TemplateCodes } from "./diagnostic-codes.ts";
export { FilterError, type TemplateFilter } from "./rendering/filter-types.ts";

export interface CompileOptions {
  /** Extra filters, which can also replace built-in ones. */
  readonly filters?: Readonly<Record<string, TemplateFilter>>;
}

export interface Template {
  readonly file: string;
  readonly nodes: readonly TemplateNode[];
  readonly filters: ReadonlyMap<string, FilterDefinition>;
}

export interface RenderedTemplate {
  readonly html: string;
  readonly warnings: readonly Diagnostic[];
}

function inFileOrder(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.toSorted(
    (first, second) => first.span.start.offset - second.span.start.offset,
  );
}

/** Reads a template and reports every mistake that can be found without any data. */
export function compileTemplate(
  source: string,
  file: string,
  options: CompileOptions = {},
): Result<Template, readonly Diagnostic[]> {
  const filters = withCustomFilters(options.filters ?? {});
  const lexed = tokenize(source, file);
  const { nodes, diagnostics } = parseTemplate(lexed.tokens);
  const problems = [...lexed.diagnostics, ...diagnostics, ...checkFilters(nodes, filters)];
  return problems.length > 0 ? err(inFileOrder(problems)) : ok({ file, nodes, filters });
}

/** Runs a compiled template. On failure the result holds every problem, in file order. */
export function renderTemplate(
  template: Template,
  variables: Readonly<Record<string, unknown>>,
): Result<RenderedTemplate, readonly Diagnostic[]> {
  const { html, diagnostics } = interpret(template.nodes, variables, template.filters);
  return hasErrors(diagnostics) ? err(diagnostics) : ok({ html, warnings: diagnostics });
}
