import { describe, expect, it } from "vitest";
import { type BuiltSite, CoreCodes, type SiteConfig, buildSite } from "../index.ts";
import { minimal, plainTheme } from "../test-helpers.ts";

type Content = Readonly<Record<string, string>>;

function built(content: Content, config: SiteConfig): BuiltSite {
  const result = buildSite({ content, templates: plainTheme, config });
  if (!result.ok) throw new Error(result.error.map((problem) => problem.message).join("\n"));
  return result.value;
}

function fileOf(content: Content, config: SiteConfig, path: string): string | undefined {
  return built(content, config).files.find((file) => file.path === path)?.content;
}

function problemsOf(content: Content, config: SiteConfig) {
  const result = buildSite({ content, templates: plainTheme, config });
  return result.ok ? result.value.warnings : result.error;
}

const site = { title: "Ada's notes", url: "https://example.com" };

describe("the site URL", () => {
  it("leaves the feed and the sitemap out without it, with a warning", () => {
    const result = built({ "blog/a.md": minimal.post }, { site: { title: "A" } });
    expect(result.files.map((file) => file.path)).not.toContain("sitemap.xml");
    expect(result.files.map((file) => file.path)).not.toContain("feed.xml");
    expect(result.warnings).toMatchObject([
      {
        code: CoreCodes.noSiteUrl,
        severity: "warning",
        message: "the feed and the sitemap are left out, because they need the address of the site",
        hint: 'add `site: { url: "https://example.com" }` to the config',
        span: { file: "gensane.config.ts", start: { line: 1, column: 1 } },
      },
    ]);
  });

  it("names the config file it was given", () => {
    const result = built({}, { configFile: "site.config.ts" });
    expect(result.warnings[0]?.span.file).toBe("site.config.ts");
  });

  it.each([
    "example.com",
    "ftp://example.com",
    "https://example.com/?page=1",
    "https://example.com/#top",
    42,
  ])("rejects %j as the address of the site", (url) => {
    expect(problemsOf({}, { site: { url } })).toMatchObject([
      {
        code: CoreCodes.invalidSiteUrl,
        message: `"site.url" must be the full address of the site, such as "https://example.com", but it is ${JSON.stringify(url)}`,
        hint: "use an address that starts with https:// or http://, without ? or #",
      },
    ]);
  });

  it.each([
    ["https://example.com", "https://example.com/blog/a/"],
    ["https://example.com/", "https://example.com/blog/a/"],
    ["https://ada.github.io/notes", "https://ada.github.io/notes/blog/a/"],
    ["https://ada.github.io/notes/", "https://ada.github.io/notes/blog/a/"],
  ])("joins %s with the URL of a page", (url, address) => {
    const sitemap = fileOf({ "blog/a.md": minimal.post }, { site: { url } }, "sitemap.xml");
    expect(sitemap).toContain(`<loc>${address}</loc>`);
  });
});

