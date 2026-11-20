import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Answer, type ServedSite, answer, typeOf } from "./answer.ts";

const HTML = "text/html; charset=utf-8";

const site = {
  kind: "site" as const,
  files: new Map([
    ["index.html", "<h1>Home</h1>"],
    ["blog/hello/index.html", "<h1>Hello</h1>"],
    ["blog/über/index.html", "<h1>Über</h1>"],
    ["feed.xml", "<feed/>"],
    ["404.html", "<h1>Not here</h1>"],
  ]),
  copies: new Map([
    ["images/me.png", "site/public/images/me.png"],
    ["CNAME", "site/public/CNAME"],
    ["assets/style.css", "gensane/themes/default/assets/style.css"],
  ]),
} satisfies ServedSite;

/** Whether an answer only gives a file of the build or a file it copies, or adds a / to the address. */
function isAllowed(reply: Answer, path: string): boolean {
  if (reply.kind === "copy") return [...site.copies.values()].includes(reply.source);
  if (reply.kind === "text") return [...site.files.values()].includes(reply.body);
  return reply.location === `${path}/`;
}

describe("answer", () => {
  it.each([
    ["/", "<h1>Home</h1>"],
    ["/blog/hello/", "<h1>Hello</h1>"],
    ["/blog/%C3%BCber/", "<h1>Über</h1>"],
  ])("serves the page at %s", (path, body) => {
    expect(answer(site, path)).toEqual({ kind: "text", status: 200, type: HTML, body });
  });

  it("serves other files with their own type", () => {
    expect(answer(site, "/feed.xml")).toEqual({
      kind: "text",
      status: 200,
      type: "application/xml; charset=utf-8",
      body: "<feed/>",
    });
  });

  it("serves the files it copies from where they are", () => {
    expect(answer(site, "/images/me.png")).toEqual({
      kind: "copy",
      source: "site/public/images/me.png",
      type: "image/png",
    });
    expect(answer(site, "/assets/style.css")).toEqual({
      kind: "copy",
      source: "gensane/themes/default/assets/style.css",
      type: "text/css; charset=utf-8",
    });
  });

  it("sends an address without its / at the end to the address with it", () => {
    expect(answer(site, "/blog/hello")).toEqual({ kind: "redirect", location: "/blog/hello/" });
    expect(answer(site, "/blog/%C3%BCber")).toEqual({
      kind: "redirect",
      location: "/blog/%C3%BCber/",
    });
  });

  it.each(["/nope/", "/blog/hello/index.htm", "/images/", "/%E0%A4%A", "/blog/hello//"])(
    "answers %s with the site's own 404 page",
    (path) => {
      expect(answer(site, path)).toEqual({
        kind: "text",
        status: 404,
        type: HTML,
        body: "<h1>Not here</h1>",
      });
    },
  );

  it("says Not found when the site has no 404 page", () => {
    const without: ServedSite = { kind: "site", files: new Map(), copies: new Map() };
    expect(answer(without, "/")).toMatchObject({ status: 404, body: "Not found" });
  });

  it("shows the problems on every page while the site has errors", () => {
    const failed: ServedSite = { kind: "problems", page: "<h1>Found 1 error</h1>" };
    for (const path of ["/", "/blog/hello/", "/images/me.png"]) {
      expect(answer(failed, path)).toEqual({
        kind: "text",
        status: 500,
        type: HTML,
        body: "<h1>Found 1 error</h1>",
      });
    }
  });

  it("never serves anything but a file of the build or a file it copies, for any address", () => {
    const part = fc.constantFrom(
      "",
      ".",
      "..",
      "%2e%2e",
      "%2F",
      "blog",
      "hello",
      "images",
      "me.png",
      "index.html",
      "\\",
    );
    const address = fc.array(part, { maxLength: 6 }).map((parts) => `/${parts.join("/")}`);
    fc.assert(
      fc.property(
        fc.oneof(
          address,
          fc.string().map((text) => `/${text}`),
        ),
        (path) => {
          expect(isAllowed(answer(site, path), path)).toBe(true);
        },
      ),
    );
  });
});

describe("typeOf", () => {
  it.each([
    ["index.html", HTML],
    ["style.CSS", "text/css; charset=utf-8"],
    ["photo.jpeg", "image/jpeg"],
    ["fonts/inter.woff2", "font/woff2"],
    ["CNAME", "application/octet-stream"],
    [".well-known/thing", "application/octet-stream"],
    ["archive.tar.gz", "application/octet-stream"],
    ["png", "application/octet-stream"],
  ])("%s is %s", (path, type) => {
    expect(typeOf(path)).toBe(type);
  });
});
