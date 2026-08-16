export type ProblemFilters = {
  status?: string;
  difficulty?: string;
  pattern?: string;
  lastSolvedFrom?: string;
  lastSolvedTo?: string;
  nextRevisionFrom?: string;
  nextRevisionTo?: string;
};

export type SearchQuery = ProblemFilters & {
  q?: string;
};

function first(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = searchParams[key];
  const candidates = Array.isArray(value) ? value : value != null ? [value] : [];
  for (const item of candidates) {
    const trimmed = item.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function parseSearchFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ProblemFilters {
  return {
    status: first(searchParams, "status"),
    difficulty: first(searchParams, "difficulty"),
    pattern: first(searchParams, "pattern"),
    lastSolvedFrom: first(searchParams, "lastSolvedFrom"),
    lastSolvedTo: first(searchParams, "lastSolvedTo"),
    nextRevisionFrom: first(searchParams, "nextRevisionFrom"),
    nextRevisionTo: first(searchParams, "nextRevisionTo"),
  };
}

export function parseSearchQuery(
  searchParams: Record<string, string | string[] | undefined>,
): SearchQuery {
  return {
    ...parseSearchFilters(searchParams),
    q: first(searchParams, "q"),
  };
}

export function hasActiveFilters(filters: ProblemFilters): boolean {
  return Boolean(
    filters.status ||
      filters.difficulty ||
      filters.pattern ||
      filters.lastSolvedFrom ||
      filters.lastSolvedTo ||
      filters.nextRevisionFrom ||
      filters.nextRevisionTo,
  );
}

export function hasSearchInput(query: SearchQuery): boolean {
  return Boolean(query.q) || hasActiveFilters(query);
}

/** Trimmed string for `websearch_to_tsquery`; null means skip FTS. */
export function websearchQuery(q: string | undefined): string | null {
  const trimmed = q?.trim();
  return trimmed ? trimmed : null;
}

/** Escape `\`, `%`, and `_` so user input is a literal `ILIKE` needle. */
export function escapeIlikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, "\\$&");
}
