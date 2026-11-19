# Code reference

Every source file of the template module and its most important functions. Select a name to open its file, then search for that name.
Names starting with `#` are private methods of a class.

## Public API and shared types

### [`src/template/index.ts`](../../src/template/index.ts)

The public entry point of the module.

| Name                                              | Purpose                                          |
| ------------------------------------------------- | ------------------------------------------------ |
| [`compileTemplates`](../../src/template/index.ts) | Compiles a set of templates named by their paths |
| [`compileTemplate`](../../src/template/index.ts)  | Compiles one template that uses no others        |
| [`renderTemplate`](../../src/template/index.ts)   | Runs a compiled template with variables          |
| [`Template`](../../src/template/index.ts)         | A compiled template, with the layouts of its set |
| [`inFileOrder`](../../src/template/index.ts)      | Sorts problems by file, then by position         |

### [`src/template/ast.ts`](../../src/template/ast.ts)

The syntax tree.

| Name                                            | Purpose                       |
| ----------------------------------------------- | ----------------------------- |
| [`TemplateNode`](../../src/template/ast.ts)     | Every kind of node            |
| [`Expression`](../../src/template/ast.ts)       | Every kind of expression      |
| [`IfNode`](../../src/template/ast.ts)           | `if`, `elif` and `else`       |
| [`ForNode`](../../src/template/ast.ts)          | A loop and its `else`         |
| [`IncludeNode`](../../src/template/ast.ts)      | `include`                     |
| [`ExtendsNode`](../../src/template/ast.ts)      | `extends`                     |
| [`BlockNode`](../../src/template/ast.ts)        | A block that a child can fill |
| [`FilterExpression`](../../src/template/ast.ts) | A filter and its arguments    |

### [`src/template/diagnostic-codes.ts`](../../src/template/diagnostic-codes.ts)

| Name                                                      | Purpose                           |
| --------------------------------------------------------- | --------------------------------- |
| [`TemplateCodes`](../../src/template/diagnostic-codes.ts) | All problem codes, GS301 to GS345 |

## Lexing

### [`src/template/lexing/tokens.ts`](../../src/template/lexing/tokens.ts)

| Name                                                    | Purpose                       |
| ------------------------------------------------------- | ----------------------------- |
| [`Token`](../../src/template/lexing/tokens.ts)          | Every kind of token           |
| [`TemplateSymbol`](../../src/template/lexing/tokens.ts) | The symbols that code can use |

### [`src/template/lexing/lexer.ts`](../../src/template/lexing/lexer.ts)

Turns text into tokens, in two modes.

| Name                                                  | Purpose                                               |
| ----------------------------------------------------- | ----------------------------------------------------- |
| [`tokenize`](../../src/template/lexing/lexer.ts)      | Entry point                                           |
| [`TemplateLexer`](../../src/template/lexing/lexer.ts) | The character-by-character reader                     |
| [`#readText`](../../src/template/lexing/lexer.ts)     | Reads text up to the next delimiter                   |
| [`#readCode`](../../src/template/lexing/lexer.ts)     | Reads the tokens between two delimiters               |
| [`#findCloser`](../../src/template/lexing/lexer.ts)   | Finds the end of code, skipping strings               |
| [`#readString`](../../src/template/lexing/lexer.ts)   | Reads text in quotes and its escapes                  |
| [`#readSymbol`](../../src/template/lexing/lexer.ts)   | Reads a symbol, or explains one from another language |
| [`REPLACEMENTS`](../../src/template/lexing/lexer.ts)  | `&&`, `\|\|`, `!` and `=`, and what to write instead  |

### [`src/template/lexing/source-positions.ts`](../../src/template/lexing/source-positions.ts)

| Name                                                                    | Purpose                                                     |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`createPositionFinder`](../../src/template/lexing/source-positions.ts) | Turns an offset into a line and column with a binary search |

## Parsing

### [`src/template/parsing/parser.ts`](../../src/template/parsing/parser.ts)

The recursive descent parser.

