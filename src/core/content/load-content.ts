/**
 * Turns the files of the content folder into entries. The folder decides the type of content,
 * the frontmatter is checked against the rules for that type, the body becomes HTML, and the
 * file name or `slug:` decides the URL.
 */
import {
  type Diagnostic,
  type Result,
  type SourcePosition,
  type SourceSpan,
  err,
  hasErrors,
  ok,
} from "../../diagnostics/index.ts";
import {
  type ContentFields,
  type ContentType,
  type MapValue,
  parseFrontmatter,
  validateContent,
} from "../../frontmatter/index.ts";
import {
  type MarkdownOptions,
  buildTableOfContents,
  parseMarkdown,
  renderHtml,
} from "../../markdown/index.ts";
import { CoreCodes } from "../diagnostic-codes.ts";
import { inFileOrder, problem, startOf } from "../problems.ts";
import type { ContentEntry, EntryDetails } from "./entries.ts";
import { FOLDERS } from "./folders.ts";
import { isValidSlug, slugFromFileName, slugify } from "./slugs.ts";
import { excerptOf, readingTimeOf } from "./summary.ts";

export interface LoadOptions {
  readonly markdown?: MarkdownOptions;
  /** Where the content files are, for the paths in problems. Defaults to `content`. */
  readonly contentFolder?: string;
}

export interface LoadedContent {
  /** In the order of their paths, so that a build never depends on the order files were read. */
  readonly entries: readonly ContentEntry[];
  readonly warnings: readonly Diagnostic[];
}

/** What the build gives templates under these names, which a field of the same name can't replace. */
const BUILT_FIELDS: Readonly<Record<string, string>> = {
  url: "the address of the page",
  slug: "the slug of the page",
  type: "the type of content",
  html: "the HTML of the body",
  excerpt: "the excerpt",
  toc: "the table of contents",
  readingTime: "the reading time",
};

/** A field of one's own named like one of the build's is lost in templates, so it is worth a warning. */
function hiddenFields(
  extra: Readonly<Record<string, unknown>>,
  data: MapValue,
  start: SourceSpan,
): Diagnostic[] {
  return Object.keys(extra).flatMap((name) => {
    const meaning = BUILT_FIELDS[name];
    if (meaning === undefined) return [];
    return [
      problem(
        CoreCodes.hiddenField,
        `templates see "${name}" as ${meaning}, not as this field`,
        data.entries.find((entry) => entry.key === name)?.keySpan ?? start,
        "give the field another name",
        "warning",
      ),
    ];
  });
}

const LISTED_FOLDERS = `${[...FOLDERS.keys()].slice(0, -1).join(", ")} or ${[...FOLDERS.keys()].at(-1)}`;

/** Only these types have pages of their own. */
const URL_PREFIXES: Partial<Record<ContentType, string>> = {
  post: "/blog/",
  project: "/projects/",
  page: "/",
};

const HOME_PAGE = "index.md";

interface LoadedFile {
  readonly entry: ContentEntry | undefined;
  readonly problems: readonly Diagnostic[];
}

function typeOf(path: string): ContentType | undefined {
  if (path === HOME_PAGE) return "page";
  const [folder] = path.split("/");
  return folder === undefined ? undefined : FOLDERS.get(folder);
}

function spanOfField(data: MapValue, key: string): SourceSpan | undefined {
  return data.entries.find((entry) => entry.key === key)?.value.span;
}

/** The Markdown compiler counts from the start of the body, which always starts a line. */
function moveBy(diagnostic: Diagnostic, bodyStart: SourcePosition): Diagnostic {
  const move = (position: SourcePosition): SourcePosition => ({
    ...position,
    line: position.line + bodyStart.line - 1,
    offset: position.offset + bodyStart.offset,
  });
  const { span } = diagnostic;
  return { ...diagnostic, span: { ...span, start: move(span.start), end: move(span.end) } };
}

/** TypeScript can't connect a type of content with its fields through a generic, so they are joined here. */
function entryOf<Type extends ContentType>(
  type: Type,
  fields: ContentFields<Type>,
  details: EntryDetails,
): ContentEntry {
  return { type, fields, ...details } as ContentEntry;
}

function failedWith(problems: readonly Diagnostic[]): LoadedFile {
  return { entry: undefined, problems };
}

class ContentLoader {
  readonly #folder: string;
  readonly #markdown: MarkdownOptions;

  constructor(options: LoadOptions) {
    this.#folder = options.contentFolder ?? "content";
    this.#markdown = options.markdown ?? {};
  }

