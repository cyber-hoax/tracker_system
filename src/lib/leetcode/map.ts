import { addCalendarDays, formatYmd, ymdInZone } from "@/lib/timezone";
import type {
  LeetCodeProblemMeta,
  LeetCodeSubmission,
  MappedNotePatch,
  NoteAutoProperties,
} from "./types";

const DEFAULT_TZ = "Asia/Kolkata";

const GENERIC_TAGS = new Set([
  "array",
  "string",
  "math",
  "simulation",
  "design",
  "database",
  "enumeration",
  "iterator",
  "interactive",
  "concurrency",
  "shell",
  "brainteaser",
  "sorting",
  "counting",
]);

const TAG_ALIASES: Record<string, string> = {
  "dynamic programming": "dp",
  "binary search": "binary search",
  "two pointers": "two pointers",
  "sliding window": "sliding window",
  "depth-first search": "dfs",
  "breadth-first search": "bfs",
  "heap (priority queue)": "heap",
  "priority queue": "heap",
  "union find": "union find",
  "linked list": "linked list",
  "binary tree": "binary tree",
  "binary search tree": "bst",
  "bit manipulation": "bit manipulation",
  "monotonic stack": "monotonic stack",
  "prefix sum": "prefix sum",
  backtracking: "backtracking",
  greedy: "greedy",
  graph: "graph",
  trie: "trie",
  stack: "stack",
  recursion: "recursion",
};

const LANG_FENCE: Record<string, string> = {
  python: "python",
  python3: "python",
  pythondata: "python",
  cpp: "cpp",
  c: "c",
  csharp: "csharp",
  java: "java",
  javascript: "javascript",
  typescript: "typescript",
  golang: "go",
  go: "go",
  rust: "rust",
  kotlin: "kotlin",
  swift: "swift",
  ruby: "ruby",
  php: "php",
  scala: "scala",
  dart: "dart",
  mysql: "sql",
  mssql: "sql",
  oraclesql: "sql",
  postgresql: "sql",
};

const SUBMISSION_MARKER = /<!--\s*leetcode-submission:([^\s]+)\s*-->/g;

export function mapStatus(statusDisplay: string): "Solved" | "Partial" {
  return statusDisplay.trim().toLowerCase() === "accepted" ? "Solved" : "Partial";
}

export function mapDifficulty(raw?: string): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "easy" || value === "medium" || value === "hard") return value;
  return undefined;
}

export function mapPatterns(
  tags: string[],
  knownPatterns: string[] = [],
): string[] {
  const knownByNorm = new Map(
    knownPatterns.map((title) => [normalizeTag(title), title]),
  );
  const out: string[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    const mapped = mapOnePattern(tag, knownByNorm);
    if (!mapped) continue;
    const key = normalizeTag(mapped);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mapped);
  }
  return out;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function submissionInstant(timestamp: number): Date {
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  return new Date(ms);
}

export function submissionDate(timestamp: number, timeZone: string): string {
  return ymdInZone(submissionInstant(timestamp), timeZone);
}

export function nextRevisionDate(lastSolvedYmd: string): string {
  const [year, month, day] = lastSolvedYmd.split("-").map(Number);
  return formatYmd(addCalendarDays(year, month, day, 7));
}

export function fenceLanguage(lang: string): string {
  const key = lang.trim().toLowerCase();
  return LANG_FENCE[key] || key || "text";
}

export function countSubmissionMarkers(body: string): number {
  const matches = body.match(SUBMISSION_MARKER);
  return matches?.length ?? 0;
}

export function hasSubmissionMarker(
  body: string,
  id: number | string,
): boolean {
  return body.includes(`<!-- leetcode-submission:${id} -->`);
}

export function mapSubmissionsToProperties(input: {
  submissions: LeetCodeSubmission[];
  problem?: LeetCodeProblemMeta;
  knownPatterns?: string[];
  timeZone?: string;
}): MappedNotePatch {
  const timeZone = input.timeZone || DEFAULT_TZ;
  const submissions = [...input.submissions].sort(
    (a, b) =>
      submissionInstant(a.timestamp).getTime() -
      submissionInstant(b.timestamp).getTime(),
  );
  const title =
    input.problem?.title || submissions[0]?.title || "Untitled problem";
  const titleSlug =
    input.problem?.titleSlug || submissions[0]?.titleSlug || "";

  const latest = submissions[submissions.length - 1];
  const accepted = submissions.filter(
    (row) => mapStatus(row.statusDisplay) === "Solved",
  );
  const lastSolvedSource = accepted.length
    ? accepted[accepted.length - 1]
    : latest;
  const lastSolved = lastSolvedSource
    ? submissionDate(lastSolvedSource.timestamp, timeZone)
    : ymdInZone(new Date(), timeZone);

  const properties: NoteAutoProperties = {
    Status: latest ? mapStatus(latest.statusDisplay) : "Partial",
    "Last Solved Date": lastSolved,
    "Next Revision Date": nextRevisionDate(lastSolved),
    "Revision Count": submissions.length,
  };

  const difficulty = mapDifficulty(input.problem?.difficulty);
  if (difficulty) properties.Difficulty = difficulty;

  const tags = (input.problem?.topicTags ?? []).map((tag) => tag.name);
  const patterns = mapPatterns(tags, input.knownPatterns ?? []);
  if (patterns.length) properties.Pattern = patterns;

  const description = input.problem?.content
    ? htmlToPlainText(input.problem.content)
    : "";
  if (description) properties.Description = description;

  return { title, titleSlug, properties };
}

export function appendSubmissionBlocks(
  body: string,
  submissions: LeetCodeSubmission[],
  timeZone = DEFAULT_TZ,
): string {
  const ordered = [...submissions].sort(
    (a, b) =>
      submissionInstant(a.timestamp).getTime() -
      submissionInstant(b.timestamp).getTime(),
  );
  let next = body.replace(/\s*$/, "");
  for (const row of ordered) {
    if (hasSubmissionMarker(next, row.id)) continue;
    const code = row.code?.trim();
    if (!code) continue;
    const date = submissionDate(row.timestamp, timeZone);
    const lang = fenceLanguage(row.lang);
    const block = [
      `<!-- leetcode-submission:${row.id} -->`,
      "",
      `## Submission ${date} · ${row.statusDisplay}`,
      "",
      `\`\`\`${lang}`,
      code,
      "```",
    ].join("\n");
    next = next ? `${next}\n\n${block}` : block;
  }
  return next ? `${next}\n` : "";
}

function mapOnePattern(
  tag: string,
  knownByNorm: Map<string, string>,
): string | null {
  const norm = normalizeTag(tag);
  if (!norm) return null;
  const alias = TAG_ALIASES[norm] ?? norm;
  const known = knownByNorm.get(normalizeTag(alias)) ?? knownByNorm.get(norm);
  if (known) return known;
  if (GENERIC_TAGS.has(norm)) return null;
  return alias;
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
