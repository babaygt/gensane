# Code reference

Every source file of the compiler and its most important functions. Select a name to open its file, then search for that name. Names starting
with `#` are private methods of a parser class.

## Public API and shared types

### [`src/markdown/index.ts`](../../src/markdown/index.ts)

The public entry point of the compiler.

| Name                                             | Purpose                                  |
| ------------------------------------------------ | ---------------------------------------- |
| [`parseMarkdown`](../../src/markdown/index.ts)   | Runs all parsing stages and passes       |
| [`markdownToHtml`](../../src/markdown/index.ts)  | Parses and renders in one step           |
| [`MarkdownOptions`](../../src/markdown/index.ts) | The `rawHtml`, `headingIds` and `highlight` options |
| [`CompileResult`](../../src/markdown/index.ts)   | The HTML, table of contents and warnings |

### [`src/markdown/ast.ts`](../../src/markdown/ast.ts)

The syntax tree shared by all stages.

| Name                                       | Purpose                                 |
| ------------------------------------------ | --------------------------------------- |
| [`Document`](../../src/markdown/ast.ts)    | The root of the tree                    |
| [`Block`](../../src/markdown/ast.ts)       | Every kind of block                     |
| [`Inline`](../../src/markdown/ast.ts)      | Every kind of inline node               |
| [`TextSegment`](../../src/markdown/ast.ts) | Maps text back to its place in the file |

### [`src/markdown/diagnostic-codes.ts`](../../src/markdown/diagnostic-codes.ts)

The stable code of every warning.

| Name                                                        | Purpose                           |
| ----------------------------------------------------------- | --------------------------------- |
| [`DiagnosticCodes`](../../src/markdown/diagnostic-codes.ts) | All warning codes, GS101 to GS109 |

## Blocks

### [`src/markdown/blocks/lines.ts`](../../src/markdown/blocks/lines.ts)

Splits text into lines that remember their position.

| Name                                                  | Purpose                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| [`splitLines`](../../src/markdown/blocks/lines.ts)    | Splits on `\n`, `\r\n` or `\r`                               |
| [`SourceLine`](../../src/markdown/blocks/lines.ts)    | A line and its offsets in the file                           |
| [`leadingIndent`](../../src/markdown/blocks/lines.ts) | Measures indentation, with tab stops                         |
| [`isBlank`](../../src/markdown/blocks/lines.ts)       | Whether a line holds only whitespace                         |
| [`sliceLine`](../../src/markdown/blocks/lines.ts)     | Removes characters from the start of a line, keeping offsets |
| [`stripColumns`](../../src/markdown/blocks/lines.ts)  | Removes indentation up to a given width                      |

### [`src/markdown/blocks/block-rules.ts`](../../src/markdown/blocks/block-rules.ts)

Recognises what a single line is.

| Name                                                                  | Purpose                                     |
| --------------------------------------------------------------------- | ------------------------------------------- |
| [`matchAtxHeading`](../../src/markdown/blocks/block-rules.ts)         | `## Title`                                  |
| [`isThematicBreak`](../../src/markdown/blocks/block-rules.ts)         | `---`, `***`, `___`                         |
| [`matchFenceOpen`](../../src/markdown/blocks/block-rules.ts)          | The opening line of a code fence            |
| [`isFenceClose`](../../src/markdown/blocks/block-rules.ts)            | The matching closing fence                  |
| [`isSetextUnderline`](../../src/markdown/blocks/block-rules.ts)       | Detects unsupported underlined headings     |
| [`matchBlockQuote`](../../src/markdown/blocks/block-rules.ts)         | `>`                                         |
| [`matchListMarker`](../../src/markdown/blocks/block-rules.ts)         | `-`, `+`, `*`, `1.`, `1)`                   |
| [`isSameListType`](../../src/markdown/blocks/block-rules.ts)          | Whether two markers belong to the same list |
| [`matchFootnoteDefinition`](../../src/markdown/blocks/block-rules.ts) | `[^label]:`                                 |

