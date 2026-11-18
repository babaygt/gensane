# Testing

The compiler is tested at several levels, because each level finds different kinds of mistakes.

| Level                | What it checks                       | Where                                                                                                                                       |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests           | One rule or function at a time       | `*.test.ts` next to the code                                                                                                                |
| Feature tests        | Whole features from Markdown to HTML | [`tables.test.ts`](../../src/markdown/blocks/tables.test.ts), [`footnotes.test.ts`](../../src/markdown/passes/footnotes.test.ts) and others |
| Conformance tests    | The official CommonMark examples     | [`commonmark.test.ts`](../../test/conformance/commonmark.test.ts)                                                                           |
| Property-based tests | Rules that must hold for any input   | [`markdown.property.test.ts`](../../src/markdown/markdown.property.test.ts)                                                                 |
| Architecture tests   | Module boundaries                    | [`architecture.test.ts`](../../test/architecture/architecture.test.ts)                                                                      |
| Documentation tests  | These pages match the code           | [`compiler-docs.test.ts`](../../test/docs/compiler-docs.test.ts)                                                                            |

```sh
pnpm test       # run everything
pnpm coverage   # run with a coverage report
pnpm check      # type check, lint, format check and tests
```

## CommonMark conformance

All 652 examples of the CommonMark 0.31.2 specification run as tests, and **586 of 652** pass. The others are listed in
[`known-gaps.ts`](../../test/conformance/known-gaps.ts) with a reason:

| Reason               | Examples |
| -------------------- | -------- |
| Indented code        | 46       |
| Setext headings      | 19       |
| Tabs in nested lists | 1        |

Indented code and Setext (underlined) headings are [left out on purpose](syntax.md). The tab case is a known limit: a tab that only partly
fills the indentation of a nested list.

The list works as a **ratchet**. An example that isn't listed must pass, and a listed example must still fail. If a change makes a listed
example pass, the suite fails until it is removed from the list, so the list can only shrink.

## Property-based tests

Hand-written examples only cover cases someone thought of. [fast-check](https://fast-check.dev/) generates random Markdown-like documents
and checks rules that must hold for all of them:

- The compiler never throws, whatever the input.
- Every block's position lies inside the source, in document order.
- Every line and column matches a second, independent calculation ([`positionAt`](../../src/diagnostics/span.ts)).
- With `rawHtml: "escape"`, user text can never produce an HTML tag.
- The HTML output is always properly nested.

When a property fails, fast-check shrinks the input to a minimal example.

## Testing for hostile input

Very large or deeply nested input is tested too. These tests have no timing assertions, which would be unreliable on slow machines. Each one
parses an input that would take minutes with a slow algorithm, so the test runner's time limit catches a regression.

## Documentation tests

The documentation is checked like code:

- Examples marked in these pages are compiled, and the output must match exactly.
- Warning examples must produce the warning they describe.
- Every link must point to a file that exists, and every linked function must exist in that file.
- Every warning code must be documented, and every source file must appear in the [code reference](code-reference.md).
