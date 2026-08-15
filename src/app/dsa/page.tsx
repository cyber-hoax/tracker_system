import Link from "next/link";
import { connection } from "next/server";
import { CreateNoteForm } from "@/app/components/create-note-form";
import { PropertyFilterForm } from "@/app/components/property-filter-form";
import { SegmentChip } from "@/app/components/segment-chip";
import {
  listPatternTitles,
  listProblems,
  listPropertyDefs,
  parseSearchFilters,
} from "@/lib/zettel";
import { asStringArray } from "@/lib/zettel/values";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "DSA",
};

export default async function DsaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const filters = parseSearchFilters(params);
  const [problems, defs, patternTitles] = await Promise.all([
    listProblems(filters),
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
            Zettelkasten
          </p>
          <h1 className="mt-1 text-2xl text-ctp-text">Problems</h1>
        </div>
        <div className="w-full max-w-md">
          <CreateNoteForm type="problem" placeholder="New problem title" />
        </div>
      </div>

      <PropertyFilterForm
        action="/dsa"
        filters={filters}
        statusOptions={statusOptions}
        difficultyOptions={difficultyOptions}
        patternTitles={patternTitles}
      />

      {problems.length === 0 ? (
        <p className="text-sm text-ctp-overlay0">
          No problems match. Add a title above, or import from Obsidian later.
        </p>
      ) : (
        <ul className="divide-y divide-ctp-surface0 border border-ctp-surface0 bg-ctp-base">
          {problems.map((problem) => (
            <li key={problem.id}>
              <Link
                href={`/dsa/${problem.slug}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-ctp-mantle"
              >
                <span className="flex-1 text-sm text-ctp-text">{problem.title}</span>
                {problem.difficulty ? (
                  <SegmentChip kind="difficulty" value={problem.difficulty} />
                ) : null}
                {problem.status ? (
                  <SegmentChip kind="status" value={problem.status} />
                ) : null}
                {problem.patterns.map((pattern) => (
                  <SegmentChip key={pattern} kind="pattern" value={pattern} />
                ))}
                {problem.lastSolved ? (
                  <span className="font-mono text-xs text-ctp-overlay0">
                    {problem.lastSolved}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
