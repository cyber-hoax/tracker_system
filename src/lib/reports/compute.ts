import { iterBlocksForDay } from "@/lib/schedule";
import { addCalendarDays, formatYmd, pythonWeekday, ymdInZone } from "@/lib/timezone";
import type { ReviewRecord, Routine, SessionRecord } from "@/lib/types";
import type { ContributionDay } from "./contribution";
import {
  calendarRange,
  eachYmd,
  monthBounds,
  parseYmd,
  weekBounds,
  yearBounds,
  yearCalendarRange,
} from "./params";

export type { ContributionDay } from "./contribution";
export {
  contributionIntensity,
  formatContributionTooltip,
} from "./contribution";

export {
  calendarRange,
  eachYmd,
  monthBounds,
  parseReportParams,
  parseYmd,
  reportRange,
  REPORT_TABS,
  reportsHref,
  shiftDate,
  weekBounds,
  yearBounds,
  yearCalendarRange,
} from "./params";
export type { ReportTab } from "./params";

export type HourTarget = {
  min: number;
  max: number;
  mid: number;
};

export type SolvedProblem = {
  id: string;
  title: string;
  slug: string;
  status?: string;
  difficulty?: string;
  patterns: string[];
  lastSolved: string;
  revisionCount?: number;
};

export type TrackableBlock = {
  subject: string;
  kind: "habit" | "study";
  expectedMinutes: number;
  loggedMinutes: number;
  done: boolean;
};

export type DayReport = {
  date: string;
  dayLabel: string;
  blocks: TrackableBlock[];
  completedCount: number;
  expectedCount: number;
  questions: SolvedProblem[];
  studyMinutes: number;
  proratedTargets: { dsaMinutes: number };
  sessions: SessionRecord[];
};

export type WeekHourRow = {
  subject: string;
  logged: number;
  target: HourTarget | null;
};

export type DayBar = {
  ymd: string;
  label: string;
  minutes: number;
};

export type WeekReport = {
  weekStart: string;
  weekEnd: string;
  hours: Record<string, WeekHourRow>;
  walkDays: number;
  walkExpected: number;
  readingDays: number;
  readingExpected: number;
  dsaProblemCount: number;
  questions: SolvedProblem[];
  dayBars: DayBar[];
  review: ReviewRecord | null;
  studyMinutes: number;
  contributionDays: ContributionDay[];
};

export type Adherence = {
  completed: number;
  expected: number;
  percent: number;
};

export type MonthReport = {
  start: string;
  end: string;
  clippedEnd: string;
  questionCount: number;
  questions: SolvedProblem[];
  difficultyMix: Record<string, number>;
  topPatterns: { name: string; count: number }[];
  studyHours: number;
  adherence: Adherence;
  contributionDays: ContributionDay[];
};

export type CalendarPip = "dsa" | "walk" | "reading" | "other";

export type CalendarCell = {
  ymd: string;
  day: number;
  inMonth: boolean;
  questionCount: number;
  pips: CalendarPip[];
  walk: boolean;
  reading: boolean;
  study: boolean;
};

export type CalendarGrid = {
  start: string;
  end: string;
  monthStart: string;
  monthEnd: string;
  cells: CalendarCell[];
};

