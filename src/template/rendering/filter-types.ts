/**
 * Filters are plain functions from a value to a new value, so anyone can write one. A filter
 * reports a mistake by throwing `FilterError`, and the interpreter turns that into a diagnostic.
 */
export type TemplateFilter = (value: unknown, ...filterArguments: unknown[]) => unknown;

export class FilterError extends Error {
  override readonly name = "FilterError";
  readonly hint: string | undefined;

  constructor(message: string, hint?: string) {
    super(message);
    this.hint = hint;
  }
}

export interface FilterDefinition {
  readonly apply: TemplateFilter;
  readonly minimumArguments: number;
  readonly maximumArguments: number;
}

export function defineFilter(
  apply: TemplateFilter,
  minimumArguments = 0,
  maximumArguments = minimumArguments,
): FilterDefinition {
  return { apply, minimumArguments, maximumArguments };
}
