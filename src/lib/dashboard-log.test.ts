import { describe, expect, it } from "vitest";
import {
  alreadyLogged,
  applyLoggedSession,
  applyUnloggedSession,
  blockCtaMinutes,
  blockCtaName,
  blockLogKey,
  sessionForQuickLog,
  timelineChip,
} from "./dashboard-log";
import type { Briefing, EnrichedBlock, SessionRecord } from "./types";

function briefing(overrides: Partial<Briefing> = {}): Briefing {
  return {
    now: "2026-08-18T13:45:00.000Z",
    timezone: "Asia/Kolkata",
    day_key: "tue",
    day_label: "Tuesday",
    day_kind: "office",
    day_summary: "",
    current: null,
    next: null,
    upcoming: [],
    today: [],
    phase: {
      name: "Months 1–2 — DSA Heavy",
      start_month: 1,
      end_month: 2,
      mix: "DSA 60%",
    },
    non_negotiables: [],
    dsa_explain_flow: [],
    weekly_hours: {},
    headline: "Now",
    guidance: [
      "Reset before DSA.",
      "Walks logged this week: 1. Keep the daily 20-minute walk.",
      "Reading days this week: 1. Keep the 30-minute book block.",
      "Focused study logged this week: 0h. Weekly target is about 20h, not more.",
    ],
    stats: {
      week_start: "2026-08-17",
      by_subject: {
        walk: { minutes: 20, sessions: 1, problems: 0 },
        reading: { minutes: 30, sessions: 1, problems: 0 },
      },
      walk_days: 1,
      reading_days: 1,
      dsa_problems_total: 0,
      dsa_problems_week: 0,
      study_minutes_week: 0,
      review: null,
    },
    restart_note: "",
    ...overrides,
  };
}

function session(partial: Partial<SessionRecord>): SessionRecord {
  return {
    id: "sess-1",
    ts: "2026-08-18T13:50:00.000Z",
    subject: "walk",
    minutes: 20,
    notes: "20-minute walk",
    problems_count: 0,
    extra: {},
    ...partial,
  };
}

function decompression(): EnrichedBlock {
  return {
    start: "19:00",
    end: "19:30",
    start_iso: "2026-08-18T13:30:00.000Z",
    end_iso: "2026-08-18T14:00:00.000Z",
    title: "Decompression",
    kind: "break",
    subject: "none",
    guide: "Reset",
    minutes: 30,
    remaining_min: 10,
    elapsed_min: 20,
    progress_pct: 63,
  };
}

function dsaBlock(): EnrichedBlock {
  return {
    start: "20:00",
    end: "21:30",
    start_iso: "2026-08-18T14:30:00.000Z",
    end_iso: "2026-08-18T16:00:00.000Z",
    title: "DSA",
    kind: "study",
    subject: "dsa",
    guide: "Problems",
    minutes: 90,
    remaining_min: 90,
    elapsed_min: 0,
    progress_pct: 0,
  };
}

function walkBlock(): EnrichedBlock {
  return {
    start: "18:30",
    end: "18:50",
    start_iso: "2026-08-18T13:00:00.000Z",
    end_iso: "2026-08-18T13:20:00.000Z",
    title: "Walk",
    kind: "walk",
    subject: "walk",
    guide: "Walk",
    minutes: 20,
    remaining_min: 0,
    elapsed_min: 20,
    progress_pct: 100,
  };
}

const NOW_MS = Date.parse("2026-08-18T13:45:00.000Z");

