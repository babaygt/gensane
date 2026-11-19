/** Turns entries and routes into the variables that templates see. */
import { SafeHtml } from "../../template/index.ts";
import type { ContentEntry } from "../content/entries.ts";
import type { Collections } from "../site/collections.ts";
import type { Pagination, Route, RouteKind, Tag } from "../site/routes.ts";

export type TemplateData = Readonly<Record<string, unknown>>;

/** The title of a page that has no content file of its own. */
export const DEFAULT_TITLES: Readonly<Partial<Record<RouteKind, string>>> = {
  home: "Home",
  blog: "Blog",
  tags: "Tags",
  projects: "Projects",
  talks: "Talks",
  about: "About",
  "not-found": "Page not found",
};

/**
 * Converts each entry once, so the same post is the same value in `collections.posts`,
 * in `pagination.items` and as `page`.
 */
export class TemplateVariables {
  readonly #site: TemplateData;
  readonly #pages = new Map<ContentEntry, TemplateData>();
  readonly #collections: TemplateData;

  constructor(site: TemplateData, collections: Collections) {
    this.#site = site;
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
      collections: this.#collections,
      page: this.#pageOf(route),
      pagination: "pagination" in route ? this.#pagination(route.pagination) : undefined,
      previous: route.kind === "post" ? this.#optionalPage(route.previous) : undefined,
      next: route.kind === "post" ? this.#optionalPage(route.next) : undefined,
      tag: route.kind === "tag" ? this.#tag(route.tag) : undefined,
    };
  }

  #pageOf(route: Route): TemplateData {
    if ("page" in route && route.page !== undefined) return this.#page(route.page);
    const title = route.kind === "tag" ? route.tag.name : DEFAULT_TITLES[route.kind];
    return { title, url: route.url };
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
