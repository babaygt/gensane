// Cases are adapted from the CommonMark spec (https://spec.commonmark.org/0.31.2/),
// sections "Thematic breaks", "ATX headings" and "Fenced code blocks".
import { describe, expect, it } from "vitest";
import {
  isFenceClose,
  isSameListType,
  isSetextUnderline,
  isThematicBreak,
  matchAtxHeading,
  matchBlockQuote,
  matchFenceOpen,
  matchListMarker,
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
    { text: "```", character: "`", length: 3, indent: 0, infoString: "" },
    { text: "~~~", character: "~", length: 3, indent: 0, infoString: "" },
    { text: "`````", character: "`", length: 5, indent: 0, infoString: "" },
    { text: "```ts", character: "`", length: 3, indent: 0, infoString: "ts" },
    { text: "```  ts title=x  ", character: "`", length: 3, indent: 0, infoString: "ts title=x" },
    { text: "  ```", character: "`", length: 3, indent: 2, infoString: "" },
    { text: "~~~ aa ``` ~~~", character: "~", length: 3, indent: 0, infoString: "aa ``` ~~~" },
    { text: "``` foo\\+bar", character: "`", length: 3, indent: 0, infoString: "foo+bar" },
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
  const backticks = { character: "`", length: 3, indent: 0, infoString: "" } as const;

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
  ])("%j is a %s underline", (text, character) => {
    expect(isSetextUnderline(text)).toBe(character);
  });

  it.each(["- - -", "=-=", "    ===", "== x", "***"])("%j is not", (text) => {
    expect(isSetextUnderline(text)).toBeUndefined();
  });
});

describe("matchBlockQuote", () => {
  it.each([
    ["> a", 2],
    [">a", 1],
    ["   > a", 5],
    [">", 1],
    [">\ta", 2],
    ["> > a", 2],
  ])("%j: strip %i characters", (text, length) => {
    expect(matchBlockQuote(text)).toBe(length);
  });

  it.each(["    > a", "a > b", ""])("rejects %j", (text) => {
    expect(matchBlockQuote(text)).toBeUndefined();
  });
});

describe("matchListMarker", () => {
  it.each([
    {
      text: "- a",
      type: { kind: "bullet", character: "-" },
      contentColumn: 2,
      contentStart: 2,
      empty: false,
    },
    {
      text: "* a",
      type: { kind: "bullet", character: "*" },
      contentColumn: 2,
      contentStart: 2,
      empty: false,
    },
    {
      text: "+ a",
      type: { kind: "bullet", character: "+" },
      contentColumn: 2,
      contentStart: 2,
      empty: false,
    },
    {
      text: "1. a",
      type: { kind: "ordered", start: 1, delimiter: "." },
      contentColumn: 3,
      contentStart: 3,
      empty: false,
    },
    {
      text: "10) a",
      type: { kind: "ordered", start: 10, delimiter: ")" },
      contentColumn: 4,
      contentStart: 4,
      empty: false,
    },
    {
      text: "007. a",
      type: { kind: "ordered", start: 7, delimiter: "." },
      contentColumn: 5,
      contentStart: 5,
      empty: false,
    },
    {
      text: " 3. a",
      type: { kind: "ordered", start: 3, delimiter: "." },
      contentColumn: 4,
      contentStart: 4,
      empty: false,
    },
    {
      text: "-   a",
      type: { kind: "bullet", character: "-" },
      contentColumn: 4,
      contentStart: 4,
      empty: false,
    }, // up to 4 spaces after the marker belong to it
    {
      text: "-      a",
      type: { kind: "bullet", character: "-" },
      contentColumn: 2,
      contentStart: 2,
      empty: false,
    }, // 5+ spaces: only one belongs to the marker
    {
      text: "-",
      type: { kind: "bullet", character: "-" },
      contentColumn: 2,
      contentStart: 1,
      empty: true,
    },
    {
      text: "-   ",
      type: { kind: "bullet", character: "-" },
      contentColumn: 2,
      contentStart: 4,
      empty: true,
    },
  ])("$text", ({ text, ...expected }) => {
    expect(matchListMarker(text)).toEqual(expected);
  });

  it.each([
    ["-a", "no space after the marker"],
    ["1.a", "no space after the marker"],
    ["1234567890. a", "more than 9 digits"],
    ["-1. a", "not a number"],
    ["    - a", "four spaces of indentation"],
    ["a. b", "letters are not numbers"],
  ])("rejects %j (%s)", (text) => {
    expect(matchListMarker(text)).toBeUndefined();
  });
});

const dotDelimiter = (start: number) => ({ kind: "ordered", start, delimiter: "." }) as const;

describe("isSameListType", () => {
  it("matches bullets with the same character", () => {
    expect(
      isSameListType({ kind: "bullet", character: "-" }, { kind: "bullet", character: "-" }),
    ).toBe(true);
    expect(
      isSameListType({ kind: "bullet", character: "-" }, { kind: "bullet", character: "*" }),
    ).toBe(false);
  });

  it("matches ordered lists with the same delimiter, whatever the number", () => {
    expect(isSameListType(dotDelimiter(1), dotDelimiter(7))).toBe(true);
    expect(isSameListType(dotDelimiter(1), { kind: "ordered", start: 2, delimiter: ")" })).toBe(
      false,
    );
  });

  it("never matches a bullet with an ordered marker", () => {
    expect(
      isSameListType(
        { kind: "bullet", character: "-" },
        { kind: "ordered", start: 1, delimiter: "." },
      ),
    ).toBe(false);
  });
});
