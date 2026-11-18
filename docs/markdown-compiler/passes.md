# Passes

After block parsing, a series of _passes_ each take the syntax tree and return a new one. Each pass does one job, so the
parsers stay simple and each feature can be tested alone.

[`parseMarkdown`](../../src/markdown/index.ts) runs them in this order:

| #   | Pass                                                                    | Job                                             |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | [`applyBlockExtensions`](../../src/markdown/passes/block-extensions.ts) | Recognises task list items and callouts         |
| 2   | [`resolveInlines`](../../src/markdown/passes/resolve-inlines.ts)        | Collects link definitions, then parses all text |
| 3   | [`assignHeadingIds`](../../src/markdown/passes/heading-ids.ts)          | Gives headings unique ids (optional)            |
| 4   | [`resolveFootnotes`](../../src/markdown/passes/resolve-footnotes.ts)    | Connects, numbers and moves footnotes           |
| 5   | [`escapeRawHtml`](../../src/markdown/passes/escape-raw-html.ts)         | Turns raw HTML into text (optional)             |

## Why the order matters

- **Extensions run before inline parsing**, because `[x]` and `[!NOTE]` must be removed from the text before it is parsed.
- **Inline parsing runs before heading ids**, because an id is built from the heading's plain text, without its formatting.
- **Inline parsing runs before footnotes**, because references are found while parsing text.
- **Escaping runs last**, so it also reaches the notes that the footnote pass moved to the end of the document.

## Task lists and callouts

Both are valid Markdown before they are extensions: a task item is a list item whose text starts with `[ ]`, and a callout is
a block quote whose first line is `[!NOTE]`. So the block parser doesn't need to know about them.
[`sliceParagraph`](../../src/markdown/passes/block-extensions.ts) removes the marker and keeps every position exact.

## Inline parsing and link definitions

A link can use a definition further down the file:

<!-- example -->
```markdown
See [the guide][guide].

[guide]: /guide
```

```html
<p>See <a href="/guide">the guide</a>.</p>
```

So [`resolveInlines`](../../src/markdown/passes/resolve-inlines.ts) works in two steps. It first collects every definition in
the document and removes it from its paragraph. Then it runs the inline parser on all text. If a label is defined twice, the
first definition wins.

## Heading ids

[`slugify`](../../src/markdown/passes/heading-ids.ts) lowercases the text, removes punctuation and joins words with hyphens.
Letters of every alphabet are kept. Repeated headings get `-1`, `-2` and so on.

<!-- example -->
```markdown
# What's New?

# What's New?
```

```html
<h1 id="whats-new">What's New?</h1>
<h1 id="whats-new-1">What's New?</h1>
```

## Footnotes

[`resolveFootnotes`](../../src/markdown/passes/resolve-footnotes.ts) works in three steps:

1. **Collect.** Remove every definition from the tree and remember it by its label.
2. **Connect.** Walk the document in reading order. The first reference to a note gives it the next number.
3. **Follow notes.** A note can reference another note, so notes are processed from a queue that can grow.

The finished notes are stored in `Document.footnotes` and rendered at the end of the page. A definition that is never referenced
is left out, with a [warning](diagnostics.md).

## Escaping raw HTML

With `rawHtml: "escape"`, [`escapeRawHtml`](../../src/markdown/passes/escape-raw-html.ts) replaces HTML blocks with paragraphs and
inline HTML with text. Because this is a separate pass, the renderer needs no options.

## Output

[`renderHtml`](../../src/markdown/output/render-html.ts) is the only code that produces HTML, so escaping is handled in one place
([`escapeHtml`](../../src/markdown/output/render-html.ts)). [`buildTableOfContents`](../../src/markdown/output/table-of-contents.ts)
nests the document's top-level headings by level and returns data, so themes decide how it looks.
