"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CaretRight,
  ChartLine,
  Check,
  Circle,
  Clock,
  PersonSimpleWalk,
  Target,
} from "@phosphor-icons/react";
import { CalendarSyncButton } from "@/app/components/calendar-sync-button";
import {
  formatClock12,
  formatDateTime12,
  formatHm12,
  formatHmRange,
} from "@/lib/timezone";
import {
  alreadyLogged,
  applyLoggedSession,
  applyUnloggedSession,
  blockCtaMinutes,
  blockCtaName,
  blockLogKey,
  blockLogSubject,
  briefingDay,
  sessionForQuickLog,
  timelineChip,
  type TimelineChip,
} from "@/lib/dashboard-log";
import type { Briefing, EnrichedBlock, SessionRecord } from "@/lib/types";

type DashboardProps = {
  initialBriefing: Briefing;
  initialRecent: SessionRecord[];
};

type BusyKind = "block" | "walk" | "reading" | "form" | "undo";

const EXTRA_DEFAULTS = new Set(["dsa", "lld", "hld", "ai", "review"]);

function extraDefaultSubject(current: EnrichedBlock | null): string {
  if (!current) return "other";
  const subject = blockLogSubject(current);
  return EXTRA_DEFAULTS.has(subject) ? subject : "other";
}

function isOptimisticId(id: string): boolean {
  return id.startsWith("optimistic-");
}

