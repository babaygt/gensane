import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../../diagnostics/index.ts";
import { problemsPage } from "./problems-page.ts";

const start = { line: 1, column: 4, offset: 3 };
const end = { line: 1, column: 15, offset: 14 };
const problem: Diagnostic = {
  code: "GS331",
  severity: "error",
  message: '"page" has no field "titel"',
  span: { file: "post.html", start, end },
  hint: "check the spelling",
};

describe("problemsPage", () => {
  const files = {
    content: {},
    templates: { "post.html": "<p>{{ page.titel }} & <b></p>" },
    publicFiles: [],
  };

  it("counts the problems in its title", () => {
    expect(problemsPage([problem, { ...problem, severity: "warning" }], files)).toContain(
      "<title>Found 1 error and 1 warning</title>",
    );
  });

  it("shows each problem as in the terminal, with its file in theme/ and its source", () => {
    expect(problemsPage([problem], files)).toContain(
      [
        "<pre>error[GS331]: &quot;page&quot; has no field &quot;titel&quot;",
        "  ┌─ theme/post.html:1:4",
        "  │",
        "1 │ &lt;p&gt;{{ page.titel }} &amp; &lt;b&gt;&lt;/p&gt;",
        "  │    ^^^^^^^^^^^",
        "  │",
        "  = hint: check the spelling</pre>",
      ].join("\n"),
    );
  });

  it("has no color codes, which a browser can't show", () => {
    expect(problemsPage([problem], files)).not.toContain("\u001B");
  });

  it("shows problems with the config, which has no files read yet", () => {
    const configProblem = { ...problem, span: { file: "gensane.config.ts", start, end: start } };
    expect(problemsPage([configProblem], undefined)).toContain("  ┌─ gensane.config.ts\n");
  });
});
