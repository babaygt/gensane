// Property-based tests: fast-check generates random sites, and these rules must hold for all of them.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { TEMPLATES, buildSite, buildSiteGraph, loadContent } from "../index.ts";

const theme = Object.fromEntries(
  Object.values(TEMPLATES).map((name) => [
    name,
    "{{ page.title }} {{ page.url }} {{ collections.posts | length }}",
  ]),
);

const content = fc
  .array(
    fc.record({
      folder: fc.constantFrom("blog", "projects", "pages"),
      name: fc.stringMatching(/^[a-z]{1,6}$/),
      day: fc.integer({ min: 1, max: 28 }),
      tags: fc.subarray(["a", "b", "c"]),
    }),
    { maxLength: 15 },
  )
  .map((entries) =>
    Object.fromEntries(
      entries.map(({ folder, name, day, tags }) => {
        const date = folder === "blog" ? `date: 2026-01-${String(day).padStart(2, "0")}\n` : "";
        const tagLine = folder === "blog" && tags.length > 0 ? `tags: [${tags.join(", ")}]\n` : "";
        return [`${folder}/${name}.md`, `---\ntitle: ${name}\n${date}${tagLine}---\n`];
      }),
    ),
  )
  .filter((files) => {
    const pages = Object.keys(files).filter((path) => path.startsWith("pages/"));
    return !pages.some((path) =>
      ["blog", "projects", "tags", "talks", "about"].includes(path.slice(6, -3)),
    );
  });

describe("site properties", () => {
  it("builds the same files whatever order the files were read in", () => {
    const withShuffled = content.chain((files) =>
      fc
        .shuffledSubarray(Object.entries(files), { minLength: Object.keys(files).length })
        .map((entries) => [files, Object.fromEntries(entries)] as const),
    );
    fc.assert(
      fc.property(withShuffled, ([files, shuffled]) => {
        expect(buildSite({ content: shuffled, templates: theme })).toEqual(
          buildSite({ content: files, templates: theme }),
        );
      }),
    );
  });

  it("writes exactly one page for every route, the theme settings, and the search index when there is a search page", () => {
    fc.assert(
      fc.property(content, (files) => {
        const loaded = loadContent(files);
        const graph = loaded.ok ? buildSiteGraph(loaded.value.entries) : undefined;
        const built = buildSite({ content: files, templates: theme });
        const routes = graph?.ok ? graph.value.graph.routes : [];
        const paths = built.ok ? built.value.files.map((file) => file.path) : [];
        expect(paths.filter((path) => path.endsWith(".html"))).toHaveLength(routes.length);
        expect(paths).toContain("assets/settings.css");
        const searchPage = routes.some((route) => route.kind === "search");
        expect(paths.includes("search-index.json")).toBe(searchPage);
        expect(new Set(paths).size).toBe(paths.length);
      }),
    );
  });
});
