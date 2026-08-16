import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { relativeNotePath } from "@/lib/obsidian/paths";
import { defaultFolderIdForType } from "@/lib/workspace/folders";
import {
  links,
  noteProperties,
  notes,
  propertyDefs,
  type NoteType,
  type PropertyValueType,
} from "@/db/schema";
import { PATTERN_PROPERTY_KEY, SYSTEM_PROPERTY_KEYS } from "./constants";
import { propertyConditions } from "./filters";
import { syncPropertyLinks, uniqueFilePath, uniqueSlug } from "./links";
import type { ProblemFilters } from "./query";
import { patternDbSlug, patternSlugCandidates, slugify } from "./slug";
import { parsePropertyValue, type PropertyJson } from "./values";

export type { ProblemFilters };

export type NoteRecord = typeof notes.$inferSelect;

export type NoteDetail = NoteRecord & {
  properties: {
    defId: string;
    key: string;
    valueType: string;
    options: unknown;
    isSystem: boolean;
    value: unknown;
  }[];
  linkedPatterns: { id: string; title: string; slug: string }[];
  backlinks: {
    id: string;
    title: string;
    slug: string;
    type: string;
    kind: string;
  }[];
};

export type ProblemListItem = {
  id: string;
  title: string;
  slug: string;
  updatedAt: Date;
  status?: string;
  difficulty?: string;
  patterns: string[];
  lastSolved?: string;
  nextRevision?: string;
  revisionCount?: number;
};

export type PatternListItem = {
  id: string;
  title: string;
  slug: string;
  updatedAt: Date;
  backlinkCount: number;
};

export async function listPropertyDefs() {
  return db.select().from(propertyDefs).orderBy(asc(propertyDefs.key));
}

export async function listVisiblePropertyDefs() {
  const defs = await listPropertyDefs();
  return defs.filter((def) => !def.isSystem);
}

export async function listProblems(
  filters: ProblemFilters = {},
): Promise<ProblemListItem[]> {
  const extra = await propertyConditions(filters);
  if (extra === null) return [];

  const conditions = [eq(notes.type, "problem"), ...extra];

  const rows = await db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(asc(notes.title));

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const props = await db
    .select({
      noteId: noteProperties.noteId,
      key: propertyDefs.key,
      value: noteProperties.value,
    })
    .from(noteProperties)
    .innerJoin(propertyDefs, eq(noteProperties.defId, propertyDefs.id))
    .where(inArray(noteProperties.noteId, ids));

  const byNote = new Map<string, Record<string, unknown>>();
  for (const prop of props) {
    const current = byNote.get(prop.noteId) ?? {};
    current[prop.key] = prop.value;
    byNote.set(prop.noteId, current);
  }

  return rows.map((row) => {
    const values = byNote.get(row.id) ?? {};
    const patterns = Array.isArray(values[PATTERN_PROPERTY_KEY])
      ? (values[PATTERN_PROPERTY_KEY] as unknown[]).map(String)
      : typeof values[PATTERN_PROPERTY_KEY] === "string"
        ? [String(values[PATTERN_PROPERTY_KEY])]
        : [];
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      updatedAt: row.updatedAt,
      status: stringProp(values.Status),
      difficulty: stringProp(values.Difficulty),
      patterns,
      lastSolved: stringProp(values["Last Solved Date"]),
      nextRevision: stringProp(values["Next Revision Date"]),
      revisionCount: numberProp(values["Revision Count"]),
    };
  });
}

function stringProp(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberProp(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function listPatterns(): Promise<PatternListItem[]> {
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      slug: notes.slug,
      updatedAt: notes.updatedAt,
      backlinkCount: sql<number>`count(${links.fromId})::int`,
    })
    .from(notes)
    .leftJoin(
      links,
      and(eq(links.toId, notes.id), eq(links.kind, "pattern")),
    )
    .where(eq(notes.type, "pattern"))
    .groupBy(notes.id)
    .orderBy(asc(notes.title));
  return rows;
}

export async function getNoteByRoute(
  type: Extract<NoteType, "problem" | "pattern">,
  slugParam: string,
): Promise<NoteDetail | null> {
  const slugFilter =
    type === "pattern"
      ? inArray(notes.slug, patternSlugCandidates(slugParam))
      : eq(notes.slug, slugParam);

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.type, type), slugFilter))
    .limit(1);

  if (!note) return null;
  return assembleNoteDetail(note);
}

async function assembleNoteDetail(note: NoteRecord): Promise<NoteDetail> {
  const defs = await listPropertyDefs();
  const values = await db
    .select()
    .from(noteProperties)
    .where(eq(noteProperties.noteId, note.id));
  const valueByDef = new Map(values.map((row) => [row.defId, row.value]));

  const outgoing = await db
    .select({
      kind: links.kind,
      id: notes.id,
      title: notes.title,
      slug: notes.slug,
    })
    .from(links)
    .innerJoin(notes, eq(notes.id, links.toId))
    .where(and(eq(links.fromId, note.id), eq(links.kind, "pattern")))
    .orderBy(asc(notes.title));

  const incoming = await db
    .select({
      kind: links.kind,
      id: notes.id,
      title: notes.title,
      slug: notes.slug,
      type: notes.type,
    })
    .from(links)
    .innerJoin(notes, eq(notes.id, links.fromId))
    .where(eq(links.toId, note.id))
    .orderBy(asc(notes.title));

  return {
    ...note,
    properties: defs.map((def) => ({
      defId: def.id,
      key: def.key,
      valueType: def.valueType,
      options: def.options,
      isSystem: def.isSystem,
      value: valueByDef.get(def.id) ?? null,
    })),
    linkedPatterns: outgoing.map(({ id, title, slug }) => ({ id, title, slug })),
    backlinks: incoming,
  };
}

