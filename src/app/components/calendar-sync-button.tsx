"use client";

import { useState } from "react";

const primaryBtn =
  "rounded-full bg-ctp-peach px-4 py-2.5 font-medium text-ctp-crust disabled:cursor-wait disabled:opacity-55";

export function CalendarSyncButton({
  calendarName,
  className = primaryBtn,
}: {
  calendarName?: string;
  className?: string;
}) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          setStatus("Syncing Apple Calendar…");
          try {
            const response = await fetch("/api/calendar/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            const result = (await response.json().catch(() => ({}))) as {
              method?: string;
              event_count?: number;
              calendar_name?: string;
              error?: string;
              detail?: string;
            };
            if (!response.ok) {
              throw new Error(result.detail || result.error || "Request failed");
            }
            const name = result.calendar_name || calendarName || "SDE Prep";
            if (result.method === "calendar_app") {
              setStatus(`Wrote ${result.event_count ?? 0} recurring events to “${name}”.`);
            } else {
              setStatus(
                `Opened Calendar with ${result.event_count ?? 0} events. Import into “${name}” if asked. ${result.error || ""}`.trim(),
              );
            }
          } catch (caught) {
            setError(true);
            setStatus(caught instanceof Error ? caught.message : "Request failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        Add to Apple Calendar
      </button>
      {status ? (
        <p className={`m-0 min-h-[1.2em] text-[13px] ${error ? "text-ctp-red" : "text-ctp-green"}`}>
          {status}
        </p>
      ) : null}
    </div>
  );
}
