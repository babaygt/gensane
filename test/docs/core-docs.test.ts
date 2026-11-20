// Keeps the documentation of the core true: every example builds a small site, every problem it shows
// is produced by the code, and the tables match the code.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_TITLES } from "../../src/core/build/page-data.ts";
import { CoreCodes, type SiteConfig, TEMPLATES, buildSite } from "../../src/core/index.ts";
import type { Diagnostic } from "../../src/diagnostics/index.ts";
import { type CoreExample, countCoreMarkers, findCoreExamples, findSection } from "./doc-rules.ts";
import { checkLinks } from "./link-checks.ts";

const packageRoot = join(import.meta.dirname, "..", "..");
const docsFolder = join(packageRoot, "docs", "core");
const pages = readdirSync(docsFolder).map((name) => ({
  name,
  path: join(docsFolder, name),
  text: readFileSync(join(docsFolder, name), "utf8"),
}));
const docsPage = (name: string): string => pages.find((page) => page.name === name)?.text ?? "";

/** Examples only show the templates they are about; every other page just prints its title. */
const plainTheme = Object.fromEntries(
  Object.values(TEMPLATES).map((name) => [name, "<h1>{{ page.title }}</h1>"]),
);

function run({ content, templates, config, publicFiles, themeAssets, withoutTemplates }: CoreExample) {
  const theme = Object.entries(plainTheme).filter(([name]) => !withoutTemplates.includes(name));
  return buildSite({
    content,
    templates: { ...Object.fromEntries(theme), ...templates },
    config: config as SiteConfig,
    publicFiles,
    themeAssets,
  });
}

function describeProblem({ span, message, hint }: Diagnostic): string {
  return `${span.file}, line ${span.start.line}, column ${span.start.column}: ${message}\nhint: ${hint}`;
}

describe.each(pages)("docs/core/$name", ({ path, text }) => {
  checkLinks(path, text);

  it("checks every marked example", () => {
    expect(findCoreExamples(text)).toHaveLength(countCoreMarkers(text));
  });

  const examples = findCoreExamples(text);

  it.each(examples.filter((example) => example.kind === "builds"))(
    "builds $content as documented",
    (example) => {
      const result = run(example);
      const problems = result.ok ? result.value.warnings : result.error;
      // Most examples don't need a feed, so the warning about a missing site address is allowed.
      expect(problems.filter((problem) => problem.code !== CoreCodes.noSiteUrl)).toEqual([]);
      const files = result.ok ? result.value.files : [];
      const shown = Object.keys(example.outputs).map((outputPath) => [
        outputPath,
        files.find((file) => file.path === outputPath)?.content.trimEnd(),
      ]);
      expect({
        files: example.files && files.map((file) => file.path),
        outputs: Object.fromEntries(shown),
      }).toEqual({ files: example.files, outputs: example.outputs });
    },
  );

  it.each(examples.filter((example) => example.kind === "reports"))(
    "reports $code for $content",
    (example) => {
      const result = run(example);
      const problems = result.ok ? result.value.warnings : result.error;
      const problem = problems.find((found) => found.code === example.code);
      expect(problem && describeProblem(problem)).toBe(example.problem);
    },
  );
});

describe("the documentation is complete", () => {
  const diagnostics = docsPage("diagnostics.md");
  const codes = Object.values(CoreCodes);

  it.each(codes)("shows problem %s with an example", (code) => {
    const examples = findCoreExamples(findSection(diagnostics, `### ${code}`));
    expect(examples).toContainEqual(expect.objectContaining({ kind: "reports", code }));
  });

  it("describes only problems that exist, and every one of them", () => {
    const documented = diagnostics.match(/^### (GS\d+)/gm) ?? [];
    expect(documented.map((heading) => heading.slice(4)).toSorted()).toEqual(codes.toSorted());
  });

  it("lists the template of every kind of page", () => {
    const table = findSection(docsPage("site.md"), "## Pages");
    const rows = [...table.matchAll(/^\| `([\w-]+)`\s*\|[^|]*\|\s*`([\w.]+)`/gm)].map(([, kind, name]) => [kind, name]);
    expect(Object.fromEntries(rows)).toEqual(TEMPLATES);
  });

  it("lists the title of every page without a content file", () => {
    const table = findSection(docsPage("templates.md"), "## Titles");
    const rows = [...table.matchAll(/^\| `([\w-]+)`\s*\|\s*([^|]+?)\s*\|/gm)].map(([, kind, title]) => [kind, title]);
    expect(Object.fromEntries(rows)).toEqual(DEFAULT_TITLES);
  });

  it("covers every source file in the code reference", () => {
    const reference = docsPage("code-reference.md");
    const sources = readdirSync(join(packageRoot, "src", "core"), { recursive: true })
      .map(String)
      .filter(
        (file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "test-helpers.ts",
      );
    for (const file of sources) {
      expect(reference).toContain(`### [\`src/core/${file}\`](../../src/core/${file})`);
    }
  });
});
