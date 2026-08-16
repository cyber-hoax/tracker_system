"use client";

import {
  ArrowRight,
  CaretRight,
  DotsThree,
  File,
  FolderSimple,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { ChromeIcon } from "@/components/chrome-icon";
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

export function EllipsisIcon() {
  return <ChromeIcon icon={DotsThree} />;
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
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ctp-text hover:bg-ctp-surface0";

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
        <ChromeIcon icon={File} className="text-ctp-overlay1" />
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
        <ChromeIcon icon={FolderSimple} className="text-ctp-overlay1" />
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
        <ChromeIcon icon={PencilSimple} className="text-ctp-overlay1" />
        Rename
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => setMoveOpen((value) => !value)}
      >
        <ChromeIcon icon={ArrowRight} className="text-ctp-overlay1" />
        <span className="flex-1">Move to</span>
        <ChromeIcon
          icon={CaretRight}
          size={16}
          className={`text-ctp-overlay1 transition-transform ${moveOpen ? "rotate-90" : ""}`}
        />
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
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ctp-red hover:bg-ctp-surface0"
        onClick={() => {
          onTrash(menu.target);
          onClose();
        }}
      >
        <ChromeIcon icon={Trash} />
        Move to trash
      </button>
    </div>,
    document.body,
  );
}
