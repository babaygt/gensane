import { assertNever } from "../../diagnostics/index.ts";
import type { Inline } from "../ast.ts";

/** The text of inline nodes without any formatting. */
export function plainTextOf(inlines: readonly Inline[]): string {
  return inlines
    .map((inline) => {
      switch (inline.kind) {
        case "text":
        case "code-span":
        case "raw-html":
          return inline.text;
        case "footnote-reference":
          return "";
        case "hard-break":
        case "soft-break":
          return "\n";
        case "emphasis":
        case "strong":
        case "strikethrough":
        case "link":
        case "image":
          return plainTextOf(inline.children);
        default:
          return assertNever(inline);
      }
    })
    .join("");
}
