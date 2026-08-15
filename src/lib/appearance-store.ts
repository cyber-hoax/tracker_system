import "server-only";

import { getSetting, setSetting } from "@/lib/app-settings";
import {
  DEFAULT_APP_NAME,
  defaultAppearance,
  parseAppearance,
  type AppearanceSettings,
} from "@/lib/appearance";

export function getAppName(): string {
  return getSetting("app_name").trim() || DEFAULT_APP_NAME;
}

export function setAppName(name: string): void {
  const trimmed = name.trim() || DEFAULT_APP_NAME;
  setSetting("app_name", trimmed);
}

export function loadAppearance(): AppearanceSettings {
  const raw = getSetting("appearance");
  if (!raw) return defaultAppearance();
  try {
    return parseAppearance(JSON.parse(raw) as unknown);
  } catch {
    return defaultAppearance();
  }
}

export function saveAppearance(appearance: AppearanceSettings): void {
  setSetting("appearance", JSON.stringify(parseAppearance(appearance)));
}
