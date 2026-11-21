import { describe, expect, it } from "vitest";
import { type Answers, SECTIONS, starterSite } from "./starter-site.ts";

const answers: Answers = {
  title: "Ada's notes",
  author: "Ada",
  url: "https://example.com",
  sections: SECTIONS,
  palette: "nord",
  deploy: "none",
};
const details = { today: "2026-11-20", version: "1.2.3", folderName: "my-site" };

describe("starterSite", () => {
  it("writes the config with every answer", () => {
    expect(starterSite(answers, details)["gensane.config.ts"]).toBe(
      [
        'import { defineConfig } from "gensane";',
        "",
        "export default defineConfig({",
        "  site: {",
        '    title: "Ada\'s notes",',
        '    url: "https://example.com",',
        '    author: "Ada",',
        "  },",
        "  theme: {",
        '    palette: "nord",',
        "  },",
        "});",
        "",
      ].join("\n"),
    );
  });

  it("leaves out the author, and shows where the address goes, when they aren't known", () => {
    const config = starterSite({ ...answers, author: "", url: "" }, details)["gensane.config.ts"];
    expect(config).not.toContain("author");
    expect(config).toContain('    // url: "https://example.com", the address of the site');
  });

  it("keeps quotes and backslashes in a title as they are", () => {
    const config = starterSite({ ...answers, title: 'The "best" \\ site' }, details)[
      "gensane.config.ts"
    ];
    expect(config).toContain('title: "The \\"best\\" \\\\ site",');
  });

  it("writes a file for each part chosen, and only for those", () => {
    expect(Object.keys(starterSite(answers, details)).toSorted()).toEqual([
      ".gitignore",
      "content/blog/2026-11-20-hello-world.md",
      "content/index.md",
      "content/pages/about.md",
      "content/projects/first-project.md",
      "content/talks/first-talk.md",
      "gensane.config.ts",
      "package.json",
    ]);
    expect(
      Object.keys(starterSite({ ...answers, sections: ["talks"] }, details)).toSorted(),
    ).toEqual([
      ".gitignore",
      "content/index.md",
      "content/talks/first-talk.md",
      "gensane.config.ts",
      "package.json",
    ]);
  });

  it("depends on this version of gensane, with scripts for every command a site needs", () => {
    expect(JSON.parse(starterSite(answers, details)["package.json"] ?? "")).toEqual({
      name: "my-site",
      private: true,
      type: "module",
      scripts: { dev: "gensane dev", build: "gensane build", check: "gensane check" },
      devDependencies: { gensane: "^1.2.3" },
    });
  });

  it.each([
    ["My Site", "my-site"],
    ["notes 2026!", "notes-2026"],
    ["Şirin", "irin"],
    ["!!!", "my-site"],
  ])("names the package of the folder %j as %j", (folderName, name) => {
    const json = starterSite(answers, { ...details, folderName })["package.json"] ?? "";
    expect(JSON.parse(json).name).toBe(name);
  });

  it("adds the files of the host, under the name of the folder", () => {
    const files = starterSite(
      { ...answers, deploy: "cloudflare" },
      { ...details, folderName: "My Notes" },
    );
    expect(files["wrangler.jsonc"]).toContain('"name": "my-notes"');
    expect(files[".gitignore"]).toBe("dist/\nnode_modules/\n.cloudflare/\n.wrangler/\n");
    expect(Object.keys(starterSite(answers, details))).not.toContain("wrangler.jsonc");
  });

  it("keeps the built site, the packages and the Cloudflare output out of git", () => {
    expect(starterSite(answers, details)[".gitignore"]).toBe(
      "dist/\nnode_modules/\n.cloudflare/\n",
    );
  });
});
