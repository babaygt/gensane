// The bar that asks before Google Analytics counts a visit. Google's script loads only after "Allow",
// and the choice is kept in this browser. Without this script the bar stays hidden, and Google never loads.
// Type-checked by tsconfig.theme.json.

const STORAGE_KEY = "gensane-analytics-consent";

/**
 * What a page does with the choice made before: load Google, leave it out, or ask.
 * @param {string | null} stored
 * @returns {"load" | "leave" | "ask"}
 */
export function startOf(stored) {
  if (stored === "yes") return "load";
  if (stored === "no") return "leave";
  return "ask";
}

/**
 * The names of Google Analytics' cookies in `document.cookie`, which "No thanks" removes.
 * @param {string} cookies
 * @returns {string[]}
 */
export function googleCookies(cookies) {
  return cookies
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim() ?? "")
    .filter((name) => name === "_ga" || name.startsWith("_ga_") || name === "_gid");
}

/**
 * The domains a cookie of this host may be set for: the host, and each domain above it but the last.
 * @param {string} host
 * @returns {string[]}
 */
export function domainsOf(host) {
  const parts = host.split(".");
  return parts.slice(0, -1).map((_, index) => parts.slice(index).join("."));
}

/**
 * The address of Google's script for an ID, which can't add anything else to it.
 * @param {string} id
 */
export function googleScript(id) {
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
}

/** @param {string} id */
function loadGoogle(id) {
  const page = /** @type {Window & { dataLayer?: unknown[] }} */ (window);
  const layer = (page.dataLayer ??= []);
  // Google's script reads each command as the `arguments` of a call, not as an array.
  /** @param {...unknown} _command */
  function gtag(..._command) {
    layer.push(arguments);
  }
  gtag("js", new Date());
  gtag("config", id);
  const script = document.createElement("script");
  script.async = true;
  script.src = googleScript(id);
  document.head.append(script);
}

/** @param {string} id */
function stopGoogle(id) {
  // Google's own switch: a script already on the page sends nothing more.
  Object.assign(window, { [`ga-disable-${id}`]: true });
  for (const name of googleCookies(document.cookie)) {
    for (const domain of ["", ...domainsOf(location.hostname).map((each) => `; domain=${each}`)])
      document.cookie = `${name}=; max-age=0; path=/${domain}`;
  }
}

/** @param {string} choice */
function keep(choice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // A private window may refuse; the bar asks again on the next page.
  }
}

/** @returns {string | null} */
function kept() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** @param {HTMLElement} bar */
function startBar(bar) {
  const id = bar.dataset["google"] ?? "";
  const allow = bar.querySelector('[data-consent="yes"]');
  const refuse = bar.querySelector('[data-consent="no"]');
  const settings = document.querySelector(".consent-settings");
  if (!(allow instanceof HTMLButtonElement) || !(refuse instanceof HTMLButtonElement)) return;
  let loaded = false;
  let fromSettings = false;
  // Focus goes back to Cookie settings only when the bar was opened from it, and the page stays where
  // the reader left it: the button is at the bottom of the page.
  const close = () => {
    const hadFocus = bar.contains(document.activeElement);
    bar.hidden = true;
    if (hadFocus && fromSettings && settings instanceof HTMLButtonElement)
      settings.focus({ preventScroll: true });
  };
  allow.addEventListener("click", () => {
    keep("yes");
    close();
    if (!loaded) loadGoogle(id);
    loaded = true;
  });
  refuse.addEventListener("click", () => {
    keep("no");
    close();
    stopGoogle(id);
  });
  if (settings instanceof HTMLButtonElement) {
    settings.addEventListener("click", () => {
      bar.hidden = false;
      fromSettings = true;
      allow.focus();
    });
    if (settings.parentElement !== null) settings.parentElement.hidden = false;
  }
  const start = startOf(kept());
  if (start === "load") {
    loadGoogle(id);
    loaded = true;
  } else if (start === "ask") {
    bar.hidden = false;
  }
}

if (typeof document !== "undefined") {
  const bar = document.querySelector(".consent");
  if (bar instanceof HTMLElement) startBar(bar);
}
