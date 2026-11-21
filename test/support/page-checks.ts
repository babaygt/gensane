// Checks of a built page that the default theme's tests and the example site's tests share.
import { HtmlValidate } from "html-validate";

const validator = new HtmlValidate({
  extends: ["html-validate:recommended"],
  rules: {
    // The Markdown compiler writes void elements as `<br />`, as CommonMark does.
    "void-style": "off",
    // A theme can't know how long a site's own text is.
    "long-title": "off",
    // Task lists are written as `checked="" disabled=""`, as GitHub's Markdown writes them.
    "attribute-boolean-style": "off",
  },
});

/** What the HTML validator finds wrong in a page, as `rule: message`. */
export async function htmlProblems(html: string): Promise<string[]> {
  const report = await validator.validateString(html);
  return report.results.flatMap((result) =>
    result.messages.map((message) => `${message.ruleId}: ${message.message}`),
  );
}

/**
 * A small check of what an HTML validator can't judge: one main heading, headings in order, the
 * landmarks a screen reader jumps between, text for every link and image, and a working skip link.
 */
export function accessibilityProblems(html: string): string[] {
  const problems: string[] = [];
  const withoutCode = html.replaceAll(/<pre[\s\S]*?<\/pre>/g, "");
  const levels = [...withoutCode.matchAll(/<h([1-6])\b/g)].map(([, level]) => Number(level));
  if (levels.filter((level) => level === 1).length !== 1)
    problems.push(`${levels.filter((level) => level === 1).length} main headings`);
  levels.forEach((level, index) => {
    const before = levels[index - 1];
    if (before !== undefined && level > before + 1) problems.push(`h${level} after h${before}`);
  });
  for (const landmark of ["<header", "<main", "<footer"]) {
    if (!html.includes(landmark)) problems.push(`no ${landmark}>`);
  }
  if (!/<html lang="[a-z-]+">/.test(html)) problems.push("no language");
  // Without it, phones show the page as a small desktop page.
  if (!html.includes('<meta name="viewport" content="width=device-width, initial-scale=1">')) {
    problems.push("no viewport for phones");
  }
  for (const [image] of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="/.test(image)) problems.push(`no alt: ${image}`);
  }
  for (const [, text] of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
    if (
      (text ?? "").replaceAll(/<[^>]+>/g, "").trim() === "" &&
      !/<img\b[^>]*alt="[^"]+"/.test(text ?? "")
    ) {
      problems.push("a link without text");
    }
  }
  if (!html.includes('href="#content"') || !html.includes('id="content"'))
    problems.push("no skip link to the content");
  return problems;
}
