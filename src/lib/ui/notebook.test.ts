import { describe, expect, it } from "vitest";
import { assembleFolderTree } from "@/lib/workspace/tree";
import {
  collectFolderNotes,
  folderForPathname,
  formatNoteListTime,
  noteListExcerpt,
  shouldShowNoteList,
  sortFolderNotes,
} from "./notebook";

const AT = new Date("2026-08-01T00:00:00.000Z");

const tree = assembleFolderTree(
  [
    { id: "dsa", parentId: null, name: "DSA", sortOrder: 0 },
    { id: "pattern", parentId: null, name: "Pattern", sortOrder: 1 },
    { id: "tp", parentId: "dsa", name: "Two pointers", sortOrder: 0 },
  ],
  [
    {
      id: "n1",
      title: "Two Sum",
      slug: "two-sum",
      type: "problem",
      folderId: "dsa",
      updatedAt: AT,
      excerpt: "",
    },
    {
      id: "n2",
      title: "Container",
      slug: "container",
      type: "problem",
      folderId: "tp",
      updatedAt: AT,
      excerpt: "",
    },
    {
      id: "n3",
      title: "binary search",
      slug: "binary-search",
      type: "pattern",
      folderId: "pattern",
      updatedAt: AT,
      excerpt: "",
    },
  ],
);

describe("folderForPathname", () => {
  it("resolves a note href to its folder", () => {
    expect(folderForPathname(tree, "/dsa/two-sum")?.id).toBe("dsa");
    expect(folderForPathname(tree, "/dsa/container")?.id).toBe("tp");
    expect(folderForPathname(tree, "/patterns/binary-search")?.id).toBe(
      "pattern",
    );
  });

  it("maps list routes to the seed notebooks", () => {
    expect(folderForPathname(tree, "/dsa")?.name).toBe("DSA");
    expect(folderForPathname(tree, "/patterns")?.name).toBe("Pattern");
    expect(folderForPathname(tree, "/")).toBeNull();
  });
});

describe("collectFolderNotes", () => {
  it("includes nested notes under a notebook", () => {
    const dsa = tree[0]!;
    expect(collectFolderNotes(dsa).map((note) => note.slug)).toEqual([
      "two-sum",
      "container",
    ]);
  });
});

describe("shouldShowNoteList", () => {
  it("hides the list on desk routes until a notebook is opened", () => {
    expect(shouldShowNoteList("/")).toBe(false);
    expect(shouldShowNoteList("/routine")).toBe(false);
    expect(shouldShowNoteList("/reports")).toBe(false);
    expect(shouldShowNoteList("/search")).toBe(false);
    expect(shouldShowNoteList("/settings")).toBe(false);
    expect(shouldShowNoteList("/", { notebookOpen: true })).toBe(true);
  });

  it("shows the list on notebook and note routes", () => {
    expect(shouldShowNoteList("/dsa")).toBe(true);
    expect(shouldShowNoteList("/dsa/two-sum")).toBe(true);
    expect(shouldShowNoteList("/patterns")).toBe(true);
    expect(shouldShowNoteList("/patterns/binary-search")).toBe(true);
    expect(shouldShowNoteList("/notes/alpha")).toBe(true);
  });

  it("hides the list on chat and graph even if a notebook is open", () => {
    expect(shouldShowNoteList("/chat")).toBe(false);
    expect(shouldShowNoteList("/graph")).toBe(false);
    expect(shouldShowNoteList("/chat", { notebookOpen: true })).toBe(false);
    expect(shouldShowNoteList("/graph", { notebookOpen: true })).toBe(false);
  });
});

describe("noteListExcerpt", () => {
  it("returns empty for empty body", () => {
    expect(noteListExcerpt("")).toBe("");
    expect(noteListExcerpt("   \n")).toBe("");
  });

  it("strips a heading and keeps paragraph text", () => {
    expect(noteListExcerpt("# Heading\n\nBody text")).toBe("Heading Body text");
  });

  it("truncates at 100 characters with an ellipsis", () => {
    const body = "a".repeat(120);
    const next = noteListExcerpt(body);
    expect(next.length).toBe(101);
    expect(next.endsWith("…")).toBe(true);
    expect(next.slice(0, 100)).toBe("a".repeat(100));
  });

  it("unwraps wikilinks", () => {
    expect(noteListExcerpt("See [[Foo]] next")).toBe("See Foo next");
  });

  it("drops fenced code and markdown links", () => {
    expect(
      noteListExcerpt("Intro\n```\nsecret()\n```\n[click](https://x.test)"),
    ).toBe("Intro click");
  });
});

describe("formatNoteListTime", () => {
  const now = new Date("2026-08-19T12:00:00.000Z");

  it("uses just now under 60 seconds", () => {
    expect(
      formatNoteListTime(new Date("2026-08-19T11:59:30.000Z"), now),
    ).toBe("just now");
  });

  it("uses N min under 60 minutes", () => {
    expect(
      formatNoteListTime(new Date("2026-08-19T11:10:00.000Z"), now),
    ).toBe("50 min");
  });

  it("uses 1 hour or N hours under 24 hours", () => {
    expect(
      formatNoteListTime(new Date("2026-08-19T11:00:00.000Z"), now),
    ).toBe("1 hour");
    expect(
      formatNoteListTime(new Date("2026-08-19T09:00:00.000Z"), now),
    ).toBe("3 hours");
  });

  it("uses 1 day or N days under 7 days", () => {
    expect(
      formatNoteListTime(new Date("2026-08-18T12:00:00.000Z"), now),
    ).toBe("1 day");
    expect(
      formatNoteListTime(new Date("2026-08-16T12:00:00.000Z"), now),
    ).toBe("3 days");
  });

  it("uses local YYYY-MM-DD at 7 days or older", () => {
    const updatedAt = new Date("2026-08-01T12:00:00.000Z");
    const y = updatedAt.getFullYear();
    const m = String(updatedAt.getMonth() + 1).padStart(2, "0");
    const d = String(updatedAt.getDate()).padStart(2, "0");
    expect(formatNoteListTime(updatedAt, now)).toBe(`${y}-${m}-${d}`);
  });
});

describe("sortFolderNotes", () => {
  const older = {
    id: "a",
    title: "Alpha",
    slug: "alpha",
    type: "note",
    href: "/notes/alpha",
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    excerpt: "",
    patterns: [],
    folderId: "dsa",
  };
  const newer = {
    ...older,
    id: "b",
    title: "Beta",
    slug: "beta",
    href: "/notes/beta",
    updatedAt: new Date("2026-08-19T00:00:00.000Z"),
  };

  it("keeps given order for mocha", () => {
    const input = [older, newer];
    expect(sortFolderNotes(input, "mocha")).toBe(input);
    expect(sortFolderNotes(input, "mocha").map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("sorts Inkdrop Light the same way as Inkdrop", () => {
    expect(
      sortFolderNotes([older, newer], "inkdrop-light").map((n) => n.id),
    ).toEqual(["b", "a"]);
  });

  it("tie-breaks equal updatedAt by title localeCompare", () => {
    const sameTime = new Date("2026-08-19T00:00:00.000Z");
    const beta = { ...newer, updatedAt: sameTime };
    const alpha = { ...older, updatedAt: sameTime };
    expect(
      sortFolderNotes([beta, alpha], "inkdrop").map((n) => n.title),
    ).toEqual(["Alpha", "Beta"]);
  });
});
