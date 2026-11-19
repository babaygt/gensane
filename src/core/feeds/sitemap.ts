/** A sitemap tells search engines every page of the site: https://www.sitemaps.org/protocol.html */
import type { Route } from "../site/routes.ts";
import { dayOrDateTime } from "./feed-dates.ts";
import { type SiteAddress, absoluteUrl } from "./site-address.ts";
import { escapeXml } from "./xml.ts";

function lastChangeOf(route: Route): string | undefined {
  if (route.kind !== "post") return undefined;
  return dayOrDateTime(route.page.fields.updated ?? route.page.fields.date);
}

/** The routes must already be without drafts and sorted. */
export function sitemap(routes: readonly Route[], address: SiteAddress): string {
  const urls = routes
    .filter((route) => route.kind !== "not-found")
    .flatMap((route) => {
      const lastChange = lastChangeOf(route);
      return [
        "  <url>",
        `    <loc>${escapeXml(absoluteUrl(address, route.url))}</loc>`,
        ...(lastChange === undefined ? [] : [`    <lastmod>${lastChange}</lastmod>`]),
        "  </url>",
      ];
    });
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}
