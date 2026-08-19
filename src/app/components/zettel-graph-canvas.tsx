"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { ForceGraphMethods } from "react-force-graph-2d";
import type { GraphData, GraphLink, GraphNode } from "@/lib/zettel/graph";
import {
  applyPinnedPositions,
  buildNeighborMap,
  chargeStrength,
  clipLabel,
  endpointId,
  GRAPH_POSITIONS_KEY,
  isIncidentTo,
  labelPriority,
  linkDistance,
  matchesQuery,
  nodeDegree,
  nodeRadius,
  nodesInMainCloud,
  parsePinnedPositions,
  tryPlaceLabel,
  upsertPinnedPosition,
  withAlpha,
  type LabelBox,
} from "@/lib/zettel/graph-view";

type Theme = {
  problem: string;
  pattern: string;
  other: string;
  patternLink: string;
  wikilink: string;
  manual: string;
  label: string;
  crust: string;
  overlay: string;
  mauve: string;
};

const FALLBACK: Theme = {
  problem: "#cba6f7",
  pattern: "#89b4fa",
  other: "#fab387",
  patternLink: "#cba6f7",
  wikilink: "#6c7086",
  manual: "#a6e3a1",
  label: "#cdd6f4",
  crust: "#11111b",
  overlay: "#6c7086",
  mauve: "#cba6f7",
};

function readTheme(el: HTMLElement | null): Theme {
  if (!el) return FALLBACK;
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    problem: v("--ctp-mauve", FALLBACK.problem),
    pattern: v("--ctp-blue", FALLBACK.pattern),
    other: v("--ctp-peach", FALLBACK.other),
    patternLink: v("--ctp-mauve", FALLBACK.patternLink),
    wikilink: v("--ctp-overlay0", FALLBACK.wikilink),
    manual: v("--ctp-green", FALLBACK.manual),
    label: v("--ctp-text", FALLBACK.label),
    crust: v("--ctp-crust", FALLBACK.crust),
    overlay: v("--ctp-overlay0", FALLBACK.overlay),
    mauve: v("--ctp-mauve", FALLBACK.mauve),
  };
}

function nodeFill(type: string, theme: Theme): string {
  if (type === "pattern") return theme.pattern;
  if (type === "problem") return theme.problem;
  return theme.other;
}

