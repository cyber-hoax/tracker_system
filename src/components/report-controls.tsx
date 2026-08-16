"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  REPORT_TABS,
  reportsHref,
  shiftDate,
  type ReportTab,
} from "@/lib/reports/params";

const TAB_LABELS: Record<ReportTab, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  calendar: "Calendar",
};

export function ReportControls({
  tab,
  date,
}: {
  tab: ReportTab;
  date: string;
}) {
  const router = useRouter();
  const prev = shiftDate(date, tab, -1);
  const next = shiftDate(date, tab, 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <nav aria-label="Report range" className="flex flex-wrap items-center">
        {REPORT_TABS.map((item, index) => {
          const active = item === tab;
          return (
            <Link
              key={item}
              href={reportsHref(item, date)}
              className={`powerline-seg font-mono text-xs ${
                active
                  ? "bg-ctp-mauve text-ctp-crust"
                  : "bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1 hover:text-ctp-text"
              } ${index === 0 ? "powerline-seg-first" : ""}`}
            >
              {TAB_LABELS[item]}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={reportsHref(tab, prev)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ctp-surface1 text-ctp-subtext0 hover:text-ctp-text"
          aria-label={tab === "calendar" ? "Previous year" : `Previous ${tab}`}
        >
          <CaretLeft size={20} weight="bold" />
        </Link>
        <label className="font-mono text-xs text-ctp-overlay0">
          {tab === "calendar" ? "Year" : "Date"}
          <input
            type="date"
            value={date}
            onChange={(event) => {
              const nextDate = event.target.value;
              if (!nextDate) return;
              router.push(reportsHref(tab, nextDate));
            }}
            className="ml-2 rounded-lg border border-ctp-surface0 bg-ctp-base px-2 py-1.5 font-mono text-sm text-ctp-text outline-none focus:border-ctp-mauve"
          />
        </label>
        <Link
          href={reportsHref(tab, next)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ctp-surface1 text-ctp-subtext0 hover:text-ctp-text"
          aria-label={tab === "calendar" ? "Next year" : `Next ${tab}`}
        >
          <CaretRight size={20} weight="bold" />
        </Link>
      </div>
    </div>
  );
}
