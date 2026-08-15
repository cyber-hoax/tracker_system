import { describe, expect, it } from "vitest";
import {
  appendSubmissionBlocks,
  countSubmissionMarkers,
  htmlToPlainText,
  mapDifficulty,
  mapPatterns,
  mapStatus,
  mapSubmissionsToProperties,
} from "./map";
import type { LeetCodeProblemMeta, LeetCodeSubmission } from "./types";

const TZ = "Asia/Kolkata";

function submission(
  overrides: Partial<LeetCodeSubmission> & Pick<LeetCodeSubmission, "id">,
): LeetCodeSubmission {
  return {
    title: "Binary Search",
    titleSlug: "binary-search",
    timestamp: Date.parse("2026-08-15T06:30:00.000Z"),
    statusDisplay: "Accepted",
    lang: "cpp",
    code: "int search() { return 0; }",
    ...overrides,
  };
}

describe("mapStatus", () => {
  it("maps accepted to Solved and failures to Partial, never Unsolved", () => {
    expect(mapStatus("Accepted")).toBe("Solved");
    expect(mapStatus("Wrong Answer")).toBe("Partial");
    expect(mapStatus("Time Limit Exceeded")).toBe("Partial");
    expect(mapStatus("Runtime Error")).toBe("Partial");
    expect(mapStatus("Compile Error")).toBe("Partial");
    expect(mapStatus("")).toBe("Partial");
  });
});

describe("mapDifficulty", () => {
  it("lowercases Easy/Medium/Hard from the problem", () => {
    expect(mapDifficulty("Easy")).toBe("easy");
    expect(mapDifficulty("MEDIUM")).toBe("medium");
    expect(mapDifficulty("hard")).toBe("hard");
    expect(mapDifficulty("unknown")).toBeUndefined();
  });
});

describe("mapPatterns", () => {
  it("maps LeetCode tags onto existing pattern hubs when possible", () => {
    expect(
      mapPatterns(
        ["Dynamic Programming", "Binary Search", "Array"],
        ["dp", "binary search", "two pointers"],
      ),
    ).toEqual(["dp", "binary search"]);
  });
});

describe("mapSubmissionsToProperties", () => {
  const problem: LeetCodeProblemMeta = {
    title: "Binary Search",
    titleSlug: "binary-search",
    difficulty: "Easy",
    topicTags: [
      { name: "Array", slug: "array" },
      { name: "Binary Search", slug: "binary-search" },
    ],
    content: "<p>Given a <code>sorted</code> array, find the target.</p>",
  };

  it("fills auto properties from submissions + problem metadata", () => {
    const failed = submission({
      id: 11,
      statusDisplay: "Wrong Answer",
      timestamp: Date.parse("2026-08-10T06:30:00.000Z"),
      code: "int search() { return -1; }",
    });
    const accepted = submission({ id: 22 });

    const mapped = mapSubmissionsToProperties({
      submissions: [failed, accepted],
      problem,
      knownPatterns: ["binary search", "dp"],
      timeZone: TZ,
    });

    expect(mapped.title).toBe("Binary Search");
    expect(mapped.properties).toEqual({
      Difficulty: "easy",
      Status: "Solved",
      Pattern: ["binary search"],
      Description: "Given a sorted array, find the target.",
      "Last Solved Date": "2026-08-15",
      "Next Revision Date": "2026-08-22",
      "Revision Count": 2,
    });
    expect(mapped.properties).not.toHaveProperty("Mistake Type");
    expect(mapped.properties).not.toHaveProperty("Key Insight");
  });

  it("sets Partial when the latest submission is not accepted", () => {
    const mapped = mapSubmissionsToProperties({
      submissions: [
        submission({
          id: 1,
          statusDisplay: "Accepted",
          timestamp: Date.parse("2026-08-01T06:30:00.000Z"),
        }),
        submission({
          id: 2,
          statusDisplay: "Wrong Answer",
          timestamp: Date.parse("2026-08-15T06:30:00.000Z"),
        }),
      ],
      problem,
      timeZone: TZ,
    });

    expect(mapped.properties.Status).toBe("Partial");
    expect(mapped.properties["Last Solved Date"]).toBe("2026-08-01");
    expect(mapped.properties["Next Revision Date"]).toBe("2026-08-08");
  });
});

describe("appendSubmissionBlocks", () => {
  it("appends a dated code block and does not replace an existing solution", () => {
    const existing = [
      "# Binary Search",
      "",
      "<!-- leetcode-submission:11 -->",
      "",
      "## Submission 2026-08-10 · Wrong Answer",
      "",
      "```cpp",
      "int search() { return -1; }",
      "```",
      "",
    ].join("\n");

    const next = appendSubmissionBlocks(
      existing,
      [
        submission({
          id: 11,
          statusDisplay: "Wrong Answer",
          timestamp: Date.parse("2026-08-10T06:30:00.000Z"),
          code: "SHOULD NOT REPLACE",
        }),
        submission({ id: 22, code: "int search() { return 0; }" }),
      ],
      TZ,
    );

    expect(next).toContain("int search() { return -1; }");
    expect(next).not.toContain("SHOULD NOT REPLACE");
    expect(next).toContain("<!-- leetcode-submission:22 -->");
    expect(next).toContain("## Submission 2026-08-15 · Accepted");
    expect(next).toContain("```cpp\nint search() { return 0; }\n```");
    expect(countSubmissionMarkers(next)).toBe(2);
  });
});

describe("htmlToPlainText", () => {
  it("strips tags for the Description property", () => {
    expect(htmlToPlainText("<p>Find <strong>two</strong> numbers.</p>")).toBe(
      "Find two numbers.",
    );
  });
});
