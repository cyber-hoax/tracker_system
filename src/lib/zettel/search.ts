import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { noteProperties, notes, propertyDefs } from "@/db/schema";
import { PATTERN_PROPERTY_KEY } from "./constants";
import { propertyConditions } from "./filters";
import { websearchQuery, type SearchQuery } from "./query";
import { noteHref } from "./slug";

export type SearchHit = {
  id: string;
  type: string;
  title: string;
  slug: string;
  href: string;
  rank: number | null;
  headline: string | null;
  status?: string;
  difficulty?: string;
  patterns: string[];
};

export async function searchNotes(query: SearchQuery): Promise<SearchHit[]> {
  const fts = websearchQuery(query.q);
  const extra = await propertyConditions(query);
  if (extra === null) return [];

  const conditions: SQL[] = [...extra];
  if (fts) {
    conditions.push(
      sql`${notes.searchVector} @@ websearch_to_tsquery('english', ${fts})`,
    );
  }

  const tsQuery = fts
    ? sql`websearch_to_tsquery('english', ${fts})`
    : null;

  const rankExpr = tsQuery
    ? sql<number>`ts_rank_cd(${notes.searchVector}, ${tsQuery})`
    : sql<number | null>`null`;

  const headlineExpr = tsQuery
    ? sql<string>`ts_headline(
        'english',
        ${notes.title} || E'\n' || left(${notes.body}, 800),
        ${tsQuery},
        'MaxFragments=1, MaxWords=32, MinWords=9, StartSel=«, StopSel=»'
      )`
    : sql<string | null>`null`;

  const rows = await db
    .select({
      id: notes.id,
      type: notes.type,
      title: notes.title,
      slug: notes.slug,
      rank: rankExpr,
      headline: headlineExpr,
    })
    .from(notes)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      ...(tsQuery
        ? [sql`${rankExpr} desc`, asc(notes.title)]
        : [asc(notes.title)]),
    );

  if (rows.length === 0) return [];

  const props = await db
    .select({
      noteId: noteProperties.noteId,
      key: propertyDefs.key,
      value: noteProperties.value,
    })
    .from(noteProperties)
    .innerJoin(propertyDefs, eq(noteProperties.defId, propertyDefs.id))
    .where(
      inArray(
        noteProperties.noteId,
        rows.map((row) => row.id),
      ),
    );

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
      type: row.type,
      title: row.title,
      slug: row.slug,
      href: noteHref(row.type, row.slug),
      rank: row.rank,
      headline: row.headline,
      status: stringProp(values.Status),
      difficulty: stringProp(values.Difficulty),
      patterns,
    };
  });
}

function stringProp(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
