"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent,
} from "react";
import {
  ChatCircle,
  CalendarBlank,
  CaretRight,
  ChartBar,
  FileText,
  FolderSimple,
  Gear,
  Graph,
  MagnifyingGlass,
  NotePencil,
  Plus,
  Repeat,
  SidebarSimple,
} from "@phosphor-icons/react";
import { ChromeIcon, CHROME_ICON_SIZE } from "@/components/chrome-icon";
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
  { href: "/", label: "Today", Icon: CalendarBlank },
  { href: "/chat", label: "Chat", Icon: ChatCircle },
  { href: "/routine", label: "Routine", Icon: Repeat },
  { href: "/reports", label: "Reports", Icon: ChartBar },
  { href: "/graph", label: "Graph", Icon: Graph },
  { href: "/search", label: "Search", Icon: MagnifyingGlass },
  { href: "/settings", label: "Settings", Icon: Gear },
] as const;

const COLLAPSED_WIDTH = 56;
const DEFAULT_WIDTH = 248;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const SNAP_COLLAPSE = 148;
const WIDTH_KEY = "sidebar-width";
const COLLAPSED_KEY = "sidebar-collapsed";

function clampSidebarWidth(value: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)));
}

function readStoredWidth(): number {
  try {
    const raw = window.localStorage.getItem(WIDTH_KEY);
    const parsed = raw ? Number(raw) : DEFAULT_WIDTH;
    if (!Number.isFinite(parsed)) return DEFAULT_WIDTH;
    return clampSidebarWidth(parsed);
  } catch {
    return DEFAULT_WIDTH;
  }
}

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

