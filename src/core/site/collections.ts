/** Groups the entries into the lists that templates show, each in its own order. */
import type { Diagnostic } from "../../diagnostics/index.ts";
import type { ContentType } from "../../frontmatter/index.ts";
import type { ContentEntry, EntryOf } from "../content/entries.ts";
import { slugify } from "../content/slugs.ts";
import { CoreCodes } from "../diagnostic-codes.ts";
import { problem, startOf } from "../problems.ts";
import { compareDates, compareOrder, compareStrings, compareText } from "./order.ts";
import type { Tag } from "./routes.ts";

type Post = EntryOf<"post">;

export interface Collections {
  /** Newest first. */
  readonly posts: readonly Post[];
  /** Featured first, then by `order`, then by title. */
  readonly projects: readonly EntryOf<"project">[];
  /** Newest first. */
  readonly talks: readonly EntryOf<"talk">[];
  /** By `order`, then the newest start first. */
  readonly experience: readonly EntryOf<"experience">[];
  readonly education: readonly EntryOf<"education">[];
  /** By URL, without the home page. */
  readonly pages: readonly EntryOf<"page">[];
  /** By name. */
  readonly tags: readonly Tag[];
}

const HOME_PAGE = "index.md";

function ofType<Type extends ContentType>(
  entries: readonly ContentEntry[],
  type: Type,
): EntryOf<Type>[] {
  return entries.filter((entry): entry is EntryOf<Type> => entry.type === type);
}

export function isDraft(entry: ContentEntry): boolean {
  return "draft" in entry.fields && entry.fields.draft;
}

const byNewestPost = (first: Post, second: Post) =>
  compareDates(second.fields.date, first.fields.date) ||
  compareStrings(first.url ?? "", second.url ?? "");

const byTimeline = <Entry extends EntryOf<"experience"> | EntryOf<"education">>(
  first: Entry,
  second: Entry,
) =>
  compareOrder(first.fields.order, second.fields.order) ||
  compareDates(second.fields.start, first.fields.start) ||
  compareStrings(first.file, second.file);

class TagCollector {
  readonly #groups = new Map<string, { spellings: Map<string, Post[]>; posts: Set<Post> }>();
  readonly #problems: Diagnostic[] = [];

  /** Posts are added newest first, so each tag lists its posts in that order. */
  add(post: Post): void {
    for (const name of new Set(post.fields.tags)) {
      const slug = slugify(name);
      if (slug === "") {
        this.#problems.push(
          problem(
            CoreCodes.tagWithoutUrl,
            `the tag "${name}" has nothing to use in a URL`,
            startOf(post.urlSpan.file),
            "use a tag with letters or digits from a to z or 0 to 9",
          ),
        );
        continue;
      }
      const group = this.#groups.get(slug) ?? { spellings: new Map(), posts: new Set() };
      this.#groups.set(slug, group);
      group.posts.add(post);
      group.spellings.set(name, [...(group.spellings.get(name) ?? []), post]);
    }
  }

  collect(): { readonly tags: Tag[]; readonly problems: readonly Diagnostic[] } {
    const tags = [...this.#groups].map(([slug, { spellings, posts }]): Tag => {
      const url = `/tags/${slug}/`;
      const [name = slug] = [...spellings.keys()].toSorted(
        (first, second) =>
          (spellings.get(second)?.length ?? 0) - (spellings.get(first)?.length ?? 0) ||
          compareStrings(first, second),
      );
      for (const [spelling, used] of spellings) {
        if (spelling !== name) this.#warnAboutSpelling(spelling, name, url, used);
      }
      return { name, slug, url, posts: [...posts] };
    });
    return {
      tags: tags.toSorted(
        (first, second) =>
          compareText(first.name, second.name) || compareStrings(first.slug, second.slug),
      ),
      problems: this.#problems,
    };
  }

  #warnAboutSpelling(spelling: string, name: string, url: string, used: readonly Post[]): void {
    const [first] = used.map((post) => post.urlSpan.file).toSorted(compareStrings);
    this.#problems.push(
      problem(
        CoreCodes.tagSpelling,
        `the tag "${spelling}" is listed as "${name}", because both have the URL ${url}`,
        startOf(first ?? ""),
        "write the tag the same way in every post",
        "warning",
      ),
    );
  }
}

export function collect(
  entries: readonly ContentEntry[],
  includeDrafts: boolean,
): { readonly collections: Collections; readonly problems: readonly Diagnostic[] } {
  const published = includeDrafts ? entries : entries.filter((entry) => !isDraft(entry));
  const posts = ofType(published, "post").toSorted(byNewestPost);
  const tags = new TagCollector();
  for (const post of posts) tags.add(post);
  const collected = tags.collect();

  return {
    collections: {
      posts,
      projects: ofType(published, "project").toSorted(
        (first, second) =>
          Number(second.fields.featured) - Number(first.fields.featured) ||
          compareOrder(first.fields.order, second.fields.order) ||
          compareText(first.fields.title, second.fields.title) ||
          compareStrings(first.file, second.file),
      ),
      talks: ofType(published, "talk").toSorted(
        (first, second) =>
          compareDates(second.fields.date, first.fields.date) ||
          compareStrings(first.file, second.file),
      ),
      experience: ofType(published, "experience").toSorted(byTimeline),
      education: ofType(published, "education").toSorted(byTimeline),
      pages: ofType(published, "page")
        .filter((page) => page.file !== HOME_PAGE)
        .toSorted((first, second) => compareStrings(first.url ?? "", second.url ?? "")),
      tags: collected.tags,
    },
    problems: collected.problems,
  };
}
