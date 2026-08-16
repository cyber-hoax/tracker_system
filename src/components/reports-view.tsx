import Link from "next/link";
import { SegmentChip } from "@/app/components/segment-chip";
import { ContributionGraph } from "@/components/contribution-graph";
import { ReportControls } from "@/components/report-controls";
import { parseYmd, reportsHref } from "@/lib/reports/params";
import type {
  CalendarGrid,
  DayReport,
  MonthReport,
  ReportTab,
  SolvedProblem,
  WeekReport,
  YearHeatmap,
} from "@/lib/reports/compute";
import { formatDateTime12 } from "@/lib/timezone";

const panelClass = "rounded-2xl border border-ctp-surface0 bg-ctp-mantle p-5";

const SUBJECT_LABEL: Record<string, string> = {
  dsa: "DSA",
  lld: "LLD",
  hld: "HLD",
  ai: "AI",
  walk: "Walk",
  reading: "Reading",
  review: "Review",
  other: "Other",
};

const PIP_CLASS: Record<string, string> = {
  dsa: "bg-ctp-peach",
  walk: "bg-ctp-green",
  reading: "bg-ctp-blue",
  other: "bg-ctp-mauve",
};

const HOUR_ORDER = ["dsa", "hld", "lld", "ai", "reading"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatLong(ymd: string): string {
  const { year, month, day } = parseYmd(ymd);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatShort(ymd: string): string {
  const { year, month, day } = parseYmd(ymd);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function monthTitle(ymd: string): string {
  const { year, month } = parseYmd(ymd);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function hoursLabel(value: number): string {
  return `${value}h`;
}

function targetLabel(min: number, max: number): string {
  return min === max ? `${min}h` : `${min}–${max}h`;
}

function QuestionList({ questions }: { questions: SolvedProblem[] }) {
  if (questions.length === 0) {
    return (
      <p className="text-sm text-ctp-overlay0">No questions solved in this range.</p>
    );
  }
  return (
    <ul className="divide-y divide-ctp-surface0 border border-ctp-surface0 bg-ctp-base">
      {questions.map((problem) => (
        <li key={problem.id}>
          <Link
            href={`/dsa/${problem.slug}`}
            className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-ctp-mantle"
          >
            <span className="flex-1 text-sm text-ctp-text">{problem.title}</span>
            {problem.difficulty ? (
              <SegmentChip kind="difficulty" value={problem.difficulty} />
            ) : null}
            {problem.status ? (
              <SegmentChip kind="status" value={problem.status} />
            ) : null}
            {problem.patterns.map((pattern) => (
              <SegmentChip key={pattern} kind="pattern" value={pattern} />
            ))}
            {problem.revisionCount != null ? (
              <span className="font-mono text-xs text-ctp-overlay0">
                rev {problem.revisionCount}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DayBreakdown({
  report,
  timeZone,
}: {
  report: DayReport;
  timeZone: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
            {report.dayLabel}
          </p>
          <h2 className="mt-1 text-2xl text-ctp-text">{formatLong(report.date)}</h2>
        </div>
        <p className="font-mono text-3xl text-ctp-mauve">
          {report.completedCount}
          <span className="text-ctp-overlay0">/{report.expectedCount}</span>
        </p>
      </div>

      <section className={panelClass}>
        <h3 className="mb-4 text-lg font-medium">Routine blocks</h3>
        <ul className="space-y-3">
          {report.blocks.map((block) => (
            <li
              key={block.subject}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-ctp-surface0 pb-3 last:border-0 last:pb-0"
            >
              <div>
                <p className="text-sm text-ctp-text">
                  {SUBJECT_LABEL[block.subject] ?? block.subject}
                </p>
                <p className="font-mono text-xs text-ctp-overlay0">
                  {block.loggedMinutes}m / {block.expectedMinutes}m
                  {block.subject === "dsa" && report.proratedTargets.dsaMinutes
                    ? ` · weekly target prorated ${report.proratedTargets.dsaMinutes}m`
                    : ""}
                </p>
              </div>
              <span
                className={`font-mono text-xs ${
                  block.done ? "text-ctp-green" : "text-ctp-overlay0"
                }`}
              >
                {block.done ? "done" : "missing"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-mono text-sm text-ctp-subtext0">
          Study {report.studyMinutes}m
        </p>
      </section>

      <section className={panelClass}>
        <h3 className="mb-4 text-lg font-medium">
          Questions{" "}
          <span className="font-mono text-ctp-peach">{report.questions.length}</span>
        </h3>
        <QuestionList questions={report.questions} />
      </section>

      {report.sessions.length > 0 ? (
        <section className={panelClass}>
          <h3 className="mb-4 text-lg font-medium">Sessions</h3>
          <ul className="list-none p-0">
            {report.sessions.map((session) => (
              <li
                key={session.id}
                className="border-t border-ctp-surface0 py-2.5 text-sm text-ctp-subtext1 first:border-0"
              >
                <span className="mr-2 inline-block font-mono text-[11px] uppercase tracking-wider text-ctp-peach">
                  {session.subject}
                </span>
                {formatDateTime12(new Date(session.ts), timeZone)} · {session.minutes}m
                {session.problems_count ? ` · ${session.problems_count} problems` : ""}
                {session.notes ? ` — ${session.notes}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function WeekView({
  report,
  todayYmd,
}: {
  report: WeekReport;
  todayYmd: string;
}) {
  const maxMinutes = Math.max(1, ...report.dayBars.map((bar) => bar.minutes));
  const hourRows = [
    ...HOUR_ORDER.filter((key) => report.hours[key]),
    ...Object.keys(report.hours).filter((key) => !HOUR_ORDER.includes(key)),
  ];

  return (
    <div className="space-y-5">
      <h2 className="text-2xl text-ctp-text">
        {formatShort(report.weekStart)} – {formatShort(report.weekEnd)}
      </h2>

      <section className={`${panelClass} overflow-visible`}>
        <h3 className="mb-1 text-lg font-medium">Questions per day</h3>
        <p className="mb-4 text-sm text-ctp-subtext0">
          Color is how many questions you solved. The teal bar means walk,
          reading, or study was logged.
        </p>
        <ContributionGraph days={report.contributionDays} layout="row" todayYmd={todayYmd} />
      </section>

      <section className={panelClass}>
        <h3 className="mb-4 text-lg font-medium">Hours vs targets</h3>
        <ul className="space-y-3">
          {hourRows.map((subject) => {
            const row = report.hours[subject];
            if (!row) return null;
            return (
              <li
                key={subject}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>{SUBJECT_LABEL[subject] ?? subject}</span>
                <span className="font-mono text-ctp-text">
                  {hoursLabel(row.logged)}
                  {row.target
                    ? ` / ${targetLabel(row.target.min, row.target.max)}`
                    : ""}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap gap-4 font-mono text-sm text-ctp-subtext0">
          <span>
            Walk{" "}
            <span className="text-ctp-green">
              {report.walkDays}/{report.walkExpected}
            </span>
          </span>
          <span>
            Reading{" "}
            <span className="text-ctp-blue">
              {report.readingDays}/{report.readingExpected}
            </span>
          </span>
          <span>
            Study{" "}
            <span className="text-ctp-peach">
              {hoursLabel(Math.round((report.studyMinutes / 60) * 10) / 10)}
            </span>
          </span>
        </div>
      </section>

      <section className={panelClass}>
        <h3 className="mb-4 text-lg font-medium">Minutes per day</h3>
        <div className="flex h-36 items-end gap-2">
          {report.dayBars.map((bar) => {
            const pct = Math.round((100 * bar.minutes) / maxMinutes);
            return (
              <Link
                key={bar.ymd}
                href={reportsHref("day", bar.ymd)}
                className="flex min-w-0 flex-1 flex-col items-center gap-1 text-ctp-overlay0 hover:text-ctp-text"
              >
                <span className="font-mono text-[11px]">{bar.minutes}</span>
                <div className="flex h-24 w-full items-end rounded-sm bg-ctp-surface0">
                  <div
                    className="w-full rounded-sm bg-ctp-peach"
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[11px]">{bar.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={panelClass}>
        <h3 className="mb-4 text-lg font-medium">
          DSA problems{" "}
          <span className="font-mono text-ctp-peach">{report.dsaProblemCount}</span>
        </h3>
        <QuestionList questions={report.questions} />
      </section>

      <section className={panelClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-medium">Sunday review</h3>
          <Link href="/#review-form" className="font-mono text-xs text-ctp-blue">
            Edit on Today
          </Link>
        </div>
        {report.review ? (
          <dl className="space-y-3 text-sm">
            {(
              [
                ["DSA", report.review.dsa],
                ["LLD", report.review.lld],
                ["HLD", report.review.hld],
                ["AI", report.review.ai],
                ["Personal", report.review.personal],
              ] as const
            ).map(([label, value]) =>
              value.trim() ? (
                <div key={label}>
                  <dt className="font-mono text-[11px] uppercase tracking-wider text-ctp-overlay0">
                    {label}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-ctp-subtext1">{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
        ) : (
          <p className="text-sm text-ctp-overlay0">
            No weekly review saved for this week yet.
          </p>
        )}
      </section>
    </div>
  );
}

function MonthView({
  report,
  todayYmd,
}: {
  report: MonthReport;
  todayYmd: string;
}) {
  const mix = ["easy", "medium", "hard"].filter(
    (key) => report.difficultyMix[key],
  );
  return (
    <div className="space-y-5">
      <h2 className="text-2xl text-ctp-text">{monthTitle(report.start)}</h2>
      <p className="text-sm text-ctp-overlay0">
        Through {formatShort(report.clippedEnd)}
        {report.clippedEnd !== report.end ? " (month still in progress)" : ""}.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className={panelClass}>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
            Questions
          </p>
          <p className="mt-2 font-mono text-4xl text-ctp-peach">{report.questionCount}</p>
        </article>
        <article className={panelClass}>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
            Study hours
          </p>
          <p className="mt-2 font-mono text-4xl text-ctp-mauve">
            {hoursLabel(report.studyHours)}
          </p>
        </article>
        <article className={panelClass}>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
            Routine adherence
          </p>
          <p className="mt-2 font-mono text-4xl text-ctp-green">
            {report.adherence.percent}%
          </p>
          <p className="mt-2 font-mono text-xs text-ctp-overlay0">
            {report.adherence.completed}/{report.adherence.expected} expected
            walk, reading, and DSA days
          </p>
        </article>
      </div>

      <section className={`${panelClass} overflow-visible`}>
        <h3 className="mb-1 text-lg font-medium">Questions per day</h3>
        <p className="mb-4 text-sm text-ctp-subtext0">
          Color is how many questions you solved. The teal bar means walk,
          reading, or study was logged.
        </p>
        <ContributionGraph
          days={report.contributionDays}
          layout="month"
          todayYmd={todayYmd}
        />
      </section>

      <section className={panelClass}>
        <h3 className="mb-4 text-lg font-medium">Difficulty mix</h3>
        {mix.length === 0 ? (
          <p className="text-sm text-ctp-overlay0">No difficulty data yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {mix.map((key) => (
              <li key={key} className="flex items-center gap-2">
                <SegmentChip kind="difficulty" value={key} />
                <span className="font-mono text-sm text-ctp-text">
                  {report.difficultyMix[key]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panelClass}>
        <h3 className="mb-4 text-lg font-medium">Top patterns</h3>
        {report.topPatterns.length === 0 ? (
          <p className="text-sm text-ctp-overlay0">No patterns tagged yet.</p>
        ) : (
          <ol className="space-y-2">
            {report.topPatterns.slice(0, 8).map((pattern) => (
              <li
                key={pattern.name}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <SegmentChip kind="pattern" value={pattern.name} />
                <span className="font-mono text-ctp-text">{pattern.count}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={panelClass}>
        <h3 className="mb-4 text-lg font-medium">Questions</h3>
        <QuestionList questions={report.questions} />
      </section>
    </div>
  );
}

function CalendarView({
  year,
  grid,
  date,
  todayYmd,
  day,
  timeZone,
}: {
  year: YearHeatmap;
  grid: CalendarGrid;
  date: string;
  todayYmd: string;
  day: DayReport;
  timeZone: string;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl text-ctp-text">{year.year}</h2>
      <section className={`${panelClass} overflow-visible`}>
        <h3 className="mb-1 text-lg font-medium">Questions per day</h3>
        <p className="mb-4 text-sm text-ctp-subtext0">
          Color is how many questions you solved. The teal bar means walk,
          reading, or study was logged.
        </p>
        <ContributionGraph
          days={year.days}
          layout="year"
          hrefTab="calendar"
          todayYmd={todayYmd}
        />
      </section>
      <section className={panelClass}>
        <h3 className="mb-4 text-lg font-medium">{monthTitle(grid.monthStart)}</h3>
        <div className="mb-3 flex flex-wrap gap-4 font-mono text-xs text-ctp-subtext0">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ctp-peach" /> DSA
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ctp-green" /> Walk
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ctp-blue" /> Reading
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ctp-mauve" /> Other
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-7 gap-px bg-ctp-surface0">
            {WEEKDAYS.map((label) => (
              <div
                key={label}
                className="bg-ctp-mantle px-2 py-2 text-center font-mono text-[11px] uppercase tracking-wider text-ctp-overlay0"
              >
                {label}
              </div>
            ))}
            {grid.cells.map((cell) => {
              const selected = cell.ymd === date;
              const isToday = cell.ymd === todayYmd;
              return (
                <Link
                  key={cell.ymd}
                  href={reportsHref("calendar", cell.ymd)}
                  className={`min-h-[7.5rem] bg-ctp-base p-2 hover:bg-ctp-mantle ${
                    cell.inMonth ? "" : "opacity-40"
                  } ${selected ? "ring-2 ring-inset ring-ctp-mauve" : ""}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={`font-mono text-sm ${
                        isToday ? "text-ctp-peach" : "text-ctp-text"
                      }`}
                    >
                      {cell.day}
                    </span>
                    {cell.questionCount > 0 ? (
                      <span className="font-mono text-xs text-ctp-peach">
                        {cell.questionCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex gap-1">
                    {cell.pips.map((pip) => (
                      <span
                        key={pip}
                        className={`h-2 w-2 rounded-full ${PIP_CLASS[pip]}`}
                        title={pip}
                      />
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <DayBreakdown report={day} timeZone={timeZone} />
    </div>
  );
}

export function ReportsView({
  tab,
  date,
  todayYmd,
  timeZone,
  day,
  week,
  month,
  calendar,
  year,
}: {
  tab: ReportTab;
  date: string;
  todayYmd: string;
  timeZone: string;
  day: DayReport | null;
  week: WeekReport | null;
  month: MonthReport | null;
  calendar: CalendarGrid | null;
  year: YearHeatmap | null;
}) {
  return (
    <main data-reports className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
            Tracking
          </p>
          <h1 className="mt-1 text-2xl text-ctp-text">Reports</h1>
          <p className="mt-2 max-w-2xl text-sm text-ctp-subtext0">
            Questions solved and how closely the routine was followed. Today stays
            the coach; this page is the record.
          </p>
        </div>
      </div>
      <ReportControls tab={tab} date={date} />
      {tab === "day" && day ? (
        <DayBreakdown report={day} timeZone={timeZone} />
      ) : null}
      {tab === "week" && week ? (
        <WeekView report={week} todayYmd={todayYmd} />
      ) : null}
      {tab === "month" && month ? (
        <MonthView report={month} todayYmd={todayYmd} />
      ) : null}
      {tab === "calendar" && calendar && year && day ? (
        <CalendarView
          year={year}
          grid={calendar}
          date={date}
          todayYmd={todayYmd}
          day={day}
          timeZone={timeZone}
        />
      ) : null}
    </main>
  );
}
