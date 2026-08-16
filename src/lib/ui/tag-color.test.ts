import { describe, expect, it } from "vitest";
import { TAG_ACCENTS, tagAccent } from "./tag-color";

describe("tagAccent", () => {
  it("is stable for a label", () => {
    expect(tagAccent("binary search")).toBe(tagAccent("binary search"));
    expect(tagAccent(" Binary Search ")).toBe(tagAccent("binary search"));
  });

  it("spreads different labels across theme accents", () => {
    const colors = new Set(
      ["binary search", "two pointers", "dp", "graph", "sliding window"].map(
        tagAccent,
      ),
    );
    expect(colors.size).toBeGreaterThan(1);
    for (const color of colors) {
      expect(TAG_ACCENTS).toContain(color);
    }
  });
});