const STUDY_SUBJECTS = ["dsa", "lld", "hld", "ai"] as const;
const HABIT_SUBJECTS = ["walk", "reading"] as const;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function parseHourTarget(raw: string | undefined): HourTarget | null {
  if (!raw) return null;
  const range = raw.match(/(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return { min, max, mid: (min + max) / 2 };
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return { min: n, max: n, mid: n };
}

function sessionInstant(session: Pick<SessionRecord, "ts">): Date {
  return new Date(session.ts);
}

function sessionsOnDay(
  sessions: SessionRecord[],
  ymd: string,
  timeZone: string,
): SessionRecord[] {
  return sessions.filter(
    (session) => ymdInZone(sessionInstant(session), timeZone) === ymd,
  );
}

function minutesBySubject(daySessions: SessionRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const session of daySessions) {
    map.set(session.subject, (map.get(session.subject) ?? 0) + session.minutes);
  }
  return map;
}

function isStudySubject(subject: string): boolean {
  return (STUDY_SUBJECTS as readonly string[]).includes(subject);
}

type ExpectedSubject = {
  subject: string;
  kind: "habit" | "study";
  minutes: number;
};

function expectedSubjects(
  routine: Routine,
  ymd: string,
  timeZone: string,
): ExpectedSubject[] {
  const { year, month, day } = parseYmd(ymd);
  const blocks = iterBlocksForDay(routine, year, month, day, timeZone);
  const bySubject = new Map<string, ExpectedSubject>();
  for (const block of blocks) {
    let kind: "habit" | "study" | null = null;
    if ((HABIT_SUBJECTS as readonly string[]).includes(block.subject)) {
      kind = "habit";
    } else if (isStudySubject(block.subject)) {
      kind = "study";
    }
    if (!kind) continue;
    const current = bySubject.get(block.subject) ?? {
      subject: block.subject,
      kind,
      minutes: 0,
    };
    current.minutes += block.minutes;
    bySubject.set(block.subject, current);
  }

  const order = [
    "walk",
    "reading",
    "dsa",
    ...[...bySubject.keys()].filter(
      (key) => key !== "walk" && key !== "reading" && key !== "dsa",
    ),
  ];
  return order
    .map((key) => bySubject.get(key))
    .filter((item): item is ExpectedSubject => Boolean(item));
}

function weeklyExpectedMinutes(
  routine: Routine,
  weekStart: string,
  timeZone: string,
  subject: string,
): number {
  let total = 0;
  for (const ymd of eachYmd(weekStart, weekBounds(weekStart).end)) {
    const found = expectedSubjects(routine, ymd, timeZone).find(
      (item) => item.subject === subject,
    );
    total += found?.minutes ?? 0;
  }
  return total;
}

function proratedMinutes(
  routine: Routine,
  ymd: string,
  timeZone: string,
  subject: string,
): number {
  const target = parseHourTarget(routine.weekly_hours?.[subject]);
  if (!target) return 0;
  const weekStart = weekBounds(ymd).start;
  const weekMinutes = weeklyExpectedMinutes(routine, weekStart, timeZone, subject);
  const dayMinutes =
    expectedSubjects(routine, ymd, timeZone).find((item) => item.subject === subject)
      ?.minutes ?? 0;
  if (weekMinutes <= 0) {
    return Math.round((target.mid / 7) * 60);
  }
  return Math.round((dayMinutes / weekMinutes) * target.mid * 60);
}

function hoursFromMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

function problemsInRange(
  problems: SolvedProblem[],
  start: string,
  end: string,
): SolvedProblem[] {
  return problems.filter(
    (problem) => problem.lastSolved >= start && problem.lastSolved <= end,
  );
}

function studyMinutesForSessions(daySessions: SessionRecord[]): number {
  return daySessions.reduce(
    (sum, session) => sum + (isStudySubject(session.subject) ? session.minutes : 0),
    0,
  );
}

function dayKeyLabel(ymd: string): string {
  const { year, month, day } = parseYmd(ymd);
  return DAY_LABELS[pythonWeekday(year, month, day)];
}

export function computeDayReport(input: {
  date: string;
  timeZone: string;
  routine: Routine;
  sessions: SessionRecord[];
  problems: SolvedProblem[];
}): DayReport {
  const { date, timeZone, routine, sessions, problems } = input;
  const { year, month, day } = parseYmd(date);
  const dayKey = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][
    pythonWeekday(year, month, day)
  ];
  const daySessions = sessionsOnDay(sessions, date, timeZone);
  const logged = minutesBySubject(daySessions);
  const expected = expectedSubjects(routine, date, timeZone);
  const blocks: TrackableBlock[] = expected.map((item) => {
    const loggedMinutes = logged.get(item.subject) ?? 0;
    return {
      subject: item.subject,
      kind: item.kind,
      expectedMinutes: item.minutes,
      loggedMinutes,
      done: loggedMinutes > 0,
    };
  });

  return {
    date,
    dayLabel: routine.days[dayKey]?.label ?? dayKeyLabel(date),
    blocks,
    completedCount: blocks.filter((block) => block.done).length,
    expectedCount: blocks.length,
    questions: problemsInRange(problems, date, date),
    studyMinutes: studyMinutesForSessions(daySessions),
    proratedTargets: { dsaMinutes: proratedMinutes(routine, date, timeZone, "dsa") },
    sessions: daySessions,
  };
}

