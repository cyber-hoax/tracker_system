import { describe, expect, it } from "vitest";
import { weekDsaProblemStats } from "./dsa-problems";

describe("weekDsaProblemStats", () => {
  it("counts two last-solved problem notes in the current week", () => {
    expect(
      weekDsaProblemStats(
        ["2026-08-18", "2026-08-18"],
        "2026-08-17",
      ),
    ).toEqual({ dsa_problems_week: 2, dsa_problems_total: 2 });
  });

  it("keeps last week's solves on the all-time total, not the week card", () => {
    expect(
      weekDsaProblemStats(
        ["2026-08-18", "2026-08-18", "2026-08-16"],
        "2026-08-17",
      ),
    ).toEqual({ dsa_problems_week: 2, dsa_problems_total: 3 });
  });

  it("ignores blank last-solved dates instead of inventing a count", () => {
    expect(
      weekDsaProblemStats([undefined, "", null, "2026-08-18"], "2026-08-17"),
    ).toEqual({ dsa_problems_week: 1, dsa_problems_total: 1 });
  });
});
