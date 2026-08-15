"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type WorkspaceMenuTarget =
  | { kind: "folder"; id: string; name: string; parentId: string | null }
  | { kind: "note"; id: string; title: string; folderId: string | null };

export type WorkspaceMenuState = {
  x: number;
  y: number;
  target: WorkspaceMenuTarget;
};

export type MoveTargetOption = { id: string | null; path: string };

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M8 3v10M3 8h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M2.5 13V5.5A1.5 1.5 0 0 1 4 4h2.2L8 5.8H12a1.5 1.5 0 0 1 1.5 1.5V13A1.5 1.5 0 0 1 12 14.5H4A1.5 1.5 0 0 1 2.5 13Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRename() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M10.2 3.4 12.6 5.8 5.8 12.6H3.4v-2.4L10.2 3.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMove() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M3 8h10M9 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M3.5 4.5h9M6 4.5V3h4v1.5M5 6.5l.4 6.2h5.2L11 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EllipsisIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="3.5" cy="8" r="1.4" fill="currentColor" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function WorkspaceItemMenu({
  menu,
  moveTargets,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onMove,
  onTrash,
}: {
  menu: WorkspaceMenuState | null;
  moveTargets: MoveTargetOption[];
  onClose: () => void;
  onNewFile: (target: WorkspaceMenuTarget) => void;
  onNewFolder: (target: WorkspaceMenuTarget) => void;
  onRename: (target: WorkspaceMenuTarget) => void;
  onMove: (target: WorkspaceMenuTarget, folderId: string | null) => void;
  onTrash: (target: WorkspaceMenuTarget) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMoveOpen(false);
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const pad = 8;
    setPos({
      left: Math.min(
        Math.max(pad, menu.x),
        window.innerWidth - rect.width - pad,
      ),
      top: Math.min(
        Math.max(pad, menu.y),
        window.innerHeight - rect.height - pad,
      ),
    });
  }, [menu, moveOpen]);

  useEffect(() => {
    if (!menu) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onPointer(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [menu, onClose]);

  if (!mounted || !menu) return null;

  const itemClass =
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ctp-text hover:bg-ctp-surface0";

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      className="fixed z-[80] min-w-[220px] rounded-lg border border-ctp-surface0 bg-ctp-base p-1 shadow-xl"
      style={{ left: pos.left, top: pos.top }}
    >
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => {
          onNewFile(menu.target);
          onClose();
        }}
      >
        <span className="text-ctp-overlay0">
          <IconPlus />
        </span>
        New file
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => {
          onNewFolder(menu.target);
          onClose();
        }}
      >
        <span className="text-ctp-overlay0">
          <IconFolder />
        </span>
        New folder
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => {
          onRename(menu.target);
          onClose();
        }}
      >
        <span className="text-ctp-overlay0">
          <IconRename />
        </span>
        Rename
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => setMoveOpen((value) => !value)}
      >
        <span className="text-ctp-overlay0">
          <IconMove />
        </span>
        <span className="flex-1">Move to</span>
        <span className="text-[10px] text-ctp-overlay0">{moveOpen ? "▾" : "▸"}</span>
      </button>
      {moveOpen ? (
        <div className="my-1 max-h-48 overflow-y-auto rounded-md border border-ctp-surface0 bg-ctp-mantle py-1">
          {moveTargets.length === 0 ? (
            <p className="px-2 py-1.5 text-[12px] text-ctp-overlay0">
              No folders
            </p>
          ) : (
            moveTargets.map((target) => (
              <button
                key={target.id ?? "root"}
                type="button"
                role="menuitem"
                className="block w-full truncate px-2 py-1 text-left text-[12px] text-ctp-subtext0 hover:bg-ctp-surface0 hover:text-ctp-text"
                onClick={() => {
                  onMove(menu.target, target.id);
                  onClose();
                }}
              >
                {target.path}
              </button>
            ))
          )}
        </div>
      ) : null}
      <div className="my-1 border-t border-ctp-surface0" />
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ctp-red hover:bg-ctp-surface0"
        onClick={() => {
          onTrash(menu.target);
          onClose();
        }}
      >
        <IconTrash />
        Move to trash
      </button>
    </div>,
    document.body,
  );
}
