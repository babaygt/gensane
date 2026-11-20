import { pathToFileURL } from "node:url";

/** Runs a JavaScript or TypeScript file, as a config file is run. */
export interface ModuleLoader {
  /** What the file exports. Fails as `import()` does, such as for a mistake in the file. */
  load(path: string): Promise<Readonly<Record<string, unknown>>>;
}

/** Node's own `import()`. Node runs TypeScript by removing its types. */
export class NodeModuleLoader implements ModuleLoader {
  #loads = 0;

  /**
   * `import()` runs a file once and remembers it by its address, so each load asks for a new address.
   * That way `gensane dev` sees a config that changed.
   */
  async load(path: string): Promise<Readonly<Record<string, unknown>>> {
    this.#loads++;
    const address = `${pathToFileURL(path).href}?load=${this.#loads}`;
    const exports: Readonly<Record<string, unknown>> = await import(address);
    return exports;
  }
}
