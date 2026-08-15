import { describe, expect, it } from "vitest";
import { assembleFolderTree } from "./tree";
import { canNestFolder, flattenFolderOptions } from "./move";

const folders = [
  { id: "dsa", parentId: null, name: "DSA", sortOrder: 0 },
  { id: "tp", parentId: "dsa", name: "Two pointers", sortOrder: 0 },
  { id: "nested", parentId: "tp", name: "Nested", sortOrder: 0 },
  { id: "pattern", parentId: null, name: "Pattern", sortOrder: 1 },
];

describe("canNestFolder", () => {
  it("allows moving to another branch or to the workspace root", () => {
    expect(canNestFolder(folders, "tp", "pattern")).toBe(true);
    expect(canNestFolder(folders, "tp", null)).toBe(true);
  });

  it("rejects moving a folder into itself or a descendant", () => {
    expect(canNestFolder(folders, "dsa", "dsa")).toBe(false);
    expect(canNestFolder(folders, "dsa", "tp")).toBe(false);
    expect(canNestFolder(folders, "dsa", "nested")).toBe(false);
  });
});

describe("flattenFolderOptions", () => {
  it("lists nested folders with path labels", () => {
    const tree = assembleFolderTree(folders, []);
    expect(flattenFolderOptions(tree)).toEqual([
      { id: "dsa", path: "DSA" },
      { id: "tp", path: "DSA / Two pointers" },
      { id: "nested", path: "DSA / Two pointers / Nested" },
      { id: "pattern", path: "Pattern" },
    ]);
  });
});
