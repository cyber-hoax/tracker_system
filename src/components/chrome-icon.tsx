"use client";

import type { Icon, IconWeight } from "@phosphor-icons/react";

export const CHROME_ICON_SIZE = 20;
export const CHROME_ICON_WEIGHT: IconWeight = "bold";

export function ChromeIcon({
  icon: Glyph,
  className,
  size = CHROME_ICON_SIZE,
}: {
  icon: Icon;
  className?: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <Glyph size={size} weight={CHROME_ICON_WEIGHT} />
    </span>
  );
}
