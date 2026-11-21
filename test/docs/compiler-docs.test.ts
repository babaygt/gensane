// Keeps the Markdown compiler documentation true: its examples are compiled, and everything it
// refers to in the code must exist.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DiagnosticCodes, markdownToHtml } from "../../src/markdown/index.ts";
import { KNOWN_GAPS } from "../conformance/known-gaps.ts";
import { countExampleMarkers, findVerifiedExamples, findWarningExamples } from "./doc-rules.ts";
import { checkLinks } from "./link-checks.ts";

const packageRoot = join(import.meta.dirname, "..", "..");
const docsFolder = join(packageRoot, "docs", "markdown-compiler");
const pagePaths = [
  ...readdirSync(docsFolder).map((name) => join(docsFolder, name)),
  join(packageRoot, "README.md"),
  join(packageRoot, "CONTRIBUTING.md"),
];
const pages = pagePaths.map((path) => ({
  path,
  name: path.slice(packageRoot.length + 1),
  text: readFileSync(path, "utf8"),
}));
const docsPage = (name: string): string =>
  pages.find((page) => page.name === `docs/markdown-compiler/${name}`)?.text ?? "";

describe.each(pages)("$name", ({ path, text }) => {
  checkLinks(path, text);

  it("checks every marked example", () => {
    const checked = findVerifiedExamples(text).length + findWarningExamples(text).length;
    expect(checked).toBe(countExampleMarkers(text));
  });

  it.each(findVerifiedExamples(text).map((example) => [example.markdown, example] as const))(
    "example %j produces the documented HTML",
    (_, example) => {
      expect(markdownToHtml(example.markdown, "docs.md").html.trimEnd()).toBe(example.html);
    },
  );

  it.each(findWarningExamples(text).map((example) => [example.code, example] as const))(
    "example produces warning %s",
    (code, example) => {
      const codes = markdownToHtml(example.markdown, "docs.md").diagnostics.map(
        (diagnostic) => diagnostic.code,
      );
      expect(codes).toContain(code);
    },
  );
});

describe("the documentation is complete", () => {
  it.each(Object.values(DiagnosticCodes))("describes warning %s", (code) => {
    expect(docsPage("diagnostics.md")).toContain(`### ${code}`);
  });

  it("describes only warnings that exist", () => {
    const documented = docsPage("diagnostics.md").match(/^### (GS\d+)/gm) ?? [];
    expect(documented.map((heading) => heading.slice(4)).toSorted()).toEqual(
      Object.values(DiagnosticCodes).toSorted(),
    );
  });

  it("states the current conformance numbers", () => {
    const spec = JSON.parse(
      readFileSync(join(packageRoot, "test", "fixtures", "commonmark-0.31.2.json"), "utf8"),
    ) as unknown[];
    const gaps = Object.values(KNOWN_GAPS).flat().length;
    const summary = `${spec.length - gaps} of ${spec.length}`;
    expect(docsPage("testing.md")).toContain(summary);
    expect(docsPage("README.md")).toContain(summary);
  });

  it.each([
    ["Indented code", KNOWN_GAPS.indentedCode.length],
    ["Setext headings", KNOWN_GAPS.setextHeadings.length],
    ["Tabs in nested lists", KNOWN_GAPS.tabsInNestedLists.length],
  ])("lists the number of gaps for %s", (reason, count) => {
    // Spaces are flexible, because Markdown formatters align the columns of a table.
    expect(docsPage("testing.md")).toMatch(
      new RegExp(`\\|\\s*${reason}\\s*\\|\\s*${count}\\s*\\|`),
    );
  });

  it("covers every source file in the code reference", () => {
    const reference = docsPage("code-reference.md");
    const sources = readdirSync(join(packageRoot, "src", "markdown"), { recursive: true })
      .map(String)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .filter((file) => !file.endsWith("test-helpers.ts"));
    for (const file of sources) expect(reference).toContain(`src/markdown/${file}`);
  });
});
