import type { NoteType } from "@/db/schema";

export const MAX_TRASH_SNAPSHOTS = 10;

export type TrashFolderNode = {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
};

export type TrashNotePayload = {
  id: string;
  type: NoteType;
  title: string;
  slug: string;
  body: string;
  filePath: string | null;
  folderId: string | null;
  folderPath: string[];
  properties: { key: string; valueType: string; value: unknown }[];
};

export type TrashSnapshotPayload =
  | { kind: "note"; note: TrashNotePayload }
  | {
      kind: "folder";
      rootId: string;
      folders: TrashFolderNode[];
      notes: TrashNotePayload[];
    };

export function snapshotIdsToPrune(
  idsNewestFirst: string[],
  max = MAX_TRASH_SNAPSHOTS,
): string[] {
  return idsNewestFirst.slice(max);
}

export function collectSubtreeFolders<T extends TrashFolderNode>(
  folders: T[],
  rootId: string,
): T[] {
  const children = new Map<string | null, T[]>();
  for (const folder of folders) {
    const list = children.get(folder.parentId) ?? [];
    list.push(folder);
    children.set(folder.parentId, list);
  }
  const ordered: T[] = [];
  function walk(id: string) {
    const folder = folders.find((row) => row.id === id);
    if (!folder) return;
    ordered.push(folder);
    for (const child of children.get(id) ?? []) {
      walk(child.id);
    }
  }
  walk(rootId);
  return ordered;
}

export function folderPathNamesFromRows(
  folders: { id: string; parentId: string | null; name: string }[],
  folderId: string | null,
): string[] {
  const names: string[] = [];
  let current = folderId;
  const seen = new Set<string>();
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    const folder = byId.get(current);
    if (!folder) break;
    names.unshift(folder.name);
    current = folder.parentId;
  }
  return names;
}

export function resolveRestoreFolderParent(
  parentId: string | null,
  existingFolderIds: Set<string>,
): string | null {
  if (!parentId) return null;
  return existingFolderIds.has(parentId) ? parentId : null;
}

export function resolveRestoreNoteFolder(
  folderId: string | null,
  folderPath: string[],
  folders: { id: string; parentId: string | null; name: string }[],
): string | null {
  if (folderId && folders.some((folder) => folder.id === folderId)) {
    return folderId;
  }
  let parent: string | null = null;
  for (const name of folderPath) {
    const match = folders.find(
      (folder) => folder.parentId === parent && folder.name === name,
    );
    if (!match) return parent;
    parent = match.id;
  }
  return parent;
}

export function snapshotLabel(payload: TrashSnapshotPayload): string {
  if (payload.kind === "note") return payload.note.title;
  const root = payload.folders.find((folder) => folder.id === payload.rootId);
  return root?.name ?? "Folder";
}
