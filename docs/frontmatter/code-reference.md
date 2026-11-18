# Code reference

Every source file of the frontmatter module and its most important functions. Select a name to open its file, then search for that name. Names
starting with `#` are private methods of a parser class.

## Public API and shared types

### [`src/frontmatter/index.ts`](../../src/frontmatter/index.ts)

The public entry point of the module.

| Name                                                       | Purpose                                            |
| ---------------------------------------------------------- | -------------------------------------------------- |
| [`parseFrontmatter`](../../src/frontmatter/index.ts)       | Separates the settings from the body and reads them |
| [`FrontmatterFile`](../../src/frontmatter/index.ts)        | The data, the body and where the body starts       |

### [`src/frontmatter/values.ts`](../../src/frontmatter/values.ts)

The data that parsing produces.

| Name                                                     | Purpose                                     |
| -------------------------------------------------------- | ------------------------------------------- |
| [`FrontmatterValue`](../../src/frontmatter/values.ts)    | Every kind of value                         |
| [`MapValue`](../../src/frontmatter/values.ts)            | Named settings, in the order they were written |
| [`MapEntry`](../../src/frontmatter/values.ts)            | A key, its position and its value           |
| [`ListValue`](../../src/frontmatter/values.ts)           | A list of values                            |
| [`DateValue`](../../src/frontmatter/values.ts)           | A date, month or date with a time           |

### [`src/frontmatter/plain-data.ts`](../../src/frontmatter/plain-data.ts)

| Name                                                       | Purpose                                         |
| ---------------------------------------------------------- | ----------------------------------------------- |
| [`toPlainData`](../../src/frontmatter/plain-data.ts)       | Values without positions, as ordinary JavaScript data |

### [`src/frontmatter/diagnostic-codes.ts`](../../src/frontmatter/diagnostic-codes.ts)

| Name                                                                | Purpose                       |
| ------------------------------------------------------------------- | ----------------------------- |
| [`FrontmatterCodes`](../../src/frontmatter/diagnostic-codes.ts)     | All problem codes, GS201 to GS226 |

## Parsing

### [`src/frontmatter/parsing/source-lines.ts`](../../src/frontmatter/parsing/source-lines.ts)

| Name                                                                  | Purpose                              |
| --------------------------------------------------------------------- | ------------------------------------ |
| [`SourceLine`](../../src/frontmatter/parsing/source-lines.ts)         | A line and its offsets in the file   |
| [`splitSourceLines`](../../src/frontmatter/parsing/source-lines.ts)   | Splits on `\n`, `\r\n` or `\r`       |
| [`positionInLine`](../../src/frontmatter/parsing/source-lines.ts)     | Turns an offset into a line and column |

### [`src/frontmatter/parsing/yaml-parser.ts`](../../src/frontmatter/parsing/yaml-parser.ts)

Reads the structure of the settings, one line at a time.

| Name                                                                  | Purpose                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------- |
| [`parseYamlSubset`](../../src/frontmatter/parsing/yaml-parser.ts)     | Entry point                                             |
| [`YamlParser`](../../src/frontmatter/parsing/yaml-parser.ts)          | The recursive descent parser                            |
| [`#toContentLine`](../../src/frontmatter/parsing/yaml-parser.ts)      | Drops blank lines and comments, and rejects tabs        |
| [`#parseMap`](../../src/frontmatter/parsing/yaml-parser.ts)           | Reads the entries at one indentation                    |
| [`#parseEntry`](../../src/frontmatter/parsing/yaml-parser.ts)         | Reads one `key: value` line                             |
| [`#parseNestedValue`](../../src/frontmatter/parsing/yaml-parser.ts)   | Reads a value on the lines after its key                |
| [`#parseBlock`](../../src/frontmatter/parsing/yaml-parser.ts)         | Chooses a map or a list, and enforces the nesting limit |
| [`#parseList`](../../src/frontmatter/parsing/yaml-parser.ts)          | Reads the items at one indentation                      |
| [`#parseListItem`](../../src/frontmatter/parsing/yaml-parser.ts)      | Reads one item after its dash                           |
| [`#rejectDeeperLines`](../../src/frontmatter/parsing/yaml-parser.ts)  | Reports lines indented under a finished value           |
| [`#skipEntry`](../../src/frontmatter/parsing/yaml-parser.ts)          | Skips a broken line and everything nested under it      |