### [`src/markdown/blocks/table-rules.ts`](../../src/markdown/blocks/table-rules.ts)

Recognises table rows.

| Name                                                            | Purpose                                     |
| --------------------------------------------------------------- | ------------------------------------------- |
| [`splitTableRow`](../../src/markdown/blocks/table-rules.ts)     | Splits a row into cells on unescaped pipes  |
| [`matchDelimiterRow`](../../src/markdown/blocks/table-rules.ts) | Reads column alignment from a row of dashes |

### [`src/markdown/blocks/html-rules.ts`](../../src/markdown/blocks/html-rules.ts)

Recognises raw HTML.

| Name                                                             | Purpose                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| [`matchHtmlBlockStart`](../../src/markdown/blocks/html-rules.ts) | Which of the seven kinds of HTML block a line starts |
| [`endsHtmlBlock`](../../src/markdown/blocks/html-rules.ts)       | Whether a line ends an HTML block                    |
| [`parseRawHtml`](../../src/markdown/blocks/html-rules.ts)        | Finds the end of inline HTML                         |

### [`src/markdown/blocks/block-parser.ts`](../../src/markdown/blocks/block-parser.ts)

Groups lines into blocks.

| Name                                                                       | Purpose                                              |
| -------------------------------------------------------------------------- | ---------------------------------------------------- |
| [`parseBlocks`](../../src/markdown/blocks/block-parser.ts)                 | Entry point: text in, block tree out                 |
| [`BlockParser`](../../src/markdown/blocks/block-parser.ts)                 | The parser for one list of lines                     |
| [`#parseBlock`](../../src/markdown/blocks/block-parser.ts)                 | Decides what the next line starts                    |
| [`#parseFencedCode`](../../src/markdown/blocks/block-parser.ts)            | Code fences                                          |
| [`#parseParagraph`](../../src/markdown/blocks/block-parser.ts)             | Paragraphs and what interrupts them                  |
| [`#parseHtmlBlock`](../../src/markdown/blocks/block-parser.ts)             | HTML blocks                                          |
| [`#parseTable`](../../src/markdown/blocks/block-parser.ts)                 | Tables                                               |
| [`#parseBlockQuote`](../../src/markdown/blocks/block-parser.ts)            | Block quotes                                         |
| [`#parseList`](../../src/markdown/blocks/block-parser.ts)                  | Lists, and tight or loose detection                  |
| [`#parseListItem`](../../src/markdown/blocks/block-parser.ts)              | One list item                                        |
| [`#collectIndentedLines`](../../src/markdown/blocks/block-parser.ts)       | Collects the lines of a list item or note            |
| [`#parseFootnoteDefinition`](../../src/markdown/blocks/block-parser.ts)    | Footnote definitions                                 |
| [`#parseContainer`](../../src/markdown/blocks/block-parser.ts)             | Runs a nested parser on a container's lines          |
| [`interruptsParagraph`](../../src/markdown/blocks/block-parser.ts)         | Lines that end a paragraph without a blank line      |
| [`isLazyCandidate`](../../src/markdown/blocks/block-parser.ts)             | Lines that might continue a paragraph in a container |
| [`hasBlankLineBetweenChildren`](../../src/markdown/blocks/block-parser.ts) | Detects loose list items                             |

## Inlines

### [`src/markdown/inlines/inline-parser.ts`](../../src/markdown/inlines/inline-parser.ts)

Finds the syntax inside a piece of text.

