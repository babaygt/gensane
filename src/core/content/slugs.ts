/** A slug is the part of a URL that names one entry, such as `hello-world` in `/blog/hello-world/`. */

const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})(?:-|$)/;

export function isValidSlug(text: string): boolean {
  return VALID_SLUG.test(text);
}

/** Keeps only lowercase letters, digits and single dashes, so it works in any URL: "Über uns" → "uber-uns". */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface FileNameSlug {
  readonly slug: string;
  /** A date at the start of the file name, which is left out of the slug. */
  readonly date: string | undefined;
}

export function slugFromFileName(name: string): FileNameSlug {
  const withoutExtension = name.replace(/\.md$/, "");
  const date = DATE_PREFIX.exec(withoutExtension)?.[1];
  const rest = date === undefined ? withoutExtension : withoutExtension.slice(date.length);
  return { slug: slugify(rest), date };
}