  load(files: Readonly<Record<string, string>>): Result<LoadedContent, readonly Diagnostic[]> {
    const loaded = Object.keys(files)
      .toSorted()
      .map((path) => this.#loadFile(path, files[path] ?? ""));
    const problems = [...loaded.flatMap((file) => file.problems), ...this.#checkUrls(loaded)];
    const sorted = inFileOrder(problems);
    if (hasErrors(sorted)) return err(sorted);
    const entries = loaded.flatMap((file) => (file.entry === undefined ? [] : [file.entry]));
    return ok({ entries, warnings: sorted });
  }

  #loadFile(path: string, source: string): LoadedFile {
    const file = `${this.#folder}/${path}`;
    const start = startOf(file);

    if (!path.endsWith(".md")) {
      return failedWith([
        problem(
          CoreCodes.notMarkdown,
          "this file isn't Markdown, so it isn't part of the site",
          start,
          "put images and other files in the `public` folder",
          "warning",
        ),
      ]);
    }
    const type = typeOf(path);
    if (type === undefined) {
      return failedWith([
        problem(
          CoreCodes.unknownFolder,
          `there is no type of content for "${path}"`,
          start,
          `put it in one of the folders: ${LISTED_FOLDERS}`,
        ),
      ]);
    }

    const parsed = parseFrontmatter(source, file);
    if (!parsed.ok) return failedWith(parsed.error);
    const checked = validateContent(type, parsed.value.data);
    if (!checked.ok) return failedWith(checked.error);

    const { data, body, bodyStart } = parsed.value;
    const { value: fields, extra, warnings } = checked.value;
    const markdown = parseMarkdown(body, file, this.#markdown);
    const problems = [
      ...warnings,
      ...hiddenFields(extra, data, start),
      ...markdown.diagnostics.map((diagnostic) => moveBy(diagnostic, bodyStart)),
    ];

    const name = path.split("/").at(-1) ?? path;
    const fromName = slugFromFileName(name);
    const slugSpan = spanOfField(data, "slug");
    const slugField = "slug" in fields ? fields.slug : undefined;
    let slug = fromName.slug;
    if (slugField !== undefined) {
      if (!isValidSlug(slugField)) {
        return failedWith([...problems, this.#invalidSlug(slugField, slugSpan ?? start)]);
      }
      slug = slugField;
    }

    const prefix = URL_PREFIXES[type];
    if (slug === "" && prefix !== undefined) {
      return failedWith([
        ...problems,
        problem(
          CoreCodes.noSlug,
          `the file name "${name}" has nothing to use in a URL`,
          start,
          "add a `slug:` field, such as `slug: my-post`",
        ),
      ]);
    }

    if ("date" in fields) {
      problems.push(...this.#checkDate(fromName.date, fields.date.text, data, start));
    }

    let url: string | undefined;
    if (path === HOME_PAGE) url = "/";
    else if (prefix !== undefined) url = `${prefix}${slug}/`;
    const html = renderHtml(markdown.document);
    const details: EntryDetails = {
      file: path,
      slug,
      url,
      urlSpan: slugField === undefined ? start : (slugSpan ?? start),
      extra,
      html,
      tableOfContents: buildTableOfContents(markdown.document),
      excerpt: excerptOf(markdown.document),
      readingTime: readingTimeOf(html),
    };
    return {
      entry: entryOf(type, fields, details),
      problems,
    };
  }

  #invalidSlug(slug: string, span: SourceSpan): Diagnostic {
    const suggestion = slugify(slug);
    return problem(
      CoreCodes.invalidSlug,
      `"${slug}" can't be used in a URL, which only allows lowercase letters, digits and single dashes`,
      span,
      suggestion === ""
        ? 'use lowercase letters, digits and dashes, such as "my-post"'
        : `write it as "${suggestion}"`,
    );
  }

  #checkDate(
    fileDate: string | undefined,
    date: string,
    data: MapValue,
    start: SourceSpan,
  ): Diagnostic[] {
    // A file name has only the day, so a time of day doesn't count.
    if (fileDate === undefined || fileDate === date.slice(0, 10)) return [];
    return [
      problem(
        CoreCodes.dateMismatch,
        `the file name says ${fileDate}, but "date" is ${date}`,
        spanOfField(data, "date") ?? start,
        "rename the file, or change the date",
        "warning",
      ),
    ];
  }

  /** Files are read in order of their paths, so the second file with a URL is the one reported. */
  #checkUrls(files: readonly LoadedFile[]): Diagnostic[] {
    const owners = new Map<string, string>();
    const problems: Diagnostic[] = [];
    for (const { entry } of files) {
      if (entry?.url === undefined) continue;
      const owner = owners.get(entry.url);
      if (owner === undefined) {
        owners.set(entry.url, entry.file);
        continue;
      }
      problems.push(
        problem(
          CoreCodes.duplicateUrl,
          `${entry.url} is already the URL of "${this.#folder}/${owner}"`,
          entry.urlSpan,
          "rename one of the files, or give one of them a `slug:`",
        ),
      );
    }
    return problems;
  }
}

export function loadContent(
  files: Readonly<Record<string, string>>,
  options: LoadOptions = {},
): Result<LoadedContent, readonly Diagnostic[]> {
  return new ContentLoader(options).load(files);
}
