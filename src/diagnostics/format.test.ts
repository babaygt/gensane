import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Diagnostic } from "./diagnostic.ts";
import { formatDiagnostic } from "./format.ts";
import { spanOf } from "./span.ts";

const SOURCE = "---\ntitle: Hello\n---\nSee [about](/abuot/).\n";

const brokenLink: Diagnostic = {
  code: "GS413",
  severity: "error",
  message: '"/abuot/" doesn\'t lead to a page or a file of the site',
  span: spanOf("content/blog/hello.md", SOURCE, 33, 40),
  hint: 'did you mean "/about/"?',
};

const plain = { color: false };

describe("formatDiagnostic", () => {
  it("shows the problem with its line of source and a mark under it", () => {
    expect(formatDiagnostic(brokenLink, SOURCE, plain)).toBe(
      [
        'error[GS413]: "/abuot/" doesn\'t lead to a page or a file of the site',
        "  ┌─ content/blog/hello.md:4:13",
        "  │",
        "4 │ See [about](/abuot/).",
        "  │             ^^^^^^^",
        "  │",
        '  = hint: did you mean "/about/"?',
      ].join("\n"),
    );
  });

  it("shows a warning as a warning", () => {
    const warning = { ...brokenLink, severity: "warning" as const };
    expect(formatDiagnostic(warning, SOURCE, plain).split("\n")[0]).toBe(
      'warning[GS413]: "/abuot/" doesn\'t lead to a page or a file of the site',
    );
  });

  it("leaves out the hint when there is none", () => {
    const { hint: _, ...withoutHint } = brokenLink;
    expect(formatDiagnostic(withoutHint, SOURCE, plain).split("\n")).toHaveLength(5);
  });

  it("shows only the file when there is no source, as for the config", () => {
    const start = { line: 1, column: 1, offset: 0 };
    const configProblem: Diagnostic = {
      code: "GS504",
      severity: "error",
      message: '"perpage" is not a setting',
      span: { file: "gensane.config.ts", start, end: start },
      hint: 'did you mean "perPage"?',
    };
    expect(formatDiagnostic(configProblem, undefined, plain)).toBe(
      [
        'error[GS504]: "perpage" is not a setting',
        "  ┌─ gensane.config.ts",
        "  │",
        '  = hint: did you mean "perPage"?',
      ].join("\n"),
    );
  });

  it("makes the gutter as wide as the line number", () => {
    const source = `${"\n".repeat(99)}abc`;
    const problem = { ...brokenLink, span: spanOf("a.md", source, 100, 101) };
    expect(formatDiagnostic(problem, source, plain).split("\n").slice(1, 5)).toEqual([
      "    ┌─ a.md:100:2",
      "    │",
      "100 │ abc",
      "    │  ^",
    ]);
  });

  it("marks one character for a span that is empty", () => {
    const problem = { ...brokenLink, span: spanOf("a.md", "abc", 1, 1) };
    expect(formatDiagnostic(problem, "abc", plain).split("\n")[4]).toBe("  │  ^");
  });

  it("marks to the end of the first line for a span over several lines", () => {
    const source = "one *two\nthree*";
    const problem = { ...brokenLink, span: spanOf("a.md", source, 4, 15) };
    expect(formatDiagnostic(problem, source, plain).split("\n").slice(3, 5)).toEqual([
      "1 │ one *two",
      "  │     ^^^^",
    ]);
  });

  it("keeps tabs before the mark, so it stays under the right characters", () => {
    const source = "\t\tsee *here";
    const problem = { ...brokenLink, span: spanOf("a.md", source, 6, 7) };
    expect(formatDiagnostic(problem, source, plain).split("\n")[4]).toBe("  │ \t\t    ^");
  });

  it("finds lines that end with \\r\\n or \\r, and doesn't show the \\r", () => {
    const source = "one\r\ntwo\rthree *four";
    const problem = { ...brokenLink, span: spanOf("a.md", source, 15, 16) };
    expect(formatDiagnostic(problem, source, plain).split("\n").slice(3, 5)).toEqual([
      "3 │ three *four",
      "  │       ^",
    ]);
  });

  it("shows an empty line without spaces at the end", () => {
    const source = "a\n\nb";
    const problem = { ...brokenLink, span: spanOf("a.md", source, 2, 2) };
    expect(formatDiagnostic(problem, source, plain).split("\n").slice(3, 5)).toEqual([
      "2 │",
      "  │ ^",
    ]);
  });

  it("shows only the file when the position is past the end of the source", () => {
    const start = { line: 9, column: 1, offset: 90 };
    const problem = { ...brokenLink, span: { file: "a.md", start, end: start } };
    expect(formatDiagnostic(problem, "short", plain).split("\n")[1]).toBe("  ┌─ a.md:9:1");
    expect(formatDiagnostic(problem, "short", plain).split("\n")).toHaveLength(4);
  });

  describe("with color", () => {
    const colored = formatDiagnostic(brokenLink, SOURCE, { color: true });

    it("colors errors red and warnings yellow", () => {
      expect(colored.split("\n")[0]).toContain("\u001B[1;31merror[GS413]");
      const warning = formatDiagnostic({ ...brokenLink, severity: "warning" }, SOURCE, {
        color: true,
      });
      expect(warning.split("\n")[0]).toContain("\u001B[1;33mwarning[GS413]");
    });

    it("is the same text once the colors are taken out", () => {
      expect(withoutColor(colored)).toBe(formatDiagnostic(brokenLink, SOURCE, plain));
    });
  });

  it("has no color codes when color is off", () => {
    expect(formatDiagnostic(brokenLink, SOURCE, plain)).not.toContain("\u001B");
  });
});

// oxlint-disable-next-line no-control-regex
const COLOR_CODE = /\u001B\[[\d;]*m/g;

function withoutColor(text: string): string {
  return text.replaceAll(COLOR_CODE, "");
}

describe("any problem on one line", () => {
  // Ends with a character that shows, because spaces at the end of a line are left out.
  const line = fc.stringMatching(/^[a-z *[\]()/.]{0,30}$/).map((text) => `${text}.`);

  it("is marked exactly under its characters, with color or without", () => {
    fc.assert(
      fc.property(
        fc.array(line, { minLength: 1, maxLength: 5 }),
        fc.nat(),
        fc.nat(),
        fc.nat(),
        fc.boolean(),
        (lines, pick, from, length, color) => {
          const source = lines.join("\n");
          const lineIndex = pick % lines.length;
          const text = lines[lineIndex] ?? "";
          const lineStart = lines
            .slice(0, lineIndex)
            .reduce((sum, part) => sum + part.length + 1, 0);
          const start = from % text.length;
          const end = start + (length % (text.length - start + 1));
          const problem = {
            ...brokenLink,
            span: spanOf("a.md", source, lineStart + start, lineStart + end),
          };

          const shown = withoutColor(formatDiagnostic(problem, source, { color })).split("\n");
          const sourceLine = shown[3] ?? "";
          const markLine = shown[4] ?? "";
          const gutter = sourceLine.indexOf("│ ") + 2;
          expect(sourceLine.slice(gutter)).toBe(text.trimEnd());
          expect(markLine.slice(gutter)).toBe(
            " ".repeat(start) + "^".repeat(Math.max(1, end - start)),
          );
        },
      ),
    );
  });
});
