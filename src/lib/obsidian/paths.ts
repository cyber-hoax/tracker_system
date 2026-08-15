import path from "node:path";

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

export function relativeNotePath(
  type: "problem" | "pattern",
  title: string,
): string {
  const fileName = `${title}.md`;
  if (type === "pattern") {
    return `${PATTERNS_DIR}/${fileName}`;
  }
  return `${trackerDirRel()}/${fileName}`;
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
