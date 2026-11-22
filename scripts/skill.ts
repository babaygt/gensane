// Writes the reference files of the agent skill from the documentation: `pnpm skill`.
import { join } from "node:path";
import { REFERENCES, SKILL_FOLDER, writeReferences } from "./skill-references.ts";

await writeReferences(join(import.meta.dirname, ".."));
console.log(`Wrote ${REFERENCES.length} references into ${SKILL_FOLDER}/references.`);
