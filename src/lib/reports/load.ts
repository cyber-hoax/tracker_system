import { and, gte, lt, lte } from "drizzle-orm";
import { db } from "@/db";
import { sessions, weeklyReviews } from "@/db/schema";
import { loadConfig } from "@/lib/config";
import { loadRoutine } from "@/lib/routine";
import { addCalendarDays, ymdInZone, zonedWallToDate } from "@/lib/timezone";
import type { ReviewRecord, SessionRecord } from "@/lib/types";
import { listProblems } from "@/lib/zettel";
import {
  buildCalendarGrid,
  buildYearHeatmap,
  computeDayReport,
  computeMonthReport,
  computeWeekReport,
  type SolvedProblem,
} from "./compute";
import { parseYmd, reportRange, type ReportTab } from "./params";

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

export async function loadReportFacts(startYmd: string, endYmd: string) {
  const timeZone = loadConfig().timezone;
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  const endExclusive = addCalendarDays(end.year, end.month, end.day, 1);
  const startDt = zonedWallToDate(start.year, start.month, start.day, 0, 0, timeZone);
  const endDt = zonedWallToDate(
    endExclusive.year,
    endExclusive.month,
    endExclusive.day,
    0,
    0,
    timeZone,
  );

  const [sessionRows, problems, reviewRows] = await Promise.all([
    db
      .select()
      .from(sessions)
      .where(and(gte(sessions.ts, startDt), lt(sessions.ts, endDt))),
    listProblems({ lastSolvedFrom: startYmd, lastSolvedTo: endYmd }),
    db
      .select()
      .from(weeklyReviews)
      .where(
        and(
          gte(weeklyReviews.weekStart, startYmd),
          lte(weeklyReviews.weekStart, endYmd),
        ),
      ),
  ]);

  const solved: SolvedProblem[] = problems.flatMap((problem) => {
    if (!problem.lastSolved) return [];
    return [
      {
        id: problem.id,
        title: problem.title,
        slug: problem.slug,
        status: problem.status,
        difficulty: problem.difficulty,
        patterns: problem.patterns,
        lastSolved: problem.lastSolved,
        revisionCount: problem.revisionCount,
      },
    ];
  });

  return {
    timeZone,
    sessions: sessionRows.map(serializeSession),
    problems: solved,
    reviews: reviewRows.map(serializeReview),
  };
}

export async function loadReportsPage(tab: ReportTab, date: string) {
  const timeZone = loadConfig().timezone;
  const routine = await loadRoutine();
  const todayYmd = ymdInZone(new Date(), timeZone);
  const range = reportRange(tab, date);
  const facts = await loadReportFacts(range.start, range.end);

  const shared = {
    date,
    timeZone: facts.timeZone,
    routine,
    sessions: facts.sessions,
    problems: facts.problems,
  };

  const day =
    tab === "day" || tab === "calendar" ? computeDayReport(shared) : null;
  const week =
    tab === "week"
      ? computeWeekReport({
          ...shared,
          review:
            facts.reviews.find((review) => review.week_start === range.start) ??
            null,
        })
      : null;
  const month =
    tab === "month" ? computeMonthReport({ ...shared, asOf: todayYmd }) : null;
  const calendar = tab === "calendar" ? buildCalendarGrid(shared) : null;
  const year =
    tab === "calendar"
      ? buildYearHeatmap({
          date,
          timeZone: facts.timeZone,
          sessions: facts.sessions,
          problems: facts.problems,
        })
      : null;

  return {
    tab,
    date,
    todayYmd,
    timeZone,
    day,
    week,
    month,
    calendar,
    year,
  };
}
