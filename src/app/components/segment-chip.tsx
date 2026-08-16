import { tagChipStyle } from "@/lib/ui/tag-color";

const difficultyClass: Record<string, string> = {
  easy: "bg-ctp-green/20 text-ctp-green",
  medium: "bg-ctp-yellow/20 text-ctp-yellow",
  hard: "bg-ctp-red/20 text-ctp-red",
};

const statusClass: Record<string, string> = {
  Solved: "bg-ctp-green/20 text-ctp-green",
  Partial: "bg-ctp-peach/20 text-ctp-peach",
  Unsolved: "bg-ctp-overlay0/30 text-ctp-overlay2",
};

export function SegmentChip({
  kind,
  value,
}: {
  kind?: "difficulty" | "status" | "pattern" | "neutral";
  value: string;
}) {
  const color =
    kind === "difficulty"
      ? (difficultyClass[value] ?? "bg-ctp-surface0 text-ctp-subtext0")
      : kind === "status"
        ? (statusClass[value] ?? "bg-ctp-surface0 text-ctp-subtext0")
        : kind === "pattern"
          ? "tag-chip"
          : "bg-ctp-surface0 text-ctp-subtext1";

  return (
    <span
      className={`inline-flex items-center rounded-sm font-mono text-xs px-2 py-0.5 ${color}`}
      style={kind === "pattern" ? tagChipStyle(value) : undefined}
    >
      {value}
    </span>
  );
}
