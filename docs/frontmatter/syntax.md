# Supported syntax

Frontmatter uses a small, predictable part of [YAML](https://yaml.org/). The block starts on the very first line of the file with `---` and
ends at the next `---` line. A file that doesn't start with `---` has no frontmatter, and all of it is body.

## Values

A value's type comes from how it is written.

<!-- reads -->
```yaml
---
title: Hello world
views: 42
rating: 4.5
draft: false
cover: null
summary:
date: 2026-11-18
---
```

```json
{
  "title": "Hello world",
  "views": 42,
  "rating": 4.5,
  "draft": false,
  "cover": null,
  "summary": null,
  "date": "2026-11-18"
}
```

| Written as                          | Read as      |
| ----------------------------------- | ------------ |
| `true`, `false`                     | True or false |
| `42`, `-7`, `3.14`                  | A number     |
| `null`, `~`, or nothing at all      | Empty        |
| `2026-11-18`, `2024-06`             | A date       |
| Anything else                       | Text         |

Only those exact spellings count. In many YAML parsers `no` means false and `007` means 7, which surprises people, so here they stay text. A
whole number too large to store exactly stays text too, so no digits are lost.

<!-- reads -->
```yaml
---
answer: no
agent: 007
hex: 0x10
serial: 12345678901234567890
---
```

```json
{
  "answer": "no",
  "agent": "007",
  "hex": "0x10",
  "serial": "12345678901234567890"
}
```

## Quotes

Use quotes when text would otherwise mean something else, such as a colon followed by a space.

<!-- reads -->
```yaml
---
title: "Testing: a guide"
version: "1984"
line: "first\nsecond"
path: 'C:\new\docs'
note: 'it''s here'
---
```

```json
{
  "title": "Testing: a guide",
  "version": "1984",
  "line": "first\nsecond",
  "path": "C:\\new\\docs",
  "note": "it's here"
}
```

| Quotes | Special characters                                                          |
| ------ | --------------------------------------------------------------------------- |
| `"…"`  | `\"`, `\\`, `\/`, `\n`, `\t`, `\r`, `\b`, `\f`, `\0` and `\u00e9`           |
| `'…'`  | Nothing is escaped, except that `''` stands for one `'`                     |

## Dates

| Written as             | Meaning              |
| ---------------------- | -------------------- |
| `2026-11-18`           | A day                |
| `2024-06`              | A month              |
| `2026-11-18T10:30:00Z` | A day and a time     |

The year always comes first, because `03-04-2026` means March in some countries and April in others. A date that doesn't exist, such as
`2026-02-30`, is an error. Other spellings are text, and the [content rules](content-types.md) then explain how to write them.

## Lists

A list can be written on one line, or with one item per line.

<!-- reads -->
```yaml
---
stack: [TypeScript, Node]
topics:
  - testing
  - compilers
empty: []
---
```

```json
{
  "stack": ["TypeScript", "Node"],
  "topics": ["testing", "compilers"],
  "empty": []
}
```

## Nested settings

Indentation with spaces shows what belongs together. Tabs can't be used for indentation.

<!-- reads -->
```yaml
---
author:
  name: Ada
  links:
    - name: Site
      url: https://example.com
---
```

```json
{
  "author": {
    "name": "Ada",
    "links": [{ "name": "Site", "url": "https://example.com" }]
  }
}
```

## Comments

A `#` starts a comment at the beginning of a line or after a space, so `C#` stays text.

<!-- reads -->
```yaml
---
# The language of this post
language: C# # after a space, this is a comment
---
```

```json
{
  "language": "C#"
}
```

## Keys

A key starts with a letter or `_`, and continues with letters, digits, `_`, `-` and `.`. Each key can be used once at its level.

## Left out on purpose

Each of these is an [error](diagnostics.md) with a hint, so nothing is silently read the wrong way.

| YAML feature             | Example          | Why it is left out                                             |
| ------------------------ | ---------------- | -------------------------------------------------------------- |
| Maps on one line         | `{name: Ada}`    | Indented lines do the same and are easier to read              |
| Anchors and aliases      | `&a`, `*a`       | They make values depend on other parts of the file             |
| Tags                     | `!date`          | The way a value is written already decides its type            |
| Multi-line text          | `\|`, `>`        | Long text belongs in the body, or on one line in quotes        |
