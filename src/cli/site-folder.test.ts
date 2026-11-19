import { describe, expect, it } from "vitest";
import { TEMPLATES, buildSite } from "../core/index.ts";
import { MemoryFileSystem } from "../ports/index.ts";
import { outputFolderProblem, readSiteFolder, writeSite } from "./site-folder.ts";

const PICTURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);

describe("readSiteFolder", () => {
  it("reads the content files by their path inside content/", async () => {
    const fileSystem = new MemoryFileSystem({
      "site/content/index.md": "# Home",
      "site/content/blog/2026-11-17-hello.md": "Hello",
    });
    const { content } = await readSiteFolder(fileSystem, "site");
    expect(content).toEqual({ "blog/2026-11-17-hello.md": "Hello", "index.md": "# Home" });
  });

  it("reads the .html files in theme/ as templates, named by their path", async () => {
    const fileSystem = new MemoryFileSystem({
      "site/theme/post.html": "<h1>{{ page.title }}</h1>",
      "site/theme/partials/nav.html": "<nav></nav>",
    });
    const { templates } = await readSiteFolder(fileSystem, "site");
    expect(templates).toEqual({
      "partials/nav.html": "<nav></nav>",
      "post.html": "<h1>{{ page.title }}</h1>",
    });
  });

  it("doesn't read other files in theme/ as templates", async () => {
    const fileSystem = new MemoryFileSystem({
      "site/theme/post.html": "",
      "site/theme/style.css": "body {}",
      "site/theme/notes.md": "",
    });
    const { templates } = await readSiteFolder(fileSystem, "site");
    expect(Object.keys(templates)).toEqual(["post.html"]);
  });

  it("lists the files in public/ without reading them", async () => {
    const fileSystem = new MemoryFileSystem({
      "site/public/images/me.png": PICTURE,
      "site/public/CNAME": "example.com",
    });
    const { publicFiles } = await readSiteFolder(fileSystem, "site");
    expect(publicFiles).toEqual(["CNAME", "images/me.png"]);
  });

  it("skips files and folders whose names start with a dot in content/ and theme/", async () => {
    const fileSystem = new MemoryFileSystem({
      "site/content/.DS_Store": "",
      "site/content/blog/.hello.md.swp": "",
      "site/content/.drafts/a.md": "",
      "site/content/blog/a.md": "A",
      "site/theme/.DS_Store": "",
      "site/theme/.old/post.html": "",
      "site/theme/post.html": "P",
    });
    const { content, templates } = await readSiteFolder(fileSystem, "site");
    expect(content).toEqual({ "blog/a.md": "A" });
    expect(templates).toEqual({ "post.html": "P" });
  });

  it("keeps files that start with a dot in public/, which hosts use, but not .DS_Store", async () => {
    const fileSystem = new MemoryFileSystem({
      "site/public/.nojekyll": "",
      "site/public/.well-known/security.txt": "",
      "site/public/.DS_Store": "",
      "site/public/images/.DS_Store": "",
    });
    const { publicFiles } = await readSiteFolder(fileSystem, "site");
    expect(publicFiles).toEqual([".nojekyll", ".well-known/security.txt"]);
  });

  it("reads a site with no folders as empty", async () => {
    const site = await readSiteFolder(new MemoryFileSystem(), "site");
    expect(site).toEqual({ content: {}, templates: {}, publicFiles: [] });
  });
});

describe("outputFolderProblem", () => {
  it.each(["site/dist", "site/build/site", "site/./dist"])("accepts %s", (outputFolder) => {
    expect(outputFolderProblem("site", outputFolder)).toBeUndefined();
  });

  it.each([
    ["site", "is the site folder itself"],
    ["site/", "is the site folder itself"],
    ["elsewhere/dist", "isn't inside the site folder"],
    [".", "isn't inside the site folder"],
    ["site/../dist", "isn't inside the site folder"],
    ["site/content", "would replace content/"],
    ["site/public/dist", "would replace public/"],
    ["site/theme", "would replace theme/"],
  ])("refuses %s, because it %s", (outputFolder, reason) => {
    expect(outputFolderProblem("site", outputFolder)).toContain(reason);
  });
});

describe("writeSite", () => {
  it("writes each file into the output folder", async () => {
    const fileSystem = new MemoryFileSystem();
    const result = await writeSite(fileSystem, {
      siteFolder: "site",
      outputFolder: "site/dist",
      files: [
        { path: "index.html", content: "<h1>Home</h1>" },
        { path: "blog/hello/index.html", content: "<h1>Hello</h1>" },
      ],
      publicFiles: [],
    });
    expect(result.ok).toBe(true);
    expect(await fileSystem.listFiles("site/dist")).toEqual([
      "blog/hello/index.html",
      "index.html",
    ]);
    expect(await fileSystem.readText("site/dist/index.html")).toBe("<h1>Home</h1>");
  });

  it("copies the public files as they are", async () => {
    const fileSystem = new MemoryFileSystem({ "site/public/images/me.png": PICTURE });
    await writeSite(fileSystem, {
      siteFolder: "site",
      outputFolder: "site/dist",
      files: [],
      publicFiles: ["images/me.png"],
    });
    expect(fileSystem.bytesOf("site/dist/images/me.png")).toEqual(PICTURE);
  });

  it("removes what an earlier build wrote, so a deleted post doesn't stay online", async () => {
    const fileSystem = new MemoryFileSystem({
      "site/dist/blog/deleted/index.html": "old",
      "site/dist/index.html": "old",
    });
    await writeSite(fileSystem, {
      siteFolder: "site",
      outputFolder: "site/dist",
      files: [{ path: "index.html", content: "new" }],
      publicFiles: [],
    });
    expect(await fileSystem.listFiles("site/dist")).toEqual(["index.html"]);
    expect(await fileSystem.readText("site/dist/index.html")).toBe("new");
  });

  it("refuses an output folder that would remove the site's own files, and changes nothing", async () => {
    const fileSystem = new MemoryFileSystem({ "site/content/index.md": "# Home" });
    const result = await writeSite(fileSystem, {
      siteFolder: "site",
      outputFolder: "site/content",
      files: [{ path: "index.html", content: "" }],
      publicFiles: [],
    });
    expect(result).toEqual({ ok: false, error: outputFolderProblem("site", "site/content") });
    expect(await fileSystem.listFiles("site")).toEqual(["content/index.md"]);
  });
});

it("a site folder goes through buildSite into the output folder", async () => {
  const plainTheme = Object.fromEntries(
    Object.values(TEMPLATES).map((name) => [`site/theme/${name}`, "<h1>{{ page.title }}</h1>"]),
  );
  const fileSystem = new MemoryFileSystem({
    ...plainTheme,
    "site/content/blog/2026-11-17-hello.md": "---\ntitle: Hello\ndate: 2026-11-17\n---\n",
    "site/public/images/me.png": PICTURE,
  });

  const { content, templates, publicFiles } = await readSiteFolder(fileSystem, "site");
  const built = buildSite({ content, templates, publicFiles });
  if (!built.ok) throw new Error("the site should build");
  await writeSite(fileSystem, {
    siteFolder: "site",
    outputFolder: "site/dist",
    files: built.value.files,
    publicFiles,
  });

  expect(await fileSystem.listFiles("site/dist")).toEqual([
    "404.html",
    "blog/hello/index.html",
    "blog/index.html",
    "images/me.png",
    "index.html",
  ]);
  expect(await fileSystem.readText("site/dist/blog/hello/index.html")).toBe("<h1>Hello</h1>");
});
