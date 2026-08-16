"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarSyncButton } from "@/app/components/calendar-sync-button";
import {
  formatClock12,
  formatDateTime12,
  formatHm12,
  formatHmRange,
} from "@/lib/timezone";
import type { Briefing, EnrichedBlock, SessionRecord } from "@/lib/types";

type DashboardProps = {
  initialBriefing: Briefing;
  initialRecent: SessionRecord[];
};

const LOG_SUBJECTS = ["dsa", "lld", "hld", "ai", "reading", "walk", "review"] as const;


function kindAccent(kind: string, subject: string): string {
  if (subject === "dsa") return "mauve";
  if (subject === "walk" || kind === "walk") return "green";
  if (subject === "reading" || kind === "reading") return "blue";
  if (kind === "study") return "peach";
  if (kind === "meal") return "red";
  return "overlay";
}

function accentBorder(accent: string): string {
  switch (accent) {
    case "mauve":
      return "border-ctp-mauve/50";
    case "green":
      return "border-ctp-green/50";
    case "blue":
      return "border-ctp-blue/50";
    case "peach":
      return "border-ctp-peach/50";
    case "red":
      return "border-ctp-red/50";
    default:
      return "border-ctp-surface0";
  }
}

function accentMeter(accent: string): string {
  switch (accent) {
    case "mauve":
      return "bg-ctp-mauve";
    case "green":
      return "bg-ctp-green";
    case "blue":
      return "bg-ctp-blue";
    case "red":
      return "bg-ctp-red";
    default:
      return "bg-ctp-peach";
  }
}

