// Cases are adapted from the CommonMark spec (https://spec.commonmark.org/0.31.2/),
// sections "Thematic breaks", "ATX headings" and "Fenced code blocks".
import { describe, expect, it } from "vitest";
import {
  isFenceClose,
  isSetextUnderline,
  isThematicBreak,
  matchAtxHeading,
  matchFenceOpen,
} from "./block-rules.ts";

describe("isThematicBreak", () => {
  it.each([
    "***",
    "---",
    "___",
    " ***",
    "   ***",
    "_____________________________________",
    " - - -",
    " **  * ** * ** * **",
    "-     -      -      -",
    "- - - -    ",
  ])("accepts %j", (text) => {
    expect(isThematicBreak(text)).toBe(true);
  });

  it.each([
    ["+++", "wrong character"],
    ["===", "wrong character"],
    ["--", "fewer than three"],
    ["**", "fewer than three"],
    ["    ***", "four spaces of indentation is too many"],
    ["_ _ _ _ a", "other characters on the line"],
    ["a------", "other characters on the line"],
    ["---a---", "other characters on the line"],
    ["*-*", "mixed characters"],
  ])("rejects %j (%s)", (text) => {
    expect(isThematicBreak(text)).toBe(false);
  });
});

describe("matchAtxHeading", () => {
  it.each([
    { text: "# foo", level: 1, content: "foo" },
    { text: "###### foo", level: 6, content: "foo" },
    { text: "#                  foo                     ", level: 1, content: "foo" },
    { text: " ### foo", level: 3, content: "foo" },
    { text: "   # foo", level: 1, content: "foo" },
    { text: "#\tfoo", level: 1, content: "foo" },
    { text: "## foo ##", level: 2, content: "foo" },
    { text: "# foo ##################################", level: 1, content: "foo" },
    { text: "### foo ###     ", level: 3, content: "foo" },
    { text: "### foo ### b", level: 3, content: "foo ### b" },
    { text: "# foo#", level: 1, content: "foo#" },
    { text: "# C#", level: 1, content: "C#" },
    { text: "## ", level: 2, content: "" },
    { text: "#", level: 1, content: "" },
    { text: "### ###", level: 3, content: "" },
  ])("$text → h$level $content", ({ text, level, content }) => {
    expect(matchAtxHeading(text)).toEqual({ level, content });
  });

  it.each([
    ["####### foo", "more than six #"],
    ["#5 bolt", "no space after #"],
    ["#hashtag", "no space after #"],
    ["\\## foo", "escaped"],
    ["    # foo", "four spaces of indentation"],
    ["foo # bar", "# not at the start"],
  ])("rejects %j (%s)", (text) => {
    expect(matchAtxHeading(text)).toBeUndefined();
  });
});

describe("matchFenceOpen", () => {
  it.each([
    { text: "```", char: "`", length: 3, indent: 0, info: "" },
    { text: "~~~", char: "~", length: 3, indent: 0, info: "" },
    { text: "`````", char: "`", length: 5, indent: 0, info: "" },
    { text: "```ts", char: "`", length: 3, indent: 0, info: "ts" },
    { text: "```  ts title=x  ", char: "`", length: 3, indent: 0, info: "ts title=x" },
    { text: "  ```", char: "`", length: 3, indent: 2, info: "" },
    { text: "~~~ aa ``` ~~~", char: "~", length: 3, indent: 0, info: "aa ``` ~~~" },
  ])("$text opens a fence", ({ text, ...expected }) => {
    expect(matchFenceOpen(text)).toEqual(expected);
  });

  it.each([
    ["``", "fewer than three"],
    ["``` aa `", "backtick fence info may not contain backticks"],
    ["    ```", "four spaces of indentation"],
    ["a```", "not at the start"],
  ])("rejects %j (%s)", (text) => {
    expect(matchFenceOpen(text)).toBeUndefined();
  });
});

describe("isFenceClose", () => {
  const backticks = { char: "`", length: 3, indent: 0, info: "" } as const;

  it.each(["```", "````", "   ```", "```   "])("%j closes a ``` fence", (text) => {
    expect(isFenceClose(text, backticks)).toBe(true);
  });

  it.each([
    ["``", "shorter than the opening fence"],
    ["~~~", "different character"],
    ["``` ts", "closing fences cannot have an info string"],
    ["    ```", "four spaces of indentation"],
  ])("%j does not close it (%s)", (text) => {
    expect(isFenceClose(text, backticks)).toBe(false);
  });
});

describe("isSetextUnderline", () => {
  it.each([
    ["===", "="],
    ["=", "="],
    ["---", "-"],
    ["  ---   ", "-"],
  ])("%j is a %s underline", (text, char) => {
    expect(isSetextUnderline(text)).toBe(char);
  });

  it.each(["- - -", "=-=", "    ===", "== x", "***"])("%j is not", (text) => {
    expect(isSetextUnderline(text)).toBeUndefined();
  });
});
