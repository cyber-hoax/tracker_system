import { describe, expect, it } from "vitest";
import type { Routine } from "@/lib/types";
import {
  buildCalendarGrid,
  buildContributionDays,
  computeDayReport,
  computeMonthReport,
  computeWeekReport,
  monthBounds,
  parseHourTarget,
  parseReportParams,
  parseYmd,
  reportRange,
  shiftDate,
  weekBounds,
  yearBounds,
  yearCalendarRange,
} from "./compute";
import {
  chunkWeeks,
  contributionMonthLabels,
} from "./contribution";

const TZ = "Asia/Kolkata";

const mondayBlocks = [
  {
    start: "19:30",
    end: "21:00",
    title: "DSA",
    kind: "study",
    subject: "dsa",
  },
  {
    start: "22:00",
    end: "22:20",
    title: "Walk",
    kind: "walk",
    subject: "walk",
  },
  {
    start: "22:20",
    end: "23:20",
    title: "LLD",
    kind: "study",
    subject: "lld",
  },
  {
    start: "23:20",
    end: "23:50",
    title: "Reading",
    kind: "reading",
    subject: "reading",
  },
];

const routine: Routine = {
  weekly_hours: {
    dsa: "9–10",
    hld: "4–5",
    lld: "3–4",
    ai: "3–4",
    reading: "3.5",
  },
  days: {
    mon: {
      label: "Monday",
      kind: "office",
      summary: "DSA then LLD",
      blocks: mondayBlocks,
    },
    tue: {
      label: "Tuesday",
      kind: "office",
      summary: "DSA then HLD",
      blocks: mondayBlocks.map((block) =>
        block.subject === "lld" ? { ...block, subject: "hld", title: "HLD" } : block,
      ),
    },
    wed: {
      label: "Wednesday",
      kind: "office",
      summary: "DSA then AI",
      blocks: mondayBlocks.map((block) =>
        block.subject === "lld" ? { ...block, subject: "ai", title: "AI" } : block,
      ),
    },
    thu: {
      label: "Thursday",
      kind: "deep_work",
      summary: "DSA then design",
      blocks: mondayBlocks,
    },
    fri: {
      label: "Friday",
      kind: "office",
      summary: "DSA then design",
      blocks: mondayBlocks,
    },
    sat: {
      label: "Saturday",
      kind: "weekend_focus",
      summary: "Long DSA",
      blocks: [
        {
          start: "10:00",
          end: "12:00",
          title: "DSA",
          kind: "study",
          subject: "dsa",
        },
        {
          start: "22:00",
          end: "22:20",
          title: "Walk",
          kind: "walk",
          subject: "walk",
        },
        {
          start: "23:30",
          end: "00:00",
          title: "Reading",
          kind: "reading",
          subject: "reading",
        },
      ],
    },
    sun: {
      label: "Sunday",
      kind: "weekend_review",
      summary: "Mocks",
      blocks: [
        {
          start: "10:00",
          end: "12:00",
          title: "DSA mock",
          kind: "study",
          subject: "dsa",
        },
        {
          start: "22:00",
          end: "22:20",
          title: "Walk",
          kind: "walk",
          subject: "walk",
        },
        {
          start: "23:20",
          end: "23:50",
          title: "Reading",
          kind: "reading",
          subject: "reading",
        },
      ],
    },
  },
};

function session(ymd: string, subject: string, minutes: number, hour = 19) {
  return {
    id: `${ymd}-${subject}-${hour}`,
    ts: `${ymd}T${String(hour).padStart(2, "0")}:30:00+05:30`,
    subject,
    minutes,
    notes: "",
    problems_count: subject === "dsa" ? 1 : 0,
    extra: {},
  };
}

describe("parseHourTarget", () => {
  it("parses an en-dash range into min, max, and midpoint", () => {
    expect(parseHourTarget("9–10")).toEqual({ min: 9, max: 10, mid: 9.5 });
  });

  it("parses a hyphen range and a single number", () => {
    expect(parseHourTarget("3-4")).toEqual({ min: 3, max: 4, mid: 3.5 });
    expect(parseHourTarget("3.5")).toEqual({ min: 3.5, max: 3.5, mid: 3.5 });
  });
});

