import { ymdInZone } from "./timezone";
import type { Briefing, EnrichedBlock, SessionRecord, SubjectBucket, WeekStats } from "./types";

const STUDY_SUBJECTS = new Set(["dsa", "lld", "hld", "ai"]);
const NAMED_LOG_SUBJECTS = new Set([
  "dsa",
  "lld",
  "hld",
  "ai",
  "reading",
  "walk",
  "review",
]);

export type QuickLogKind = "walk" | "reading" | "block";
export type TimelineChip = "Now" | "Logged" | "Remaining" | "Missed";

const CTA_NAMES: Record<string, string> = {
  dsa: "DSA",
  lld: "LLD",
  hld: "HLD",
  ai: "AI",
  reading: "reading",
  walk: "walk",
  review: "review",
};

function rewriteGuidance(guidance: string[], stats: Briefing["stats"]): string[] {
  const hours = Math.round(((stats.study_minutes_week || 0) / 60) * 10) / 10;
  return guidance.map((line) => {
    if (line.startsWith("Walks logged this week:")) {
      return `Walks logged this week: ${stats.walk_days}. Keep the daily 20-minute walk.`;
    }
    if (line.startsWith("Reading days this week:")) {
      return `Reading days this week: ${stats.reading_days}. Keep the 30-minute book block.`;
    }
    if (line.startsWith("Focused study logged this week:")) {
      return `Focused study logged this week: ${hours}h. Weekly target is about 20h, not more.`;
    }
    return line;
  });
}

function dayOf(iso: string, timeZone: string): string {
  return ymdInZone(new Date(iso), timeZone);
}

