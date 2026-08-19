import { addCalendarDays, pad2 } from "./timezone";

function isYmd(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function weekEndYmd(weekStart: string): string {
  const [year, month, day] = weekStart.split("-").map(Number);
  const end = addCalendarDays(year, month, day, 6);
  return `${end.year}-${pad2(end.month)}-${pad2(end.day)}`;
}

/**
 * DSA problem counts from zettelkasten Last Solved Date values.
 * Each dated problem note is one completed question. Session
 * `problems_count` is not used here — block logs stay 0 by design.
 */
export function weekDsaProblemStats(
  lastSolvedYmds: Array<string | null | undefined>,
  weekStart: string,
): { dsa_problems_week: number; dsa_problems_total: number } {
  const weekEnd = weekEndYmd(weekStart);
  let total = 0;
  let week = 0;
  for (const ymd of lastSolvedYmds) {
    if (!isYmd(ymd)) continue;
    total += 1;
    if (ymd >= weekStart && ymd <= weekEnd) week += 1;
  }
  return { dsa_problems_week: week, dsa_problems_total: total };
}
