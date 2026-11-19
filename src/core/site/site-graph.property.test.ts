// Property-based tests: fast-check generates random sets of posts, and these rules must hold for all of them.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { slugify } from "../content/slugs.ts";
import { type Route, type SiteGraph, buildSiteGraph } from "../index.ts";
import { loaded } from "../test-helpers.ts";

interface GeneratedPost {
  readonly month: number;
  readonly day: number;
  readonly tags: readonly string[];
  readonly draft: boolean;
}

const generatedPost = fc.record({
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
  tags: fc.subarray(["testing", "Testing", "compilers", "type script", "Type-Script"]),
  draft: fc.boolean(),
});

const site = fc.record({
  posts: fc.array(generatedPost, { maxLength: 30 }),
  perPage: fc.integer({ min: 1, max: 6 }),
});

function files(posts: readonly GeneratedPost[]): Record<string, string> {
  return Object.fromEntries(
    posts.map((post, index) => {
      const date = `2026-${String(post.month).padStart(2, "0")}-${String(post.day).padStart(2, "0")}`;
      const tags = post.tags.length === 0 ? "" : `tags: [${post.tags.join(", ")}]\n`;
      const draft = post.draft ? "draft: true\n" : "";
      return [`blog/p${index}.md`, `---\ntitle: P${index}\ndate: ${date}\n${tags}${draft}---\n`];
    }),
  );
}

function graphOf(posts: readonly GeneratedPost[], perPage: number): SiteGraph {
  const result = buildSiteGraph(loaded(files(posts)), { perPage });
  if (!result.ok) throw new Error(result.error[0]?.message);
  return result.value.graph;
}

function ofKind<Kind extends Route["kind"]>(routes: readonly Route[], kind: Kind) {
  return routes.filter((route): route is Extract<Route, { kind: Kind }> => route.kind === kind);
}

describe("site properties", () => {
  it("shows every published post exactly once in the list, in order, and no drafts", () => {
    fc.assert(
      fc.property(site, ({ posts, perPage }) => {
        const graph = graphOf(posts, perPage);
        const listed = ofKind(graph.routes, "blog").flatMap((route) => route.pagination.items);
        expect(listed).toEqual(graph.collections.posts);
        expect(listed).toHaveLength(posts.filter((post) => !post.draft).length);
        expect(
          ofKind(graph.routes, "blog").every((route) => route.pagination.items.length <= perPage),
        ).toBe(true);
      }),
    );
  });

  it("lists exactly the posts with each tag on its pages", () => {
    fc.assert(
      fc.property(site, ({ posts, perPage }) => {
        const graph = graphOf(posts, perPage);
        for (const tag of graph.collections.tags) {
          const expected = graph.collections.posts.filter((post) =>
            post.fields.tags.some((name) => slugify(name) === tag.slug),
          );
          const listed = ofKind(graph.routes, "tag")
            .filter((route) => route.tag.slug === tag.slug)
            .flatMap((route) => route.pagination.items);
          expect(listed).toEqual(expected);
        }
      }),
    );
  });

  it("gives every page its own URL", () => {
    fc.assert(
      fc.property(site, ({ posts, perPage }) => {
        const urls = graphOf(posts, perPage).routes.map((route) => route.url);
        expect(new Set(urls).size).toBe(urls.length);
      }),
    );
  });

  it("links each post to its neighbours in the list, both ways", () => {
    fc.assert(
      fc.property(site, ({ posts, perPage }) => {
        const graph = graphOf(posts, perPage);
        const byUrl = new Map(ofKind(graph.routes, "post").map((route) => [route.url, route]));
        const newestFirst = graph.collections.posts.map((post) => byUrl.get(post.url ?? ""));
        expect(newestFirst.map((route) => route?.previous)).toEqual(
          graph.collections.posts.map((_, index) => graph.collections.posts[index + 1]),
        );
        expect(newestFirst.map((route) => route?.next)).toEqual(
          graph.collections.posts.map((_, index) => graph.collections.posts[index - 1]),
        );
      }),
    );
  });
});
