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

export type FrontmatterExample =
  | { readonly kind: "reads"; readonly source: string; readonly data: unknown }
  | { readonly kind: "valid"; readonly source: string; readonly contentType: string }
  | {
      readonly kind: "reports";
      readonly source: string;
      readonly code: string;
      readonly contentType: string | undefined;
      readonly output: string;
    };

/** A misspelled marker is counted too, so it fails instead of leaving its example unchecked. */
export function countFrontmatterMarkers(page: string): number {
  return page.match(/^<!--\s*(?:reads?|valid|reports?|reported)\b.*-->$/gm)?.length ?? 0;
}

/**
 * Three markers go before a `yaml` fence:
 * `reads` is followed by a `json` fence with the data,
 * `valid post` must pass the rules for that type of content, and
 * `reports GS221 as post` is followed by a `text` fence with the exact problem.
 */
export function findFrontmatterExamples(page: string): FrontmatterExample[] {
  const fences = findCodeFences(page);
  return fences.flatMap((fence, index): FrontmatterExample[] => {
    const marker = fence.marker ?? "";
    const source = fence.text;
    const next = fences[index + 1];
    if (marker === "reads") {
      if (next?.info !== "json") throw new Error(`Example without a json fence after it:\n${source}`);
      return [{ kind: "reads", source, data: JSON.parse(next.text) }];
    }
    const valid = /^valid (\w+)$/.exec(marker);
    if (valid !== null) return [{ kind: "valid", source, contentType: valid[1] ?? "" }];
    const reports = /^reports (GS\d+)(?: as (\w+))?$/.exec(marker);
    if (reports === null) return [];
    if (next?.info !== "text") throw new Error(`Example without a text fence after it:\n${source}`);
    const [, code = "", contentType] = reports;
    return [{ kind: "reports", source, code, contentType, output: next.text }];
  });
}

export interface TemplateExample {
  readonly kind: "renders" | "reports";
  /** The problem code of a `reports` example. */
  readonly code: string | undefined;
  /** Each template by its file name, in the order they are shown. */
  readonly files: Readonly<Record<string, string>>;
  /** The template to render. */
  readonly name: string;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly output: string;
}

/** A misspelled marker is counted too, so it fails instead of leaving its example unchecked. */
export function countTemplateMarkers(page: string): number {
  return page.match(/^<!--\s*(?:renders?|rendered|reports?|reported)\b.*-->$/gm)?.length ?? 0;
}

/**
 * `renders` and `reports GS320` go before one or more `jinja` fences. A fence can name its file after
 * the language, such as `jinja base.html`, and the first file is rendered unless the marker names
 * another one: `renders post.html`. An optional `json` fence holds the variables. `renders` ends
 * with an `html` fence, and `reports` with a `text` fence that shows the exact problem.
 */
export function findTemplateExamples(page: string): TemplateExample[] {
  const fences = findCodeFences(page);
  return fences.flatMap((fence, index): TemplateExample[] => {
    const marker = /^(renders|reports (GS\d+))(?: (\S+))?$/.exec(fence.marker ?? "");
    if (marker === null) return [];
    const files: Record<string, string> = {};
    let next = index;
    for (let file = fences[next]; file?.info.split(" ")[0] === "jinja"; file = fences[next]) {
      files[file.info.split(" ")[1] ?? "page.html"] = file.text;
      next++;
    }
    const [first] = Object.keys(files);
    if (first === undefined) throw new Error(`Example without a jinja fence:\n${fence.text}`);
    let variables = {};
    if (fences[next]?.info === "json") {
      variables = JSON.parse(fences[next]?.text ?? "{}");
      next++;
    }
    const kind = marker[1] === "renders" ? "renders" : "reports";
    const outputLanguage = kind === "renders" ? "html" : "text";
    const output = fences[next];
    if (output?.info !== outputLanguage) {
      throw new Error(`Example without a ${outputLanguage} fence after it:\n${fence.text}`);
    }
    const name = marker[3] ?? first;
    return [{ kind, code: marker[2], files, name, variables, output: output.text }];
  });
}

export interface CoreExample {
  readonly kind: "builds" | "reports";
  /** The problem code of a `reports` example. */
  readonly code: string | undefined;
  /** Content files by their path inside the content folder. */
  readonly content: Readonly<Record<string, string>>;
  /** Templates by name, which replace the plain ones the test supplies. */
  readonly templates: Readonly<Record<string, string>>;
  readonly config: Readonly<Record<string, unknown>>;
  readonly publicFiles: readonly string[];
  /** The paths in the site of the theme's assets, such as `assets/style.css`. */
  readonly themeAssets: readonly string[];
  /** Plain templates that the example leaves out, to show what happens without them. */
  readonly withoutTemplates: readonly string[];
  /** For `builds`: the exact list of files, if the example shows it. */
  readonly files: readonly string[] | undefined;
  /** For `builds`: the exact content of the files the example shows. */
  readonly outputs: Readonly<Record<string, string>>;
  /** For `reports`: the exact problem. */
  readonly problem: string | undefined;
}