describe("applyLoggedSession", () => {
  it("prepends the session and does not bump walk_days when today already has a walk", () => {
    const existing = session({
      id: "old-walk",
      ts: "2026-08-18T06:00:00.000Z",
      subject: "walk",
    });
    const next = applyLoggedSession({
      briefing: briefing(),
      recent: [existing],
      session: session({ id: "new-walk" }),
    });

    expect(next.recent[0]?.id).toBe("new-walk");
    expect(next.briefing.stats.walk_days).toBe(1);
    expect(next.briefing.guidance.some((line) => line.startsWith("Walks logged this week: 1."))).toBe(
      true,
    );
  });

  it("increments walk_days and rewrites guidance when today had no walk yet", () => {
    const mondayWalk = session({
      id: "monday",
      ts: "2026-08-17T06:00:00.000Z",
      subject: "walk",
    });
    const next = applyLoggedSession({
      briefing: briefing(),
      recent: [mondayWalk],
      session: session({ id: "tue-walk" }),
    });

    expect(next.briefing.stats.walk_days).toBe(2);
    expect(
      next.briefing.guidance.some((line) => line.startsWith("Walks logged this week: 2.")),
    ).toBe(true);
  });

  it("increments reading_days and study hours for first reading / DSA logs", () => {
    const reading = applyLoggedSession({
      briefing: briefing({
        stats: {
          ...briefing().stats,
          reading_days: 0,
          by_subject: {},
        },
        guidance: [
          "Reading days this week: 0. Keep the 30-minute book block.",
          "Focused study logged this week: 0h. Weekly target is about 20h, not more.",
        ],
      }),
      recent: [],
      session: session({
        id: "read-1",
        subject: "reading",
        minutes: 30,
        notes: "Reading block",
      }),
    });
    expect(reading.briefing.stats.reading_days).toBe(1);

    const dsa = applyLoggedSession({
      briefing: briefing({
        stats: {
          ...briefing().stats,
          study_minutes_week: 0,
          dsa_problems_week: 0,
          dsa_problems_total: 0,
        },
      }),
      recent: [],
      session: session({
        id: "dsa-1",
        subject: "dsa",
        minutes: 90,
        problems_count: 1,
        notes: "Logged block",
      }),
    });
    expect(dsa.briefing.stats.study_minutes_week).toBe(90);
    expect(dsa.briefing.stats.dsa_problems_week).toBe(1);
    expect(dsa.briefing.stats.dsa_problems_total).toBe(1);
    expect(
      dsa.briefing.guidance.some((line) =>
        line.startsWith("Focused study logged this week: 1.5h."),
      ),
    ).toBe(true);
  });
});

describe("alreadyLogged", () => {
  it("treats walk and reading as done for that calendar day only", () => {
    const todayWalk = session({ id: "today-walk", subject: "walk" });
    const yesterdayWalk = session({
      id: "yesterday-walk",
      subject: "walk",
      ts: "2026-08-17T06:00:00.000Z",
    });
    const todayReading = session({
      id: "today-read",
      subject: "reading",
      notes: "Reading block",
    });

    expect(alreadyLogged("walk", briefing(), [todayWalk])).toBe(true);
    expect(alreadyLogged("walk", briefing(), [yesterdayWalk])).toBe(false);
    expect(alreadyLogged("reading", briefing(), [todayWalk])).toBe(false);
    expect(alreadyLogged("reading", briefing(), [todayReading])).toBe(true);
  });

  it("treats Log this block as done for the current time block, not a walk in the same window", () => {
    const current = decompression();
    const withBlock = briefing({ current });
    const key = blockLogKey(current, "2026-08-18");

    expect(alreadyLogged("block", briefing({ current: null }), [])).toBe(false);
    expect(alreadyLogged("block", withBlock, [])).toBe(false);
    expect(
      alreadyLogged("block", withBlock, [
        session({
          id: "keyed",
          subject: "other",
          notes: "",
          extra: { block_key: key },
        }),
      ]),
    ).toBe(true);
    expect(
      alreadyLogged("block", withBlock, [
        session({
          id: "in-window-other",
          subject: "other",
          notes: "",
          ts: "2026-08-18T13:40:00.000Z",
        }),
      ]),
    ).toBe(false);
    expect(
      alreadyLogged("block", withBlock, [
        session({
          id: "legacy",
          subject: "other",
          notes: "",
          extra: { block_start: current.start, block_title: current.title },
        }),
      ]),
    ).toBe(true);
    expect(
      alreadyLogged("block", withBlock, [
        session({
          id: "walk-in-window",
          subject: "walk",
          ts: "2026-08-18T13:40:00.000Z",
        }),
      ]),
    ).toBe(false);
  });

  it("does not treat extra-time same-subject session as the current block", () => {
    const current = dsaBlock();
    const withBlock = briefing({ current });
    expect(
      alreadyLogged("block", withBlock, [
        session({
          id: "extra-dsa",
          subject: "dsa",
          minutes: 15,
          notes: "extra",
          ts: "2026-08-18T14:40:00.000Z",
          extra: {},
        }),
      ]),
    ).toBe(false);
  });

  it("treats a walk block as logged when the daily walk exists without block_key", () => {
    const current = walkBlock();
    expect(
      alreadyLogged("block", briefing({ current }), [
        session({ id: "day-walk", subject: "walk" }),
      ]),
    ).toBe(true);
  });

  it("does not stack a second walk onto recent when the day is already logged", () => {
    const existing = session({ id: "old-walk", subject: "walk" });
    expect(alreadyLogged("walk", briefing(), [existing])).toBe(true);
    const next = applyLoggedSession({
      briefing: briefing(),
      recent: [existing],
      session: session({ id: "new-walk" }),
    });
    expect(alreadyLogged("walk", next.briefing, next.recent)).toBe(true);
  });
});

