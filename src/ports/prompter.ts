import { createInterface } from "node:readline/promises";

/** Asks the person at the terminal questions, as `gensane init` does. */
export interface Prompter {
  /** Whether someone can answer; without a terminal, as in CI, nobody can. */
  readonly canAsk: boolean;
  /**
   * The answer, trimmed, or the default when the answer is empty.
   * Fails with {@link AskingStopped} when the person stops instead, with Ctrl+C.
   */
  ask(question: string, defaultAnswer: string): Promise<string>;
}

/** The person stopped answering, with Ctrl+C. */
export class AskingStopped extends Error {
  constructor() {
    super("stopped while answering");
    this.name = "AskingStopped";
  }
}

interface Input extends NodeJS.ReadableStream {
  readonly isTTY?: boolean;
}

export class NodePrompter implements Prompter {
  readonly #input: Input;
  readonly #output: NodeJS.WritableStream;

  constructor(input: Input, output: NodeJS.WritableStream) {
    this.#input = input;
    this.#output = output;
  }

  get canAsk(): boolean {
    return this.#input.isTTY === true;
  }

  async ask(question: string, defaultAnswer: string): Promise<string> {
    const lines = createInterface({ input: this.#input, output: this.#output });
    try {
      const shown = defaultAnswer === "" ? `${question}: ` : `${question} (${defaultAnswer}): `;
      const answer = (await lines.question(shown)).trim();
      return answer === "" ? defaultAnswer : answer;
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) throw error;
      // Ctrl+C left the cursor after the question.
      this.#output.write("\n");
      throw new AskingStopped();
    } finally {
      lines.close();
    }
  }
}

/** Answers from a list, for tests, and keeps the questions it was asked. `null` in the list stops, like Ctrl+C. */
export class ScriptedPrompter implements Prompter {
  readonly canAsk: boolean;
  readonly asked: string[] = [];
  readonly #answers: (string | null)[];

  constructor(
    answers: readonly (string | null)[] = [],
    { canAsk = true }: { readonly canAsk?: boolean } = {},
  ) {
    this.#answers = [...answers];
    this.canAsk = canAsk;
  }

  async ask(question: string, defaultAnswer: string): Promise<string> {
    this.asked.push(question);
    const next = this.#answers.shift();
    if (next === null) throw new AskingStopped();
    const answer = (next ?? "").trim();
    return answer === "" ? defaultAnswer : answer;
  }
}