/** A misspelled marker is counted too, so it fails instead of leaving its example unchecked. */
export function countCoreMarkers(page: string): number {
  return page.match(/^<!--\s*(?:builds?|built|reports?|reported)\b.*-->$/gm)?.length ?? 0;
}

const CORE_INPUTS = /^(markdown|jinja) (\S+)$|^json config$|^text (?:public|assets|without)$/;
const CORE_OUTPUTS = /^text files$|^(html|xml) (\S+)$/;

/**
 * `builds` and `reports GS405` go before the files of a small site: `markdown blog/hello.md` for a
 * content file, `jinja post.html` for a template, `json config`, `text public` for the files in
 * the `public` folder, `text assets` for the theme's assets, and `text without` for plain templates that the example leaves out. `builds` ends with `text files`, the exact list of files the site writes,
 * and with `html <path>` or `xml <path>` for the exact content of a file. `reports` ends with a
 * `text` fence that shows the exact problem.
 */
export function findCoreExamples(page: string): CoreExample[] {
  const fences = findCodeFences(page);
  return fences.flatMap((fence, index): CoreExample[] => {
    const marker = /^(builds|reports (GS\d+))$/.exec(fence.marker ?? "");
    if (marker === null) return [];
    const content: Record<string, string> = {};
    const templates: Record<string, string> = {};
    let config: Record<string, unknown> = {};
    let publicFiles: string[] = [];
    let themeAssets: string[] = [];
    let withoutTemplates: string[] = [];
    let next = index;
    for (let input = fences[next]; input !== undefined && CORE_INPUTS.test(input.info); input = fences[next]) {
      const [language = "", name = ""] = input.info.split(" ");
      if (language === "markdown") content[name] = `${input.text}\n`;
      else if (language === "jinja") templates[name] = input.text;
      else if (language === "json") config = JSON.parse(input.text);
      else if (name === "public") publicFiles = input.text.split("\n").filter((line) => line !== "");
      else if (name === "assets") themeAssets = input.text.split("\n").filter((line) => line !== "");
      else withoutTemplates = input.text.split("\n").filter((line) => line !== "");
      next++;
    }
    if (next === index) throw new Error(`Example without the files of a site:\n${fence.text}`);
    const base = { content, templates, config, publicFiles, themeAssets, withoutTemplates };
    if (marker[1] !== "builds") {
      const output = fences[next];
      if (output?.info !== "text") throw new Error(`Example without a text fence after it:\n${fence.text}`);
      return [{ kind: "reports", code: marker[2], ...base, files: undefined, outputs: {}, problem: output.text }];
    }
    let files: string[] | undefined;
    const outputs: Record<string, string> = {};
    for (let output = fences[next]; output !== undefined && CORE_OUTPUTS.test(output.info); output = fences[next]) {
      const [, path] = output.info.split(" ");
      if (path === "files") files = output.text.split("\n").filter((line) => line !== "");
      else outputs[path ?? ""] = output.text;
      next++;
    }
    if (files === undefined && Object.keys(outputs).length === 0) {
      throw new Error(`Example without the files it builds:\n${fence.text}`);
    }
    return [{ kind: "builds", code: undefined, ...base, files, outputs, problem: undefined }];
  });
}

export interface CliStep {
  /** The words after `gensane`, as a shell splits them. */
  readonly args: readonly string[];
  /** What the command prints: problems first, then the line at the end, as in a terminal. */
  readonly output: string;
  readonly exitCode: number;
  /** Folders whose exact list of files is shown after the command. */
  readonly listings: Readonly<Record<string, readonly string[]>>;
  /** The exact content of files after the command. */
  readonly files: Readonly<Record<string, string>>;
}

export interface CliExample {
  /** The files of the site folder before the first command, by their path in it. */
  readonly files: Readonly<Record<string, string>>;
  readonly steps: readonly CliStep[];
}

/** A misspelled marker is counted too, so it fails instead of leaving its example unchecked. */
export function countCliMarkers(page: string): number {
  return page.match(/^<!--\s*(?:runs?|ran)\b.*-->$/gm)?.length ?? 0;
}

