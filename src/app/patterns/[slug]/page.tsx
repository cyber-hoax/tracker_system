import { notFound } from "next/navigation";
import { connection } from "next/server";
import { NoteEditor } from "@/app/components/note-editor";
import { NoteBreadcrumb } from "@/components/note-breadcrumb";
import { getNoteByRoute, listPatternTitles } from "@/lib/zettel";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: `${slug} — Patterns` };
}

export default async function PatternPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const [note, patternTitles] = await Promise.all([
    getNoteByRoute("pattern", slug),
    listPatternTitles(),
  ]);
  if (!note) notFound();

  return (
    <main className="space-y-4">
      <NoteBreadcrumb
        parentHref="/patterns"
        parentLabel="Patterns"
        current={note.title}
      />
      <NoteEditor note={note} patternTitles={patternTitles} />
    </main>
  );
}
