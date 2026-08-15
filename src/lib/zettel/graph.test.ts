import { describe, expect, it } from "vitest";
import { clipGraph } from "./graph-clip";

const nodes = [
  { id: "p1", name: "Two Sum" },
  { id: "p2", name: "Unrelated" },
  { id: "h1", name: "hash map" },
  { id: "h2", name: "two pointers" },
];

const links = [
  { source: "p1", target: "h1", kind: "pattern" },
  { source: "p2", target: "h2", kind: "pattern" },
  { source: "p1", target: "p2", kind: "manual" },
];

describe("clipGraph", () => {
  it("keeps every node and link when there is no seed filter", () => {
    const graph = clipGraph(nodes, links, null);
    expect(graph.nodes).toHaveLength(4);
    expect(graph.links).toHaveLength(3);
  });

  it("keeps matching problems and one-hop pattern hubs from links", () => {
    const graph = clipGraph(nodes, links, new Set(["p1"]));
    expect(graph.nodes.map((node) => node.id).sort()).toEqual(["h1", "p1", "p2"]);
    expect(
      graph.links.map((link) => `${link.source}->${link.target}:${link.kind}`).sort(),
    ).toEqual(["p1->h1:pattern", "p1->p2:manual"]);
  });

  it("returns an empty graph when no notes match the facets", () => {
    expect(clipGraph(nodes, links, new Set())).toEqual({ nodes: [], links: [] });
  });
});