| Name                                                                   | Purpose                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`parseInlines`](../../src/markdown/inlines/inline-parser.ts)          | Entry point: text in, inline nodes out                            |
| [`InlineParser`](../../src/markdown/inlines/inline-parser.ts)          | The parser for one piece of text                                  |
| [`#parseDelimiterRun`](../../src/markdown/inlines/inline-parser.ts)    | Records `*`, `_` and `~~` runs and whether they can open or close |
| [`#processEmphasis`](../../src/markdown/inlines/inline-parser.ts)      | Finishes emphasis above a point in the run list                   |
| [`#pairDelimiters`](../../src/markdown/inlines/inline-parser.ts)       | The pairing algorithm                                             |
| [`#findOpener`](../../src/markdown/inlines/inline-parser.ts)           | Searches backwards for a matching opener                          |
| [`#wrap`](../../src/markdown/inlines/inline-parser.ts)                 | Builds an emphasis, strong or strikethrough node                  |
| [`#parseCodeSpan`](../../src/markdown/inlines/inline-parser.ts)        | Code spans                                                        |
| [`#findClosingBackticks`](../../src/markdown/inlines/inline-parser.ts) | Finds the end of a code span without rescanning                   |
| [`#parseOpeningBracket`](../../src/markdown/inlines/inline-parser.ts)  | Footnote references and link openers                              |
| [`#closeBracket`](../../src/markdown/inlines/inline-parser.ts)         | Completes a link or image                                         |
| [`#linkTarget`](../../src/markdown/inlines/inline-parser.ts)           | Tries the link forms after `]`                                    |
| [`#parseAngleBracket`](../../src/markdown/inlines/inline-parser.ts)    | Autolinks and raw HTML                                            |
| [`#sourcePosition`](../../src/markdown/inlines/inline-parser.ts)       | Maps an index in the text back to the file                        |
| [`breaksRuleOfThree`](../../src/markdown/inlines/inline-parser.ts)     | CommonMark's rule of three                                        |

### [`src/markdown/inlines/link-syntax.ts`](../../src/markdown/inlines/link-syntax.ts)

Reads the pieces of a link.

| Name                                                                    | Purpose                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------- |
| [`normalizeLabel`](../../src/markdown/inlines/link-syntax.ts)           | Makes labels match regardless of case and spacing |
| [`parseLinkLabel`](../../src/markdown/inlines/link-syntax.ts)           | `[label]`                                         |
| [`parseLinkDestination`](../../src/markdown/inlines/link-syntax.ts)     | `/url` or `<url with spaces>`                     |
| [`parseLinkTitle`](../../src/markdown/inlines/link-syntax.ts)           | `"title"`                                         |
| [`parseReferenceDefinition`](../../src/markdown/inlines/link-syntax.ts) | `[label]: /url "title"`                           |
| [`parseAutolink`](../../src/markdown/inlines/link-syntax.ts)            | `<https://example.com>`                           |

### [`src/markdown/inlines/character-references.ts`](../../src/markdown/inlines/character-references.ts)

Decodes `&copy;` and similar references.

| Name                                                                             | Purpose                                           |
| -------------------------------------------------------------------------------- | ------------------------------------------------- |
| [`decodeCharacterReference`](../../src/markdown/inlines/character-references.ts) | Decodes one reference                             |
| [`unescapeString`](../../src/markdown/inlines/character-references.ts)           | Resolves escapes and references in a URL or title |

### [`src/markdown/inlines/html-entities.ts`](../../src/markdown/inlines/html-entities.ts)

Generated data.

| Name                                                           | Purpose                                    |
| -------------------------------------------------------------- | ------------------------------------------ |
| [`HTML_ENTITIES`](../../src/markdown/inlines/html-entities.ts) | The 2,125 named HTML5 character references |

## Passes

### [`src/markdown/passes/block-extensions.ts`](../../src/markdown/passes/block-extensions.ts)

Task lists and callouts.

| Name                                                                    | Purpose                                                        |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`applyBlockExtensions`](../../src/markdown/passes/block-extensions.ts) | Runs the pass                                                  |
| [`recogniseTask`](../../src/markdown/passes/block-extensions.ts)        | Finds `[ ]` and `[x]` in a list item                           |
| [`recogniseCallout`](../../src/markdown/passes/block-extensions.ts)     | Finds `[!NOTE]` in a block quote                               |
| [`sliceParagraph`](../../src/markdown/passes/block-extensions.ts)       | Removes text from a paragraph's start, keeping positions exact |

### [`src/markdown/passes/resolve-inlines.ts`](../../src/markdown/passes/resolve-inlines.ts)

