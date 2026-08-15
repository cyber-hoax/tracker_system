import { Credential, LeetCode } from "leetcode-query";
import {
  FIRST_RUN_LIMIT,
  hasLeetCodeSession,
  leetcodeSessionCookie,
  SUBMISSION_PAGE_SIZE,
} from "./config";
import type { LeetCodeProblemMeta, LeetCodeSubmission } from "./types";

const problemCache = new Map<string, LeetCodeProblemMeta>();

let clientPromise: Promise<LeetCode> | null = null;

export async function getLeetCodeClient(): Promise<LeetCode> {
  if (!clientPromise) {
    clientPromise = createClient();
  }
  return clientPromise;
}

export async function fetchSubmissionsSince(
  sinceMs: number | null,
): Promise<LeetCodeSubmission[]> {
  const lc = await getLeetCodeClient();
  const out: LeetCodeSubmission[] = [];
  const cap = sinceMs == null ? FIRST_RUN_LIMIT : Number.POSITIVE_INFINITY;
  let offset = 0;

  while (out.length < cap) {
    const batch = await lc.submissions({
      limit: SUBMISSION_PAGE_SIZE,
      offset,
    });
    if (batch.length === 0) break;

    let reachedCursor = false;
    for (const row of batch) {
      const timestamp = normalizeTimestamp(row.timestamp);
      if (sinceMs != null && timestamp <= sinceMs) {
        reachedCursor = true;
        break;
      }
      out.push({
        id: row.id,
        title: row.title,
        titleSlug: row.titleSlug,
        timestamp,
        statusDisplay: row.statusDisplay,
        lang: row.lang,
      });
      if (out.length >= cap) break;
    }

    if (reachedCursor || batch.length < SUBMISSION_PAGE_SIZE) break;
    offset += SUBMISSION_PAGE_SIZE;
  }

  return out;
}

export async function fillSubmissionCode(
  submission: LeetCodeSubmission,
): Promise<LeetCodeSubmission> {
  if (submission.code?.trim()) return submission;
  const lc = await getLeetCodeClient();
  const detail = await lc.submission(Number(submission.id));
  return {
    ...submission,
    code: detail?.code || submission.code,
    lang: detail?.lang?.name || submission.lang,
    timestamp: detail?.timestamp
      ? normalizeTimestamp(detail.timestamp)
      : submission.timestamp,
  };
}

export async function fetchProblemMeta(
  titleSlug: string,
): Promise<LeetCodeProblemMeta | undefined> {
  const slug = titleSlug.trim();
  if (!slug) return undefined;
  const cached = problemCache.get(slug);
  if (cached) return cached;

  const lc = await getLeetCodeClient();
  const question = await lc.problem(slug);
  if (!question?.title) return undefined;
  const meta: LeetCodeProblemMeta = {
    title: question.title,
    titleSlug: question.titleSlug || slug,
    difficulty: question.difficulty,
    topicTags: (question.topicTags ?? []).map((tag) => ({
      name: tag.name,
      slug: tag.slug,
    })),
    content: question.content || "",
  };
  problemCache.set(slug, meta);
  return meta;
}

export async function fetchSignedInUsername(): Promise<string> {
  if (!hasLeetCodeSession()) return "";
  const lc = await getLeetCodeClient();
  const me = await lc.whoami();
  return me?.username?.trim() || "";
}

async function createClient(): Promise<LeetCode> {
  const session = leetcodeSessionCookie();
  if (!session) {
    throw new Error("LEETCODE_SESSION is not set");
  }
  const credential = new Credential();
  await credential.init(session);
  const csrf = process.env.LEETCODE_CSRF?.trim();
  if (csrf) credential.csrf = csrf;
  return new LeetCode(credential);
}

function normalizeTimestamp(value: number): number {
  return value < 1e12 ? value * 1000 : value;
}
