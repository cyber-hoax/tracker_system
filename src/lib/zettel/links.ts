import { and, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  links,
  noteProperties,
  notes,
  propertyDefs,
  type LinkKind,
  type NoteType,
} from "@/db/schema";
import { PATTERN_PROPERTY_KEY } from "./constants";
import {
  canonicalPatternTitle,
  patternAliasSlugs,
  pickCanonicalPatternNote,
  titlesForCanonical,
} from "./pattern-aliases";
import { patternDbSlug, slugify } from "./slug";
import { isWikilinkType, wikilinkTargetsFromValue } from "./values";
import { displayWikilink, parseWikilink, wikilinkLeaf } from "./wikilink";
import { defaultFolderIdForType } from "@/lib/workspace/folders";
import { suffixedRelativePath } from "@/lib/obsidian/paths";

type Executor = Pick<typeof db, "select" | "insert" | "delete">;

export type NotePropertyWithDef = {
  defId: string;
  key: string;
  valueType: string;
  value: unknown;
  isSystem: boolean;
};

/**
 * Rebuild `links` rows with kind `pattern` or `wikilink` from the note's
 * current properties. `kind: manual` is left untouched.
 *
 * - Property key `Pattern` (wikilink / wikilink_list) → kind `pattern`
 * - Any other wikilink / wikilink_list property → kind `wikilink`
 * - Missing Pattern targets create stub pattern notes so FKs can exist
 * - Other wikilinks only insert a row if the target note already exists
 */
export async function syncPropertyLinks(
  noteId: string,
  executor: Executor = db,
): Promise<void> {
  const rows = await loadNoteProperties(noteId, executor);

  const patternTargets: string[] = [];
  const wikilinkTargets: string[] = [];

  for (const row of rows) {
    if (!isWikilinkType(row.valueType)) continue;
    const targets = wikilinkTargetsFromValue(row.valueType, row.value);
    if (row.key === PATTERN_PROPERTY_KEY) {
      patternTargets.push(...targets);
    } else {
      wikilinkTargets.push(...targets);
    }
  }

  await executor
    .delete(links)
    .where(
      and(
        eq(links.fromId, noteId),
        inArray(links.kind, ["pattern", "wikilink"] satisfies LinkKind[]),
      ),
    );

  const patternIds = new Set<string>();
  for (const target of [...new Set(patternTargets)]) {
    const resolved = await resolveOrCreatePatternNote(target, executor);
    if (resolved.id === noteId) continue;
    patternIds.add(resolved.id);
  }

  const wikilinkIds = new Set<string>();
  for (const target of [...new Set(wikilinkTargets)]) {
    const resolved = await resolveExistingNote(target, executor);
    if (!resolved || resolved.id === noteId) continue;
    if (patternIds.has(resolved.id)) continue;
    wikilinkIds.add(resolved.id);
  }

  const values = [
    ...[...patternIds].map((toId) => ({
      fromId: noteId,
      toId,
      kind: "pattern" as const,
    })),
    ...[...wikilinkIds].map((toId) => ({
      fromId: noteId,
      toId,
      kind: "wikilink" as const,
    })),
  ];

  if (values.length > 0) {
    await executor.insert(links).values(values).onConflictDoNothing();
  }
}

async function loadNoteProperties(
  noteId: string,
  executor: Executor,
): Promise<NotePropertyWithDef[]> {
  const rows = await executor
    .select({
      defId: noteProperties.defId,
      key: propertyDefs.key,
      valueType: propertyDefs.valueType,
      value: noteProperties.value,
      isSystem: propertyDefs.isSystem,
    })
    .from(noteProperties)
    .innerJoin(propertyDefs, eq(noteProperties.defId, propertyDefs.id))
    .where(eq(noteProperties.noteId, noteId));
  return rows;
}

async function resolveOrCreatePatternNote(raw: string, executor: Executor) {
  const existing = await findPatternNote(raw, executor);
  if (existing) return existing;

  const title = canonicalPatternTitle(displayWikilink(raw));
  const slug = await uniqueSlug(patternDbSlug(title), executor);
  const folderId = await defaultFolderIdForType("pattern");
  const [created] = await executor
    .insert(notes)
    .values({
      type: "pattern" satisfies NoteType,
      title,
      slug,
      body: `# ${title}\n\nProblems connected to this pattern appear in the graph.\n`,
      folderId,
    })
    .returning();
  return created;
}

export async function findPatternNote(raw: string, executor: Executor = db) {
  const canonical = canonicalPatternTitle(raw);
  const titles = titlesForCanonical(canonical);
  const slugs = [
    ...new Set([
      ...patternAliasSlugs(canonical),
      slugify(canonical),
      patternDbSlug(canonical),
    ]),
  ];

  const bySlug = await executor
    .select()
    .from(notes)
    .where(and(eq(notes.type, "pattern"), inArray(notes.slug, slugs)));

  const titleFilters = titles.map((title) => ilike(notes.title, title));
  const titleMatch =
    titleFilters.length === 1 ? titleFilters[0]! : or(...titleFilters);
  const byTitle = await executor
    .select()
    .from(notes)
    .where(and(eq(notes.type, "pattern"), titleMatch));

  const candidates = new Map<string, (typeof bySlug)[number]>();
  for (const row of [...bySlug, ...byTitle]) {
    candidates.set(row.id, row);
  }
  return pickCanonicalPatternNote([...candidates.values()], canonical);
}

export async function resolveExistingNote(raw: string, executor: Executor = db) {
  const title = displayWikilink(raw);
  const { target } = parseWikilink(raw);
  const kebab = slugify(title);
  const slugs = [...new Set([kebab, slugify(target), patternDbSlug(title)])];

  const bySlug = await executor
    .select()
    .from(notes)
    .where(inArray(notes.slug, slugs))
    .limit(1);
  if (bySlug[0]) return bySlug[0];

  const byTitle = await executor
    .select()
    .from(notes)
    .where(
      or(ilike(notes.title, title), ilike(notes.title, wikilinkLeaf(target))),
    )
    .limit(1);
  return byTitle[0] ?? null;
}

export async function uniqueSlug(
  base: string,
  executor: Executor = db,
  excludeId?: string,
): Promise<string> {
  let slug = base;
  let n = 2;
  for (;;) {
    const existing = await executor
      .select({ id: notes.id })
      .from(notes)
      .where(
        excludeId
          ? and(eq(notes.slug, slug), ne(notes.id, excludeId))
          : eq(notes.slug, slug),
      )
      .limit(1);
    if (!existing[0]) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

export async function uniqueFilePath(
  base: string,
  executor: Executor = db,
  excludeId?: string,
): Promise<string> {
  let n = 1;
  for (;;) {
    const filePath = suffixedRelativePath(base, n);
    const existing = await executor
      .select({ id: notes.id })
      .from(notes)
      .where(
        excludeId
          ? and(eq(notes.filePath, filePath), ne(notes.id, excludeId))
          : eq(notes.filePath, filePath),
      )
      .limit(1);
    if (!existing[0]) return filePath;
    n += 1;
  }
}