export async function listPatternTitles(): Promise<string[]> {
  const rows = await db
    .select({ title: notes.title })
    .from(notes)
    .where(eq(notes.type, "pattern"))
    .orderBy(asc(notes.title));
  return rows.map((row) => row.title);
}

export async function getNoteBySlug(slugParam: string): Promise<NoteDetail | null> {
  const [note] = await db.select().from(notes).where(eq(notes.slug, slugParam)).limit(1);
  if (!note) return null;
  return assembleNoteDetail(note);
}

export async function createNote(input: {
  type: NoteType;
  title: string;
  folderId?: string | null;
  body?: string;
}): Promise<NoteRecord> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Title is required");
  }
  const baseSlug =
    input.type === "pattern" ? patternDbSlug(title) : slugify(title);
  const slug = await uniqueSlug(baseSlug);
  const filePath = await uniqueFilePath(relativeNotePath(input.type, title));
  const body =
    input.body ??
    (input.type === "pattern"
      ? `# ${title}\n\nProblems connected to this pattern appear in the graph.\n\n<!-- boilerplate:start -->\n\n<!-- boilerplate:end -->\n`
      : "");
  const folderId =
    input.folderId !== undefined
      ? input.folderId
      : await defaultFolderIdForType(input.type);

  const [created] = await db
    .insert(notes)
    .values({
      type: input.type,
      title,
      slug,
      body,
      folderId,
      filePath,
    })
    .returning();
  return created;
}

export async function deleteNote(id: string): Promise<NoteRecord> {
  const [row] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  if (!row) throw new Error("Note not found");
  await db.delete(notes).where(eq(notes.id, id));
  return row;
}

export async function updateNote(
  id: string,
  patch: { title?: string; body?: string },
): Promise<NoteRecord> {
  const [current] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  if (!current) throw new Error("Note not found");

  const updates: {
    title?: string;
    body?: string;
    slug?: string;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };
  if (typeof patch.title === "string") {
    const title = patch.title.trim();
    if (!title) throw new Error("Title is required");
    updates.title = title;
    const baseSlug =
      current.type === "pattern" ? patternDbSlug(title) : slugify(title);
    updates.slug = await uniqueSlug(baseSlug, db, id);
  }
  if (typeof patch.body === "string") {
    updates.body = patch.body;
  }

  const [updated] = await db
    .update(notes)
    .set(updates)
    .where(eq(notes.id, id))
    .returning();
  if (!updated) throw new Error("Note not found");
  return updated;
}

export async function setNoteProperty(
  noteId: string,
  defId: string,
  value: unknown,
): Promise<void> {
  const [def] = await db
    .select()
    .from(propertyDefs)
    .where(eq(propertyDefs.id, defId))
    .limit(1);
  if (!def) throw new Error("Unknown property");

  const parsed = parsePropertyValue(
    def.valueType as PropertyValueType,
    value,
    def.key,
  );

  if (parsed === null) {
    await db
      .delete(noteProperties)
      .where(
        and(eq(noteProperties.noteId, noteId), eq(noteProperties.defId, defId)),
      );
  } else {
    await db
      .insert(noteProperties)
      .values({ noteId, defId, value: parsed satisfies PropertyJson })
      .onConflictDoUpdate({
        target: [noteProperties.noteId, noteProperties.defId],
        set: { value: parsed },
      });
  }

  await db
    .update(notes)
    .set({ updatedAt: new Date() })
    .where(eq(notes.id, noteId));

  await syncPropertyLinks(noteId);
}

export async function setNoteProperties(
  noteId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const defs = await listPropertyDefs();
  const byKey = new Map(defs.map((def) => [def.key, def]));

  for (const [key, value] of Object.entries(values)) {
    const def = byKey.get(key);
    if (!def) continue;
    const parsed = parsePropertyValue(
      def.valueType as PropertyValueType,
      value,
      def.key,
    );
    if (parsed === null) {
      await db
        .delete(noteProperties)
        .where(
          and(eq(noteProperties.noteId, noteId), eq(noteProperties.defId, def.id)),
        );
    } else {
      await db
        .insert(noteProperties)
        .values({ noteId, defId: def.id, value: parsed satisfies PropertyJson })
        .onConflictDoUpdate({
          target: [noteProperties.noteId, noteProperties.defId],
          set: { value: parsed },
        });
    }
  }

  await db
    .update(notes)
    .set({ updatedAt: new Date() })
    .where(eq(notes.id, noteId));

  await syncPropertyLinks(noteId);
}

export async function removeNoteProperty(noteId: string, defId: string) {
  await db
    .delete(noteProperties)
    .where(
      and(eq(noteProperties.noteId, noteId), eq(noteProperties.defId, defId)),
    );
  await db
    .update(notes)
    .set({ updatedAt: new Date() })
    .where(eq(notes.id, noteId));
  await syncPropertyLinks(noteId);
}

export function isHiddenEditorKey(key: string): boolean {
  return (SYSTEM_PROPERTY_KEYS as readonly string[]).includes(key);
}