describe("parseReportParams", () => {
  it("defaults to the day tab and today when params are missing", () => {
    expect(parseReportParams({}, "2026-08-15")).toEqual({
      tab: "day",
      date: "2026-08-15",
    });
  });

  it("accepts week/month/calendar tabs and a YYYY-MM-DD date", () => {
    expect(
      parseReportParams({ tab: "calendar", date: "2026-08-10" }, "2026-08-15"),
    ).toEqual({ tab: "calendar", date: "2026-08-10" });
  });

  it("falls back when tab or date is invalid", () => {
    expect(
      parseReportParams({ tab: "yearly", date: "15-08-2026" }, "2026-08-15"),
    ).toEqual({ tab: "day", date: "2026-08-15" });
  });
});

describe("weekBounds and monthBounds", () => {
  it("starts the week on Monday for a Saturday date", () => {
    expect(weekBounds("2026-08-15")).toEqual({
      start: "2026-08-10",
      end: "2026-08-16",
    });
  });

  it("returns the inclusive month span", () => {
    expect(monthBounds("2026-08-15")).toEqual({
      start: "2026-08-01",
      end: "2026-08-31",
    });
  });
});

describe("yearBounds and calendar year range", () => {
  it("spans Jan 1 through Dec 31 of the selected year", () => {
    expect(yearBounds("2026-08-15")).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
    });
  });

  it("pads the year heatmap to Monday–Sunday weeks", () => {
    expect(yearCalendarRange("2026-08-15")).toEqual({
      start: "2025-12-29",
      end: "2027-01-03",
    });
  });

  it("queries the padded year when the calendar tab is selected", () => {
    expect(reportRange("calendar", "2026-08-15")).toEqual({
      start: "2025-12-29",
      end: "2027-01-03",
    });
  });

  it("keeps month tab on that month only", () => {
    expect(reportRange("month", "2026-08-15")).toEqual({
      start: "2026-08-01",
      end: "2026-08-31",
    });
  });
});

describe("computeDayReport", () => {
  it("marks walk, reading, DSA minutes, and secondary subject against Monday blocks", () => {
    const report = computeDayReport({
      date: "2026-08-10",
      timeZone: TZ,
      routine,
      sessions: [
        session("2026-08-10", "dsa", 90),
        session("2026-08-10", "walk", 20, 22),
        session("2026-08-10", "lld", 50, 22),
      ],
      problems: [
        {
          id: "p1",
          title: "Two Sum",
          slug: "two-sum",
          difficulty: "easy",
          patterns: ["hash map"],
          lastSolved: "2026-08-10",
          revisionCount: 2,
        },
      ],
    });

    expect(report.blocks.find((b) => b.subject === "walk")?.done).toBe(true);
    expect(report.blocks.find((b) => b.subject === "reading")?.done).toBe(false);
    expect(report.blocks.find((b) => b.subject === "dsa")?.loggedMinutes).toBe(90);
    expect(report.blocks.find((b) => b.subject === "dsa")?.expectedMinutes).toBe(90);
    expect(report.blocks.find((b) => b.subject === "lld")?.done).toBe(true);
    expect(report.questions).toHaveLength(1);
    expect(report.questions[0]?.title).toBe("Two Sum");
    expect(report.completedCount).toBe(3);
    expect(report.expectedCount).toBe(4);
  });

  it("prorates weekly DSA hours by that day's share of weekly DSA minutes", () => {
    const report = computeDayReport({
      date: "2026-08-10",
      timeZone: TZ,
      routine,
      sessions: [session("2026-08-10", "dsa", 90)],
      problems: [],
    });
    // Week DSA minutes: 90*5 weekdays + 120*2 weekend = 690.
    // Monday share 90/690 * 9.5h = 1.239h ≈ 74 min.
    expect(report.proratedTargets.dsaMinutes).toBe(74);
    expect(report.studyMinutes).toBe(90);
  });
});

