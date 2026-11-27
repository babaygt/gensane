/**
 * Builds a whole site from text: the content files and the templates go in, and the files to
 * write come out. Each step only runs when the steps before it had no errors, and the warnings of
 * every step are kept.
 */
import { type Diagnostic, type Result, err, hasErrors, ok } from "../../diagnostics/index.ts";
import { highlight } from "../../highlight/index.ts";
import type { MarkdownOptions } from "../../markdown/index.ts";
import { type TemplateFilter, compileTemplates, renderTemplate } from "../../template/index.ts";
import { loadContent } from "../content/load-content.ts";
import { CoreCodes } from "../diagnostic-codes.ts";
import { feedFiles } from "../feeds/feed-files.ts";
import { checkLinks } from "../links/check-links.ts";
import { inFileOrder, problem, startOf } from "../problems.ts";
import { compareStrings } from "../site/order.ts";
import { type Route, TEMPLATES } from "../site/routes.ts";
import { isDraft } from "../site/collections.ts";
import { buildSiteGraph } from "../site/site-graph.ts";
import { siteAddressOf } from "../feeds/site-address.ts";
import { withBasePath } from "./base-path.ts";
import { llmsFiles } from "../llms/llms-files.ts";
import { SEARCH_INDEX_PATH, searchIndex } from "../search/search-index.ts";
import { FAVICON_PATH, OWN_FAVICONS, faviconSvg, initialOf } from "../theme/favicon.ts";
import { THEME_CSS_PATH, themeCss } from "../theme/theme-css.ts";
import { type ThemeSettings, themeOf } from "../theme/theme-settings.ts";
import { outputPath } from "./output-paths.ts";
import { uncoloredCode } from "./uncolored-code.ts";
import { type TemplateData, TemplateVariables } from "./page-data.ts";

export interface SiteConfig {
  /** Settings that every template sees as `site`, such as the title. */
  readonly site?: TemplateData;
  /** How many posts a list shows on one page. Defaults to 10. */
  readonly perPage?: number;
  /** Show drafts, to preview them. Defaults to `false`. */
  readonly drafts?: boolean;
  /**
   * Leave links as they are written, even when `site.url` has a path, because the site is served at
   * `/`, as in `gensane dev`. Defaults to `false`.
   */
  readonly servedAtRoot?: boolean;
  readonly markdown?: MarkdownOptions;
  /** The settings of the default theme. */
  readonly theme?: ThemeSettings;
  /** Extra filters for templates. */
  readonly filters?: Readonly<Record<string, TemplateFilter>>;
  /** Write `llms.txt` and a Markdown copy of each page, for AI tools. Defaults to `false`. */
  readonly llms?: boolean;
  /** Where the content files are, for the paths in problems. Defaults to `content`. */
  readonly contentFolder?: string;
  /** The config file, for problems with the config. Defaults to `gensane.config.ts`. */
  readonly configFile?: string;
  /** The day of the build, as `YYYY-MM-DD`, which templates see as `today`. */
  readonly today?: string;
  /** The menu, in this order, instead of the one made from the pages the site has. */
  readonly nav?: readonly NavItem[];
  /** The services that count visits, which the default theme adds to every page. */
  readonly analytics?: Analytics;
}

/** The services that count visits, each by what its own snippet names the site with. */
export interface Analytics {
  /** The measurement ID of Google Analytics, such as `G-ABC123DEF4`. */
  readonly google?: string;
  /** The name of the site's script in Plausible's snippet, such as `pa-AbC123`. */
  readonly plausible?: string;
  /** The token in the snippet of Cloudflare's Web Analytics. */
  readonly cloudflare?: string;
}

/** One item of the menu: a page of the site, such as `/uses/`, or an address on another site. */
export interface NavItem {
  readonly title: string;
  readonly url: string;
}

export interface SiteInput {
  readonly config?: SiteConfig;
  /** Each content file by its path inside the content folder. */
  readonly content: Readonly<Record<string, string>>;
  /** Each template by its name, which `include` and `extends` use. */
  readonly templates: Readonly<Record<string, string>>;
  /** The paths of the files in the `public` folder, which are copied as they are. */
  readonly publicFiles?: readonly string[];
  /** The paths in the site of the files in the theme's `assets/` folder, which are copied as they are. */
  readonly themeAssets?: readonly string[];
  /** The site's own `head.html`, added to the `<head>` of every page as it is. */
  readonly head?: string;
}

export interface OutputFile {
  readonly path: string;
  readonly content: string;
}

export interface BuiltSite {
  /** Sorted by path. */
  readonly files: readonly OutputFile[];
  readonly warnings: readonly Diagnostic[];
  /** Warnings only `gensane check` shows: worth knowing, but too loud for every build. */
  readonly checkWarnings: readonly Diagnostic[];
}

