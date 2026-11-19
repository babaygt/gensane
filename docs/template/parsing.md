# Parsing

Reading a template has two steps. The [lexer](../../src/template/lexing/lexer.ts) turns text into tokens, and the
[parser](../../src/template/parsing/parser.ts) turns tokens into a syntax tree.

## Tokens

The lexer works in two modes. Outside of delimiters everything is text, up to the next `{{`, `{%` or `{#`. Inside `{{ }}` and `{% %}` it
reads code, one token at a time. Comments are dropped, so no later stage sees them.

| Token          | Example                             |
| -------------- | ----------------------------------- |
| Text           | `<h1>`                              |
| Name           | `page`, `if`, `upper`               |
| String         | `"text"`, `'text'`                  |
| Number         | `42`, `3.5`                         |
| Symbol         | `.` `,` `(` `)` `[` `]` `\|` `+` `-` `*` `/` `%` `==` `!=` `<` `<=` `>` `>=` |
| Delimiters     | `{{` `}}` `{%` `%}`                 |

`if`, `and` and `true` are ordinary names to the lexer. Only the parser knows that they mean something.

**Finding the end of code.** Before it reads the code, the lexer finds the closing `}}` or `%}`, skipping anything inside strings, so
`{{ "}}" }}` works. A new `{{` or `{%` on the way means the first one was never closed. That gives one problem, [GS301](diagnostics.md),
instead of reading the rest of the page as code.

**Symbols from other languages.** `&&`, `||`, `!` and `=` aren't symbols here, but people often write them. The lexer reports them with
the word to use instead:

<!-- reports GS305 -->
```jinja
{% if page.draft || page.private %}hidden{% endif %}
```

```text
line 1, column 18: `||` cannot be used here
hint: use `or` instead
```

The lexer never stops at a mistake. It reports it, leaves a marker token, and continues, and the parser doesn't report a mistake again
where it finds such a marker.

## Grammar

The grammar of an expression, from the loosest operator to the tightest. `{ }` means any number of times, and `[ ]` means optional:

```ebnf
expression     = or ;
or             = and { "or" and } ;
and            = not { "and" not } ;
not            = "not" not | comparison ;
comparison     = additive [ ( "==" | "!=" | "<" | "<=" | ">" | ">=" ) additive ] ;
additive       = multiplicative { ( "+" | "-" ) multiplicative } ;
multiplicative = unary { ( "*" | "/" | "%" ) unary } ;
unary          = "-" unary | postfix ;
postfix        = primary { "." name | "[" expression "]" | "|" name [ arguments ] } ;
arguments      = "(" [ expression { "," expression } ] ")" ;
primary        = number | string | "true" | "false" | "null" | name | "(" expression ")" ;
```

And the structure of a template:

```ebnf
template = { text | output | tag } ;
output   = "{{" expression "}}" ;
if       = "{% if" expression "%}" template
           { "{% elif" expression "%}" template }
           [ "{% else %}" template ] "{% endif %}" ;
for      = "{% for" name "in" expression "%}" template [ "{% else %}" template ] "{% endfor %}" ;
block    = "{% block" name "%}" template "{% endblock %}" ;
include  = "{% include" string "%}" ;
extends  = "{% extends" string "%}" ;
```

## Recursive descent

The parser has a method for each rule, from [`#parseOr`](../../src/template/parsing/parser.ts) down to
[`#parsePrimary`](../../src/template/parsing/parser.ts). A method calls the method of the next rule for its operands, so operators lower
down bind more tightly. Adding and multiplying share one method, [`#parseBinary`](../../src/template/parsing/parser.ts), which is given its
operators and the method for its operands: the adding level asks the multiplying level for its operands, so `1 + 2 * 3` is
`1 + (2 * 3)`.

<!-- renders -->
```jinja
{{ 1 + 2 * 3 }} {{ 10 - 4 - 3 }} {{ not false and false }}
```

```html
7 3 false
```

`10 - 4 - 3` is `(10 - 4) - 3`, because the loop in each method builds the tree from the left. `not false and false` is
`(not false) and false`, because `not` binds more tightly than `and`.

**Filters bind most tightly.** They belong to the postfix rule, like fields, so `posts | length > 0` compares the length.

**Comparisons can't be chained.** `a < b < c` means something different in different languages, so the comparison rule allows one
operator, and a second one is [GS315](diagnostics.md).

**Blocks.** A block such as `{% if %}` reads its body with the same method that reads the whole template, which stops at a tag that
continues or closes an open block. A stack of open blocks decides where that tag belongs:

- `{% elif %}`, `{% else %}` and an end tag continue or close the block they belong to.
- An end tag that belongs to a block further out closes that one, and the inner block is reported as never closed, once.
- A tag that belongs to no open block is [GS317](diagnostics.md), and the parser continues after it.

<!-- reports GS316 -->
```jinja
{% if page.tags %}{% for tag in page.tags %}{{ tag }}{% endif %}
```

```text
line 1, column 22: this `for` is never closed
hint: add `{% endfor %}` where it should end
```

## Recovering from mistakes

After a mistake in an expression, the parser skips to the end of its delimiters and continues with the rest of the template, so one run
reports every problem. A tag with a broken condition still opens its block, so its end tag matches and doesn't cause a second problem.

## Limits

Each method that can nest counts how deep it is, and stops at 64 levels with [GS313](diagnostics.md). Blocks are counted the same way. The
length of one expression is checked before parsing it, so a very long chain is rejected before the tree is built. The
[architecture page](architecture.md) lists every limit.
