import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, weeklyReviews } from "@/db/schema";
import { loadConfig } from "./config";
import { weekDsaProblemStats } from "./dsa-problems";
import {
  addCalendarDays,
  pythonWeekday,
  ymdInZone,
  zonedParts,
  zonedWallToDate,
} from "./timezone";
import { listProblems } from "./zettel/notes";
import type {
  ReviewRecord,
  SessionRecord,
  Subject,
  SubjectBucket,
  WeekStats,
} from "./types";
import { SUBJECTS } from "./types";

function isSubject(value: string): value is Subject {
  return (SUBJECTS as readonly string[]).includes(value);
}

function serializeSession(row: typeof sessions.$inferSelect): SessionRecord {
  return {
    id: row.id,
    ts: row.ts.toISOString(),
    subject: row.subject,
    minutes: row.minutes,
    notes: row.notes,
    problems_count: row.problemsCount,
    extra: row.extra ?? {},
  };
}

function serializeReview(row: typeof weeklyReviews.$inferSelect): ReviewRecord {
  return {
    id: row.id,
    week_start: row.weekStart,
    created_at: row.createdAt.toISOString(),
    dsa: row.dsa,
    lld: row.lld,
    hld: row.hld,
    ai: row.ai,
    personal: row.personal,
  };
}

export function weekStartIso(moment: Date, timeZone = loadConfig().timezone): string {
  const local = zonedParts(moment, timeZone);
  const weekday = pythonWeekday(local.year, local.month, local.day);
  const monday = addCalendarDays(local.year, local.month, local.day, -weekday);
  return `${monday.year}-${String(monday.month).padStart(2, "0")}-${String(monday.day).padStart(2, "0")}`;
}

export async function addSession(input: {
  subject: string;
  minutes?: number;
  notes?: string;
  problems_count?: number;
  extra?: Record<string, unknown>;
  ts?: string;
}): Promise<SessionRecord> {
  let subject = (input.subject || "other").toLowerCase();
  if (!isSubject(subject)) subject = "other";

  const ts = input.ts ? new Date(input.ts) : new Date();
    const [row] = await db
      .insert(sessions)
      .values({
        ts,
        subject,
        minutes: Math.max(0, Math.trunc(input.minutes || 0)),
        notes: input.notes || "",
        problemsCount: Math.max(0, Math.trunc(input.problems_count || 0)),
        extra: input.extra || {},
      })
      .returning();

    if (!row) throw new Error("Failed to insert session");
    return serializeSession(row);
}

export async function deleteSession(id: string): Promise<SessionRecord | null> {
  const [row] = await db.delete(sessions).where(eq(sessions.id, id)).returning();
  return row ? serializeSession(row) : null;
}

export async function saveReview(
  weekStart: string,
  body: {
    dsa?: string;
    lld?: string;
    hld?: string;
    ai?: string;
    personal?: string;
  },
): Promise<ReviewRecord> {
  const createdAt = new Date();
  const values = {
    weekStart,
    createdAt,
    dsa: body.dsa || "",
    lld: body.lld || "",
    hld: body.hld || "",
    ai: body.ai || "",
    personal: body.personal || "",
  };

  const [row] = await db
    .insert(weeklyReviews)
    .values(values)
    .onConflictDoUpdate({
      target: weeklyReviews.weekStart,
      set: {
        createdAt,
        dsa: values.dsa,
        lld: values.lld,
        hld: values.hld,
        ai: values.ai,
        personal: values.personal,
      },
    })
      .returning();

  if (!row) throw new Error("Failed to save weekly review");
  return serializeReview(row);
}

export async function recentSessions(limit = 20): Promise<SessionRecord[]> {
  const rows = await db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.ts), desc(sessions.id))
    .limit(limit);
  return rows.map(serializeSession);
}

export async function getReview(weekStart: string): Promise<ReviewRecord | null> {
  const [row] = await db
    .select()
    .from(weeklyReviews)
    .where(eq(weeklyReviews.weekStart, weekStart))
    .limit(1);
  return row ? serializeReview(row) : null;
}

export async function statsForWeek(moment: Date): Promise<WeekStats> {
  const timeZone = loadConfig().timezone;
  const start = weekStartIso(moment, timeZone);
  const [sy, sm, sd] = start.split("-").map(Number);
  const end = addCalendarDays(sy, sm, sd, 7);
  const startDt = zonedWallToDate(sy, sm, sd, 0, 0, timeZone);
  const endDt = zonedWallToDate(end.year, end.month, end.day, 0, 0, timeZone);

  const [rows, problems, review] = await Promise.all([
    db
      .select()
      .from(sessions)
      .where(and(gte(sessions.ts, startDt), lt(sessions.ts, endDt))),
    listProblems(),
    getReview(start),
  ]);

  const bySubject: Record<string, SubjectBucket> = {};
  const walkDays = new Set<string>();
  const readingDays = new Set<string>();

  for (const row of rows) {
    const bucket = (bySubject[row.subject] ??= {
      minutes: 0,
      sessions: 0,
      problems: 0,
    });
    bucket.minutes += row.minutes || 0;
    bucket.sessions += 1;
    bucket.problems += row.problemsCount || 0;
    const day = ymdInZone(row.ts, timeZone);
    if (row.subject === "walk") walkDays.add(day);
    if (row.subject === "reading") readingDays.add(day);
  }

  const solved = weekDsaProblemStats(
    problems.map((problem) => problem.lastSolved),
    start,
  );

  return {
    week_start: start,
    by_subject: bySubject,
    walk_days: walkDays.size,
    reading_days: readingDays.size,
    dsa_problems_total: solved.dsa_problems_total,
    dsa_problems_week: solved.dsa_problems_week,
    study_minutes_week: ["dsa", "lld", "hld", "ai"].reduce(
      (sum, key) => sum + (bySubject[key]?.minutes ?? 0),
      0,
    ),
    review,
  };
}
