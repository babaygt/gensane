# The Markdown compiler

Gensane turns Markdown into HTML with its own compiler, written from scratch in TypeScript with no
runtime dependencies. It follows the [CommonMark 0.31.2 specification](https://spec.commonmark.org/0.31.2/),
adds the GitHub features developers expect, and passes **586 of 652** official spec examples. Every
remaining example is [explained](testing.md).

```ts
import { markdownToHtml } from "./src/markdown/index.ts";

const { html, tableOfContents, diagnostics } = markdownToHtml(
  "# Hello *world*",
  "post.md",
);
```

| Result            | What it is                                                  |
| ----------------- | ----------------------------------------------------------- |
| `html`            | The rendered page content                                   |
| `tableOfContents` | The page's headings as a nested list, for themes to display |
| `diagnostics`     | Warnings with an exact file, line and column                |

Markdown has no syntax errors, so the compiler always produces a page. Input that is probably a mistake
produces a [warning](diagnostics.md) instead of a failure.

## Options

| Option       | Default   | Effect                                                                          |
| ------------ | --------- | ------------------------------------------------------------------------------- |
| `rawHtml`    | `"allow"` | `"escape"` shows HTML written in Markdown as text instead of passing it through |
| `headingIds` | `true`    | `false` leaves `id` attributes off headings                                     |
| `highlight`  | none      | A function that colors code blocks at build time; see [passes](passes.md#highlighting-code) |

## The documentation

| Page                                | Read it to learn                                                     |
| ----------------------------------- | -------------------------------------------------------------------- |
| [Architecture](architecture.md)     | How the stages fit together, with diagrams                           |
| [Supported syntax](syntax.md)       | What you can write, and what is left out on purpose                  |
| [Block parsing](block-parsing.md)   | How lines become headings, lists, quotes and tables                  |
| [Inline parsing](inline-parsing.md) | How emphasis, links and code spans are found inside text             |
| [Passes](passes.md)                 | The steps that run over the syntax tree, and why their order matters |
| [Warnings](diagnostics.md)          | Every warning, with an example and a fix                             |
| [Code reference](code-reference.md) | Each file and its important functions, with links to the code        |
| [Testing](testing.md)               | How the compiler is tested and how conformance is measured           |

The examples on these pages are compiled by the test suite, so they always match what the compiler does.