describe("computeWeekReport", () => {
  it("aggregates hours, habit days, daily bars, and problems for the Monday week", () => {
    const report = computeWeekReport({
      date: "2026-08-15",
      timeZone: TZ,
      routine,
      sessions: [
        session("2026-08-10", "dsa", 90),
        session("2026-08-10", "walk", 20, 22),
        session("2026-08-11", "dsa", 60),
        session("2026-08-11", "reading", 30, 23),
        session("2026-08-12", "hld", 45, 22),
      ],
      problems: [
        {
          id: "p1",
          title: "Two Sum",
          slug: "two-sum",
          difficulty: "easy",
          patterns: ["hash map"],
          lastSolved: "2026-08-10",
        },
        {
          id: "p2",
          title: "LRU Cache",
          slug: "lru-cache",
          difficulty: "medium",
          patterns: ["linked list"],
          lastSolved: "2026-08-12",
        },
      ],
      review: {
        id: "r1",
        week_start: "2026-08-10",
        created_at: "2026-08-16T12:00:00.000Z",
        dsa: "Two pointers felt slow",
        lld: "",
        hld: "",
        ai: "",
        personal: "Walks were consistent",
      },
    });

    expect(report.weekStart).toBe("2026-08-10");
    expect(report.weekEnd).toBe("2026-08-16");
    expect(report.hours.dsa.logged).toBe(2.5);
    expect(report.hours.dsa.target).toEqual({ min: 9, max: 10, mid: 9.5 });
    expect(report.walkDays).toBe(1);
    expect(report.walkExpected).toBe(7);
    expect(report.readingDays).toBe(1);
    expect(report.readingExpected).toBe(7);
    expect(report.dsaProblemCount).toBe(2);
    expect(report.dayBars).toHaveLength(7);
    expect(report.dayBars[0]?.ymd).toBe("2026-08-10");
    expect(report.dayBars[0]?.minutes).toBe(90);
    expect(report.review?.dsa).toBe("Two pointers felt slow");
    expect(report.contributionDays).toHaveLength(7);
    expect(report.contributionDays[0]).toMatchObject({
      ymd: "2026-08-10",
      questionCount: 1,
      walk: true,
      study: true,
    });
  });
});

