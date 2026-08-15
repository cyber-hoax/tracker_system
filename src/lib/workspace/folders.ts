import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { folders, notes, type NoteType } from "@/db/schema";
import {
  inferNoteType,
  assembleFolderTree,
  planDesignFolderPromotion,
  SEED_ROOT_FOLDERS,
  type FolderTreeNode,
} from "./tree";

export async function listFolders() {
  return db.select().from(folders).orderBy(asc(folders.sortOrder), asc(folders.name));
}

export async function loadWorkspaceTree(): Promise<FolderTreeNode[]> {
  await ensureSeedFolders();
  const [folderRows, noteRows] = await Promise.all([
    listFolders(),
    db
      .select({
        id: notes.id,
        title: notes.title,
        slug: notes.slug,
        type: notes.type,
        folderId: notes.folderId,
      })
      .from(notes)
      .orderBy(asc(notes.title)),
  ]);
  return assembleFolderTree(folderRows, noteRows);
}

export async function folderPathNames(folderId: string): Promise<string[]> {
  const names: string[] = [];
  let current: string | null = folderId;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    const [row] = await db
      .select()
      .from(folders)
      .where(eq(folders.id, current))
      .limit(1);
    if (!row) break;
    names.unshift(row.name);
    current = row.parentId;
  }
  return names;
}

export async function noteTypeForFolder(folderId: string | null): Promise<NoteType> {
  if (!folderId) return "note";
  return inferNoteType(await folderPathNames(folderId));
}

async function findRootFolder(name: string) {
  const [row] = await db
    .select()
    .from(folders)
    .where(and(isNull(folders.parentId), eq(folders.name, name)))
    .limit(1);
  return row ?? null;
}

export async function defaultFolderIdForType(
  type: NoteType,
): Promise<string | null> {
  await ensureSeedFolders();
  if (type === "pattern") return (await findRootFolder("Pattern"))?.id ?? null;
  if (type === "problem") return (await findRootFolder("DSA"))?.id ?? null;
  if (type === "lld") return (await findRootFolder("LLD"))?.id ?? null;
  if (type === "hld") return (await findRootFolder("HLD"))?.id ?? null;
  if (type === "ai") return (await findRootFolder("AI"))?.id ?? null;
  return null;
}

export async function ensureSeedFolders(): Promise<void> {
  const existing = await db.select({ id: folders.id }).from(folders).limit(1);
  if (!existing[0]) {
    for (const root of SEED_ROOT_FOLDERS) {
      await db.insert(folders).values({
        name: root.name,
        parentId: null,
        sortOrder: root.sortOrder,
      });
    }
    await assignNotesToSeedFolders();
  }
  await promoteNestedDesignFolders();
}

async function promoteNestedDesignFolders(): Promise<void> {
  const rows = await listFolders();
  const plan = planDesignFolderPromotion(rows);
  for (const step of plan) {
    if (step.kind === "promote") {
      await db
        .update(folders)
        .set({ parentId: null, sortOrder: step.sortOrder })
        .where(eq(folders.id, step.id));
      continue;
    }
    await db
      .update(notes)
      .set({ folderId: step.intoId })
      .where(eq(notes.folderId, step.fromId));
    await db
      .update(folders)
      .set({ parentId: step.intoId })
      .where(eq(folders.parentId, step.fromId));
    await db.delete(folders).where(eq(folders.id, step.fromId));
  }
}

async function assignNotesToSeedFolders(): Promise<void> {
  const types: NoteType[] = ["problem", "pattern", "lld", "hld", "ai", "note"];
  for (const type of types) {
    const folderId = await defaultFolderIdForType(type);
    if (!folderId) continue;
    await db
      .update(notes)
      .set({ folderId })
      .where(and(eq(notes.type, type), isNull(notes.folderId)));
  }
}

export async function createFolder(input: {
  name: string;
  parentId: string | null;
}): Promise<typeof folders.$inferSelect> {
  const name = input.name.trim();
  if (!name) throw new Error("Folder name is required");
  const siblings = await db
    .select({ sortOrder: folders.sortOrder })
    .from(folders)
    .where(
      input.parentId
        ? eq(folders.parentId, input.parentId)
        : isNull(folders.parentId),
    );
  const sortOrder =
    siblings.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
  const [created] = await db
    .insert(folders)
    .values({ name, parentId: input.parentId, sortOrder })
    .returning();
  return created;
}

export async function renameFolder(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required");
  const [updated] = await db
    .update(folders)
    .set({ name: trimmed })
    .where(eq(folders.id, id))
    .returning();
  if (!updated) throw new Error("Folder not found");
  return updated;
}

export async function folderIsEmpty(id: string): Promise<boolean> {
  const [child] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(eq(folders.parentId, id))
    .limit(1);
  if (child) return false;
  const [note] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(eq(notes.folderId, id))
    .limit(1);
  return !note;
}

export async function listNotesInFolderTree(
  folderId: string,
): Promise<{ id: string; filePath: string | null }[]> {
  const childFolders = await db
    .select({ id: folders.id })
    .from(folders)
    .where(eq(folders.parentId, folderId));
  const own = await db
    .select({ id: notes.id, filePath: notes.filePath })
    .from(notes)
    .where(eq(notes.folderId, folderId));
  const nested = await Promise.all(
    childFolders.map((child) => listNotesInFolderTree(child.id)),
  );
  return [...own, ...nested.flat()];
}

export async function deleteFolder(id: string, recursive: boolean) {
  if (!recursive) {
    const empty = await folderIsEmpty(id);
    if (!empty) {
      throw new Error("Folder is not empty");
    }
  }
  const [deleted] = await db.delete(folders).where(eq(folders.id, id)).returning();
  if (!deleted) throw new Error("Folder not found");
}
