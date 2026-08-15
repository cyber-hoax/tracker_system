import { NextResponse } from "next/server";
import { syncLeetCodeSubmissions } from "@/lib/leetcode";
import type { LeetCodeProblemMeta, LeetCodeSubmission } from "@/lib/leetcode/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const { submissions, problem } = parseIngestBody(body);
    if (submissions.length === 0) {
      return NextResponse.json(
        { error: "Expected a submission", detail: "Expected a submission" },
        { status: 400, headers: CORS },
      );
    }
    const problemBySlug: Record<string, LeetCodeProblemMeta> = {};
    if (problem?.titleSlug) problemBySlug[problem.titleSlug] = problem;
    if (problem?.title) problemBySlug[problem.title] = problem;
    const result = await syncLeetCodeSubmissions(submissions, problemBySlug);
    return NextResponse.json(
      { ...result, problemTitle: problem?.title },
      { headers: { "Cache-Control": "no-store", ...CORS } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: detail, detail }, { status: 500, headers: CORS });
  }
}

function parseIngestBody(body: unknown): {
  submissions: LeetCodeSubmission[];
  problem?: LeetCodeProblemMeta;
} {
  if (!body || typeof body !== "object") {
    return { submissions: [] };
  }
  const raw = body as Record<string, unknown>;
  const problem = asProblem(raw.problem) ?? asProblem(raw);
  const list = Array.isArray(raw.submissions) ? raw.submissions : [raw];
  const submissions = list
    .map((item) => asSubmission(item, problem))
    .filter((row): row is LeetCodeSubmission => row !== null);
  return { submissions, problem };
}

function asSubmission(
  value: unknown,
  problem?: LeetCodeProblemMeta,
): LeetCodeSubmission | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const title = String(raw.title || problem?.title || "").trim();
  const id = raw.id ?? raw.submissionId;
  if (!title || id == null || String(id).trim() === "") return null;
  const timestampRaw = Number(raw.timestamp ?? raw.ts ?? Date.now());
  return {
    id: typeof id === "number" || typeof id === "string" ? id : String(id),
    title,
    titleSlug: String(raw.titleSlug || raw.slug || problem?.titleSlug || ""),
    timestamp: Number.isFinite(timestampRaw) ? timestampRaw : Date.now(),
    statusDisplay: String(raw.statusDisplay || raw.status || ""),
    lang: String(raw.lang || raw.language || "text"),
    code: typeof raw.code === "string" ? raw.code : undefined,
  };
}

function asProblem(value: unknown): LeetCodeProblemMeta | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const title = String(raw.title || "").trim();
  const titleSlug = String(raw.titleSlug || raw.slug || "").trim();
  if (!title && !titleSlug) return undefined;
  const tagsRaw = raw.topicTags ?? raw.tags;
  const topicTags = Array.isArray(tagsRaw)
    ? tagsRaw.map((tag) => {
        if (typeof tag === "string") return { name: tag };
        if (tag && typeof tag === "object" && "name" in tag) {
          return { name: String((tag as { name: unknown }).name) };
        }
        return { name: String(tag) };
      })
    : undefined;
  return {
    title: title || titleSlug,
    titleSlug,
    difficulty: typeof raw.difficulty === "string" ? raw.difficulty : undefined,
    topicTags,
    content: typeof raw.content === "string" ? raw.content : undefined,
  };
}
