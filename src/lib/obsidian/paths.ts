import path from "node:path";
import type { NoteType } from "@/db/schema";

const DEFAULT_TRACKER_DIR = "Notion/tracker";
const PATTERNS_DIR = "Patterns";

export function vaultRoot(): string | null {
  const raw = process.env.OBSIDIAN_VAULT?.trim();
  return raw ? raw : null;
}

export function trackerDirRel(): string {
  const raw = process.env.OBSIDIAN_TRACKER_DIR?.trim();
  return toPosix(raw || DEFAULT_TRACKER_DIR).replace(/\/+$/, "");
}

export function patternsDirRel(): string {
  return PATTERNS_DIR;
}

export function toPosix(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

export function relativeNotePath(type: NoteType, title: string): string {
  const fileName = `${title}.md`;
  if (type === "pattern") {
    return `${PATTERNS_DIR}/${fileName}`;
  }
  if (type === "lld") return `${trackerDirRel()}/LLD/${fileName}`;
  if (type === "hld") return `${trackerDirRel()}/HLD/${fileName}`;
  if (type === "ai") return `${trackerDirRel()}/AI/${fileName}`;
  if (type === "note") return `${trackerDirRel()}/Notes/${fileName}`;
  return `${trackerDirRel()}/${fileName}`;
}

/** `Untitled.md` → `Untitled-2.md` when `n >= 2`. */
export function suffixedRelativePath(relativePath: string, n: number): string {
  const posix = toPosix(relativePath);
  if (n < 2) return posix;
  const lastSlash = posix.lastIndexOf("/");
  const dir = lastSlash >= 0 ? posix.slice(0, lastSlash + 1) : "";
  const file = lastSlash >= 0 ? posix.slice(lastSlash + 1) : posix;
  const md = file.toLowerCase().endsWith(".md");
  const stem = md ? file.slice(0, -3) : file;
  const ext = md ? ".md" : "";
  return `${dir}${stem}-${n}${ext}`;
}

export function absoluteVaultPath(relativePath: string): string {
  const root = vaultRoot();
  if (!root) {
    throw new Error("OBSIDIAN_VAULT is not set");
  }
  return path.join(root, ...toPosix(relativePath).split("/"));
}

export function skipVaultFileReason(relativePath: string): string | null {
  const posix = toPosix(relativePath);
  const base = posix.split("/").pop() ?? posix;
  if (base.endsWith(".conflict.md")) {
    return "conflict sibling";
  }
  if (posix === `${PATTERNS_DIR}/Patterns.md`) {
    return "Obsidian folder note";
  }
  if (!base.endsWith(".md")) {
    return "not markdown";
  }
  return null;
}