| Name                                                            | Purpose                                               |
| --------------------------------------------------------------- | ----------------------------------------------------- |
| [`parseTemplate`](../../src/template/parsing/parser.ts)         | Entry point                                           |
| [`TemplateParser`](../../src/template/parsing/parser.ts)        | The parser                                            |
| [`#parseBody`](../../src/template/parsing/parser.ts)            | Reads nodes until a tag that belongs to an open block |
| [`#parseIf`](../../src/template/parsing/parser.ts)              | Reads `if`, its branches and `endif`                  |
| [`#parseFor`](../../src/template/parsing/parser.ts)             | Reads a loop                                          |
| [`#parseBlock`](../../src/template/parsing/parser.ts)           | Reads a block                                         |
| [`#parseReference`](../../src/template/parsing/parser.ts)       | Reads `include` and `extends`                         |
| [`#belongsToOpenBlock`](../../src/template/parsing/parser.ts)   | Decides which open block a closing tag belongs to     |
| [`#rejectBranch`](../../src/template/parsing/parser.ts)         | Reports a closing tag without a block                 |
| [`#parseOr`](../../src/template/parsing/parser.ts)              | The loosest level of an expression                    |
| [`#parseComparison`](../../src/template/parsing/parser.ts)      | One comparison, never a chain                         |
| [`#parseBinary`](../../src/template/parsing/parser.ts)          | Adding and multiplying, from the left                 |
| [`#parsePostfix`](../../src/template/parsing/parser.ts)         | Fields, positions and filters                         |
| [`#parsePrimary`](../../src/template/parsing/parser.ts)         | Values, names and brackets                            |
| [`#nested`](../../src/template/parsing/parser.ts)               | Counts the depth of nesting                           |
| [`MAX_EXPRESSION_DEPTH`](../../src/template/parsing/parser.ts)  | The limit on nested expressions                       |
| [`MAX_EXPRESSION_TOKENS`](../../src/template/parsing/parser.ts) | The limit on the length of one expression             |
| [`MAX_BLOCK_DEPTH`](../../src/template/parsing/parser.ts)       | The limit on nested blocks                            |

## Checks before rendering

### [`src/template/analysis/check-filters.ts`](../../src/template/analysis/check-filters.ts)

| Name                                                             | Purpose                                       |
| ---------------------------------------------------------------- | --------------------------------------------- |
| [`checkFilters`](../../src/template/analysis/check-filters.ts)   | Checks every filter, in every branch          |
| [`checkFilterUse`](../../src/template/analysis/check-filters.ts) | Checks one filter and its number of arguments |

### [`src/template/analysis/link-templates.ts`](../../src/template/analysis/link-templates.ts)

Checks how templates use each other, and works out each layout.

| Name                                                                | Purpose                                            |
| ------------------------------------------------------------------- | -------------------------------------------------- |
| [`linkTemplates`](../../src/template/analysis/link-templates.ts)    | Entry point                                        |
| [`TemplateLinker`](../../src/template/analysis/link-templates.ts)   | The checks                                         |
| [`Layout`](../../src/template/analysis/link-templates.ts)           | The nodes to render, and the content of each block |
| [`#checkReferences`](../../src/template/analysis/link-templates.ts) | Reports templates that don't exist                 |
| [`#checkCircles`](../../src/template/analysis/link-templates.ts)    | A depth-first search with its own stack            |
| [`#chainOf`](../../src/template/analysis/link-templates.ts)         | A template and the templates it extends            |
| [`#checkChild`](../../src/template/analysis/link-templates.ts)      | Only blocks a parent has, and nothing outside them |
| [`#layoutOf`](../../src/template/analysis/link-templates.ts)        | The closest template that fills a block wins       |
| [`contentSpan`](../../src/template/analysis/link-templates.ts)      | Points at text, not at the blank lines around it   |

## Rendering

### [`src/template/rendering/interpreter.ts`](../../src/template/rendering/interpreter.ts)

The tree-walking interpreter.

| Name                                                               | Purpose                                       |
| ------------------------------------------------------------------ | --------------------------------------------- |
| [`interpret`](../../src/template/rendering/interpreter.ts)         | Entry point                                   |
| [`Interpreter`](../../src/template/rendering/interpreter.ts)       | The interpreter                               |
| [`FAILED`](../../src/template/rendering/interpreter.ts)            | The value of an expression that failed        |
| [`#renderNode`](../../src/template/rendering/interpreter.ts)       | Chooses what to do for each kind of node      |
| [`#renderIf`](../../src/template/rendering/interpreter.ts)         | Shows the first branch that is true           |
| [`#renderFor`](../../src/template/rendering/interpreter.ts)        | Gives each item its own scope                 |
| [`#renderInclude`](../../src/template/rendering/interpreter.ts)    | Renders another template where it is included |
| [`#renderBlock`](../../src/template/rendering/interpreter.ts)      | Shows the closest content of a block          |
| [`#evaluate`](../../src/template/rendering/interpreter.ts)         | Works out the value of an expression          |
| [`#evaluateAndWarn`](../../src/template/rendering/interpreter.ts)  | Warns about missing fields that are printed   |
| [`#evaluateQuietly`](../../src/template/rendering/interpreter.ts)  | Conditions and loop lists don't warn          |
| [`#print`](../../src/template/rendering/interpreter.ts)            | Escapes and prints a value                    |
| [`#report`](../../src/template/rendering/interpreter.ts)           | Reports a mistake at one place only once      |
| [`MAX_INCLUDE_DEPTH`](../../src/template/rendering/interpreter.ts) | The limit on included templates               |