function kindAccent(kind: string, subject: string): string {
  if (subject === "dsa") return "mauve";
  if (subject === "walk" || kind === "walk") return "green";
  if (subject === "reading" || kind === "reading") return "blue";
  if (kind === "study") return "peach";
  if (kind === "meal") return "red";
  return "overlay";
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

function chipClass(chip: TimelineChip): string {
  const base =
    "rounded-full px-2.5 py-1 font-mono text-[13px] transition-colors duration-150";
  switch (chip) {
    case "Now":
      return `${base} bg-ctp-peach text-ctp-crust`;
    case "Logged":
      return `${base} border border-ctp-green/40 bg-transparent text-ctp-green`;
    case "Remaining":
      return `${base} border border-ctp-overlay1 bg-transparent text-ctp-overlay1`;
    case "Missed":
      return `${base} border border-ctp-red bg-transparent text-ctp-red`;
  }
}

function pipClass(chip: TimelineChip): string {
  switch (chip) {
    case "Now":
      return "bg-ctp-peach ring-2 ring-ctp-peach/40";
    case "Logged":
      return "bg-ctp-green";
    case "Missed":
      return "bg-ctp-red";
    default:
      return "bg-ctp-overlay1";
  }
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
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
const panelClass = "today-glass rounded-2xl p-5";
const primaryBtn =
  "rounded-full bg-ctp-peach px-4 py-2.5 font-medium text-ctp-crust transition-colors duration-150 disabled:cursor-wait disabled:opacity-55";
const ghostBtn =
  "rounded-full border border-ctp-surface1 bg-transparent px-4 py-2.5 text-ctp-text transition-colors duration-150 hover:border-ctp-overlay1 hover:bg-ctp-surface0 disabled:cursor-wait disabled:opacity-55";
const doneBtn =
  "rounded-full border border-ctp-green/40 bg-ctp-green/10 px-4 py-2.5 text-ctp-green transition-colors duration-150";
const undoLink =
  "px-1 py-1 text-[13px] text-ctp-overlay0 transition-colors duration-150 hover:text-ctp-text disabled:cursor-wait disabled:opacity-55";
const undoLinkDone =
  "px-1 py-1 text-[13px] text-ctp-green/80 transition-colors duration-150 hover:text-ctp-green disabled:cursor-wait disabled:opacity-55";
const checkBtn =
  "inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-[13px] text-ctp-subtext0 transition-colors duration-150 disabled:cursor-wait disabled:opacity-55";
const checkDoneBtn =
  "inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-[13px] text-ctp-green transition-colors duration-150 disabled:cursor-wait disabled:opacity-55";

export function Dashboard({ initialBriefing, initialRecent }: DashboardProps) {
  const [briefing, setBriefing] = useState(initialBriefing);
  const [recent, setRecent] = useState(initialRecent);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [status, setStatus] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [busy, setBusy] = useState<null | BusyKind>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewError, setReviewError] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const extraFormRef = useRef<HTMLFormElement>(null);
  const blockCtaRef = useRef<HTMLButtonElement>(null);
  const walkCheckRef = useRef<HTMLButtonElement>(null);
  const readingCheckRef = useRef<HTMLButtonElement>(null);
  const reviewHydrated = useRef(false);
  const snapshotRef = useRef({ briefing: initialBriefing, recent: initialRecent });
  const busyRef = useRef<null | BusyKind>(null);

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
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    const poll = window.setInterval(() => {
      if (busyRef.current) return;
      void refresh().catch(() => undefined);
    }, 30000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    const form = extraFormRef.current;
    if (!form) return;
    const subjectField = form.elements.namedItem("subject");
    if (subjectField instanceof HTMLSelectElement) {
      subjectField.value = extraDefaultSubject(current);
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

  useEffect(() => {
    snapshotRef.current = { briefing, recent };
  }, [briefing, recent]);

  const studyH = ((briefing.stats.study_minutes_week || 0) / 60).toFixed(1);
  const logging = Boolean(busy);
  const walkDone = alreadyLogged("walk", briefing, recent);
  const readingDone = alreadyLogged("reading", briefing, recent);
  const blockDone = alreadyLogged("block", briefing, recent);
  const blockSession = sessionForQuickLog("block", briefing, recent);
  const walkSession = sessionForQuickLog("walk", briefing, recent);
  const readingSession = sessionForQuickLog("reading", briefing, recent);
  const extraSubmitPeach = extraOpen && (blockDone || !current);

  function alreadyMessage(kind: "walk" | "reading" | "block"): string {
    if (kind === "walk") return "Walk already logged today.";
    if (kind === "reading") return "Reading already logged today.";
    return "This block is already logged.";
  }

  function setLiveStatus(message: string, error = false) {
    setStatusError(error);
    setStatus(message);
  }

  function flashStat(key: string) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFlash(key);
    window.setTimeout(() => {
      setFlash((currentFlash) => (currentFlash === key ? null : currentFlash));
    }, 1400);
  }

  function statCardClass(key: string, tint: string): string {
    return `rounded-xl p-3 transition-shadow duration-300 ${tint} ${
      flash === key ? "ring-1 ring-ctp-green/80" : ""
    }`;
  }

  function habitExtra(kind: "walk" | "reading"): Record<string, unknown> | undefined {
    if (!current) return undefined;
    if (current.subject !== kind && current.kind !== kind) return undefined;
    return {
      block_key: blockLogKey(current, briefingDay(briefing)),
      block_start: current.start,
      block_title: current.title,
    };
  }

  async function logSession(
    body: {
      subject: string;
      minutes: number;
      notes?: string;
      problems_count?: number;
      extra?: Record<string, unknown>;
    },
    kind: Exclude<BusyKind, "undo">,
    successMessage: string,
  ) {
    if (busy) return false;
    if (kind === "walk" || kind === "reading" || kind === "block") {
      if (alreadyLogged(kind, snapshotRef.current.briefing, snapshotRef.current.recent)) {
        setLiveStatus(alreadyMessage(kind));
        return false;
      }
    }
    setBusy(kind);
    setLiveStatus("Logging…");

    const snapshot = snapshotRef.current;
    const optimisticSession: SessionRecord = {
      id: `optimistic-${Date.now()}`,
      ts: new Date().toISOString(),
      subject: body.subject,
      minutes: body.minutes,
      notes: body.notes || "",
      problems_count: body.problems_count || 0,
      extra: body.extra || {},
    };
    const optimistic = applyLoggedSession({
      briefing: snapshot.briefing,
      recent: snapshot.recent,
      session: optimisticSession,
    });
    setBriefing(optimistic.briefing);
    setRecent(optimistic.recent);
    if (body.subject === "walk") flashStat("walk");
    else if (body.subject === "reading") flashStat("reading");
    else if (body.subject === "dsa") flashStat("dsa");
    else flashStat("study");

    try {
      const result = await api<{ briefing: Briefing; session: SessionRecord }>(
        "/api/sessions",
        { method: "POST", body: JSON.stringify(body) },
      );
      setBriefing(result.briefing);
      setRecent((currentRecent) => {
        const withoutOptimistic = currentRecent.filter(
          (row) => row.id !== optimisticSession.id && row.id !== result.session.id,
        );
        return [result.session, ...withoutOptimistic];
      });
      await refresh();
      setLiveStatus(successMessage);
    } catch (error) {
      setBriefing(snapshot.briefing);
      setRecent(snapshot.recent);
      setLiveStatus(error instanceof Error ? error.message : "Request failed", true);
      return false;
    } finally {
      setBusy(null);
    }
    return true;
  }

  async function undoSession(
    target: SessionRecord,
    successMessage: string,
    restoreFocus?: () => void,
  ) {
    if (busy || isOptimisticId(target.id)) return;
    setBusy("undo");
    const snapshot = snapshotRef.current;
    const optimistic = applyUnloggedSession({
      briefing: snapshot.briefing,
      recent: snapshot.recent,
      session: target,
    });
    setBriefing(optimistic.briefing);
    setRecent(optimistic.recent);

    try {
      const response = await fetch(`/api/sessions/${target.id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        detail?: string;
        error?: string;
        briefing?: Briefing;
      };
      if (response.status === 404) {
        await refresh();
        setLiveStatus("Already removed.");
        return;
      }
      if (!response.ok) {
        throw new Error(data.detail || data.error || "Request failed");
      }
      if (data.briefing) setBriefing(data.briefing);
      await refresh();
      setLiveStatus(successMessage);
    } catch (error) {
      setBriefing(snapshot.briefing);
      setRecent(snapshot.recent);
      setLiveStatus(error instanceof Error ? error.message : "Request failed", true);
    } finally {
      setBusy(null);
      if (restoreFocus) {
        requestAnimationFrame(() => restoreFocus());
      }
    }
  }

  function logCurrentBlock() {
    if (!current) return;
    if (blockDone) {
      setLiveStatus(alreadyMessage("block"));
      return;
    }
    const minutes = blockCtaMinutes(current);
    const subject = blockLogSubject(current);
    void logSession(
      {
        subject,
        minutes,
        notes: current.title,
        extra: {
          block_key: blockLogKey(current, briefingDay(briefing)),
          block_start: current.start,
          block_title: current.title,
        },
      },
      "block",
      "Logged this block.",
    );
  }

  function toggleHabit(kind: "walk" | "reading") {
    const done = kind === "walk" ? walkDone : readingDone;
    const session = kind === "walk" ? walkSession : readingSession;
    const checkRef = kind === "walk" ? walkCheckRef : readingCheckRef;
    if (done) {
      if (session && !isOptimisticId(session.id)) {
        void undoSession(
          session,
          kind === "walk" ? "Walk undone." : "Reading undone.",
          () => checkRef.current?.focus(),
        );
      }
      return;
    }
    if (kind === "walk") {
      void logSession(
        {
          subject: "walk",
          minutes: 20,
          notes: "20-minute walk",
          extra: habitExtra("walk"),
        },
        "walk",
        "Walk logged.",
      );
      return;
    }
    void logSession(
      {
        subject: "reading",
        minutes: 30,
        notes: "Reading block",
        extra: habitExtra("reading"),
      },
      "reading",
      "Reading logged.",
    );
  }

  const blockLabel = current
    ? busy === "block"
      ? "Logging…"
      : blockDone
        ? "Logged"
        : `Log ${blockCtaName(current)} · ${blockCtaMinutes(current)}m`
    : "";

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

      <section
        className="today-glass mb-5 rounded-2xl p-7"
        data-accent={accent === "overlay" ? undefined : accent}
      >
        <p
          className={`mb-2 font-mono text-[11px] uppercase tracking-[0.16em] ${
            current ? "text-ctp-peach" : "text-ctp-overlay0"
          }`}
        >
          {current ? "Now" : briefing.day_label}
        </p>
        <h2 className="text-3xl font-medium tracking-tight sm:text-5xl">
          {current ? current.title : "Between blocks"}
        </h2>
        <p className="mt-2.5 mb-4 text-ctp-subtext0">
          {current
            ? `${formatHmRange(current.start, current.end)} · ${progress.remaining ?? "—"} min left · ${current.kind}`
            : briefing.next
              ? `Next block at ${formatHm12(briefing.next.start)}`
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
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          {current ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                ref={blockCtaRef}
                type="button"
                className={blockDone && busy !== "block" ? doneBtn : primaryBtn}
                disabled={logging}
                onClick={logCurrentBlock}
              >
                {blockLabel}
              </button>
              {blockDone && blockSession && !isOptimisticId(blockSession.id) ? (
                <button
                  type="button"
                  className={undoLink}
                  disabled={logging}
                  aria-label={`Undo ${blockCtaName(current)}`}
                  onClick={() => {
                    void undoSession(blockSession, "Block undone.", () => {
                      blockCtaRef.current?.focus();
                    });
                  }}
                >
                  Undo
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                ref={walkCheckRef}
                type="button"
                className={walkDone && busy !== "walk" ? checkDoneBtn : checkBtn}
                disabled={logging}
                aria-pressed={walkDone}
                onClick={() => toggleHabit("walk")}
              >
                <PersonSimpleWalk size={16} weight="bold" />
                {walkDone ? "logged" : "Walk"}
                {walkDone ? <Check size={14} weight="bold" /> : <Circle size={14} />}
              </button>
              {walkDone && walkSession && !isOptimisticId(walkSession.id) ? (
                <button
                  type="button"
                  className={undoLinkDone}
                  disabled={logging}
                  aria-label="Undo walk"
                  onClick={() => {
                    void undoSession(walkSession, "Walk undone.", () => {
                      walkCheckRef.current?.focus();
                    });
                  }}
                >
                  Undo
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <button
                ref={readingCheckRef}
                type="button"
                className={readingDone && busy !== "reading" ? checkDoneBtn : checkBtn}
                disabled={logging}
                aria-pressed={readingDone}
                onClick={() => toggleHabit("reading")}
              >
                <BookOpen size={16} weight="bold" />
                {readingDone ? "logged" : "Reading"}
                {readingDone ? <Check size={14} weight="bold" /> : <Circle size={14} />}
              </button>
              {readingDone && readingSession && !isOptimisticId(readingSession.id) ? (
                <button
                  type="button"
                  className={undoLinkDone}
                  disabled={logging}
                  aria-label="Undo reading"
                  onClick={() => {
                    void undoSession(readingSession, "Reading undone.", () => {
                      readingCheckRef.current?.focus();
                    });
                  }}
                >
                  Undo
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <p
          className={`mt-3 min-h-[1.2em] text-[13px] transition-opacity duration-150 ${
            statusError ? "text-ctp-red" : "text-ctp-green"
          }`}
          aria-live="polite"
        >
          {status}
        </p>
        <details
          className="mt-4"
          onToggle={(event) => setExtraOpen(event.currentTarget.open)}
        >
          <summary className="today-extra-summary flex cursor-pointer list-none items-center gap-1.5 text-[13px] text-ctp-overlay0">
            <CaretRight size={12} className={extraOpen ? "rotate-90" : ""} />
            Add extra time
          </summary>
          <form
            ref={extraFormRef}
            className="mt-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              const subject = String(formData.get("subject") || "other");
              const minutes = Math.max(0, Number(formData.get("minutes") || 0));
              const problemsCount = Math.max(
                0,
                Number(formData.get("problems_count") || 0),
              );
              const notes = String(formData.get("notes") || "").trim();
              if (minutes === 0 && problemsCount === 0 && !notes) {
                setLiveStatus("Add minutes, problems, or notes.");
                return;
              }
              const saved = await logSession(
                {
                  subject,
                  minutes,
                  problems_count: problemsCount,
                  notes,
                },
                "form",
                minutes === 0
                  ? `Logged notes · ${subject}.`
                  : `Logged ${minutes}m · ${subject}.`,
              );
              const notesField = form.elements.namedItem("notes");
              if (saved && notesField instanceof HTMLTextAreaElement) {
                notesField.value = "";
              }
            }}
          >
            <div className="mb-3 flex flex-wrap gap-2.5">
              <label className={`${labelClass} min-w-[120px] flex-1`}>
                Subject
                <select
                  name="subject"
                  defaultValue={extraDefaultSubject(current)}
                  className={inputClass}
                >
                  <option value="dsa">DSA</option>
                  <option value="lld">LLD</option>
                  <option value="hld">HLD</option>
                  <option value="ai">AI</option>
                  <option value="review">Weekly review</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className={`${labelClass} min-w-[120px] flex-1`}>
                Extra minutes
                <input
                  name="minutes"
                  type="number"
                  min={0}
                  step={5}
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
                placeholder="Problem names, patterns, leftover work…"
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              className={extraSubmitPeach ? primaryBtn : ghostBtn}
              disabled={logging}
            >
              {busy === "form" ? "Saving…" : "Save extra time"}
            </button>
          </form>
        </details>
        <ul className="mt-4 list-none p-0">
          {recent.slice(0, 8).map((row) => {
            const when = formatDateTime12(new Date(row.ts), briefing.timezone);
            const extra = row.problems_count ? ` · ${row.problems_count} problems` : "";
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-ctp-surface0 py-2.5 text-sm text-ctp-subtext1"
              >
                <span>
                  <span className="mr-2 inline-block font-mono text-[11px] uppercase tracking-wider text-ctp-peach">
                    {row.subject}
                  </span>
                  {when} · {row.minutes}m{extra}
                  {row.notes ? ` — ${row.notes}` : ""}
                </span>
                {!isOptimisticId(row.id) ? (
                  <button
                    type="button"
                    className={undoLink}
                    disabled={logging}
                    aria-label="Undo session"
                    onClick={() => {
                      void undoSession(row, "Session undone.");
                    }}
                  >
                    Undo
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className={panelClass}>
          <h3 className="mb-4 text-xl font-medium">Today</h3>
          <ol className="m-0 list-none p-0">
            {briefing.today.map((block) => {
              const chip = timelineChip(block, briefing, recent, nowMs);
              const isNow = chip === "Now";
              return (
                <li
                  key={`${block.start}-${block.title}`}
                  className={`relative ml-2 grid grid-cols-[148px_minmax(0,1fr)_auto] items-center gap-3 border-l-2 py-2 pl-4 ${
                    isNow ? "border-ctp-peach text-ctp-peach" : "border-ctp-surface0"
                  }`}
                >
                  <span
                    className={`absolute top-3.5 -left-[5px] h-2.5 w-2.5 rounded-full ${pipClass(chip)}`}
                  />
                  <span className="font-mono text-[13px] text-ctp-overlay0">
                    {formatHmRange(block.start, block.end)}
                  </span>
                  <span>{block.title}</span>
                  <span className={chipClass(chip)}>{chip}</span>
                </li>
              );
            })}
          </ol>
        </article>

        <article className={panelClass}>
          <h3 className="mb-4 text-xl font-medium">Week</h3>
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <div className={statCardClass("dsa", "today-week-dsa-total")}>
              <ChartLine size={16} className="today-week-icon mb-1" weight="bold" />
              <b className="block font-mono text-xl">{briefing.stats.dsa_problems_total || 0}</b>
              <span className="text-xs text-ctp-subtext1">DSA problems logged</span>
            </div>
            <div className={statCardClass("dsa", "today-week-dsa-week")}>
              <Target size={16} className="today-week-icon mb-1" weight="bold" />
              <b className="block font-mono text-xl">{briefing.stats.dsa_problems_week || 0}</b>
              <span className="text-xs text-ctp-subtext1">DSA this week</span>
            </div>
            <div className={statCardClass("walk", "today-week-walk")}>
              <PersonSimpleWalk size={16} className="today-week-icon mb-1" weight="bold" />
              <b className="block font-mono text-xl">{briefing.stats.walk_days || 0}/7</b>
              <span className="text-xs text-ctp-subtext1">Walk days</span>
            </div>
            <div className={statCardClass("study", "today-week-study")}>
              <Clock size={16} className="today-week-icon mb-1" weight="bold" />
              <b className="block font-mono text-xl">{studyH}h</b>
              <span className="text-xs text-ctp-subtext1">Focus hours this week</span>
            </div>
          </div>
          <p className="m-0 text-ctp-overlay0">
            {briefing.next
              ? `Up next: ${briefing.next.title} at ${formatHmRange(briefing.next.start, briefing.next.end)}`
              : "No further blocks today."}
          </p>
          <p className="mt-2 mb-0 text-ctp-subtext0">
            Focus hours move only for DSA, LLD, HLD, and AI.
          </p>
        </article>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
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

        <article className={panelClass}>
          <h3 className="text-xl font-medium">Apple Calendar</h3>
          <p className="mt-2 mb-4 leading-relaxed text-ctp-overlay0">
            Recurring study, dinner, walk, and reading blocks go into a dedicated
            calendar. Edit the week on{" "}
            <Link href="/routine" className="text-ctp-mauve hover:underline">
              Routine
            </Link>{" "}
            first if you want a different plan.
          </p>
          <CalendarSyncButton />
        </article>
      </div>
    </div>
  );
}
