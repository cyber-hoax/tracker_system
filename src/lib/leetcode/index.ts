import { getSetting } from "@/lib/app-settings";
import {
  LAST_LEETCODE_SUBMISSION_TS_KEY,
  LAST_LEETCODE_SYNC_KEY,
  hasLeetCodeSession,
  leetcodeUsername,
} from "./config";
import { getLeetCodePollStatus } from "./poll";
import type { LeetCodeSettingsView } from "./types";

export function getLeetCodeSettingsView(): LeetCodeSettingsView {
  const lastSubmissionRaw = getSetting(LAST_LEETCODE_SUBMISSION_TS_KEY);
  const lastSubmissionMs = Number(lastSubmissionRaw);
  return {
    username: leetcodeUsername(),
    hasSession: hasLeetCodeSession(),
    lastSyncAt: getSetting(LAST_LEETCODE_SYNC_KEY) || null,
    lastSubmissionAt:
      lastSubmissionRaw && Number.isFinite(lastSubmissionMs) && lastSubmissionMs > 0
        ? new Date(lastSubmissionMs).toISOString()
        : null,
    poll: getLeetCodePollStatus(),
  };
}

export { syncLeetCodeSubmissions } from "./sync";
export { startLeetCodePoll, getLeetCodePollStatus } from "./poll";
export { upsertProblemFromSubmissions } from "./persist";
export {
  appendSubmissionBlocks,
  mapSubmissionsToProperties,
} from "./map";
