# Problems

Every problem has a stable code, a message, a hint and the exact position in the file
([`Diagnostic`](../../src/diagnostics/diagnostic.ts)). GS224 is a warning, and the file can still be used. All the others are errors.

| Code  | Stage      | Meaning                                                 |
| ----- | ---------- | ------------------------------------------------------- |
| GS201 | Parsing    | The frontmatter is never closed                         |
| GS202 | Parsing    | A line is indented with tabs                            |
| GS203 | Parsing    | A line isn't a `key: value` entry, or a list has an empty item |
| GS204 | Parsing    | A key is used twice                                     |
| GS205 | Parsing    | A quoted string is never closed                         |
| GS206 | Parsing    | A backslash starts an unknown escape                    |
| GS207 | Parsing    | A list is never closed                                  |
| GS208 | Parsing    | A line is indented where it can't be                    |
| GS209 | Parsing    | The value uses YAML that isn't supported                |
| GS210 | Parsing    | A date doesn't exist                                    |
| GS211 | Parsing    | Values are nested too deeply                            |
| GS212 | Parsing    | Text contains characters that need quotes               |
| GS213 | Parsing    | There is more text after a value                        |
| GS220 | Validation | A required field is missing                             |
| GS221 | Validation | A value has the wrong type                              |
| GS222 | Validation | A value isn't one of the allowed words                  |
| GS223 | Validation | A value isn't a web address                             |
| GS224 | Validation | A field looks like a typo (warning)                     |
| GS225 | Validation | Text is empty                                           |
| GS226 | Validation | An end date is before the start date                    |

## Parsing

### GS201

The opening `---` has no matching closing line.

<!-- reports GS201 -->
```yaml
---
title: Hello

The body starts here.
```

```text
line 1, column 1: the frontmatter is never closed
hint: add a line with `---` after the last setting
```

### GS202

Tabs have no fixed width, so they can't show how deeply a line is nested.

<!-- reports GS202 -->
```yaml
---
author:
	name: Ada
---
```

```text
line 3, column 1: tabs cannot be used for indentation
hint: indent with spaces instead
```

### GS203

The line isn't a key followed by a colon and a space. A list with two commas in a row reports the same code.

<!-- reports GS203 -->
```yaml
---
title:Hello
---
```

```text
line 2, column 1: expected a `key: value` line
hint: add a space after the colon
```

### GS204

A key can only be used once at each level.

<!-- reports GS204 -->
```yaml
---
title: One
title: Two
---
```

```text
line 3, column 1: the key "title" is used more than once
hint: remove one of them, or rename it
```

### GS205

A string must close on the line where it starts.

<!-- reports GS205 -->
```yaml
---
title: "Hello
---
```

```text
line 2, column 8: this string is never closed
hint: add a closing " at the end of the value
```

### GS206

Inside double quotes, a backslash starts an escape. This often happens with Windows paths.

<!-- reports GS206 -->
```yaml
---
path: "C:\docs"
---
```

```text
line 2, column 10: `\d` is not a valid escape
hint: write a backslash as `\\`, or use single quotes, where nothing is escaped
```

### GS207

A list written with brackets must close on the same line.

<!-- reports GS207 -->
```yaml
---
tags: [typescript, testing
---
```

```text
line 2, column 7: this list is never closed
hint: add a closing `]` on the same line
```

### GS208

A line is indented, but nothing above it can contain it.

<!-- reports GS208 -->
```yaml
---
title: Hello
  subtitle: World
---
```

```text
line 3, column 3: this line is indented, but the entry above already has a value
hint: put long text on one line in quotes, or line this up with the other keys
```

### GS209

The value uses a [YAML feature that is left out on purpose](syntax.md).

<!-- reports GS209 -->
```yaml
---
author: {name: Ada}
---
```

```text
line 2, column 9: inline maps are not supported
hint: write the keys on their own indented lines, or use a list
```

### GS210

The value has the form of a date, but that day doesn't exist.

<!-- reports GS210 -->
```yaml
---
date: 2026-02-30
---
```

```text
line 2, column 7: 2026-02-30 is not a real date
hint: write dates as YYYY-MM-DD or YYYY-MM, or put the value in quotes if it is text
```

### GS211

Maps and lists can be nested up to 64 levels deep. This limit protects the parser from extremely deep input.

<!-- reports GS211 -->
```yaml
---
depth: [[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[
---
```

```text
line 2, column 72: lists are nested more than 64 levels deep
hint: reduce the nesting
```

### GS212

A colon followed by a space would start a new entry, so this text needs quotes.

<!-- reports GS212 -->
```yaml
---
title: Testing: a guide
---
```

```text
line 2, column 8: this text contains characters that have a special meaning here
hint: put the value in quotes: "Testing: a guide"
```

### GS213

A value is complete, but the line goes on.

<!-- reports GS213 -->
```yaml
---
title: "Part one" of two
---
```

```text
line 2, column 19: unexpected text after this value
hint: put the whole value in quotes, or move the extra text into a `# comment`
```

## Validation

### GS220

This type of content can't work without the field. See the [required fields](content-types.md).

<!-- reports GS220 as post -->
```yaml
---
date: 2026-11-18
---
```

```text
line 2, column 1: the required field "title" is missing
hint: add a line such as `title: ...`
```

### GS221

The value has the wrong type. The hint depends on what was written, and shows the correction when there is only one possible answer.

<!-- reports GS221 as post -->
```yaml
---
title: 1984
date: 2026-11-18
---
```

```text
line 2, column 8: "title" must be text, but 1984 is a number
hint: put the value in quotes: "1984"
```

### GS222

The field only allows certain words. A close spelling gets a suggestion, and otherwise the hint lists the words.

<!-- reports GS222 as project -->
```yaml
---
title: Gensane
status: activ
---
```

```text
line 3, column 9: "status" cannot be "activ"
hint: did you mean "active"?
```

### GS223

A web address starts with `http://` or `https://`, and a path on the same site starts with `/`.

<!-- reports GS223 as project -->
```yaml
---
title: Gensane
repo: github.com/example/gensane
---
```

```text
line 3, column 7: "repo" must be a web address, but "github.com/example/gensane" is not one
hint: start it with https://, or with / for a page on this site
```

### GS224

Custom fields are allowed, but this one looks like a misspelling of a field that the file doesn't use yet. The file is still valid.

<!-- reports GS224 as post -->
```yaml
---
title: Hello
date: 2026-11-18
tag: [typescript]
---
```

```text
line 4, column 1: "tag" is not a known field
hint: did you mean "tags"?
```

### GS225

Text can't be empty or contain only spaces.

<!-- reports GS225 as post -->
```yaml
---
title: ""
date: 2026-11-18
---
```

```text
line 2, column 8: "title" is empty
hint: write some text, or remove this line if the field is optional
```

### GS226

A job or degree can't end before it starts.

<!-- reports GS226 as experience -->
```yaml
---
company: Acme
role: Engineer
start: 2024-06
end: 2023-01
---
```

```text
line 5, column 6: "end" (2023-01) is before "start" (2024-06)
hint: check the two dates, or use `end: present` if this is still going on
```
