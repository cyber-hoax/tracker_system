import { notFound } from "next/navigation";
import { connection } from "next/server";
import { NoteEditor } from "@/app/components/note-editor";
import { NoteBreadcrumb } from "@/components/note-breadcrumb";
import { loadAppearance } from "@/lib/appearance-store";
import { getNoteByRoute, listPatternTitles } from "@/lib/zettel";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: `${slug} — DSA` };
}

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const [note, patternTitles] = await Promise.all([
    getNoteByRoute("problem", slug),
    listPatternTitles(),
  ]);
  if (!note) notFound();

  return (
    <NoteEditor
      breadcrumb={
        <NoteBreadcrumb
          parentHref="/dsa"
          parentLabel="DSA"
          current={note.title}
        />
      }
      note={note}
      patternTitles={patternTitles}
      codeTheme={loadAppearance().codeTheme}
    />
  );
}
