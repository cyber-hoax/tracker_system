import { addCalendarDays, formatYmd, pythonWeekday } from "@/lib/timezone";

export const REPORT_TABS = ["day", "week", "month", "calendar"] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function firstParam(
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

export function parseYmd(ymd: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = ymd.split("-").map(Number);
  return { year, month, day };
}

export function parseReportParams(
  searchParams: Record<string, string | string[] | undefined>,
  todayYmd: string,
): { tab: ReportTab; date: string } {
  const tabRaw = firstParam(searchParams, "tab");
  const tab = REPORT_TABS.includes(tabRaw as ReportTab)
    ? (tabRaw as ReportTab)
    : "day";
  const dateRaw = firstParam(searchParams, "date");
  const date =
    dateRaw && YMD_RE.test(dateRaw) && Number.isFinite(parseYmd(dateRaw).year)
      ? dateRaw
      : todayYmd;
  return { tab, date };
}

export function weekBounds(ymd: string): { start: string; end: string } {
  const { year, month, day } = parseYmd(ymd);
  const weekday = pythonWeekday(year, month, day);
  const monday = addCalendarDays(year, month, day, -weekday);
  const sunday = addCalendarDays(monday.year, monday.month, monday.day, 6);
  return { start: formatYmd(monday), end: formatYmd(sunday) };
}

export function monthBounds(ymd: string): { start: string; end: string } {
  const { year, month } = parseYmd(ymd);
  const start = formatYmd({ year, month, day: 1 });
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const last = addCalendarDays(nextYear, nextMonth, 1, -1);
  return { start, end: formatYmd(last) };
}

export function eachYmd(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = parseYmd(start);
  while (formatYmd(cursor) <= end) {
    out.push(formatYmd(cursor));
    cursor = addCalendarDays(cursor.year, cursor.month, cursor.day, 1);
  }
  return out;
}

export function yearBounds(ymd: string): { start: string; end: string } {
  const { year } = parseYmd(ymd);
  return {
    start: formatYmd({ year, month: 1, day: 1 }),
    end: formatYmd({ year, month: 12, day: 31 }),
  };
}

export function yearCalendarRange(ymd: string): { start: string; end: string } {
  const { start, end } = yearBounds(ymd);
  return {
    start: weekBounds(start).start,
    end: weekBounds(end).end,
  };
}

function shiftMonth(ymd: string, delta: number): string {
  const { year, month, day } = parseYmd(ymd);
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  const lastDay = parseYmd(
    monthBounds(formatYmd({ year: nextYear, month: nextMonth, day: 1 })).end,
  ).day;
  return formatYmd({
    year: nextYear,
    month: nextMonth,
    day: Math.min(day, lastDay),
  });
}

function shiftYear(ymd: string, delta: number): string {
  const { year, month, day } = parseYmd(ymd);
  const nextYear = year + delta;
  const lastDay = parseYmd(
    monthBounds(formatYmd({ year: nextYear, month, day: 1 })).end,
  ).day;
  return formatYmd({
    year: nextYear,
    month,
    day: Math.min(day, lastDay),
  });
}

export function shiftDate(ymd: string, tab: ReportTab, delta: number): string {
  const { year, month, day } = parseYmd(ymd);
  if (tab === "week") {
    return formatYmd(addCalendarDays(year, month, day, delta * 7));
  }
  if (tab === "month") return shiftMonth(ymd, delta);
  if (tab === "calendar") return shiftYear(ymd, delta);
  return formatYmd(addCalendarDays(year, month, day, delta));
}

export function calendarRange(ymd: string): { start: string; end: string } {
  const { start: monthStart, end: monthEnd } = monthBounds(ymd);
  return {
    start: weekBounds(monthStart).start,
    end: weekBounds(monthEnd).end,
  };
}

export function reportRange(
  tab: ReportTab,
  date: string,
): { start: string; end: string } {
  if (tab === "day") return { start: date, end: date };
  if (tab === "week") return weekBounds(date);
  if (tab === "calendar") return yearCalendarRange(date);
  return monthBounds(date);
}

export function reportsHref(tab: ReportTab, date: string): string {
  return `/reports?tab=${encodeURIComponent(tab)}&date=${encodeURIComponent(date)}`;
}
