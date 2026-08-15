export type ParsedWikilink = {
  target: string;
  alias?: string;
};

/**
 * Accepts `[[Patterns/binary search|binary search]]`, `[[tracker.base]]`,
 * or a bare `binary search` / `Patterns/binary search` string.
 */
export function parseWikilink(raw: string): ParsedWikilink {
  const trimmed = raw.trim();
  const wrapped = trimmed.match(/^\[\[([\s\S]+)\]\]$/);
  const inner = (wrapped ? wrapped[1] : trimmed).trim();
  const pipe = inner.indexOf("|");
  if (pipe === -1) {
    return { target: inner };
  }
  const target = inner.slice(0, pipe).trim();
  const alias = inner.slice(pipe + 1).trim();
  return alias ? { target, alias } : { target };
}

export function wikilinkLeaf(target: string): string {
  const parts = target.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? target;
}

export function displayWikilink(raw: string): string {
  const { target, alias } = parseWikilink(raw);
  return alias || wikilinkLeaf(target);
}

/**
 * Canonical stored form for wikilink JSONB values: unbracketed, no alias.
 * Pattern values strip a leading `Patterns/` folder so they match Obsidian
 * frontmatter (`- binary search`).
 */
export function canonicalWikilinkTarget(
  raw: string,
  options?: { stripPatternFolder?: boolean },
): string {
  const { target, alias } = parseWikilink(raw);
  let next = target;
  if (options?.stripPatternFolder) {
    next = next.replace(/^Patterns\//i, "");
  }
  return (alias && !options?.stripPatternFolder ? alias : wikilinkLeaf(next)).trim();
}
