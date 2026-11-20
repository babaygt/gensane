import { watch } from "node:fs";
import { sep } from "node:path";

/** Tells when files in a folder change, so `gensane dev` can build again. */
export interface Watcher {
  /**
   * Calls `onChange` with the path of what changed, relative to the folder, with `/` between its parts.
   * The returned function stops watching.
   */
  watch(folder: string, onChange: (path: string) => void): () => void;
}

export class NodeWatcher implements Watcher {
  watch(folder: string, onChange: (path: string) => void): () => void {
    const watcher = watch(folder, { recursive: true }, (_event, name) => {
      if (name !== null) onChange(name.split(sep).join("/"));
    });
    return () => watcher.close();
  }
}

/** A watcher that tests change by hand. */
export class ManualWatcher implements Watcher {
  readonly #listeners = new Set<(path: string) => void>();

  watch(_folder: string, onChange: (path: string) => void): () => void {
    this.#listeners.add(onChange);
    return () => this.#listeners.delete(onChange);
  }

  /** Tells everyone watching that a file changed. */
  change(path: string): void {
    for (const listener of this.#listeners) listener(path);
  }

  get watching(): number {
    return this.#listeners.size;
  }
}
