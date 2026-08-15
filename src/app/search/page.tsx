import Link from "next/link";
import { connection } from "next/server";
import { PropertyFilterForm } from "@/app/components/property-filter-form";
import { SegmentChip } from "@/app/components/segment-chip";
import {
  hasSearchInput,
  listPatternTitles,
  listPropertyDefs,
  parseSearchQuery,
  searchNotes,
} from "@/lib/zettel";
import { asStringArray } from "@/lib/zettel/values";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search — SDE Tracker",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const query = parseSearchQuery(params);
  const active = hasSearchInput(query);

  const [hits, defs, patternTitles] = await Promise.all([
    active ? searchNotes(query) : Promise.resolve([]),
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
        <h1 className="mt-1 text-2xl text-ctp-text">Search</h1>
        <p className="mt-2 max-w-2xl text-sm text-ctp-subtext0">
          Full-text uses the database <code>search_vector</code> (title, body,
          properties). Facets are the same EAV fields as the DSA list.
        </p>
      </div>

      <PropertyFilterForm
        action="/search"
        filters={query}
        q={query.q}
        showQuery
        statusOptions={statusOptions}
        difficultyOptions={difficultyOptions}
        patternTitles={patternTitles}
        submitLabel="Search"
      />

      {!active ? (
        <p className="text-sm text-ctp-overlay0">
          Enter a query or pick a Status, Pattern, Difficulty, or date range.
        </p>
      ) : hits.length === 0 ? (
        <p className="text-sm text-ctp-overlay0">No notes match.</p>
      ) : (
        <ul className="divide-y divide-ctp-surface0 border border-ctp-surface0 bg-ctp-base">
          {hits.map((hit) => (
            <li key={hit.id}>
              <Link
                href={hit.href}
                className="block space-y-1 px-4 py-3 hover:bg-ctp-mantle"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex-1 text-sm text-ctp-text">{hit.title}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-ctp-overlay0">
                    {hit.type}
                  </span>
                  {hit.difficulty ? (
                    <SegmentChip kind="difficulty" value={hit.difficulty} />
                  ) : null}
                  {hit.status ? (
                    <SegmentChip kind="status" value={hit.status} />
                  ) : null}
                  {hit.patterns.map((pattern) => (
                    <SegmentChip key={pattern} kind="pattern" value={pattern} />
                  ))}
                </div>
                {hit.headline ? (
                  <p className="text-xs text-ctp-subtext0">{hit.headline}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
