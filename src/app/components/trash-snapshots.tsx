"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  permanentlyDeleteSnapshotAction,
  restoreTrashSnapshotAction,
} from "@/app/actions/workspace";
import { formatDateTime12 } from "@/lib/timezone";
import type { TrashSnapshotListItem } from "@/lib/workspace/snapshots";

const TIMEZONE = "Asia/Kolkata";

function snapshotMeta(snapshot: TrashSnapshotListItem): string {
  const when = formatDateTime12(new Date(snapshot.deletedAt), TIMEZONE);
  if (snapshot.kind === "note") return `Note · ${when}`;
  const folders =
    snapshot.folderCount === 1 ? "1 folder" : `${snapshot.folderCount} folders`;
  const notes =
    snapshot.noteCount === 1 ? "1 note" : `${snapshot.noteCount} notes`;
  return `${folders} · ${notes} · ${when}`;
}

export function TrashSnapshots({
  snapshots,
}: {
  snapshots: TrashSnapshotListItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-3 border border-ctp-surface0 bg-ctp-base p-4">
      <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-mauve">
        Trash / Snapshots
      </h2>
      <p className="text-sm text-ctp-subtext0">
        The 10 most recent folders and notes moved to trash. Restore brings
        them back (including nested children and Obsidian files when
        write-through is on). Permanently delete drops the snapshot only.
      </p>
      {snapshots.length === 0 ? (
        <p className="font-mono text-xs text-ctp-overlay0">Trash is empty.</p>
      ) : (
        <ul className="divide-y divide-ctp-surface0 border border-ctp-surface0">
          {snapshots.map((snapshot) => (
            <li
              key={snapshot.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ctp-text">{snapshot.label}</p>
                <p className="font-mono text-[11px] text-ctp-overlay0">
                  {snapshotMeta(snapshot)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={pending}
                  className="font-mono text-xs text-ctp-blue hover:text-ctp-lavender disabled:opacity-50"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await restoreTrashSnapshotAction(
                        snapshot.id,
                      );
                      if (!result.ok) window.alert(result.error);
                      else router.refresh();
                    });
                  }}
                >
                  Restore
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="font-mono text-xs text-ctp-red hover:text-ctp-maroon disabled:opacity-50"
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Permanently delete this snapshot? This cannot be undone.",
                      )
                    ) {
                      return;
                    }
                    startTransition(async () => {
                      const result = await permanentlyDeleteSnapshotAction(
                        snapshot.id,
                      );
                      if (!result.ok) window.alert(result.error);
                      else router.refresh();
                    });
                  }}
                >
                  Delete forever
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
