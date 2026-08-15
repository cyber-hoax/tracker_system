import { PATTERN_SLUG_PREFIX } from "./constants";

export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || "note";
}

/** Globally unique DB slug for a pattern note. Problem slugs stay unprefixed. */
export function patternDbSlug(title: string): string {
  return `${PATTERN_SLUG_PREFIX}${slugify(title)}`;
}

/** URL segment for `/patterns/[slug]` given the stored notes.slug. */
export function patternUrlSlug(dbSlug: string): string {
  return dbSlug.startsWith(PATTERN_SLUG_PREFIX)
    ? dbSlug.slice(PATTERN_SLUG_PREFIX.length)
    : dbSlug;
}

export function patternSlugCandidates(urlSlug: string): string[] {
  const kebab = slugify(urlSlug);
  return [...new Set([urlSlug, kebab, `${PATTERN_SLUG_PREFIX}${kebab}`])];
}

export function noteHref(type: string, slug: string): string {
  if (type === "pattern") {
    return `/patterns/${patternUrlSlug(slug)}`;
  }
  if (type === "problem") {
    return `/dsa/${slug}`;
  }
  return `/notes/${slug}`;
}