function extraString(
  extra: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = extra?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function extraBlockKey(extra: Record<string, unknown> | undefined): string | null {
  return extraString(extra, "block_key");
}

function habitKind(block: { subject: string; kind?: string }): "walk" | "reading" | null {
  if (block.subject === "walk" || block.kind === "walk") return "walk";
  if (block.subject === "reading" || block.kind === "reading") return "reading";
  return null;
}

function matchesKeyedOrLegacy(
  row: SessionRecord,
  block: { start: string; title: string },
  ymd: string,
  timeZone: string,
): boolean {
  if (extraBlockKey(row.extra) === blockLogKey(block, ymd)) return true;
  return (
    extraString(row.extra, "block_start") === block.start &&
    extraString(row.extra, "block_title") === block.title &&
    dayOf(row.ts, timeZone) === ymd
  );
}

function blockMatchesSession(
  block: EnrichedBlock,
  briefing: Briefing,
  recent: SessionRecord[],
): boolean {
  const timeZone = briefing.timezone;
  const ymd = briefingDay(briefing);
  if (recent.some((row) => matchesKeyedOrLegacy(row, block, ymd, timeZone))) {
    return true;
  }
  const habit = habitKind(block);
  if (!habit) return false;
  return recent.some(
    (row) => row.subject === habit && dayOf(row.ts, timeZone) === ymd,
  );
}

export function briefingDay(briefing: Briefing): string {
  return dayOf(briefing.now, briefing.timezone);
}

export function blockLogSubject(block: { subject: string }): string {
  return NAMED_LOG_SUBJECTS.has(block.subject) ? block.subject : "other";
}

export function blockLogKey(
  block: { start: string; title: string },
  ymd: string,
): string {
  return `${ymd}|${block.start}|${block.title}`;
}

export function alreadyLogged(
  kind: QuickLogKind,
  briefing: Briefing,
  recent: SessionRecord[],
): boolean {
  const timeZone = briefing.timezone;
  const todayYmd = briefingDay(briefing);
  if (kind === "walk" || kind === "reading") {
    return recent.some(
      (row) => row.subject === kind && dayOf(row.ts, timeZone) === todayYmd,
    );
  }

  const current = briefing.current;
  if (!current) return false;
  if (recent.some((row) => matchesKeyedOrLegacy(row, current, todayYmd, timeZone))) {
    return true;
  }
  const habit = habitKind(current);
  return habit ? alreadyLogged(habit, briefing, recent) : false;
}

export function blockCtaName(block: { subject: string; title: string }): string {
  const named = CTA_NAMES[block.subject];
  if (named) return named;
  const first = block.title.trim().split(/\s+/)[0] || block.title;
  return first.toLowerCase();
}

export function blockCtaMinutes(block: { minutes: number }): number {
  return Math.max(5, Math.round(block.minutes / 5) * 5);
}

export function canLogFromTimeline(
  _block: { kind: string; subject: string },
  chip: TimelineChip,
): boolean {
  return chip !== "Logged";
}

export function alreadyLoggedBlock(
  block: EnrichedBlock,
  briefing: Briefing,
  recent: SessionRecord[],
): boolean {
  return blockMatchesSession(block, briefing, recent);
}

export function blockLogPayload(
  block: EnrichedBlock,
  ymd: string,
): {
  subject: string;
  minutes: number;
  notes: string;
  extra: {
    block_key: string;
    block_start: string;
    block_title: string;
  };
} {
  return {
    subject: blockLogSubject(block),
    minutes: blockCtaMinutes(block),
    notes: block.title,
    extra: {
      block_key: blockLogKey(block, ymd),
      block_start: block.start,
      block_title: block.title,
    },
  };
}

export function weekCardValues(stats: WeekStats): {
  dsaProblemsLogged: number;
  dsaThisWeek: number;
  walkDays: number;
  studyMinutesWeek: number;
} {
  return {
    dsaProblemsLogged: stats.dsa_problems_week || 0,
    dsaThisWeek: stats.dsa_problems_week || 0,
    walkDays: stats.walk_days || 0,
    studyMinutesWeek: stats.study_minutes_week || 0,
  };
}

export function extraTimeLogBody(input: {
  subject: string;
  minutes: number;
  notes: string;
  problems_count: number;
}): {
  subject: string;
  minutes: number;
  notes: string;
  problems_count: number;
} {
  return {
    subject: input.subject,
    minutes: input.minutes,
    notes: input.notes,
    problems_count: input.problems_count,
  };
}

export function sessionForBlock(
  block: { start: string; title: string; subject: string; kind?: string },
  briefing: Briefing,
  recent: SessionRecord[],
): SessionRecord | null {
  const timeZone = briefing.timezone;
  const todayYmd = briefingDay(briefing);
  const key = blockLogKey(block, todayYmd);
  const keyed = recent.find((row) => extraBlockKey(row.extra) === key);
  if (keyed) return keyed;
  const legacy =
    recent.find((row) => {
      return (
        extraString(row.extra, "block_start") === block.start &&
        extraString(row.extra, "block_title") === block.title &&
        dayOf(row.ts, timeZone) === todayYmd
      );
    }) ?? null;
  if (legacy) return legacy;
  const habit = habitKind(block);
  if (!habit) return null;
  return sessionForQuickLog(habit, briefing, recent);
}

export function timelineChip(
  block: EnrichedBlock,
  briefing: Briefing,
  recent: SessionRecord[],
  nowMs: number,
): TimelineChip {
  const current = briefing.current;
  const start = Date.parse(block.start_iso);
  const end = Date.parse(block.end_iso);
  const isCurrent =
    Boolean(current) && current?.start === block.start && current?.title === block.title;
  const inWindow =
    Number.isFinite(start) && Number.isFinite(end) && start <= nowMs && nowMs < end;
  if (isCurrent || inWindow) return "Now";
  if (blockMatchesSession(block, briefing, recent)) return "Logged";
  if (Number.isFinite(start) && nowMs < start) return "Remaining";
  return "Missed";
}

export function sessionForQuickLog(
  kind: QuickLogKind,
  briefing: Briefing,
  recent: SessionRecord[],
): SessionRecord | null {
  const timeZone = briefing.timezone;
  const todayYmd = briefingDay(briefing);
  if (kind === "walk" || kind === "reading") {
    return (
      recent.find(
        (row) => row.subject === kind && dayOf(row.ts, timeZone) === todayYmd,
      ) ?? null
    );
  }

  const current = briefing.current;
  if (!current) return null;
  return sessionForBlock(current, briefing, recent);
}

export function applyLoggedSession(input: {
  briefing: Briefing;
  recent: SessionRecord[];
  session: SessionRecord;
}): { briefing: Briefing; recent: SessionRecord[] } {
  const { briefing, recent, session } = input;
  const timeZone = briefing.timezone;
  const todayYmd = dayOf(briefing.now, timeZone);
  const sessionYmd = dayOf(session.ts, timeZone);

  const bySubject: Record<string, SubjectBucket> = { ...briefing.stats.by_subject };
  const previous = bySubject[session.subject] ?? {
    minutes: 0,
    sessions: 0,
    problems: 0,
  };
  bySubject[session.subject] = {
    minutes: previous.minutes + (session.minutes || 0),
    sessions: previous.sessions + 1,
    problems: previous.problems + (session.problems_count || 0),
  };

  const hadSameDay = (subject: string) =>
    recent.some(
      (row) => row.subject === subject && dayOf(row.ts, timeZone) === sessionYmd,
    );

  let walkDays = briefing.stats.walk_days;
  let readingDays = briefing.stats.reading_days;
  if (session.subject === "walk" && sessionYmd === todayYmd && !hadSameDay("walk")) {
    walkDays += 1;
  }
  if (
    session.subject === "reading" &&
    sessionYmd === todayYmd &&
    !hadSameDay("reading")
  ) {
    readingDays += 1;
  }

  const studyMinutes = STUDY_SUBJECTS.has(session.subject) ? session.minutes || 0 : 0;

  const stats = {
    ...briefing.stats,
    by_subject: bySubject,
    walk_days: walkDays,
    reading_days: readingDays,
    study_minutes_week: briefing.stats.study_minutes_week + studyMinutes,
  };

  return {
    briefing: {
      ...briefing,
      stats,
      guidance: rewriteGuidance(briefing.guidance, stats),
    },
    recent: [session, ...recent],
  };
}

export function applyUnloggedSession(input: {
  briefing: Briefing;
  recent: SessionRecord[];
  session: SessionRecord;
}): { briefing: Briefing; recent: SessionRecord[] } {
  const { briefing, session } = input;
  const timeZone = briefing.timezone;
  const sessionYmd = dayOf(session.ts, timeZone);
  const remaining = input.recent.filter((row) => row.id !== session.id);

  const bySubject: Record<string, SubjectBucket> = { ...briefing.stats.by_subject };
  const previous = bySubject[session.subject] ?? {
    minutes: 0,
    sessions: 0,
    problems: 0,
  };
  bySubject[session.subject] = {
    minutes: Math.max(0, previous.minutes - (session.minutes || 0)),
    sessions: Math.max(0, previous.sessions - 1),
    problems: Math.max(0, previous.problems - (session.problems_count || 0)),
  };

  const stillHasSameDay = (subject: string) =>
    remaining.some(
      (row) => row.subject === subject && dayOf(row.ts, timeZone) === sessionYmd,
    );

  const distinctDays = (subject: string) => {
    const days = new Set<string>();
    for (const row of remaining) {
      if (row.subject === subject) days.add(dayOf(row.ts, timeZone));
    }
    return days.size;
  };

  let walkDays = briefing.stats.walk_days;
  let readingDays = briefing.stats.reading_days;
  if (session.subject === "walk" && !stillHasSameDay("walk")) {
    walkDays = Math.max(0, walkDays - 1);
  }
  if (session.subject === "reading" && !stillHasSameDay("reading")) {
    readingDays = Math.max(0, readingDays - 1);
  }
  walkDays = Math.max(walkDays, distinctDays("walk"));
  readingDays = Math.max(readingDays, distinctDays("reading"));

  const studyMinutes = STUDY_SUBJECTS.has(session.subject) ? session.minutes || 0 : 0;

  const stats = {
    ...briefing.stats,
    by_subject: bySubject,
    walk_days: walkDays,
    reading_days: readingDays,
    study_minutes_week: Math.max(0, briefing.stats.study_minutes_week - studyMinutes),
  };

  return {
    briefing: {
      ...briefing,
      stats,
      guidance: rewriteGuidance(briefing.guidance, stats),
    },
    recent: remaining,
  };
}
