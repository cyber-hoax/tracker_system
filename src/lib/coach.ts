import { statsForWeek } from "./progress";
import { currentAndNext } from "./schedule";
import { formatHm12, formatHmRange } from "./timezone";
import type { Briefing, ScheduleSnapshot, WeekStats } from "./types";

const KIND_COACHING: Record<string, string> = {
  maintenance:
    "This is maintenance time, not study time. Keep it short and predictable.",
  work: "Work block. The learning plan starts after work, not during it.",
  break: "Protect the break. The routine is built around recovery between focus blocks.",
  meal: "If dinner moves, move the walk and the next study block with it. Do not compress.",
  walk: "Keep the 20-minute walk. It is a non-negotiable, not leftover time.",
  reading: "Thirty minutes of reading. Do not convert this into another technical session.",
  shutdown: "Close the day. Prepare tomorrow, then sleep. Do not bargain for extra study.",
  personal: "Protected personal time. Long-term consistency beats maximizing today.",
  free: "Free time is part of the plan. Use some of Sunday evening for the weekly review.",
  buffer: "Transition time. No need to fill it with a problem.",
  study: "Stay on the assigned subject. Depth over extra hours.",
};

function subjectLine(snapshot: ScheduleSnapshot, stats: WeekStats): string {
  const current = snapshot.current || { subject: "", kind: "" };
  const subject = current.subject;
  const topics = snapshot.phase.topics || [];
  if (subject === "dsa") {
    const solved = stats.dsa_problems_total || 0;
    const topic = topics.length ? topics[solved % topics.length] : "pattern practice";
    const flow = (snapshot.dsa_explain_flow || []).join(" → ");
    if (snapshot.day_kind === "weekend_review") {
      return `Timed DSA mock. Do not look up the pattern immediately. Target topic family: ${topic}. After each problem, explain: ${flow}.`;
    }
    return `DSA focus: ${topic}. One serious problem plus review, not two rushed ones. Explain: ${flow}.`;
  }
  if (subject === "lld") {
    return "LLD: finish a complete design slice. Name interfaces, composition vs inheritance, and what change would require the smallest modification.";
  }
  if (subject === "hld") {
    return "HLD: go past Client → API → Service → DB. Answer why this design instead of another, including failure modes and operational complexity.";
  }
  if (subject === "ai") {
    return "AI internals, not wrappers. Continue the current project slice: data flow from tokens to embeddings to attention to logits to sampling — then implement one piece.";
  }
  if (subject === "review") {
    return "Capture the weekly review before the week disappears: DSA, LLD, HLD, AI, sleep, walks, reading, energy.";
  }
  if (subject === "walk") {
    return "Twenty minutes outside. This is the transition, not optional overflow.";
  }
  if (subject === "reading") {
    return "Read for thirty minutes. Leave technical study alone.";
  }
  if (current.kind === "free" && snapshot.day_kind !== "weekend_review") {
    return "Evening is free. Keep dinner, the walk, and reading — do not add extra study by default.";
  }
  return KIND_COACHING[current.kind || "buffer"] || "Follow the current block.";
}

function habitNudge(snapshot: ScheduleSnapshot, stats: WeekStats): string[] {
  const nudges: string[] = [];
  if (snapshot.day_kind === "deep_work") {
    nudges.push(
      "Thursday is the highest-value weekday. Use focused blocks with breaks — not a five-hour grind.",
    );
  }
  if (snapshot.day_kind === "weekend_focus") {
    nudges.push(
      "Saturday target is 4–5 focused hours: 2h DSA, 1.5h LLD, 1.5h AI. Evening stays free.",
    );
  }
  if (snapshot.day_kind === "weekend_review") {
    if (!stats.review) {
      nudges.push("Sunday includes the weekly review. Fill it before the night ends.");
    }
    nudges.push("Keep recovery after 5:30 PM. Mocks already happened.");
  }
  const walkDays = stats.walk_days || 0;
  const readingDays = stats.reading_days || 0;
  if (walkDays < 5) {
    nudges.push(`Walks logged this week: ${walkDays}. Keep the daily 20-minute walk.`);
  }
  if (readingDays < 5) {
    nudges.push(`Reading days this week: ${readingDays}. Keep the 30-minute book block.`);
  }
  const hours = Math.round(((stats.study_minutes_week || 0) / 60) * 10) / 10;
  nudges.push(`Focused study logged this week: ${hours}h. Weekly target is about 20h, not more.`);
  return nudges.slice(0, 5);
}

export async function buildBriefing(moment = new Date()): Promise<Briefing> {
  const snapshot = currentAndNext(moment);
  const stats = await statsForWeek(new Date(snapshot.now));
  const current = snapshot.current;
  const next = snapshot.next;

  let headline: string;
  let guidance: string[];
  if (current) {
    headline = `Now: ${current.title} (${formatHmRange(current.start, current.end)})`;
    const remainingLine =
      current.remaining_min !== null
        ? `${current.remaining_min} minutes left in this block.`
        : "";
    guidance = [current.guide || "", remainingLine, subjectLine(snapshot, stats)];
  } else {
    headline = "Between blocks";
    let remainingLine = "Nothing is scheduled right now.";
    if (next) remainingLine = `Next is ${next.title} at ${formatHm12(next.start)}.`;
    guidance = [remainingLine, snapshot.day_summary || ""];
  }

  return {
    ...snapshot,
    headline,
    guidance: [...guidance.filter(Boolean), ...habitNudge(snapshot, stats)],
    stats,
    restart_note:
      "Opened after login. Follow the current block. Do not try to catch up missed morning study — the plan never scheduled technical work before the evening.",
  };
}
