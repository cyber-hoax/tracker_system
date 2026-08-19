import { PATTERN_SLUG_PREFIX } from "./constants";
import { displayWikilink } from "./wikilink";

const HASH_TABLE = "hash table";

/** Catalog name already used most: `hash table`. */
export const HASH_TABLE_CANONICAL = HASH_TABLE;

const HASH_ALIASES = [
  "hash table",
  "hashtable",
  "hashmap",
  "hash map",
  "hash set",
  "hashset",
] as const;

const CANONICAL_BY_NORM = new Map<string, string>(
  HASH_ALIASES.map((alias) => [normalizePatternName(alias), HASH_TABLE]),
);

export type PatternNoteCandidate = {
  id: string;
  title: string;
  backlinkCount?: number;
};

function normalizePatternName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function slugifyAlias(value: string): string {
  const slug = normalizePatternName(value).replace(/[^a-z0-9]+/g, "-");
  return slug.replace(/^-+|-+$/g, "") || "note";
}

export function canonicalPatternTitle(raw: string): string {
  const display = displayWikilink(raw).trim();
  if (!display) return display;
  return CANONICAL_BY_NORM.get(normalizePatternName(display)) ?? display;
}

export function titlesForCanonical(canonical: string): string[] {
  if (normalizePatternName(canonical) !== HASH_TABLE) return [canonical];
  return [...HASH_ALIASES];
}

export function patternAliasSlugs(raw: string): string[] {
  const canonical = canonicalPatternTitle(raw.replace(/-/g, " "));
  const titles = titlesForCanonical(canonical);
  const slugs = new Set<string>();
  for (const title of titles) {
    const kebab = slugifyAlias(title);
    slugs.add(kebab);
    slugs.add(`${PATTERN_SLUG_PREFIX}${kebab}`);
  }
  return [...slugs];
}

export function rewritePatternValues(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const next = canonicalPatternTitle(value);
    if (!next) continue;
    const key = normalizePatternName(next);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

export function collapsePatternTitles(titles: string[]): string[] {
  return rewritePatternValues(titles).sort((a, b) => a.localeCompare(b));
}

export function pickCanonicalPatternNote<T extends PatternNoteCandidate>(
  notes: T[],
  canonicalTitle = HASH_TABLE,
): T | null {
  if (notes.length === 0) return null;
  const exact = notes.find(
    (note) => normalizePatternName(note.title) === normalizePatternName(canonicalTitle),
  );
  if (exact) return exact;
  return (
    [...notes].sort(
      (a, b) => (b.backlinkCount ?? 0) - (a.backlinkCount ?? 0),
    )[0] ?? null
  );
}

export function groupAliasedPatternNotes<T extends PatternNoteCandidate>(
  notes: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const note of notes) {
    const canonical = canonicalPatternTitle(note.title);
    const current = groups.get(canonical) ?? [];
    current.push(note);
    groups.set(canonical, current);
  }
  return groups;
}

type GraphNodeLike = { id: string; name: string; type: string };
type GraphLinkLike = { source: string; target: string; kind: string };

/** Drop sibling hash hubs so the graph keeps one canonical pattern node. */
export function collapseAliasedPatternGraph<
  N extends GraphNodeLike,
  L extends GraphLinkLike,
>(nodes: N[], links: L[]): { nodes: N[]; links: L[] } {
  const patternNodes = nodes.filter((node) => node.type === "pattern");
  const groups = groupAliasedPatternNotes(
    patternNodes.map((node) => ({
      id: node.id,
      title: node.name,
    })),
  );
  const redirect = new Map<string, string>();
  const drop = new Set<string>();
  for (const [canonical, group] of groups) {
    if (group.length < 2) continue;
    const keeper = pickCanonicalPatternNote(group, canonical);
    if (!keeper) continue;
    for (const extra of group) {
      if (extra.id === keeper.id) continue;
      redirect.set(extra.id, keeper.id);
      drop.add(extra.id);
    }
  }
  const nextNodes = nodes
    .filter((node) => !drop.has(node.id))
    .map((node) =>
      node.type === "pattern"
        ? { ...node, name: canonicalPatternTitle(node.name) }
        : node,
    );
  if (drop.size === 0) return { nodes: nextNodes, links };
  const seen = new Set<string>();
  const nextLinks: L[] = [];
  for (const link of links) {
    const source = redirect.get(link.source) ?? link.source;
    const target = redirect.get(link.target) ?? link.target;
    if (source === target) continue;
    const key = `${source}->${target}:${link.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nextLinks.push({ ...link, source, target });
  }
  return { nodes: nextNodes, links: nextLinks };
}
