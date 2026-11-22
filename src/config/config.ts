import type { ThemeSettings } from "../core/index.ts";
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
  /** The settings of the default theme: colors, font, width and layout. */
  readonly theme?: ThemeSettings;
  /** Write `llms.txt` and a Markdown copy of each page, for AI tools. Defaults to `false`. */
  readonly llms?: boolean;
}

export interface SiteSettings {
  readonly title?: string;
  /** The full address, such as `https://example.com`. The feed and the sitemap need it. */
  readonly url?: string;
  readonly description?: string;
  readonly author?: string | Author;
  /** A GitHub user name, shown by the default theme as an icon link, as are the profiles below. */
  readonly github?: string;
  /** A GitLab user name. */
  readonly gitlab?: string;
  /** A Codeberg user name. */
  readonly codeberg?: string;
  /** The whole address of a Mastodon profile, such as `https://mastodon.social/@ada`. */
  readonly mastodon?: string;
  /** A Bluesky handle, such as `ada.example.com`. */
  readonly bluesky?: string;
  /** The name in the address of a LinkedIn profile. */
  readonly linkedin?: string;
  /** An email address. */
  readonly email?: string;
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
