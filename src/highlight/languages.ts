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

const sql: LanguageSpec = {
  lineComments: ["--"],
  blockComments: [["/*", "*/"]],
  // A double quote names a table or a column, so only single quotes start text.
  quotes: ["'"],
  keywordsInAnyCase: true,
  keywords: words(`
    add all alter and as asc begin between by cascade case check column commit constraint create cross default
    delete desc distinct drop else end exists false foreign from full function grant group having if in index
    inner insert into is join key left like limit not null offset on or order outer primary references
    replace returning returns revoke right rollback select set table then transaction trigger true union unique
    update using values view when where with
    analyze concurrently explain filter lateral materialized over partition recursive vacuum window
    bigint bigserial boolean char date decimal int integer interval json jsonb numeric real serial smallint
    text time timestamp timestamptz uuid varchar`),
};

const yaml: LanguageSpec = {
  lineComments: ["#"],
  blockComments: [],
  quotes: ['"', "'"],
  commentsStartWords: true,
  apostrophes: true,
  keywords: words("true false null"),
};

/** Its instructions are written in capitals, so the same words in its shell commands stay plain. */
const dockerfile: LanguageSpec = {
  lineComments: ["#"],
  blockComments: [],
  quotes: ['"', "'"],
  commentsStartWords: true,
  keywords: words(`
    ADD ARG AS CMD COPY ENTRYPOINT ENV EXPOSE FROM HEALTHCHECK LABEL MAINTAINER ONBUILD RUN SHELL STOPSIGNAL
    USER VOLUME WORKDIR`),
};

/** HTML has a scanner of its own; the others share one, with these tables. */
export const SPECS = {
  javascript,
  json,
  css,
  shell,
  python,
  rust,
  go,
  sql,
  yaml,
  dockerfile,
} as const;

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
  sql: "sql",
  pgsql: "sql",
  postgres: "sql",
  postgresql: "sql",
  mysql: "sql",
  sqlite: "sql",
  yaml: "yaml",
  yml: "yaml",
  dockerfile: "dockerfile",
  docker: "dockerfile",
};
