// The switch between light and dark, and a label and a copy button on code blocks. Pages work without it.
// Type-checked by tsconfig.theme.json.

const STORAGE_KEY = "gensane-color-scheme";

/**
 * The scheme a click on the switch leads to.
 * @param {"light" | "dark"} shown
 * @returns {"light" | "dark"}
 */
export function nextScheme(shown) {
  return shown === "dark" ? "light" : "dark";
}

/**
 * The scheme chosen on the switch, or else the system's.
 * @param {string | undefined} chosen
 * @param {boolean} systemIsDark
 * @returns {"light" | "dark"}
 */
export function shownScheme(chosen, systemIsDark) {
  if (chosen === "light" || chosen === "dark") return chosen;
  return systemIsDark ? "dark" : "light";
}

/**
 * The language of a code block, from its `language-ts` class.
 * @param {string} className
 * @returns {string | undefined}
 */
export function languageOf(className) {
  return /(?:^|\s)language-(\S+)/.exec(className)?.[1];
}

/** @param {HTMLButtonElement} button */
function startSwitch(button) {
  const root = document.documentElement;
  const system = matchMedia("(prefers-color-scheme: dark)");
  const show = () => {
    const shown = shownScheme(root.dataset["colorScheme"], system.matches);
    button.textContent = nextScheme(shown) === "dark" ? "Dark" : "Light";
    button.setAttribute("aria-label", `Use ${nextScheme(shown)} colors`);
  };
  button.addEventListener("click", () => {
    const next = nextScheme(shownScheme(root.dataset["colorScheme"], system.matches));
    root.dataset["colorScheme"] = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A private window may refuse; the page still switches.
    }
    show();
  });
  system.addEventListener("change", show);
  show();
  button.hidden = false;
}

/** @param {HTMLPreElement} pre */
function startCodeBlock(pre) {
  const code = pre.querySelector("code");
  if (code === null) return;
  const box = document.createElement("div");
  box.className = "code";
  pre.replaceWith(box);
  box.append(pre);
  const language = languageOf(code.className);
  if (language !== undefined) {
    const label = document.createElement("span");
    label.className = "code-language";
    label.textContent = language;
    box.append(label);
  }
  if (navigator.clipboard === undefined) return;
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "code-copy";
  copy.textContent = "Copy";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.textContent ?? "");
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Can't copy";
    }
    setTimeout(() => (copy.textContent = "Copy"), 2000);
  });
  box.append(copy);
}

if (typeof document !== "undefined") {
  const button = document.querySelector(".scheme-switch");
  if (button instanceof HTMLButtonElement) startSwitch(button);
  for (const pre of document.querySelectorAll("main pre")) {
    if (pre instanceof HTMLPreElement) startCodeBlock(pre);
  }
}
