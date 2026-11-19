/**
 * The template language for layouts:
 *
 *   <h1>{{ page.title | upper }}</h1>
 *
 * Templates are compiled once, in stages: lexer, parser, then checks that need no data, including
 * how templates include and extend each other. A template can then be rendered many times with
 * different variables.
 */
import {
  type Diagnostic,
  InternalError,
  type Result,
  err,
  hasErrors,
  ok,
} from "../diagnostics/index.ts";
import { checkFilters } from "./analysis/check-filters.ts";
import { type Layout, linkTemplates } from "./analysis/link-templates.ts";
import type { TemplateNode } from "./ast.ts";
import { tokenize } from "./lexing/lexer.ts";
import { parseTemplate } from "./parsing/parser.ts";
import type { FilterDefinition, TemplateFilter } from "./rendering/filter-types.ts";
import { withCustomFilters } from "./rendering/filters.ts";
import { interpret } from "./rendering/interpreter.ts";

export { TemplateCodes } from "./diagnostic-codes.ts";
export { FilterError, type TemplateFilter } from "./rendering/filter-types.ts";
export { MAX_INCLUDE_DEPTH } from "./rendering/interpreter.ts";

export interface CompileOptions {
  /** Extra filters, which can also replace built-in ones. */
  readonly filters?: Readonly<Record<string, TemplateFilter>>;
}

export interface Template {
  readonly file: string;
  /** What every template of the set shows, so that included templates can be rendered too. */
  readonly layouts: ReadonlyMap<string, Layout>;
  readonly filters: ReadonlyMap<string, FilterDefinition>;
}

export interface RenderedTemplate {
  readonly html: string;
  readonly warnings: readonly Diagnostic[];
}

/** Files in alphabetical order, and the problems of each file in the order they appear. */
function inFileOrder(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.toSorted(({ span: first }, { span: second }) => {
    if (first.file !== second.file) return first.file < second.file ? -1 : 1;
    return first.start.offset - second.start.offset;
  });
}

/**
 * Reads a set of templates, such as every file in a theme, and reports every mistake that can be
 * found without any data. Templates are named by their path, which `include` and `extends` use.
 */
export function compileTemplates(
  files: Readonly<Record<string, string>>,
  options: CompileOptions = {},
): Result<ReadonlyMap<string, Template>, readonly Diagnostic[]> {
  const filters = withCustomFilters(options.filters ?? {});
  const parsed = new Map<string, readonly TemplateNode[]>();
  const problems: Diagnostic[] = [];
  for (const [file, source] of Object.entries(files)) {
    const lexed = tokenize(source, file);
    const { nodes, diagnostics } = parseTemplate(lexed.tokens);
    parsed.set(file, nodes);
    problems.push(...lexed.diagnostics, ...diagnostics, ...checkFilters(nodes, filters));
  }
  if (problems.length > 0) return err(inFileOrder(problems));

  const { layouts, diagnostics } = linkTemplates(parsed);
  if (diagnostics.length > 0) return err(inFileOrder(diagnostics));
  return ok(new Map([...parsed.keys()].map((file) => [file, { file, layouts, filters }])));
}

/** Reads a single template, which can't include or extend others. */
export function compileTemplate(
  source: string,
  file: string,
  options: CompileOptions = {},
): Result<Template, readonly Diagnostic[]> {
  const result = compileTemplates({ [file]: source }, options);
  if (!result.ok) return result;
  const template = result.value.get(file);
  if (template === undefined) throw new InternalError(`Missing compiled template: ${file}`);
  return ok(template);
}

/** Runs a compiled template. On failure the result holds every problem, in file order. */
export function renderTemplate(
  template: Template,
  variables: Readonly<Record<string, unknown>>,
): Result<RenderedTemplate, readonly Diagnostic[]> {
  const layout = template.layouts.get(template.file);
  if (layout === undefined) throw new InternalError(`Missing layout: ${template.file}`);
  const { html, diagnostics } = interpret(layout, variables, template.filters, template.layouts);
  const problems = inFileOrder(diagnostics);
  return hasErrors(problems) ? err(problems) : ok({ html, warnings: problems });
}
