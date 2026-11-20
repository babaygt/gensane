import { describe, expect, it } from "vitest";
import { NodeTerminal, wantsColor } from "./index.ts";

function stream(isTTY: boolean) {
  const written: string[] = [];
  return { isTTY, written, write: (text: string) => written.push(text) };
}

describe("wantsColor", () => {
  it("colors a terminal", () => {
    expect(wantsColor(stream(true), {})).toBe(true);
  });

  it("doesn't color a file or a pipe, such as a log in CI", () => {
    expect(wantsColor(stream(false), {})).toBe(false);
    expect(wantsColor({ write: () => true }, {})).toBe(false);
  });

  it("doesn't color when NO_COLOR is set to anything", () => {
    expect(wantsColor(stream(true), { NO_COLOR: "1" })).toBe(false);
    expect(wantsColor(stream(true), { NO_COLOR: "false" })).toBe(false);
  });

  it("ignores NO_COLOR when it is empty, as https://no-color.org says", () => {
    expect(wantsColor(stream(true), { NO_COLOR: "" })).toBe(true);
  });
});

describe("NodeTerminal", () => {
  it("writes results and problems to their own streams, one line each", () => {
    const output = stream(false);
    const errors = stream(false);
    const terminal = new NodeTerminal(output, errors, {});
    terminal.write("Built 4 pages");
    terminal.writeError("error: no");
    expect(output.written).toEqual(["Built 4 pages\n"]);
    expect(errors.written).toEqual(["error: no\n"]);
  });

  it("colors when the error stream is a terminal, because that is where problems go", () => {
    expect(new NodeTerminal(stream(false), stream(true), {}).color).toBe(true);
    expect(new NodeTerminal(stream(true), stream(false), {}).color).toBe(false);
  });
});
