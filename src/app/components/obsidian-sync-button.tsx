"use client";

import { syncFromObsidianAction } from "@/app/actions/obsidian";
import type { SyncReport } from "@/lib/obsidian";
import { useState, useTransition } from "react";

export function ObsidianSyncButton() {
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<SyncReport | null>(null);

  function run() {
    startTransition(async () => {
      const next = await syncFromObsidianAction();
      setReport(next);
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="bg-ctp-blue px-3 py-2 font-mono text-xs text-ctp-crust hover:bg-ctp-sapphire disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync from Obsidian"}
      </button>
      {report?.error ? (
        <p className="text-sm text-ctp-red">{report.error}</p>
      ) : null}
      {report && !report.error ? <SyncSummary report={report} /> : null}
    </div>
  );
}

function SyncSummary({ report }: { report: SyncReport }) {
  return (
    <div className="space-y-2 font-mono text-xs text-ctp-subtext0">
      <p>
        imported {report.imported} · updated {report.updated} · wrote{" "}
        {report.written} · unchanged {report.unchanged}
      </p>
      <p>
        {report.problems} problems · {report.patterns} pattern hubs
      </p>
      {report.conflicts.length > 0 ? (
        <p className="text-ctp-peach">
          conflicts: {report.conflicts.join(", ")}
        </p>
      ) : null}
      {report.skipped.length > 0 ? (
        <ul className="space-y-1 text-ctp-overlay0">
          {report.skipped.map((row) => (
            <li key={row.path}>
              skipped {row.path} — {row.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
