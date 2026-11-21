/**
 * The ways gensane reaches the world outside its code. The command line gets them as arguments, so
 * tests can give it versions that work in memory.
 */
export type { FileSystem } from "./file-system.ts";
export { MemoryFileSystem } from "./memory-file-system.ts";
export { NodeFileSystem } from "./node-file-system.ts";
export { type ModuleLoader, NodeModuleLoader } from "./module-loader.ts";
export { type Clock, SystemClock } from "./clock.ts";
export { MemoryTerminal, NodeTerminal, type Terminal, wantsColor } from "./terminal.ts";
export { ManualWatcher, NodeWatcher, type Watcher } from "./watcher.ts";
export { AskingStopped, NodePrompter, type Prompter, ScriptedPrompter } from "./prompter.ts";