### [`src/template/rendering/scope.ts`](../../src/template/rendering/scope.ts)

| Name                                             | Purpose                       |
| ------------------------------------------------ | ----------------------------- |
| [`Scope`](../../src/template/rendering/scope.ts) | Variables with a parent scope |

### [`src/template/rendering/values.ts`](../../src/template/rendering/values.ts)

The values templates work with.

| Name                                                      | Purpose                                   |
| --------------------------------------------------------- | ----------------------------------------- |
| [`isTruthy`](../../src/template/rendering/values.ts)      | Empty values count as false               |
| [`describeValue`](../../src/template/rendering/values.ts) | The name of a kind of value, for problems |
| [`printableText`](../../src/template/rendering/values.ts) | The text of a value that can be printed   |
| [`escapeHtml`](../../src/template/rendering/values.ts)    | Makes text safe in HTML and attributes    |
| [`SafeHtml`](../../src/template/rendering/values.ts)      | HTML that may be printed as it is         |
| [`ownField`](../../src/template/rendering/values.ts)      | Reads only the fields of the value itself |
| [`asDate`](../../src/template/rendering/values.ts)        | Recognises a date from frontmatter        |
| [`compareDates`](../../src/template/rendering/values.ts)  | Compares two dates of any precision       |
| [`areEqual`](../../src/template/rendering/values.ts)      | `==` in templates                         |

### [`src/template/rendering/filter-types.ts`](../../src/template/rendering/filter-types.ts)

| Name                                                             | Purpose                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| [`TemplateFilter`](../../src/template/rendering/filter-types.ts) | What a filter is: a function from a value to a value |
| [`FilterError`](../../src/template/rendering/filter-types.ts)    | How a filter reports a mistake                       |
| [`defineFilter`](../../src/template/rendering/filter-types.ts)   | A filter and the number of arguments it takes        |

### [`src/template/rendering/filters.ts`](../../src/template/rendering/filters.ts)

The filters for text and single values, and the list of all built-in filters.

| Name                                                           | Purpose                                           |
| -------------------------------------------------------------- | ------------------------------------------------- |
| [`builtInFilters`](../../src/template/rendering/filters.ts)    | Every built-in filter                             |
| [`withCustomFilters`](../../src/template/rendering/filters.ts) | Adds your own filters                             |
| [`truncate`](../../src/template/rendering/filters.ts)          | Shortens text without cutting a character in half |

### [`src/template/rendering/list-filters.ts`](../../src/template/rendering/list-filters.ts)

The filters for lists.

| Name                                                      | Purpose                                     |
| --------------------------------------------------------- | ------------------------------------------- |
| [`where`](../../src/template/rendering/list-filters.ts)   | Keeps some items                            |
| [`take`](../../src/template/rendering/list-filters.ts)    | Keeps the first items                       |
| [`skip`](../../src/template/rendering/list-filters.ts)    | Leaves out the first items                  |
| [`sort`](../../src/template/rendering/list-filters.ts)    | Sorts items, and keeps equal items in order |
| [`reverse`](../../src/template/rendering/list-filters.ts) | Reverses a list                             |

### [`src/template/rendering/dates.ts`](../../src/template/rendering/dates.ts)

| Name                                                  | Purpose                   |
| ----------------------------------------------------- | ------------------------- |
| [`dateFilter`](../../src/template/rendering/dates.ts) | The `date` filter         |
| [`formatDate`](../../src/template/rendering/dates.ts) | Writes a date in a format |

### [`src/diagnostics/closest-match.ts`](../../src/diagnostics/closest-match.ts)

Shared with the other modules, and used for every "did you mean" hint.

| Name | Purpose |
| ---- | ------- |
| [`closestMatch`](../../src/diagnostics/closest-match.ts) | Finds the name that was probably meant |
