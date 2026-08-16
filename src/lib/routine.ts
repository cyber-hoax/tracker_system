import { existsSync, readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { routines } from "@/db/schema";
import { loadConfig } from "./config";
import { emptyRoutine, normalizeRoutine } from "./routine-model";
import type { Routine } from "./types";

export type StoredRoutine = {
  id: string;
  name: string;
  payload: Routine;
  updatedAt: Date;
};

export {
  emptyRoutine,
  emptyRoutineDay,
  normalizeHm,
  normalizeRoutine,
} from "./routine-model";

function readRoutineFile(): Routine | null {
  const { routinePath } = loadConfig();
  if (!existsSync(routinePath)) return null;
  try {
    return normalizeRoutine(JSON.parse(readFileSync(routinePath, "utf8")));
  } catch {
    return null;
  }
}

export async function loadRoutineRecord(): Promise<StoredRoutine> {
  const existing = await db.select().from(routines).limit(1);
  if (existing[0]) {
    return {
      id: existing[0].id,
      name: existing[0].name,
      payload: normalizeRoutine(existing[0].payload),
      updatedAt: existing[0].updatedAt,
    };
  }

  const seeded = readRoutineFile() ?? emptyRoutine();
  const name = seeded.calendar_name?.trim() || "Weekly routine";
  const [inserted] = await db
    .insert(routines)
    .values({ name, payload: seeded })
    .returning();
  return {
    id: inserted.id,
    name: inserted.name,
    payload: seeded,
    updatedAt: inserted.updatedAt,
  };
}

export async function loadRoutine(): Promise<Routine> {
  return (await loadRoutineRecord()).payload;
}

export async function saveRoutine(name: string, payload: unknown): Promise<StoredRoutine> {
  const trimmedName = name.trim() || "Weekly routine";
  const normalized = normalizeRoutine(payload);
  normalized.calendar_name = normalized.calendar_name || trimmedName;
  const existing = await db.select({ id: routines.id }).from(routines).limit(1);
  const now = new Date();
  const row = existing[0]
    ? (
        await db
          .update(routines)
          .set({ name: trimmedName, payload: normalized, updatedAt: now })
          .where(eq(routines.id, existing[0].id))
          .returning()
      )[0]
    : (
        await db
          .insert(routines)
          .values({ name: trimmedName, payload: normalized, updatedAt: now })
          .returning()
      )[0];

  return {
    id: row.id,
    name: row.name,
    payload: normalized,
    updatedAt: row.updatedAt,
  };
}
