"use client";

import { MagnifyingGlass, SidebarSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createFolderAction,
  createWorkspaceNoteAction,
  deleteNoteAction,
  moveNoteAction,
  renameNoteAction,
} from "@/app/actions/workspace";
import { ChromeIcon } from "@/components/chrome-icon";
import {
  EllipsisIcon,
  WorkspaceItemMenu,
  type WorkspaceMenuState,
  type WorkspaceMenuTarget,
} from "@/components/workspace-item-menu";
import { isInkdropDesk, type ColorTheme } from "@/lib/appearance";
import type { FolderTreeNode, FolderTreeNote } from "@/lib/workspace/tree";
import { flattenFolderOptions } from "@/lib/workspace/move";
import {
  collectFolderNotes,
  formatNoteListTime,
  sortFolderNotes,
} from "@/lib/ui/notebook";
import { tagChipStyle } from "@/lib/ui/tag-color";

const TYPE_LABEL: Record<string, string> = {
  problem: "DSA",
  pattern: "Pattern",
  lld: "LLD",
  hld: "HLD",
  ai: "AI",
  note: "Note",
};

const COLLAPSED_WIDTH = 52;
const DEFAULT_WIDTH = 280;
const COLLAPSED_KEY = "note-list-collapsed";
const TRASH_CONFIRM =
  "Move to trash? This can be restored from Settings snapshots.";

function afterTrashHref(note: FolderTreeNote): string {
  if (note.type === "problem") return "/dsa";
  if (note.type === "pattern") return "/patterns";
  return "/";
}

export function NoteListPane({
  folder,
  tree,
  pathname,
  colorTheme,
  reveal = 0,
}: {
  folder: FolderTreeNode | null;
  tree: FolderTreeNode[];
  pathname: string;
  colorTheme: ColorTheme;
  reveal?: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [peek, setPeek] = useState(false);
  const [menu, setMenu] = useState<WorkspaceMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (reveal === 0) return;
    setCollapsed(false);
    setPeek(false);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, "0");
    } catch {
      /* ignore */
    }
  }, [reveal]);

  const notes = useMemo(() => {
    if (!folder) return [];
    const all = sortFolderNotes(collectFolderNotes(folder), colorTheme);
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((note) => note.title.toLowerCase().includes(needle));
  }, [folder, query, colorTheme]);

  const moveTargets = useMemo(() => {
    if (!menu || menu.target.kind !== "note") return [];
    const currentFolderId = menu.target.folderId;
    return flattenFolderOptions(tree).filter(
      (option) => option.id !== currentFolderId,
    );
  }, [menu, tree]);

  function toggleCollapsed() {
    setPeek(false);
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function openMenu(
    point: { x: number; y: number },
    target: WorkspaceMenuTarget,
  ) {
    setMenu({ x: point.x, y: point.y, target });
  }

  const wide = !collapsed || peek;
  const railWidth = collapsed ? COLLAPSED_WIDTH : DEFAULT_WIDTH;
  const panelWidth = wide ? DEFAULT_WIDTH : COLLAPSED_WIDTH;

  return (
    <div
      className="relative h-full min-h-0 shrink-0 transition-[width] duration-200 ease-out"
      style={{ width: railWidth }}
    >
      <section
        aria-label="Notes"
        onMouseEnter={() => {
          if (collapsed) setPeek(true);
        }}
        onMouseLeave={() => {
          if (!menu) setPeek(false);
        }}
        className={`flex h-full min-h-0 flex-col overflow-hidden border-r border-ctp-surface0 bg-ctp-base transition-[width,box-shadow] duration-200 ease-out ${
          collapsed && peek
            ? "absolute inset-y-0 left-0 z-30 shadow-2xl"
            : "sticky top-0"
        }`}
        style={{ width: panelWidth }}
      >
        <div
          className={`shrink-0 border-b border-ctp-surface0 ${
            wide ? "px-3 py-2" : "flex justify-center px-1 py-2"
          }`}
        >
          {wide ? (
            <>
              <p className="truncate text-sm text-ctp-text">
                {folder?.name ?? "Notebooks"}
              </p>
              <p className="font-mono text-[13px] text-ctp-overlay0">
                {notes.length} {notes.length === 1 ? "note" : "notes"}
              </p>
              <label className="mt-2 flex items-center gap-2 rounded-lg border border-ctp-surface0 bg-ctp-mantle px-2 py-1.5">
                <MagnifyingGlass
                  size={14}
                  weight="bold"
                  className="shrink-0 text-ctp-overlay0"
                  aria-hidden="true"
                />
                <span className="sr-only">
                  {isInkdropDesk(colorTheme) ? "Search notes" : "Filter notes"}
                </span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={isInkdropDesk(colorTheme) ? "Search" : "Filter"}
                  className="min-w-0 flex-1 bg-transparent text-sm text-ctp-text outline-none placeholder:text-ctp-overlay0"
                />
              </label>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex h-8 w-8 items-center justify-center rounded-md text-ctp-overlay1 hover:bg-ctp-surface0 hover:text-ctp-text"
              aria-label="Expand notes"
            >
              <ChromeIcon icon={SidebarSimple} />
            </button>
          )}
        </div>
        {wide ? (
          <ul className="min-h-0 flex-1 overflow-y-auto py-1">
            {notes.length === 0 ? (
              <li className="px-3 py-4 text-sm text-ctp-overlay0">
                {folder
                  ? "No notes in this notebook."
                  : "Select a notebook in the sidebar."}
              </li>
            ) : (
              notes.map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  pathname={pathname}
                  now={now}
                  menuOpen={
                    menu?.target.kind === "note" && menu.target.id === note.id
                  }
                  renaming={renamingId === note.id}
                  onOpenMenu={openMenu}
                  onRename={(title) => {
                    startTransition(async () => {
                      const result = await renameNoteAction(note.id, title);
                      if (!result.ok) window.alert(result.error);
                      setRenamingId(null);
                      router.refresh();
                    });
                  }}
                  onCancelRename={() => setRenamingId(null)}
                />
              ))
            )}
          </ul>
        ) : null}
        {wide ? (
          <div className="shrink-0 border-t border-ctp-surface0 p-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex h-8 w-8 items-center justify-center rounded-md text-ctp-overlay1 hover:bg-ctp-surface0 hover:text-ctp-text"
              aria-label="Collapse notes"
              title="Collapse notes"
            >
              <ChromeIcon icon={SidebarSimple} />
            </button>
          </div>
        ) : null}
      </section>
      <WorkspaceItemMenu
        menu={menu}
        moveTargets={moveTargets}
        onClose={() => setMenu(null)}
        onNewFile={(target) => {
          const folderId =
            target.kind === "note" ? target.folderId : target.id;
          const data = new FormData();
          data.set("title", "Untitled");
          if (folderId) data.set("folderId", folderId);
          startTransition(async () => {
            await createWorkspaceNoteAction(data);
          });
        }}
        onNewFolder={(target) => {
          const parentId =
            target.kind === "note" ? target.folderId : target.id;
          const name = window.prompt("New folder");
          if (!name?.trim()) return;
          const data = new FormData();
          data.set("name", name.trim());
          if (parentId) data.set("parentId", parentId);
          startTransition(async () => {
            await createFolderAction(data);
            router.refresh();
          });
        }}
        onRename={(target) => {
          if (target.kind === "note") setRenamingId(target.id);
        }}
        onMove={(target, folderId) => {
          if (target.kind !== "note") return;
          startTransition(async () => {
            const result = await moveNoteAction(target.id, folderId);
            if (!result.ok) window.alert(result.error);
            else router.refresh();
          });
        }}
        onTrash={(target) => {
          if (target.kind !== "note") return;
          if (!window.confirm(TRASH_CONFIRM)) return;
          const note = notes.find((item) => item.id === target.id);
          startTransition(async () => {
            const result = await deleteNoteAction(target.id);
            if (!result.ok) {
              window.alert(result.error);
              return;
            }
            if (note && pathname === note.href) {
              router.replace(afterTrashHref(note));
            } else {
              router.refresh();
            }
          });
        }}
      />
    </div>
  );
}

