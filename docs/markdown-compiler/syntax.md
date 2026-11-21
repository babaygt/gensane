# Supported syntax

Everything here works today. Each example shows the Markdown and the exact HTML it produces.

## Headings

<!-- example -->
```markdown
## Getting started
```

```html
<h2 id="getting-started">Getting started</h2>
```

Repeated headings get a number, so every id is unique. Turn ids off with `headingIds: false`.

## Emphasis

<!-- example -->
```markdown
*em*, **strong**, ~~deleted~~ and snake_case_names
```

```html
<p><em>em</em>, <strong>strong</strong>, <del>deleted</del> and snake_case_names</p>
```

## Code

<!-- example -->
````markdown
Use `pnpm test`.

```ts
const answer = 42;
```
````

```html
<p>Use <code>pnpm test</code>.</p>
<pre><code class="language-ts">const answer = 42;
</code></pre>
```

## Links and images

<!-- example -->
```markdown
[Docs](https://example.com "Title"), [a reference][ref] and <https://example.org>

![Logo](/logo.png)

[ref]: /about
```

```html
<p><a href="https://example.com" title="Title">Docs</a>, <a href="/about">a reference</a> and <a href="https://example.org">https://example.org</a></p>
<p><img src="/logo.png" alt="Logo" /></p>
```

## Lists

<!-- example -->
```markdown
- One
  1. Nested
- Two
```

```html
<ul>
<li>One
<ol>
<li>Nested</li>
</ol>
</li>
<li>Two</li>
</ul>
```

### Task lists

<!-- example -->
```markdown
- [x] Written
- [ ] Published
```

```html
<ul>
<li><input checked="" disabled="" type="checkbox" /> Written</li>
<li><input disabled="" type="checkbox" /> Published</li>
</ul>
```

## Block quotes and callouts

<!-- example -->
```markdown
> A quote.

> [!TIP]
> Callouts can be `NOTE`, `TIP`, `IMPORTANT`, `WARNING` or `CAUTION`.
```

```html
<blockquote>
<p>A quote.</p>
</blockquote>
<div class="callout callout-tip">
<p class="callout-title">Tip</p>
<p>Callouts can be <code>NOTE</code>, <code>TIP</code>, <code>IMPORTANT</code>, <code>WARNING</code> or <code>CAUTION</code>.</p>
</div>
```

## Tables

<!-- example -->
```markdown
| Tool | Since |
| :--- | ----: |
| pnpm |  2021 |
```

```html
<table>
<thead>
<tr>
<th class="align-left">Tool</th>
<th class="align-right">Since</th>
</tr>
</thead>
<tbody>
<tr>
<td class="align-left">pnpm</td>
<td class="align-right">2021</td>
</tr>
</tbody>
</table>
```

The alignment of a column is a class on its cells, `align-left`, `align-center` or `align-right`, which the theme styles; the
default theme does. HTML no longer has the `align` attribute that the GitHub spec shows.

## Footnotes

<!-- example -->
```markdown
Fast[^speed].

[^speed]: Measured on a laptop.
```

```html
<p>Fast<sup class="footnote-ref"><a href="#fn-1" id="fnref-1">1</a></sup>.</p>
<section class="footnotes">
<ol>
<li id="fn-1">
<p>Measured on a laptop. <a href="#fnref-1" class="footnote-backref" aria-label="Back to reference 1">↩</a></p>
</li>
</ol>
</section>
```

## Other text features

<!-- example -->
```markdown
Escaped \*stars\*, &copy; 2026, and a hard line break:\
next line
```

```html
<p>Escaped *stars*, © 2026, and a hard line break:<br />
next line</p>
```

## Raw HTML

HTML in Markdown is passed through, both as whole blocks and inside text.

<!-- example -->
```markdown
Press <kbd>Ctrl</kbd>.

<details>
<summary>More</summary>
</details>
```

```html
<p>Press <kbd>Ctrl</kbd>.</p>
<details>
<summary>More</summary>
</details>
```

With `rawHtml: "escape"`, HTML is shown as text instead. This option covers raw HTML only: link URLs are never
filtered, so `javascript:` links still pass through. Sites that publish Markdown written by other people
need their own sanitising step.

## Left out on purpose

Two CommonMark features are not supported, because each has a clearer alternative and leaving them out makes
lists easier to write correctly. Using them produces a [warning](diagnostics.md) that names the alternative.

| Not supported                               | Write this instead  |
| ------------------------------------------- | ------------------- |
| Underlined headings (`Title` above `=====`) | `# Title`           |
| Code indented by four spaces                | A fenced code block |