/** A mistake in a template is the same on every page that uses it, so it is reported once. */
function withoutRepeats(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter(({ code, span }) => {
    const key = `${code} ${span.file} ${span.start.offset}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function finish(
  files: readonly OutputFile[],
  diagnostics: readonly Diagnostic[],
  checkWarnings: readonly Diagnostic[] = [],
): Result<BuiltSite, readonly Diagnostic[]> {
  const problems = inFileOrder(withoutRepeats(diagnostics));
  if (hasErrors(problems)) return err(problems);
  const sorted = files.toSorted((first, second) => compareStrings(first.path, second.path));
  return ok({ files: sorted, warnings: problems, checkWarnings });
}

export function buildSite(input: SiteInput): Result<BuiltSite, readonly Diagnostic[]> {
  const config = input.config ?? {};
  const loaded = loadContent(input.content, {
    // gensane's own highlighter, unless the config has one of its own or says `false`.
    markdown: { ...config.markdown, highlight: config.markdown?.highlight ?? highlight },
    ...(config.contentFolder === undefined ? {} : { contentFolder: config.contentFolder }),
  });
  if (!loaded.ok) return finish([], loaded.error);

  const graph = buildSiteGraph(loaded.value.entries, {
    ...(config.perPage === undefined ? {} : { perPage: config.perPage }),
    ...(config.drafts === undefined ? {} : { drafts: config.drafts }),
  });
  if (!graph.ok) return finish([], [...loaded.value.warnings, ...graph.error]);
  const warnings = [...loaded.value.warnings, ...graph.value.warnings];

  const templates = compileTemplates(
    input.templates,
    config.filters === undefined ? {} : { filters: config.filters },
  );
  if (!templates.ok) return finish([], [...warnings, ...templates.error]);

  const theme = themeOf(config.theme);
  // The feed only needs the entries, so whether there is one is known before any page is rendered.
  const feeds = feedFiles(
    config.site ?? {},
    graph.value.graph,
    config.configFile ?? "gensane.config.ts",
  );
  // The site's own icon wins, then the theme's, and only then one is made.
  const ownFavicon =
    OWN_FAVICONS.find((path) => (input.publicFiles ?? []).includes(path)) ??
    (input.themeAssets ?? []).find((path) => path === FAVICON_PATH);
  const title = config.site?.["title"];
  const letter =
    ownFavicon === undefined && typeof title === "string" ? initialOf(title) : undefined;
  const madeFavicon =
    letter === undefined
      ? []
      : [{ path: FAVICON_PATH, content: faviconSvg(letter, theme.colors.light) }];
  const variables = new TemplateVariables({
    site: config.site ?? {},
    theme,
    collections: graph.value.graph.collections,
    routes: graph.value.graph.routes,
    feed: feeds.files.some(({ path }) => path === "feed.xml") ? "/feed.xml" : undefined,
    favicon:
      ownFavicon === undefined ? madeFavicon.map(({ path }) => `/${path}`)[0] : `/${ownFavicon}`,
    today: config.today,
    nav: config.nav,
  });
  const files: OutputFile[] = [];
  const problems: Diagnostic[] = [...warnings];
  const missing = new Map<string, Route>();
  for (const route of graph.value.graph.routes) {
    const name = TEMPLATES[route.kind];
    const template = templates.value.get(name);
    if (template === undefined) {
      if (!missing.has(name)) missing.set(name, route);
      continue;
    }
    const rendered = renderTemplate(template, variables.of(route));
    if (rendered.ok) {
      files.push({ path: outputPath(route.url), content: rendered.value.html });
      problems.push(...rendered.value.warnings);
    } else {
      problems.push(...rendered.error);
    }
  }
  for (const [name, route] of missing) {
    problems.push(
      problem(
        CoreCodes.missingTemplate,
        `there is no template "${name}", which ${route.url} needs`,
        startOf(name),
        `add ${name} to the theme`,
      ),
    );
  }
  const hasSearch = graph.value.graph.routes.some((route) => route.kind === "search");
  const allFiles = [
    ...files,
    ...feeds.files,
    { path: THEME_CSS_PATH, content: themeCss(theme) },
    ...madeFavicon,
    ...(hasSearch ? [{ path: SEARCH_INDEX_PATH, content: searchIndex(loaded.value.entries) }] : []),
    ...(config.llms === true ? llmsFiles(config.site ?? {}, graph.value.graph) : []),
  ];
  const found = [...problems, ...feeds.problems];
  if (hasErrors(found)) return finish(allFiles, found);
  const links = checkLinks({
    entries: loaded.value.entries,
    drafts: config.drafts ?? false,
    contentFolder: config.contentFolder ?? "content",
    content: input.content,
    templates: input.templates,
    files: new Map(allFiles.map((file) => [file.path, file.content])),
    publicFiles: input.publicFiles ?? [],
    themeAssets: input.themeAssets ?? [],
    navigation: {
      file: config.configFile ?? "gensane.config.ts",
      urls: variables.menuUrls,
    },
  });
  // Links are checked as they are written; the path of the site is added to the finished pages only.
  const path =
    config.servedAtRoot === true ? "" : (siteAddressOf(config.site?.["url"])?.path ?? "");
  const served = allFiles.map((file) =>
    file.path.endsWith(".html") ? { ...file, content: withBasePath(file.content, path) } : file,
  );
  // A site that turns colors off has chosen plain code.
  const built = loaded.value.entries.filter((entry) => config.drafts === true || !isDraft(entry));
  const plain = config.markdown?.highlight === false ? [] : uncoloredCode(built);
  return finish(served, [...found, ...links], plain);
}
