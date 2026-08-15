import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getSetting, setSetting } from "./app-settings";
import { loadConfig } from "./config";
import { icsPath } from "./paths";
import { loadRoutine } from "./routine";
import { DAY_KEYS, blockWindow } from "./schedule";
import {
  addCalendarDays,
  pad2,
  pythonWeekday,
  zonedParts,
} from "./timezone";
import type { Routine, RoutineBlock } from "./types";

const execFileAsync = promisify(execFile);

const BYDAY: Record<(typeof DAY_KEYS)[number], string> = {
  mon: "MO",
  tue: "TU",
  wed: "WE",
  thu: "TH",
  fri: "FR",
  sat: "SA",
  sun: "SU",
};

const SKIP_KINDS = new Set(["work", "buffer"]);

export type GroupedCalendarEvent = {
  start: string;
  end: string;
  title: string;
  guide: string;
  kind: string;
  days: string[];
};

export type CalendarSyncResult = {
  ok: boolean;
  method: "calendar_app" | "ics" | "ics_open";
  ics_path: string;
  event_count: number;
  calendar_name: string;
  error: string;
  last_sync: string;
};

function fold(line: string): string {
  if (line.length <= 73) return line;
  const chunks = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest) {
    chunks.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  return chunks.join("\r\n");
}

function icsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function parsePlanStart(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function nextWeekdayOnOrAfter(
  start: { year: number; month: number; day: number },
  dayKey: string,
): { year: number; month: number; day: number } {
  const target = DAY_KEYS.indexOf(dayKey as (typeof DAY_KEYS)[number]);
  const weekday = pythonWeekday(start.year, start.month, start.day);
  const delta = ((target - weekday) % 7 + 7) % 7;
  return addCalendarDays(start.year, start.month, start.day, delta);
}

export function groupedEvents(routine: Routine): GroupedCalendarEvent[] {
  const groups = new Map<string, GroupedCalendarEvent>();
  for (const dayKey of DAY_KEYS) {
    const spec = routine.days[dayKey];
    if (!spec) continue;
    for (const block of spec.blocks as RoutineBlock[]) {
      if (SKIP_KINDS.has(block.kind)) continue;
      if (block.kind === "free" && (block.subject || "none") === "none") continue;
      const key = `${block.start}|${block.end}|${block.title}`;
      const item = groups.get(key);
      if (item) {
        item.days.push(dayKey);
        continue;
      }
      groups.set(key, {
        start: block.start,
        end: block.end,
        title: block.title,
        guide: block.guide || "",
        kind: block.kind || "study",
        days: [dayKey],
      });
    }
  }
  return [...groups.values()].sort((a, b) => {
    const startCmp = a.start.localeCompare(b.start);
    return startCmp !== 0 ? startCmp : a.title.localeCompare(b.title);
  });
}

function dtstamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsLocalStamp(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}${pad2(parts.month)}${pad2(parts.day)}T${pad2(parts.hour)}${pad2(parts.minute)}${pad2(parts.second)}`;
}

function localIsoSeconds(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}

export function buildIcs(): string {
  const cfg = loadConfig();
  const routine = loadRoutine();
  const events = groupedEvents(routine);
  const planStart = parsePlanStart(cfg.planStart);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SDE Routine Tracker//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${cfg.calendarName}`,
    `X-WR-TIMEZONE:${cfg.timezone}`,
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Kolkata",
    "X-LIC-LOCATION:Asia/Kolkata",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0530",
    "TZOFFSETTO:+0530",
    "TZNAME:IST",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  events.forEach((event, index) => {
    const firstDay = event.days[0];
    const startDate = nextWeekdayOnOrAfter(planStart, firstDay);
    const { startDt, endDt } = blockWindow(
      startDate.year,
      startDate.month,
      startDate.day,
      event.start,
      event.end,
      cfg.timezone,
    );
    const byday = event.days
      .map((day) => BYDAY[day as (typeof DAY_KEYS)[number]])
      .join(",");
    const uid = `tracker-${event.start.replaceAll(":", "")}-${index + 1}-${byday.toLowerCase()}@sde-prep.local`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp()}`,
      `DTSTART;TZID=Asia/Kolkata:${icsLocalStamp(startDt, cfg.timezone)}`,
      `DTEND;TZID=Asia/Kolkata:${icsLocalStamp(endDt, cfg.timezone)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
      fold(`SUMMARY:${icsText(event.title)}`),
      fold(`DESCRIPTION:${icsText(event.guide)}`),
      "LOCATION:SDE prep routine",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(event.title)}`,
      "TRIGGER:PT0S",
      "END:VALARM",
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function writeIcs(): string {
  const dest = icsPath();
  writeFileSync(dest, buildIcs(), "utf8");
  return dest;
}

function applescriptEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function ensureCalendarScript(name: string): string {
  const safe = applescriptEscape(name);
  return `
tell application "Calendar"
    activate
    if not (exists calendar "${safe}") then
        create calendar with name "${safe}"
    end if
end tell
`;
}

function clearAndCreateScript(events: GroupedCalendarEvent[]): string {
  const cfg = loadConfig();
  const safeCal = applescriptEscape(cfg.calendarName);
  const planStart = parsePlanStart(cfg.planStart);
  const chunks = [
    'tell application "Calendar"',
    "    activate",
    `    if not (exists calendar "${safeCal}") then`,
    `        create calendar with name "${safeCal}"`,
    "    end if",
    `    tell calendar "${safeCal}"`,
    "        delete every event",
    "    end tell",
  ];

  for (const event of events) {
    const firstDay = event.days[0];
    const startDate = nextWeekdayOnOrAfter(planStart, firstDay);
    const { startDt, endDt } = blockWindow(
      startDate.year,
      startDate.month,
      startDate.day,
      event.start,
      event.end,
      cfg.timezone,
    );
    const startParts = zonedParts(startDt, cfg.timezone);
    const endParts = zonedParts(endDt, cfg.timezone);
    const byday = event.days
      .map((day) => BYDAY[day as (typeof DAY_KEYS)[number]])
      .join(",");
    const summary = applescriptEscape(event.title);
    const description = applescriptEscape(event.guide.slice(0, 500));
    chunks.push(
      "    set startDate to current date",
      `    set year of startDate to ${startParts.year}`,
      `    set month of startDate to ${startParts.month}`,
      `    set day of startDate to ${startParts.day}`,
      `    set hours of startDate to ${startParts.hour}`,
      `    set minutes of startDate to ${startParts.minute}`,
      "    set seconds of startDate to 0",
      "    set endDate to current date",
      `    set year of endDate to ${endParts.year}`,
      `    set month of endDate to ${endParts.month}`,
      `    set day of endDate to ${endParts.day}`,
      `    set hours of endDate to ${endParts.hour}`,
      `    set minutes of endDate to ${endParts.minute}`,
      "    set seconds of endDate to 0",
      `    tell calendar "${safeCal}"`,
      `        set ev to make new event with properties {summary:"${summary}", start date:startDate, end date:endDate, description:"${description}"}`,
      "        try",
      `            set recurrence of ev to "FREQ=WEEKLY;BYDAY=${byday}"`,
      "        end try",
      "        try",
      "            make new display alarm at end of display alarms of ev with properties {trigger interval:0}",
      "        end try",
      "    end tell",
    );
  }

  chunks.push("end tell");
  return chunks.join("\n");
}

type OsascriptResult = {
  returncode: number;
  stdout: string;
  stderr: string;
};

async function runOsascript(script: string, timeoutMs: number): Promise<OsascriptResult> {
  const dir = mkdtempSync(path.join(tmpdir(), "sde-cal-"));
  const file = path.join(dir, "sync.applescript");
  writeFileSync(file, script, "utf8");
  try {
    const { stdout, stderr } = await execFileAsync("osascript", [file], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf8",
    });
    return { returncode: 0, stdout: stdout || "", stderr: stderr || "" };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & {
      killed?: boolean;
      stdout?: string;
      stderr?: string;
      code?: number | string;
    };
    const timedOut = Boolean(err.killed) || err.code === "ETIMEDOUT";
    return {
      returncode: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout || "",
      stderr: timedOut
        ? "Calendar timed out waiting for permission or AppleScript."
        : (err.stderr || err.message || "").trim(),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function syncCalendar(openIcsFallback = true): Promise<CalendarSyncResult> {
  const cfg = loadConfig();
  const routine = loadRoutine();
  const events = groupedEvents(routine);
  const ics = writeIcs();
  let created = false;
  let method: CalendarSyncResult["method"] = "ics";
  let error = "";

  const ensure = await runOsascript(ensureCalendarScript(cfg.calendarName), 60_000);
  const create = await runOsascript(clearAndCreateScript(events), 180_000);
  if (create.returncode === 0) {
    created = true;
    method = "calendar_app";
  } else {
    error = (create.stderr || create.stdout || ensure.stderr || "").trim();
    if (openIcsFallback) {
      try {
        await execFileAsync("open", ["-a", "Calendar", ics], { timeout: 15_000 });
        method = "ics_open";
      } catch (openError) {
        const message = openError instanceof Error ? openError.message : String(openError);
        error = [error, message].filter(Boolean).join(" ");
        method = "ics";
      }
    }
  }

  setSetting("last_calendar_sync", localIsoSeconds());
  setSetting("calendar_sync_method", method);
  return {
    ok: created || method === "ics_open",
    method,
    ics_path: ics,
    event_count: events.length,
    calendar_name: cfg.calendarName,
    error,
    last_sync: getSetting("last_calendar_sync"),
  };
}
