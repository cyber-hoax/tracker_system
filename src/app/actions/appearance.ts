"use server";

import { revalidatePath } from "next/cache";
import { parseAppearance, type AppearanceSettings } from "@/lib/appearance";
import { loadAppearance, saveAppearance, setAppName } from "@/lib/appearance-store";

export async function updateAppNameAction(name: string) {
  setAppName(name);
  revalidatePath("/", "layout");
}

export async function updateAppearanceAction(patch: Partial<AppearanceSettings>) {
  const current = loadAppearance();
  saveAppearance(parseAppearance({ ...current, ...patch, markdown: { ...current.markdown, ...patch.markdown } }));
  revalidatePath("/", "layout");
}
