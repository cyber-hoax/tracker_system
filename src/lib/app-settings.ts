import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { settingsPath } from "./paths";

export type AppSettings = Record<string, string>;

export function getSetting(key: string): string {
  return loadSettings()[key] || "";
}

export function setSetting(key: string, value: string): void {
  const settings = loadSettings();
  settings[key] = value;
  writeFileSync(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function loadSettings(): AppSettings {
  const path = settingsPath();
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: AppSettings = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}
