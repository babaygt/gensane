/** Decides whether the site gets a feed and a sitemap, and writes them. */
import type { Diagnostic } from "../../diagnostics/index.ts";
import type { ContentEntry } from "../content/entries.ts";
import { CoreCodes } from "../diagnostic-codes.ts";
import { problem, startOf } from "../problems.ts";
import type { SiteGraph } from "../site/site-graph.ts";
import { atomFeed } from "./atom.ts";
import { siteAddressOf } from "./site-address.ts";
import { sitemap } from "./sitemap.ts";

interface FeedFiles {
  readonly files: readonly { readonly path: string; readonly content: string }[];
  readonly problems: readonly Diagnostic[];
}

function isDraft(entry: ContentEntry | undefined): boolean {
  return entry !== undefined && "draft" in entry.fields && entry.fields.draft;
}

function textOf(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** `author` can be a name, or a group of fields with a `name`. */
function authorOf(author: unknown): string | undefined {
  if (typeof author === "object" && author !== null && "name" in author) return textOf(author.name);
  return textOf(author);
}

export function feedFiles(
  site: Readonly<Record<string, unknown>>,
  graph: SiteGraph,
  configFile: string,
): FeedFiles {
  const { url, title: siteTitle, description, author } = site;
  if (url === undefined) {
    const warning = problem(
      CoreCodes.noSiteUrl,
      "the feed and the sitemap are left out, because they need the address of the site",
      startOf(configFile),
      'add `site: { url: "https://example.com" }` to the config',
      "warning",
    );
    return { files: [], problems: [warning] };
  }
  const address = siteAddressOf(url);
  if (address === undefined) {
    const error = problem(
      CoreCodes.invalidSiteUrl,
      `"site.url" must be the full address of the site, such as "https://example.com", but it is ${JSON.stringify(url)}`,
      startOf(configFile),
      "use an address that starts with https:// or http://, without ? or #",
    );
    return { files: [], problems: [error] };
  }

  const routes = graph.routes.filter((route) => !("page" in route && isDraft(route.page)));
  const files = [{ path: "sitemap.xml", content: sitemap(routes, address) }];
  const posts = graph.collections.posts.filter((post) => !isDraft(post));
  if (posts.length > 0) {
    const title = textOf(siteTitle) ?? address.host;
    const details = { title, subtitle: textOf(description), author: authorOf(author) ?? title };
    files.push({ path: "feed.xml", content: atomFeed(posts, details, address) });
  }
  return { files, problems: [] };
}
