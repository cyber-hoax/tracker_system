export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partMap(date: Date, timeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partMap(date, timeZone);
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatYmd(parts: Pick<ZonedParts, "year" | "month" | "day">): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function pythonWeekday(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (jsDay + 6) % 7;
}

export function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): Pick<ZonedParts, "year" | "month" | "day"> {
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function isoWeekNumber(year: number, month: number, day: number): number {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

export function zonedWallToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const first = new Date(guess - timeZoneOffsetMs(new Date(guess), timeZone));
  return new Date(guess - timeZoneOffsetMs(first, timeZone));
}

export function parseHm(value: string): { hour: number; minute: number } {
  const [hourRaw, minuteRaw] = value.split(":");
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (hour === 24) hour = 0;
  return { hour, minute };
}

export function toIsoWithOffset(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  const offsetMin = Math.round(timeZoneOffsetMs(date, timeZone) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${formatYmd(parts)}T${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export function ymdInZone(date: Date, timeZone: string): string {
  return formatYmd(zonedParts(date, timeZone));
}

export function formatHm12(value: string): string {
  const { hour, minute } = parseHm(value);
  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${pad2(minute)} ${period}`;
}

export function formatHmRange(start: string, end: string): string {
  return `${formatHm12(start)}–${formatHm12(end)}`;
}

export function formatClock12(
  timeZone: string,
  instant = new Date(),
): { heading: string; time: string } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const period = (parts.dayPeriod || "").replace(/\./g, "").toUpperCase();
  return {
    heading: `${parts.weekday} ${parts.day} ${parts.month}`,
    time: `${parts.hour}:${parts.minute} ${period}`.trim(),
  };
}

export function formatDateTime12(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const period = (parts.dayPeriod || "").replace(/\./g, "").toUpperCase();
  return `${parts.month} ${parts.day}, ${parts.year}, ${parts.hour}:${parts.minute} ${period}`.trim();
}
