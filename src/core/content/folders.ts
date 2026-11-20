import type { ContentType } from "../../frontmatter/index.ts";

/** Each folder inside the content folder holds one type of content. */
export const FOLDERS: ReadonlyMap<string, ContentType> = new Map([
  ["blog", "post"],
  ["projects", "project"],
  ["talks", "talk"],
  ["experience", "experience"],
  ["education", "education"],
  ["pages", "page"],
]);

export function folderOf(type: ContentType): string {
  const folder = [...FOLDERS].find(([, folderType]) => folderType === type)?.[0];
  return folder ?? type;
}
