import { describe, expect, it } from "vitest";
import { relativeNotePath, skipVaultFileReason } from "./paths";

describe("relativeNotePath", () => {
  it("puts problems under the tracker dir and patterns under Patterns/", () => {
    expect(relativeNotePath("problem", "Koko Eating Bananas")).toBe(
      "Notion/tracker/Koko Eating Bananas.md",
    );
    expect(relativeNotePath("pattern", "binary search")).toBe(
      "Patterns/binary search.md",
    );
  });
});

describe("skipVaultFileReason", () => {
  it("skips folder notes and conflict siblings", () => {
    expect(skipVaultFileReason("Patterns/Patterns.md")).toBe(
      "Obsidian folder note",
    );
    expect(
      skipVaultFileReason("Notion/tracker/Binary Search.conflict.md"),
    ).toBe("conflict sibling");
    expect(skipVaultFileReason("Notion/tracker/Binary Search.md")).toBeNull();
  });
});