function linkStroke(kind: string, theme: Theme): string {
  if (kind === "pattern") return theme.patternLink;
  if (kind === "manual") return theme.manual;
  return theme.wikilink;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

type SimNode = GraphNode & {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

function readPins(): Record<string, { x: number; y: number }> {
  try {
    return parsePinnedPositions(
      window.localStorage.getItem(GRAPH_POSITIONS_KEY),
    );
  } catch {
    return {};
  }
}

function writePins(pins: Record<string, { x: number; y: number }>) {
  try {
    window.localStorage.setItem(GRAPH_POSITIONS_KEY, JSON.stringify(pins));
  } catch {
    /* ignore quota */
  }
}

function graphWithPins(data: GraphData): GraphData {
  return {
    nodes: applyPinnedPositions(data.nodes, readPins()),
    links: data.links,
  };
}

function paintNodeShape(
  ctx: CanvasRenderingContext2D,
  type: string,
  x: number,
  y: number,
  radius: number,
) {
  if (type === "pattern") {
    const size = radius * 1.7;
    roundRect(ctx, x - size / 2, y - size / 2, size, size, 2);
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
}

export function ZettelGraphCanvas({ data }: { data: GraphData }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(
    undefined,
  );
  const themeRef = useRef<Theme>(FALLBACK);
  const hoverIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const queryRef = useRef("");
  const fittedRef = useRef(false);
  const forcesReadyRef = useRef(false);
  const draggingRef = useRef(false);
  const labelIdsRef = useRef<Set<string>>(new Set());
  const [size, setSize] = useState({ width: 800, height: 560 });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hover, setHover] = useState<GraphNode | null>(null);
  const [theme, setTheme] = useState<Theme>(FALLBACK);
  const [graphData, setGraphData] = useState<GraphData>(() => graphWithPins(data));

  const neighbors = useMemo(
    () => buildNeighborMap(data.links),
    [data.links],
  );
  const byId = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of data.nodes) map.set(node.id, node);
    return map;
  }, [data.nodes]);

  useEffect(() => {
    const next = readTheme(wrapRef.current);
    themeRef.current = next;
    setTheme(next);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setSize({
        width: Math.max(el.clientWidth, 320),
        height: Math.max(el.clientHeight, 240),
      });
    });
    observer.observe(el);
    setSize({
      width: Math.max(el.clientWidth, 320),
      height: Math.max(el.clientHeight, 240),
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setGraphData(graphWithPins(data));
    fittedRef.current = false;
    forcesReadyRef.current = false;
  }, [data, neighbors]);

  const inspect = selected ?? hover;
  const queryHits = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return data.nodes.filter((node) => matchesQuery(node.name, q));
  }, [data.nodes, query]);

  function fitGraph(filter?: (node: GraphNode) => boolean) {
    const fg = fgRef.current;
    if (!fg) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : 280;
    if (filter) {
      fg.zoomToFit(duration, 72, filter);
      return;
    }
    const cloud = nodesInMainCloud(
      graphData.nodes as Array<GraphNode & { x?: number; y?: number }>,
    );
    const ids = new Set(
      [...cloud].map((node) => node.id),
    );
    fg.zoomToFit(duration, 72, (node) => ids.has(String(node.id)));
  }

  function setFocusFromHover(node: GraphNode | null) {
    const id = node?.id ?? null;
    if (hoverIdRef.current === id) return;
    hoverIdRef.current = id;
    setHover(node);
    fgRef.current?.resumeAnimation();
  }

  function selectNode(node: GraphNode | null) {
    selectedIdRef.current = node?.id ?? null;
    setSelected(node);
    fgRef.current?.resumeAnimation();
  }

  function pinNode(node: SimNode) {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    node.fx = x;
    node.fy = y;
    writePins(upsertPinnedPosition(readPins(), node.id, x, y));
  }

  return (
    <div
      ref={wrapRef}
      className="relative min-h-[320px] flex-1 touch-manipulation overflow-hidden rounded-2xl border border-ctp-surface0 bg-ctp-crust [&_.graph-tooltip]:hidden"
    >
      <ForceGraph2D<GraphNode, GraphLink>
        ref={fgRef}
        width={size.width}
        height={size.height}
        graphData={graphData}
        backgroundColor={theme.crust}
        nodeId="id"
        nodeLabel={() => ""}
        nodeRelSize={4}
        warmupTicks={40}
        cooldownTicks={300}
        cooldownTime={3500}
        d3VelocityDecay={0.34}
        enableNodeDrag
        showPointerCursor
        onEngineTick={() => {
          if (forcesReadyRef.current) return;
          const fg = fgRef.current;
          if (!fg) return;
          applyForces(fg, data.nodes.length, neighbors);
          forcesReadyRef.current = true;
        }}
        onEngineStop={() => {
          if (fittedRef.current) return;
          fittedRef.current = true;
          fitGraph();
        }}
        linkColor={(link) => {
          const theme = themeRef.current;
          const kind = String(link.kind ?? "wikilink");
          const base = linkStroke(kind, theme);
          const selectedId = selectedIdRef.current;
          const hoverId = hoverIdRef.current;
          const focus = selectedId ?? hoverId;
          const q = queryRef.current;
          if (q.trim()) {
            const sourceHit = matchesQuery(
              byId.get(endpointId(link.source))?.name ?? "",
              q,
            );
            const targetHit = matchesQuery(
              byId.get(endpointId(link.target))?.name ?? "",
              q,
            );
            return withAlpha(base, sourceHit && targetHit ? 0.85 : 0.08);
          }
          if (!focus) return withAlpha(base, kind === "pattern" ? 0.42 : 0.28);
          return withAlpha(base, isIncidentTo(link, focus) ? 0.95 : 0.08);
        }}
        linkWidth={(link) => {
          const focus = selectedIdRef.current ?? hoverIdRef.current;
          if (focus && isIncidentTo(link, focus)) return 2.2;
          return link.kind === "pattern" ? 1.4 : 1;
        }}
        linkLineDash={(link) =>
          String(link.kind ?? "wikilink") === "wikilink" ? [1.5, 3] : null
        }
        onNodeHover={(node) => {
          setFocusFromHover((node as GraphNode | null) ?? null);
        }}
        onNodeDrag={() => {
          draggingRef.current = true;
        }}
        onNodeDragEnd={(node) => {
          pinNode(node as SimNode);
          window.setTimeout(() => {
            draggingRef.current = false;
          }, 0);
        }}
        onNodeClick={(node, event) => {
          if (draggingRef.current) return;
          const n = node as GraphNode;
          if (event.detail >= 2 && n.href) {
            router.push(n.href);
            return;
          }
          selectNode(n);
        }}
        onBackgroundClick={() => {
          setFocusFromHover(null);
          selectNode(null);
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as GraphNode & { x?: number; y?: number };
          const theme = themeRef.current;
          const x = n.x ?? 0;
          const y = n.y ?? 0;
          const degree = nodeDegree(neighbors, n.id);
          const radius = nodeRadius(n.type, degree);
          const selectedId = selectedIdRef.current;
          const hoverId = hoverIdRef.current;
          const focus = selectedId ?? hoverId;
          const q = queryRef.current;
          const queryHit = matchesQuery(n.name, q);
          const neighborOfFocus = Boolean(
            focus && neighbors.get(focus)?.has(n.id),
          );
          const highlighted = n.id === focus || neighborOfFocus;
          let alpha = 1;
          if (q.trim()) alpha = queryHit || highlighted ? 1 : 0.12;
          else if (focus) alpha = highlighted ? 1 : 0.16;

          ctx.globalAlpha = alpha;
          ctx.fillStyle = nodeFill(n.type, theme);
          paintNodeShape(ctx, n.type, x, y, radius);
          ctx.fill();

          if (n.id === selectedId || n.id === hoverId) {
            ctx.strokeStyle = theme.mauve;
            ctx.lineWidth = 2 / Math.max(globalScale, 0.5);
            paintNodeShape(ctx, n.type, x, y, radius + 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;

          if (!labelIdsRef.current.has(n.id)) return;

          const label = clipLabel(n.name);
          const fontSize = Math.min(12, Math.max(9, 11 / globalScale));
          ctx.font = `${fontSize}px JetBrains Mono, ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const textW = ctx.measureText(label).width;
          const padX = 3 / globalScale;
          const padY = 2 / globalScale;
          const boxX = x - textW / 2 - padX;
          const boxY = y + radius + 3 / globalScale;
          ctx.fillStyle = withAlpha(theme.crust, 0.88);
          roundRect(
            ctx,
            boxX,
            boxY,
            textW + padX * 2,
            fontSize + padY * 2,
            2 / globalScale,
          );
          ctx.fill();
          ctx.fillStyle = theme.label;
          ctx.fillText(label, x, boxY + padY);
        }}
        nodeCanvasObjectMode={() => "replace"}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as GraphNode & { x?: number; y?: number };
          const radius = nodeRadius(n.type, nodeDegree(neighbors, n.id));
          ctx.fillStyle = color;
          paintNodeShape(ctx, n.type, n.x ?? 0, n.y ?? 0, radius + 4);
          ctx.fill();
        }}
        onRenderFramePre={(ctx, globalScale) => {
          const selectedId = selectedIdRef.current;
          const hoverId = hoverIdRef.current;
          const focus = selectedId ?? hoverId;
          const q = queryRef.current;
          const occupied: LabelBox[] = [];
          const ranked = [...graphData.nodes].sort((a, b) => {
            const pa = labelPriority({
              type: a.type,
              degree: nodeDegree(neighbors, a.id),
              scale: globalScale,
              highlighted:
                a.id === focus ||
                Boolean(focus && neighbors.get(focus)?.has(a.id)),
              queryHit: matchesQuery(a.name, q),
            });
            const pb = labelPriority({
              type: b.type,
              degree: nodeDegree(neighbors, b.id),
              scale: globalScale,
              highlighted:
                b.id === focus ||
                Boolean(focus && neighbors.get(focus)?.has(b.id)),
              queryHit: matchesQuery(b.name, q),
            });
            return pb - pa;
          });
          const show = new Set<string>();
          ctx.font = `${Math.min(12, Math.max(9, 11 / globalScale))}px JetBrains Mono, ui-monospace, monospace`;
          for (const node of ranked) {
            const n = node as GraphNode & { x?: number; y?: number };
            const degree = nodeDegree(neighbors, n.id);
            const priority = labelPriority({
              type: n.type,
              degree,
              scale: globalScale,
              highlighted:
                n.id === focus ||
                Boolean(focus && neighbors.get(focus)?.has(n.id)),
              queryHit: matchesQuery(n.name, q),
            });
            if (priority <= 0) continue;
            const label = clipLabel(n.name);
            const fontSize = Math.min(12, Math.max(9, 11 / globalScale));
            const textW = ctx.measureText(label).width;
            const radius = nodeRadius(n.type, degree);
            const box = {
              x: (n.x ?? 0) - textW / 2,
              y: (n.y ?? 0) + radius + 3 / globalScale,
              w: textW,
              h: fontSize,
            };
            const force = priority >= 1000;
            if (force || tryPlaceLabel(occupied, box)) show.add(n.id);
          }
          labelIdsRef.current = show;
        }}
      />

      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-3">
        <form
          className="pointer-events-auto flex min-w-[220px] max-w-sm flex-1 items-center gap-2 rounded-xl border border-ctp-surface0 bg-ctp-base px-3 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            const first = queryHits[0];
            if (!first) return;
            selectNode(first);
            fitGraph((node) => matchesQuery(node.name, queryRef.current));
          }}
        >
          <MagnifyingGlass
            size={16}
            weight="bold"
            className="shrink-0 text-ctp-overlay0"
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor="graph-find">
            Find a note in the graph
          </label>
          <input
            id="graph-find"
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              queryRef.current = next;
              setQuery(next);
              fgRef.current?.resumeAnimation();
            }}
            placeholder="Find a note"
            className="min-w-0 flex-1 bg-transparent text-sm text-ctp-text outline-none placeholder:text-ctp-overlay0"
          />
          {query.trim() ? (
            <span className="font-mono text-[13px] text-ctp-overlay0">
              {queryHits.length}
            </span>
          ) : null}
        </form>
        <button
          type="button"
          onClick={() => {
            fittedRef.current = true;
            fitGraph();
          }}
          className="pointer-events-auto rounded-full border border-ctp-surface1 bg-ctp-base px-3 py-2 font-mono text-[13px] text-ctp-text hover:border-ctp-overlay1 hover:bg-ctp-surface0"
        >
          Fit
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-ctp-surface0 bg-ctp-base px-3 py-2 font-mono text-[13px] text-ctp-overlay0">
          <LegendDot className="bg-ctp-mauve" label="Problem" />
          <LegendDot
            className="rounded-[2px] bg-ctp-blue"
            label="Pattern hub"
          />
          <LegendLine className="bg-ctp-mauve" label="Pattern" />
          <LegendLine className="bg-ctp-overlay0" label="Wikilink" />
          <LegendLine className="bg-ctp-green" label="Manual" />
        </div>

        {inspect ? (
          <div className="pointer-events-auto max-w-sm rounded-xl border border-ctp-surface0 bg-ctp-base p-3">
            <p className="text-sm text-ctp-text">{inspect.name}</p>
            <p className="mt-1 font-mono text-[13px] text-ctp-overlay0">
              {inspect.type}
              {inspect.status ? ` · ${inspect.status}` : ""}
              {inspect.difficulty ? ` · ${inspect.difficulty}` : ""}
              {` · ${nodeDegree(neighbors, inspect.id)} links`}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {inspect.href ? (
                <button
                  type="button"
                  onClick={() => router.push(inspect.href)}
                  className="rounded-full bg-ctp-peach px-3 py-1.5 font-mono text-[13px] text-ctp-crust"
                >
                  Open note
                </button>
              ) : null}
              {selected ? (
                <button
                  type="button"
                  onClick={() => selectNode(null)}
                  className="rounded-full border border-ctp-surface1 px-3 py-1.5 font-mono text-[13px] text-ctp-text hover:border-ctp-overlay1 hover:bg-ctp-surface0"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type GraphViewLinkLike = { kind?: string };

function applyForces(
  fg: ForceGraphMethods<GraphNode, GraphLink>,
  nodeCount: number,
  neighbors: Map<string, Set<string>>,
) {
  fg.d3Force("charge")?.strength?.(chargeStrength(nodeCount));
  const link = fg.d3Force("link");
  link?.distance?.((item: GraphViewLinkLike) =>
    linkDistance(String(item.kind ?? "wikilink")),
  );
  link?.strength?.(0.45);
  fg.d3Force("collide")?.radius?.((node: GraphNode) => {
    const degree = nodeDegree(neighbors, node.id);
    return nodeRadius(node.type, degree) + 4;
  });
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function LegendLine({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-0.5 w-4 ${className}`} />
      {label}
    </span>
  );
}
