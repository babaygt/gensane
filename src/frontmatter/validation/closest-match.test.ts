import { describe, expect, it } from "vitest";
import { closestMatch, editDistance } from "./closest-match.ts";

describe("editDistance", () => {
  it.each([
    ["title", "title", 0],
    ["title", "titles", 1],
    ["title", "tile", 1],
    ["title", "tutle", 1],
    ["titel", "title", 1],
    ["", "abc", 3],
    ["abc", "", 3],
    ["kitten", "sitting", 3],
  ])("%j and %j are %i apart", (first, second, distance) => {
    expect(editDistance(first, second)).toBe(distance);
  });
});

describe("closestMatch", () => {
  it("finds a misspelled word", () => {
    expect(closestMatch("titel", ["date", "title"])).toBe("title");
  });

  it("ignores case in the word", () => {
    expect(closestMatch("TAGS", ["tags"])).toBe("tags");
  });

  it("ignores case in the candidates", () => {
    expect(closestMatch("typescript", ["TYPESCRIPT"])).toBe("TYPESCRIPT");
  });

  it("prefers the closest candidate", () => {
    expect(closestMatch("abcdefghi", ["abcdefghj", "abcdefgjj"])).toBe("abcdefghj");
  });

  it("allows more mistakes in longer words", () => {
    expect(closestMatch("desciptoin", ["description"])).toBe("description");
  });

  it.each([
    ["mood", ["role", "date"]],
    ["name", ["date"]],
    ["x", []],
  ])("finds nothing close to %j", (word, candidates) => {
    expect(closestMatch(word, candidates)).toBeUndefined();
  });
});
