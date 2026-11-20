import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { withBasePath } from "./base-path.ts";

const PATH = "/notes";

describe("withBasePath", () => {
  it.each([
    ['<a href="/about/">About</a>', '<a href="/notes/about/">About</a>'],
    ['<img src="/images/me.png" alt="">', '<img src="/notes/images/me.png" alt="">'],
    ['<a href="/">Home</a>', '<a href="/notes/">Home</a>'],
    ["<a href='/about/'>About</a>", "<a href='/notes/about/'>About</a>"],
    ["<a href=/about/>About</a>", "<a href=/notes/about/>About</a>"],
    ['<A HREF="/about/">About</A>', '<A HREF="/notes/about/">About</A>'],
    ['<a href = "/about/">About</a>', '<a href = "/notes/about/">About</a>'],
    [
      '<link rel="stylesheet" href="/assets/style.css">',
      '<link rel="stylesheet" href="/notes/assets/style.css">',
    ],
    [
      '<script src="/assets/search.js"></script>',
      '<script src="/notes/assets/search.js"></script>',
    ],
    ['<img src="/a.png"/>', '<img src="/notes/a.png"/>'],
    ['<form action="/search/" role="search">', '<form action="/notes/search/" role="search">'],
  ])("adds the path to %s", (html, expected) => {
    expect(withBasePath(html, PATH)).toBe(expected);
  });

  it("adds the path to every address of a srcset that starts at the root", () => {
    expect(withBasePath('<img srcset="/a.png 1x, b.png 2x,/c.png 3x">', PATH)).toBe(
      '<img srcset="/notes/a.png 1x, b.png 2x,/notes/c.png 3x">',
    );
  });

  it.each([
    ['<a href="//cdn.example.com/x.js">x</a>', "another site, without a scheme"],
    ['<a href="https://example.org/">x</a>', "another site"],
    ['<a href="#details">x</a>', "a part of the same page"],
    ['<a href="../other/">x</a>', "an address relative to the page"],
    ['<a href="mailto:ada@example.com">x</a>', "an email address"],
    ['<a data-href="/about/" title="/about/">x</a>', "other attributes"],
    ['<p>Write href="/about/" to link.</p>', "text"],
    ['<!-- <a href="/about/"> -->', "a comment"],
    ["<script>const link = '<a href=\"/about/\">';</script>", "a script"],
    ['<style>a[href="/about/"] { color: red }</style>', "a style"],
    ['<a href="">x</a>', "an empty address"],
  ])("leaves %s alone, which is %s", (html) => {
    expect(withBasePath(html, PATH)).toBe(html);
  });

  it("knows a script and its end in any case", () => {
    expect(withBasePath('<SCRIPT>x = "<a href=/in/>";</SCRIPT><a href="/out/">x</a>', PATH)).toBe(
      '<SCRIPT>x = "<a href=/in/>";</SCRIPT><a href="/notes/out/">x</a>',
    );
  });

  it("adds the path to a srcset address after spaces", () => {
    expect(withBasePath('<img srcset="a.png 1x,  /b.png 2x">', PATH)).toBe(
      '<img srcset="a.png 1x,  /notes/b.png 2x">',
    );
  });

  it("finds tags again after a script ends", () => {
    expect(withBasePath('<script>if (a < b) {}</script><a href="/x/">x</a>', PATH)).toBe(
      '<script>if (a < b) {}</script><a href="/notes/x/">x</a>',
    );
  });

  it("changes nothing for a site at the root", () => {
    const html = '<a href="/about/">About</a>';
    expect(withBasePath(html, "")).toBe(html);
  });

  it("stops at the end of broken HTML, without a loop", () => {
    expect(withBasePath('<a href="/x/', PATH)).toBe('<a href="/notes/x/');
    expect(withBasePath("<a href=", PATH)).toBe("<a href=");
    expect(withBasePath('<a "=" href="/x/">', PATH)).toBe('<a "=" href="/notes/x/">');
    expect(withBasePath("<!-- not closed", PATH)).toBe("<!-- not closed");
    expect(withBasePath("<script>never closed", PATH)).toBe("<script>never closed");
  });
});

/** A part of a page, with what it must become: the generator knows which addresses get the path. */
type Part = readonly [html: string, expected: string];

const word = fc.stringMatching(/^[a-z]{1,6}$/);
const address = fc.oneof(
  word.map((name): Part => [`/${name}/`, `${PATH}/${name}/`]),
  fc.constant<Part>(["/", `${PATH}/`]),
  word.map((name): Part => [`//${name}.com/`, `//${name}.com/`]),
  word.map((name): Part => [`https://${name}.com/`, `https://${name}.com/`]),
  word.map((name): Part => [`#${name}`, `#${name}`]),
  word.map((name): Part => [`${name}/`, `${name}/`]),
);
const quote = fc.constantFrom('"', "'");
const attribute = fc.oneof(
  fc
    .tuple(fc.constantFrom("href", "src", "HREF"), quote, address)
    .map(([name, mark, [value, expected]]): Part => [
      `${name}=${mark}${value}${mark}`,
      `${name}=${mark}${expected}${mark}`,
    ]),
  fc
    .tuple(fc.constantFrom("title", "alt", "data-href", "class"), quote, address)
    .map(([name, mark, [value]]): Part => [
      `${name}=${mark}${value}${mark}`,
      `${name}=${mark}${value}${mark}`,
    ]),
  fc.constantFrom<Part>(["hidden", "hidden"]),
);
const tag = fc
  .tuple(fc.constantFrom("a", "img", "link", "div"), fc.array(attribute, { maxLength: 3 }))
  .map(([name, attributes]): Part => [
    `<${name}${attributes.map(([html]) => ` ${html}`).join("")}>`,
    `<${name}${attributes.map(([, expected]) => ` ${expected}`).join("")}>`,
  ]);
const text = fc.stringMatching(/^[a-z /=".]{0,12}$/).map((value): Part => [value, value]);
const hidden = fc
  .tuple(fc.constantFrom("<!-- ", "<script>", "<style>"), tag)
  .map(([open, [html]]): Part => {
    const close = open === "<!-- " ? " -->" : open === "<script>" ? "</script>" : "</style>";
    return [`${open}${html}${close}`, `${open}${html}${close}`];
  });
const page = fc.array(fc.oneof(tag, text, hidden), { maxLength: 10 });

describe("any page", () => {
  it("gets the path in exactly the addresses that start at the root, and nothing else changes", () => {
    fc.assert(
      fc.property(page, (parts) => {
        const html = parts.map(([part]) => part).join("");
        expect(withBasePath(html, PATH)).toBe(parts.map(([, expected]) => expected).join(""));
      }),
    );
  });

  it("is the same page once the added paths are taken out", () => {
    const marker = "/§§§";
    fc.assert(
      fc.property(page, (parts) => {
        const html = parts.map(([part]) => part).join("");
        expect(withBasePath(html, marker).replaceAll(marker, "")).toBe(html);
      }),
    );
  });
});
