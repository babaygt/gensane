/**
 * The variables that one part of a template can see. A loop gets a new scope whose parent is the
 * scope around it, so the loop variable can hide an outer variable and is gone after the loop.
 */
export class Scope {
  readonly #variables: ReadonlyMap<string, unknown>;
  readonly #parent: Scope | undefined;

  constructor(variables: Readonly<Record<string, unknown>>, parent?: Scope) {
    this.#variables = new Map(Object.entries(variables));
    this.#parent = parent;
  }

  /** Looks in this scope first, then in the scopes around it. */
  lookup(name: string): { readonly value: unknown } | undefined {
    if (this.#variables.has(name)) return { value: this.#variables.get(name) };
    return this.#parent?.lookup(name);
  }

  /** Every name that can be seen here, the closest first. */
  names(): string[] {
    return [...new Set([...this.#variables.keys(), ...(this.#parent?.names() ?? [])])];
  }
}
