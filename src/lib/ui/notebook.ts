import { isInkdropDesk, type ColorTheme } from "@/lib/appearance";
import { isNoteRoute } from "@/lib/ui/note-route";
import type { FolderTreeNode, FolderTreeNote } from "@/lib/workspace/tree";

export function findFolderById(
  nodes: FolderTreeNode[],
  id: string,
): FolderTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findFolderById(node.children, id);
    if (nested) return nested;
  }
  return null;
}

export function findFolderForNoteHref(
  nodes: FolderTreeNode[],
  href: string,
): FolderTreeNode | null {
  for (const node of nodes) {
    if (node.notes.some((note) => note.href === href)) return node;
    const nested = findFolderForNoteHref(node.children, href);
    if (nested) return nested;
  }
  return null;
}

export function collectFolderNotes(node: FolderTreeNode): FolderTreeNote[] {
  return [...node.notes, ...node.children.flatMap(collectFolderNotes)];
}

export function sortFolderNotes(
  notes: FolderTreeNote[],
  colorTheme: ColorTheme,
): FolderTreeNote[] {
  if (!isInkdropDesk(colorTheme)) return notes;
  return [...notes].sort((a, b) => {
    const byTime = b.updatedAt.getTime() - a.updatedAt.getTime();
    if (byTime !== 0) return byTime;
    return a.title.localeCompare(b.title);
  });
}

export function folderForPathname(
  tree: FolderTreeNode[],
  pathname: string,
): FolderTreeNode | null {
  const fromNote = findFolderForNoteHref(tree, pathname);
  if (fromNote) return fromNote;
  if (pathname === "/dsa" || pathname.startsWith("/dsa/")) {
    return tree.find((node) => node.name === "DSA") ?? null;
  }
  if (pathname === "/patterns" || pathname.startsWith("/patterns/")) {
    return tree.find((node) => node.name === "Pattern") ?? null;
  }
  return null;
}

export function isNotebookPath(pathname: string): boolean {
  return (
    pathname === "/dsa" ||
    pathname === "/patterns" ||
    pathname === "/notes" ||
    isNoteRoute(pathname)
  );
}

export function shouldShowNoteList(
  pathname: string,
  options?: { notebookOpen?: boolean },
): boolean {
  if (pathname === "/chat" || pathname === "/graph") return false;
  if (isNotebookPath(pathname)) return true;
  return Boolean(options?.notebookOpen);
}

export function noteListExcerpt(body: string): string {
  let text = body.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");
  text = text.replace(/[*_~`]+/g, "");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length <= 100) return text;
  return text.slice(0, 100) + "…";
}

export function formatNoteListTime(updatedAt: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - updatedAt.getTime());
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return Math.floor(ms / 60_000) + " min";
  if (ms < 86_400_000) {
    const hours = Math.floor(ms / 3_600_000);
    return hours === 1 ? "1 hour" : hours + " hours";
  }
  if (ms < 7 * 86_400_000) {
    const days = Math.floor(ms / 86_400_000);
    return days === 1 ? "1 day" : days + " days";
  }
  const y = updatedAt.getFullYear();
  const m = String(updatedAt.getMonth() + 1).padStart(2, "0");
  const d = String(updatedAt.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}
