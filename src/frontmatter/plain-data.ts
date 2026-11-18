import { assertNever } from "../diagnostics/index.ts";
import type { FrontmatterValue } from "./values.ts";

/** The values without their positions, as ordinary JavaScript data. Dates stay text. */
export function toPlainData(value: FrontmatterValue): unknown {
  switch (value.kind) {
    case "string":
    case "number":
    case "boolean":
      return value.value;
    case "null":
      return null;
    case "date":
      return value.text;
    case "list":
      return value.items.map(toPlainData);
    case "map":
      return Object.fromEntries(
        value.entries.map((entry) => [entry.key, toPlainData(entry.value)]),
      );
    default:
      return assertNever(value);
  }
}
