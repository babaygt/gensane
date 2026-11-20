// Finds as you type in search-index.json. Words are cut as in src/core/search/words.ts; a test checks both.

/** @typedef {{ title: string, url: string, description?: string, tags: string[], date?: string, words: string[] }} Entry */

/** @param {string} text */
export function wordsOf(text) {
  const words = text
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2);
  return [...new Set(words)];
}

/**
 * Entries with every word, best first; the last word may be unfinished.
 * @param {Entry[]} entries
 * @param {string} query
 */
export function search(entries, query) {
  const wanted = wordsOf(query);
  const scored = [];
  for (const entry of entries) {
    // Title, tags, description, text: each worth half the one before.
    const fields = [
      wordsOf(entry.title),
      wordsOf(entry.tags.join(" ")),
      wordsOf(entry.description ?? ""),
      entry.words,
    ];
    let score = 0;
    for (const [index, word] of wanted.entries()) {
      const last = index === wanted.length - 1;
      const at = fields.findIndex((found) =>
        found.some((one) => (last ? one.startsWith(word) : one === word)),
      );
      score += at === -1 ? -Infinity : 2 ** (3 - at);
    }
    // No words, or a word nowhere, give no score.
    if (score > 0) scored.push({ entry, score });
  }
  // The sort keeps the order of the index for results that are just as good and as new.
  scored.sort(
    (a, b) => b.score - a.score || (b.entry.date ?? "").localeCompare(a.entry.date ?? ""),
  );
  return scored.map(({ entry }) => entry);
}

/**
 * @param {string} tag
 * @param {string} text
 */
const element = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });

/** @param {HTMLFormElement} form */
function start(form) {
  const input = form.querySelector("input");
  const status = document.querySelector(".search-status");
  const list = document.querySelector(".search-results");
  if (!input || !status || !list) return;
  // The build added the site's path, if any, to the form's action.
  const base = new URL(form.action).pathname.replace(/search\/$/, "");
  /** @type {Promise<Entry[]> | undefined} */
  let loading;
  const load = () =>
    (loading ??= fetch(`${base}search-index.json`)
      .then((response) => response.json())
      .then((index) => index.documents));
  const show = async () => {
    const query = input.value.trim();
    const found = query ? search(await load(), query) : [];
    list.replaceChildren(
      ...found.slice(0, 50).map((result) => {
        const item = element("li", "");
        item.append(
          Object.assign(element("a", result.title), { href: base + result.url.slice(1) }),
        );
        if (result.description) item.append(element("p", result.description));
        return item;
      }),
    );
    status.textContent = query ? `Results: ${found.length}` : "";
  };
  form.addEventListener("submit", (event) => event.preventDefault());
  input.addEventListener("input", show);
  input.addEventListener("focus", load, { once: true });
  input.value = new URLSearchParams(location.search).get("q") ?? "";
  if (input.value) show();
}

if (typeof document !== "undefined") {
  const form = document.querySelector(".search-form");
  if (form instanceof HTMLFormElement) start(form);
}
