# Colors in code

Gensane colors the code blocks of a site by itself, when it builds, so readers get colored code with no script and no dependency.
It knows the languages a developer's blog uses most, by any of these names after the three backticks:

| Language                | Names                                                      |
| ----------------------- | ---------------------------------------------------------- |
| JavaScript, TypeScript  | `js`, `javascript`, `jsx`, `mjs`, `cjs`, `ts`, `typescript`, `tsx`, `mts` |
| JSON                    | `json`, `jsonc`                                            |
| CSS                     | `css`                                                      |
| HTML                    | `html`, `xml`, `svg`, with `<script>` and `<style>` colored in their own languages |
| Shell                   | `sh`, `bash`, `shell`, `zsh`                               |
| Python                  | `py`, `python`                                             |
| Rust                    | `rs`, `rust`                                               |
| Go                      | `go`, `golang`                                             |

A block in any other language, or without one, stays as it is.

## What it colors

Four kinds of words, each in a `<span>` with a class the theme styles; the default theme takes the colors from the palette, so they
fit the site and are readable in light and dark:

| Class        | What                                              | Default theme          |
| ------------ | ------------------------------------------------- | ---------------------- |
| `hl-keyword` | Keywords such as `const`, `def` and `fn`, HTML tag names and CSS at-rules such as `@media` | The accent color |
| `hl-string`  | Text in quotes, and Rust's and Go's `'a'`          | The green of tips      |
| `hl-number`  | Numbers, with CSS units such as `12px`, and colors such as `#fff` | The amber of warnings |
| `hl-comment` | Comments                                          | The muted color, in italics |

It reads code the way the language does in the parts that matter for color: a `#` starts a comment in shell only at the start of a
word, an apostrophe in HTML text is just text, a Rust lifetime such as `'a` is not a string, and only a backtick string or a block
comment goes on after the end of a line.

## Using another highlighter, or none

A `highlight` function in the [config](../cli/config.md#markdown) replaces it, such as one made with [Shiki](https://shiki.style), and
`highlight: false` leaves every block as it is.

## How it is built and tested

[`src/highlight/`](../../src/highlight) is a module of its own, with no I/O. One scanner covers every language but HTML, driven by a
table of each language's comments, quotes and keywords; HTML has a scanner of its own, because the same character means something
else inside and outside a tag.

Besides examples for each language, two property tests run on thousands of pieces of code-like text in every language: removing the
spans gives back exactly the code, character for character, and the output has no HTML but its own spans. A test of long code checks
it stays fast.
