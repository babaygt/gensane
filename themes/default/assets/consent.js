// The bar that asks before Google Analytics counts a visit. Not written yet: only what its tests use.
// Type-checked by tsconfig.theme.json.

/**
 * What a page does with the choice made before: load Google, leave it out, or ask.
 * @param {string | null} _stored
 * @returns {"load" | "leave" | "ask"}
 */
export function startOf(_stored) {
  return "ask";
}

/**
 * The names of Google Analytics' cookies in `document.cookie`, which "No thanks" removes.
 * @param {string} _cookies
 * @returns {string[]}
 */
export function googleCookies(_cookies) {
  return [];
}

/**
 * The domains a cookie of this host may be set for: the host, and each domain above it but the last.
 * @param {string} _host
 * @returns {string[]}
 */
export function domainsOf(_host) {
  return [];
}
