import { describe, expect, it } from "vitest";
import { relativeNotePath, skipVaultFileReason, suffixedRelativePath } from "./paths";

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

describe("suffixedRelativePath", () => {
  it("keeps the original path for the first copy", () => {
    expect(suffixedRelativePath("Notion/tracker/Untitled.md", 1)).toBe(
      "Notion/tracker/Untitled.md",
    );
  });

  it("adds a numeric suffix before the extension", () => {
    expect(suffixedRelativePath("Notion/tracker/Untitled.md", 4)).toBe(
      "Notion/tracker/Untitled-4.md",
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
