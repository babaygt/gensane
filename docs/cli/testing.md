# Testing

The command line is tested at six levels, from fast and pure to slow and real.

| Level                          | What runs                                                                                     | Examples                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Pure functions                 | The config check, formatting a problem, answering a request, the reload script               | `check-config.test.ts`, `format.test.ts`, `answer.test.ts`  |
| Commands in memory             | `runCli` with a disk in memory, a fixed clock, and a terminal that keeps its output          | `run-cli.test.ts`, `new-command.test.ts`                    |
| Real HTTP and real Node        | The dev server on a free port; the config loader and the watcher on the real system          | `dev-command.test.ts`, `module-loader.test.ts`              |
| The real program               | `gensane` in a temporary folder, and every example on these pages                            | `test/e2e/cli.test.ts`, `test/docs/cli-docs.test.ts`        |
| The example site               | `gensane build` and `check` on `example/` with no warnings; every page valid and accessible, and every feature still shown | `test/example/example-site.test.ts` |
| A real browser                 | Chromium, without a window, on pages `gensane dev` serves: search, the switch, the copy button, table alignment, reloads | `test/browser/default-theme.browser.test.ts`                |

## Property tests

| Property                                                                                         | File                     |
| ------------------------------------------------------------------------------------------------ | ------------------------ |
| Any right config is accepted unchanged; one more setting gives exactly one problem; nothing throws | `check-config.test.ts`   |
| The mark under a problem is exactly under its span, with or without color                        | `format.test.ts`         |
| Any title of a new file is read back exactly the same                                            | `new-entry.test.ts`      |
| No address reaches a file outside the build and the public folder                                | `answer.test.ts`         |
| The disk in memory gives the same results as the real disk for any operations                    | `file-system.test.ts`    |

## Things a test environment hides

- **Vitest runs TypeScript that Node refuses**, such as `enum`, so the config loader is tested in a separate Node process.
- **A fixed clock makes every build take 0 ms**, so one test uses a clock that moves on, to check that time is measured at all.
- **A time zone test only works when the zone is on another day than UTC**, so it picks a zone that is, at the moment it runs.

## Breaking the code on purpose

Each part was checked by breaking it in small ways in a copy, and running the tests to see if they notice.

| Part                          | Caught at first | Afterwards | Not caught                                               |
| ----------------------------- | --------------- | ---------- | -------------------------------------------------------- |
| The site folder and the disk  | 28 of 34        | 34 of 35   | A check that only matters on Windows                     |
| The config                    | 27 of 35        | 34 of 34   | One break showed dead code, which was removed            |
| build and check               | 39 of 49        | 47 of 49   | An empty hint, and an argument error Node never gives    |
| new                           | 21 of 24        | 24 of 24   |                                                          |
| dev                           | 38 of 45        | 42 of 44   | A listen error other than a busy port, and a Windows path |

What the breaks found is in the test files: each file says what it covers, and the tests added after a break are named after the case
they cover.
