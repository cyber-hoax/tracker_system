"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createFolderAction,
  createWorkspaceNoteAction,
  deleteFolderAction,
  deleteNoteAction,
  moveFolderAction,
  moveNoteAction,
  renameFolderAction,
  renameNoteAction,
} from "@/app/actions/workspace";
import { updateAppNameAction } from "@/app/actions/appearance";
import {
  EllipsisIcon,
  WorkspaceItemMenu,
  type WorkspaceMenuState,
  type WorkspaceMenuTarget,
} from "@/components/workspace-item-menu";
import type { FolderTreeNode } from "@/lib/workspace/tree";
import { canNestFolder, flattenFolderOptions } from "@/lib/workspace/move";

const ROOT_LINKS = [
  { href: "/", label: "Today" },
  { href: "/reports", label: "Reports" },
  { href: "/graph", label: "Graph" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
] as const;

const TRASH_CONFIRM =
  "Move to trash? This can be restored from Settings snapshots.";

type Draft =
  | { kind: "file"; folderId: string }
  | { kind: "folder"; folderId: string | null }
  | { kind: "rename-folder"; folderId: string }
  | { kind: "rename-note"; noteId: string };

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function flattenFolderRows(
  tree: FolderTreeNode[],
): { id: string; parentId: string | null }[] {
  const rows: { id: string; parentId: string | null }[] = [];
  function walk(nodes: FolderTreeNode[]) {
    for (const node of nodes) {
      rows.push({ id: node.id, parentId: node.parentId });
      walk(node.children);
    }
  }
  walk(tree);
  return rows;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block w-3 text-[10px] text-ctp-overlay0 transition-transform ${
        open ? "rotate-90" : ""
      }`}
    >
      ▸
    </span>
  );
}

function InlineNameForm({
  initial,
  placeholder,
  onCancel,
  onSubmit,
}: {
  initial?: string;
  placeholder: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  return (
    <form
      className="px-1 py-0.5"
      onSubmit={(event) => {
        event.preventDefault();
        const name = value.trim();
        if (!name) return;
        onSubmit(name);
      }}
    >
      <input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          if (!value.trim()) onCancel();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        className="w-full rounded border border-ctp-mauve bg-ctp-base px-1.5 py-0.5 font-sans text-xs text-ctp-text outline-none"
      />
    </form>
  );
}

function MoreButton({
  open,
  selected,
  label,
  onClick,
}: {
  open: boolean;
  selected: boolean;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      className={`absolute right-0.5 top-1/2 z-[1] -translate-y-1/2 rounded-[4px] bg-ctp-surface0 p-[2px] text-ctp-overlay1 hover:bg-ctp-surface1 hover:text-ctp-text ${
        open || selected
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      }`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick(event);
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <EllipsisIcon />
    </button>
  );
}

function FolderItem({
  node,
  collapsed,
  pathname,
  draft,
  menu,
  onOpenMenu,
  onDraft,
}: {
  node: FolderTreeNode;
  collapsed: boolean;
  pathname: string;
  draft: Draft | null;
  menu: WorkspaceMenuState | null;
  onOpenMenu: (point: { x: number; y: number }, target: WorkspaceMenuTarget) => void;
  onDraft: (draft: Draft | null) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!draft) return;
    if (draft.kind === "file" && draft.folderId === node.id) setOpen(true);
    if (draft.kind === "folder" && draft.folderId === node.id) setOpen(true);
  }, [draft, node.id]);

  if (collapsed) return null;

  const target: WorkspaceMenuTarget = {
    kind: "folder",
    id: node.id,
    name: node.name,
    parentId: node.parentId,
  };
  const menuOpen = menu?.target.kind === "folder" && menu.target.id === node.id;

  return (
    <div>
      <div
        className="group relative flex items-center gap-0.5 rounded-md px-1 py-0.5 hover:bg-ctp-surface0"
        onContextMenu={(event) => {
          event.preventDefault();
          onOpenMenu({ x: event.clientX, y: event.clientY }, target);
        }}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-1 pr-6 text-left text-[13px] text-ctp-subtext0 hover:text-ctp-text"
        >
          <Chevron open={open} />
          <span className="truncate">{node.name}</span>
        </button>
        <MoreButton
          open={menuOpen}
          selected={false}
          label={`Actions for ${node.name}`}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onOpenMenu({ x: rect.right - 4, y: rect.bottom + 4 }, target);
          }}
        />
      </div>
      {draft?.kind === "rename-folder" && draft.folderId === node.id ? (
        <InlineNameForm
          initial={node.name}
          placeholder="Folder name"
          onCancel={() => onDraft(null)}
          onSubmit={(name) => {
            const data = new FormData();
            data.set("id", node.id);
            data.set("name", name);
            startTransition(async () => {
              await renameFolderAction(data);
              onDraft(null);
              router.refresh();
            });
          }}
        />
      ) : null}
      {open ? (
        <div className="ml-3 border-l border-ctp-surface0 pl-1.5">
          {draft?.kind === "folder" && draft.folderId === node.id ? (
            <InlineNameForm
              placeholder="New folder"
              onCancel={() => onDraft(null)}
              onSubmit={(name) => {
                const data = new FormData();
                data.set("name", name);
                data.set("parentId", node.id);
                startTransition(async () => {
                  await createFolderAction(data);
                  onDraft(null);
                  router.refresh();
                });
              }}
            />
          ) : null}
          {draft?.kind === "file" && draft.folderId === node.id ? (
            <InlineNameForm
              placeholder="New note"
              onCancel={() => onDraft(null)}
              onSubmit={(title) => {
                const data = new FormData();
                data.set("title", title);
                data.set("folderId", node.id);
                startTransition(async () => {
                  await createWorkspaceNoteAction(data);
                });
              }}
            />
          ) : null}
          {node.children.map((child) => (
            <FolderItem
              key={child.id}
              node={child}
              collapsed={collapsed}
              pathname={pathname}
              draft={draft}
              menu={menu}
              onOpenMenu={onOpenMenu}
              onDraft={onDraft}
            />
          ))}
          {node.notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              folderId={node.id}
              pathname={pathname}
              draft={draft}
              menu={menu}
              onOpenMenu={onOpenMenu}
              onDraft={onDraft}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NoteItem({
  note,
  folderId,
  pathname,
  draft,
  menu,
  onOpenMenu,
  onDraft,
}: {
  note: FolderTreeNode["notes"][number];
  folderId: string;
  pathname: string;
  draft: Draft | null;
  menu: WorkspaceMenuState | null;
  onOpenMenu: (point: { x: number; y: number }, target: WorkspaceMenuTarget) => void;
  onDraft: (draft: Draft | null) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const active = pathname === note.href;
  const target: WorkspaceMenuTarget = {
    kind: "note",
    id: note.id,
    title: note.title,
    folderId,
  };
  const menuOpen = menu?.target.kind === "note" && menu.target.id === note.id;

  if (draft?.kind === "rename-note" && draft.noteId === note.id) {
    return (
      <InlineNameForm
        initial={note.title}
        placeholder="Note title"
        onCancel={() => onDraft(null)}
        onSubmit={(title) => {
          startTransition(async () => {
            const result = await renameNoteAction(note.id, title);
            if (!result.ok) window.alert(result.error);
            onDraft(null);
            router.refresh();
          });
        }}
      />
    );
  }

  return (
    <div
      className="group relative flex items-center gap-0.5"
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenu({ x: event.clientX, y: event.clientY }, target);
      }}
    >
      <Link
        href={note.href}
        className={`flex min-w-0 flex-1 truncate rounded-md px-1.5 py-0.5 pr-6 text-[13px] ${
          active
            ? "bg-ctp-surface0 text-ctp-text"
            : "text-ctp-subtext0 hover:bg-ctp-surface0 hover:text-ctp-text"
        }`}
      >
        {note.title}
      </Link>
      <MoreButton
        open={menuOpen}
        selected={active}
        label={`Actions for ${note.title}`}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onOpenMenu({ x: rect.right - 4, y: rect.bottom + 4 }, target);
        }}
      />
    </div>
  );
}

export function AppSidebar({
  appName,
  tree,
}: {
  appName: string;
  tree: FolderTreeNode[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(appName);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [menu, setMenu] = useState<WorkspaceMenuState | null>(null);
  const [, startTransition] = useTransition();

  const folderRows = useMemo(() => flattenFolderRows(tree), [tree]);
  const folderOptions = useMemo(() => flattenFolderOptions(tree), [tree]);

  const moveTargets = useMemo(() => {
    if (!menu) return [];
    const target = menu.target;
    if (target.kind === "note") {
      return folderOptions.filter((option) => option.id !== target.folderId);
    }
    return [
      ...(target.parentId !== null ? [{ id: null, path: "Workspace" }] : []),
      ...folderOptions.filter(
        (option) =>
          option.id !== target.id &&
          option.id !== target.parentId &&
          canNestFolder(folderRows, target.id, option.id),
      ),
    ];
  }, [folderOptions, folderRows, menu]);

  useEffect(() => {
    setTitle(appName);
  }, [appName]);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("sidebar-collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function openMenu(point: { x: number; y: number }, target: WorkspaceMenuTarget) {
    setMenu({ x: point.x, y: point.y, target });
  }

  function parentFolderId(target: WorkspaceMenuTarget): string | null {
    if (target.kind === "folder") return target.id;
    return target.folderId;
  }

  async function trashTarget(target: WorkspaceMenuTarget) {
    if (!window.confirm(TRASH_CONFIRM)) return;
    const result =
      target.kind === "folder"
        ? await deleteFolderAction(target.id, true)
        : await deleteNoteAction(target.id);
    if (!result.ok) window.alert(result.error);
    else router.refresh();
  }

  return (
    <aside
      className={`flex h-full max-h-screen sticky top-0 shrink-0 flex-col overflow-hidden border-r border-ctp-surface0 bg-ctp-mantle ${
        collapsed ? "w-[52px]" : "w-[248px]"
      }`}
    >
      <div className="flex items-center gap-1 border-b border-ctp-surface0 px-2 py-2">
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="mx-auto font-mono text-xs text-ctp-overlay0 hover:text-ctp-text"
            aria-label="Expand sidebar"
          >
            »
          </button>
        ) : editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              const next = title.trim() || appName;
              setTitle(next);
              if (next !== appName) void updateAppNameAction(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") (event.target as HTMLInputElement).blur();
              if (event.key === "Escape") {
                setTitle(appName);
                setEditingTitle(false);
              }
            }}
            className="min-w-0 flex-1 rounded border border-ctp-mauve bg-ctp-base px-1.5 py-1 text-sm text-ctp-text outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className="min-w-0 flex-1 truncate px-1 text-left text-sm font-medium text-ctp-text hover:text-ctp-mauve"
            title="Rename app"
          >
            {appName}
          </button>
        )}
        {collapsed ? null : (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="px-1 font-mono text-xs text-ctp-overlay0 hover:text-ctp-text"
            aria-label="Collapse sidebar"
          >
            «
          </button>
        )}
      </div>

      <nav aria-label="Primary" className="space-y-0.5 px-2 py-3">
        {ROOT_LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className={`flex items-center rounded-md px-2 py-1 text-[13px] ${
                active
                  ? "bg-ctp-surface0 text-ctp-text"
                  : "text-ctp-subtext0 hover:bg-ctp-surface0/80 hover:text-ctp-text"
              }`}
            >
              {collapsed ? link.label.slice(0, 1) : link.label}
            </Link>
          );
        })}
      </nav>

      {collapsed ? null : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ctp-overlay0">
              Workspace
            </p>
            <button
              type="button"
              className="font-mono text-[10px] text-ctp-overlay0 hover:text-ctp-text"
              onClick={() => setDraft({ kind: "folder", folderId: null })}
            >
              + folder
            </button>
          </div>
          {draft?.kind === "folder" && draft.folderId === null ? (
            <InlineNameForm
              placeholder="New folder"
              onCancel={() => setDraft(null)}
              onSubmit={(name) => {
                const data = new FormData();
                data.set("name", name);
                startTransition(async () => {
                  await createFolderAction(data);
                  setDraft(null);
                  router.refresh();
                });
              }}
            />
          ) : null}
          {tree.map((node) => (
            <FolderItem
              key={node.id}
              node={node}
              collapsed={collapsed}
              pathname={pathname}
              draft={draft}
              menu={menu}
              onOpenMenu={openMenu}
              onDraft={setDraft}
            />
          ))}
        </div>
      )}

      <WorkspaceItemMenu
        menu={menu}
        moveTargets={moveTargets}
        onClose={() => setMenu(null)}
        onNewFile={(target) => {
          const folderId = parentFolderId(target);
          if (folderId) setDraft({ kind: "file", folderId });
        }}
        onNewFolder={(target) => {
          const folderId = parentFolderId(target);
          setDraft({ kind: "folder", folderId });
        }}
        onRename={(target) => {
          if (target.kind === "folder") {
            setDraft({ kind: "rename-folder", folderId: target.id });
          } else {
            setDraft({ kind: "rename-note", noteId: target.id });
          }
        }}
        onMove={(target, folderId) => {
          startTransition(async () => {
            const result =
              target.kind === "folder"
                ? await moveFolderAction(target.id, folderId)
                : await moveNoteAction(target.id, folderId);
            if (!result.ok) window.alert(result.error);
            else router.refresh();
          });
        }}
        onTrash={(target) => {
          void trashTarget(target);
        }}
      />
    </aside>
  );
}
