import { getSetting } from "@/lib/app-settings";

export const LEETCODE_USERNAME_KEY = "leetcode_username";
export const LAST_LEETCODE_SYNC_KEY = "last_leetcode_sync";
export const LAST_LEETCODE_SUBMISSION_TS_KEY = "last_leetcode_submission_ts";

export const FIRST_RUN_LIMIT = 200;
export const SUBMISSION_PAGE_SIZE = 20;
export const POLL_INTERVAL_MS = 60 * 60 * 1000;

export function leetcodeSessionCookie(): string {
  return process.env.LEETCODE_SESSION?.trim() || "";
}

export function hasLeetCodeSession(): boolean {
  return Boolean(leetcodeSessionCookie());
}

export function leetcodeUsername(): string {
  return (
    getSetting(LEETCODE_USERNAME_KEY).trim() ||
    process.env.LEETCODE_USERNAME?.trim() ||
    ""
  );
}
