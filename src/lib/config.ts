import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type AppConfig = {
  timezone: string;
  calendarName: string;
  planStart: string;
  routinePath: string;
  host: string;
  port: number;
  openOnLogin: boolean;
};

function parseSimpleYaml(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

export function loadConfig(): AppConfig {
  const repoRoot = process.cwd();
  const routinePath = path.join(repoRoot, "data", "routine.json");
  const configPath = path.join(repoRoot, "config.yaml");
  const raw = existsSync(configPath)
    ? parseSimpleYaml(readFileSync(configPath, "utf8"))
    : {};

  const portRaw = process.env.TRACKER_PORT || raw.port || "8765";
  const openRaw = (raw.open_on_login || "false").toLowerCase();

  return {
    timezone: process.env.TRACKER_TIMEZONE || raw.timezone || "Asia/Kolkata",
    calendarName: raw.calendar_name || "SDE Prep",
    planStart:
      process.env.PLAN_START ||
      raw.plan_start ||
      new Date().toISOString().slice(0, 10),
    routinePath,
    host: process.env.TRACKER_HOST || raw.host || "127.0.0.1",
    port: Number.parseInt(portRaw, 10) || 8765,
    openOnLogin: !["false", "0", "no"].includes(openRaw),
  };
}
