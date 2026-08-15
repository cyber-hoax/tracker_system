"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { GraphData, GraphNode } from "@/lib/zettel/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <p className="p-4 font-mono text-xs text-ctp-overlay0">Loading graph…</p>
  ),
});

const COLORS = {
  problem: "#cba6f7",
  pattern: "#89b4fa",
  other: "#fab387",
  patternLink: "#cba6f7",
  wikilink: "#6c7086",
  manual: "#a6e3a1",
  label: "#cdd6f4",
  crust: "#11111b",
} as const;

function nodeColor(type: string): string {
  if (type === "pattern") return COLORS.pattern;
  if (type === "problem") return COLORS.problem;
  return COLORS.other;
}

function linkColor(kind: string): string {
  if (kind === "pattern") return COLORS.patternLink;
  if (kind === "manual") return COLORS.manual;
  return COLORS.wikilink;
}

export function ZettelGraph({ data }: { data: GraphData }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 560 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setSize({
        width: Math.max(el.clientWidth, 320),
        height: Math.max(el.clientHeight, 320),
      });
    });
    observer.observe(el);
    setSize({
      width: Math.max(el.clientWidth, 320),
      height: Math.max(el.clientHeight, 320),
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="h-[min(70vh,720px)] min-h-[320px] overflow-hidden border border-ctp-surface0 bg-ctp-crust"
    >
      <ForceGraph2D
        width={size.width}
        height={size.height}
        graphData={data}
        backgroundColor={COLORS.crust}
        nodeId="id"
        nodeLabel={(node) => {
          const n = node as GraphNode;
          return `${n.name} (${n.type})`;
        }}
        nodeRelSize={6}
        nodeColor={(node) => nodeColor((node as GraphNode).type)}
        linkColor={(link) =>
          linkColor(String((link as { kind?: string }).kind ?? "wikilink"))
        }
        linkWidth={(link) =>
          (link as { kind?: string }).kind === "pattern" ? 1.8 : 1
        }
        onNodeClick={(node) => {
          const href = (node as GraphNode).href;
          if (href) router.push(href);
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as GraphNode & { x?: number; y?: number };
          const x = n.x ?? 0;
          const y = n.y ?? 0;
          const radius = n.type === "pattern" ? 8 : 5;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = nodeColor(n.type);
          ctx.fill();

          const label = n.name;
          const fontSize = Math.max(10 / globalScale, 3);
          ctx.font = `${fontSize}px JetBrains Mono, ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = COLORS.label;
          ctx.fillText(label, x, y + radius + 1);
        }}
        nodeCanvasObjectMode={() => "replace"}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as GraphNode & { x?: number; y?: number };
          const radius = n.type === "pattern" ? 8 : 5;
          ctx.beginPath();
          ctx.arc(n.x ?? 0, n.y ?? 0, radius + 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }}
      />
    </div>
  );
}