describe("the feed", () => {
  const content = {
    "blog/2026-11-17-hello.md":
      "---\ntitle: Tom & Jerry\ndate: 2026-11-17\ntags: [testing, c&c]\ndescription: A <short> post\n---\nHello *world*\n",
    "blog/2026-11-18-second.md":
      "---\ntitle: Second\ndate: 2026-11-18T10:30\nupdated: 2026-11-20\n---\nMore\n",
  };

  it("lists the newest posts with their full content", () => {
    expect(fileOf(content, { site }, "feed.xml")).toBe(
      [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<feed xmlns="http://www.w3.org/2005/Atom">',
        "  <title>Ada&apos;s notes</title>",
        '  <link href="https://example.com/"/>',
        '  <link rel="self" href="https://example.com/feed.xml"/>',
        "  <id>https://example.com/</id>",
        "  <updated>2026-11-20T00:00:00Z</updated>",
        "  <author>",
        "    <name>Ada&apos;s notes</name>",
        "  </author>",
        "  <entry>",
        "    <title>Second</title>",
        '    <link href="https://example.com/blog/second/"/>',
        "    <id>https://example.com/blog/second/</id>",
        "    <published>2026-11-18T10:30:00Z</published>",
        "    <updated>2026-11-20T00:00:00Z</updated>",
        '    <content type="html">&lt;p&gt;More&lt;/p&gt;\n</content>',
        "  </entry>",
        "  <entry>",
        "    <title>Tom &amp; Jerry</title>",
        '    <link href="https://example.com/blog/hello/"/>',
        "    <id>https://example.com/blog/hello/</id>",
        "    <published>2026-11-17T00:00:00Z</published>",
        "    <updated>2026-11-17T00:00:00Z</updated>",
        "    <summary>A &lt;short&gt; post</summary>",
        '    <content type="html">&lt;p&gt;Hello &lt;em&gt;world&lt;/em&gt;&lt;/p&gt;\n</content>',
        '    <category term="testing"/>',
        '    <category term="c&amp;c"/>',
        "  </entry>",
        "</feed>",
        "",
      ].join("\n"),
    );
  });

  it("gives a subtitle from the description of the site", () => {
    const feed = fileOf(content, { site: { ...site, description: "Notes & more" } }, "feed.xml");
    expect(feed).toContain("  <subtitle>Notes &amp; more</subtitle>\n");
  });

  it.each([
    ["a name", "Ada", "Ada"],
    ["a group with a name", { name: "Ada L." }, "Ada L."],
  ])("names the author from %s", (_, author, name) => {
    const feed = fileOf(content, { site: { ...site, author } }, "feed.xml");
    expect(feed).toContain(`    <name>${name}</name>`);
  });

  it("uses the host name when the site has no title", () => {
    const feed = fileOf(content, { site: { url: "https://example.com" } }, "feed.xml");
    expect(feed).toContain("  <title>example.com</title>");
  });

  it.each([
    ["2026-11-18T10:30", "2026-11-18T10:30:00Z"],
    ["2026-11-18T10:30:15", "2026-11-18T10:30:15Z"],
    ["2026-11-18T10:30:15+02:00", "2026-11-18T10:30:15+02:00"],
    ["2026-11-18T10:30-05:00", "2026-11-18T10:30:00-05:00"],
  ])("writes the time %s as %s", (date, written) => {
    const feed = fileOf(
      { "blog/a.md": `---\ntitle: A\ndate: ${date}\n---\n` },
      { site },
      "feed.xml",
    );
    expect(feed).toContain(`<published>${written}</published>`);
  });

  it("keeps only the 20 newest posts", () => {
    const posts = Object.fromEntries(
      Array.from({ length: 25 }, (_, index) => [
        `blog/p${index}.md`,
        `---\ntitle: P${index}\ndate: 2026-01-${String(index + 1).padStart(2, "0")}\n---\n`,
      ]),
    );
    const feed = fileOf(posts, { site }, "feed.xml") ?? "";
    expect(feed.match(/<entry>/g)).toHaveLength(20);
    expect(feed).toContain("<title>P24</title>");
    expect(feed).not.toContain("<title>P4</title>");
  });

  it("isn't written for a site without posts", () => {
    const files = built({ "pages/a.md": minimal.page }, { site }).files.map((file) => file.path);
    expect(files).not.toContain("feed.xml");
    expect(files).toContain("sitemap.xml");
  });

  it("leaves drafts out, even when drafts are shown", () => {
    const posts = {
      "blog/a.md": minimal.post,
      "blog/b.md": "---\ntitle: B\ndate: 2026-11-18\ndraft: true\n---\n",
    };
    const feed = fileOf(posts, { site, drafts: true }, "feed.xml");
    expect(feed?.match(/<entry>/g)).toHaveLength(1);
  });
});

describe("the sitemap", () => {
  it("lists every page except the one for missing pages, with the date of posts", () => {
    const content = {
      "index.md": minimal.page,
      "blog/a.md": "---\ntitle: A\ndate: 2026-11-17\nupdated: 2026-11-19T08:00Z\n---\n",
      "pages/now.md": minimal.page,
    };
    expect(fileOf(content, { site }, "sitemap.xml")).toBe(
      [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "  <url>",
        "    <loc>https://example.com/</loc>",
        "  </url>",
        "  <url>",
        "    <loc>https://example.com/blog/</loc>",
        "  </url>",
        "  <url>",
        "    <loc>https://example.com/blog/a/</loc>",
        "    <lastmod>2026-11-19T08:00:00Z</lastmod>",
        "  </url>",
        "  <url>",
        "    <loc>https://example.com/now/</loc>",
        "  </url>",
        "</urlset>",
        "",
      ].join("\n"),
    );
  });

  it("leaves drafts out, even when drafts are shown", () => {
    const content = { "pages/a.md": "---\ntitle: A\ndraft: true\n---\n" };
    expect(fileOf(content, { site, drafts: true }, "sitemap.xml")).not.toContain("/a/");
  });

  it("writes a date without a time as the day", () => {
    const sitemap = fileOf({ "blog/a.md": minimal.post }, { site }, "sitemap.xml");
    expect(sitemap).toContain("<lastmod>2026-11-17</lastmod>");
  });
});
