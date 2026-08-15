import { sql, type SQL } from "drizzle-orm";
import { notes } from "@/db/schema";
import { findPatternNote } from "./links";
import type { ProblemFilters } from "./query";

function jsonTextEquals(value: string) {
  return sql`np.value #>> '{}' = ${value}`;
}

function jsonTextGte(value: string) {
  return sql`(np.value #>> '{}') >= ${value}`;
}

function jsonTextLte(value: string) {
  return sql`(np.value #>> '{}') <= ${value}`;
}

function propertyExists(
  key: string,
  predicate: ReturnType<typeof jsonTextEquals>,
) {
  return sql`exists (
    select 1
    from note_properties np
    inner join property_defs pd on pd.id = np.def_id
    where np.note_id = ${notes.id}
      and pd.key = ${key}
      and ${predicate}
  )`;
}

/**
 * SQL fragments AND-ed onto a `notes` query.
 * Returns `null` when a Pattern facet cannot be resolved (no matches).
 */
export async function propertyConditions(
  filters: ProblemFilters,
): Promise<SQL[] | null> {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(propertyExists("Status", jsonTextEquals(filters.status)));
  }
  if (filters.difficulty) {
    conditions.push(
      propertyExists("Difficulty", jsonTextEquals(filters.difficulty)),
    );
  }
  if (filters.lastSolvedFrom) {
    conditions.push(
      propertyExists("Last Solved Date", jsonTextGte(filters.lastSolvedFrom)),
    );
  }
  if (filters.lastSolvedTo) {
    conditions.push(
      propertyExists("Last Solved Date", jsonTextLte(filters.lastSolvedTo)),
    );
  }
  if (filters.nextRevisionFrom) {
    conditions.push(
      propertyExists("Next Revision Date", jsonTextGte(filters.nextRevisionFrom)),
    );
  }
  if (filters.nextRevisionTo) {
    conditions.push(
      propertyExists("Next Revision Date", jsonTextLte(filters.nextRevisionTo)),
    );
  }
  if (filters.pattern) {
    const patternNote = await findPatternNote(filters.pattern);
    if (!patternNote) {
      return null;
    }
    conditions.push(
      sql`exists (
        select 1 from links
        where links.from_id = ${notes.id}
          and links.to_id = ${patternNote.id}
          and links.kind = 'pattern'
      )`,
    );
  }

  return conditions;
}
