/**
 * Builds a whole site from text: the content files and the templates go in, and the files to
 * write come out. Each step only runs when the steps before it had no errors, and the warnings of
 * every step are kept.
 */
import { type Diagnostic, type Result, err, hasErrors, ok } from "../../diagnostics/index.ts";
import type { MarkdownOptions } from "../../markdown/index.ts";
import { type TemplateFilter, compileTemplates, renderTemplate } from "../../template/index.ts";
import { loadContent } from "../content/load-content.ts";
import { CoreCodes } from "../diagnostic-codes.ts";
import { feedFiles } from "../feeds/feed-files.ts";
import { checkLinks } from "../links/check-links.ts";
import { inFileOrder, problem, startOf } from "../problems.ts";
import { compareStrings } from "../site/order.ts";
import { type Route, TEMPLATES } from "../site/routes.ts";
import { buildSiteGraph } from "../site/site-graph.ts";
import { outputPath } from "./output-paths.ts";
import { type TemplateData, TemplateVariables } from "./page-data.ts";

export interface SiteConfig {
  /** Settings that every template sees as `site`, such as the title. */
  readonly site?: TemplateData;
  /** How many posts a list shows on one page. Defaults to 10. */
  readonly perPage?: number;
  /** Show drafts, to preview them. Defaults to `false`. */
  readonly drafts?: boolean;
  readonly markdown?: MarkdownOptions;
  /** Extra filters for templates. */
  readonly filters?: Readonly<Record<string, TemplateFilter>>;
  /** Where the content files are, for the paths in problems. Defaults to `content`. */
  readonly contentFolder?: string;
  /** The config file, for problems with the config. Defaults to `gensane.config.ts`. */
  readonly configFile?: string;
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
}

export interface OutputFile {
  readonly path: string;
  readonly content: string;
}

export interface BuiltSite {
  /** Sorted by path. */
  readonly files: readonly OutputFile[];
  readonly warnings: readonly Diagnostic[];
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
): Result<BuiltSite, readonly Diagnostic[]> {
  const problems = inFileOrder(withoutRepeats(diagnostics));
  if (hasErrors(problems)) return err(problems);
  const sorted = files.toSorted((first, second) => compareStrings(first.path, second.path));
  return ok({ files: sorted, warnings: problems });
}

export function buildSite(input: SiteInput): Result<BuiltSite, readonly Diagnostic[]> {
  const config = input.config ?? {};
  const loaded = loadContent(input.content, {
    ...(config.markdown === undefined ? {} : { markdown: config.markdown }),
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

  const variables = new TemplateVariables(config.site ?? {}, graph.value.graph.collections);
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
  const feeds = feedFiles(
    config.site ?? {},
    graph.value.graph,
    config.configFile ?? "gensane.config.ts",
  );
  const allFiles = [...files, ...feeds.files];
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
  });
  return finish(allFiles, [...found, ...links]);
}
