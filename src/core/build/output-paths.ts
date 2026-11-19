/** Pretty URLs are folders with an `index.html`: `/blog/hello/` is written to `blog/hello/index.html`. */
export function outputPath(url: string): string {
  const path = url.replace(/^\//, "");
  return path === "" || path.endsWith("/") ? `${path}index.html` : path;
}