function NoteListItem({
  note,
  pathname,
  now,
  menuOpen,
  renaming,
  onOpenMenu,
  onRename,
  onCancelRename,
}: {
  note: FolderTreeNote;
  pathname: string;
  now: Date | null;
  menuOpen: boolean;
  renaming: boolean;
  onOpenMenu: (
    point: { x: number; y: number },
    target: WorkspaceMenuTarget,
  ) => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const active = pathname === note.href;
  const target: WorkspaceMenuTarget = {
    kind: "note",
    id: note.id,
    title: note.title,
    folderId: note.folderId,
  };

  useEffect(() => {
    setTitle(note.title);
  }, [note.title]);

  if (renaming) {
    return (
      <li className="note-list-item px-3 py-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const next = title.trim();
            if (!next) return;
            onRename(next);
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              if (!title.trim()) onCancelRename();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancelRename();
            }}
            className="w-full rounded border border-ctp-mauve bg-ctp-mantle px-2 py-1 text-sm text-ctp-text outline-none"
          />
        </form>
      </li>
    );
  }

  return (
    <li
      className="note-list-item group relative"
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenu({ x: event.clientX, y: event.clientY }, target);
      }}
    >
      <Link
        href={note.href}
        aria-current={active ? "page" : undefined}
        className={`note-list-row block px-3 py-2.5 pr-10 ${
          active
            ? "bg-ctp-surface0 text-ctp-text"
            : "text-ctp-subtext0 hover:bg-ctp-surface0/70 hover:text-ctp-text"
        }`}
      >
        <span className="block truncate text-sm">{note.title}</span>
        <span className="note-list-type mt-0.5 block font-mono text-[13px] text-ctp-overlay0">
          {TYPE_LABEL[note.type] ?? note.type}
        </span>
        <span className="note-list-meta mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ctp-overlay0">
          {now ? (
            <span className="note-list-time">
              {formatNoteListTime(note.updatedAt, now)}
            </span>
          ) : null}
          <span
            className="note-list-pill inline-flex items-center gap-1.5"
            data-note-type={note.type}
          >
            <span
              className="note-list-pill-dot h-1.5 w-1.5 rounded-full"
              aria-hidden="true"
            />
            {TYPE_LABEL[note.type] ?? note.type}
          </span>
          {note.type === "problem" && note.patterns.length > 0
            ? note.patterns.slice(0, 3).map((pattern) => (
                <span
                  key={pattern}
                  className="note-list-tag"
                  style={tagChipStyle(pattern)}
                >
                  {pattern}
                </span>
              ))
            : null}
        </span>
        {note.excerpt ? (
          <span className="note-list-excerpt mt-1 block truncate text-[12px] text-ctp-subtext0">
            {note.excerpt}
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        aria-label={`Actions for ${note.title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={`absolute right-1.5 top-2 z-[1] flex h-7 w-7 items-center justify-center rounded-md bg-ctp-surface0 text-ctp-overlay1 hover:bg-ctp-surface1 hover:text-ctp-text ${
          menuOpen || active
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        }`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          onOpenMenu({ x: rect.right - 4, y: rect.bottom + 4 }, target);
        }}
      >
        <EllipsisIcon />
      </button>
    </li>
  );
}
