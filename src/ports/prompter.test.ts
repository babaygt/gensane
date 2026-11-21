import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { AskingStopped, NodePrompter, ScriptedPrompter } from "./prompter.ts";

/** Streams that say they are a terminal, as the real ones do when a person runs gensane. */
function terminal() {
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode: () => input });
  const output = Object.assign(new PassThrough(), { isTTY: true, columns: 80 });
  let shown = "";
  output.setEncoding("utf8").on("data", (chunk: string) => {
    shown += chunk;
  });
  return { input, output, shown: () => shown };
}

describe("NodePrompter", () => {
  it("can ask only at a terminal", () => {
    expect(new NodePrompter(terminal().input, new PassThrough()).canAsk).toBe(true);
    expect(new NodePrompter(new PassThrough(), new PassThrough()).canAsk).toBe(false);
  });

  it("shows the default, and returns the answer without spaces around it", async () => {
    const { input, output, shown } = terminal();
    const prompter = new NodePrompter(input, output);
    const answer = prompter.ask("Your name", "Ada");
    input.write("  Grace \r");
    expect(await answer).toBe("Grace");
    expect(shown()).toContain("Your name (Ada): ");
  });

  it("returns the default for an empty answer", async () => {
    const { input, output } = terminal();
    const prompter = new NodePrompter(input, output);
    const answer = prompter.ask("Your name", "Ada");
    input.write("\r");
    expect(await answer).toBe("Ada");
  });

  it("shows no default when there is none", async () => {
    const { input, output, shown } = terminal();
    const answer = new NodePrompter(input, output).ask("The address", "");
    input.write("\r");
    expect(await answer).toBe("");
    expect(shown()).toContain("The address: ");
  });

  it("stops on Ctrl+C, and ends the line of the question", async () => {
    const { input, output, shown } = terminal();
    const answer = new NodePrompter(input, output).ask("Your name", "Ada");
    input.write("\x03");
    await expect(answer).rejects.toBeInstanceOf(AskingStopped);
    expect(shown().endsWith("\n")).toBe(true);
  });

  it("passes on any other failure, rather than taking it for Ctrl+C", async () => {
    const { input, output } = terminal();
    const write = output.write.bind(output);
    let writes = 0;
    output.write = ((...args: Parameters<typeof write>) => {
      writes++;
      if (writes === 1) throw new Error("the terminal is gone");
      return write(...args);
    }) as typeof output.write;
    await expect(new NodePrompter(input, output).ask("Your name", "Ada")).rejects.toThrow(
      "the terminal is gone",
    );
  });
});

describe("ScriptedPrompter", () => {
  it("answers in order, then with the defaults, and stops at null", async () => {
    const prompter = new ScriptedPrompter([" Grace ", "", null]);
    expect(await prompter.ask("one", "a")).toBe("Grace");
    expect(await prompter.ask("two", "b")).toBe("b");
    await expect(prompter.ask("three", "c")).rejects.toBeInstanceOf(AskingStopped);
    expect(await prompter.ask("four", "d")).toBe("d");
    expect(prompter.asked).toEqual(["one", "two", "three", "four"]);
  });
});
