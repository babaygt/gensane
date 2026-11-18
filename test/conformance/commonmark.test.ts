// Runs every example of the official CommonMark spec against the compiler.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { markdownToHtml } from "../../src/markdown/index.ts";
import { KNOWN_GAPS } from "./known-gaps.ts";

interface SpecExample {
  readonly example: number;
  readonly section: string;
  readonly markdown: string;
  readonly html: string;
}

const specPath = join(import.meta.dirname, "..", "fixtures", "commonmark-0.31.2.json");
const examples = JSON.parse(readFileSync(specPath, "utf8")) as SpecExample[];

const gapReasons = new Map<number, string>(
  Object.entries(KNOWN_GAPS).flatMap(([reason, numbers]) =>
    numbers.map((example): [number, string] => [example, reason]),
  ),
);

describe.each([...new Set(examples.map((example) => example.section))])(
  "CommonMark: %s",
  (section) => {
    const inSection = examples.filter((example) => example.section === section);
    const supported = inSection.filter((example) => !gapReasons.has(example.example));
    const gaps = inSection.filter((example) => gapReasons.has(example.example));

    it.each(supported.map((example) => [example.example, example] as const))(
      "example %i",
      (_, example) => {
        expect(markdownToHtml(example.markdown, "spec.md", { headingIds: false }).html).toBe(
          example.html,
        );
      },
    );

    // A ratchet: when a gap gets fixed, this fails until the example leaves the list.
    it.each(
      gaps.map((example) => [example.example, gapReasons.get(example.example), example] as const),
    )("example %i is still a known gap (%s)", (_, _reason, example) => {
      expect(markdownToHtml(example.markdown, "spec.md", { headingIds: false }).html).not.toBe(
        example.html,
      );
    });
  },
);
