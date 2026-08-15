import { loadConfig } from "./config";
import { loadRoutine } from "./routine";
import {
  addCalendarDays,
  isoWeekNumber,
  parseHm,
  pythonWeekday,
  toIsoWithOffset,
  zonedParts,
  zonedWallToDate,
} from "./timezone";
import type {
  EnrichedBlock,
  Routine,
  RoutineBlock,
  RoutinePhase,
  ScheduleSnapshot,
} from "./types";

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export function dayKeyForParts(year: number, month: number, day: number): string {
  return DAY_KEYS[pythonWeekday(year, month, day)];
}

function parsePlanStart(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function blockWindow(
  year: number,
  month: number,
  day: number,
  start: string,
  end: string,
  timeZone: string,
): { startDt: Date; endDt: Date } {
  const startHm = parseHm(start);
  const endHm = parseHm(end);
  const startDt = zonedWallToDate(
    year,
    month,
    day,
    startHm.hour,
    startHm.minute,
    timeZone,
  );
  let endDt = zonedWallToDate(year, month, day, endHm.hour, endHm.minute, timeZone);
  if (endDt.getTime() <= startDt.getTime()) {
    const next = addCalendarDays(year, month, day, 1);
    endDt = zonedWallToDate(
      next.year,
      next.month,
      next.day,
      endHm.hour,
      endHm.minute,
      timeZone,
    );
  }
  return { startDt, endDt };
}

export function resolveSubject(
  block: RoutineBlock,
  year: number,
  month: number,
  day: number,
): string {
  const subject = block.subject || "none";
  if (subject !== "hld_lld_alt") return subject;
  const evenWeek = isoWeekNumber(year, month, day) % 2 === 0;
  const weekday = pythonWeekday(year, month, day);
  if (weekday === 3) return evenWeek ? "hld" : "lld";
  if (weekday === 4) return evenWeek ? "lld" : "hld";
  return "hld";
}

export function resolveTitle(
  block: RoutineBlock,
  year: number,
  month: number,
  day: number,
): string {
  const subject = resolveSubject(block, year, month, day);
  const title = block.title || "Block";
  if (block.subject === "hld_lld_alt") return subject.toUpperCase();
  return title;
}

export function phaseFor(
  planStart: string,
  year: number,
  month: number,
  routine: Routine,
): RoutinePhase {
  const start = parsePlanStart(planStart);
  const monthsElapsed = (year - start.year) * 12 + (month - start.month);
  const monthIndex = Math.max(1, Math.min(6, monthsElapsed + 1));
  const phases = routine.phases || [];
  for (const phase of phases) {
    if (phase.start_month <= monthIndex && monthIndex <= phase.end_month) {
      return { ...phase, month_index: monthIndex };
    }
  }
  const last = phases[phases.length - 1] || {
    name: "Plan",
    start_month: 1,
    end_month: 6,
    mix: "",
  };
  return { ...last, month_index: monthIndex };
}

export function enrichBlock(
  block: RoutineBlock,
  year: number,
  month: number,
  day: number,
  timeZone: string,
  moment: Date,
): EnrichedBlock {
  const { startDt, endDt } = blockWindow(year, month, day, block.start, block.end, timeZone);
  const inBlock = startDt.getTime() <= moment.getTime() && moment.getTime() < endDt.getTime();
  const remaining = inBlock
    ? Math.max(0, Math.floor((endDt.getTime() - moment.getTime()) / 60000))
    : null;
  const elapsed = inBlock
    ? Math.max(0, Math.floor((moment.getTime() - startDt.getTime()) / 60000))
    : null;
  const total = Math.max(1, Math.floor((endDt.getTime() - startDt.getTime()) / 60000));
  const subject = resolveSubject(block, year, month, day);
  return {
    start: block.start,
    end: block.end,
    start_iso: toIsoWithOffset(startDt, timeZone),
    end_iso: toIsoWithOffset(endDt, timeZone),
    title: resolveTitle(block, year, month, day),
    kind: block.kind || "buffer",
    subject,
    guide: block.guide || "",
    minutes: total,
    remaining_min: remaining,
    elapsed_min: elapsed,
    progress_pct:
      elapsed !== null ? Math.min(100, Math.round((100 * elapsed) / total)) : 0,
  };
}

export function iterBlocksForDay(
  routine: Routine,
  year: number,
  month: number,
  day: number,
  timeZone: string,
): EnrichedBlock[] {
  const key = dayKeyForParts(year, month, day);
  const daySpec = routine.days[key];
  const noon = zonedWallToDate(year, month, day, 12, 0, timeZone);
  return daySpec.blocks.map((block) =>
    enrichBlock(block, year, month, day, timeZone, noon),
  );
}

export function currentAndNext(moment = new Date()): ScheduleSnapshot {
  const cfg = loadConfig();
  const routine = loadRoutine();
  const timeZone = cfg.timezone;
  const todayParts = zonedParts(moment, timeZone);
  const yesterday = addCalendarDays(todayParts.year, todayParts.month, todayParts.day, -1);
  const tomorrow = addCalendarDays(todayParts.year, todayParts.month, todayParts.day, 1);

  let current: EnrichedBlock | null = null;
  const upcoming: EnrichedBlock[] = [];

  for (const day of [yesterday, todayParts, tomorrow]) {
    const key = dayKeyForParts(day.year, day.month, day.day);
    const daySpec = routine.days[key];
    for (const raw of daySpec.blocks) {
      const { startDt, endDt } = blockWindow(
        day.year,
        day.month,
        day.day,
        raw.start,
        raw.end,
        timeZone,
      );
      const enriched = enrichBlock(
        raw,
        day.year,
        day.month,
        day.day,
        timeZone,
        moment,
      );
      enriched.day = key;
      enriched.date = `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
      if (startDt.getTime() <= moment.getTime() && moment.getTime() < endDt.getTime()) {
        current = enriched;
      } else if (startDt.getTime() > moment.getTime()) {
        upcoming.push(enriched);
      }
    }
  }

  upcoming.sort((a, b) => a.start_iso.localeCompare(b.start_iso));
  const dayKey = dayKeyForParts(todayParts.year, todayParts.month, todayParts.day);
  const daySpec = routine.days[dayKey];

  return {
    now: toIsoWithOffset(moment, timeZone),
    timezone: timeZone,
    day_key: dayKey,
    day_label: daySpec.label,
    day_kind: daySpec.kind,
    day_summary: daySpec.summary,
    current,
    next: upcoming[0] ?? null,
    upcoming: upcoming.slice(0, 6),
    today: iterBlocksForDay(
      routine,
      todayParts.year,
      todayParts.month,
      todayParts.day,
      timeZone,
    ),
    phase: phaseFor(cfg.planStart, todayParts.year, todayParts.month, routine),
    non_negotiables: routine.non_negotiables || [],
    dsa_explain_flow: routine.dsa_explain_flow || [],
    weekly_hours: routine.weekly_hours || {},
  };
}