Runs the inline parser over the tree.

| Name                                                                 | Purpose                                   |
| -------------------------------------------------------------------- | ----------------------------------------- |
| [`resolveInlines`](../../src/markdown/passes/resolve-inlines.ts)     | Runs the pass                             |
| [`withoutDefinitions`](../../src/markdown/passes/resolve-inlines.ts) | Takes link definitions out of a paragraph |

### [`src/markdown/passes/heading-ids.ts`](../../src/markdown/passes/heading-ids.ts)

Unique ids for headings.

| Name                                                           | Purpose                       |
| -------------------------------------------------------------- | ----------------------------- |
| [`assignHeadingIds`](../../src/markdown/passes/heading-ids.ts) | Runs the pass                 |
| [`slugify`](../../src/markdown/passes/heading-ids.ts)          | Turns heading text into an id |

### [`src/markdown/passes/resolve-footnotes.ts`](../../src/markdown/passes/resolve-footnotes.ts)

Connects footnotes.

| Name                                                                 | Purpose       |
| -------------------------------------------------------------------- | ------------- |
| [`resolveFootnotes`](../../src/markdown/passes/resolve-footnotes.ts) | Runs the pass |

### [`src/markdown/passes/escape-raw-html.ts`](../../src/markdown/passes/escape-raw-html.ts)

The `rawHtml: "escape"` option.

| Name                                                            | Purpose       |
| --------------------------------------------------------------- | ------------- |
| [`escapeRawHtml`](../../src/markdown/passes/escape-raw-html.ts) | Runs the pass |

### [`src/markdown/passes/highlight-code.ts`](../../src/markdown/passes/highlight-code.ts)

The `highlight` option.

| Name                                                          | Purpose                                         |
| ------------------------------------------------------------- | ----------------------------------------------- |
| [`highlightCode`](../../src/markdown/passes/highlight-code.ts) | Runs the pass                                  |
| [`Highlighter`](../../src/markdown/passes/highlight-code.ts)   | Gets the code and language, gives HTML or nothing |

## Output

### [`src/markdown/output/render-html.ts`](../../src/markdown/output/render-html.ts)

Turns the tree into HTML.

| Name                                                          | Purpose                                  |
| ------------------------------------------------------------- | ---------------------------------------- |
| [`renderHtml`](../../src/markdown/output/render-html.ts)      | Entry point                              |
| [`renderBlock`](../../src/markdown/output/render-html.ts)     | Renders one block                        |
| [`renderInline`](../../src/markdown/output/render-html.ts)    | Renders one inline node                  |
| [`renderListItem`](../../src/markdown/output/render-html.ts)  | List items, tight lists and checkboxes   |
| [`renderTable`](../../src/markdown/output/render-html.ts)     | Tables                                   |
| [`renderCallout`](../../src/markdown/output/render-html.ts)   | Callouts                                 |
| [`renderFootnotes`](../../src/markdown/output/render-html.ts) | The list of notes at the end of the page |
| [`renderUrl`](../../src/markdown/output/render-html.ts)       | Percent-encodes URLs                     |
| [`escapeHtml`](../../src/markdown/output/render-html.ts)      | Makes text safe to place in HTML         |

### [`src/markdown/output/inline-text.ts`](../../src/markdown/output/inline-text.ts)

Plain text of inline nodes.

| Name                                                      | Purpose                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`plainTextOf`](../../src/markdown/output/inline-text.ts) | Removes formatting; used for ids, image descriptions and the table of contents |

### [`src/markdown/output/table-of-contents.ts`](../../src/markdown/output/table-of-contents.ts)

Builds the table of contents.

| Name                                                                     | Purpose                           |
| ------------------------------------------------------------------------ | --------------------------------- |
| [`buildTableOfContents`](../../src/markdown/output/table-of-contents.ts) | Nests top-level headings by level |
| [`TableOfContentsEntry`](../../src/markdown/output/table-of-contents.ts) | One entry of the result           |
