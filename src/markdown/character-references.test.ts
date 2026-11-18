// Cases are adapted from the CommonMark spec section "Entity and numeric character references".
import { describe, expect, it } from "vitest";
import { decodeCharacterReference, unescapeString } from "./character-references.ts";

describe("decodeCharacterReference", () => {
  it.each([
    ["&amp;", "&"],
    ["&copy;", "©"],
    ["&AElig;", "Æ"],
    ["&ngE;", "\u2267\u0338"],
    ["&#35;", "#"],
    ["&#1234;", "Ӓ"],
    ["&#X22;", '"'],
    ["&#xD06;", "ആ"],
    ["&#0;", "\uFFFD"],
    ["&#xD800;", "\uFFFD"],
    ["&#x10FFFF;", "\u{10FFFF}"],
  ])("%s", (source, text) => {
    expect(decodeCharacterReference(source, 0)).toEqual({ text, end: source.length });
  });

  it.each([
    ["&nbsp", "no semicolon"],
    ["&x;", "unknown name"],
    ["&#;", "no digits"],
    ["&#x;", "no hex digits"],
    ["&#87654321;", "more than 7 digits"],
    ["&#abcdef0;", "letters without x"],
    ["&ThisIsNotDefined;", "unknown name"],
    ["& amp;", "a space"],
  ])("rejects %s (%s)", (source) => {
    expect(decodeCharacterReference(source, 0)).toBeUndefined();
  });

  it("starts at the given position", () => {
    expect(decodeCharacterReference("ab&lt;", 2)).toEqual({ text: "<", end: 6 });
  });
});

describe("unescapeString", () => {
  it.each([
    ["a\\*b", "a*b"],
    ["a\\b", "a\\b"],
    ["&ouml;", "ö"],
    ["\\&amp;", "&amp;"],
    ["\\\\&amp;", "\\&"],
    ["&unknown;", "&unknown;"],
  ])("%s → %s", (source, expected) => {
    expect(unescapeString(source)).toBe(expected);
  });
});
