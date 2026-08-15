export type ClipNode = { id: string };
export type ClipLink = { source: string; target: string; kind: string };

/**
 * When `seedIds` is null, keep the full graph.
 * Otherwise keep seed notes plus one-hop neighbors from `links`
 * (so filtered problems still show their pattern hubs).
 */
export function clipGraph<N extends ClipNode, L extends ClipLink>(
  nodes: N[],
  links: L[],
  seedIds: Set<string> | null,
): { nodes: N[]; links: L[] } {
  if (seedIds === null) {
    return { nodes, links };
  }
  if (seedIds.size === 0) {
    return { nodes: [], links: [] };
  }

  const keep = new Set(seedIds);
  for (const link of links) {
    if (seedIds.has(link.source) || seedIds.has(link.target)) {
      keep.add(link.source);
      keep.add(link.target);
    }
  }

  return {
    nodes: nodes.filter((node) => keep.has(node.id)),
    links: links.filter(
      (link) => keep.has(link.source) && keep.has(link.target),
    ),
  };
}