describe("applyUnloggedSession", () => {
  it("reverses applyLoggedSession for walk days, study minutes, DSA problems, and recent", () => {
    const mondayWalk = session({
      id: "monday",
      ts: "2026-08-17T06:00:00.000Z",
      subject: "walk",
    });
    const loggedWalk = applyLoggedSession({
      briefing: briefing(),
      recent: [mondayWalk],
      session: session({ id: "tue-walk" }),
    });
    const undoneWalk = applyUnloggedSession({
      briefing: loggedWalk.briefing,
      recent: loggedWalk.recent,
      session: session({ id: "tue-walk" }),
    });
    expect(undoneWalk.briefing.stats.walk_days).toBe(1);
    expect(undoneWalk.recent.map((row) => row.id)).toEqual(["monday"]);

    const emptyStats = briefing({
      stats: {
        ...briefing().stats,
        by_subject: {},
        walk_days: 0,
        reading_days: 0,
        study_minutes_week: 0,
        dsa_problems_week: 0,
        dsa_problems_total: 0,
      },
      guidance: [
        "Walks logged this week: 0. Keep the daily 20-minute walk.",
        "Reading days this week: 0. Keep the 30-minute book block.",
        "Focused study logged this week: 0h. Weekly target is about 20h, not more.",
      ],
    });
    const loggedDsa = applyLoggedSession({
      briefing: emptyStats,
      recent: [],
      session: session({
        id: "dsa-1",
        subject: "dsa",
        minutes: 90,
        problems_count: 2,
        notes: "Logged block",
      }),
    });
    const undoneDsa = applyUnloggedSession({
      briefing: loggedDsa.briefing,
      recent: loggedDsa.recent,
      session: session({
        id: "dsa-1",
        subject: "dsa",
        minutes: 90,
        problems_count: 2,
        notes: "Logged block",
      }),
    });
    expect(undoneDsa.briefing.stats.study_minutes_week).toBe(0);
    expect(undoneDsa.briefing.stats.dsa_problems_week).toBe(0);
    expect(undoneDsa.briefing.stats.dsa_problems_total).toBe(0);
    expect(undoneDsa.briefing.stats.by_subject.dsa).toEqual({
      minutes: 0,
      sessions: 0,
      problems: 0,
    });
    expect(undoneDsa.recent).toEqual([]);
  });

  it("does not drop walk_days below remaining distinct days", () => {
    const monday = session({
      id: "mon",
      ts: "2026-08-17T06:00:00.000Z",
      subject: "walk",
    });
    const tueFirst = session({ id: "tue-a", subject: "walk" });
    const tueSecond = session({ id: "tue-b", subject: "walk" });
    const afterBoth = applyLoggedSession({
      briefing: applyLoggedSession({
        briefing: briefing({
          stats: { ...briefing().stats, walk_days: 1, by_subject: {} },
        }),
        recent: [monday],
        session: tueFirst,
      }).briefing,
      recent: [tueFirst, monday],
      session: tueSecond,
    });
    expect(afterBoth.briefing.stats.walk_days).toBe(2);

    const afterOneUndo = applyUnloggedSession({
      briefing: afterBoth.briefing,
      recent: [tueSecond, tueFirst, monday],
      session: tueSecond,
    });
    expect(afterOneUndo.briefing.stats.walk_days).toBe(2);
    expect(afterOneUndo.recent.map((row) => row.id)).toEqual(["tue-a", "mon"]);
  });
});

