/**
 * How `gensane dev` answers a request. It only serves what the last build made and the files it
 * copies, looked up by their exact path, so no address can reach any other file.
 */

/** What the server has to serve: the last build, or its problems. */
export type ServedSite =
  | {
      readonly kind: "site";
      /** Each file the build made, by its path, such as `blog/hello/index.html`. */
      readonly files: ReadonlyMap<string, string>;
      /** The files copied as they are, from `public/` or the theme's `assets/`: each one's source, by its path. */
      readonly copies: ReadonlyMap<string, string>;
    }
  | {
      readonly kind: "problems";
      /** A page that lists the problems. */
      readonly page: string;
    };

export type Answer =
  | { readonly kind: "text"; readonly status: number; readonly type: string; readonly body: string }
  | { readonly kind: "copy"; readonly source: string; readonly type: string }
  | { readonly kind: "redirect"; readonly location: string };

const TYPES: Readonly<Record<string, string>> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  pdf: "application/pdf",
  woff: "font/woff",
  woff2: "font/woff2",
};

/** The media type of a file, from its extension. */
export function typeOf(path: string): string {
  const name = path.split("/").at(-1) ?? "";
  const extension = name.includes(".") ? (name.split(".").at(-1) ?? "") : "";
  return TYPES[extension.toLowerCase()] ?? "application/octet-stream";
}

const HTML = TYPES["html"] ?? "";

function notFound(site: { readonly files: ReadonlyMap<string, string> }): Answer {
  return { kind: "text", status: 404, type: HTML, body: site.files.get("404.html") ?? "Not found" };
}

/** The answer to a request for `pathname`, the path of the address as the browser sends it. */
export function answer(site: ServedSite, pathname: string): Answer {
  if (site.kind === "problems") return { kind: "text", status: 500, type: HTML, body: site.page };

  let path: string;
  try {
    path = decodeURIComponent(pathname).slice(1);
  } catch {
    return notFound(site);
  }
  const file = path === "" || path.endsWith("/") ? `${path}index.html` : path;
  const built = site.files.get(file);
  if (built !== undefined) return { kind: "text", status: 200, type: typeOf(file), body: built };
  const source = site.copies.get(file);
  if (source !== undefined) return { kind: "copy", source, type: typeOf(file) };
  // `/blog/hello` leads to `/blog/hello/`, as on most web servers.
  if (site.files.has(`${file}/index.html`)) return { kind: "redirect", location: `${pathname}/` };
  return notFound(site);
}
