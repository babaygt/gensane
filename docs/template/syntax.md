# Syntax

A template is HTML with three kinds of delimiters. Everything outside them is copied as it is.

| Delimiters | What it is | Example                         |
| ---------- | ---------- | ------------------------------- |
| `{{ }}`    | Output     | `{{ page.title }}`              |
| `{% %}`    | A tag      | `{% if page.draft %}`           |
| `{# #}`    | A comment  | `{# not shown on the page #}`   |

## Output

`{{ }}` prints the value of an expression.

<!-- renders -->
```jinja
<h1>{{ page.title }}</h1>
```

```json
{ "page": { "title": "Hello world" } }
```

```html
<h1>Hello world</h1>
```

### Escaping

Printed text is escaped, so `&`, `<`, `>`, `"` and `'` can't change the HTML around them. That also makes output safe inside attributes.

<!-- renders -->
```jinja
<p title="{{ note }}">{{ note }}</p>
```

```json
{ "note": "Tom & \"Jerry\" <3" }
```

```html
<p title="Tom &amp; &quot;Jerry&quot; &lt;3">Tom &amp; &quot;Jerry&quot; &lt;3</p>
```

The [`raw`](filters.md) filter prints HTML as it is, such as the body of a post that the Markdown compiler has already turned into HTML.

<!-- renders -->
```jinja
<article>{{ page.body | raw }}</article>
```

```json
{ "page": { "body": "<p>Hi <em>there</em></p>" } }
```

```html
<article><p>Hi <em>there</em></p></article>
```

## Values

| Written as             | Is                                    |
| ---------------------- | ------------------------------------- |
| `"text"` or `'text'`   | Text                                  |
| `42`, `3.5`            | A number                              |
| `true`, `false`        | True or false                         |
| `null`                 | Nothing                               |
| `page`, `post_count`   | A variable                            |

Text can use `\"`, `\'`, `\\`, `\n` and `\t`, and must end on the line where it starts.

<!-- renders -->
```jinja
{{ "It's" }} {{ 'say "hi"' }}
```

```html
It&#39;s say &quot;hi&quot;
```

### Fields and positions

A dot reads a field, and square brackets read a position in a list or a field by name.

<!-- renders -->
```jinja
{{ page.author.name }}, {{ page.tags[0] }}, {{ page["title"] }}
```

```json
{ "page": { "title": "Notes", "author": { "name": "Ada" }, "tags": ["testing", "compilers"] } }
```

```html
Ada, testing, Notes
```

A field that is missing gives nothing. When it is printed, it is also a [warning](diagnostics.md), because it is often a typo. Only the
fields of the value itself can be read, so `page.constructor` gives nothing too.

## Operators

From the loosest to the tightest:

| Operators                          | Meaning                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| `or`                               | The first value if it is true, otherwise the second          |
| `and`                              | The first value if it is false, otherwise the second         |
| `not`                              | The opposite                                                 |
| `==` `!=` `<` `<=` `>` `>=`        | Comparison. `a < b < c` is a mistake                         |
| `+` `-`                            | Adding and subtracting numbers. `+` also joins text          |
| `*` `/` `%`                        | Multiplying, dividing and the remainder                      |
| `-` before a value                 | A negative number                                            |
| `.` `[ ]` `\|`                     | Fields, positions and filters                                |

<!-- renders -->
```jinja
{{ 1 + 2 * 3 }} {{ (1 + 2) * 3 }} {{ 7 % 3 }} {{ "a" + "b" }} {{ 2 < 3 and not false }}
```

```html
7 9 1 ab true
```

`or` gives one of its values, which is handy for a fallback:

<!-- renders -->
```jinja
{{ page.subtitle or "No subtitle" }}
```

```json
{ "page": {} }
```

```html
No subtitle
```

`==` compares exactly, so `1 == "1"` is false. Nothing equals nothing, and two dates are equal when they are the same day.

## Filters

A filter changes a value, and filters can be chained. The [filters page](filters.md) lists all of them.

<!-- renders -->
```jinja
{{ page.title | upper }} {{ page.tags | join(" · ") }} {{ page.tags | length > 1 }}
```

```json
{ "page": { "title": "Notes", "tags": ["a", "b"] } }
```

```html
NOTES a · b true
```

Filters bind tightly, so `page.tags | length > 1` means `(page.tags | length) > 1`, and `a + b | upper` only changes `b`. Write
`(a + b) | upper` to change both.

