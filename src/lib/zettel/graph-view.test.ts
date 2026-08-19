import { describe, expect, it } from "vitest";
import {
  applyPinnedPositions,
  boxesOverlap,
  buildNeighborMap,
  chargeStrength,
  clipLabel,
  endpointId,
  isIncidentTo,
  labelPriority,
  linkDistance,
  matchesQuery,
  nodeDegree,
  nodeRadius,
  nodesInMainCloud,
  parsePinnedPositions,
  tryPlaceLabel,
  upsertPinnedPosition,
  withAlpha,
} from "./graph-view";

describe("endpointId", () => {
  it("reads string, number, and object ids", () => {
    expect(endpointId("n1")).toBe("n1");
    expect(endpointId(12)).toBe("12");
    expect(endpointId({ id: "hub" })).toBe("hub");
    expect(endpointId(null)).toBe("");
  });
});

describe("buildNeighborMap", () => {
  it("treats links as undirected and counts degree", () => {
    const neighbors = buildNeighborMap([
      { source: "a", target: "b" },
      { source: { id: "b" }, target: { id: "c" } },
    ]);
    expect([...neighbors.get("b")!].sort()).toEqual(["a", "c"]);
    expect(nodeDegree(neighbors, "a")).toBe(1);
    expect(nodeDegree(neighbors, "missing")).toBe(0);
  });
});

describe("isIncidentTo", () => {
  it("matches either endpoint after d3 mutates the link", () => {
    const link = { source: { id: "p1" }, target: "h1" };
    expect(isIncidentTo(link, "p1")).toBe(true);
    expect(isIncidentTo(link, "h1")).toBe(true);
    expect(isIncidentTo(link, "other")).toBe(false);
    expect(isIncidentTo(link, null)).toBe(false);
  });
});

describe("labelPriority", () => {
  it("hides problem labels until the view is zoomed in", () => {
    expect(
      labelPriority({
        type: "problem",
        degree: 4,
        scale: 1,
        highlighted: false,
        queryHit: false,
      }),
    ).toBe(0);
    expect(
      labelPriority({
        type: "problem",
        degree: 4,
        scale: 2,
        highlighted: false,
        queryHit: false,
      }),
    ).toBeGreaterThan(0);
  });

  it("keeps pattern hubs and anything focused visible", () => {
    expect(
      labelPriority({
        type: "pattern",
        degree: 8,
        scale: 0.8,
        highlighted: false,
        queryHit: false,
      }),
    ).toBeGreaterThan(0);
    expect(
      labelPriority({
        type: "problem",
        degree: 0,
        scale: 0.5,
        highlighted: true,
        queryHit: false,
      }),
    ).toBeGreaterThan(900);
  });
});

describe("label collision", () => {
  it("rejects overlapping boxes and keeps placed ones", () => {
    const occupied = [{ x: 0, y: 0, w: 40, h: 10 }];
    expect(boxesOverlap(occupied[0], { x: 10, y: 2, w: 20, h: 10 })).toBe(true);
    expect(tryPlaceLabel(occupied, { x: 10, y: 2, w: 20, h: 10 })).toBe(false);
    expect(tryPlaceLabel(occupied, { x: 80, y: 0, w: 20, h: 10 })).toBe(true);
    expect(occupied).toHaveLength(2);
  });
});

describe("clipLabel and query", () => {
  it("truncates long titles and matches case-insensitively", () => {
    expect(clipLabel("Two Sum", 28)).toBe("Two Sum");
    expect(clipLabel("Minimum Number of K-Sum Pairs", 12)).toBe("Minimum Num…");
    expect(matchesQuery("Binary Search", "bin")).toBe(true);
    expect(matchesQuery("Binary Search", "zzz")).toBe(false);
    expect(matchesQuery("Two Sum", "  ")).toBe(false);
  });
});

describe("layout helpers", () => {
  it("sizes hubs larger and spreads denser graphs", () => {
    expect(nodeRadius("pattern", 10)).toBeGreaterThan(nodeRadius("problem", 2));
    expect(chargeStrength(285)).toBeLessThan(chargeStrength(12));
    expect(linkDistance("wikilink")).toBeGreaterThan(linkDistance("pattern"));
  });
});

describe("nodesInMainCloud", () => {
  it("drops far outliers so fit does not zoom out to empty space", () => {
    const nodes = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 2, y: 0 },
      { id: "c", x: 0, y: 2 },
      { id: "d", x: 400, y: 400 },
    ];
    const cloud = nodesInMainCloud(nodes, 0.75);
    expect([...cloud].map((node) => node.id).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("withAlpha", () => {
  it("appends hex or rgba alpha", () => {
    expect(withAlpha("#cba6f7", 0.5).toLowerCase()).toBe("#cba6f780");
    expect(withAlpha("rgb(203, 166, 247)", 0.4)).toBe(
      "rgba(203, 166, 247, 0.4)",
    );
  });
});

describe("pinned positions", () => {
  it("parses stored pins and ignores junk", () => {
    expect(parsePinnedPositions(null)).toEqual({});
    expect(parsePinnedPositions("not-json")).toEqual({});
    expect(
      parsePinnedPositions(
        JSON.stringify({ a: { x: 10, y: 20 }, b: { x: "nope", y: 1 } }),
      ),
    ).toEqual({ a: { x: 10, y: 20 } });
  });

  it("pins a dragged node so later layouts keep the drop point", () => {
    const next = upsertPinnedPosition({}, "hub", 40, -12);
    const nodes = applyPinnedPositions(
      [{ id: "hub" }, { id: "leaf", x: 1, y: 1 }] as Array<{
        id: string;
        x?: number;
        y?: number;
        fx?: number;
        fy?: number;
      }>,
      next,
    );
    expect(nodes[0]).toMatchObject({ id: "hub", x: 40, y: -12, fx: 40, fy: -12 });
    expect(nodes[1].fx).toBeUndefined();
  });
});
