import type { CSSProperties } from "react";

export const TAG_ACCENTS = [
  "rosewater",
  "flamingo",
  "pink",
  "mauve",
  "red",
  "maroon",
  "peach",
  "yellow",
  "green",
  "teal",
  "sky",
  "sapphire",
  "blue",
  "lavender",
] as const;

export type TagAccent = (typeof TAG_ACCENTS)[number];

export function tagAccent(label: string): TagAccent {
  const key = label.trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return TAG_ACCENTS[(hash >>> 0) % TAG_ACCENTS.length];
}

export function tagChipStyle(label: string): CSSProperties {
  return {
    ["--tag-accent" as string]: `var(--ctp-${tagAccent(label)})`,
  };
}
