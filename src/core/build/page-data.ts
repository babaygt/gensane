/** Turns entries and routes into the variables that templates see. */
import { SafeHtml } from "../../template/index.ts";
import type { ContentEntry } from "../content/entries.ts";
import type { Collections } from "../site/collections.ts";
import type { Theme } from "../theme/theme-settings.ts";
import type { Pagination, Route, RouteKind, Tag } from "../site/routes.ts";
import { type SectionFolder, type SectionItem, foldersAbove } from "../site/sections.ts";

export type TemplateData = Readonly<Record<string, unknown>>;

/** The title of a page that has no content file of its own. */
export const DEFAULT_TITLES: Readonly<Partial<Record<RouteKind, string>>> = {
  home: "Home",
  blog: "Blog",
  tags: "Tags",
  projects: "Projects",
  talks: "Talks",
  search: "Search",
  about: "About",
  "not-found": "Page not found",
};

/** The pages a site's menu leads to, in this order, when the site has them. */
const NAVIGATION: readonly RouteKind[] = ["blog", "projects", "talks", "about"];

export interface VariableSources {
  readonly site: TemplateData;
  readonly theme: Theme;
  readonly collections: Collections;
  readonly routes: readonly Route[];
  /** The address of the feed, when the site has one. */
  readonly feed: string | undefined;
  /** The address of the site's icon, when it has one. */
  readonly favicon: string | undefined;
  /** The day of the build, as `YYYY-MM-DD`, when it is known. */
  readonly today: string | undefined;
}

/**
 * Converts each entry once, so the same post is the same value in `collections.posts`,
 * in `pagination.items` and as `page`.
 */
/** `2026-11-21` as templates see a date from frontmatter, so the `date` filter can write it. */
function dateOf(day: string): TemplateData {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return { text: day, year, month, day: date };
}

export class TemplateVariables {
  readonly #site: TemplateData;
  readonly #theme: TemplateData;
  readonly #navigation: readonly TemplateData[];
  readonly #feed: string | undefined;
  readonly #search: string | undefined;
  readonly #favicon: string | undefined;
  readonly #today: TemplateData | undefined;
  readonly #pages = new Map<ContentEntry, TemplateData>();
  readonly #collections: TemplateData;

  constructor({ site, theme, collections, routes, feed, favicon, today }: VariableSources) {
    this.#favicon = favicon;
    this.#today = today === undefined ? undefined : dateOf(today);
    this.#search = routes.find((route) => route.kind === "search")?.url;
    this.#site = site;
    this.#theme = { ...theme };
    this.#feed = feed;
    this.#navigation = NAVIGATION.flatMap((kind) => {
      const route = routes.find((found) => found.kind === kind);
      return route === undefined ? [] : [{ title: DEFAULT_TITLES[kind], url: route.url }];
    });
    this.#collections = {
      posts: collections.posts.map((entry) => this.#page(entry)),
      projects: collections.projects.map((entry) => this.#page(entry)),
      talks: collections.talks.map((entry) => this.#page(entry)),
      experience: collections.experience.map((entry) => this.#page(entry)),
      education: collections.education.map((entry) => this.#page(entry)),
      pages: collections.pages.map((entry) => this.#page(entry)),
      tags: collections.tags.map((tag) => this.#tag(tag)),
    };
  }

  /** Every variable is always there, so `{% if previous %}` works on every page. */
  of(route: Route): TemplateData {
    return {
      site: this.#site,
      theme: this.#theme,
      navigation: this.#navigation,
      feed: this.#feed,
      search: this.#search,
      favicon: this.#favicon,
      today: this.#today,
      collections: this.#collections,
      page: this.#pageOf(route),
      pagination: "pagination" in route ? this.#pagination(route.pagination) : undefined,
      previous:
        route.kind === "post" || route.kind === "page"
          ? this.#optionalPage(route.previous)
          : undefined,
      next:
        route.kind === "post" || route.kind === "page" ? this.#optionalPage(route.next) : undefined,
      tag: route.kind === "tag" ? this.#tag(route.tag) : undefined,
      section:
        route.kind === "page" && route.section !== undefined
          ? this.#section(route.section, route.page)
          : undefined,
      breadcrumbs:
        route.kind === "page" && route.section !== undefined
          ? foldersAbove(route.section, route.page).map((folder) => ({
              title: folder.title,
              url: folder.page?.url,
            }))
          : undefined,
    };
  }

  #pageOf(route: Route): TemplateData {
    if ("page" in route && route.page !== undefined) return this.#page(route.page);
    const title = route.kind === "tag" ? route.tag.name : DEFAULT_TITLES[route.kind];
    return { title, url: route.url };
  }

  /** The tree a sidebar shows: every folder and page, with the current page and the folders it is in marked. */
  #section(folder: SectionFolder, current: ContentEntry): TemplateData {
    const item = (entry: SectionItem): TemplateData => {
      if (entry.kind === "page") {
        return {
          title: entry.page.fields.title,
          url: entry.page.url,
          current: entry.page === current,
        };
      }
      const inner = entry.items.map(item);
      return {
        title: entry.title,
        url: entry.page?.url,
        current: entry.page === current,
        open:
          entry.page === current ||
          inner.some((child) => child["current"] === true || child["open"] === true),
        items: inner,
      };
    };
    return item(folder);
  }

  #optionalPage(entry: ContentEntry | undefined): TemplateData | undefined {
    return entry === undefined ? undefined : this.#page(entry);
  }

  /** The fields of the entry, its custom fields, and what was worked out from its body. */
  #page(entry: ContentEntry): TemplateData {
    const known = this.#pages.get(entry);
    if (known !== undefined) return known;
    const page: TemplateData = {
      ...entry.extra,
      ...entry.fields,
      type: entry.type,
      url: entry.url,
      slug: entry.slug,
      html: new SafeHtml(entry.html),
      excerpt: new SafeHtml(entry.excerpt),
      toc: entry.tableOfContents,
      readingTime: entry.readingTime,
    };
    this.#pages.set(entry, page);
    return page;
  }

  #tag(tag: Tag): TemplateData {
    return {
      name: tag.name,
      slug: tag.slug,
      url: tag.url,
      count: tag.posts.length,
      posts: tag.posts.map((entry) => this.#page(entry)),
    };
  }

  #pagination(pagination: Pagination<ContentEntry>): TemplateData {
    return { ...pagination, items: pagination.items.map((entry) => this.#page(entry)) };
  }
}
