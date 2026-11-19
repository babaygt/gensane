import { pathToFileURL } from "node:url";

/** Runs a JavaScript or TypeScript file, as a config file is run. */
export interface ModuleLoader {
  /** What the file exports. Fails as `import()` does, such as for a mistake in the file. */
  load(path: string): Promise<Readonly<Record<string, unknown>>>;
}

/** Node's own `import()`. Node runs TypeScript by removing its types. */
export class NodeModuleLoader implements ModuleLoader {
  async load(path: string): Promise<Readonly<Record<string, unknown>>> {
    const exports: Readonly<Record<string, unknown>> = await import(pathToFileURL(path).href);
    return exports;
  }
}
