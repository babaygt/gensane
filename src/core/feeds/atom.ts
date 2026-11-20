/** An Atom feed of the newest posts, with their full content: https://www.rfc-editor.org/rfc/rfc4287 */
import type { ContentDate } from "../../frontmatter/index.ts";
import type { EntryOf } from "../content/entries.ts";
import { compareDates } from "../site/order.ts";
import { dateTime } from "./feed-dates.ts";
import { withBasePath } from "../build/base-path.ts";
import { type SiteAddress, absoluteUrl } from "./site-address.ts";
import { escapeXml } from "./xml.ts";

export const FEED_SIZE = 20;

type Post = EntryOf<"post">;

export interface FeedDetails {
  readonly title: string;
  readonly subtitle: string | undefined;
  readonly author: string;
}

function lastChange(post: Post): ContentDate {
  return post.fields.updated ?? post.fields.date;
}

function entry(post: Post, address: SiteAddress): string[] {
  const url = absoluteUrl(address, post.url ?? "/");
  const { title, date, description, tags } = post.fields;
  return [
    "  <entry>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link href="${escapeXml(url)}"/>`,
    `    <id>${escapeXml(url)}</id>`,
    `    <published>${dateTime(date)}</published>`,
    `    <updated>${dateTime(lastChange(post))}</updated>`,
    ...(description === undefined ? [] : [`    <summary>${escapeXml(description)}</summary>`]),
    `    <content type="html">${escapeXml(withBasePath(post.html, address.path))}</content>`,
    ...tags.map((tag) => `    <category term="${escapeXml(tag)}"/>`),
    "  </entry>",
  ];
}

/** The posts must be newest first. */
export function atomFeed(
  posts: readonly Post[],
  details: FeedDetails,
  address: SiteAddress,
): string {
  const newest = posts.slice(0, FEED_SIZE);
  const changes = newest.map(lastChange).toSorted(compareDates);
  const updated = changes.at(-1);
  const home = absoluteUrl(address, "/");
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${escapeXml(details.title)}</title>`,
    ...(details.subtitle === undefined
      ? []
      : [`  <subtitle>${escapeXml(details.subtitle)}</subtitle>`]),
    `  <link href="${escapeXml(home)}"/>`,
    `  <link rel="self" href="${escapeXml(absoluteUrl(address, "/feed.xml"))}"/>`,
    `  <id>${escapeXml(home)}</id>`,
    ...(updated === undefined ? [] : [`  <updated>${dateTime(updated)}</updated>`]),
    "  <author>",
    `    <name>${escapeXml(details.author)}</name>`,
    "  </author>",
    ...newest.flatMap((post) => entry(post, address)),
    "</feed>",
    "",
  ].join("\n");
}
