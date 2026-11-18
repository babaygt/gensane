/**
 * Reads the parts of a documentation page that can be checked against the code. These are
 * pure functions over text, so the checks themselves can be tested with small examples.
 */

export interface CodeFence {
  readonly info: string;
  readonly text: string;
  /** The HTML comment on the line just before the fence, such as `example`. */
  readonly marker: string | undefined;
}

export interface VerifiedExample {
  readonly markdown: string;
  readonly html: string;
}

export interface WarningExample {
  readonly code: string;
  readonly markdown: string;
}

export interface DocLink {
  readonly text: string;
  readonly target: string;
}

const FENCE_LINE = /^(`{3,}|~{3,})(.*)$/;
const MARKER_COMMENT = /^<!--\s*(.+?)\s*-->$/;

export function findCodeFences(page: string): CodeFence[] {
  const lines = page.split("\n");
  const fences: CodeFence[] = [];
  for (let index = 0; index < lines.length; index++) {
    const open = FENCE_LINE.exec(lines[index] ?? "");
    if (open === null) continue;
    const delimiter = open[1] ?? "";
    const content: string[] = [];
    const marker = MARKER_COMMENT.exec(previousTextLine(lines, index))?.[1];
    index++;
    while (index < lines.length && !isClosingFence(lines[index] ?? "", delimiter)) {
      content.push(lines[index] ?? "");
      index++;
    }
    fences.push({ info: (open[2] ?? "").trim(), text: content.join("\n"), marker });
  }
  return fences;
}

/** Formatters may put a blank line between a comment and the fence after it. */
function previousTextLine(lines: readonly string[], index: number): string {
  let previous = index - 1;
  while (previous >= 0 && lines[previous]?.trim() === "") previous--;
  return lines[previous] ?? "";
}

function isClosingFence(line: string, delimiter: string): boolean {
  const trimmed = line.trimEnd();
  return (
    trimmed.length >= delimiter.length && trimmed === (delimiter[0] ?? "").repeat(trimmed.length)
  );
}

/** Every marker must lead to a checked example, so that no example can silently stop being tested. */
export function countExampleMarkers(page: string): number {
  return page.match(/^<!--\s*(?:example|warns GS\d+)\s*-->$/gm)?.length ?? 0;
}

/** A `markdown` fence marked `<!-- example -->` must be followed by its `html` fence. */
export function findVerifiedExamples(page: string): VerifiedExample[] {
  const fences = findCodeFences(page);
  return fences.flatMap((fence, index) => {
    if (fence.marker !== "example") return [];
    const output = fences[index + 1];
    if (output?.info !== "html") {
      throw new Error(`Example without an html fence after it:\n${fence.text}`);
    }
    return [{ markdown: fence.text, html: output.text }];
  });
}

/** A `markdown` fence marked `<!-- warns GS101 -->` must produce that warning. */
export function findWarningExamples(page: string): WarningExample[] {
  return findCodeFences(page).flatMap((fence) => {
    const code = /^warns (GS\d+)$/.exec(fence.marker ?? "")?.[1];
    return code === undefined ? [] : [{ code, markdown: fence.text }];
  });
}

/** Links outside code. `[text](/url)` written as inline code is an example, not a link. */
export function findLinks(page: string): DocLink[] {
  const withoutFences = page.replace(/^(`{3,}|~{3,}).*\n[\s\S]*?^\1[`~]*\s*$/gm, "");
  // Links to code are kept; every other code span is removed.
  const withoutCode = withoutFences.replace(
    /\[`[^`\n]+`\]\([^)\s]+\)|``.+?``|`[^`\n]+`/g,
    (match) => (match.startsWith("[") ? match : ""),
  );
  return [...withoutCode.matchAll(/\[(`[^`]+`|[^\]`]+)\]\(([^)\s]+)\)/g)].map((match) => ({
    text: match[1] ?? "",
    target: match[2] ?? "",
  }));
}

export function isExternalLink(target: string): boolean {
  return /^[a-z]+:/.test(target);
}

/** The name in a link such as [`parseBlocks`](file.ts), if the link names a piece of code. */
export function linkedSymbol(link: DocLink): string | undefined {
  return link.target.endsWith(".ts") ? /^`([#\w]+)`$/.exec(link.text)?.[1] : undefined;
}

/** Whether `source` declares `symbol`: a function, class, type, constant or private method. */
export function declaresSymbol(source: string, symbol: string): boolean {
  if (symbol.startsWith("#")) return new RegExp(`^\\s*${symbol}\\(`, "m").test(source);
  return new RegExp(`\\b(?:function|class|interface|type|const)\\s+${symbol}\\b`).test(source);
}