describe("computeMonthReport", () => {
  it("counts questions, difficulty mix, top patterns, hours, and clipped adherence", () => {
    const report = computeMonthReport({
      date: "2026-08-15",
      timeZone: TZ,
      routine,
      sessions: [
        session("2026-08-01", "walk", 20, 22),
        session("2026-08-01", "reading", 30, 23),
        session("2026-08-01", "dsa", 90),
        session("2026-08-10", "dsa", 90),
        session("2026-08-10", "walk", 20, 22),
        session("2026-08-20", "dsa", 90),
      ],
      problems: [
        {
          id: "p1",
          title: "Two Sum",
          slug: "two-sum",
          difficulty: "easy",
          patterns: ["hash map", "arrays"],
          lastSolved: "2026-08-01",
        },
        {
          id: "p2",
          title: "Median",
          slug: "median",
          difficulty: "hard",
          patterns: ["binary search"],
          lastSolved: "2026-08-10",
        },
        {
          id: "p3",
          title: "Group Anagrams",
          slug: "group-anagrams",
          difficulty: "medium",
          patterns: ["hash map"],
          lastSolved: "2026-08-10",
        },
      ],
      asOf: "2026-08-15",
    });

    expect(report.questionCount).toBe(3);
    expect(report.difficultyMix).toEqual({ easy: 1, medium: 1, hard: 1 });
    expect(report.topPatterns[0]).toEqual({ name: "hash map", count: 2 });
    expect(report.studyHours).toBe(3);
    // Aug 1–15 inclusive = 15 days; each expects walk + reading + DSA.
    // Logged: walk 2, reading 1, DSA 2. Future Aug 20 ignored.
    expect(report.adherence).toEqual({
      completed: 5,
      expected: 45,
      percent: 11,
    });
    const inMonth = report.contributionDays.filter((day) => day.inMonth);
    expect(inMonth.map((day) => day.ymd)).toEqual(
      Array.from({ length: 31 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`),
    );
  });
});

describe("buildContributionDays", () => {
  it("counts solved questions and routine flags for each day in the range", () => {
    const days = buildContributionDays({
      start: "2026-08-10",
      end: "2026-08-16",
      timeZone: TZ,
      sessions: [
        session("2026-08-10", "dsa", 90),
        session("2026-08-10", "walk", 20, 22),
        session("2026-08-11", "reading", 30, 23),
        session("2026-08-12", "hld", 45, 22),
      ],
      problems: [
        {
          id: "p1",
          title: "Two Sum",
          slug: "two-sum",
          patterns: [],
          lastSolved: "2026-08-10",
        },
        {
          id: "p2",
          title: "LRU Cache",
          slug: "lru-cache",
          patterns: [],
          lastSolved: "2026-08-12",
        },
      ],
    });

    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({
      ymd: "2026-08-10",
      questionCount: 1,
      walk: true,
      reading: false,
      study: true,
      inMonth: true,
    });
    expect(days[1]).toMatchObject({
      ymd: "2026-08-11",
      questionCount: 0,
      walk: false,
      reading: true,
      study: false,
    });
    expect(days[2]).toMatchObject({
      ymd: "2026-08-12",
      questionCount: 1,
      study: true,
    });
  });

  it("marks days outside monthStart/monthEnd as out of month", () => {
    const days = buildContributionDays({
      start: "2026-07-27",
      end: "2026-08-02",
      monthStart: "2026-08-01",
      monthEnd: "2026-08-31",
      timeZone: TZ,
      sessions: [],
      problems: [],
    });
    expect(days[0]?.ymd).toBe("2026-07-27");
    expect(days[0]?.inMonth).toBe(false);
    expect(days.at(-1)?.ymd).toBe("2026-08-02");
    expect(days.at(-1)?.inMonth).toBe(true);
  });
});

describe("buildCalendarGrid", () => {
  it("pads August 2026 from Monday Jul 27 through Sunday Sep 6", () => {
    const grid = buildCalendarGrid({
      date: "2026-08-15",
      timeZone: TZ,
      routine,
      sessions: [
        session("2026-08-15", "dsa", 90),
        session("2026-08-15", "walk", 20, 22),
        session("2026-08-15", "reading", 30, 23),
        session("2026-08-15", "lld", 40, 22),
      ],
      problems: [
        {
          id: "p1",
          title: "Two Sum",
          slug: "two-sum",
          patterns: [],
          lastSolved: "2026-08-15",
        },
        {
          id: "p2",
          title: "Three Sum",
          slug: "three-sum",
          patterns: [],
          lastSolved: "2026-08-15",
        },
      ],
    });

    expect(grid.cells[0]?.ymd).toBe("2026-07-27");
    expect(grid.cells[0]?.inMonth).toBe(false);
    expect(grid.cells.at(-1)?.ymd).toBe("2026-09-06");
    const sat = grid.cells.find((cell) => cell.ymd === "2026-08-15");
    expect(sat?.inMonth).toBe(true);
    expect(sat?.questionCount).toBe(2);
    expect(sat?.pips).toEqual(["dsa", "walk", "reading", "other"]);
    expect(grid.cells).toHaveLength(42);
  });
});

describe("year heatmap layout helpers", () => {
  it("groups days into 7-row week columns and labels the week that contains the 1st", () => {
    const days = buildContributionDays({
      start: "2025-12-29",
      end: "2026-01-11",
      monthStart: "2026-01-01",
      monthEnd: "2026-12-31",
      timeZone: TZ,
      sessions: [],
      problems: [],
    });
    const weeks = chunkWeeks(days);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toHaveLength(7);
    expect(contributionMonthLabels(days)).toEqual(["Jan", null]);
  });
});

describe("parseYmd", () => {
  it("splits a calendar date", () => {
    expect(parseYmd("2026-08-15")).toEqual({ year: 2026, month: 8, day: 15 });
  });
});

describe("shiftDate", () => {
  it("moves day/week/month anchors without overflowing shorter months", () => {
    expect(shiftDate("2026-08-15", "day", -1)).toBe("2026-08-14");
    expect(shiftDate("2026-08-15", "week", 1)).toBe("2026-08-22");
    expect(shiftDate("2026-03-31", "month", 1)).toBe("2026-04-30");
    expect(shiftDate("2026-08-15", "calendar", -1)).toBe("2025-08-15");
    expect(shiftDate("2024-02-29", "calendar", 1)).toBe("2025-02-28");
  });
});
