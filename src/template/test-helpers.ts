import type { Diagnostic } from "../diagnostics/index.ts";
import { type TemplateFilter, compileTemplate, renderTemplate } from "./index.ts";

type Variables = Readonly<Record<string, unknown>>;

export function compiled(source: string, filters: Readonly<Record<string, TemplateFilter>> = {}) {
  const result = compileTemplate(source, "page.html", { filters });
  if (!result.ok) throw new Error(result.error[0]?.message);
  return result.value;
}

export function render(source: string, variables: Variables = {}) {
  return renderTemplate(compiled(source), variables);
}

export function html(source: string, variables: Variables = {}): string {
  const result = render(source, variables);
  if (!result.ok) throw new Error(result.error[0]?.message);
  return result.value.html;
}

/** Renders a single expression. */
export function value(code: string, variables: Variables = {}): string {
  return html(`{{ ${code} }}`, variables);
}

/** The problems of rendering a whole template, with warnings only when there are no errors. */
export function renderProblems(source: string, variables: Variables = {}): readonly Diagnostic[] {
  const result = render(source, variables);
  return result.ok ? result.value.warnings : result.error;
}

export function renderCodes(source: string, variables: Variables = {}): string[] {
  return renderProblems(source, variables).map((problem) => problem.code);
}

/** The codes of the problems found while rendering a single expression. */
export function errorCodes(code: string, variables: Variables = {}): string[] {
  const result = render(`{{ ${code} }}`, variables);
  return result.ok ? [] : result.error.map((problem) => problem.code);
}

export function compileCodes(
  source: string,
  filters: Readonly<Record<string, TemplateFilter>> = {},
): string[] {
  const result = compileTemplate(source, "page.html", { filters });
  return result.ok ? [] : result.error.map((problem) => problem.code);
}
