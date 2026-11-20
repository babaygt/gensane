/**
 * The core of gensane: everything that decides what a site is. It only works on data, so the
 * program that reads and writes files can stay small.
 */
export { CoreCodes } from "./diagnostic-codes.ts";
export type { ContentEntry } from "./content/entries.ts";
export { type LoadOptions, type LoadedContent, loadContent } from "./content/load-content.ts";
export type { EntryOf } from "./content/entries.ts";
export {
  NEW_ENTRY_TYPES,
  type NewEntry,
  type NewEntryDetails,
  newEntry,
} from "./content/new-entry.ts";
export { isValidSlug, slugify } from "./content/slugs.ts";
export type { Collections } from "./site/collections.ts";
export type { Pagination, Route, RouteKind, Tag } from "./site/routes.ts";
export { TEMPLATES } from "./site/routes.ts";
export {
  type BuiltGraph,
  type GraphOptions,
  type SiteGraph,
  buildSiteGraph,
} from "./site/site-graph.ts";
export {
  type BuiltSite,
  type OutputFile,
  type SiteConfig,
  type SiteInput,
  buildSite,
} from "./build/build-site.ts";
