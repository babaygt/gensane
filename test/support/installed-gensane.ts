import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const packageRoot = join(import.meta.dirname, "..", "..");

/** What `npm install` would do for a site: `import "@gensane/cli"` finds this package's source. */
export async function installGensane(site: string): Promise<void> {
  const installed = join(site, "node_modules", "@gensane", "cli");
  await mkdir(installed, { recursive: true });
  await writeFile(
    join(installed, "package.json"),
    '{ "name": "@gensane/cli", "type": "module", "exports": "./index.js" }\n',
  );
  const source = pathToFileURL(join(packageRoot, "src", "index.ts")).href;
  await writeFile(join(installed, "index.js"), `export * from ${JSON.stringify(source)};\n`);
}
