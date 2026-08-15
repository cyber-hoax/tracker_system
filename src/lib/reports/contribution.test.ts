import { describe, expect, it } from "vitest";
import {
  contributionIntensity,
  formatContributionTooltip,
} from "./contribution";

describe("contributionIntensity", () => {
  it("maps question counts onto five buckets from empty to full green", () => {
    expect(contributionIntensity(0)).toBe(0);
    expect(contributionIntensity(1)).toBe(1);
    expect(contributionIntensity(2)).toBe(2);
    expect(contributionIntensity(3)).toBe(3);
    expect(contributionIntensity(4)).toBe(4);
    expect(contributionIntensity(12)).toBe(4);
  });

  it("treats negative counts as empty", () => {
    expect(contributionIntensity(-1)).toBe(0);
  });
});

describe("formatContributionTooltip", () => {
  it("includes the Kolkata calendar date, question count, and routine flags", () => {
    expect(
      formatContributionTooltip({
        ymd: "2026-08-15",
        questionCount: 2,
        walk: true,
        reading: false,
        study: true,
      }),
    ).toBe(
      "Sat 15 Aug 2026 · 2 questions solved · Walk logged · Reading not logged · Study logged",
    );
  });

  it("singularizes one question", () => {
    expect(
      formatContributionTooltip({
        ymd: "2026-08-10",
        questionCount: 1,
        walk: false,
        reading: false,
        study: false,
      }),
    ).toContain("1 question solved");
  });
});
