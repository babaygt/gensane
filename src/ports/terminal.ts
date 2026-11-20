/** Where the command line writes. */
export interface Terminal {
  /** Results, such as "Built 12 pages". */
  write(text: string): void;
  /** Problems and mistakes in the command, on the error stream so that they stay visible when results are redirected. */
  writeError(text: string): void;
  /** Whether the problems may be colored. */
  readonly color: boolean;
}

interface Stream {
  write(text: string): unknown;
  readonly isTTY?: boolean;
}

/** Colors only in a terminal, and never when `NO_COLOR` is set to something, as https://no-color.org asks. */
export function wantsColor(
  stream: Stream,
  environment: Readonly<Record<string, string | undefined>>,
): boolean {
  const noColor = environment["NO_COLOR"];
  return stream.isTTY === true && (noColor === undefined || noColor === "");
}

export class NodeTerminal implements Terminal {
  readonly #output: Stream;
  readonly #errors: Stream;
  readonly color: boolean;

  constructor(
    output: Stream,
    errors: Stream,
    environment: Readonly<Record<string, string | undefined>>,
  ) {
    this.#output = output;
    this.#errors = errors;
    this.color = wantsColor(errors, environment);
  }

  write(text: string): void {
    this.#output.write(`${text}\n`);
  }

  writeError(text: string): void {
    this.#errors.write(`${text}\n`);
  }
}

/** Keeps what is written, for tests. */
export class MemoryTerminal implements Terminal {
  readonly output: string[] = [];
  readonly errors: string[] = [];
  readonly color: boolean;

  constructor({ color = false }: { readonly color?: boolean } = {}) {
    this.color = color;
  }

  write(text: string): void {
    this.output.push(text);
  }

  writeError(text: string): void {
    this.errors.push(text);
  }
}
