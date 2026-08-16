import { homedir } from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

export const LAUNCH_AGENT_LABEL = "com.cyberhoax.sde-routine-tracker";
export const SUPPORT_DIR_NAME = "SDERoutineTracker";

export function supportDir(): string {
  const dir =
    process.platform === "darwin"
      ? path.join(homedir(), "Library", "Application Support", SUPPORT_DIR_NAME)
      : path.join(homedir(), ".sde-routine-tracker");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function logDir(): string {
  const dir = path.join(homedir(), "Library", "Logs", SUPPORT_DIR_NAME);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function icsPath(): string {
  return path.join(supportDir(), "sde_prep.ics");
}

export function settingsPath(): string {
  return path.join(supportDir(), "settings.json");
}

export function launchAgentPath(): string {
  return path.join(homedir(), "Library", "LaunchAgents", `${LAUNCH_AGENT_LABEL}.plist`);
}
