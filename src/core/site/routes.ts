import type { EntryOf } from "../content/entries.ts";

type Post = EntryOf<"post">;

export interface Tag {
  readonly name: string;
  readonly slug: string;
  readonly url: string;
  /** Newest first. */
  readonly posts: readonly Post[];
}

/** One page of a list that is split over several pages. */
export interface Pagination<Item> {
  readonly items: readonly Item[];
  /** Starting at 1. */
  readonly current: number;
  readonly total: number;
  readonly previousUrl: string | undefined;
  readonly nextUrl: string | undefined;
}

/** Every page the site has, and what its template needs. */
export type Route =
  | { readonly kind: "home"; readonly url: string; readonly page: EntryOf<"page"> | undefined }
  | {
      readonly kind: "post";
      readonly url: string;
      readonly page: Post;
      /** The post before this one in time. */
      readonly previous: Post | undefined;
      readonly next: Post | undefined;
    }
  | { readonly kind: "blog"; readonly url: string; readonly pagination: Pagination<Post> }
  | {
      readonly kind: "tag";
      readonly url: string;
      readonly tag: Tag;
      readonly pagination: Pagination<Post>;
    }
  | { readonly kind: "tags"; readonly url: string }
  | { readonly kind: "project"; readonly url: string; readonly page: EntryOf<"project"> }
  | { readonly kind: "projects"; readonly url: string }
  | { readonly kind: "talks"; readonly url: string }
  | { readonly kind: "about"; readonly url: string; readonly page: EntryOf<"page"> | undefined }
  | { readonly kind: "page"; readonly url: string; readonly page: EntryOf<"page"> }
  | { readonly kind: "not-found"; readonly url: string };

export type RouteKind = Route["kind"];

/** The template that renders each kind of page. */
export const TEMPLATES: Readonly<Record<RouteKind, string>> = {
  home: "home.html",
  post: "post.html",
  blog: "blog.html",
  tag: "tag.html",
  tags: "tags.html",
  project: "project.html",
  projects: "projects.html",
  talks: "talks.html",
  about: "about.html",
  page: "page.html",
  "not-found": "404.html",
};
