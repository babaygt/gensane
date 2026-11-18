// Cases are adapted from the CommonMark spec sections "Links", "Link reference definitions"
// and "Autolinks".
import { describe, expect, it } from "vitest";
import {
  normalizeLabel,
  parseAutolink,
  parseLinkDestination,
  parseLinkLabel,
  parseLinkTitle,
  parseReferenceDefinition,
} from "./link-syntax.ts";

describe("normalizeLabel", () => {
  it.each([
    ["Foo", "foo"],
    ["  a \n  b\t", "a b"],
    ["ẞ", "SS"],
    ["ΑΓΩ", "αγω"],
  ])("%j matches %j", (a, b) => {
    expect(normalizeLabel(a)).toBe(normalizeLabel(b));
  });
});

describe("parseLinkLabel", () => {
  it.each([
    ["[foo]", "foo", 5],
    ["[foo\\]bar]", "foo\\]bar", 10],
    ["[a\nb] rest", "a\nb", 5],
  ])("%j", (source, label, end) => {
    expect(parseLinkLabel(source, 0)).toEqual({ label, end });
  });

  it.each(["foo", "[foo", "[]", "[   ]", "[a[b]", `[${"a".repeat(1000)}]`])("rejects %j", (s) => {
    expect(parseLinkLabel(s, 0)).toBeUndefined();
  });

  it("accepts 999 characters", () => {
    expect(parseLinkLabel(`[${"a".repeat(999)}]`, 0)?.end).toBe(1001);
  });
});

describe("parseLinkDestination", () => {
  it.each([
    ["/url", "/url", 4],
    ["/url rest", "/url", 4],
    ["<my url>", "my url", 8],
    ["<>", "", 2],
    ["a(b(c))d", "a(b(c))d", 8],
    ["a(b))", "a(b)", 4],
    ["a\\)b", "a)b", 4],
    ["f&ouml;", "fö", 7],
    ["<a\\>b>", "a>b", 6],
    ["a\x7fb", "a", 1],
  ])("%j", (source, url, end) => {
    expect(parseLinkDestination(source, 0)).toEqual({ url, end });
  });

  it.each(["<a\nb>", "<a<b>", "<open", "(unbalanced", ""])("rejects %j", (source) => {
    expect(parseLinkDestination(source, 0)).toBeUndefined();
  });
});

describe("parseLinkTitle", () => {
  it.each([
    ['"a b"', "a b", 5],
    ["'a b'", "a b", 5],
    ["(a b)", "a b", 5],
    ['"a\nb"', "a\nb", 5],
    ['"a \\" b"', 'a " b', 8],
    ['"&amp;"', "&", 7],
  ])("%j", (source, title, end) => {
    expect(parseLinkTitle(source, 0)).toEqual({ title, end });
  });

  it.each(['"open', "(a(b)", "plain"])("rejects %j", (source) => {
    expect(parseLinkTitle(source, 0)).toBeUndefined();
  });
});

describe("parseReferenceDefinition", () => {
  it("reads a label, destination and title", () => {
    expect(parseReferenceDefinition('[Foo]: /url "title"\nrest', 0)).toEqual({
      label: normalizeLabel("foo"),
      url: "/url",
      title: "title",
      end: 20,
    });
  });

  it.each([
    ["[foo]:\n  /url", "/url"],
    ["[foo]: <>", ""],
    ["[foo]:\n/url\n", "/url"],
  ])("allows %j", (source, url) => {
    expect(parseReferenceDefinition(source, 0)).toMatchObject({ url, title: undefined });
  });

  it("allows the title on the next line", () => {
    expect(parseReferenceDefinition("[a]: /u\n'b'", 0)?.title).toBe("b");
  });

  it("keeps the definition when the next line is not a valid title", () => {
    expect(parseReferenceDefinition('[a]: /u\n"b" c', 0)).toMatchObject({
      title: undefined,
      end: 8,
    });
  });

  it.each([
    ["[a]:", "no destination"],
    ["[a] /u", "no colon"],
    ['[a]: /u "b" c', "text after the title on the same line"],
    ["[a]: /u b", "text after the destination"],
    ['[a]: <b>"t"', "no space before the title"],
  ])("rejects %j (%s)", (source) => {
    expect(parseReferenceDefinition(source, 0)).toBeUndefined();
  });
});

describe("parseAutolink", () => {
  it.each([
    ["<http://foo.bar>", "http://foo.bar", "http://foo.bar"],
    ["<MAILTO:a@b.c>", "MAILTO:a@b.c", "MAILTO:a@b.c"],
    ["<a+b.c:d>", "a+b.c:d", "a+b.c:d"],
    ["<foo@bar.example.com>", "mailto:foo@bar.example.com", "foo@bar.example.com"],
  ])("%s", (source, url, text) => {
    expect(parseAutolink(source, 0)).toEqual({ url, text, end: source.length });
  });

  it.each([
    "<>",
    "< http://a>",
    "<http://a b>",
    "<xy:abc",
    "<a:b\nc>",
    "<foo\\+@bar.example.com>",
    "<xy:a<b>",
    "<xy:a\x7fb>",
  ])("rejects %j", (source) => {
    expect(parseAutolink(source, 0)).toBeUndefined();
  });
});
