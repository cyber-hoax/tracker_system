"use client";

import { createPortal } from "react-dom";
import { useLayoutEffect, useRef } from "react";
import {
  CheckSquare,
  Code,
  ListBullets,
  ListNumbers,
  Minus,
  Quotes,
  TextHOne,
  TextHThree,
  TextHTwo,
  type Icon,
} from "@phosphor-icons/react";
import {
  filterSlashCommands,
  type SlashCommand,
} from "@/lib/editor/slash";

const SLASH_ICONS: Record<string, Icon> = {
  todo: CheckSquare,
  bullet: ListBullets,
  numbered: ListNumbers,
  heading1: TextHOne,
  heading2: TextHTwo,
  heading3: TextHThree,
  quote: Quotes,
  divider: Minus,
  code: Code,
};

export function SlashMenu({
  anchorId,
  query,
  highlighted,
  onHighlight,
  onSelect,
}: {
  anchorId: string;
  query: string;
  highlighted: number;
  onHighlight: (index: number) => void;
  onSelect: (command: SlashCommand) => void;
}) {
  const items = filterSlashCommands(query);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = panel.current;
    const anchor = document.getElementById(anchorId);
    if (!el || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const menuHeight = el.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < menuHeight + 12 && rect.top > menuHeight
        ? rect.top - menuHeight - 6
        : rect.bottom + 6;
    const left = Math.min(rect.left, window.innerWidth - el.offsetWidth - 12);
    el.style.top = `${Math.max(8, top)}px`;
    el.style.left = `${Math.max(8, left)}px`;
  }, [anchorId, query, items.length]);

  useLayoutEffect(() => {
    const selected = panel.current?.querySelector("[data-active='true']");
    selected?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panel}
      role="listbox"
      aria-label="Turn into"
      className="slash-menu fixed z-50 w-80 overflow-hidden rounded-md border border-ctp-surface1 bg-ctp-base shadow-xl"
    >
      <p className="border-b border-ctp-surface0 px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-ctp-overlay0">
        Basic blocks
      </p>
      <ul className="max-h-80 overflow-y-auto py-1">
        {items.length === 0 ? (
          <li className="px-3 py-2 text-sm text-ctp-overlay0">No matches</li>
        ) : (
          items.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlighted}
                data-active={index === highlighted}
                onMouseEnter={() => onHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(item);
                }}
                className={`flex w-full items-center gap-3 px-2 py-1.5 text-left ${
                  index === highlighted ? "bg-ctp-surface0" : "bg-transparent"
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ctp-surface1 bg-ctp-mantle text-ctp-subtext0">
                  <SlashIcon id={item.id} />
                </span>
                <span>
                  <span className="block text-sm text-ctp-text">{item.label}</span>
                  <span className="block text-xs text-ctp-overlay0">
                    {item.description}
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>,
    document.body,
  );
}

function SlashIcon({ id }: { id: string }) {
  const Icon = SLASH_ICONS[id];
  if (!Icon) return null;
  return <Icon size={22} weight="bold" />;
}
