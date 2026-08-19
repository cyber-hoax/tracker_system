"use client";

import { AppSidebar } from "./app-sidebar";
import { NoteListPane } from "./note-list-pane";
import type { ColorTheme } from "@/lib/appearance";
import { isNoteRoute } from "@/lib/ui/note-route";
import {
  findFolderById,
  folderForPathname,
  shouldShowNoteList,
} from "@/lib/ui/notebook";
import type { FolderTreeNode } from "@/lib/workspace/tree";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

export function AppShell({
  tree,
  colorTheme,
  children,
}: {
  tree: FolderTreeNode[];
  colorTheme: ColorTheme;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const notePage = isNoteRoute(pathname);
  const chatPage = pathname === "/chat";
  const graphPage = pathname === "/graph";
  const [pickedFolderId, setPickedFolderId] = useState<string | null>(null);
  const [listReveal, setListReveal] = useState(0);

  const selectedFolder = useMemo(() => {
    const picked = pickedFolderId
      ? findFolderById(tree, pickedFolderId)
      : null;
    return picked ?? folderForPathname(tree, pathname);
  }, [pickedFolderId, tree, pathname]);

  const showList = shouldShowNoteList(pathname, {
    notebookOpen: pickedFolderId !== null,
  });

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden text-ctp-text">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar
          tree={tree}
          selectedFolderId={selectedFolder?.id ?? null}
          onSelectFolder={(id) => {
            setPickedFolderId(id);
            setListReveal((value) => value + 1);
          }}
          onLeaveNotebooks={() => setPickedFolderId(null)}
        />
        {showList ? (
          <NoteListPane
            folder={selectedFolder}
            tree={tree}
            pathname={pathname}
            colorTheme={colorTheme}
            reveal={listReveal}
          />
        ) : null}
        {chatPage || graphPage ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        ) : notePage ? (
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            {children}
          </div>
        ) : (
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1080px] px-5 pb-16 pt-6 has-[[data-reports]]:max-w-[1400px]">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
