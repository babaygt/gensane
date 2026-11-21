/** The languages gensane colors by itself, and the names a code block may give them. */
import type { LanguageSpec } from "./scanner.ts";

const words = (text: string): ReadonlySet<string> =>
  new Set(text.split(/\s+/).filter((word) => word !== ""));

const javascript: LanguageSpec = {
  lineComments: ["//"],
  blockComments: [["/*", "*/"]],
  quotes: ['"', "'", "`"],
  keywords: words(`
    abstract as async await break case catch class const continue debugger declare default delete do else enum
    export extends false finally for from function get if implements import in instanceof interface keyof let
    namespace new null of private protected public readonly return satisfies set static super switch this throw
    true try type typeof undefined var void while with yield`),
};

const json: LanguageSpec = {
  lineComments: ["//"],
  blockComments: [["/*", "*/"]],
  quotes: ['"'],
  keywords: words("true false null"),
};

const css: LanguageSpec = {
  lineComments: [],
  blockComments: [["/*", "*/"]],
  quotes: ['"', "'"],
  css: true,
  keywords: words("important"),
};

const shell: LanguageSpec = {
  lineComments: ["#"],
  blockComments: [],
  quotes: ['"', "'"],
  commentsStartWords: true,
  keywords: words(
    "if then else elif fi for while until do done case esac in function return export local readonly unset select time",
  ),
};

const python: LanguageSpec = {
  lineComments: ["#"],
  blockComments: [],
  quotes: ['"', "'"],
  tripleQuotes: true,
  keywords: words(`
    False None True and as assert async await break class continue def del elif else except finally for from
    global if import in is lambda match nonlocal not or pass raise return try while with yield`),
};

const rust: LanguageSpec = {
  lineComments: ["//"],
  blockComments: [["/*", "*/"]],
  quotes: ['"'],
  characterQuotes: true,
  keywords: words(`
    as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move
    mut pub ref return self Self static struct super trait true type unsafe use where while`),
};

const go: LanguageSpec = {
  lineComments: ["//"],
  blockComments: [["/*", "*/"]],
  quotes: ['"', "`"],
  characterQuotes: true,
  keywords: words(`
    break case chan const continue default defer else fallthrough false for func go goto if import interface iota
    map nil package range return select struct switch true type var`),
};

/** HTML has a scanner of its own; the others share one, with these tables. */
export const SPECS = { javascript, json, css, shell, python, rust, go } as const;

/** Every name a code block may use, such as ```ts, for each language. */
export const LANGUAGE_NAMES: Readonly<Record<string, keyof typeof SPECS | "html">> = {
  js: "javascript",
  javascript: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "javascript",
  typescript: "javascript",
  tsx: "javascript",
  mts: "javascript",
  json: "json",
  jsonc: "json",
  css: "css",
  html: "html",
  xml: "html",
  svg: "html",
  sh: "shell",
  bash: "shell",
  shell: "shell",
  zsh: "shell",
  py: "python",
  python: "python",
  rs: "rust",
  rust: "rust",
  go: "go",
  golang: "go",
};
