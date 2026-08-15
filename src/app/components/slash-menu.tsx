"use client";

import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  filterSlashCommands,
  type SlashCommand,
} from "@/lib/editor/slash";

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
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-ctp-surface1 bg-ctp-mantle text-ctp-subtext0">
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
  const icons: Record<string, ReactNode> = {
    todo: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <rect x="3" y="3" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 9.5 8 12l4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    bullet: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="5" cy="5" r="1.2" fill="currentColor" />
        <circle cx="5" cy="9" r="1.2" fill="currentColor" />
        <circle cx="5" cy="13" r="1.2" fill="currentColor" />
        <rect x="8" y="4" width="7" height="2" rx="0.5" fill="currentColor" />
        <rect x="8" y="8" width="7" height="2" rx="0.5" fill="currentColor" />
        <rect x="8" y="12" width="7" height="2" rx="0.5" fill="currentColor" />
      </svg>
    ),
    numbered: (
      <span className="font-mono text-xs leading-none">
        1.
        <br />
        2.
        <br />
        3.
      </span>
    ),
    heading1: <span className="font-serif text-lg font-semibold">H1</span>,
    heading2: <span className="font-serif text-base font-semibold">H2</span>,
    heading3: <span className="font-serif text-sm font-semibold">H3</span>,
    quote: <span className="font-serif text-xl leading-none">“</span>,
    divider: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <rect x="3" y="8.25" width="12" height="1.5" fill="currentColor" />
      </svg>
    ),
    code: <span className="font-mono text-xs">&lt;/&gt;</span>,
  };
  return icons[id] ?? <span>/</span>;
}
