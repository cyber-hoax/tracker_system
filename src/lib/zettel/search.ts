import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { noteProperties, notes, propertyDefs } from "@/db/schema";
import { PATTERN_PROPERTY_KEY } from "./constants";
import { propertyConditions } from "./filters";
import { escapeIlikePattern, websearchQuery, type SearchQuery } from "./query";
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

function textMatchSql(q: string): SQL {
  const like = `%${escapeIlikePattern(q)}%`;
  const fts = sql`${notes.searchVector} @@ websearch_to_tsquery('english', ${q})`;
  const titleLike = sql`${notes.title} ilike ${like} escape '\\'`;
  const bodyLike = sql`${notes.body} ilike ${like} escape '\\'`;
  if (q.length < 3) {
    return sql`(${fts} or ${titleLike} or ${bodyLike})`;
  }
  return sql`(
    ${fts}
    or ${titleLike}
    or ${bodyLike}
    or word_similarity(${q}, ${notes.title}) > 0.35
    or similarity(${notes.title}, ${q}) > 0.22
  )`;
}

function rankSql(q: string): SQL<number> {
  const like = `%${escapeIlikePattern(q)}%`;
  const tsQuery = sql`websearch_to_tsquery('english', ${q})`;
  return sql<number>`greatest(
    coalesce(ts_rank_cd(${notes.searchVector}, ${tsQuery}) * 3, 0),
    similarity(${notes.title}, ${q}),
    word_similarity(${q}, ${notes.title}),
    case when ${notes.title} ilike ${like} escape '\\' then 0.55 else 0 end,
    case when ${notes.body} ilike ${like} escape '\\' then 0.2 else 0 end
  )`;
}

export async function searchNotes(query: SearchQuery): Promise<SearchHit[]> {
  const fts = websearchQuery(query.q);
  const extra = await propertyConditions(query);
  if (extra === null) return [];

  const conditions: SQL[] = [...extra];
  if (fts) conditions.push(textMatchSql(fts));

  const rankExpr = fts ? rankSql(fts) : sql<number | null>`null`;
  const tsQuery = fts
    ? sql`websearch_to_tsquery('english', ${fts})`
    : null;
  const like = fts ? `%${escapeIlikePattern(fts)}%` : null;

  const headlineExpr = tsQuery
    ? sql<string>`case
        when ${notes.searchVector} @@ ${tsQuery} then ts_headline(
          'english',
          ${notes.title} || E'\n' || left(${notes.body}, 800),
          ${tsQuery},
          'MaxFragments=1, MaxWords=32, MinWords=9, StartSel=«, StopSel=»'
        )
        when ${notes.title} ilike ${like} escape '\\' then null
        else nullif(left(${notes.body}, 160), '')
      end`
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
