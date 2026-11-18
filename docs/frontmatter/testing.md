# Testing

Frontmatter is tested at several levels, because each level finds different kinds of mistakes.

| Level                | What it checks                       | Where                                                                                       |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Parser tests         | What each piece of syntax reads as   | [`frontmatter.test.ts`](../../src/frontmatter/frontmatter.test.ts)                          |
| Schema tests         | Each building block and its messages | [`schema.test.ts`](../../src/frontmatter/validation/schema.test.ts)                         |
| Content type tests   | The fields of each type of content   | [`content-types.test.ts`](../../src/frontmatter/validation/content-types.test.ts)           |
| Property-based tests | Rules that must hold for any input   | [`frontmatter.property.test.ts`](../../src/frontmatter/frontmatter.property.test.ts)        |
| Type tests           | The types inferred from a schema     | The "inferred types" test in [`schema.test.ts`](../../src/frontmatter/validation/schema.test.ts) |
| Architecture tests   | Module boundaries                    | [`architecture.test.ts`](../../test/architecture/architecture.test.ts)                      |
| Documentation tests  | These pages match the code           | [`frontmatter-docs.test.ts`](../../test/docs/frontmatter-docs.test.ts)                      |

```sh
pnpm test       # run everything
pnpm coverage   # run with a coverage report
pnpm check      # type check, lint, format check and tests
```

## Property-based tests

Hand-written examples only cover cases someone thought of. [fast-check](https://fast-check.dev/) generates random input and checks rules that must
hold for all of it. The most useful one is a **round trip**: generate data, write it as frontmatter, read it back, and expect the same data. The
test contains its own small writer, so the parser is compared with an independent piece of code.

The full list of rules is in [`frontmatter.property.test.ts`](../../src/frontmatter/frontmatter.property.test.ts).

## Testing types

A schema's main promise is about types, which ordinary tests can't see because types are gone when the code runs. The "inferred types" test uses
`expectTypeOf` to state the exact type a schema must produce, and `pnpm check` fails if the inferred type ever changes.

## Testing for hostile input

Very large or deeply nested input is tested too. These tests have no timing assertions, which would be unreliable on slow machines. Each one reads an
input that would overflow the call stack or take minutes with a careless algorithm, so a crash or the test runner's time limit catches a regression.

## Documentation tests

The documentation is checked like code:

- Examples that read a file must produce exactly the data shown.
- Examples of a valid file must pass the rules for their type of content, without warnings.
- Examples of a problem must report that code, with exactly the position, message and hint shown.
- Every problem code must be documented with an example.
- The tables of [content types](content-types.md) must list every field, and say correctly which ones are required.
- Every link must point to a file that exists, and every linked name must exist in that file.
- Every source file must appear in the [code reference](code-reference.md).
