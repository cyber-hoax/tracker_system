import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { links, noteProperties, notes, propertyDefs } from "@/db/schema";
import { PATTERN_PROPERTY_KEY } from "./constants";
import {
  groupAliasedPatternNotes,
  pickCanonicalPatternNote,
  rewritePatternValues,
} from "./pattern-aliases";
import { patternDbSlug } from "./slug";
import { asStringArray } from "./values";
import { uniqueSlug, syncPropertyLinks } from "./links";

/**
 * Collapse alias pattern hubs (hashmap / hash set / hash table) onto one
 * catalog note, rewrite Pattern properties, and retarget graph links.
 */
export async function mergeAliasedPatternNotes(): Promise<void> {
  const patternNotes = await db
    .select({
      id: notes.id,
      title: notes.title,
      slug: notes.slug,
    })
    .from(notes)
    .where(eq(notes.type, "pattern"));

  const groups = groupAliasedPatternNotes(patternNotes);
  const aliasIds: string[] = [];

  for (const [canonical, group] of groups) {
    if (group.length === 0) continue;
    const keeper = pickCanonicalPatternNote(group, canonical);
    if (!keeper) continue;

    if (keeper.title !== canonical) {
      const slug = await uniqueSlug(patternDbSlug(canonical), db, keeper.id);
      await db
        .update(notes)
        .set({ title: canonical, slug, updatedAt: new Date() })
        .where(eq(notes.id, keeper.id));
    }

    for (const extra of group) {
      if (extra.id === keeper.id) continue;
      aliasIds.push(extra.id);
      const incoming = await db
        .select()
        .from(links)
        .where(eq(links.toId, extra.id));
      if (incoming.length > 0) {
        await db
          .insert(links)
          .values(
            incoming.map((link) => ({
              fromId: link.fromId,
              toId: keeper.id,
              kind: link.kind,
            })),
          )
          .onConflictDoNothing();
      }
    }
  }

  const [patternDef] = await db
    .select()
    .from(propertyDefs)
    .where(eq(propertyDefs.key, PATTERN_PROPERTY_KEY))
    .limit(1);

  const rewrittenNoteIds = new Set<string>();
  if (patternDef) {
    const propRows = await db
      .select()
      .from(noteProperties)
      .where(eq(noteProperties.defId, patternDef.id));
    for (const row of propRows) {
      const current = asStringArray(row.value);
      const next = rewritePatternValues(current);
      if (next.length === current.length && next.every((item, i) => item === current[i])) {
        continue;
      }
      await db
        .update(noteProperties)
        .set({ value: next })
        .where(
          and(
            eq(noteProperties.noteId, row.noteId),
            eq(noteProperties.defId, row.defId),
          ),
        );
      rewrittenNoteIds.add(row.noteId);
    }
  }

  if (aliasIds.length > 0) {
    await db.delete(notes).where(inArray(notes.id, aliasIds));
  }

  for (const noteId of rewrittenNoteIds) {
    await syncPropertyLinks(noteId);
  }
}
