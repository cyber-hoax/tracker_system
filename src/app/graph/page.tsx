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
    <main className="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-4 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
            Zettelkasten
          </p>
          <h1 className="mt-1 text-2xl text-ctp-text">Graph</h1>
          <p className="mt-2 max-w-2xl text-sm text-ctp-subtext0">
            Nodes are notes. Edges come from Pattern links, wikilinks, and
            manual links. Zoom in for titles; click a node to inspect it. Drag a
            hub to pin it in place.
          </p>
        </div>
        <p className="font-mono text-[13px] text-ctp-overlay0">
          {graph.nodes.length} nodes · {graph.links.length} edges
        </p>
      </div>

      <PropertyFilterForm
        action="/graph"
        filters={filters}
        statusOptions={statusOptions}
        difficultyOptions={difficultyOptions}
        patternTitles={patternTitles}
      />

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
