<!-- Made by scripts/skill.ts from docs/cli/problems.md, docs/frontmatter/diagnostics.md, docs/markdown-compiler/diagnostics.md, docs/template/diagnostics.md, docs/core/diagnostics.md; change those and run pnpm skill. -->

# Problems

Every problem gensane reports, by its code, with what it means and how to fix it.

## The config (GS5xx)

From [https://gensane.dev/docs/reference/commands/problems/](https://gensane.dev/docs/reference/commands/problems/).

### How a problem is printed

Every problem has a code, a message, the place it is, its line of source with a mark under the mistake, and a hint:

- **Errors** stop a build; **warnings** don't. Each module documents its own problems: [Markdown](https://gensane.dev/docs/internals/markdown-compiler/diagnostics/),
  [frontmatter](https://gensane.dev/docs/internals/frontmatter/diagnostics/), [templates](https://gensane.dev/docs/internals/template/diagnostics/) and [the core](https://gensane.dev/docs/reference/site/problems/).
- **A problem in a template** names its file in `theme/`, so the path can be opened from the terminal.
- **A problem without a line**, such as one in the config, names only the file.
- **Problems go to the error stream**, and the line at the end to the normal one, so results can be sent to a file without hiding
  problems.
- **Colors** show only in a terminal, and never when the `NO_COLOR` environment variable is set, as [no-color.org](https://no-color.org)
  asks. Logs in CI stay readable.

### Mistakes in a command

A command that is written wrong exits with 2, says what was wrong, and suggests what was probably meant.

### Problems with the config

The config has no line numbers once it has been run, so these problems point at its file.

#### GS501

There are two config files, so gensane can't know which one is meant.

#### GS502

The config couldn't be run. The message is Node's, and the hint says what usually causes it: TypeScript that needs compiling, a
package that isn't installed, or a mistake in the code.

#### GS503

The config doesn't export its settings as the default export.

#### GS504

A setting that gensane doesn't have.

#### GS505

A setting with a value of the wrong kind, or a filter whose name a template couldn't use.

#### GS506

A warning: a setting of `site` that looks like a misspelled known one, such as `descripton` or a profile such as `githb`. Other
settings of `site` are fine; they are for the templates.

#### GS507

A warning: an `accent` of your own replaces the palette's accent, and it is hard to read on the palette's background. Text needs a
contrast of at least 4.5 to 1 ([WCAG AA](https://www.w3.org/TR/WCAG21/#contrast-minimum)).

## Frontmatter (GS2xx)

From [https://gensane.dev/docs/internals/frontmatter/diagnostics/](https://gensane.dev/docs/internals/frontmatter/diagnostics/).

Every problem has a stable code, a message, a hint and the exact position in the file
([`Diagnostic`](https://github.com/babaygt/gensane/blob/main/src/diagnostics/diagnostic.ts)). GS224 is a warning, and the file can still be used. All the others are errors.

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

### Parsing

#### GS201

The opening `---` has no matching closing line.

#### GS202

Tabs have no fixed width, so they can't show how deeply a line is nested.

#### GS203

The line isn't a key followed by a colon and a space. A list with two commas in a row reports the same code.

#### GS204

A key can only be used once at each level.

#### GS205

A string must close on the line where it starts.

#### GS206

Inside double quotes, a backslash starts an escape. This often happens with Windows paths.

#### GS207

A list written with brackets must close on the same line.

#### GS208

A line is indented, but nothing above it can contain it.

#### GS209

The value uses a [YAML feature that is left out on purpose](https://gensane.dev/docs/reference/content/frontmatter/).

#### GS210

The value has the form of a date, but that day doesn't exist.

#### GS211

Maps and lists can be nested up to 64 levels deep. This limit protects the parser from extremely deep input.

#### GS212

A colon followed by a space would start a new entry, so this text needs quotes.

#### GS213

A value is complete, but the line goes on.

### Validation

#### GS220

This type of content can't work without the field. See the [required fields](https://gensane.dev/docs/reference/content/content-types/).

#### GS221

The value has the wrong type. The hint depends on what was written, and shows the correction when there is only one possible answer.

#### GS222

The field only allows certain words. A close spelling gets a suggestion, and otherwise the hint lists the words.

#### GS223

A web address starts with `http://` or `https://`, and a path on the same site starts with `/`.

#### GS224

Custom fields are allowed, but this one looks like a misspelling of a field that the file doesn't use yet. The file is still valid.

#### GS225

Text can't be empty or contain only spaces.

#### GS226

A job or degree can't end before it starts.

## Markdown (GS1xx)

From [https://gensane.dev/docs/internals/markdown-compiler/diagnostics/](https://gensane.dev/docs/internals/markdown-compiler/diagnostics/).

Markdown has no syntax errors, so these are all warnings: the page is still built. Each warning has a stable code, a message, a hint,
and the exact position in the file ([`Diagnostic`](https://github.com/babaygt/gensane/blob/main/src/diagnostics/diagnostic.ts)).

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

#### GS101

A code fence has no closing fence, so the rest of the container is treated as code.

**Fix:** add a closing line of three backticks after the last line of code.

#### GS102

Gensane doesn't support headings underlined with `===` or `---`. A `===` line is read as text, and a `---` line directly under text
becomes a horizontal rule.

**Fix:** write `# Title`. If you meant a horizontal rule, put a blank line before `---`.

#### GS103

Code indented by four spaces is read as a normal paragraph.

**Fix:** put the code in a fenced code block, or remove the indentation if it is text.

#### GS104

The header row and the row of dashes must have the same number of columns. Otherwise the lines stay plain text.

**Fix:** give both rows the same number of columns.

#### GS105

Block quotes, lists and footnotes can be nested up to 256 levels deep. Deeper lines are read as text. This limit protects the compiler
from extremely deep input.

**Fix:** reduce the nesting.

#### GS106

A comment, script, style or similar HTML block has no end marker, so everything after it is treated as raw HTML.

**Fix:** add the end marker named in the warning, such as `-->`.

#### GS107

A footnote is defined but nothing refers to it, so it isn't shown.

**Fix:** refer to it with `[^note]`, or remove the definition.

#### GS108

A reference points at a footnote that doesn't exist. It is shown as plain text.

**Fix:** add a definition such as `[^missing]: The note.`, or remove the reference.

#### GS109

Two footnotes use the same label. Labels ignore upper and lower case, and the first definition is used.

**Fix:** give the second footnote its own label, or remove it.

## Templates (GS3xx)

From [https://gensane.dev/docs/internals/template/diagnostics/](https://gensane.dev/docs/internals/template/diagnostics/).

Every problem has a stable code, a message, a hint and the exact position in the file
([`Diagnostic`](https://github.com/babaygt/gensane/blob/main/src/diagnostics/diagnostic.ts)). GS331 is a warning, and the page is still rendered. All the others are errors.

| Code  | Stage     | Meaning                                                  |
| ----- | --------- | -------------------------------------------------------- |
| GS301 | Reading   | `{{` or `{%` is never closed                             |
| GS302 | Reading   | A comment is never closed                                |
| GS303 | Reading   | A string is never closed                                 |
| GS304 | Reading   | A backslash starts an unknown escape                     |
| GS305 | Reading   | A character can't be used in code                        |
| GS310 | Parsing   | A value is missing                                       |
| GS311 | Parsing   | Something else was expected                              |
| GS312 | Parsing   | A tag doesn't exist                                      |
| GS313 | Parsing   | Code is nested too deeply                                |
| GS314 | Parsing   | An expression is too long                                |
| GS315 | Parsing   | Comparisons are chained                                  |
| GS316 | Parsing   | A block is never closed                                  |
| GS317 | Parsing   | An end tag has no block to close                         |
| GS318 | Parsing   | A branch comes after `else`                              |
| GS319 | Parsing   | `loop` is used as the name of a loop variable            |
| GS320 | Checking  | A filter doesn't exist                                   |
| GS321 | Checking  | A filter gets the wrong number of arguments              |
| GS330 | Rendering | A variable doesn't exist                                 |
| GS331 | Rendering | A printed field doesn't exist (warning)                  |
| GS332 | Rendering | An operator gets the wrong kind of value                 |
| GS333 | Rendering | A number is divided by zero                              |
| GS334 | Rendering | A filter can't work with its value                       |
| GS335 | Rendering | A value can't be printed                                 |
| GS336 | Rendering | An index isn't a whole number or text                    |
| GS337 | Rendering | A loop gets something that isn't a list                  |
| GS340 | Checking  | An included or extended template doesn't exist           |
| GS341 | Checking  | Templates use each other in a circle                     |
| GS342 | Checking  | `extends` isn't the first thing in a template            |
| GS343 | Checking  | A template that extends another has content outside its blocks |
| GS344 | Checking  | Two blocks have the same name                            |
| GS345 | Checking  | A block doesn't exist in the template it extends         |

Reading and parsing problems are found in each file on its own. Checking needs no data, so these problems are found when compiling.
Rendering problems depend on the data of a page. The examples that need data show it in a `json` block.

### Reading

#### GS301

`{{` or `{%` has no closing `}}` or `%}`. A new delimiter on the way also ends the search, so the rest of the page isn't read as code.

#### GS302

#### GS303

A string must end on the line where it starts.

#### GS304

#### GS305

Symbols that other languages use get a hint with the word to use here.

### Parsing

#### GS310

#### GS311

`else if` gets its own hint.

#### GS312

#### GS313

Expressions and blocks can be nested up to 64 levels deep, and templates can include each other up to 32 levels deep. These limits protect
the call stack from extremely deep input.

#### GS314

An expression can have up to 1000 parts. A long chain such as `a + a + a + …` has no brackets, but still builds a deep tree. An example
would be too long to show here, so the [limits](https://gensane.dev/docs/internals/template/architecture/) are tested on their own.

#### GS315

`a < b < c` means different things in different languages, so it isn't allowed.

#### GS316

#### GS317

#### GS318

#### GS319

Every loop already has a variable named `loop`.

### Checking

#### GS320

#### GS321

#### GS340

#### GS341

#### GS342

#### GS343

Content outside the blocks of a child would never be shown.

#### GS344

#### GS345

### Rendering

#### GS330

#### GS331

A warning: the page is still rendered, and the field prints as nothing.

#### GS332

#### GS333

#### GS334

The message and the hint come from the filter.

#### GS335

#### GS336

#### GS337

## The site (GS4xx)

From [https://gensane.dev/docs/reference/site/problems/](https://gensane.dev/docs/reference/site/problems/).

Every problem has a stable code, a message, a hint and a position in a file
([`Diagnostic`](https://github.com/babaygt/gensane/blob/main/src/diagnostics/diagnostic.ts)). GS402, GS406, GS409, GS411, GS414, GS417 and GS419 are warnings, and the site is still built; GS419 is
shown by `gensane check` only. All the others are errors. Problems from the other modules, such as frontmatter and templates, have their own pages.
[Markdown](https://gensane.dev/docs/internals/markdown-compiler/diagnostics/), [frontmatter](https://gensane.dev/docs/internals/frontmatter/diagnostics/) and [templates](https://gensane.dev/docs/internals/template/diagnostics/).

| Code  | Step             | Meaning                                                       |
| ----- | ---------------- | ------------------------------------------------------------- |
| GS401 | Content          | A file is in a folder with no type of content                 |
| GS402 | Content          | A file isn't Markdown, so it is left out (warning)            |
| GS403 | Content          | A `slug:` can't be used in a URL                              |
| GS404 | Content          | A file name has nothing to use in a URL                       |
| GS405 | Content          | Two files have the same URL                                   |
| GS406 | Content          | The date in a file name isn't the post's date (warning)       |
| GS407 | Site             | A page takes a URL the site needs                             |
| GS408 | Site             | A tag has nothing to use in a URL                             |
| GS409 | Site             | Two spellings of a tag are listed together (warning)          |
| GS410 | Rendering        | The theme has no template for a page                          |
| GS411 | Feed and sitemap | There is no `site.url`, so they are left out (warning)        |
| GS412 | Feed and sitemap | `site.url` isn't a full address                               |
| GS413 | Links            | A link or image leads nowhere                                 |
| GS414 | Links            | A link leads to a part of a page that doesn't exist (warning) |
| GS415 | Links            | A public file would replace a file the site writes            |
| GS416 | Links            | A file of the theme would clash with another file of the site |
| GS417 | Content          | A field has a name the build uses for something else (warning) |
| GS418 | Content          | A folder in `pages/` has a name that can't be part of a URL    |
| GS419 | Content          | Code in a language gensane doesn't color (`check` only, warning) |

### Content

#### GS401

A file is in a folder that has no type of content. Each folder of the content folder is one type of content.

#### GS402

A warning: a file in the content folder isn't Markdown, so it is left out. Images and other files belong in the `public` folder, which is copied as it is.

#### GS403

A `slug:` field has characters that can't be used in a URL. It is written on purpose, so it isn't changed silently.

#### GS404

The file name has nothing that a URL can use, after leaving out a date and characters other than a to z and 0 to 9.

#### GS405

Two files have the same URL. The second one in the order of their paths is reported.

#### GS406

A warning: the date at the start of the file name isn't the day of `date`.

### Site

#### GS407

A page has a URL that the site needs for one of its own pages.

#### GS408

A tag has nothing that a URL can use.

#### GS409

A warning: two spellings of a tag have the same URL, so their posts are listed together under the spelling most posts use.

### Rendering

#### GS410

The site has a page that needs a template the theme doesn't have. It is reported once, with the first page that needs it.

### Feed and sitemap

#### GS411

A warning: without the address of the site, the feed and the sitemap can't use full URLs, so they are left out. The config has no line numbers, so the problem points at the start of the config file.

#### GS412

`site.url` isn't a full address.

### Links

#### GS413

A link or an image leads to no page and no file of the site.

#### GS414

A warning: a link leads to a page, but the page has no element with the id after `#`.

#### GS415

A file in the `public` folder has the same path as a file the site writes, so one would replace the other.

#### GS416

A file of the theme's `assets/` folder has the same path as a public file, or as a file the site writes, so one would replace the
other.

#### GS417

A warning: a field of your own has a name that templates already use for something the build works out, such as `url` for the
address of the page, so templates would never see the field. Rename it. A project's website is the field `website` for this reason.

#### GS418

A folder in `pages/` has a name that can't be part of a URL, which only allows lowercase letters, digits and single dashes. Pages in
folders are at the folders' path, so rename the folder.

#### GS419

A warning that only `gensane check` shows: code is in a language gensane doesn't [color](https://gensane.dev/docs/reference/content/colors-in-code/), so it stays plain.
It comes once for each language, at its first block, with how many blocks there are. A site that wants it colored sets its own
`markdown.highlight`; code meant to stay plain can say `text`. With `markdown.highlight: false` it never comes, since the site has
chosen plain code.
