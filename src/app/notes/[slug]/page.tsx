import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { NoteEditor } from "@/app/components/note-editor";
import { NoteBreadcrumb } from "@/components/note-breadcrumb";
import { loadAppearance } from "@/lib/appearance-store";
import { getNoteBySlug, listPatternTitles, noteHref } from "@/lib/zettel";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: slug };
}

export default async function GenericNotePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const [note, patternTitles] = await Promise.all([
    getNoteBySlug(slug),
    listPatternTitles(),
  ]);
  if (!note) notFound();
  if (note.type === "problem" || note.type === "pattern") {
    redirect(noteHref(note.type, note.slug));
  }

  const parentLabel =
    note.type === "lld"
      ? "LLD"
      : note.type === "hld"
        ? "HLD"
        : note.type === "ai"
          ? "AI"
          : "Note";

  return (
    <NoteEditor
      breadcrumb={
        <NoteBreadcrumb
          parentHref="/"
          parentLabel={parentLabel}
          current={note.title}
        />
      }
      note={note}
      patternTitles={patternTitles}
      codeTheme={loadAppearance().codeTheme}
    />
  );
}
