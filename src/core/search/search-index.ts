/** The index of the site that the search page looks words up in, without a server. */
import type { ContentEntry } from "../content/entries.ts";
import { textOf, wordsOf } from "./words.ts";

/** Where the index is written in the site. */
export const SEARCH_INDEX_PATH = "search-index.json";

/** One page that search can find. */
export interface SearchDocument {
  readonly title: string;
  readonly url: string;
  readonly description?: string;
  readonly tags: readonly string[];
  /** For newest first, when two results are as good. */
  readonly date?: string;
  /** The words of the text, without the title, tags and description, which are matched on their own. */
  readonly words: readonly string[];
}

function isDraft(entry: ContentEntry): boolean {
  return "draft" in entry.fields && entry.fields.draft;
}

/** Talks have no page of their own, so they lead to the list of talks. */
function documentOf(entry: ContentEntry): SearchDocument | undefined {
  const words = wordsOf(textOf(entry.html));
  switch (entry.type) {
    case "post": {
      const { title, description, tags, date } = entry.fields;
      return {
        title,
        url: entry.url ?? "",
        ...(description === undefined ? {} : { description }),
        tags,
        date: date.text,
        words,
      };
    }
    case "project": {
      const { title, description, stack } = entry.fields;
      return {
        title,
        url: entry.url ?? "",
        ...(description === undefined ? {} : { description }),
        tags: stack,
        words,
      };
    }
    case "page": {
      const { title, description } = entry.fields;
      return {
        title,
        url: entry.url ?? "",
        ...(description === undefined ? {} : { description }),
        tags: [],
        words,
      };
    }
    case "talk": {
      const { title, description, event, location, date } = entry.fields;
      const about = wordsOf([event, location ?? ""].join(" "));
      return {
        title,
        url: "/talks/",
        ...(description === undefined ? {} : { description }),
        tags: [],
        date: date.text,
        words: [...new Set([...about, ...words])],
      };
    }
    case "experience":
    case "education":
      return undefined;
  }
}

/** Every post, project, talk and page that isn't a draft, even when drafts are shown. */
export function searchDocuments(entries: readonly ContentEntry[]): SearchDocument[] {
  return entries.flatMap((entry) => {
    if (isDraft(entry)) return [];
    const document = documentOf(entry);
    return document === undefined ? [] : [document];
  });
}

export function searchIndex(entries: readonly ContentEntry[]): string {
  return `${JSON.stringify({ documents: searchDocuments(entries) })}\n`;
}