describe("timelineChip", () => {
  it("returns Now for the current window, including when already keyed", () => {
    const current = decompression();
    const withCurrent = briefing({ current, today: [current] });
    const keyed = session({
      id: "keyed",
      subject: "other",
      extra: { block_key: blockLogKey(current, "2026-08-18") },
    });
    expect(timelineChip(current, withCurrent, [], NOW_MS)).toBe("Now");
    expect(timelineChip(current, withCurrent, [keyed], NOW_MS)).toBe("Now");
    expect(
      timelineChip(current, briefing({ current: null, today: [current] }), [], NOW_MS),
    ).toBe("Now");
  });

  it("returns Logged, Remaining, and Missed for keyed past, future, and ended rows", () => {
    const past = {
      ...dsaBlock(),
      start: "10:00",
      end: "11:30",
      start_iso: "2026-08-18T04:30:00.000Z",
      end_iso: "2026-08-18T06:00:00.000Z",
    };
    const future = {
      ...dsaBlock(),
      start: "22:00",
      end: "23:00",
      start_iso: "2026-08-18T16:30:00.000Z",
      end_iso: "2026-08-18T17:30:00.000Z",
      title: "Night DSA",
    };
    const keyedPast = session({
      id: "past-dsa",
      subject: "dsa",
      extra: { block_key: blockLogKey(past, "2026-08-18") },
    });
    const snap = briefing({ current: decompression(), today: [past, future] });
    expect(timelineChip(past, snap, [keyedPast], NOW_MS)).toBe("Logged");
    expect(timelineChip(future, snap, [], NOW_MS)).toBe("Remaining");
    expect(timelineChip(past, snap, [], NOW_MS)).toBe("Missed");
  });

  it("returns Logged for a walk row when a day-level walk exists without block_key", () => {
    const walk = walkBlock();
    expect(
      timelineChip(
        walk,
        briefing({ current: decompression(), today: [walk] }),
        [session({ id: "day-walk", subject: "walk" })],
        NOW_MS,
      ),
    ).toBe("Logged");
  });
});

describe("blockCtaName / blockCtaMinutes", () => {
  it("labels DSA as Log DSA · 90m and Decompression as decompression 30", () => {
    expect(blockCtaName(dsaBlock())).toBe("DSA");
    expect(blockCtaMinutes(dsaBlock())).toBe(90);
    expect(blockCtaName(decompression())).toBe("decompression");
    expect(blockCtaMinutes(decompression())).toBe(30);
  });
});

describe("sessionForQuickLog", () => {
  it("returns the latest matching row and ignores extra-time DSA for block", () => {
    const current = dsaBlock();
    const withBlock = briefing({ current });
    const extra = session({
      id: "extra-dsa",
      subject: "dsa",
      ts: "2026-08-18T15:00:00.000Z",
      extra: {},
    });
    const keyedOlder = session({
      id: "keyed-dsa",
      subject: "dsa",
      ts: "2026-08-18T14:35:00.000Z",
      extra: { block_key: blockLogKey(current, "2026-08-18") },
    });
    expect(sessionForQuickLog("block", withBlock, [extra, keyedOlder])?.id).toBe(
      "keyed-dsa",
    );
    expect(
      sessionForQuickLog("walk", briefing(), [
        session({ id: "today-walk", subject: "walk" }),
        session({
          id: "yesterday-walk",
          subject: "walk",
          ts: "2026-08-17T06:00:00.000Z",
        }),
      ])?.id,
    ).toBe("today-walk");
  });
});
