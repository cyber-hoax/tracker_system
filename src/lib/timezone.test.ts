import { describe, expect, it } from "vitest";
import { formatClock12, formatHm12, formatHmRange } from "./timezone";

describe("formatHm12", () => {
  it("converts 24-hour HH:MM to 12-hour with AM/PM", () => {
    expect(formatHm12("00:00")).toBe("12:00 AM");
    expect(formatHm12("09:05")).toBe("9:05 AM");
    expect(formatHm12("12:00")).toBe("12:00 PM");
    expect(formatHm12("18:30")).toBe("6:30 PM");
    expect(formatHm12("23:59")).toBe("11:59 PM");
  });
});

describe("formatHmRange", () => {
  it("joins start and end in 12-hour format", () => {
    expect(formatHmRange("18:00", "19:30")).toBe("6:00 PM–7:30 PM");
  });
});

describe("formatClock12", () => {
  it("shows the Asia/Kolkata wall clock with AM/PM", () => {
    const instant = new Date("2026-08-15T16:47:00.000Z");
    const clock = formatClock12("Asia/Kolkata", instant);
    expect(clock.time).toBe("10:17 PM");
    expect(clock.heading).toContain("August");
  });
});
