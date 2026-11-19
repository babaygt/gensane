/**
 * The ways gensane reaches the world outside its code, each with a real version and a version in
 * memory for tests.
 */
export type { FileSystem } from "./file-system.ts";
export { MemoryFileSystem } from "./memory-file-system.ts";
export { NodeFileSystem } from "./node-file-system.ts";
