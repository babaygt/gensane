# Problems

## How a problem is printed

Every problem has a code, a message, the place it is, its line of source with a mark under the mistake, and a hint:

```text
error[GS413]: "/abuot/" doesn't lead to a page or a file of the site
  ┌─ content/blog/hello.md:5:13
  │
5 │ See [about](/abuot/).
  │             ^^^^^^^
  │
  = hint: did you mean "/about/"?
```

- **Errors** stop a build; **warnings** don't. Each module documents its own problems: [Markdown](../markdown-compiler/diagnostics.md),
  [frontmatter](../frontmatter/diagnostics.md), [templates](../template/diagnostics.md) and [the core](../core/diagnostics.md).
- **A problem in a template** names its file in `theme/`, so the path can be opened from the terminal.
- **A problem without a line**, such as one in the config, names only the file.
- **Problems go to the error stream**, and the line at the end to the normal one, so results can be sent to a file without hiding
  problems.
- **Colors** show only in a terminal, and never when the `NO_COLOR` environment variable is set, as [no-color.org](https://no-color.org)
  asks. Logs in CI stay readable.

## Mistakes in a command

A command that is written wrong exits with 2, says what was wrong, and suggests what was probably meant:

<!-- runs -->
```console
$ gensane biuld
error: "biuld" is not a command
hint: did you mean "build"?
$ echo $?
2
```

<!-- runs -->
```console
$ gensane check --draft
error: "--draft" is not an argument of gensane check
hint: did you mean "--drafts"?
$ echo $?
2
```

## Problems with the config

The config has no line numbers once it has been run, so these problems point at its file.

### GS501

There are two config files, so gensane can't know which one is meant.

<!-- runs -->
```ts gensane.config.ts
export default {};
```

```js gensane.config.mjs
export default {};
```

```console
$ gensane check
error[GS501]: there are two config files: "gensane.config.ts" and "gensane.config.mjs"
  ┌─ gensane.config.mjs
  │
  = hint: keep one of them

Found 1 error and 0 warnings in the config.
$ echo $?
1
```

### GS502

The config couldn't be run. The message is Node's, and the hint says what usually causes it: TypeScript that needs compiling, a
package that isn't installed, or a mistake in the code.

<!-- runs -->
```ts gensane.config.ts
enum Size { Small, Large }

export default { perPage: Size.Large };
```

```console
$ gensane check
error[GS502]: the config couldn't be loaded: TypeScript enum is not supported in strip-only mode
  ┌─ gensane.config.ts
  │
  = hint: Node runs the config by removing its types, so it can't use TypeScript that needs compiling, such as an enum; use a union of strings or an object instead

Found 1 error and 0 warnings in the config.
$ echo $?
1
```

### GS503

The config doesn't export its settings as the default export.

<!-- runs -->
```ts gensane.config.ts
export const config = { perPage: 5 };
```

```console
$ gensane check
error[GS503]: the config doesn't export its settings
  ┌─ gensane.config.ts
  │
  = hint: end the config with `export default defineConfig({ ... })`

Found 1 error and 0 warnings in the config.
$ echo $?
1
```

### GS504

A setting that gensane doesn't have.

<!-- runs -->
```ts gensane.config.ts
export default { colours: { accent: "teal" } };
```

```console
$ gensane check
error[GS504]: "colours" is not a setting
  ┌─ gensane.config.ts
  │
  = hint: the settings are site, perPage, markdown, filters, theme, llms, nav and analytics

Found 1 error and 0 warnings in the config.
$ echo $?
1
```

### GS505

A setting with a value of the wrong kind, or a filter whose name a template couldn't use.

<!-- runs -->
```ts gensane.config.ts
export default { perPage: "10" };
```

```console
$ gensane check
error[GS505]: "perPage" must be a whole number above 0, but "10" is text
  ┌─ gensane.config.ts
  │
  = hint: write a number such as 10

Found 1 error and 0 warnings in the config.
$ echo $?
1
```

### GS506

A warning: a setting of `site` that looks like a misspelled known one, such as `descripton` or a profile such as `githb`. Other
settings of `site` are fine; they are for the templates.

<!-- runs -->
```ts gensane.config.ts
export default { site: { url: "https://example.com", descripton: "Notes" } };
```

```console
$ gensane check
warning[GS506]: "site.descripton" is not a known setting
  ┌─ gensane.config.ts
  │
  = hint: did you mean "description"? Other settings of the site are fine, for the templates

Checked 2 pages in 7 ms, with 1 warning.
```

### GS507

A warning: an `accent` of your own replaces the palette's accent, and it is hard to read on the palette's background. Text needs a
contrast of at least 4.5 to 1 ([WCAG AA](https://www.w3.org/TR/WCAG21/#contrast-minimum)).

<!-- runs -->
```ts gensane.config.ts
export default { site: { url: "https://example.com" }, theme: { accent: "#ffd400" } };
```

```console
$ gensane check
warning[GS507]: "theme.accent" is hard to read in the light colors of the "default" palette: 1.3 to 1, and text needs 4.5 to 1
  ┌─ gensane.config.ts
  │
  = hint: choose a darker color, or leave accent out to use the palette's own

Checked 2 pages in 7 ms, with 1 warning.
```

### GS508

A warning: an ID in [`analytics`](config.md#analytics) doesn't look like one of the service's, so the visits probably aren't counted.
The page still gets the snippet, in case the service has started using IDs of a new kind.

<!-- runs -->
```ts gensane.config.ts
export default { site: { url: "https://example.com" }, analytics: { google: "UA-12345-1" } };
```

```console
$ gensane check
warning[GS508]: "analytics.google" doesn't look like a measurement ID of Google Analytics: "UA-12345-1"
  ┌─ gensane.config.ts
  │
  = hint: IDs that start with "UA-" stopped counting in 2023; write the measurement ID of the site's data stream, which starts with "G-"

Checked 2 pages in 7 ms, with 1 warning.
```

