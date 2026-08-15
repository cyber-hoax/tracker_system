import Link from "next/link";
import { connection } from "next/server";
import { CreateNoteForm } from "@/app/components/create-note-form";
import { listPatterns, patternUrlSlug } from "@/lib/zettel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Patterns — SDE Tracker",
};

export default async function PatternsPage() {
  await connection();
  const patterns = await listPatterns();

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
            Zettelkasten
          </p>
          <h1 className="mt-1 text-2xl text-ctp-text">Pattern hubs</h1>
        </div>
        <div className="w-full max-w-md">
          <CreateNoteForm type="pattern" placeholder="New pattern name" />
        </div>
      </div>

      {patterns.length === 0 ? (
        <p className="text-sm text-ctp-overlay0">
          No pattern hubs yet. Create one, or link a Pattern property on a
          problem to stub a hub.
        </p>
      ) : (
        <ul className="divide-y divide-ctp-surface0 border border-ctp-surface0 bg-ctp-base">
          {patterns.map((pattern) => (
            <li key={pattern.id}>
              <Link
                href={`/patterns/${patternUrlSlug(pattern.slug)}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ctp-mantle"
              >
                <span className="text-sm text-ctp-text">{pattern.title}</span>
                <span className="font-mono text-xs text-ctp-mauve">
                  {pattern.backlinkCount}{" "}
                  {pattern.backlinkCount === 1 ? "problem" : "problems"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
