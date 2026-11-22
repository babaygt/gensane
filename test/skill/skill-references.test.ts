import { describe, expect, it } from "vitest";
import { withoutExamples } from "../../scripts/skill-references.ts";

const addresses = new Map([["cli/config.md", "/docs/reference/commands/config/"]]);
const page = (...lines: string[]) => withoutExamples(lines.join("\n"), "cli/new.md", addresses);

describe("withoutExamples", () => {
  it("leaves out the title, the examples and the comments that mark them", () => {
    expect(
      page(
        "# new",
        "",
        "Starts a file:",
        "",
        "<!-- runs -->",
        "```console",
        "$ gensane new post A",
        "```",
        "",
        "Done.",
      ),
    ).toBe("Starts a file.\n\nDone.\n");
  });

  it("leaves out an example in a longer fence, with a shorter fence inside it", () => {
    expect(page("Before.", "````markdown", "```ts", "x", "```", "````", "After.")).toBe(
      "Before.\nAfter.\n",
    );
  });

  it("keeps a colon before a list or a table", () => {
    expect(page("The kinds:", "", "- post", "- page")).toBe("The kinds:\n\n- post\n- page\n");
    expect(page("The codes:", "", "| A | B |")).toBe("The codes:\n\n| A | B |\n");
  });

  it("leads links to gensane.dev, and links to the code to GitHub", () => {
    expect(page("See [the config](config.md#site) and [run-cli](../../src/cli/run-cli.ts).")).toBe(
      "See [the config](https://gensane.dev/docs/reference/commands/config/#site) and " +
        "[run-cli](https://github.com/babaygt/gensane/blob/main/src/cli/run-cli.ts).\n",
    );
  });

  it("puts headings one level deeper when the page goes under a heading of its own", () => {
    expect(
      withoutExamples("# Problems\n\n## Parsing\n\n### GS201\n\nText.", "cli/new.md", addresses, 1),
    ).toBe("### Parsing\n\n#### GS201\n\nText.\n");
  });
});
