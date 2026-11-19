# Template language

Layouts are written in a small template language. Gensane implements it from scratch in TypeScript, with no runtime dependencies: a lexer,
a parser, checks that run before any data is known, and an interpreter that walks the syntax tree.

<!-- renders -->
```jinja
<h1>{{ page.title | upper }}</h1>
<ul>{% for tag in page.tags %}<li>{{ tag }}</li>{% endfor %}</ul>
```

```json
{ "page": { "title": "Tom & Jerry", "tags": ["cats", "mice"] } }
```

```html
<h1>TOM &amp; JERRY</h1>
<ul><li>cats</li><li>mice</li></ul>
```

The syntax looks like [Jinja](https://jinja.palletsprojects.com/), so it is familiar to many people, but it is much smaller. Output is
escaped unless a template asks for raw HTML, so content can't break the page.

## Using it

Templates are compiled once, as a set, and can then be rendered many times with different data:

```ts
import { compileTemplates, renderTemplate } from "./src/template/index.ts";

const compiled = compileTemplates({
  "base.html": "<main>{% block content %}{% endblock %}</main>",
  "post.html": '{% extends "base.html" %}{% block content %}{{ page.title }}{% endblock %}',
});
if (compiled.ok) {
  const post = compiled.value.get("post.html");
  const rendered = post && renderTemplate(post, { page: { title: "Hello" } });
}
```

| Function           | What it does                                              | On success                       |
| ------------------ | --------------------------------------------------------- | -------------------------------- |
| `compileTemplates` | Reads every template, and checks everything that needs no data | A compiled template for each file |
| `compileTemplate`  | The same for one template that uses no others             | One compiled template            |
| `renderTemplate`   | Runs a compiled template with variables                   | The `html` and any `warnings`    |

None of them throws on a mistake in a template. Each returns a result that holds every problem it found, with the exact file, line and
column, and a hint:

<!-- reports GS320 -->
```jinja
<h1>{{ page.title | uppr }}</h1>
```

```text
line 1, column 21: there is no filter named "uppr"
hint: did you mean "upper"?
```

## The documentation

| Page                                | Read it to learn                                                       |
| ----------------------------------- | ---------------------------------------------------------------------- |
| [Syntax](syntax.md)                 | Output, values, operators, conditions and loops                        |
| [Filters](filters.md)               | Every built-in filter, and how to add your own                         |
| [Layouts](layouts.md)               | How templates include and extend each other                            |
| [Architecture](architecture.md)     | How the stages fit together, with diagrams, and the limits             |
| [Parsing](parsing.md)               | How text becomes tokens and a syntax tree, including the grammar       |
| [Rendering](rendering.md)           | The checks before rendering, and how the interpreter runs a template   |
| [Problems](diagnostics.md)          | Every error and warning, with an example and a fix                     |
| [Code reference](code-reference.md) | Each file and its important functions, with links to the code          |
| [Testing](testing.md)               | How the template language is tested                                    |

The examples on these pages run in the test suite, so they always match what the code does.