### [`src/frontmatter/parsing/inline-values.ts`](../../src/frontmatter/parsing/inline-values.ts)

Reads a value written on one line.

| Name                                                                     | Purpose                                     |
| ------------------------------------------------------------------------ | ------------------------------------------- |
| [`readInlineValue`](../../src/frontmatter/parsing/inline-values.ts)      | Entry point                                 |
| [`InlineValueReader`](../../src/frontmatter/parsing/inline-values.ts)    | The character-by-character reader           |
| [`MAX_NESTING_DEPTH`](../../src/frontmatter/parsing/inline-values.ts)    | The limit on nested values                  |
| [`#readValue`](../../src/frontmatter/parsing/inline-values.ts)           | Chooses what to read from the first character |
| [`#readPlain`](../../src/frontmatter/parsing/inline-values.ts)           | Reads a value without quotes                |
| [`#classify`](../../src/frontmatter/parsing/inline-values.ts)            | Decides the type of a plain value           |
| [`#readDate`](../../src/frontmatter/parsing/inline-values.ts)            | Rejects dates that don't exist              |
| [`#readDoubleQuoted`](../../src/frontmatter/parsing/inline-values.ts)    | Reads `"text"` and its escapes              |
| [`#readSingleQuoted`](../../src/frontmatter/parsing/inline-values.ts)    | Reads `'text'`                              |
| [`#readList`](../../src/frontmatter/parsing/inline-values.ts)            | Reads `[a, b]`                              |
| [`isExactNumber`](../../src/frontmatter/parsing/inline-values.ts)        | Keeps very large whole numbers as text      |
| [`daysInMonth`](../../src/frontmatter/parsing/inline-values.ts)          | Knows the length of each month, including leap years |

## Validation

### [`src/frontmatter/validation/schema.ts`](../../src/frontmatter/validation/schema.ts)

The schemas and how they combine. The [validation page](validation.md) lists each building block.

| Name                                                               | Purpose                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| [`Schema`](../../src/frontmatter/validation/schema.ts)             | A check that produces a value of a known type            |
| [`Checked`](../../src/frontmatter/validation/schema.ts)            | The outcome of a check                                   |
| [`Infer`](../../src/frontmatter/validation/schema.ts)              | The data type that a schema produces                     |
| [`ContentDate`](../../src/frontmatter/validation/schema.ts)        | A date without its position                              |
| [`dateHint`](../../src/frontmatter/validation/schema.ts)           | Suggests a date only when the answer is clear            |
| [`combine`](../../src/frontmatter/validation/schema.ts)            | Collects several checks and keeps every problem          |
| [`object`](../../src/frontmatter/validation/schema.ts)             | Checks named fields                                      |
| [`checkField`](../../src/frontmatter/validation/schema.ts)         | Checks one field, or handles it being missing            |
| [`typoWarnings`](../../src/frontmatter/validation/schema.ts)       | Warns about likely misspellings                          |
| [`withRule`](../../src/frontmatter/validation/schema.ts)           | Adds a rule across fields                                |
| [`validate`](../../src/frontmatter/validation/schema.ts)           | Checks a file, and separates custom fields               |

### [`src/frontmatter/validation/content-types.ts`](../../src/frontmatter/validation/content-types.ts)

| Name                                                                       | Purpose                                 |
| -------------------------------------------------------------------------- | --------------------------------------- |
| [`contentSchemas`](../../src/frontmatter/validation/content-types.ts)      | The schema of each type of content      |
| [`ContentType`](../../src/frontmatter/validation/content-types.ts)         | The names of those types                |
| [`ContentFields`](../../src/frontmatter/validation/content-types.ts)       | The inferred data type of one of them   |
| [`validateContent`](../../src/frontmatter/validation/content-types.ts)     | Checks data against a type of content   |
| [`endsAfterStart`](../../src/frontmatter/validation/content-types.ts)      | Rejects an end before the start         |
| [`isBefore`](../../src/frontmatter/validation/content-types.ts)            | Compares two dates of any precision     |

### [`src/frontmatter/validation/closest-match.ts`](../../src/frontmatter/validation/closest-match.ts)

| Name                                                                  | Purpose                                   |
| --------------------------------------------------------------------- | ----------------------------------------- |
| [`editDistance`](../../src/frontmatter/validation/closest-match.ts)   | Counts the changes between two words      |
| [`closestMatch`](../../src/frontmatter/validation/closest-match.ts)   | Finds the word that was probably meant    |
