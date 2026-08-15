import type { FolderTreeNode } from "./tree";

export type FolderOption = { id: string; path: string };

export function canNestFolder(
  folders: { id: string; parentId: string | null }[],
  folderId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) return true;
  if (newParentId === folderId) return false;
  const children = new Map<string | null, string[]>();
  for (const folder of folders) {
    const list = children.get(folder.parentId) ?? [];
    list.push(folder.id);
    children.set(folder.parentId, list);
  }
  const subtree = new Set<string>();
  function walk(id: string) {
    subtree.add(id);
    for (const child of children.get(id) ?? []) walk(child);
  }
  walk(folderId);
  return !subtree.has(newParentId);
}

export function flattenFolderOptions(
  tree: FolderTreeNode[],
  prefix = "",
): FolderOption[] {
  const out: FolderOption[] = [];
  for (const node of tree) {
    const path = prefix ? `${prefix} / ${node.name}` : node.name;
    out.push({ id: node.id, path });
    out.push(...flattenFolderOptions(node.children, path));
  }
  return out;
}
