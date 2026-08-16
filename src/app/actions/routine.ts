"use server";

import { revalidatePath } from "next/cache";
import { saveRoutine } from "@/lib/routine";
import type { Routine } from "@/lib/types";

export async function saveRoutineAction(input: {
  name: string;
  routine: Routine;
}): Promise<{ ok: true; name: string; updatedAt: string }> {
  const saved = await saveRoutine(input.name, input.routine);
  revalidatePath("/");
  revalidatePath("/routine");
  revalidatePath("/reports");
  return {
    ok: true,
    name: saved.name,
    updatedAt: saved.updatedAt.toISOString(),
  };
}
