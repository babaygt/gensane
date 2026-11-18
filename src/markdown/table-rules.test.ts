// Cases are adapted from the GitHub Flavored Markdown spec, section "Tables (extension)".
import { describe, expect, it } from "vitest";
import { matchDelimiterRow, splitTableRow } from "./table-rules.ts";

describe("splitTableRow", () => {
  it.each([
    { text: "| a | b |", cells: ["a", "b"] },
    { text: "a | b", cells: ["a", "b"] },
    { text: "| a | b", cells: ["a", "b"] },
    { text: "a | b |", cells: ["a", "b"] },
    { text: "   | a |", cells: ["a"] },
    { text: "|   spaced   |", cells: ["spaced"] },
    { text: "| a || b |", cells: ["a", "", "b"] },
    { text: "no pipes", cells: ["no pipes"] },
    { text: "|", cells: [""] },
  ])("$text", ({ text, cells }) => {
    expect(splitTableRow(text).map((cell) => cell.text)).toEqual(cells);
  });

  it("keeps an escaped pipe inside the cell, without its backslash", () => {
    expect(splitTableRow("| f\\|oo | b |").map((cell) => cell.text)).toEqual(["f|oo", "b"]);
  });

  it("treats a pipe after an escaped backslash as a separator", () => {
    expect(splitTableRow("| a\\\\| b |").map((cell) => cell.text)).toEqual(["a\\\\", "b"]);
  });

  it("records where each cell's content is in the line", () => {
    expect(splitTableRow("| ab | c |")).toEqual([
      { text: "ab", start: 2, end: 4 },
      { text: "c", start: 7, end: 8 },
    ]);
  });
});

describe("splitTableRow with a whitespace-only cell", () => {
  it("gives the empty cell an empty range", () => {
    expect(splitTableRow("|   | b |")[0]).toEqual({ text: "", start: 4, end: 4 });
  });
});

describe("matchDelimiterRow", () => {
  it.each([
    { text: "| --- | --- |", alignments: ["none", "none"] },
    { text: "|:--|:-:|--:|", alignments: ["left", "center", "right"] },
    { text: "--- | ---", alignments: ["none", "none"] },
    { text: "---|", alignments: ["none"] },
    { text: "|---", alignments: ["none"] },
    { text: "   | - |", alignments: ["none"] },
  ])("$text", ({ text, alignments }) => {
    expect(matchDelimiterRow(text)).toEqual(alignments);
  });

  it.each([
    ["---", "no pipe: this is a horizontal rule"],
    ["| a |", "letters"],
    ["| -- - |", "a space inside the dashes"],
    ["| :: |", "no dashes"],
    ["| --- | |", "an empty cell"],
    ["    | - |", "four spaces of indentation"],
    ["|", "no cells"],
    ["", "empty line"],
  ])("rejects %j (%s)", (text) => {
    expect(matchDelimiterRow(text)).toBeUndefined();
  });
});