function liveProgress(block: EnrichedBlock | null, nowMs: number) {
  if (!block) return { remaining: null as number | null, pct: 0 };
  const start = Date.parse(block.start_iso);
  const end = Date.parse(block.end_iso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { remaining: block.remaining_min, pct: block.progress_pct };
  }
  const remaining = Math.max(0, Math.floor((end - nowMs) / 60000));
  const elapsed = Math.max(0, Math.floor((nowMs - start) / 60000));
  const total = Math.max(1, Math.floor((end - start) / 60000));
  const inBlock = nowMs >= start && nowMs < end;
  return {
    remaining: inBlock ? remaining : block.remaining_min,
    pct: inBlock ? Math.min(100, Math.round((100 * elapsed) / total)) : block.progress_pct,
  };
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = (await response.json().catch(() => ({}))) as {
    detail?: string;
    error?: string;
  } & T;
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-ctp-surface0 bg-ctp-base px-3 py-2.5 text-ctp-text outline-none focus:border-ctp-mauve";
const labelClass = "mb-2.5 block text-[13px] text-ctp-overlay0";
const panelClass = "rounded-2xl border border-ctp-surface0 bg-ctp-mantle p-5";
const primaryBtn =
  "rounded-full bg-ctp-peach px-4 py-2.5 font-medium text-ctp-crust disabled:cursor-wait disabled:opacity-55";
const ghostBtn =
  "rounded-full border border-ctp-surface1 bg-transparent px-4 py-2.5 text-ctp-text";

export function Dashboard({ initialBriefing, initialRecent }: DashboardProps) {
  const [briefing, setBriefing] = useState(initialBriefing);
  const [recent, setRecent] = useState(initialRecent);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [logStatus, setLogStatus] = useState("");
  const [logError, setLogError] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewError, setReviewError] = useState(false);
  const logFormRef = useRef<HTMLFormElement>(null);
  const reviewHydrated = useRef(false);

  const clock = useMemo(
    () => formatClock12(briefing.timezone, new Date(nowMs)),
    [briefing.timezone, nowMs],
  );

  const current = briefing.current;
  const accent = kindAccent(current?.kind || "", current?.subject || "");
  const progress = liveProgress(current, nowMs);

  const refresh = useCallback(async () => {
    const [nextBriefing, sessions] = await Promise.all([
      api<Briefing>("/api/briefing"),
      api<{ recent: SessionRecord[] }>("/api/sessions"),
    ]);
    setBriefing(nextBriefing);
    setRecent(sessions.recent || []);
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    const poll = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 30000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    const logForm = logFormRef.current;
    if (logForm && current) {
    const subjectField = logForm.elements.namedItem("subject");
    const minutesField = logForm.elements.namedItem("minutes");
    if (
      subjectField instanceof HTMLSelectElement &&
      LOG_SUBJECTS.includes(current.subject as (typeof LOG_SUBJECTS)[number])
    ) {
      subjectField.value = current.subject;
    }
    if (minutesField instanceof HTMLInputElement && current.remaining_min) {
      minutesField.value = String(Math.max(5, Math.round(current.minutes / 5) * 5));
    }
    }
  }, [current]);

  useEffect(() => {
    const form = document.getElementById("review-form") as HTMLFormElement | null;
    if (!form || reviewHydrated.current || !briefing.stats.review) return;
    const review = briefing.stats.review;
    for (const key of ["dsa", "lld", "hld", "ai", "personal"] as const) {
      const field = form.elements.namedItem(key);
      if (field instanceof HTMLTextAreaElement) field.value = review[key] || "";
    }
    reviewHydrated.current = true;
  }, [briefing.stats.review]);

  async function logSession(body: {
    subject: string;
    minutes: number;
    notes?: string;
    problems_count?: number;
  }) {
    const result = await api<{ briefing: Briefing; session: SessionRecord }>(
      "/api/sessions",
      { method: "POST", body: JSON.stringify(body) },
    );
    setBriefing(result.briefing);
    await refresh();
  }

  const studyH = ((briefing.stats.study_minutes_week || 0) / 60).toFixed(1);

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ctp-overlay0">
            SDE-2 / SDE-3 routine
          </p>
          <h1 className="text-3xl font-medium tracking-tight text-ctp-text sm:text-4xl">
            {clock.heading}
          </h1>
          <p className="mt-2 text-ctp-subtext0">
            {briefing.phase.name} · {briefing.phase.mix}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-4xl tracking-tight text-ctp-mauve">{clock.time}</p>
          <p className="font-mono text-[13px] text-ctp-overlay0">{briefing.timezone}</p>
        </div>
      </div>

      <section className={`mb-5 rounded-2xl border bg-ctp-mantle p-7 ${accentBorder(accent)}`}>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ctp-overlay0">
          {briefing.day_label}
        </p>
        <h2 className="text-3xl font-medium tracking-tight sm:text-5xl">
          {current ? current.title : "Between blocks"}
        </h2>
        <p className="mt-2.5 mb-4 text-ctp-subtext0">
          {current
            ? `${formatHmRange(current.start, current.end)} · ${progress.remaining ?? "—"} min left · ${current.kind}`
            : briefing.next
              ? `Next: ${briefing.next.title} at ${formatHm12(briefing.next.start)}`
              : "No upcoming block"}
        </p>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-ctp-surface0">
          <span
            className={`block h-full ${accentMeter(accent)}`}
            style={{ width: `${current ? progress.pct : 0}%` }}
          />
        </div>
        <ul className="mb-5 list-disc space-y-2 pl-5 text-ctp-subtext1">
          {briefing.guidance.map((line, index) => (
            <li key={`${index}-${line.slice(0, 24)}`}>{line}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            className={primaryBtn}
            onClick={() => logFormRef.current?.requestSubmit()}
          >
            Log this block
          </button>
          <button
            type="button"
            className={ghostBtn}
            onClick={async () => {
              try {
                await logSession({ subject: "walk", minutes: 20, notes: "20-minute walk" });
                setLogError(false);
                setLogStatus("Walk logged.");
              } catch (error) {
                setLogError(true);
                setLogStatus(error instanceof Error ? error.message : "Request failed");
              }
            }}
          >
            Walk done
          </button>
          <button
            type="button"
            className={ghostBtn}
            onClick={async () => {
              try {
                await logSession({
                  subject: "reading",
                  minutes: 30,
                  notes: "Reading block",
                });
                setLogError(false);
                setLogStatus("Reading logged.");
              } catch (error) {
                setLogError(true);
                setLogStatus(error instanceof Error ? error.message : "Request failed");
              }
            }}
          >
            Reading done
          </button>
        </div>
      </section>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className={panelClass}>
          <h3 className="mb-4 text-xl font-medium">Today</h3>
          <ol className="m-0 list-none p-0">
            {briefing.today.map((block) => {
              const currentNow =
                Boolean(current) &&
                current?.start === block.start &&
                current?.title === block.title;
              const done = block.end_iso < briefing.now && !currentNow;
              return (
                <li
                  key={`${block.start}-${block.title}`}
                  className={`relative ml-2 grid grid-cols-[148px_1fr] gap-3 border-l-2 py-2 pl-4 ${
                    currentNow
                      ? "border-ctp-peach text-ctp-peach"
                      : "border-ctp-surface0"
                  } ${done ? "opacity-45" : ""}`}
                >
                  <span
                    className={`absolute top-3.5 -left-[5px] h-2.5 w-2.5 rounded-full ${
                      currentNow ? "bg-ctp-peach" : "bg-ctp-overlay0"
                    }`}
                  />
                  <span className="font-mono text-[13px] text-ctp-overlay0">
                    {formatHmRange(block.start, block.end)}
                  </span>
                  <span>{block.title}</span>
                </li>
              );
            })}
          </ol>
        </article>

        <article className={panelClass}>
          <h3 className="mb-4 text-xl font-medium">Week</h3>
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-ctp-base p-3">
              <b className="block font-mono text-xl">{briefing.stats.dsa_problems_total || 0}</b>
              <span className="text-xs text-ctp-overlay0">DSA problems logged</span>
            </div>
            <div className="rounded-xl bg-ctp-base p-3">
              <b className="block font-mono text-xl">{briefing.stats.dsa_problems_week || 0}</b>
              <span className="text-xs text-ctp-overlay0">DSA this week</span>
            </div>
            <div className="rounded-xl bg-ctp-base p-3">
              <b className="block font-mono text-xl">{briefing.stats.walk_days || 0}/7</b>
              <span className="text-xs text-ctp-overlay0">Walk days</span>
            </div>
            <div className="rounded-xl bg-ctp-base p-3">
              <b className="block font-mono text-xl">{studyH}h</b>
              <span className="text-xs text-ctp-overlay0">Focus hours this week</span>
            </div>
          </div>
          <p className="m-0 text-ctp-overlay0">
            {briefing.next
              ? `Up next: ${briefing.next.title} at ${formatHmRange(briefing.next.start, briefing.next.end)}`
              : "No further blocks today."}
          </p>
        </article>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className={panelClass}>
          <h3 className="mb-4 text-xl font-medium">Log progress</h3>
          <form
            id="log-form"
            ref={logFormRef}
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              try {
                await logSession({
                  subject: String(formData.get("subject") || "other"),
                  minutes: Number(formData.get("minutes") || 0),
                  problems_count: Number(formData.get("problems_count") || 0),
                  notes: String(formData.get("notes") || ""),
                });
                const notesField = form.elements.namedItem("notes");
                if (notesField instanceof HTMLTextAreaElement) notesField.value = "";
                setLogError(false);
                setLogStatus("Saved.");
              } catch (error) {
                setLogError(true);
                setLogStatus(error instanceof Error ? error.message : "Request failed");
              }
            }}
          >
            <div className="mb-3 flex flex-wrap gap-2.5">
              <label className={`${labelClass} min-w-[120px] flex-1`}>
                Subject
                <select
                  name="subject"
                  id="log-subject"
                  defaultValue={
                    current && LOG_SUBJECTS.includes(current.subject as (typeof LOG_SUBJECTS)[number])
                      ? current.subject
                      : "other"
                  }
                  className={inputClass}
                >
                  <option value="dsa">DSA</option>
                  <option value="lld">LLD</option>
                  <option value="hld">HLD</option>
                  <option value="ai">AI</option>
                  <option value="reading">Reading</option>
                  <option value="walk">Walk</option>
                  <option value="review">Weekly review</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className={`${labelClass} min-w-[120px] flex-1`}>
                Minutes
                <input
                  name="minutes"
                  type="number"
                  min={0}
                  step={5}
                  defaultValue={60}
                  className={inputClass}
                />
              </label>
              <label className={`${labelClass} min-w-[120px] flex-1`}>
                DSA problems
                <input
                  name="problems_count"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={0}
                  className={inputClass}
                />
              </label>
            </div>
            <label className={labelClass}>
              Notes
              <textarea
                name="notes"
                rows={3}
                placeholder="Problem names, patterns, what is still weak…"
                className={inputClass}
              />
            </label>
            <button type="submit" className={primaryBtn}>
              Save session
            </button>
            <p
              className={`mt-2 min-h-[1.2em] text-[13px] ${logError ? "text-ctp-red" : "text-ctp-green"}`}
            >
              {logStatus}
            </p>
          </form>
          <ul className="mt-4 list-none p-0">
            {recent.slice(0, 8).map((row) => {
              const when = formatDateTime12(new Date(row.ts), briefing.timezone);
              const extra = row.problems_count ? ` · ${row.problems_count} problems` : "";
              return (
                <li
                  key={row.id}
                  className="border-t border-ctp-surface0 py-2.5 text-sm text-ctp-subtext1"
                >
                  <span className="mr-2 inline-block font-mono text-[11px] uppercase tracking-wider text-ctp-peach">
                    {row.subject}
                  </span>
                  {when} · {row.minutes}m{extra}
                  {row.notes ? ` — ${row.notes}` : ""}
                </li>
              );
            })}
          </ul>
        </article>

        <article className={panelClass}>
          <h3 className="mb-4 text-xl font-medium">Sunday review</h3>
          <form
            id="review-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              try {
                const result = await api<{ briefing: Briefing }>("/api/reviews", {
                  method: "POST",
                  body: JSON.stringify({
                    dsa: String(formData.get("dsa") || ""),
                    lld: String(formData.get("lld") || ""),
                    hld: String(formData.get("hld") || ""),
                    ai: String(formData.get("ai") || ""),
                    personal: String(formData.get("personal") || ""),
                  }),
                });
                setBriefing(result.briefing);
                reviewHydrated.current = true;
                setReviewError(false);
                setReviewStatus("Weekly review saved.");
              } catch (error) {
                setReviewError(true);
                setReviewStatus(error instanceof Error ? error.message : "Request failed");
              }
            }}
          >
            <label className={labelClass}>
              DSA
              <textarea
                name="dsa"
                rows={2}
                placeholder="Problems solved, patterns learned, revisit list, timed performance"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              LLD
              <textarea
                name="lld"
                rows={2}
                placeholder="Design completed, patterns, implementation, weak areas"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              HLD
              <textarea
                name="hld"
                rows={2}
                placeholder="Systems designed, tradeoffs, failure scenarios"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              AI
              <textarea
                name="ai"
                rows={2}
                placeholder="Topic, implementation, first-principles vs still unclear"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Personal
              <textarea
                name="personal"
                rows={2}
                placeholder="Sleep, walks, reading, study hours, energy"
                className={inputClass}
              />
            </label>
            <button type="submit" className={primaryBtn}>
              Save weekly review
            </button>
            <p
              className={`mt-2 min-h-[1.2em] text-[13px] ${reviewError ? "text-ctp-red" : "text-ctp-green"}`}
            >
              {reviewStatus}
            </p>
          </form>
        </article>
      </div>

      <section className={`${panelClass} grid items-center gap-4 md:grid-cols-[1fr_auto]`}>
        <div>
          <h3 className="text-xl font-medium">Apple Calendar</h3>
          <p className="mt-2 mb-0 leading-relaxed text-ctp-overlay0">
            Recurring study, dinner, walk, and reading blocks go into a dedicated
            calendar. Edit the week on{" "}
            <Link href="/routine" className="text-ctp-mauve hover:underline">
              Routine
            </Link>{" "}
            first if you want a different plan.
          </p>
        </div>
        <CalendarSyncButton />
      </section>
    </div>
  );
}
