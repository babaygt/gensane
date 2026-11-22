/**
 * Works out every page of the site from its entries: the lists, the tags, previous and next,
 * and the pages that lists are split into. Rendering then only has to follow the routes.
 */
import {
  type Diagnostic,
  InternalError,
  type Result,
  err,
  hasErrors,
  ok,
} from "../../diagnostics/index.ts";
import type { ContentEntry, EntryOf } from "../content/entries.ts";
import { CoreCodes } from "../diagnostic-codes.ts";
import { inFileOrder, problem } from "../problems.ts";
import { type Collections, collect } from "./collections.ts";
import { compareStrings } from "./order.ts";
import { pageUrl, paginate } from "./pagination.ts";
import type { Route } from "./routes.ts";
import { foldersOf, readingOrder, sectionsOf } from "./sections.ts";

export interface GraphOptions {
  /** How many posts a list shows on one page. Defaults to 10. */
  readonly perPage?: number;
  /** Keep drafts, to preview them. Defaults to `false`. */
  readonly drafts?: boolean;
}

export interface SiteGraph {
  readonly collections: Collections;
  /** Sorted by URL. */
  readonly routes: readonly Route[];
}

export interface BuiltGraph {
  readonly graph: SiteGraph;
  readonly warnings: readonly Diagnostic[];
}

const DEFAULT_PER_PAGE = 10;
const ABOUT_PAGE = "pages/about.md";

/** Pages that the site makes itself when it has something to list. */
const GENERATED_PAGES: ReadonlyMap<string, string> = new Map([
  ["/blog/", "the list of posts"],
  ["/projects/", "the list of projects"],
  ["/talks/", "the list of talks"],
  ["/tags/", "the list of tags"],
  ["/about/", "the about page"],
  ["/search/", "the search page"],
]);

function listRoutes(collections: Collections, perPage: number): Route[] {
  const { posts, tags, projects, talks } = collections;
  const routes: Route[] = posts.map((page, index) => ({
    kind: "post",
    url: page.url ?? "",
    page,
    previous: posts[index + 1],
    next: posts[index - 1],
  }));
  for (const pagination of paginate(posts, perPage, "/blog/")) {
    routes.push({ kind: "blog", url: pageUrl("/blog/", pagination.current), pagination });
  }
  if (tags.length > 0) routes.push({ kind: "tags", url: "/tags/" });
  for (const tag of tags) {
    for (const pagination of paginate(tag.posts, perPage, tag.url)) {
      routes.push({ kind: "tag", url: pageUrl(tag.url, pagination.current), tag, pagination });
    }
  }
  for (const page of projects) routes.push({ kind: "project", url: page.url ?? "", page });
  if (projects.length > 0) routes.push({ kind: "projects", url: "/projects/" });
  if (talks.length > 0) routes.push({ kind: "talks", url: "/talks/" });
  // Search finds posts, projects, talks and pages, so it only has a page when there is one of them.
  if (posts.length + projects.length + talks.length + collections.pages.length > 0) {
    routes.push({ kind: "search", url: "/search/" });
  }
  return routes;
}

export function buildSiteGraph(
  entries: readonly ContentEntry[],
  options: GraphOptions = {},
): Result<BuiltGraph, readonly Diagnostic[]> {
  const perPage = options.perPage ?? DEFAULT_PER_PAGE;
  if (!Number.isInteger(perPage) || perPage < 1) {
    throw new InternalError(`perPage must be a whole number of at least 1, not ${perPage}`);
  }
  const includeDrafts = options.drafts ?? false;
  const { collections, problems } = collect(entries, includeDrafts);
  const home = homePageOf(entries, includeDrafts);
  const aboutPage = collections.pages.find((page) => page.file === ABOUT_PAGE);
  const hasAbout =
    aboutPage !== undefined ||
    collections.experience.length > 0 ||
    collections.education.length > 0;

  const routes: Route[] = [
    { kind: "home", url: "/", page: home },
    { kind: "not-found", url: "/404.html" },
    ...listRoutes(collections, perPage),
  ];
  if (hasAbout) routes.push({ kind: "about", url: "/about/", page: aboutPage });

  const taken = new Set(routes.map((route) => route.url));
  const clashes: Diagnostic[] = [];
  const sections = sectionsOf(collections.pages);
  for (const page of collections.pages) {
    if (page === aboutPage) continue;
    const url = page.url ?? "";
    if (!taken.has(url)) {
      const section = sections.get(foldersOf(page)[0] ?? "");
      const order = section === undefined ? [] : readingOrder(section);
      const place = order.indexOf(page);
      routes.push({
        kind: "page",
        url,
        page,
        section,
        previous: place > 0 ? order[place - 1] : undefined,
        next: place === -1 ? undefined : order[place + 1],
      });
      continue;
    }
    clashes.push(
      problem(
        CoreCodes.reservedUrl,
        `${url} is ${GENERATED_PAGES.get(url) ?? "already a page"}, so "${page.urlSpan.file}" can't use it`,
        page.urlSpan,
        "give the page another file name, or a `slug:`",
      ),
    );
  }

  const sorted = inFileOrder([...problems, ...clashes]);
  if (hasErrors(sorted)) return err(sorted);
  const graph = {
    collections,
    routes: routes.toSorted((first, second) => compareStrings(first.url, second.url)),
  };
  return ok({ graph, warnings: sorted });
}

function homePageOf(
  entries: readonly ContentEntry[],
  includeDrafts: boolean,
): EntryOf<"page"> | undefined {
  const home = entries.find(
    (entry): entry is EntryOf<"page"> => entry.type === "page" && entry.file === "index.md",
  );
  return home === undefined || (home.fields.draft && !includeDrafts) ? undefined : home;
}
