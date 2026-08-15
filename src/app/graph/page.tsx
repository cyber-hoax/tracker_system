import { connection } from "next/server";
import { PropertyFilterForm } from "@/app/components/property-filter-form";
import { ZettelGraph } from "@/app/components/zettel-graph";
import {
  getGraphData,
  listPatternTitles,
  listPropertyDefs,
  parseSearchFilters,
} from "@/lib/zettel";
import { asStringArray } from "@/lib/zettel/values";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Graph",
};

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const filters = parseSearchFilters(await searchParams);

  const [graph, defs, patternTitles] = await Promise.all([
    getGraphData(filters),
    listPropertyDefs(),
    listPatternTitles(),
  ]);

  const statusOptions = asStringArray(
    defs.find((def) => def.key === "Status")?.options,
  );
  const difficultyOptions = asStringArray(
    defs.find((def) => def.key === "Difficulty")?.options,
  );

  return (
    <main className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
          Zettelkasten
        </p>
        <h1 className="mt-1 text-2xl text-ctp-text">Graph</h1>
        <p className="mt-2 max-w-2xl text-sm text-ctp-subtext0">
          Nodes are notes. Edges come from <code>links</code> (Pattern property
          sync, other wikilinks, manual). Click a node to open it.
        </p>
      </div>

      <PropertyFilterForm
        action="/graph"
        filters={filters}
        statusOptions={statusOptions}
        difficultyOptions={difficultyOptions}
        patternTitles={patternTitles}
      />

      <div className="flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-wide text-ctp-overlay0">
        <LegendDot color="#cba6f7" label="Problem" />
        <LegendDot color="#89b4fa" label="Pattern hub" />
        <LegendDot color="#cba6f7" label="Pattern link" line />
        <LegendDot color="#6c7086" label="Wikilink" line />
        <LegendDot color="#a6e3a1" label="Manual" line />
        <span>
          {graph.nodes.length} nodes · {graph.links.length} edges
        </span>
      </div>

      {graph.nodes.length === 0 ? (
        <p className="text-sm text-ctp-overlay0">
          No notes in the graph. Add problems and Pattern properties first.
        </p>
      ) : (
        <ZettelGraph data={graph} />
      )}
    </main>
  );
}

function LegendDot({
  color,
  label,
  line = false,
}: {
  color: string;
  label: string;
  line?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={line ? "h-0.5 w-4" : "h-2.5 w-2.5 rounded-full"}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
