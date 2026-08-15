import { describe, expect, it } from "vitest";
import {
  addMultiSelectValue,
  filterMultiSelectOptions,
  removeMultiSelectValue,
} from "./multi-select";

describe("filterMultiSelectOptions", () => {
  const options = ["binary search", "two pointers", "sliding window"];

  it("hides already selected values and filters by query", () => {
    expect(
      filterMultiSelectOptions(options, ["two pointers"], "bin"),
    ).toEqual(["binary search"]);
  });

  it("returns unused options when the query is empty", () => {
    expect(filterMultiSelectOptions(options, ["binary search"], "")).toEqual([
      "two pointers",
      "sliding window",
    ]);
  });
});

describe("addMultiSelectValue", () => {
  it("appends a trimmed unique value", () => {
    expect(addMultiSelectValue(["binary search"], "  two pointers  ")).toEqual([
      "binary search",
      "two pointers",
    ]);
  });

  it("ignores blanks and duplicates", () => {
    expect(addMultiSelectValue(["binary search"], "   ")).toEqual([
      "binary search",
    ]);
    expect(addMultiSelectValue(["binary search"], "binary search")).toEqual([
      "binary search",
    ]);
  });
});

describe("removeMultiSelectValue", () => {
  it("drops the matching chip", () => {
    expect(
      removeMultiSelectValue(["binary search", "two pointers"], "binary search"),
    ).toEqual(["two pointers"]);
  });
});
