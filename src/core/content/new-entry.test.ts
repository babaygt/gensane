import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { loadContent } from "./load-content.ts";
import { newEntry } from "./new-entry.ts";

const details = { title: "Hello World", slug: "hello-world", today: "2026-11-20" };

describe("newEntry", () => {
  it.each([
    [
      "post",
      "blog/2026-11-20-hello-world.md",
      "title: Hello World\ndate: 2026-11-20\ndraft: true",
      [],
    ],
    ["project", "projects/hello-world.md", "title: Hello World\ndraft: true", []],
    ["page", "pages/hello-world.md", "title: Hello World", []],
    ["talk", "talks/hello-world.md", 'title: Hello World\nevent: ""\ndate: 2026-11-20', ["event"]],
    [
      "experience",
      "experience/hello-world.md",
      'company: Hello World\nrole: ""\nstart: 2026-11',
      ["role"],
    ],
    [
      "education",
      "education/hello-world.md",
      'school: Hello World\ndegree: ""\nstart: 2026-11',
      ["degree"],
    ],
  ] as const)("writes a %s", (type, path, fields, toFill) => {
    expect(newEntry(type, details)).toEqual({ path, text: `---\n${fields}\n---\n`, toFill });
  });

  it.each([
    ["Tom & Jerry", "Tom & Jerry"],
    ["Part 2: the end", '"Part 2: the end"'],
    ["#1 tip", '"#1 tip"'],
    ['"Quoted"', '"\\"Quoted\\""'],
    ["true", '"true"'],
    ["2026", '"2026"'],
    ["Ünïcode ✓", "Ünïcode ✓"],
  ])("writes the title %s as %s", (title, written) => {
    expect(newEntry("page", { ...details, title }).text).toBe(`---\ntitle: ${written}\n---\n`);
  });
});

describe("any title", () => {
  // Characters that matter to YAML, and any other character at all.
  const character = fc.oneof(
    fc.constantFrom(" ", ":", "#", "'", '"', "\\", "\n", "\t", "-", "[", "{", "&", "*"),
    fc.string({ unit: "binary", minLength: 1, maxLength: 1 }),
  );
  const title = fc
    .string({ unit: character, minLength: 1 })
    .map((text) => text.trim())
    .filter((text) => text !== "");

  it("is read back as exactly the same text", () => {
    fc.assert(
      fc.property(
        title,
        fc.constantFrom("post", "project", "page", "talk", "experience", "education"),
        (name, type) => {
          const entry = newEntry(type, { title: name, slug: "a", today: "2026-11-20" });
          const filled = entry.toFill.reduce(
            (text, field) => text.replace(`${field}: ""`, `${field}: x`),
            entry.text,
          );
          const loaded = loadContent({ [entry.path]: filled });
          expect(loaded.ok ? loaded.value.warnings : loaded.error).toEqual([]);
          const fields = loaded.ok ? loaded.value.entries[0]?.fields : undefined;
          const nameField =
            type === "experience" ? "company" : type === "education" ? "school" : "title";
          expect(
            fields && nameField in fields ? fields[nameField as keyof typeof fields] : undefined,
          ).toBe(name);
        },
      ),
    );
  });
});
