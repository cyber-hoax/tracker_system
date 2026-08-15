"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  chunkWeeks,
  contributionIntensity,
  contributionMonthLabels,
  formatContributionTooltip,
  type ContributionDay,
  type ContributionIntensity,
} from "@/lib/reports/contribution";
import { parseYmd, reportsHref, type ReportTab } from "@/lib/reports/params";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const INTENSITY_CLASS: Record<ContributionIntensity, string> = {
  0: "bg-ctp-crust",
  1: "bg-ctp-green/20",
  2: "bg-ctp-green/40",
  3: "bg-ctp-green/70",
  4: "bg-ctp-green",
};

function routineLogged(day: ContributionDay): boolean {
  return day.walk || day.reading || day.study;
}

function dayNumber(ymd: string): number {
  return parseYmd(ymd).day;
}

type TipState = {
  text: string;
  x: number;
  y: number;
  placeBelow: boolean;
};

function GraphTooltip({ tip }: { tip: TipState | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted || !tip) return null;

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 w-max max-w-64 rounded-md border border-ctp-surface0 bg-ctp-crust px-2 py-1.5 font-mono text-[10px] leading-snug text-ctp-subtext1 shadow-lg"
      style={{
        left: tip.x,
        top: tip.y,
        transform: tip.placeBelow
          ? "translate(-50%, 0)"
          : "translate(-50%, -100%)",
      }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}

function ContributionCell({
  day,
  size,
  hrefTab,
  showDayNumber,
  onTip,
}: {
  day: ContributionDay;
  size: "row" | "month" | "year";
  hrefTab: ReportTab;
  showDayNumber: boolean;
  onTip: (tip: TipState | null) => void;
}) {
  const intensity = contributionIntensity(day.questionCount);
  const tooltip = formatContributionTooltip(day);
  const box =
    size === "row"
      ? "h-8 w-8 sm:h-9 sm:w-9"
      : size === "month"
        ? "w-full min-w-0 aspect-square"
        : "min-h-[11px] w-full min-w-0 flex-1";
  const pip = size === "row" ? "h-1.5 w-1.5" : "h-1 w-1";

  function placeTip(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const placeBelow = rect.top < 88;
    onTip({
      text: tooltip,
      x: rect.left + rect.width / 2,
      y: placeBelow ? rect.bottom + 8 : rect.top - 8,
      placeBelow,
    });
  }

  return (
    <Link
      href={reportsHref(hrefTab, day.ymd)}
      aria-label={tooltip}
      className={`relative block rounded-[3px] ring-1 ring-inset ring-ctp-surface0/80 ${box} ${INTENSITY_CLASS[intensity]} ${
        day.inMonth ? "" : "opacity-35"
      }`}
      onMouseEnter={(event) => placeTip(event.currentTarget)}
      onMouseLeave={() => onTip(null)}
      onFocus={(event) => placeTip(event.currentTarget)}
      onBlur={() => onTip(null)}
    >
      {showDayNumber && day.inMonth ? (
        <span className="absolute inset-0 flex items-start justify-start p-0.5 font-mono text-[9px] leading-none text-ctp-subtext0">
          {dayNumber(day.ymd)}
        </span>
      ) : null}
      {routineLogged(day) ? (
        <span
          aria-hidden
          className={`absolute right-px bottom-px rounded-full bg-ctp-teal ${pip}`}
        />
      ) : null}
    </Link>
  );
}

function IntensityLegend() {
  const levels: ContributionIntensity[] = [0, 1, 2, 3, 4];
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] text-ctp-overlay0">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-ctp-teal" />
        Walk, reading, or study logged
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span>Less</span>
        {levels.map((level) => (
          <span
            key={level}
            className={`h-2.5 w-2.5 rounded-[2px] ring-1 ring-inset ring-ctp-surface0/80 ${INTENSITY_CLASS[level]}`}
          />
        ))}
        <span>More</span>
      </span>
    </div>
  );
}

export function ContributionGraph({
  days,
  layout,
  hrefTab = "day",
}: {
  days: ContributionDay[];
  layout: "row" | "month" | "year";
  hrefTab?: ReportTab;
}) {
  const labelId = useId();
  const [tip, setTip] = useState<TipState | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);

  if (days.length === 0) return null;

  const weeks = chunkWeeks(days);
  const monthLabels = layout === "year" ? contributionMonthLabels(days) : [];
  const showDayNumber = layout === "month";
  const cellSize = layout === "row" ? "row" : layout;

  return (
    <div className="overflow-visible">
      {layout === "row" ? (
        <div className="flex flex-col gap-1.5 overflow-visible pt-10">
          <div className="flex gap-1.5">
            {days.map((day) => (
              <ContributionCell
                key={day.ymd}
                day={day}
                size="row"
                hrefTab={hrefTab}
                showDayNumber={false}
                onTip={setTip}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            {days.map((day, index) => (
              <span
                key={day.ymd}
                className="w-8 text-center font-mono text-[10px] text-ctp-overlay0 sm:w-9"
              >
                {WEEKDAYS[index % 7]}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div
          ref={graphRef}
          className="flex w-full items-stretch gap-2 overflow-visible pt-10"
          aria-labelledby={labelId}
        >
          <div
            className="flex w-8 shrink-0 flex-col gap-[3px] font-mono text-[10px] text-ctp-overlay0"
            aria-hidden
          >
            {layout === "year" ? <span className="h-4 shrink-0" /> : null}
            {WEEKDAYS.map((label) => (
              <span key={label} className="flex flex-1 items-center leading-none">
                {label}
              </span>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 gap-[3px]">
            {weeks.map((week, weekIndex) => (
              <div
                key={week[0]?.ymd ?? weekIndex}
                className="flex min-w-0 flex-1 flex-col gap-[3px]"
              >
                {layout === "year" ? (
                  <span className="h-4 shrink-0 truncate font-mono text-[9px] leading-none text-ctp-overlay0">
                    {monthLabels[weekIndex] ?? ""}
                  </span>
                ) : null}
                {week.map((day) => (
                  <ContributionCell
                    key={day.ymd}
                    day={day}
                    size={cellSize}
                    hrefTab={hrefTab}
                    showDayNumber={showDayNumber}
                    onTip={setTip}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      <GraphTooltip tip={tip} />
      <IntensityLegend />
    </div>
  );
}
