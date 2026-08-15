import { describe, expect, it } from "vitest";
import { conflictSiblingPath, decideSyncWinner } from "./conflict";

describe("decideSyncWinner", () => {
  it("skips when file and DB contents already match", () => {
    expect(
      decideSyncWinner({
        fileMtime: new Date("2026-08-15T10:00:02Z"),
        dbUpdatedAt: new Date("2026-08-15T10:00:00Z"),
        contentsEqual: true,
      }),
    ).toBe("skip");
  });

  it("lets the newer mtime win over updated_at", () => {
    expect(
      decideSyncWinner({
        fileMtime: new Date("2026-08-15T12:00:00Z"),
        dbUpdatedAt: new Date("2026-08-15T11:00:00Z"),
        contentsEqual: false,
      }),
    ).toBe("file");
  });

  it("lets the newer updated_at win over mtime", () => {
    expect(
      decideSyncWinner({
        fileMtime: new Date("2026-08-15T11:00:00Z"),
        dbUpdatedAt: new Date("2026-08-15T12:00:00Z"),
        contentsEqual: false,
      }),
    ).toBe("db");
  });

  it("keeps DB and treats near-simultaneous edits as a conflict", () => {
    expect(
      decideSyncWinner({
        fileMtime: new Date("2026-08-15T12:00:00.400Z"),
        dbUpdatedAt: new Date("2026-08-15T12:00:00.100Z"),
        contentsEqual: false,
      }),
    ).toBe("conflict");
  });
});

describe("conflictSiblingPath", () => {
  it("writes a .conflict.md sibling next to the vault file", () => {
    expect(conflictSiblingPath("Notion/tracker/Binary Search.md")).toBe(
      "Notion/tracker/Binary Search.conflict.md",
    );
  });
});
