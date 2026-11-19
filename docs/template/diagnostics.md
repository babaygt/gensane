# Problems

Every problem has a stable code, a message, a hint and the exact position in the file
([`Diagnostic`](../../src/diagnostics/diagnostic.ts)). GS331 is a warning, and the page is still rendered. All the others are errors.

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

## Reading

### GS301

`{{` or `{%` has no closing `}}` or `%}`. A new delimiter on the way also ends the search, so the rest of the page isn't read as code.

<!-- reports GS301 -->
```jinja
<h1>{{ page.title</h1>
<p>{{ page.summary }}</p>
```

```text
line 1, column 5: this `{{` is never closed
hint: add `}}` at the end
```

### GS302

<!-- reports GS302 -->
```jinja
<p>Hello</p>{# a note
```

```text
line 1, column 13: this comment is never closed
hint: add `#}` at the end of the comment
```

### GS303

A string must end on the line where it starts.

<!-- reports GS303 -->
```jinja
{{ "Hello }}
```

```text
line 1, column 4: this string is never closed
hint: add a closing " on the same line
```

### GS304

<!-- reports GS304 -->
```jinja
{{ "C:\docs" }}
```

```text
line 1, column 7: `\d` is not a valid escape
hint: the valid escapes are `\"`, `\'`, `\\`, `\n` and `\t`
```

### GS305

Symbols that other languages use get a hint with the word to use here.

<!-- reports GS305 -->
```jinja
{% if a && b %}yes{% endif %}
```

```text
line 1, column 9: `&&` cannot be used here
hint: use `and` instead
```

## Parsing

### GS310

<!-- reports GS310 -->
```jinja
{{ page.title + }}
```

```text
line 1, column 17: expected a value, but found the end of the output
hint: write a value here, such as a name, a number or text in quotes
```

### GS311

<!-- reports GS311 -->
```jinja
{% for post posts %}{{ post.title }}{% endfor %}
```

```text
line 1, column 13: expected `in`, but found `posts`
hint: add `in` here
```

`else if` gets its own hint:

<!-- reports GS311 -->
```jinja
{% if a %}1{% else if b %}2{% endif %}
```

```text
line 1, column 20: expected `%}`, but found `if`
hint: write `elif` instead of `else if`
```

### GS312

<!-- reports GS312 -->
```jinja
{% if a %}yes{% endfi %}
```

```text
line 1, column 17: there is no tag named "endfi"
hint: did you mean "endif"?
```

### GS313

Expressions and blocks can be nested up to 64 levels deep, and templates can include each other up to 32 levels deep. These limits protect
the call stack from extremely deep input.

<!-- reports GS313 -->
```jinja
{{ (((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((a))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))) }}
```

```text
line 1, column 69: this expression is nested more than 64 levels deep
hint: reduce the nesting
```

### GS314

An expression can have up to 1000 parts. A long chain such as `a + a + a + …` has no brackets, but still builds a deep tree. An example
would be too long to show here, so the [limits](architecture.md) are tested on their own.

```text
line 1, column 1: this expression has more than 1000 parts
hint: split the work over several steps, or do it in a filter
```

### GS315

`a < b < c` means different things in different languages, so it isn't allowed.

<!-- reports GS315 -->
```jinja
{{ 1 < page.views < 100 }}
```

```text
line 1, column 19: comparisons cannot be chained
hint: compare one pair at a time: `a < b and b < c`
```

### GS316

<!-- reports GS316 -->
```jinja
{% if page.draft %}<p>Draft</p>
```

```text
line 1, column 4: this `if` is never closed
hint: add `{% endif %}` where it should end
```

### GS317

<!-- reports GS317 -->
```jinja
<ul>{% for tag in page.tags %}<li>{{ tag }}</li>{% endfor %}{% endfor %}</ul>
```

```text
line 1, column 64: there is no open `for` for this `endfor`
hint: remove it, or add `{% for item in list %}` before it
```

### GS318

<!-- reports GS318 -->
```jinja
{% if a %}1{% else %}2{% elif b %}3{% endif %}
```

```text
line 1, column 26: `elif` must come before `else`
hint: move this `elif` above the `else`
```

### GS319

Every loop already has a variable named `loop`.

<!-- reports GS319 -->
```jinja
{% for loop in loops %}{{ loop.name }}{% endfor %}
```

```text
line 1, column 8: `loop` is already the name of the information about the current loop
hint: choose another name, such as `item`
```

## Checking

### GS320

<!-- reports GS320 -->
```jinja
{{ page.title | uppr }}
```

```text
line 1, column 17: there is no filter named "uppr"
hint: did you mean "upper"?
```

### GS321

<!-- reports GS321 -->
```jinja
{{ page.title | upper("x") }}
```

```text
line 1, column 17: "upper" takes no arguments, but got 1
hint: remove the extra arguments
```

### GS340

<!-- reports GS340 -->
```jinja page.html
<header>{% include "nav.html" %}</header>
```

```jinja partials/nav.html
<nav></nav>
```

```text
page.html, line 1, column 20: there is no template named "nav.html"
hint: did you mean "partials/nav.html"?
```

### GS341

<!-- reports GS341 -->
```jinja nav.html
<nav>{% include "menu.html" %}</nav>
```

```jinja menu.html
<ul>{% include "nav.html" %}</ul>
```

```text
menu.html, line 1, column 16: templates cannot use each other in a circle: nav.html → menu.html → nav.html
hint: remove one of the `include` or `extends` tags in the circle
```

### GS342

<!-- reports GS342 -->
```jinja base.html
<main>{% block content %}{% endblock %}</main>
```

```jinja post.html
<!doctype html>
{% extends "base.html" %}
```

```text
post.html, line 2, column 1: `extends` must come before everything else
hint: move it to the top of the template
```

### GS343

Content outside the blocks of a child would never be shown.

<!-- reports GS343 -->
```jinja base.html
<main>{% block content %}{% endblock %}</main>
```

```jinja post.html
{% extends "base.html" %}
<p>Hello</p>
```

```text
post.html, line 2, column 1: this is outside every block, so it is never shown
hint: put it inside a `{% block %}`, because this template extends "base.html"
```

### GS344

<!-- reports GS344 -->
```jinja
<main>{% block content %}{% endblock %}</main>
<aside>{% block content %}{% endblock %}</aside>
```

```text
line 2, column 17: there is already a block named "content" in this template
hint: give each block its own name
```

### GS345

<!-- reports GS345 -->
```jinja base.html
<main>{% block content %}{% endblock %}</main>
```

```jinja post.html
{% extends "base.html" %}
{% block contnet %}Hello{% endblock %}
```

```text
post.html, line 2, column 10: there is no block named "contnet" in "base.html"
hint: did you mean "content"?
```

## Rendering

### GS330

<!-- reports GS330 -->
```jinja
{{ pgae.title }}
```

```json
{ "page": { "title": "Hello" } }
```

```text
line 1, column 4: there is no variable named "pgae"
hint: did you mean "page"?
```

### GS331

A warning: the page is still rendered, and the field prints as nothing.

<!-- reports GS331 -->
```jinja
{{ page.titel }}
```

```json
{ "page": { "title": "Hello" } }
```

```text
line 1, column 9: "page" has no field "titel"
hint: did you mean "title"?
```

### GS332

<!-- reports GS332 -->
```jinja
{{ page.title - 1 }}
```

```json
{ "page": { "title": "Hello" } }
```

```text
line 1, column 4: `-` needs two numbers, but found text and a number
hint: check the values on both sides of the operator
```

### GS333

<!-- reports GS333 -->
```jinja
{{ page.views / page.days }}
```

```json
{ "page": { "views": 10, "days": 0 } }
```

```text
line 1, column 4: division by zero
hint: divide by another number
```

### GS334

The message and the hint come from the filter.

<!-- reports GS334 -->
```jinja
{{ page.date | date("Do MMMM") }}
```

```json
{ "page": { "date": { "text": "2026-11-18", "year": 2026, "month": 11, "day": 18 } } }
```

```text
line 1, column 16: "D" is not a part of a date
hint: use yyyy, M, MM, MMM, MMMM, d or dd, and only other characters between them
```

### GS335

<!-- reports GS335 -->
```jinja
{{ page.tags }}
```

```json
{ "page": { "tags": ["html", "css"] } }
```

```text
line 1, column 4: a list cannot be printed
hint: use the `join` filter to print a list
```

### GS336

<!-- reports GS336 -->
```jinja
{{ page.tags[true] }}
```

```json
{ "page": { "tags": ["html", "css"] } }
```

```text
line 1, column 4: an index must be a whole number or text, but this is true or false
hint: use a position such as `[0]`, or a field name such as `["title"]`
```

### GS337

<!-- reports GS337 -->
```jinja
{% for tag in page.title %}{{ tag }}{% endfor %}
```

```json
{ "page": { "title": "Hello" } }
```

```text
line 1, column 15: a loop needs a list, but found text
hint: use a list here, such as `page.tags`
```
