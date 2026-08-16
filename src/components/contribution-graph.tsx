"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
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
const YEAR_WEEKDAYS = [0, 2, 4] as const;
const GAP = 3;
const LABEL = 32;

const HEAT_CLASS: Record<ContributionIntensity, string> = {
  0: "bg-[var(--heat-0)]",
  1: "bg-[var(--heat-1)]",
  2: "bg-[var(--heat-2)]",
  3: "bg-[var(--heat-3)]",
  4: "bg-[var(--heat-4)]",
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
      className="pointer-events-none fixed z-50 w-max max-w-64 rounded-lg border border-ctp-surface1 bg-ctp-base px-2.5 py-2 font-mono text-[11px] leading-snug text-ctp-text shadow-xl"
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
  hrefTab,
  showDayNumber,
  isToday,
  onTip,
}: {
  day: ContributionDay;
  hrefTab: ReportTab;
  showDayNumber: boolean;
  isToday: boolean;
  onTip: (tip: TipState | null) => void;
}) {
  const intensity = contributionIntensity(day.questionCount);
  const tooltip = formatContributionTooltip(day);

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
      aria-current={isToday ? "date" : undefined}
      className={`relative block size-full rounded-[2px] ${HEAT_CLASS[intensity]} hover:outline hover:outline-1 hover:outline-offset-0 hover:outline-ctp-text/70 ${
        isToday ? "outline outline-1 outline-ctp-peach" : ""
      } ${day.inMonth ? "" : "opacity-40"}`}
      onMouseEnter={(event) => placeTip(event.currentTarget)}
      onMouseLeave={() => onTip(null)}
      onFocus={(event) => placeTip(event.currentTarget)}
      onBlur={() => onTip(null)}
    >
      {showDayNumber && day.inMonth ? (
        <span className="absolute inset-0 flex items-start justify-start p-0.5 font-mono text-[9px] leading-none text-ctp-subtext1">
          {dayNumber(day.ymd)}
        </span>
      ) : null}
      {routineLogged(day) ? (
        <span
          aria-hidden
          className="absolute right-px bottom-px h-1 w-1 rounded-[1px] bg-ctp-teal"
        />
      ) : null}
    </Link>
  );
}

function IntensityLegend() {
  const levels: ContributionIntensity[] = [0, 1, 2, 3, 4];
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-ctp-subtext0">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-[1px] bg-ctp-teal" />
        Routine logged
      </span>
      <span className="inline-flex items-center gap-1">
        <span>Less</span>
        {levels.map((level) => (
          <span
            key={level}
            className={`size-[11px] rounded-[2px] ${HEAT_CLASS[level]}`}
          />
        ))}
        <span>More</span>
      </span>
    </div>
  );
}

function useSquareCell(weekCount: number, maxPx: number): {
  ref: RefObject<HTMLDivElement | null>;
  size: number;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(11);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    function measure() {
      if (!el) return;
      const available = el.clientWidth - LABEL;
      const next = Math.floor((available - (weekCount - 1) * GAP) / weekCount);
      setSize(Math.max(10, Math.min(maxPx, next)));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [weekCount, maxPx]);

  return { ref, size };
}

export function ContributionGraph({
  days,
  layout,
  hrefTab = "day",
  todayYmd,
}: {
  days: ContributionDay[];
  layout: "row" | "month" | "year";
  hrefTab?: ReportTab;
  todayYmd?: string;
}) {
  const labelId = useId();
  const [tip, setTip] = useState<TipState | null>(null);

  if (days.length === 0) return null;

  const weeks = chunkWeeks(days);
  const monthLabels = layout === "year" ? contributionMonthLabels(days) : [];
  const showDayNumber = layout === "month";

  if (layout === "row") {
    return (
      <div>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-[3px]">
            {days.map((day) => (
              <div key={day.ymd} className="size-9 shrink-0">
                <ContributionCell
                  day={day}
                  hrefTab={hrefTab}
                  showDayNumber={false}
                  isToday={day.ymd === todayYmd}
                  onTip={setTip}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {days.map((day, index) => (
              <span
                key={day.ymd}
                className="w-9 text-center font-mono text-[11px] text-ctp-subtext0"
              >
                {WEEKDAYS[index % 7]}
              </span>
            ))}
          </div>
        </div>
        <GraphTooltip tip={tip} />
        <IntensityLegend />
      </div>
    );
  }

  return (
    <HeatGrid
      weeks={weeks}
      monthLabels={monthLabels}
      layout={layout}
      hrefTab={hrefTab}
      todayYmd={todayYmd}
      showDayNumber={showDayNumber}
      labelId={labelId}
      onTip={setTip}
      tip={tip}
    />
  );
}

function HeatGrid({
  weeks,
  monthLabels,
  layout,
  hrefTab,
  todayYmd,
  showDayNumber,
  labelId,
  onTip,
  tip,
}: {
  weeks: ContributionDay[][];
  monthLabels: (string | null)[];
  layout: "month" | "year";
  hrefTab: ReportTab;
  todayYmd?: string;
  showDayNumber: boolean;
  labelId: string;
  onTip: (tip: TipState | null) => void;
  tip: TipState | null;
}) {
  const { ref, size } = useSquareCell(
    weeks.length,
    layout === "month" ? 48 : Number.POSITIVE_INFINITY,
  );

  return (
    <div>
      <div ref={ref} className="w-full overflow-x-auto">
        <div
          className="grid"
          aria-labelledby={labelId}
          style={{
            width: "100%",
            gridTemplateColumns: `${LABEL}px repeat(${weeks.length}, minmax(0, 1fr))`,
            gridTemplateRows:
              layout === "year"
                ? `16px repeat(7, ${size}px)`
                : `repeat(7, ${size}px)`,
            columnGap: GAP,
            rowGap: GAP,
          }}
        >
          {layout === "year"
            ? monthLabels.map((label, weekIndex) =>
                label ? (
                  <span
                    key={`m-${weekIndex}`}
                    className="whitespace-nowrap font-mono text-[11px] leading-none text-ctp-subtext1"
                    style={{ gridColumn: weekIndex + 2, gridRow: 1 }}
                  >
                    {label}
                  </span>
                ) : null,
              )
            : null}
          {WEEKDAYS.map((label, dayIndex) => {
            const show =
              layout === "month" ||
              YEAR_WEEKDAYS.includes(dayIndex as (typeof YEAR_WEEKDAYS)[number]);
            return (
              <span
                key={label}
                className="flex items-center font-mono text-[10px] leading-none text-ctp-subtext0"
                style={{
                  gridColumn: 1,
                  gridRow: dayIndex + (layout === "year" ? 2 : 1),
                }}
              >
                {show ? label : ""}
              </span>
            );
          })}
          {weeks.map((week, weekIndex) =>
            week.map((day, dayIndex) => (
              <div
                key={day.ymd}
                className="size-full"
                style={{
                  gridColumn: weekIndex + 2,
                  gridRow: dayIndex + (layout === "year" ? 2 : 1),
                }}
              >
                <ContributionCell
                  day={day}
                  hrefTab={hrefTab}
                  showDayNumber={showDayNumber}
                  isToday={day.ymd === todayYmd}
                  onTip={onTip}
                />
              </div>
            )),
          )}
        </div>
      </div>
      <GraphTooltip tip={tip} />
      <IntensityLegend />
    </div>
  );
}
