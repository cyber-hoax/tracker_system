"use client";

import { useMemo, useState, useTransition } from "react";
import { saveRoutineAction } from "@/app/actions/routine";
import { CalendarSyncButton } from "@/app/components/calendar-sync-button";
import {
  DAY_KEYS,
  DAY_LABELS,
  type DayKey,
  type Routine,
  type RoutineBlock,
  type RoutineDay,
} from "@/lib/types";

const BLOCK_KINDS = [
  "study",
  "walk",
  "reading",
  "meal",
  "break",
  "work",
  "buffer",
  "maintenance",
  "shutdown",
  "personal",
  "free",
] as const;

const SUBJECTS = [
  "dsa",
  "lld",
  "hld",
  "ai",
  "reading",
  "walk",
  "review",
  "morning",
  "hld_lld_alt",
  "none",
  "other",
] as const;

const DAY_KINDS = ["office", "deep_work", "weekend_focus", "weekend_review"] as const;

const inputClass =
  "mt-1.5 w-full rounded-xl border border-ctp-surface0 bg-ctp-base px-3 py-2 text-sm text-ctp-text outline-none focus:border-ctp-mauve";
const labelClass = "block text-[13px] text-ctp-overlay0";
const panelClass = "rounded-2xl border border-ctp-surface0 bg-ctp-mantle p-5";
const primaryBtn =
  "rounded-full bg-ctp-peach px-4 py-2.5 font-medium text-ctp-crust disabled:cursor-wait disabled:opacity-55";
const ghostBtn =
  "rounded-full border border-ctp-surface1 bg-transparent px-3 py-1.5 text-sm text-ctp-text hover:bg-ctp-surface0";

type DraftBlock = RoutineBlock & { key: string };

type DraftDay = Omit<RoutineDay, "blocks"> & { blocks: DraftBlock[] };

let blockSeq = 0;
function nextKey(): string {
  blockSeq += 1;
  return `block-${blockSeq}`;
}

function fallbackDay(key: DayKey): RoutineDay {
  return {
    label: DAY_LABELS[key],
    kind: key === "sat" ? "weekend_focus" : key === "sun" ? "weekend_review" : "office",
    summary: "",
    blocks: [],
  };
}

function withKeys(days: Record<string, RoutineDay>): Record<DayKey, DraftDay> {
  return Object.fromEntries(
    DAY_KEYS.map((key) => {
      const day = days[key] ?? fallbackDay(key);
      return [
        key,
        {
          ...day,
          blocks: day.blocks.map((block) => ({ ...block, key: nextKey() })),
        },
      ];
    }),
  ) as Record<DayKey, DraftDay>;
}

function withoutKeys(days: Record<DayKey, DraftDay>): Record<string, RoutineDay> {
  return Object.fromEntries(
    DAY_KEYS.map((key) => {
      const day = days[key];
      return [
        key,
        {
          label: day.label,
          kind: day.kind,
          summary: day.summary,
          blocks: day.blocks.map((block) => ({
            start: block.start,
            end: block.end,
            title: block.title,
            kind: block.kind,
            subject: block.subject,
            ...(block.guide ? { guide: block.guide } : {}),
          })),
        },
      ];
    }),
  );
}

function optionList(options: readonly string[], current: string): string[] {
  return options.includes(current) ? [...options] : [current, ...options];
}

function defaultBlock(after?: DraftBlock): DraftBlock {
  return {
    key: nextKey(),
    start: after?.end || "19:30",
    end: "21:00",
    title: "Study",
    kind: "study",
    subject: "dsa",
    guide: "",
  };
}

