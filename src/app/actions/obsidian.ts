"use server";

import { revalidatePath } from "next/cache";
import { syncFromObsidian, type SyncReport } from "@/lib/obsidian";

export async function syncFromObsidianAction(): Promise<SyncReport> {
  const report = await syncFromObsidian();
  revalidatePath("/dsa");
  revalidatePath("/dsa/[slug]", "page");
  revalidatePath("/patterns");
  revalidatePath("/patterns/[slug]", "page");
  revalidatePath("/settings");
  return report;
}
