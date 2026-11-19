import type { Diagnostic } from "../diagnostics/index.ts";
import { type ContentEntry, type LoadOptions, loadContent } from "./index.ts";

/** The shortest valid frontmatter for each type of content. */
export const minimal = {
  post: "---\ntitle: Hello\ndate: 2026-11-17\n---\n",
  page: "---\ntitle: About\n---\n",
  project: "---\ntitle: Gensane\n---\n",
  talk: "---\ntitle: A talk\nevent: JSConf\ndate: 2026-06-12\n---\n",
  experience: "---\ncompany: Acme\nrole: Engineer\nstart: 2024-06\n---\n",
  education: "---\nschool: CODE\ndegree: BSc\nstart: 2023-09\n---\n",
} as const;

export function loaded(
  files: Readonly<Record<string, string>>,
  options: LoadOptions = {},
): readonly ContentEntry[] {
  const result = loadContent(files, options);
  if (!result.ok) throw new Error(result.error[0]?.message);
  return result.value.entries;
}

export function entryOf(files: Readonly<Record<string, string>>, path: string): ContentEntry {
  const entry = loaded(files).find((candidate) => candidate.file === path);
  if (entry === undefined) throw new Error(`No entry for ${path}`);
  return entry;
}

/** Errors when loading fails, otherwise warnings. */
export function problems(files: Readonly<Record<string, string>>): readonly Diagnostic[] {
  const result = loadContent(files);
  return result.ok ? result.value.warnings : result.error;
}

export function codes(files: Readonly<Record<string, string>>): string[] {
  return problems(files).map((problem) => problem.code);
}

/** A template for every kind of page, each printing the title, so that a site always builds. */
export const plainTheme: Readonly<Record<string, string>> = Object.fromEntries(
  [
    "home",
    "post",
    "blog",
    "tag",
    "tags",
    "project",
    "projects",
    "talks",
    "about",
    "page",
    "404",
  ].map((name) => [`${name}.html`, `<h1>{{ page.title }}</h1>`]),
);