export function RoutineEditor({
  initialName,
  initialRoutine,
}: {
  initialName: string;
  initialRoutine: Routine;
}) {
  const [name, setName] = useState(initialName);
  const [calendarName, setCalendarName] = useState(
    initialRoutine.calendar_name || "SDE Prep",
  );
  const [goal, setGoal] = useState(initialRoutine.goal || "");
  const [days, setDays] = useState(() => withKeys(initialRoutine.days));
  const [activeDay, setActiveDay] = useState<DayKey>("mon");
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const day = days[activeDay];
  const blockCount = useMemo(
    () => DAY_KEYS.reduce((sum, key) => sum + days[key].blocks.length, 0),
    [days],
  );

  function patchDay(patch: Partial<DraftDay>) {
    setDays((current) => ({
      ...current,
      [activeDay]: { ...current[activeDay], ...patch },
    }));
  }

  function patchBlock(key: string, patch: Partial<DraftBlock>) {
    patchDay({
      blocks: day.blocks.map((block) =>
        block.key === key ? { ...block, ...patch } : block,
      ),
    });
  }

  function save() {
    setError(false);
    setStatus("Saving…");
    startTransition(async () => {
      try {
        await saveRoutineAction({
          name,
          routine: {
            ...initialRoutine,
            calendar_name: calendarName,
            goal,
            days: withoutKeys(days),
          },
        });
        setStatus("Saved to the database.");
      } catch (caught) {
        setError(true);
        setStatus(caught instanceof Error ? caught.message : "Could not save");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className={`${panelClass} space-y-4`}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Routine name
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Weekly routine"
            />
          </label>
          <label className={labelClass}>
            Apple Calendar name
            <input
              className={inputClass}
              value={calendarName}
              onChange={(event) => setCalendarName(event.target.value)}
              placeholder="SDE Prep"
            />
          </label>
        </div>
        <label className={labelClass}>
          Goal
          <textarea
            className={inputClass}
            rows={2}
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="What this week should protect"
          />
        </label>
      </section>

      <section className={`${panelClass} space-y-4`}>
        <div className="flex flex-wrap gap-1.5">
          {DAY_KEYS.map((key) => {
            const count = days[key].blocks.length;
            const selected = key === activeDay;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveDay(key)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  selected
                    ? "bg-ctp-mauve text-ctp-crust"
                    : "border border-ctp-surface1 text-ctp-subtext0 hover:bg-ctp-surface0 hover:text-ctp-text"
                }`}
              >
                {DAY_LABELS[key].slice(0, 3)}
                <span className="ml-1.5 text-[11px] opacity-80">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <label className={labelClass}>
            Day kind
            <select
              className={inputClass}
              value={day.kind}
              onChange={(event) => patchDay({ kind: event.target.value })}
            >
              {optionList(DAY_KINDS, day.kind).map((kind) => (
                <option key={kind} value={kind}>
                  {kind.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Summary
            <input
              className={inputClass}
              value={day.summary}
              onChange={(event) => patchDay({ summary: event.target.value })}
              placeholder="DSA then LLD"
            />
          </label>
        </div>

        <div className="space-y-3">
          {day.blocks.map((block, index) => (
            <article
              key={block.key}
              className="space-y-3 rounded-xl border border-ctp-surface0 bg-ctp-base p-4"
            >
              <div className="grid gap-3 sm:grid-cols-[7rem_7rem_1fr_auto]">
                <label className={labelClass}>
                  Start
                  <input
                    type="time"
                    step="60"
                    className={inputClass}
                    value={block.start}
                    onChange={(event) =>
                      patchBlock(block.key, { start: event.target.value })
                    }
                  />
                </label>
                <label className={labelClass}>
                  End
                  <input
                    type="time"
                    step="60"
                    className={inputClass}
                    value={block.end}
                    onChange={(event) =>
                      patchBlock(block.key, { end: event.target.value })
                    }
                  />
                </label>
                <label className={labelClass}>
                  Title
                  <input
                    className={inputClass}
                    value={block.title}
                    onChange={(event) =>
                      patchBlock(block.key, { title: event.target.value })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="self-end rounded-full px-3 py-2 text-sm text-ctp-red hover:bg-ctp-surface0"
                  onClick={() =>
                    patchDay({
                      blocks: day.blocks.filter((item) => item.key !== block.key),
                    })
                  }
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  Kind
                  <select
                    className={inputClass}
                    value={block.kind}
                    onChange={(event) =>
                      patchBlock(block.key, { kind: event.target.value })
                    }
                  >
                    {optionList(BLOCK_KINDS, block.kind).map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Subject
                  <select
                    className={inputClass}
                    value={block.subject}
                    onChange={(event) =>
                      patchBlock(block.key, { subject: event.target.value })
                    }
                  >
                    {optionList(SUBJECTS, block.subject).map((subject) => (
                      <option key={subject} value={subject}>
                        {subject.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={labelClass}>
                Guide
                <textarea
                  className={inputClass}
                  rows={2}
                  value={block.guide || ""}
                  onChange={(event) =>
                    patchBlock(block.key, { guide: event.target.value })
                  }
                />
              </label>
              <p className="m-0 text-[11px] text-ctp-overlay0">Block {index + 1}</p>
            </article>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={ghostBtn}
            onClick={() =>
              patchDay({
                blocks: [...day.blocks, defaultBlock(day.blocks.at(-1))],
              })
            }
          >
            Add block
          </button>
          <button
            type="button"
            className={ghostBtn}
            onClick={() => {
              const weekdays = ["mon", "tue", "wed", "thu", "fri"] as const;
              setDays((current) => {
                const source = current[activeDay];
                const next = { ...current };
                for (const key of weekdays) {
                  if (key === activeDay) continue;
                  next[key] = {
                    ...next[key],
                    blocks: source.blocks.map((block) => ({
                      ...block,
                      key: nextKey(),
                    })),
                  };
                }
                return next;
              });
              setStatus("Copied this day’s blocks onto Mon–Fri.");
              setError(false);
            }}
          >
            Copy blocks to Mon–Fri
          </button>
          <button
            type="button"
            className={ghostBtn}
            onClick={() => patchDay({ blocks: [] })}
          >
            Clear this day
          </button>
        </div>
      </section>

      <section className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <p className="m-0 text-sm text-ctp-subtext0">
            {blockCount} blocks across the week. Save first, then add to Apple
            Calendar. Work and buffer kinds stay off the calendar.
          </p>
          {status ? (
            <p
              className={`mt-2 mb-0 text-[13px] ${error ? "text-ctp-red" : "text-ctp-green"}`}
            >
              {status}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={primaryBtn} disabled={pending} onClick={save}>
            Save routine
          </button>
          <CalendarSyncButton calendarName={calendarName} className={ghostBtn} />
        </div>
      </section>
    </div>
  );
}