export function computeWeekReport(input: {
  date: string;
  timeZone: string;
  routine: Routine;
  sessions: SessionRecord[];
  problems: SolvedProblem[];
  review: ReviewRecord | null;
}): WeekReport {
  const { date, timeZone, routine, sessions, problems, review } = input;
  const { start, end } = weekBounds(date);
  const days = eachYmd(start, end);
  const minutes: Record<string, number> = {};
  const walkDays = new Set<string>();
  const readingDays = new Set<string>();

  for (const session of sessions) {
    const ymd = ymdInZone(sessionInstant(session), timeZone);
    if (ymd < start || ymd > end) continue;
    minutes[session.subject] = (minutes[session.subject] ?? 0) + session.minutes;
    if (session.subject === "walk") walkDays.add(ymd);
    if (session.subject === "reading") readingDays.add(ymd);
  }

  const hourKeys = [
    ...new Set([
      ...Object.keys(routine.weekly_hours ?? {}),
      ...STUDY_SUBJECTS,
      "reading",
    ]),
  ];
  const hours: Record<string, WeekHourRow> = {};
  for (const subject of hourKeys) {
    hours[subject] = {
      subject,
      logged: hoursFromMinutes(minutes[subject] ?? 0),
      target: parseHourTarget(routine.weekly_hours?.[subject]),
    };
  }

  const questions = problemsInRange(problems, start, end);
  const dayBars: DayBar[] = days.map((ymd) => ({
    ymd,
    label: dayKeyLabel(ymd),
    minutes: studyMinutesForSessions(sessionsOnDay(sessions, ymd, timeZone)),
  }));

  let walkExpected = 0;
  let readingExpected = 0;
  for (const ymd of days) {
    const expected = expectedSubjects(routine, ymd, timeZone);
    if (expected.some((item) => item.subject === "walk")) walkExpected += 1;
    if (expected.some((item) => item.subject === "reading")) readingExpected += 1;
  }

  return {
    weekStart: start,
    weekEnd: end,
    hours,
    walkDays: walkDays.size,
    walkExpected,
    readingDays: readingDays.size,
    readingExpected,
    dsaProblemCount: questions.length,
    questions,
    dayBars,
    review,
    studyMinutes: STUDY_SUBJECTS.reduce(
      (sum, subject) => sum + (minutes[subject] ?? 0),
      0,
    ),
    contributionDays: buildContributionDays({
      start,
      end,
      timeZone,
      sessions,
      problems,
    }),
  };
}

function clipMonthEnd(monthStart: string, monthEnd: string, asOf?: string): string {
  if (!asOf) return monthEnd;
  if (asOf < monthStart) {
    const start = parseYmd(monthStart);
    return formatYmd(addCalendarDays(start.year, start.month, start.day, -1));
  }
  return asOf < monthEnd ? asOf : monthEnd;
}

