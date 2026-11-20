/** The page `gensane dev` shows instead of the site while the site has errors. */
import { type Diagnostic, formatDiagnostic } from "../../diagnostics/index.ts";
import { countProblems } from "../build-folder.ts";
import { located } from "../report.ts";
import type { SiteFiles } from "../site-folder.ts";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function problemsPage(
  problems: readonly Diagnostic[],
  files: SiteFiles | undefined,
): string {
  const title = `Found ${countProblems(problems)}`;
  const shown = problems.map((problem) => {
    const { diagnostic, source } = located(problem, files);
    return `<pre>${escapeHtml(formatDiagnostic(diagnostic, source, { color: false }))}</pre>`;
  });
  return [
    "<!doctype html>",
    '<html lang="en">',
    '<meta charset="utf-8">',
    `<title>${title}</title>`,
    "<style>body{font:15px/1.5 system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem}pre{background:#f6f6f6;padding:1rem;overflow-x:auto}</style>",
    "<body>",
    `<h1>${title}</h1>`,
    "<p>The site is shown again as soon as they are fixed.</p>",
    ...shown,
    "</body>",
    "</html>",
  ].join("\n");
}
