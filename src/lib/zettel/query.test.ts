import { describe, expect, it } from "vitest";
import {
  hasActiveFilters,
  hasSearchInput,
  parseSearchQuery,
  websearchQuery,
} from "./query";

describe("parseSearchQuery", () => {
  it("reads q plus Status, Pattern, Difficulty, and date facets", () => {
    const query = parseSearchQuery({
      q: " two pointers ",
      status: "Solved",
      difficulty: "medium",
      pattern: "binary search",
      lastSolvedFrom: "2026-01-01",
      lastSolvedTo: "2026-08-15",
      nextRevisionFrom: "2026-08-16",
      nextRevisionTo: "2026-09-01",
    });

    expect(query).toEqual({
      q: "two pointers",
      status: "Solved",
      difficulty: "medium",
      pattern: "binary search",
      lastSolvedFrom: "2026-01-01",
      lastSolvedTo: "2026-08-15",
      nextRevisionFrom: "2026-08-16",
      nextRevisionTo: "2026-09-01",
    });
  });

  it("drops blank q and facet values", () => {
    const query = parseSearchQuery({
      q: "   ",
      status: "",
      difficulty: ["", "hard"],
    });

    expect(query.q).toBeUndefined();
    expect(query.status).toBeUndefined();
    expect(query.difficulty).toBe("hard");
  });
});

describe("websearchQuery", () => {
  it("returns null for empty input so SQL skips search_vector", () => {
    expect(websearchQuery(undefined)).toBeNull();
    expect(websearchQuery("  ")).toBeNull();
  });

  it("passes through the trimmed user string for websearch_to_tsquery", () => {
    expect(websearchQuery(" sliding  window ")).toBe("sliding  window");
  });
});

describe("hasSearchInput", () => {
  it("is true when only q is set", () => {
    expect(hasSearchInput({ q: "heap" })).toBe(true);
    expect(hasActiveFilters({ q: "heap" } as never)).toBe(false);
  });

  it("is true when only a property facet is set", () => {
    expect(hasSearchInput({ status: "Partial" })).toBe(true);
  });

  it("is false when the form is empty", () => {
    expect(hasSearchInput({})).toBe(false);
  });
});
