import { describe, expect, it } from "vitest";
import { isFullBleedRoute, isNoteRoute } from "./note-route";

describe("isNoteRoute", () => {
  it("matches DSA, pattern, and generic note detail pages", () => {
    expect(isNoteRoute("/dsa/beautiful-towers-i")).toBe(true);
    expect(isNoteRoute("/patterns/binary-search")).toBe(true);
    expect(isNoteRoute("/notes/my-note")).toBe(true);
  });

  it("rejects list pages and unrelated routes", () => {
    expect(isNoteRoute("/dsa")).toBe(false);
    expect(isNoteRoute("/patterns")).toBe(false);
    expect(isNoteRoute("/notes")).toBe(false);
    expect(isNoteRoute("/")).toBe(false);
    expect(isNoteRoute("/reports")).toBe(false);
    expect(isNoteRoute("/dsa/foo/bar")).toBe(false);
  });
});

describe("isFullBleedRoute", () => {
  it("includes the graph canvas, chat, and note editors", () => {
    expect(isFullBleedRoute("/graph")).toBe(true);
    expect(isFullBleedRoute("/chat")).toBe(true);
    expect(isFullBleedRoute("/dsa/two-sum")).toBe(true);
    expect(isFullBleedRoute("/reports")).toBe(false);
  });
});
