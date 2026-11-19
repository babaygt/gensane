# Testing

The template language is tested at several levels, because each level finds different kinds of mistakes.

| Level                | What it checks                                         | Where                                                                                      |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Lexer tests          | The tokens of each piece of syntax, and their positions | [`lexer.test.ts`](../../src/template/lexing/lexer.test.ts)                                |
| Parser tests         | Precedence, and what each mistake reports               | [`parser.test.ts`](../../src/template/parsing/parser.test.ts)                             |
| Block tests          | The structure of tags, and mistakes in them             | [`blocks.test.ts`](../../src/template/parsing/blocks.test.ts)                             |
| Rendering tests      | Output, escaping, operators and filters                 | [`render.test.ts`](../../src/template/rendering/render.test.ts)                           |
| Condition and loop tests | Branches, loops and scopes                          | [`blocks.test.ts`](../../src/template/rendering/blocks.test.ts)                           |
| Filter tests         | The filters for lists and dates                         | [`list-filters.test.ts`](../../src/template/rendering/list-filters.test.ts), [`dates.test.ts`](../../src/template/rendering/dates.test.ts) |
| Layout tests         | Templates that include and extend each other            | [`layouts.test.ts`](../../src/template/rendering/layouts.test.ts)                         |
| Property-based tests | Rules that must hold for any template                   | [`template.property.test.ts`](../../src/template/template.property.test.ts)               |
| Architecture tests   | Module boundaries                                       | [`architecture.test.ts`](../../test/architecture/architecture.test.ts)                    |
| Documentation tests  | These pages match the code                              | [`template-docs.test.ts`](../../test/docs/template-docs.test.ts)                          |

```sh
pnpm test       # run everything
pnpm coverage   # run with a coverage report
pnpm check      # type check, lint, format check and tests
```

## Tests that show structure

The parser tests write each expression back with explicit brackets, so precedence is visible in the test itself: `1 + 2 * 3` must read as
`(1 + (2 * 3))`. The block tests write tags on one line in the same way, such as `if a ["1"] elif b ["2"] else ["3"]`.

## Property-based tests

[fast-check](https://fast-check.dev/) generates random input and checks rules that must hold for all of it. Three of the rules compare
the template language with a small, separate model that is easy to check by reading it:

- **Arithmetic.** Random calculations are written with only the brackets that are needed, and the answer must match a separate evaluator.
  A mistake in precedence or grouping changes the answer.
- **Blocks.** Random nested conditions and loops must show what a ten-line model says: one branch of each `if`, and the body of a loop
  once for each item.
- **Layouts.** A base, a child and a grandchild fill random blocks in a random order, and each block must come from the closest template.

The other rules are that nothing ever throws, that every token has the same position as an independent calculation, that problems come
in file order, that text without delimiters is unchanged, and that escaping keeps any text from becoming HTML without losing a character.

## Breaking the code on purpose

Each part was also tested by making small mistakes in a copy of the code, such as a wrong comparison or a missing line, and checking that
a test fails for each one. These mistakes were made by hand, so this is not a full mutation score, but every one that went unnoticed
showed something:

| Part                               | Mistakes made | Caught at first | Afterwards                                                   |
| ---------------------------------- | ------------- | --------------- | ------------------------------------------------------------ |
| Expressions and filters            | 91            | 74              | All caught, after 2 lines that did nothing were removed      |
| Conditions, loops and list filters | 91            | 70              | 89 caught; the other 2 can't be seen from outside            |
| Includes and layouts               | 48            | 35              | All caught                                                   |

Some showed missing tests, such as two files with a mistake at the same position. Others showed code that did nothing, which was removed
instead of tested.

## Testing for hostile input

Very deep and very long input is tested too, such as 100,000 brackets, 100,000 nested tags, a chain of 2,000 included templates and a
loop over 100,000 items. These tests have no timing assertions, which would be unreliable on slow machines. Each input would overflow
the call stack or take minutes with a careless algorithm, so a crash or the test runner's time limit catches a regression.

## Documentation tests

The documentation is checked like code:

- Examples of a template must render exactly the HTML shown, without warnings.
- Examples of a problem must report that code, with exactly the position, message and hint shown.
- Every problem code must be documented with an example, except GS314, whose example would need more than 1000 parts.
- Every built-in filter must be documented with an example, and the parts of a date format must match the code.
- The table of tags must list every tag, and the limits must match the code.
- Every link must point to a file that exists, and every linked name must exist in that file.
- Every source file must appear in the [code reference](code-reference.md).
