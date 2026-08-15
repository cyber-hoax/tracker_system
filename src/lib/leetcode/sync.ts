import { getSetting, setSetting } from "@/lib/app-settings";
import { listPatternTitles } from "@/lib/zettel";
import {
  fetchProblemMeta,
  fetchSignedInUsername,
  fetchSubmissionsSince,
  fillSubmissionCode,
} from "./client";
import {
  LAST_LEETCODE_SUBMISSION_TS_KEY,
  LAST_LEETCODE_SYNC_KEY,
  LEETCODE_USERNAME_KEY,
  hasLeetCodeSession,
  leetcodeUsername,
} from "./config";
import { upsertProblemFromSubmissions } from "./persist";
import type { LeetCodeProblemMeta, LeetCodeSubmission, LeetCodeSyncReport } from "./types";

let apiSync: Promise<LeetCodeSyncReport> | null = null;

export async function syncLeetCodeSubmissions(
  incoming?: LeetCodeSubmission[],
  problemBySlug?: Record<string, LeetCodeProblemMeta>,
): Promise<LeetCodeSyncReport> {
  if (incoming) {
    return runLeetCodeSync(incoming, problemBySlug);
  }
  if (apiSync) return apiSync;
  apiSync = runLeetCodeSync(undefined, problemBySlug).finally(() => {
    apiSync = null;
  });
  return apiSync;
}

async function runLeetCodeSync(
  incoming?: LeetCodeSubmission[],
  problemBySlug?: Record<string, LeetCodeProblemMeta>,
): Promise<LeetCodeSyncReport> {
  const started = new Date().toISOString();
  if (!hasLeetCodeSession() && !incoming) {
    return emptyReport(
      started,
      false,
      "Set LEETCODE_SESSION in .env.local to sync submissions.",
    );
  }

  try {
    await maybeFillUsername();
    const submissions = incoming ?? (await loadNewSubmissions());
    if (submissions.length === 0) {
      setSetting(LAST_LEETCODE_SYNC_KEY, started);
      return {
        ok: true,
        configured: true,
        ingested: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        lastSyncAt: started,
        lastSubmissionAt: storedSubmissionIso(),
        message: "No new LeetCode submissions.",
      };
    }

    const knownPatterns = await listPatternTitles();
    const grouped = groupBySlug(submissions);
    let created = 0;
    let updated = 0;
    let ingested = 0;
    const errors: string[] = [];

    for (const [slug, rows] of grouped) {
      try {
        const withCode = await Promise.all(
          rows.map(async (row) => {
            if (row.code?.trim() || !hasLeetCodeSession()) return row;
            try {
              return await fillSubmissionCode(row);
            } catch {
              return row;
            }
          }),
        );
        const problem =
          problemBySlug?.[slug] ||
          (slug && hasLeetCodeSession()
            ? await fetchProblemMeta(slug).catch(() => undefined)
            : undefined);
        const result = await upsertProblemFromSubmissions({
          submissions: withCode,
          problem,
          knownPatterns,
        });
        if (!result) {
          continue;
        }
        ingested += withCode.length;
        if (result.created) created += 1;
        else updated += 1;
      } catch (error) {
        errors.push(
          `${slug || rows[0]?.title}: ${
            error instanceof Error ? error.message : "sync failed"
          }`,
        );
      }
    }

    const maxTs = Math.max(...submissions.map((row) => row.timestamp));
    if (Number.isFinite(maxTs)) {
      const previous = Number(getSetting(LAST_LEETCODE_SUBMISSION_TS_KEY) || "0");
      setSetting(
        LAST_LEETCODE_SUBMISSION_TS_KEY,
        String(Math.max(previous, maxTs)),
      );
    }
    setSetting(LAST_LEETCODE_SYNC_KEY, started);

    return {
      ok: errors.length === 0,
      configured: true,
      ingested,
      created,
      updated,
      skipped: 0,
      errors,
      lastSyncAt: started,
      lastSubmissionAt: storedSubmissionIso(),
      message:
        errors.length === 0
          ? `Synced ${ingested} submission${ingested === 1 ? "" : "s"} (${created} new notes, ${updated} updated).`
          : `Synced with ${errors.length} error${errors.length === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LeetCode sync failed";
    setSetting(LAST_LEETCODE_SYNC_KEY, started);
    return {
      ok: false,
      configured: true,
      ingested: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [message],
      lastSyncAt: started,
      lastSubmissionAt: storedSubmissionIso(),
      message,
    };
  }
}

async function loadNewSubmissions(): Promise<LeetCodeSubmission[]> {
  const cursorRaw = getSetting(LAST_LEETCODE_SUBMISSION_TS_KEY);
  const sinceMs = cursorRaw ? Number(cursorRaw) : null;
  const since = sinceMs && Number.isFinite(sinceMs) ? sinceMs : null;
  return fetchSubmissionsSince(since);
}

async function maybeFillUsername(): Promise<void> {
  if (leetcodeUsername()) return;
  try {
    const username = await fetchSignedInUsername();
    if (username) setSetting(LEETCODE_USERNAME_KEY, username);
  } catch {
    // Session can still list submissions without a stored username.
  }
}

function groupBySlug(rows: LeetCodeSubmission[]): Map<string, LeetCodeSubmission[]> {
  const grouped = new Map<string, LeetCodeSubmission[]>();
  for (const row of rows) {
    const key = row.titleSlug || row.title;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  return grouped;
}

function storedSubmissionIso(): string | null {
  const raw = getSetting(LAST_LEETCODE_SUBMISSION_TS_KEY);
  if (!raw) return null;
  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

function emptyReport(
  started: string,
  configured: boolean,
  message: string,
): LeetCodeSyncReport {
  return {
    ok: configured,
    configured,
    ingested: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: configured ? [] : [message],
    lastSyncAt: getSetting(LAST_LEETCODE_SYNC_KEY) || started,
    lastSubmissionAt: storedSubmissionIso(),
    message,
  };
}