const FILE_FENCE = /^\S+ (\S+)$/;
const LISTING_FENCE = /^text files (\S+)$/;

/** `new post "Hello World"` → `new`, `post`, `Hello World`. */
function shellWords(line: string): string[] {
  return [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2] ?? "");
}

function stepOf(fence: CodeFence): Omit<CliStep, "listings" | "files"> {
  const [command = "", ...rest] = fence.text.split("\n");
  if (!command.startsWith("$ gensane")) {
    throw new Error(`A console fence must start with "$ gensane":\n${fence.text}`);
  }
  const echo = rest.indexOf("$ echo $?");
  const output = echo === -1 ? rest : rest.slice(0, echo);
  const exitCode = echo === -1 ? 0 : Number(rest[echo + 1]);
  return { args: shellWords(command.slice("$ gensane".length)), output: output.join("\n"), exitCode };
}

/**
 * `runs` goes before the files of a site folder, each in a fence named after its path, such as
 * `markdown content/blog/hello.md` or `ts gensane.config.ts`. Then come `console` fences: a line
 * `$ gensane ...`, what it prints, and `$ echo $?` with the exit code when it isn't 0. After a command,
 * `text files dist` shows the exact files in a folder, and a fence named after a path shows the exact
 * content of that file.
 */
export function findCliExamples(page: string): CliExample[] {
  const fences = findCodeFences(page);
  return fences.flatMap((fence, index): CliExample[] => {
    if (fence.marker !== "runs") return [];
    const files: Record<string, string> = {};
    let next = index;
    for (let input = fences[next]; input !== undefined && input.info !== "console"; input = fences[next]) {
      const path = FILE_FENCE.exec(input.info)?.[1];
      if (path === undefined || (next > index && input.marker !== undefined)) break;
      files[path] = `${input.text}\n`;
      next++;
    }
    const steps: CliStep[] = [];
    for (let command = fences[next]; command?.info === "console"; command = fences[next]) {
      if (next > index && command.marker !== undefined) break;
      next++;
      const listings: Record<string, string[]> = {};
      const shown: Record<string, string> = {};
      for (let output = fences[next]; output !== undefined && output.marker === undefined; output = fences[next]) {
        const folder = LISTING_FENCE.exec(output.info)?.[1];
        const path = FILE_FENCE.exec(output.info)?.[1];
        if (folder !== undefined) listings[folder] = output.text.split("\n").filter((line) => line !== "");
        else if (path !== undefined) shown[path] = output.text;
        else break;
        next++;
      }
      steps.push({ ...stepOf(command), listings, files: shown });
    }
    if (steps.length === 0) throw new Error(`Example without a command to run:\n${fence.text}`);
    return [{ files, steps }];
  });
}

/** The part of a page from a heading up to the next heading of the same level. */
export function findSection(page: string, heading: string): string {
  const level = /^#+/.exec(heading)?.[0] ?? "";
  const lines = page.split("\n");
  const start = lines.indexOf(heading);
  if (start === -1) return "";
  const length = lines
    .slice(start + 1)
    .findIndex((line) => line.startsWith(`${level} `));
  return lines.slice(start, length === -1 ? undefined : start + 1 + length).join("\n");
}

export interface FieldRow {
  readonly field: string;
  readonly required: boolean;
}

/** Rows of a table that starts with a field in code and says `Yes` or `No`. */
export function findFieldRows(section: string): FieldRow[] {
  return [...section.matchAll(/^\|\s*`(\w+)`\s*\|\s*(Yes|No)\s*\|/gm)].map((match) => ({
    field: match[1] ?? "",
    required: match[2] === "Yes",
  }));
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

/** The ids GitHub gives the headings of a page: lowercase, without punctuation, with dashes for spaces. */
export function headingIds(page: string): string[] {
  const withoutFences = page.replace(/^(`{3,}|~{3,}).*\n[\s\S]*?^\1[`~]*\s*$/gm, "");
  return [...withoutFences.matchAll(/^#{1,6} (.+)$/gm)].map(([, heading = ""]) =>
    heading
      .toLowerCase()
      .replaceAll(/[^\p{L}\p{N}\s_-]/gu, "")
      .replaceAll(" ", "-"),
  );
}

/** Whether `source` declares `symbol`: a function, class, type, constant or private method. */
export function declaresSymbol(source: string, symbol: string): boolean {
  if (symbol.startsWith("#")) return new RegExp(`^\\s*(?:async\\s+)?${symbol}\\(`, "m").test(source);
  return new RegExp(`\\b(?:function|class|interface|type|const)\\s+${symbol}\\b`).test(source);
}
