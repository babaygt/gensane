// Builds gensane.dev into website/dist: the product page, and the example site under /example/.
// Run with `pnpm website`, which builds gensane first, so both sites use the package as it would be
// published. The example is built first and put in the website's public folder, so the website's
// links to it are checked like any other.
import { execFileSync } from "node:child_process";
import { cp, rm } from "node:fs/promises";
import { join } from "node:path";
import { importDocs } from "./import-docs.ts";

const root = join(import.meta.dirname, "..");
const program = join(root, "dist", "cli", "main.js");
const build = (site: string) =>
  execFileSync(process.execPath, [program, "build"], { cwd: join(root, site), stdio: "inherit" });

const pages = await importDocs(root, join(root, "website", "content"));
console.log(`Imported the documentation: ${pages} pages.`);
build("example");
const inWebsite = join(root, "website", "public", "example");
await rm(inWebsite, { recursive: true, force: true });
await cp(join(root, "example", "dist"), inWebsite, { recursive: true });
build("website");
console.log("gensane.dev is in website/dist, with the example in website/dist/example.");
