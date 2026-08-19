"use client";

import dynamic from "next/dynamic";

export const ZettelGraph = dynamic(
  () => import("./zettel-graph-canvas").then((mod) => mod.ZettelGraphCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-2xl border border-ctp-surface0 bg-ctp-crust p-4">
        <p className="font-mono text-[13px] text-ctp-overlay0">
          Loading graph…
        </p>
      </div>
    ),
  },
);
