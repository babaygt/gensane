/** The address of the site, which feeds and sitemaps need because they use full URLs. */
export interface SiteAddress {
  /** Without a slash at the end, such as `https://ada.github.io/notes`. */
  readonly base: string;
  readonly host: string;
  /** The path the site is served under, such as `/notes`, or empty for a site at the root. */
  readonly path: string;
}

export function siteAddressOf(url: unknown): SiteAddress | undefined {
  if (typeof url !== "string" || !URL.canParse(url)) return undefined;
  const parsed = new URL(url);
  const isWeb = parsed.protocol === "https:" || parsed.protocol === "http:";
  if (!isWeb || /[?#]/.test(url)) return undefined;
  const path = parsed.pathname.replace(/\/$/, "");
  return { base: `${parsed.origin}${path}`, host: parsed.host, path };
}

/** `/blog/hello/` → `https://example.com/blog/hello/` */
export function absoluteUrl(address: SiteAddress, url: string): string {
  return `${address.base}${url}`;
}
