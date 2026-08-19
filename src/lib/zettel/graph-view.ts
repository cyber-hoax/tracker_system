export type GraphViewLink = {
  source: unknown;
  target: unknown;
  kind?: string;
};

export type LabelBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function endpointId(end: unknown): string {
  if (typeof end === "string" || typeof end === "number") return String(end);
  if (end && typeof end === "object" && "id" in end) {
    const id = (end as { id?: unknown }).id;
    if (id != null) return String(id);
  }
  return "";
}

export function buildNeighborMap(
  links: GraphViewLink[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const add = (from: string, to: string) => {
    if (!from || !to) return;
    let set = map.get(from);
    if (!set) {
      set = new Set();
      map.set(from, set);
    }
    set.add(to);
  };

  for (const link of links) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    add(source, target);
    add(target, source);
  }
  return map;
}

export function nodeDegree(
  neighbors: Map<string, Set<string>>,
  id: string,
): number {
  return neighbors.get(id)?.size ?? 0;
}

export function isIncidentTo(
  link: GraphViewLink,
  focusId: string | null,
): boolean {
  if (!focusId) return false;
  return endpointId(link.source) === focusId || endpointId(link.target) === focusId;
}

export function clipLabel(name: string, max = 28): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`;
}

export function matchesQuery(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return name.toLowerCase().includes(q);
}

export function labelPriority(input: {
  type: string;
  degree: number;
  scale: number;
  highlighted: boolean;
  queryHit: boolean;
}): number {
  if (input.highlighted || input.queryHit) return 1000 + input.degree;
  if (input.type === "pattern") {
    if (input.scale < 0.7) return input.degree >= 6 ? 80 + input.degree : 0;
    return 70 + input.degree;
  }
  if (input.scale < 1.7) return 0;
  if (input.scale < 2.5) return input.degree >= 3 ? 20 + input.degree : 0;
  return 10 + input.degree;
}

export function boxesOverlap(a: LabelBox, b: LabelBox, pad = 3): boolean {
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  );
}

export function tryPlaceLabel(
  occupied: LabelBox[],
  next: LabelBox,
  pad = 3,
): boolean {
  if (occupied.some((box) => boxesOverlap(box, next, pad))) return false;
  occupied.push(next);
  return true;
}

export function nodeRadius(type: string, degree: number): number {
  if (type === "pattern") return 7 + Math.min(degree, 12) * 0.35;
  return 3.6 + Math.min(degree, 8) * 0.22;
}

export function chargeStrength(nodeCount: number): number {
  return -Math.max(
    60,
    Math.min(140, 20 + Math.sqrt(Math.max(nodeCount, 1)) * 6),
  );
}

export function nodesInMainCloud<T extends { x?: number; y?: number }>(
  nodes: T[],
  keep = 0.92,
): Set<T> {
  if (nodes.length === 0) return new Set();
  const cx =
    nodes.reduce((sum, node) => sum + (node.x ?? 0), 0) / nodes.length;
  const cy =
    nodes.reduce((sum, node) => sum + (node.y ?? 0), 0) / nodes.length;
  const ranked = [...nodes].sort((a, b) => {
    const da = (a.x ?? 0) - cx;
    const db = (b.x ?? 0) - cx;
    const ea = (a.y ?? 0) - cy;
    const eb = (b.y ?? 0) - cy;
    return da * da + ea * ea - (db * db + eb * eb);
  });
  const count = Math.max(1, Math.ceil(nodes.length * keep));
  return new Set(ranked.slice(0, count));
}

export function linkDistance(kind: string | undefined): number {
  if (kind === "pattern") return 46;
  if (kind === "manual") return 38;
  return 58;
}

export function withAlpha(color: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha));
  const value = color.trim();
  const hex6 = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex6) {
    return `#${hex6[1]}${Math.round(a * 255)
      .toString(16)
      .padStart(2, "0")}`;
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`;
  return value;
}

export const GRAPH_POSITIONS_KEY = "zettel-graph-positions";

export type PinnedPosition = { x: number; y: number };

export function parsePinnedPositions(
  raw: string | null,
): Record<string, PinnedPosition> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, PinnedPosition> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const x = (value as { x?: unknown }).x;
      const y = (value as { y?: unknown }).y;
      if (
        typeof x === "number" &&
        Number.isFinite(x) &&
        typeof y === "number" &&
        Number.isFinite(y)
      ) {
        out[id] = { x, y };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function upsertPinnedPosition(
  current: Record<string, PinnedPosition>,
  id: string,
  x: number,
  y: number,
): Record<string, PinnedPosition> {
  return { ...current, [id]: { x, y } };
}

export function applyPinnedPositions<
  T extends { id: string; x?: number; y?: number; fx?: number; fy?: number },
>(nodes: T[], pins: Record<string, PinnedPosition>): T[] {
  return nodes.map((node) => {
    const pin = pins[node.id];
    if (!pin) return { ...node };
    return { ...node, x: pin.x, y: pin.y, fx: pin.x, fy: pin.y };
  });
}
