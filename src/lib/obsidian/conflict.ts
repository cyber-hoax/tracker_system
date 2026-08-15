export type SyncWinner = "skip" | "file" | "db" | "conflict";

export const DEFAULT_CLOCK_SKEW_MS = 2_000;

export function decideSyncWinner(input: {
  fileMtime: Date;
  dbUpdatedAt: Date;
  contentsEqual: boolean;
  clockSkewMs?: number;
}): SyncWinner {
  if (input.contentsEqual) {
    return "skip";
  }
  const skew = input.clockSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
  const fileMs = input.fileMtime.getTime();
  const dbMs = input.dbUpdatedAt.getTime();
  if (fileMs > dbMs + skew) {
    return "file";
  }
  if (dbMs > fileMs + skew) {
    return "db";
  }
  return "conflict";
}

export function conflictSiblingPath(relativePath: string): string {
  if (relativePath.toLowerCase().endsWith(".md")) {
    return `${relativePath.slice(0, -3)}.conflict.md`;
  }
  return `${relativePath}.conflict.md`;
}
