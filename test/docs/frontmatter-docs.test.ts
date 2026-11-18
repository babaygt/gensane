// Keeps the frontmatter documentation true: its examples run against the parser and the content
// rules, and everything it refers to in the code must exist.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../../src/diagnostics/index.ts";
import {
  type ContentType,
  FrontmatterCodes,
  contentSchemas,
  parseFrontmatter,
  toPlainData,
  validateContent,
} from "../../src/frontmatter/index.ts";
import { MAX_NESTING_DEPTH } from "../../src/frontmatter/parsing/inline-values.ts";
import {
  countFrontmatterMarkers,
  findFieldRows,
  findFrontmatterExamples,
  findSection,
} from "./doc-rules.ts";
import { checkLinks } from "./link-checks.ts";

const packageRoot = join(import.meta.dirname, "..", "..");
const docsFolder = join(packageRoot, "docs", "frontmatter");
const pages = readdirSync(docsFolder).map((name) => ({
  name,
  path: join(docsFolder, name),
  text: readFileSync(join(docsFolder, name), "utf8"),
}));
const docsPage = (name: string): string => pages.find((page) => page.name === name)?.text ?? "";

function parsed(source: string) {
  const result = parseFrontmatter(`${source}\n`, "docs.md");
  if (!result.ok) throw new Error(result.error[0]?.message);
  return result.value.data;
}

function problemsIn(source: string, contentType: string | undefined): readonly Diagnostic[] {
  const result = parseFrontmatter(`${source}\n`, "docs.md");
  if (!result.ok) return result.error;
  if (contentType === undefined) return [];
  const checked = validateContent(contentType as ContentType, result.value.data);
  return checked.ok ? checked.value.warnings : checked.error;
}

function describeProblem({ span, message, hint }: Diagnostic): string {
  return `line ${span.start.line}, column ${span.start.column}: ${message}\nhint: ${hint}`;
}

describe.each(pages)("docs/frontmatter/$name", ({ path, text }) => {
  checkLinks(path, text);

  it("checks every marked example", () => {
    expect(findFrontmatterExamples(text)).toHaveLength(countFrontmatterMarkers(text));
  });

  const examples = findFrontmatterExamples(text);

  it.each(examples.flatMap((example) => (example.kind === "reads" ? [example] : [])))(
    "reads $source as documented",
    ({ source, data }) => {
      expect(toPlainData(parsed(source))).toEqual(data);
    },
  );

  it.each(examples.flatMap((example) => (example.kind === "valid" ? [example] : [])))(
    "accepts $source as a $contentType",
    ({ source, contentType }) => {
      expect(problemsIn(source, contentType)).toEqual([]);
    },
  );

  it.each(examples.flatMap((example) => (example.kind === "reports" ? [example] : [])))(
    "reports $code for $source",
    ({ source, code, contentType, output }) => {
      const problem = problemsIn(source, contentType).find((found) => found.code === code);
      expect(problem && describeProblem(problem)).toBe(output);
    },
  );
});

describe("the documentation is complete", () => {
  const diagnostics = docsPage("diagnostics.md");

  it.each(Object.values(FrontmatterCodes))("shows problem %s with an example", (code) => {
    const examples = findFrontmatterExamples(findSection(diagnostics, `### ${code}`));
    expect(examples).toContainEqual(expect.objectContaining({ kind: "reports", code }));
  });

  it("describes only problems that exist", () => {
    const documented = diagnostics.match(/^### (GS\d+)/gm) ?? [];
    expect(documented.map((heading) => heading.slice(4)).toSorted()).toEqual(
      Object.values(FrontmatterCodes).toSorted(),
    );
  });

  const contentTypes = Object.keys(contentSchemas) as ContentType[];

  describe.each(contentTypes)("the %s content type", (contentType) => {
    const section = findSection(docsPage("content-types.md"), `## \`${contentType}\``);
    const rows = findFieldRows(section);

    it("lists every field", () => {
      expect(rows.map((row) => row.field).toSorted()).toEqual(
        contentSchemas[contentType].fields.toSorted(),
      );
    });

    it("says which fields are required", () => {
      const checked = validateContent(contentType, parsed("---\n---"));
      const missing = checked.ok ? [] : checked.error.map((error) => /"(\w+)"/.exec(error.message)?.[1]);
      const required = rows.filter((row) => row.required).map((row) => row.field);
      expect(required.toSorted()).toEqual(missing.toSorted());
    });

    it("shows a valid example", () => {
      const examples = findFrontmatterExamples(section);
      expect(examples).toContainEqual(expect.objectContaining({ kind: "valid", contentType }));
    });
  });

  it("states the nesting limit", () => {
    expect(docsPage("architecture.md")).toContain(`${MAX_NESTING_DEPTH} levels`);
  });

  it("covers every source file in the code reference", () => {
    const reference = docsPage("code-reference.md");
    const sources = readdirSync(join(packageRoot, "src", "frontmatter"), { recursive: true })
      .map(String)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
    for (const file of sources) expect(reference).toContain(`src/frontmatter/${file}`);
  });
});
