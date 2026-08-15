import { noteHref } from "@/lib/zettel/slug";
import type { NoteType } from "@/db/schema";

export type FolderRow = {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
};

export type FolderNoteRow = {
  id: string;
  title: string;
  slug: string;
  type: string;
  folderId: string | null;
};

export type FolderTreeNote = {
  id: string;
  title: string;
  slug: string;
  type: string;
  href: string;
};

export type FolderTreeNode = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  children: FolderTreeNode[];
  notes: FolderTreeNote[];
};

export const SEED_ROOT_FOLDERS = [
  { name: "DSA", sortOrder: 0 },
  { name: "Pattern", sortOrder: 1 },
  { name: "LLD", sortOrder: 2 },
  { name: "HLD", sortOrder: 3 },
  { name: "AI", sortOrder: 4 },
] as const;

export const DESIGN_FOLDER_NAMES = ["LLD", "HLD", "AI"] as const;

export type DesignFolderPromotion =
  | { kind: "promote"; id: string; sortOrder: number }
  | { kind: "merge"; fromId: string; intoId: string };

export function planDesignFolderPromotion(
  folders: FolderRow[],
): DesignFolderPromotion[] {
  const dsa = folders.find(
    (folder) => folder.parentId === null && folder.name === "DSA",
  );
  if (!dsa) return [];

  const sortByName = new Map(
    SEED_ROOT_FOLDERS.map((folder) => [folder.name, folder.sortOrder]),
  );
  const plan: DesignFolderPromotion[] = [];

  for (const name of DESIGN_FOLDER_NAMES) {
    const nested = folders.filter(
      (folder) => folder.parentId === dsa.id && folder.name === name,
    );
    const root = folders.find(
      (folder) => folder.parentId === null && folder.name === name,
    );
    const sortOrder = sortByName.get(name) ?? 0;

    for (const child of nested) {
      if (root) {
        plan.push({ kind: "merge", fromId: child.id, intoId: root.id });
      } else {
        plan.push({ kind: "promote", id: child.id, sortOrder });
      }
    }
  }

  return plan;
}

export function inferNoteType(folderPath: string[]): NoteType {
  const names = folderPath.map((name) => name.trim().toLowerCase());
  if (names.some((name) => name === "lld")) return "lld";
  if (names.some((name) => name === "hld")) return "hld";
  if (names.some((name) => name === "ai")) return "ai";
  if (names[0] === "pattern" || names[0] === "patterns") return "pattern";
  if (names[0] === "dsa") return "problem";
  return "note";
}

export function folderChildCount(node: FolderTreeNode): number {
  return (
    node.children.length +
    node.notes.length +
    node.children.reduce((sum, child) => sum + folderChildCount(child), 0)
  );
}

export function assembleFolderTree(
  folders: FolderRow[],
  notes: FolderNoteRow[],
): FolderTreeNode[] {
  const byParent = new Map<string | null, FolderRow[]>();
  for (const folder of folders) {
    const key = folder.parentId;
    const list = byParent.get(key) ?? [];
    list.push(folder);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }

  const notesByFolder = new Map<string, FolderTreeNote[]>();
  for (const note of notes) {
    if (!note.folderId) continue;
    const list = notesByFolder.get(note.folderId) ?? [];
    list.push({
      id: note.id,
      title: note.title,
      slug: note.slug,
      type: note.type,
      href: noteHref(note.type, note.slug),
    });
    notesByFolder.set(note.folderId, list);
  }
  for (const list of notesByFolder.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }

  function build(parentId: string | null): FolderTreeNode[] {
    return (byParent.get(parentId) ?? []).map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      sortOrder: folder.sortOrder,
      children: build(folder.id),
      notes: notesByFolder.get(folder.id) ?? [],
    }));
  }

  return build(null);
}
