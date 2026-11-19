import type { Pagination } from "./routes.ts";

/** The first page is the list itself, such as `/blog/`, and the others are `/blog/page/2/` and so on. */
export function pageUrl(baseUrl: string, page: number): string {
  return page === 1 ? baseUrl : `${baseUrl}page/${page}/`;
}

export function paginate<Item>(
  items: readonly Item[],
  perPage: number,
  baseUrl: string,
): Pagination<Item>[] {
  const total = Math.ceil(items.length / perPage);
  return Array.from({ length: total }, (_, index) => {
    const current = index + 1;
    return {
      items: items.slice(index * perPage, current * perPage),
      current,
      total,
      previousUrl: current > 1 ? pageUrl(baseUrl, current - 1) : undefined,
      nextUrl: current < total ? pageUrl(baseUrl, current + 1) : undefined,
    };
  });
}
