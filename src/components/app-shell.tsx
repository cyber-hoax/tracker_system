"use client";

import { AppSidebar } from "./app-sidebar";
import { isNoteRoute } from "@/lib/ui/note-route";
import type { FolderTreeNode } from "@/lib/workspace/tree";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AppShell({
  appName,
  tree,
  children,
}: {
  appName: string;
  tree: FolderTreeNode[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const notePage = isNoteRoute(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-ctp-crust text-ctp-text">
      <AppSidebar appName={appName} tree={tree} />
      {notePage ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:contents">
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
  );
}
