import { desc, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { notes } from "@/db/schema";
import type { ChatMentionHit, ChatMentionRef } from "@/lib/chat-mentions";
import { loadWorkspaceTree } from "@/lib/workspace/folders";
import { flattenFolderOptions } from "@/lib/workspace/move";
import type { FolderTreeNode } from "@/lib/workspace/tree";

const NOTE_LIMIT = 20;
const FOLDER_NOTE_LIMIT = 10;
const NOTE_CHARS = 6000;

function likePattern(query: string): string {
  return `%${query.replace(/[%_\\]/g, "\\$&")}%`;
}

export async function searchChatFiles(query: string): Promise<ChatMentionHit[]> {
  const trimmed = query.trim();
  const columns = {
    id: notes.id,
    title: notes.title,
    slug: notes.slug,
    type: notes.type,
    filePath: notes.filePath,
  };
  const rows = trimmed
    ? await db
        .select(columns)
        .from(notes)
        .where(
          or(
            ilike(notes.title, likePattern(trimmed)),
            ilike(notes.slug, likePattern(trimmed)),
            ilike(notes.filePath, likePattern(trimmed)),
          ),
        )
        .orderBy(desc(notes.updatedAt))
        .limit(NOTE_LIMIT)
    : await db
        .select(columns)
        .from(notes)
        .orderBy(desc(notes.updatedAt))
        .limit(NOTE_LIMIT);
  return rows.map((row) => ({
    kind: "file" as const,
    id: row.id,
    label: row.title,
    hint: row.filePath || `${row.type} · ${row.slug}`,
  }));
}

export async function searchChatFolders(query: string): Promise<ChatMentionHit[]> {
  const tree = await loadWorkspaceTree();
  const options = flattenFolderOptions(tree);
  const needle = query.trim().toLowerCase().replaceAll(" ", "");
  return options
    .map((option) => {
      const label = option.path.split(" / ").join("/");
      return {
        kind: "folder" as const,
        id: option.id,
        label,
        hint: option.path,
      };
    })
    .filter((item) => {
      if (!needle) return true;
      return (
        item.label.toLowerCase().replaceAll(" ", "").includes(needle) ||
        item.hint.toLowerCase().replaceAll(" ", "").includes(needle)
      );
    })
    .slice(0, NOTE_LIMIT);
}

function collectFolderNotes(
  node: FolderTreeNode,
  acc: { id: string; title: string }[],
): void {
  for (const note of node.notes) {
    if (acc.length >= FOLDER_NOTE_LIMIT) return;
    acc.push({ id: note.id, title: note.title });
  }
  for (const child of node.children) {
    if (acc.length >= FOLDER_NOTE_LIMIT) return;
    collectFolderNotes(child, acc);
  }
}

function findFolder(nodes: FolderTreeNode[], id: string): FolderTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findFolder(node.children, id);
    if (nested) return nested;
  }
  return null;
}

function clip(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= NOTE_CHARS) return trimmed;
  return `${trimmed.slice(0, NOTE_CHARS)}\n…`;
}

export async function expandChatMentions(
  refs: ChatMentionRef[],
): Promise<string> {
  if (refs.length === 0) return "";
  const tree = refs.some((ref) => ref.kind === "folder")
    ? await loadWorkspaceTree()
    : [];
  const noteIds = new Set<string>();
  const sections: string[] = [];

  for (const ref of refs) {
    if (ref.kind === "file") {
      noteIds.add(ref.id);
      continue;
    }
    const folder = findFolder(tree, ref.id);
    if (!folder) continue;
    const listed: { id: string; title: string }[] = [];
    collectFolderNotes(folder, listed);
    sections.push(
      `Folder /${ref.label} contains:\n${listed
        .map((note) => `- ${note.title}`)
        .join("\n") || "(empty)"}`,
    );
    for (const note of listed) noteIds.add(note.id);
  }

  if (noteIds.size > 0) {
    const rows = await db
      .select({
        id: notes.id,
        title: notes.title,
        body: notes.body,
        filePath: notes.filePath,
      })
      .from(notes)
      .where(inArray(notes.id, [...noteIds]));
    for (const row of rows) {
      sections.push(
        `Note @${row.title}${row.filePath ? ` (${row.filePath})` : ""}\n${clip(row.body) || "(empty)"}`,
      );
    }
  }

  if (sections.length === 0) return "";
  return `Attached workspace context:\n\n${sections.join("\n\n")}`;
}
