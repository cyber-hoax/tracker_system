import { describe, expect, it } from "vitest";
import {
  canonicalPatternTitle,
  collapsePatternTitles,
  collapseAliasedPatternGraph,
  patternAliasSlugs,
  pickCanonicalPatternNote,
  rewritePatternValues,
} from "./pattern-aliases";

describe("canonicalPatternTitle", () => {
  it("resolves hashmap, hash set, and hash table aliases to one catalog name", () => {
    const names = [
      "hashmap",
      "Hash Map",
      "hash set",
      "hashset",
      "hashtable",
      "hash table",
      "Hash Table",
    ];
    expect(new Set(names.map(canonicalPatternTitle))).toEqual(
      new Set(["hash table"]),
    );
  });

  it("leaves unrelated pattern names unchanged", () => {
    expect(canonicalPatternTitle("two pointers")).toBe("two pointers");
    expect(canonicalPatternTitle("dp")).toBe("dp");
  });
});

describe("collapsePatternTitles", () => {
  it("does not list hash map, hash set, and hash table as sibling hubs", () => {
    expect(
      collapsePatternTitles([
        "two pointers",
        "hashmap",
        "hash table",
        "hash set",
        "dp",
      ]),
    ).toEqual(["dp", "hash table", "two pointers"]);
  });
});

describe("rewritePatternValues", () => {
  it("collapses hashmap and hash table on one problem to a single pattern", () => {
    expect(rewritePatternValues(["hashmap", "array", "hash table"])).toEqual([
      "hash table",
      "array",
    ]);
  });
});

describe("patternAliasSlugs", () => {
  it("lets old hash names resolve to the canonical hub slug", () => {
    const slugs = patternAliasSlugs("hashmap");
    expect(slugs).toContain("patterns-hash-table");
    expect(slugs).toContain("patterns-hashmap");
    expect(slugs).toContain("patterns-hash-set");
  });
});

describe("pickCanonicalPatternNote", () => {
  it("keeps the catalog title already in use and treats the rest as aliases", () => {
    const keeper = pickCanonicalPatternNote(
      [
        { id: "hashmap", title: "hashmap", backlinkCount: 4 },
        { id: "table", title: "hash table", backlinkCount: 24 },
        { id: "set", title: "hash set", backlinkCount: 0 },
      ],
      "hash table",
    );
    expect(keeper?.id).toBe("table");
  });
});

describe("collapseAliasedPatternGraph", () => {
  it("does not show hash map, hash set, and hash table as sibling graph hubs", () => {
    const graph = collapseAliasedPatternGraph(
      [
        { id: "t", name: "hash table", type: "pattern" },
        { id: "m", name: "hashmap", type: "pattern" },
        { id: "s", name: "hash set", type: "pattern" },
        { id: "p", name: "Two Sum", type: "problem" },
      ],
      [
        { source: "p", target: "t", kind: "pattern" },
        { source: "p", target: "m", kind: "pattern" },
      ],
    );
    expect(
      graph.nodes.filter((node) => node.type === "pattern").map((node) => node.name),
    ).toEqual(["hash table"]);
    expect(graph.links).toEqual([{ source: "p", target: "t", kind: "pattern" }]);
  });
});
