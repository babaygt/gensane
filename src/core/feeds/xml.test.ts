import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { escapeXml } from "./xml.ts";

function unescapeXml(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

describe("escapeXml", () => {
  it("escapes the characters that mean something in XML", () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;",
    );
  });

  it("leaves no special character in any text, and loses nothing", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (text) => {
        const escaped = escapeXml(text);
        expect(escaped).not.toMatch(/[<>"']|&(?!(?:lt|gt|quot|apos|amp);)/);
        expect(unescapeXml(escaped)).toBe(text);
      }),
    );
  });
});
