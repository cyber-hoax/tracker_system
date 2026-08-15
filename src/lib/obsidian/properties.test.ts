import { describe, expect, it } from "vitest";
import {
  frontmatterToPropertyValues,
  propertyValuesToFrontmatter,
} from "./properties";

const DEFS = [
  { key: "Difficulty", valueType: "select" },
  { key: "Status", valueType: "select" },
  { key: "Pattern", valueType: "wikilink_list" },
  { key: "Description", valueType: "text" },
  { key: "Revision Count", valueType: "number" },
  { key: "Last Solved Date", valueType: "date" },
  { key: "notion-id", valueType: "text" },
  { key: "base", valueType: "wikilink" },
];

describe("frontmatterToPropertyValues", () => {
  it("stores Pattern unbracketed without Patterns/ prefix", () => {
    const values = frontmatterToPropertyValues(
      {
        Pattern: ["[[Patterns/binary search]]", "two pointers"],
        "notion-id": "abc",
        base: "[[tracker.base]]",
        remarks: "",
      },
      DEFS,
    );

    expect(values).toContainEqual({
      key: "Pattern",
      value: ["binary search", "two pointers"],
    });
    expect(values).toContainEqual({ key: "notion-id", value: "abc" });
    expect(values).toContainEqual({ key: "base", value: "tracker.base" });
    expect(values.find((row) => row.key === "remarks")).toBeUndefined();
  });

  it("keeps numeric zero and date strings", () => {
    const values = frontmatterToPropertyValues(
      { "Revision Count": 0, "Last Solved Date": "2026-04-18" },
      DEFS,
    );
    expect(values).toContainEqual({ key: "Revision Count", value: 0 });
    expect(values).toContainEqual({
      key: "Last Solved Date",
      value: "2026-04-18",
    });
  });
});

describe("propertyValuesToFrontmatter", () => {
  it("writes Pattern as Patterns/ wikilinks and keeps empty properties", () => {
    const yaml = propertyValuesToFrontmatter(
      [
        { key: "base", valueType: "wikilink", value: "tracker.base" },
        {
          key: "Pattern",
          valueType: "wikilink_list",
          value: ["binary search"],
        },
        { key: "Difficulty", valueType: "select", value: "easy" },
        { key: "Status", valueType: "select", value: "Solved" },
        { key: "Description", valueType: "text", value: "Find the target." },
        { key: "Key Insight", valueType: "text", value: null },
        { key: "Mistake Type", valueType: "text", value: null },
        { key: "remarks", valueType: "text", value: null },
        { key: "Revision Count", valueType: "number", value: null },
        { key: "Last Solved Date", valueType: "date", value: null },
        { key: "Next Revision Date", valueType: "date", value: null },
        { key: "notion-id", valueType: "text", value: "abc" },
      ],
      { aliases: ["binary search"] },
    );

    expect(yaml.base).toBe("[[tracker.base]]");
    expect(yaml.Pattern).toEqual(["[[Patterns/binary search]]"]);
    expect(yaml.Difficulty).toBe("easy");
    expect(yaml.Status).toBe("Solved");
    expect(yaml.Description).toBe("Find the target.");
    expect(yaml["Key Insight"]).toBe("");
    expect(yaml["Mistake Type"]).toBe("");
    expect(yaml.remarks).toBe("");
    expect(yaml["Revision Count"]).toBe("");
    expect(yaml["Last Solved Date"]).toBe("");
    expect(yaml["Next Revision Date"]).toBe("");
    expect(yaml["notion-id"]).toBe("abc");
    expect(yaml.aliases).toEqual(["binary search"]);
  });

  it("omits empty notion-id and base", () => {
    const yaml = propertyValuesToFrontmatter([
      { key: "notion-id", valueType: "text", value: null },
      { key: "base", valueType: "wikilink", value: null },
      { key: "Difficulty", valueType: "select", value: "medium" },
    ]);

    expect(yaml).not.toHaveProperty("notion-id");
    expect(yaml).not.toHaveProperty("base");
    expect(yaml.Difficulty).toBe("medium");
  });
});
