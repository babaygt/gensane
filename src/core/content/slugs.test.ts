import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isValidSlug, slugFromFileName, slugify } from "./slugs.ts";

describe("slugify", () => {
  it.each([
    ["Hello World", "hello-world"],
    ["  spaces  around  ", "spaces-around"],
    ["Ünïcödé", "unicode"],
    ["TypeScript & Node.js", "typescript-node-js"],
    ["already-a-slug", "already-a-slug"],
    ["日本語", ""],
  ])("%j → %j", (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });

  it("always gives a valid slug or nothing", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme" }), (text) => {
        const slug = slugify(text);
        expect(slug === "" || isValidSlug(slug)).toBe(true);
      }),
    );
  });

  it("changes nothing the second time", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme" }), (text) => {
        expect(slugify(slugify(text))).toBe(slugify(text));
      }),
    );
  });

  it("keeps a valid slug as it is", () => {
    const slug = fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    fc.assert(
      fc.property(slug, (valid) => {
        expect(slugify(valid)).toBe(valid);
      }),
    );
  });
});

describe("isValidSlug", () => {
  it.each(["a", "hello-world", "2026", "v2-0"])("accepts %j", (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(["", "Hello", "a--b", "-a", "a-", "a b", "ü", "a_b"])("rejects %j", (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});

describe("slugFromFileName", () => {
  it.each([
    ["hello.md", { slug: "hello", date: undefined }],
    ["2026-11-17-hello.md", { slug: "hello", date: "2026-11-17" }],
    ["2026-11-17.md", { slug: "", date: "2026-11-17" }],
    ["2026-1-17-hello.md", { slug: "2026-1-17-hello", date: undefined }],
    ["20261117-hello.md", { slug: "20261117-hello", date: undefined }],
  ])("%s", (name, expected) => {
    expect(slugFromFileName(name)).toEqual(expected);
  });
});
