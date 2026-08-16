import { loadConfig } from "./config";
import {
  DAY_KEYS,
  DAY_LABELS,
  type DayKey,
  type Routine,
  type RoutineBlock,
  type RoutineDay,
} from "./types";

const HM = /^(?:[01]\d|2[0-3]|24):[0-5]\d(?::[0-5]\d)?$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

export function normalizeHm(value: string): string {
  const trimmed = value.trim();
  if (!HM.test(trimmed)) {
    throw new Error(`Invalid time "${value}". Use HH:MM.`);
  }
  const hhmm = trimmed.slice(0, 5);
  return hhmm === "24:00" ? "00:00" : hhmm;
}

export function emptyRoutineDay(key: DayKey): RoutineDay {
  return {
    label: DAY_LABELS[key],
    kind: key === "sat" ? "weekend_focus" : key === "sun" ? "weekend_review" : "office",
    summary: "",
    blocks: [],
  };
}

export function emptyRoutine(): Routine {
  const cfg = loadConfig();
  return {
    timezone: cfg.timezone,
    calendar_name: cfg.calendarName,
    goal: "",
    days: Object.fromEntries(DAY_KEYS.map((key) => [key, emptyRoutineDay(key)])),
  };
}

function normalizeBlock(value: unknown, index: number): RoutineBlock {
  const record = asRecord(value);
  if (!record) throw new Error(`Block ${index + 1} is invalid.`);
  const title = asString(record.title).trim();
  if (!title) throw new Error(`Block ${index + 1} needs a title.`);
  const guide = asString(record.guide).trim();
  return {
    start: normalizeHm(asString(record.start)),
    end: normalizeHm(asString(record.end)),
    title,
    kind: asString(record.kind, "study").trim() || "study",
    subject: asString(record.subject, "none").trim() || "none",
    ...(guide ? { guide } : {}),
  };
}

function normalizeDay(key: DayKey, value: unknown): RoutineDay {
  const record = asRecord(value);
  const fallback = emptyRoutineDay(key);
  if (!record) return fallback;
  const blocksRaw = Array.isArray(record.blocks) ? record.blocks : [];
  return {
    label: asString(record.label, fallback.label).trim() || fallback.label,
    kind: asString(record.kind, fallback.kind).trim() || fallback.kind,
    summary: asString(record.summary),
    blocks: blocksRaw.map((block, index) => normalizeBlock(block, index)),
  };
}

export function normalizeRoutine(value: unknown): Routine {
  const record = asRecord(value);
  if (!record) throw new Error("Routine payload is invalid.");
  const cfg = loadConfig();
  const daysRaw = asRecord(record.days) ?? {};
  const weeklyHours = asRecord(record.weekly_hours);
  const weekly: Record<string, string> = {};
  if (weeklyHours) {
    for (const [key, hours] of Object.entries(weeklyHours)) {
      if (typeof hours === "string" && hours.trim()) weekly[key] = hours.trim();
    }
  }
  const phases = Array.isArray(record.phases)
    ? record.phases.filter((phase) => asRecord(phase))
    : undefined;

  return {
    timezone: asString(record.timezone, cfg.timezone) || cfg.timezone,
    calendar_name: asString(record.calendar_name, cfg.calendarName) || cfg.calendarName,
    goal: asString(record.goal),
    non_negotiables: asStringArray(record.non_negotiables),
    phases: phases as Routine["phases"],
    dsa_explain_flow: asStringArray(record.dsa_explain_flow),
    weekly_hours: Object.keys(weekly).length ? weekly : undefined,
    days: Object.fromEntries(
      DAY_KEYS.map((key) => [key, normalizeDay(key, daysRaw[key])]),
    ),
  };
}
