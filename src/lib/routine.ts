import { readFileSync } from "node:fs";
import { loadConfig } from "./config";
import type { Routine } from "./types";

export function loadRoutine(): Routine {
  const { routinePath } = loadConfig();
  const parsed = JSON.parse(readFileSync(routinePath, "utf8")) as Routine;
  if (!parsed?.days) {
    throw new Error(`Invalid routine file: ${routinePath}`);
  }
  return parsed;
}
