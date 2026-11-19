import type { MarkdownOptions } from "../markdown/index.ts";
import type { TemplateFilter } from "../template/index.ts";

/** The settings of a site, as written in `gensane.config.ts`. Every setting is optional. */
export interface GensaneConfig {
  /** What every template sees as `site`. */
  readonly site?: SiteSettings;
  /** How many posts a list shows on one page. Defaults to 10. */
  readonly perPage?: number;
  readonly markdown?: MarkdownOptions;
  /** Extra filters for templates, by the name templates use. */
  readonly filters?: Readonly<Record<string, TemplateFilter>>;
}

export interface SiteSettings {
  readonly title?: string;
  /** The full address, such as `https://example.com`. The feed and the sitemap need it. */
  readonly url?: string;
  readonly description?: string;
  readonly author?: string | Author;
  /** Any other setting, for the templates. */
  readonly [setting: string]: unknown;
}

export interface Author {
  readonly name: string;
  readonly [field: string]: unknown;
}

/** Gives the editor the types of the settings. It returns the config as it is. */
export function defineConfig(config: GensaneConfig): GensaneConfig {
  return config;
}
