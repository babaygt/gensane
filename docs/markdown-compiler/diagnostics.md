# Warnings

Markdown has no syntax errors, so these are all warnings: the page is still built. Each warning has a stable code, a message, a hint,
and the exact position in the file ([`Diagnostic`](../../src/diagnostics/diagnostic.ts)).

| Code  | Meaning                                                         |
| ----- | --------------------------------------------------------------- |
| GS101 | A code block is never closed                                    |
| GS102 | An underlined heading is not supported                          |
| GS103 | An indented code block is not supported                         |
| GS104 | A table's header and delimiter row have different column counts |
| GS105 | Blocks are nested too deeply                                    |
| GS106 | An HTML block is never closed                                   |
| GS107 | A footnote is never referenced                                  |
| GS108 | A footnote reference has no definition                          |
| GS109 | A footnote is defined more than once                            |

### GS101

A code fence has no closing fence, so the rest of the container is treated as code.

<!-- warns GS101 -->
````markdown
```ts
const answer = 42;
````

**Fix:** add a closing line of three backticks after the last line of code.

### GS102

Gensane doesn't support headings underlined with `===` or `---`. A `===` line is read as text, and a `---` line directly under text
becomes a horizontal rule.

<!-- warns GS102 -->
```markdown
Title
=====
```

**Fix:** write `# Title`. If you meant a horizontal rule, put a blank line before `---`.

### GS103

Code indented by four spaces is read as a normal paragraph.

<!-- warns GS103 -->
```markdown
Introduction

    const answer = 42;
```

**Fix:** put the code in a fenced code block, or remove the indentation if it is text.

### GS104

The header row and the row of dashes must have the same number of columns. Otherwise the lines stay plain text.

<!-- warns GS104 -->
```markdown
| Name | Age |
| ---- |
```

**Fix:** give both rows the same number of columns.

### GS105

Block quotes, lists and footnotes can be nested up to 256 levels deep. Deeper lines are read as text. This limit protects the compiler
from extremely deep input.

**Fix:** reduce the nesting.

### GS106

A comment, script, style or similar HTML block has no end marker, so everything after it is treated as raw HTML.

<!-- warns GS106 -->
```markdown
<!-- this comment is never closed

More text
```

**Fix:** add the end marker named in the warning, such as `-->`.

### GS107

A footnote is defined but nothing refers to it, so it isn't shown.

<!-- warns GS107 -->
```markdown
Some text.

[^note]: Nobody refers to this note.
```

**Fix:** refer to it with `[^note]`, or remove the definition.

### GS108

A reference points at a footnote that doesn't exist. It is shown as plain text.

<!-- warns GS108 -->
```markdown
See the details[^missing].
```

**Fix:** add a definition such as `[^missing]: The note.`, or remove the reference.

### GS109

Two footnotes use the same label. Labels ignore upper and lower case, and the first definition is used.

<!-- warns GS109 -->
```markdown
Text[^note].

[^note]: First.

[^NOTE]: Second.
```

**Fix:** give the second footnote its own label, or remove it.
