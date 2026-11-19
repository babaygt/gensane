// Keeps the template documentation true: its examples are rendered, every problem it shows is
// produced by the code, and everything it refers to in the code must exist.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../../src/diagnostics/index.ts";
import {
  MAX_INCLUDE_DEPTH,
  TemplateCodes,
  compileTemplate,
  compileTemplates,
  renderTemplate,
} from "../../src/template/index.ts";
import {
  MAX_BLOCK_DEPTH,
  MAX_EXPRESSION_DEPTH,
  MAX_EXPRESSION_TOKENS,
} from "../../src/template/parsing/parser.ts";
import { builtInFilters } from "../../src/template/rendering/filters.ts";
import {
  type TemplateExample,
  countTemplateMarkers,
  findSection,
  findTemplateExamples,
} from "./doc-rules.ts";
import { checkLinks } from "./link-checks.ts";

const packageRoot = join(import.meta.dirname, "..", "..");
const docsFolder = join(packageRoot, "docs", "template");
const pages = readdirSync(docsFolder).map((name) => ({
  name,
  path: join(docsFolder, name),
  text: readFileSync(join(docsFolder, name), "utf8"),
}));
const docsPage = (name: string): string => pages.find((page) => page.name === name)?.text ?? "";

/** A real example needs more than 1,000 parts, which is too long to show on a page. */
const SHOWN_WITHOUT_EXAMPLE: readonly string[] = [TemplateCodes.expressionTooLong];

interface Outcome {
  readonly html: string | undefined;
  readonly problems: readonly Diagnostic[];
}

function run({ files, name, variables }: TemplateExample): Outcome {
  const compiled = compileTemplates(files);
  if (!compiled.ok) return { html: undefined, problems: compiled.error };
  const template = compiled.value.get(name);
  if (template === undefined) throw new Error(`The example has no template named ${name}`);
  const rendered = renderTemplate(template, variables);
  return rendered.ok
    ? { html: rendered.value.html, problems: rendered.value.warnings }
    : { html: undefined, problems: rendered.error };
}

/** The file is named only when an example has more than one. */
function describeProblem({ span, message, hint }: Diagnostic, withFile: boolean): string {
  const file = withFile ? `${span.file}, ` : "";
  return `${file}line ${span.start.line}, column ${span.start.column}: ${message}\nhint: ${hint}`;
}

describe.each(pages)("docs/template/$name", ({ path, text }) => {
  checkLinks(path, text);

  it("checks every marked example", () => {
    expect(findTemplateExamples(text)).toHaveLength(countTemplateMarkers(text));
  });

  const examples = findTemplateExamples(text);

  it.each(examples.filter((example) => example.kind === "renders"))(
    "renders $name as documented: $files",
    (example) => {
      expect(run(example)).toEqual({ html: example.output, problems: [] });
    },
  );

  it.each(examples.filter((example) => example.kind === "reports"))(
    "reports $code for $files",
    (example) => {
      const withFile = Object.keys(example.files).length > 1;
      const problem = run(example).problems.find((found) => found.code === example.code);
      expect(problem && describeProblem(problem, withFile)).toBe(example.output);
    },
  );
});

describe("the documentation is complete", () => {
  const diagnostics = docsPage("diagnostics.md");
  const codes = Object.values(TemplateCodes);

  it.each(codes.filter((code) => !SHOWN_WITHOUT_EXAMPLE.includes(code)))(
    "shows problem %s with an example",
    (code) => {
      const examples = findTemplateExamples(findSection(diagnostics, `### ${code}`));
      expect(examples).toContainEqual(expect.objectContaining({ kind: "reports", code }));
    },
  );

  it("describes only problems that exist, and every one of them", () => {
    const documented = diagnostics.match(/^### (GS\d+)/gm) ?? [];
    expect(documented.map((heading) => heading.slice(4)).toSorted()).toEqual(codes.toSorted());
  });

  const filters = docsPage("filters.md");
  const filterNames = [...builtInFilters.keys()];

  it("describes every built-in filter, and no others", () => {
    const documented = [...filters.matchAll(/^### `(\w+)`$/gm)].map((match) => match[1]);
    expect(documented.toSorted()).toEqual(filterNames.toSorted());
  });

  it.each(filterNames)("shows the %s filter with an example", (name) => {
    const examples = findTemplateExamples(findSection(filters, `### \`${name}\``));
    expect(examples.some((example) => example.kind === "renders")).toBe(true);
  });

  it("lists every part of a date format that exists", () => {
    const result = renderTemplate(
      expectCompiled('{{ date | date("Q") }}'),
      { date: { text: "2026-01-01", year: 2026, month: 1, day: 1 } },
    );
    const hint = result.ok ? "" : (result.error[0]?.hint ?? "");
    const parts = /^use (.+), and only/.exec(hint)?.[1]?.split(/, | or /) ?? [];
    const documented = [...findSection(filters, "### `date`").matchAll(/^\| `(\w+)`/gm)];
    expect(documented.map((match) => match[1])).toEqual(parts);
  });

  it("lists every tag in the table of tags", () => {
    const result = compileTemplate("{% nothing %}", "page.html");
    const hint = result.ok ? "" : (result.error[0]?.hint ?? "");
    const tags = hint.replace("the tags are: ", "").split(/, | and /);
    const table = findSection(docsPage("syntax.md"), "## All tags");
    expect(tags.length).toBeGreaterThan(5);
    for (const tag of tags) expect(table).toContain(`{% ${tag}`);
  });

  it.each([
    ["Nested expressions", `${MAX_EXPRESSION_DEPTH} levels`],
    ["Parts of one expression", `${MAX_EXPRESSION_TOKENS} parts`],
    ["Nested blocks", `${MAX_BLOCK_DEPTH} levels`],
    ["Included templates", `${MAX_INCLUDE_DEPTH} levels`],
  ])("states the limit on %s", (limit, value) => {
    const row = new RegExp(`^\\|\\s*${limit}\\s*\\|\\s*${value}\\s*\\|`, "m");
    expect(docsPage("architecture.md")).toMatch(row);
  });

  it("covers every source file in the code reference", () => {
    const reference = docsPage("code-reference.md");
    const sources = readdirSync(join(packageRoot, "src", "template"), { recursive: true })
      .map(String)
      .filter(
        (file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "test-helpers.ts",
      );
    for (const file of sources) expect(reference).toContain(`src/template/${file}`);
  });
});

function expectCompiled(source: string) {
  const result = compileTemplate(source, "page.html");
  if (!result.ok) throw new Error(result.error[0]?.message);
  return result.value;
}
