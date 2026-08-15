import { describe, expect, it } from "vitest";
import {
  parseVaultMarkdown,
  serializeVaultMarkdown,
} from "./markdown";
import { propertyValuesToFrontmatter } from "./properties";

const PROBLEM_SAMPLE = `---
notion-id: 345a1b49-e106-80e3-81b6-f96e4efcac64
base: "[[tracker.base]]"
Difficulty: easy
Status: Solved
remarks: ""
Mistake Type: ""
Pattern:
  - binary search
Description: |-
  Find the target.
Key Insight: ""
---

<!-- pattern-hubs:start -->
## Pattern hubs

[[Patterns/binary search|binary search]]
<!-- pattern-hubs:end -->
\`\`\`c++
int mid = left + (right - left) / 2;
\`\`\`
`;

const PATTERN_SAMPLE = `---
aliases:
  - binary search
---

# binary search

Problems connected to this pattern appear in the graph.

<!-- boilerplate:start -->

## C++ boilerplate

\`\`\`cpp
int left = 0, right = n - 1;
\`\`\`

<!-- boilerplate:end -->
`;

describe("parseVaultMarkdown", () => {
  it("strips pattern-hubs from body and keeps C++", () => {
    const parsed = parseVaultMarkdown(PROBLEM_SAMPLE);
    expect(parsed.frontmatter.Pattern).toEqual(["binary search"]);
    expect(parsed.frontmatter.Difficulty).toBe("easy");
    expect(parsed.body).toContain("int mid = left + (right - left) / 2;");
    expect(parsed.body).not.toContain("pattern-hubs:start");
    expect(parsed.body).not.toContain("[[Patterns/binary search");
  });

  it("preserves boilerplate blocks on pattern notes", () => {
    const parsed = parseVaultMarkdown(PATTERN_SAMPLE);
    expect(parsed.frontmatter.aliases).toEqual(["binary search"]);
    expect(parsed.body).toContain("<!-- boilerplate:start -->");
    expect(parsed.body).toContain("<!-- boilerplate:end -->");
    expect(parsed.body).toContain("int left = 0, right = n - 1;");
  });
});

describe("serializeVaultMarkdown", () => {
  it("regenerates pattern-hubs from Pattern values and keeps C++ body", () => {
    const parsed = parseVaultMarkdown(PROBLEM_SAMPLE);
    const written = serializeVaultMarkdown({
      type: "problem",
      frontmatter: {
        Difficulty: "easy",
        Status: "Solved",
        Pattern: ["[[Patterns/binary search]]", "[[Patterns/two pointers]]"],
      },
      body: parsed.body,
      patterns: ["binary search", "two pointers"],
    });

    expect(written).toMatch(
      /Pattern:[\s\S]*\[\[Patterns\/binary search\]\][\s\S]*\[\[Patterns\/two pointers\]\]/,
    );
    expect(written).toContain("<!-- pattern-hubs:start -->");
    expect(written).toContain("[[Patterns/binary search|binary search]]");
    expect(written).toContain("[[Patterns/two pointers|two pointers]]");
    expect(written).toContain("int mid = left + (right - left) / 2;");
    expect(written.match(/pattern-hubs:start/g)?.length).toBe(1);
  });

  it("omits pattern-hubs when Pattern is empty and preserves boilerplate", () => {
    const parsed = parseVaultMarkdown(PATTERN_SAMPLE);
    const written = serializeVaultMarkdown({
      type: "pattern",
      frontmatter: { aliases: ["binary search"] },
      body: parsed.body,
      patterns: [],
    });

    expect(written).not.toContain("pattern-hubs");
    expect(written).toContain("<!-- boilerplate:start -->");
    expect(written).toContain("aliases:");
  });

  it("round-trips Pattern wikilinks into YAML and pattern-hubs", () => {
    const yaml = propertyValuesToFrontmatter([
      { key: "Difficulty", valueType: "select", value: "easy" },
      { key: "Status", valueType: "select", value: "Solved" },
      {
        key: "Pattern",
        valueType: "wikilink_list",
        value: ["binary search"],
      },
      { key: "Description", valueType: "text", value: "Find the target." },
      { key: "Key Insight", valueType: "text", value: null },
      { key: "Mistake Type", valueType: "text", value: null },
      { key: "remarks", valueType: "text", value: null },
      { key: "Revision Count", valueType: "number", value: null },
      { key: "Last Solved Date", valueType: "date", value: null },
      { key: "Next Revision Date", valueType: "date", value: null },
    ]);
    const written = serializeVaultMarkdown({
      type: "problem",
      frontmatter: yaml,
      body: "```c++\nint mid = left + (right - left) / 2;\n```",
      patterns: ["binary search"],
    });

    expect(written).toContain("[[Patterns/binary search]]");
    expect(written).toContain("<!-- pattern-hubs:start -->");
    expect(written).toContain("[[Patterns/binary search|binary search]]");
    expect(written).toContain("<!-- pattern-hubs:end -->");
    expect(written).toContain("```c++");
    expect(written).toMatch(/remarks:\s*['"]{2}/);
  });
});