## Comments

<!-- renders -->
```jinja
a{# this is not shown #}b
```

```html
ab
```

## Conditions

`{% if %}` shows the first branch whose condition is true. `{% elif %}` and `{% else %}` are optional, and `{% endif %}` closes it.

<!-- renders -->
```jinja
{% if page.draft %}Draft{% elif page.featured %}Featured{% else %}Published{% endif %}
```

```json
{ "page": { "draft": false, "featured": true } }
```

```html
Featured
```

Empty values count as false, so `{% if page.tags %}` is true only when there are tags:

| False                                   | True                     |
| --------------------------------------- | ------------------------ |
| `false`, `0`, `""` and nothing          | Everything else          |
| An empty list and an empty group of fields | Lists and groups with something in them |

A missing field is normal in a condition, so it isn't a warning there:

<!-- renders -->
```jinja
<article>{% if page.cover %}<img src="{{ page.cover }}">{% endif %}</article>
```

```json
{ "page": {} }
```

```html
<article></article>
```

## Loops

`{% for %}` shows its body once for each item of a list. The `{% else %}` part shows when the list is empty, and `{% endfor %}` closes it.

<!-- renders -->
```jinja
<ul>{% for post in posts %}<li>{{ post.title }}</li>{% else %}<li>No posts yet</li>{% endfor %}</ul>
```

```json
{ "posts": [{ "title": "First" }, { "title": "Second" }] }
```

```html
<ul><li>First</li><li>Second</li></ul>
```

<!-- renders -->
```jinja
<ul>{% for post in posts %}<li>{{ post.title }}</li>{% else %}<li>No posts yet</li>{% endfor %}</ul>
```

```json
{ "posts": [] }
```

```html
<ul><li>No posts yet</li></ul>
```

A missing list counts as empty, without a warning, so `{% for tag in page.tags %}` works for a post without tags.

Inside a loop, `loop` tells each item where it is:

| Field         | Value                           |
| ------------- | ------------------------------- |
| `loop.index`  | The position, starting at 1     |
| `loop.first`  | Whether this is the first item  |
| `loop.last`   | Whether this is the last item   |
| `loop.length` | The number of items             |

<!-- renders -->
```jinja
{% for tag in tags %}{{ tag }}{% if not loop.last %}, {% endif %}{% endfor %}
```

```json
{ "tags": ["html", "css", "js"] }
```

```html
html, css, js
```

### Scopes

Each item of a loop gets its own scope. The loop variable can only be used inside the loop, and it can hide a variable with the same name
outside. An inner loop has its own `loop`.

<!-- renders -->
```jinja
{% for row in rows %}[{{ loop.index }}:{% for cell in row %} {{ cell }}{{ loop.index }}{% endfor %}]{% endfor %}
```

```json
{ "rows": [["a", "b"], ["c"]] }
```

```html
[1: a1 b2][2: c1]
```

## Templates that use each other

`{% include "partials/nav.html" %}` shows another template, and `{% extends "base.html" %}` with `{% block content %}` and
`{% endblock %}` builds on a layout. The [layouts page](layouts.md) explains them.

## All tags

| Tag                                    | Ends with          | Explained in            |
| -------------------------------------- | ------------------ | ----------------------- |
| `{% if condition %}`                   | `{% endif %}`      | Conditions, above      |
| `{% elif condition %}`, `{% else %}`   |                    | Conditions, above      |
| `{% for item in list %}`               | `{% endfor %}`     | Loops, above            |
| `{% include "name.html" %}`            |                    | [Layouts](layouts.md)   |
| `{% extends "name.html" %}`            |                    | [Layouts](layouts.md)   |
| `{% block name %}`                     | `{% endblock %}`   | [Layouts](layouts.md)   |

## Line breaks

Text around tags is kept exactly, including line breaks. HTML ignores most of them, so this rarely matters.

## Left out on purpose

| Feature                              | Why it is left out                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Setting variables                    | The data comes from the content. Work on it belongs in a filter               |
| Calling functions or methods         | Filters are the only functions, so a template can't run any JavaScript        |
| Controlling line breaks around tags  | HTML ignores most of them                                                     |
| Macros                               | Included templates do the same job                                            |
| Template names from variables        | Names in quotes can be checked before anything is rendered                    |
| A template that includes itself      | Templates can't use each other in a circle, so rendering always ends          |
