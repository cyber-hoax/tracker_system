import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { noteProperties, notes, propertyDefs } from "@/db/schema";
import { writeNoteToVault } from "@/lib/obsidian";
import { asStringArray } from "@/lib/zettel/values";
import {
  createNote,
  listPatternTitles,
  setNoteProperties,
  updateNote,
} from "@/lib/zettel";
import { slugify } from "@/lib/zettel/slug";
import {
  appendSubmissionBlocks,
  countSubmissionMarkers,
  mapSubmissionsToProperties,
  nextRevisionDate,
} from "./map";
import { maybeGenerateInsight } from "./insight";
import type { LeetCodeProblemMeta, LeetCodeSubmission } from "./types";

const TZ = "Asia/Kolkata";

export type PersistResult = {
  created: boolean;
  updated: boolean;
  noteId: string;
};

export async function upsertProblemFromSubmissions(input: {
  submissions: LeetCodeSubmission[];
  problem?: LeetCodeProblemMeta;
  knownPatterns?: string[];
}): Promise<PersistResult | null> {
  const submissions = input.submissions.filter((row) => row.title.trim());
  if (submissions.length === 0) return null;

  const knownPatterns = input.knownPatterns ?? (await listPatternTitles());
  const mapped = mapSubmissionsToProperties({
    submissions,
    problem: input.problem,
    knownPatterns,
    timeZone: TZ,
  });

  const existing = await findProblemNote(mapped.title, mapped.titleSlug);
  const created = !existing;
  const note = existing ?? (await createNote({ type: "problem", title: mapped.title }));

  const current = await loadPropertyMap(note.id);
  const nextBody = appendSubmissionBlocks(note.body, submissions, TZ);
  const properties = mergeProperties(current, mapped.properties, nextBody);

  if (created && !stringProp(current["Key Insight"])) {
    const insight = await maybeGenerateInsight({
      title: mapped.title,
      tags: properties.Pattern ? asStringArray(properties.Pattern) : [],
      description: stringProp(properties.Description) || mapped.properties.Description,
    });
    if (insight) properties["Key Insight"] = insight;
  }

  if (nextBody !== note.body) {
    await updateNote(note.id, { body: nextBody });
  }
  await setNoteProperties(note.id, properties);
  await writeNoteToVault(note.id);

  return { created, updated: true, noteId: note.id };
}

function mergeProperties(
  current: Record<string, unknown>,
  incoming: ReturnType<typeof mapSubmissionsToProperties>["properties"],
  body: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  if (incoming.Difficulty) next.Difficulty = incoming.Difficulty;
  next.Status = incoming.Status;

  const patterns = [
    ...new Set([
      ...asStringArray(current.Pattern),
      ...(incoming.Pattern ?? []),
    ]),
  ];
  if (patterns.length) next.Pattern = patterns;

  const existingDesc = stringProp(current.Description);
  if (!existingDesc && incoming.Description) {
    next.Description = incoming.Description.slice(0, 4000);
  }

  const existingLast = stringProp(current["Last Solved Date"]);
  const lastSolved =
    incoming.Status === "Solved" || !existingLast
      ? laterYmd(existingLast, incoming["Last Solved Date"])
      : existingLast;
  next["Last Solved Date"] = lastSolved;
  next["Next Revision Date"] = nextRevisionDate(lastSolved);
  next["Revision Count"] = countSubmissionMarkers(body);
  return next;
}

async function findProblemNote(title: string, titleSlug: string) {
  const slugs = [...new Set([slugify(title), slugify(titleSlug)])].filter(
    (slug) => slug && slug !== "note",
  );
  for (const slug of slugs) {
    const [bySlug] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.type, "problem"), eq(notes.slug, slug)))
      .limit(1);
    if (bySlug) return bySlug;
  }
  const [byTitle] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.type, "problem"), eq(notes.title, title)))
    .limit(1);
  return byTitle ?? null;
}

async function loadPropertyMap(noteId: string): Promise<Record<string, unknown>> {
  const rows = await db
    .select({
      key: propertyDefs.key,
      value: noteProperties.value,
    })
    .from(noteProperties)
    .innerJoin(propertyDefs, eq(noteProperties.defId, propertyDefs.id))
    .where(eq(noteProperties.noteId, noteId));
  const out: Record<string, unknown> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

function stringProp(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function laterYmd(a?: string, b?: string): string {
  if (!a) return b || "";
  if (!b) return a;
  return a >= b ? a : b;
}