function defaultNewFolderId(
  tree: FolderTreeNode[],
  pathname: string,
): string | null {
  function walk(nodes: FolderTreeNode[]): string | null {
    for (const node of nodes) {
      if (node.notes.some((note) => note.href === pathname)) return node.id;
      const nested = walk(node.children);
      if (nested) return nested;
    }
    return null;
  }
  return (
    walk(tree) ??
    tree.find((node) => node.name === "DSA")?.id ??
    tree[0]?.id ??
    null
  );
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
    <ChromeIcon
      icon={CaretRight}
      size={16}
      className={`text-ctp-overlay1 transition-transform ${open ? "rotate-90" : ""}`}
    />
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
      className={`absolute right-0.5 top-1/2 z-[1] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-ctp-surface0 text-ctp-overlay1 hover:bg-ctp-surface1 hover:text-ctp-text ${
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
          className="flex min-w-0 flex-1 items-center gap-1.5 pr-6 text-left text-[13px] text-ctp-subtext0 hover:text-ctp-text"
        >
          <Chevron open={open} />
          <ChromeIcon icon={FolderSimple} size={18} className="text-ctp-overlay1" />
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
        className={`flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 pr-6 text-[13px] ${
          active
            ? "bg-ctp-surface0 text-ctp-text"
            : "text-ctp-subtext0 hover:bg-ctp-surface0 hover:text-ctp-text"
        }`}
      >
        <ChromeIcon icon={FileText} size={18} className="text-ctp-overlay1" />
        <span className="min-w-0 truncate">{note.title}</span>
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
  const [peek, setPeek] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(width);
  const collapsedRef = useRef(collapsed);
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
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  useEffect(() => {
    setWidth(readStoredWidth());
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function persistLayout(nextWidth: number, nextCollapsed: boolean) {
    try {
      window.localStorage.setItem(WIDTH_KEY, String(nextWidth));
      window.localStorage.setItem(COLLAPSED_KEY, nextCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function toggleCollapsed() {
    setPeek(false);
    setCollapsed((value) => {
      const next = !value;
      persistLayout(widthRef.current, next);
      return next;
    });
  }

  function applyResize(next: number) {
    if (next < SNAP_COLLAPSE) {
      collapsedRef.current = true;
      setCollapsed(true);
      setPeek(false);
      return;
    }
    const clamped = clampSidebarWidth(next);
    collapsedRef.current = false;
    widthRef.current = clamped;
    setCollapsed(false);
    setWidth(clamped);
  }

  function onResizePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const originX = event.clientX;
    const originWidth = collapsed ? COLLAPSED_WIDTH : width;
    setDragging(true);
    setPeek(false);
    handle.setPointerCapture(event.pointerId);
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onPointerMove(move: globalThis.PointerEvent) {
      applyResize(originWidth + move.clientX - originX);
    }

    function onPointerUp() {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", onPointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      setDragging(false);
      persistLayout(widthRef.current, collapsedRef.current);
    }

    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerUp);
  }

  const wide = !collapsed || peek;

  function createNewFile() {
    const folderId = defaultNewFolderId(tree, pathname);
    const data = new FormData();
    data.set("title", "Untitled");
    if (folderId) data.set("folderId", folderId);
    startTransition(async () => {
      await createWorkspaceNoteAction(data);
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

  const railWidth = collapsed ? COLLAPSED_WIDTH : width;
  const panelWidth = wide ? width : COLLAPSED_WIDTH;

  return (
    <div
      className={`relative h-full max-h-screen shrink-0 ${
        dragging ? "" : "transition-[width] duration-200 ease-out"
      }`}
      style={{ width: railWidth }}
    >
      <aside
        onMouseEnter={() => {
          if (collapsed && !dragging) setPeek(true);
        }}
        onMouseLeave={() => {
          if (!menu && !dragging) setPeek(false);
        }}
        className={`flex h-full max-h-screen flex-col overflow-hidden border-r border-ctp-surface0 bg-ctp-mantle ${
          dragging ? "" : "transition-[width,box-shadow] duration-200 ease-out"
        } ${collapsed && peek ? "absolute inset-y-0 left-0 z-40 shadow-2xl" : "sticky top-0"}`}
        style={{ width: panelWidth }}
      >
        <div className="flex h-11 shrink-0 items-center gap-1 px-1.5">
          {wide ? (
            editingTitle ? (
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
                  if (event.key === "Enter")
                    (event.target as HTMLInputElement).blur();
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
            )
          ) : (
            <span className="flex-1" />
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ctp-overlay1 hover:bg-ctp-surface0 hover:text-ctp-text"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChromeIcon icon={SidebarSimple} />
          </button>
        </div>

        <nav aria-label="Primary" className="shrink-0 space-y-0.5 px-2 py-2">
          {ROOT_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                className={`flex items-center rounded-md text-[13px] ${
                  wide ? "gap-2 px-2 py-1.5" : "justify-center px-0 py-2"
                } ${
                  active
                    ? "bg-ctp-surface0 text-ctp-text"
                    : "text-ctp-subtext0 hover:bg-ctp-surface0/80 hover:text-ctp-text"
                }`}
              >
                <link.Icon
                  size={CHROME_ICON_SIZE}
                  weight={active ? "fill" : "bold"}
                  className="shrink-0"
                />
                {wide ? link.label : null}
              </Link>
            );
          })}
        </nav>

        {wide ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            <div className="mb-1 flex items-center justify-between px-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ctp-overlay0">
                Workspace
              </p>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-ctp-overlay1 hover:bg-ctp-surface0 hover:text-ctp-text"
                aria-label="New folder"
                onClick={() => setDraft({ kind: "folder", folderId: null })}
              >
                <ChromeIcon icon={Plus} />
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
                collapsed={!wide}
                pathname={pathname}
                draft={draft}
                menu={menu}
                onOpenMenu={openMenu}
                onDraft={setDraft}
              />
            ))}
          </div>
        ) : (
          <div className="min-h-0 flex-1" />
        )}

        <div className="shrink-0 border-t border-ctp-surface0 p-2">
          <button
            type="button"
            onClick={createNewFile}
            className={`flex items-center rounded-full bg-ctp-surface0 text-sm text-ctp-text hover:bg-ctp-surface1 ${
              wide
                ? "w-full justify-center gap-2 px-3 py-2"
                : "mx-auto h-10 w-10 justify-center"
            }`}
            aria-label="New file"
            title="New file"
          >
            <ChromeIcon icon={NotePencil} />
            {wide ? "New" : null}
          </button>
        </div>

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
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize"
          onPointerDown={onResizePointerDown}
          onDoubleClick={() => {
            setCollapsed(false);
            setWidth(DEFAULT_WIDTH);
            persistLayout(DEFAULT_WIDTH, false);
          }}
          className="group absolute inset-y-0 right-0 z-20 flex w-2 cursor-col-resize touch-none justify-end"
        >
          <span
            className={`h-full w-px ${
              dragging ? "bg-ctp-mauve" : "bg-transparent group-hover:bg-ctp-mauve/70"
            }`}
          />
        </div>
      </aside>
    </div>
  );
}
