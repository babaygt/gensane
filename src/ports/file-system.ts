/**
 * Everything gensane needs from a disk. The command line gets one as an argument, so tests can give
 * it a folder in memory instead of the real disk.
 */
export interface FileSystem {
  /**
   * The paths of every file in a folder and its subfolders, relative to the folder, with `/`
   * between their parts, sorted. Empty when the folder doesn't exist.
   */
  listFiles(folder: string): Promise<string[]>;
  /** Fails when the file doesn't exist. */
  readText(path: string): Promise<string>;
  /** Writes a file, making its folders first. */
  writeText(path: string, content: string): Promise<void>;
  /** Copies the exact bytes of a file, making the folders of the copy first. */
  copyFile(from: string, to: string): Promise<void>;
  /** Removes a folder and everything in it. Does nothing when it doesn't exist. */
  removeFolder(folder: string): Promise<void>;
}
