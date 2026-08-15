"use client";

import {
  saveLeetCodeUsernameAction,
  syncLeetCodeNowAction,
} from "@/app/actions/leetcode";
import { formatDateTime12 } from "@/lib/timezone";
import type { LeetCodeSettingsView, LeetCodeSyncReport } from "@/lib/leetcode/types";
import { useState, useTransition } from "react";

const TIMEZONE = "Asia/Kolkata";

export function LeetCodeSettings({ initial }: { initial: LeetCodeSettingsView }) {
  const [view, setView] = useState(initial);
  const [report, setReport] = useState<LeetCodeSyncReport | null>(
    initial.poll.lastResult,
  );
  const [pending, startTransition] = useTransition();

  function formatIso(value: string | null): string {
    if (!value) return "never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return formatDateTime12(date, TIMEZONE);
  }

  function syncNow() {
    startTransition(async () => {
      const next = await syncLeetCodeNowAction();
      setReport(next);
      setView((current) => ({
        ...current,
        lastSyncAt: next.lastSyncAt,
        lastSubmissionAt: next.lastSubmissionAt,
        poll: {
          ...current.poll,
          lastTickAt: next.lastSyncAt,
          lastResult: next,
        },
      }));
    });
  }

  const poll = view.poll;
  const pollLabel = !view.hasSession
    ? "Idle — add LEETCODE_SESSION to .env.local"
    : poll.running
      ? "Hourly poll is running"
      : "Hourly poll starts with the Node server";

  return (
    <div className="space-y-4">
      <form action={saveLeetCodeUsernameAction} className="space-y-2">
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase text-ctp-overlay0">
            LeetCode username
          </span>
          <input
            name="username"
            defaultValue={view.username}
            placeholder="your_leetcode_id"
            className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="font-mono text-xs text-ctp-blue"
        >
          Save username
        </button>
      </form>

      <dl className="space-y-1 font-mono text-xs text-ctp-subtext0">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ctp-overlay0">Session cookie</dt>
          <dd>{view.hasSession ? "set in .env.local" : "missing"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ctp-overlay0">Last sync</dt>
          <dd>{formatIso(view.lastSyncAt)}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ctp-overlay0">Hourly poll</dt>
          <dd>{pollLabel}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ctp-overlay0">Last poll tick</dt>
          <dd>{formatIso(poll.lastTickAt)}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ctp-overlay0">Next poll</dt>
          <dd>{formatIso(poll.nextTickAt)}</dd>
        </div>
      </dl>

      <button
        type="button"
        disabled={pending}
        onClick={syncNow}
        className="bg-ctp-blue px-3 py-2 font-mono text-xs text-ctp-crust hover:bg-ctp-sapphire disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync LeetCode now"}
      </button>

      {report ? (
        <p
          className={`text-sm ${report.ok ? "text-ctp-green" : "text-ctp-red"}`}
        >
          {report.message}
        </p>
      ) : null}
    </div>
  );
}
