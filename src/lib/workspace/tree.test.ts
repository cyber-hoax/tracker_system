import { describe, expect, it } from "vitest";
import {
  assembleFolderTree,
  folderChildCount,
  inferNoteType,
  planDesignFolderPromotion,
} from "./tree";

describe("inferNoteType", () => {
  it("maps root DSA, Pattern, LLD, HLD, and AI paths", () => {
    expect(inferNoteType(["DSA"])).toBe("problem");
    expect(inferNoteType(["DSA", "Two pointers"])).toBe("problem");
    expect(inferNoteType(["Pattern"])).toBe("pattern");
    expect(inferNoteType(["Patterns"])).toBe("pattern");
    expect(inferNoteType(["LLD"])).toBe("lld");
    expect(inferNoteType(["HLD"])).toBe("hld");
    expect(inferNoteType(["AI"])).toBe("ai");
    expect(inferNoteType(["LLD", "Parking lot"])).toBe("lld");
    expect(inferNoteType(["Projects"])).toBe("note");
  });
});

describe("assembleFolderTree", () => {
  it("keeps nested user folders while showing LLD/HLD/AI as root siblings", () => {
    const tree = assembleFolderTree(
      [
        { id: "dsa", parentId: null, name: "DSA", sortOrder: 0 },
        { id: "pattern", parentId: null, name: "Pattern", sortOrder: 1 },
        { id: "lld", parentId: null, name: "LLD", sortOrder: 2 },
        { id: "hld", parentId: null, name: "HLD", sortOrder: 3 },
        { id: "ai", parentId: null, name: "AI", sortOrder: 4 },
        { id: "tp", parentId: "dsa", name: "Two pointers", sortOrder: 0 },
      ],
      [
        {
          id: "n1",
          title: "Two Sum",
          slug: "two-sum",
          type: "problem",
          folderId: "dsa",
        },
        {
          id: "n2",
          title: "Parking lot",
          slug: "parking-lot",
          type: "lld",
          folderId: "lld",
        },
        {
          id: "n3",
          title: "binary search",
          slug: "patterns-binary-search",
          type: "pattern",
          folderId: "pattern",
        },
      ],
    );

    expect(tree.map((node) => node.name)).toEqual([
      "DSA",
      "Pattern",
      "LLD",
      "HLD",
      "AI",
    ]);
    expect(tree[0]?.children.map((node) => node.name)).toEqual(["Two pointers"]);
    expect(tree[0]?.notes[0]).toMatchObject({
      title: "Two Sum",
      href: "/dsa/two-sum",
    });
    expect(tree[2]?.notes[0]).toMatchObject({
      href: "/notes/parking-lot",
    });
    expect(tree[1]?.notes[0]?.href).toBe("/patterns/binary-search");
    expect(folderChildCount(tree[0]!)).toBe(2);
    expect(folderChildCount(tree[2]!)).toBe(1);
  });
});

describe("planDesignFolderPromotion", () => {
  it("promotes LLD, HLD, and AI from under DSA to root", () => {
    expect(
      planDesignFolderPromotion([
        { id: "dsa", parentId: null, name: "DSA", sortOrder: 0 },
        { id: "pattern", parentId: null, name: "Pattern", sortOrder: 1 },
        { id: "lld", parentId: "dsa", name: "LLD", sortOrder: 0 },
        { id: "hld", parentId: "dsa", name: "HLD", sortOrder: 1 },
        { id: "ai", parentId: "dsa", name: "AI", sortOrder: 2 },
        { id: "tp", parentId: "dsa", name: "Two pointers", sortOrder: 3 },
      ]),
    ).toEqual([
      { kind: "promote", id: "lld", sortOrder: 2 },
      { kind: "promote", id: "hld", sortOrder: 3 },
      { kind: "promote", id: "ai", sortOrder: 4 },
    ]);
  });

  it("merges nested copies into existing root folders instead of duplicating", () => {
    expect(
      planDesignFolderPromotion([
        { id: "dsa", parentId: null, name: "DSA", sortOrder: 0 },
        { id: "root-lld", parentId: null, name: "LLD", sortOrder: 2 },
        { id: "nested-lld", parentId: "dsa", name: "LLD", sortOrder: 0 },
      ]),
    ).toEqual([{ kind: "merge", fromId: "nested-lld", intoId: "root-lld" }]);
  });

  it("is a no-op when design folders are already roots", () => {
    expect(
      planDesignFolderPromotion([
        { id: "dsa", parentId: null, name: "DSA", sortOrder: 0 },
        { id: "pattern", parentId: null, name: "Pattern", sortOrder: 1 },
        { id: "lld", parentId: null, name: "LLD", sortOrder: 2 },
        { id: "hld", parentId: null, name: "HLD", sortOrder: 3 },
        { id: "ai", parentId: null, name: "AI", sortOrder: 4 },
      ]),
    ).toEqual([]);
  });
});
