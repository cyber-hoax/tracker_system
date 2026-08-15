"use server";

import { revalidatePath } from "next/cache";
import { setSetting } from "@/lib/app-settings";
import { LEETCODE_USERNAME_KEY } from "@/lib/leetcode/config";
import { syncLeetCodeSubmissions } from "@/lib/leetcode";
import type { LeetCodeSyncReport } from "@/lib/leetcode/types";

function revalidateLeetCode() {
  revalidatePath("/dsa");
  revalidatePath("/dsa/[slug]", "page");
  revalidatePath("/patterns");
  revalidatePath("/patterns/[slug]", "page");
  revalidatePath("/settings");
}

export async function saveLeetCodeUsernameAction(
  formData: FormData,
): Promise<void> {
  const value = formData.get("username");
  const username = typeof value === "string" ? value.trim() : "";
  setSetting(LEETCODE_USERNAME_KEY, username);
  revalidatePath("/settings");
}

export async function syncLeetCodeNowAction(): Promise<LeetCodeSyncReport> {
  const result = await syncLeetCodeSubmissions();
  revalidateLeetCode();
  return result;
}
