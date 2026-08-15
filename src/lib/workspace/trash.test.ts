import { describe, expect, it } from "vitest";
import {
  MAX_TRASH_SNAPSHOTS,
  collectSubtreeFolders,
  resolveRestoreFolderParent,
  resolveRestoreNoteFolder,
  snapshotIdsToPrune,
} from "./trash";

const folders = [
  { id: "dsa", parentId: null, name: "DSA", sortOrder: 0 },
  { id: "tp", parentId: "dsa", name: "Two pointers", sortOrder: 0 },
  { id: "nested", parentId: "tp", name: "Nested", sortOrder: 0 },
  { id: "pattern", parentId: null, name: "Pattern", sortOrder: 1 },
];

describe("snapshotIdsToPrune", () => {
  it("keeps only the 10 most recent snapshot ids", () => {
    const newestFirst = Array.from({ length: 12 }, (_, i) => `s${i}`);
    expect(snapshotIdsToPrune(newestFirst)).toEqual(["s10", "s11"]);
    expect(snapshotIdsToPrune(newestFirst, MAX_TRASH_SNAPSHOTS)).toHaveLength(2);
    expect(snapshotIdsToPrune(newestFirst.slice(0, 10))).toEqual([]);
  });
});

describe("collectSubtreeFolders", () => {
  it("includes the folder and nested children in parent-first order", () => {
    const subtree = collectSubtreeFolders(folders, "dsa");
    expect(subtree.map((folder) => folder.id)).toEqual(["dsa", "tp", "nested"]);
  });
});

describe("resolveRestoreFolderParent", () => {
  it("nests under the original parent when it still exists", () => {
    expect(resolveRestoreFolderParent("dsa", new Set(["dsa"]))).toBe("dsa");
  });

  it("restores at workspace root when the original parent is gone", () => {
    expect(resolveRestoreFolderParent("missing", new Set(["dsa"]))).toBeNull();
    expect(resolveRestoreFolderParent(null, new Set(["dsa"]))).toBeNull();
  });
});

describe("resolveRestoreNoteFolder", () => {
  it("uses the original folder id when it still exists", () => {
    expect(
      resolveRestoreNoteFolder("tp", ["DSA", "Two pointers"], folders),
    ).toBe("tp");
  });

  it("walks folderPath when the original folder id is gone", () => {
    expect(
      resolveRestoreNoteFolder("gone", ["DSA", "Two pointers"], folders),
    ).toBe("tp");
  });

  it("falls back to the last existing ancestor on the path", () => {
    expect(
      resolveRestoreNoteFolder("gone", ["DSA", "Missing"], folders),
    ).toBe("dsa");
  });
});
