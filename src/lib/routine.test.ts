import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyRoutine, normalizeHm, normalizeRoutine } from "./routine-model";
import { DAY_KEYS } from "./types";

describe("normalizeHm", () => {
  it("accepts overnight midnight and 24:00", () => {
    expect(normalizeHm("00:15")).toBe("00:15");
    expect(normalizeHm("24:00")).toBe("00:00");
    expect(normalizeHm("19:30:00")).toBe("19:30");
  });

  it("rejects invalid times", () => {
    expect(() => normalizeHm("9:00")).toThrow(/Invalid time/);
    expect(() => normalizeHm("25:00")).toThrow(/Invalid time/);
  });
});

describe("normalizeRoutine", () => {
  it("fills every weekday when days are missing", () => {
    const routine = normalizeRoutine({ goal: "Focus", days: {} });
    expect(routine.goal).toBe("Focus");
    expect(Object.keys(routine.days)).toEqual([...DAY_KEYS]);
    expect(routine.days.mon.blocks).toEqual([]);
    expect(routine.days.sun.label).toBe("Sunday");
  });

  it("keeps blocks and drops empty guides", () => {
    const routine = normalizeRoutine({
      days: {
        mon: {
          label: "Monday",
          kind: "office",
          summary: "DSA",
          blocks: [
            {
              start: "19:30",
              end: "21:00",
              title: " DSA ",
              kind: "study",
              subject: "dsa",
              guide: "  ",
            },
          ],
        },
      },
    });
    expect(routine.days.mon.blocks).toEqual([
      { start: "19:30", end: "21:00", title: "DSA", kind: "study", subject: "dsa" },
    ]);
  });

  it("emptyRoutine has seven days and no blocks", () => {
    const routine = emptyRoutine();
    expect(Object.keys(routine.days)).toHaveLength(7);
    expect(DAY_KEYS.every((key) => routine.days[key].blocks.length === 0)).toBe(true);
  });

  it("accepts the bundled weekly plan", () => {
    const raw = JSON.parse(readFileSync("data/routine.json", "utf8"));
    const routine = normalizeRoutine(raw);
    expect(routine.days.mon.blocks[0]?.title).toBe("Morning routine");
    expect(routine.days.sun.kind).toBe("weekend_review");
  });
});