export function computeMonthReport(input: {
  date: string;
  timeZone: string;
  routine: Routine;
  sessions: SessionRecord[];
  problems: SolvedProblem[];
  asOf?: string;
}): MonthReport {
  const { date, timeZone, routine, sessions, problems, asOf } = input;
  const { start, end } = monthBounds(date);
  const clippedEnd = clipMonthEnd(start, end, asOf);
  const inRange = (ymd: string) => ymd >= start && ymd <= clippedEnd;

  const questions = problemsInRange(problems, start, clippedEnd);
  const difficultyMix: Record<string, number> = {};
  const patternCounts = new Map<string, number>();
  for (const problem of questions) {
    const diff = (problem.difficulty || "").toLowerCase();
    if (diff) difficultyMix[diff] = (difficultyMix[diff] ?? 0) + 1;
    for (const pattern of problem.patterns) {
      const name = pattern.trim();
      if (!name) continue;
      patternCounts.set(name, (patternCounts.get(name) ?? 0) + 1);
    }
  }

  let studyMinutes = 0;
  const logged = {
    walk: new Set<string>(),
    reading: new Set<string>(),
    dsa: new Set<string>(),
  };
  for (const session of sessions) {
    const ymd = ymdInZone(sessionInstant(session), timeZone);
    if (!inRange(ymd)) continue;
    if (isStudySubject(session.subject)) studyMinutes += session.minutes;
    if (session.subject === "walk") logged.walk.add(ymd);
    if (session.subject === "reading") logged.reading.add(ymd);
    if (session.subject === "dsa") logged.dsa.add(ymd);
  }

  let expected = 0;
  let completed = 0;
  if (clippedEnd >= start) {
    for (const ymd of eachYmd(start, clippedEnd)) {
      const expectedDay = expectedSubjects(routine, ymd, timeZone);
      for (const item of expectedDay) {
        if (item.subject === "walk") {
          expected += 1;
          if (logged.walk.has(ymd)) completed += 1;
        } else if (item.subject === "reading") {
          expected += 1;
          if (logged.reading.has(ymd)) completed += 1;
        } else if (item.subject === "dsa") {
          expected += 1;
          if (logged.dsa.has(ymd)) completed += 1;
        }
      }
    }
  }

  const topPatterns = [...patternCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const padded = calendarRange(date);
  return {
    start,
    end,
    clippedEnd,
    questionCount: questions.length,
    questions,
    difficultyMix,
    topPatterns,
    studyHours: hoursFromMinutes(studyMinutes),
    adherence: {
      completed,
      expected,
      percent: expected === 0 ? 100 : Math.round((100 * completed) / expected),
    },
    contributionDays: buildContributionDays({
      start: padded.start,
      end: padded.end,
      monthStart: start,
      monthEnd: end,
      timeZone,
      sessions,
      problems,
    }),
  };
}

function pipsForDay(daySessions: SessionRecord[]): CalendarPip[] {
  let dsa = false;
  let walk = false;
  let reading = false;
  let other = false;
  for (const session of daySessions) {
    if (session.subject === "dsa") dsa = true;
    else if (session.subject === "walk") walk = true;
    else if (session.subject === "reading") reading = true;
    else other = true;
  }
  const pips: CalendarPip[] = [];
  if (dsa) pips.push("dsa");
  if (walk) pips.push("walk");
  if (reading) pips.push("reading");
  if (other) pips.push("other");
  return pips;
}

export function buildContributionDays(input: {
  start: string;
  end: string;
  monthStart?: string;
  monthEnd?: string;
  timeZone: string;
  sessions: SessionRecord[];
  problems: SolvedProblem[];
}): ContributionDay[] {
  const { start, end, timeZone, sessions, problems } = input;
  const monthStart = input.monthStart ?? start;
  const monthEnd = input.monthEnd ?? end;
  const questionsByDay = new Map<string, number>();
  for (const problem of problems) {
    questionsByDay.set(
      problem.lastSolved,
      (questionsByDay.get(problem.lastSolved) ?? 0) + 1,
    );
  }

  return eachYmd(start, end).map((ymd) => {
    const pips = pipsForDay(sessionsOnDay(sessions, ymd, timeZone));
    return {
      ymd,
      questionCount: questionsByDay.get(ymd) ?? 0,
      walk: pips.includes("walk"),
      reading: pips.includes("reading"),
      study: pips.includes("dsa") || pips.includes("other"),
      inMonth: ymd >= monthStart && ymd <= monthEnd,
    };
  });
}

export type YearHeatmap = {
  year: number;
  start: string;
  end: string;
  days: ContributionDay[];
};

export function buildYearHeatmap(input: {
  date: string;
  timeZone: string;
  sessions: SessionRecord[];
  problems: SolvedProblem[];
}): YearHeatmap {
  const { date, timeZone, sessions, problems } = input;
  const { start: yearStart, end: yearEnd } = yearBounds(date);
  const { start, end } = yearCalendarRange(date);
  return {
    year: parseYmd(date).year,
    start,
    end,
    days: buildContributionDays({
      start,
      end,
      monthStart: yearStart,
      monthEnd: yearEnd,
      timeZone,
      sessions,
      problems,
    }),
  };
}

export function buildCalendarGrid(input: {
  date: string;
  timeZone: string;
  routine: Routine;
  sessions: SessionRecord[];
  problems: SolvedProblem[];
}): CalendarGrid {
  const { date, timeZone, sessions, problems } = input;
  const { start: monthStart, end: monthEnd } = monthBounds(date);
  const { start, end } = calendarRange(date);
  const questionsByDay = new Map<string, number>();
  for (const problem of problems) {
    questionsByDay.set(
      problem.lastSolved,
      (questionsByDay.get(problem.lastSolved) ?? 0) + 1,
    );
  }

  const cells: CalendarCell[] = eachYmd(start, end).map((ymd) => {
    const { day } = parseYmd(ymd);
    const daySessions = sessionsOnDay(sessions, ymd, timeZone);
    const pips = pipsForDay(daySessions);
    return {
      ymd,
      day,
      inMonth: ymd >= monthStart && ymd <= monthEnd,
      questionCount: questionsByDay.get(ymd) ?? 0,
      pips,
      walk: pips.includes("walk"),
      reading: pips.includes("reading"),
      study: pips.includes("dsa") || pips.includes("other"),
    };
  });

  return { start, end, monthStart, monthEnd, cells };
}
