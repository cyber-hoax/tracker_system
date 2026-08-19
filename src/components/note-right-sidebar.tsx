"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "note-right-sidebar-collapsed";

export function NoteRightSidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <aside
      aria-label="Note properties"
      className={`flex shrink-0 flex-col overflow-hidden border-t border-ctp-surface0 bg-ctp-mantle lg:h-full lg:max-h-full lg:border-t-0 lg:border-l ${
        collapsed ? "w-full lg:w-[52px]" : "w-full lg:w-[248px]"
      }`}
    >
      <div className="flex items-center border-b border-ctp-surface0 px-2 py-2">
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-ctp-overlay0 hover:bg-ctp-surface0 hover:text-ctp-text"
            aria-label="Expand properties sidebar"
          >
            <CaretLeft size={20} weight="bold" />
          </button>
        ) : (
          <>
            <span className="min-w-0 flex-1 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ctp-overlay0">
              Note
            </span>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex h-8 w-8 items-center justify-center rounded-md text-ctp-overlay0 hover:bg-ctp-surface0 hover:text-ctp-text"
              aria-label="Collapse properties sidebar"
            >
              <CaretRight size={20} weight="bold" />
            </button>
          </>
        )}
      </div>
      {collapsed ? null : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      )}
    </aside>
  );
}
