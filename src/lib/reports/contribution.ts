export type ContributionDay = {
  ymd: string;
  questionCount: number;
  walk: boolean;
  reading: boolean;
  study: boolean;
  inMonth: boolean;
};

export type ContributionIntensity = 0 | 1 | 2 | 3 | 4;

export function contributionIntensity(
  questionCount: number,
): ContributionIntensity {
  if (questionCount <= 0) return 0;
  if (questionCount === 1) return 1;
  if (questionCount === 2) return 2;
  if (questionCount === 3) return 3;
  return 4;
}

function formatTooltipDate(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
      .formatToParts(new Date(Date.UTC(year, month - 1, day)))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
}

function loggedLabel(name: string, logged: boolean): string {
  return `${name} ${logged ? "logged" : "not logged"}`;
}

export function chunkWeeks<T>(days: T[]): T[][] {
  const weeks: T[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

function monthShortUtc(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function contributionMonthLabels(days: ContributionDay[]): (string | null)[] {
  return chunkWeeks(days).map((week) => {
    const firstOfMonth = week.find((day) => day.ymd.endsWith("-01"));
    return firstOfMonth ? monthShortUtc(firstOfMonth.ymd) : null;
  });
}

export function formatContributionTooltip(
  day: Pick<
    ContributionDay,
    "ymd" | "questionCount" | "walk" | "reading" | "study"
  >,
): string {
  const questions =
    day.questionCount === 1
      ? "1 question solved"
      : `${day.questionCount} questions solved`;
  return [
    formatTooltipDate(day.ymd),
    questions,
    loggedLabel("Walk", day.walk),
    loggedLabel("Reading", day.reading),
    loggedLabel("Study", day.study),
  ].join(" · ");
}
