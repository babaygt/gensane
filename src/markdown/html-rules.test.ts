// Cases are adapted from the CommonMark spec sections "HTML blocks" and "Raw HTML".
import { describe, expect, it } from "vitest";
import { endsHtmlBlock, matchHtmlBlockStart, parseRawHtml } from "./html-rules.ts";

describe("matchHtmlBlockStart", () => {
  it.each([
    ["<pre>", 1],
    ["<script src='a'>", 1],
    ["<STYLE", 1],
    ["  <textarea>", 1],
    ["<!-- note", 2],
    ["<?php", 3],
    ["<!DOCTYPE html>", 4],
    ["<![CDATA[", 5],
    ["<div>", 6],
    ["</div>", 6],
    ["<DIV class='a'", 6],
    ["<table", 6],
    ["<hr/>", 6],
    ["<search>", 6],
    ["<a href='x'>", 7],
    ["</ins>  ", 7],
    ["<custom-tag>", 7],
    ["<input disabled />", 7],
  ])("%j is type %i", (text, type) => {
    expect(matchHtmlBlockStart(text)).toBe(type);
  });

  it.each([
    ["    <div>", "four spaces of indentation"],
    ["<divider text", "a longer name is not a block tag"],
    ["<a href='x'> text", "type 7 needs the tag alone on its line"],
    ["</pre>", "a closing tag of a type 1 element"],
    ["<a href='x'", "an unfinished tag"],
    ["text <div>", "does not start the line"],
    ["<!", "not a declaration"],
    ["< div>", "a space after <"],
  ])("rejects %j (%s)", (text) => {
    expect(matchHtmlBlockStart(text)).toBeUndefined();
  });
});

describe("endsHtmlBlock", () => {
  it.each([
    [1, "a </script> b"],
    [1, "</PRE>"],
    [1, "</style>"],
    [1, "</textarea>"],
    [2, "note -->"],
    [3, "?> done"],
    [4, "end>"],
    [5, "]]>"],
  ] as const)("type %i ends at %j", (type, text) => {
    expect(endsHtmlBlock(type, text)).toBe(true);
  });

  it.each([
    [1, "</div>"],
    [2, "-- >"],
    [3, "? >"],
    [4, "no end"],
    [5, "]] >"],
  ] as const)("type %i continues at %j", (type, text) => {
    expect(endsHtmlBlock(type, text)).toBe(false);
  });
});

describe("parseRawHtml", () => {
  it.each([
    "<a>",
    "<bab>",
    "<c2c/>",
    "<a  />",
    '<a foo="bar" bam = \'baz <em>"</em>\'\n_boolean zoop:33=zoop:33 />',
    "<a data-x=1>",
    "</a>",
    "</a  \n>",
    "<!---->",
    "<!-->",
    "<!--->",
    "<!-- a\nb -->",
    "<?php a ?>",
    "<!ELEMENT br>",
    "<![CDATA[>&<]]>",
  ])("accepts %j", (source) => {
    expect(parseRawHtml(`${source} rest`, 0, new Map())).toBe(source.length);
  });

  it.each([
    "<33>",
    "<__>",
    '<a h*#ref="hi">',
    "<a href=\"hi'>",
    "<a href=hi'>",
    "< a>",
    "<a/ >",
    "<a b=c=d>",
    "</a href='x'>",
    "<!-- open",
    "<? open",
    "<!a",
    "<! a>",
    "<![CDATA[ open",
    "<",
  ])("rejects %j", (source) => {
    expect(parseRawHtml(source, 0, new Map())).toBeUndefined();
  });

  it("remembers that a terminator does not appear in the rest of the text", () => {
    const missing = new Map<string, number>();
    parseRawHtml("<!-- a <!-- b", 0, missing);
    expect(missing.get("-->")).toBe(4);
  });
});
