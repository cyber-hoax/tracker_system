import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  folders,
  noteProperties,
  notes,
  noteTypes,
  propertyDefs,
  trashSnapshots,
  type NoteType,
} from "@/db/schema";
import { writeNoteToVault } from "@/lib/obsidian";
import { relativeNotePath } from "@/lib/obsidian/paths";
import { uniqueSlug } from "@/lib/zettel/links";
import { deleteNote, setNoteProperties } from "@/lib/zettel/notes";
import { deleteFolder, listFolders, listNotesInFolderTree } from "./folders";
import { canNestFolder } from "./move";
import {
  collectSubtreeFolders,
  folderPathNamesFromRows,
  resolveRestoreFolderParent,
  resolveRestoreNoteFolder,
  snapshotIdsToPrune,
  snapshotLabel,
  type TrashNotePayload,
  type TrashSnapshotPayload,
} from "./trash";

export type TrashSnapshotListItem = {
  id: string;
  kind: "folder" | "note";
  label: string;
  deletedAt: string;
  folderCount: number;
  noteCount: number;
};

function asNoteType(value: string): NoteType {
  return noteTypes.includes(value as NoteType) ? (value as NoteType) : "note";
}

function parsePayload(raw: unknown): TrashSnapshotPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.kind === "note" && value.note && typeof value.note === "object") {
    const note = value.note as TrashNotePayload;
    if (typeof note.id !== "string" || typeof note.title !== "string") return null;
    return { kind: "note", note };
  }
  if (value.kind === "folder" && typeof value.rootId === "string") {
    const folderList = Array.isArray(value.folders) ? value.folders : [];
    const noteList = Array.isArray(value.notes) ? value.notes : [];
    return {
      kind: "folder",
      rootId: value.rootId,
      folders: folderList as TrashSnapshotPayload extends { kind: "folder" }
        ? TrashSnapshotPayload["folders"]
        : never,
      notes: noteList as TrashNotePayload[],
    };
  }
  return null;
}

async function propertiesByNoteIds(noteIds: string[]) {
  const map = new Map<
    string,
    { key: string; valueType: string; value: unknown }[]
  >();
  if (noteIds.length === 0) return map;
  const rows = await db
    .select({
      noteId: noteProperties.noteId,
      key: propertyDefs.key,
      valueType: propertyDefs.valueType,
      value: noteProperties.value,
    })
    .from(noteProperties)
    .innerJoin(propertyDefs, eq(noteProperties.defId, propertyDefs.id))
    .where(inArray(noteProperties.noteId, noteIds));
  for (const row of rows) {
    const list = map.get(row.noteId) ?? [];
    list.push({ key: row.key, valueType: row.valueType, value: row.value });
    map.set(row.noteId, list);
  }
  return map;
}

function toNotePayload(
  note: typeof notes.$inferSelect,
  folderRows: { id: string; parentId: string | null; name: string }[],
  properties: { key: string; valueType: string; value: unknown }[],
): TrashNotePayload {
  return {
    id: note.id,
    type: asNoteType(note.type),
    title: note.title,
    slug: note.slug,
    body: note.body,
    filePath: note.filePath,
    folderId: note.folderId,
    folderPath: folderPathNamesFromRows(folderRows, note.folderId),
    properties,
  };
}

async function insertSnapshot(
  kind: "folder" | "note",
  label: string,
  payload: TrashSnapshotPayload,
) {
  await db.insert(trashSnapshots).values({ kind, label, payload });
  const rows = await db
    .select({ id: trashSnapshots.id })
    .from(trashSnapshots)
    .orderBy(desc(trashSnapshots.deletedAt));
  const drop = snapshotIdsToPrune(rows.map((row) => row.id));
  if (drop.length > 0) {
    await db.delete(trashSnapshots).where(inArray(trashSnapshots.id, drop));
  }
}

export async function captureNoteSnapshot(noteId: string): Promise<void> {
  const [note] = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
  if (!note) throw new Error("Note not found");
  const [folderRows, props] = await Promise.all([
    listFolders(),
    propertiesByNoteIds([noteId]),
  ]);
  const payload: TrashSnapshotPayload = {
    kind: "note",
    note: toNotePayload(note, folderRows, props.get(noteId) ?? []),
  };
  await insertSnapshot("note", snapshotLabel(payload), payload);
}

export async function captureFolderSnapshot(folderId: string): Promise<void> {
  const folderRows = await listFolders();
  const subtree = collectSubtreeFolders(folderRows, folderId);
  if (!subtree[0]) throw new Error("Folder not found");
  const folderIds = subtree.map((folder) => folder.id);
  const noteRows = await db
    .select()
    .from(notes)
    .where(inArray(notes.folderId, folderIds));
  const props = await propertiesByNoteIds(noteRows.map((note) => note.id));
  const payload: TrashSnapshotPayload = {
    kind: "folder",
    rootId: folderId,
    folders: subtree,
    notes: noteRows.map((note) =>
      toNotePayload(note, folderRows, props.get(note.id) ?? []),
    ),
  };
  await insertSnapshot("folder", snapshotLabel(payload), payload);
}

export async function listTrashSnapshots(): Promise<TrashSnapshotListItem[]> {
  const rows = await db
    .select()
    .from(trashSnapshots)
    .orderBy(desc(trashSnapshots.deletedAt))
    .limit(10);
  return rows.map((row) => {
    const payload = parsePayload(row.payload);
    const kind = row.kind === "folder" ? "folder" : "note";
    return {
      id: row.id,
      kind,
      label: row.label,
      deletedAt: row.deletedAt.toISOString(),
      folderCount:
        payload?.kind === "folder" ? payload.folders.length : 0,
      noteCount:
        payload?.kind === "folder"
          ? payload.notes.length
          : payload?.kind === "note"
            ? 1
            : 0,
    };
  });
}

export async function permanentlyDeleteSnapshot(id: string): Promise<void> {
  await db.delete(trashSnapshots).where(eq(trashSnapshots.id, id));
}

async function filePathAvailable(
  filePath: string | null,
  executor: Pick<typeof db, "select">,
): Promise<string | null> {
  if (!filePath) return null;
  const [taken] = await executor
    .select({ id: notes.id })
    .from(notes)
    .where(eq(notes.filePath, filePath))
    .limit(1);
  return taken ? null : filePath;
}

async function restoreNoteRow(
  note: TrashNotePayload,
  folderId: string | null,
  executor: typeof db,
): Promise<string> {
  const [existing] = await executor
    .select({ id: notes.id })
    .from(notes)
    .where(eq(notes.id, note.id))
    .limit(1);
  if (existing) return existing.id;
  const type = asNoteType(note.type);
  const slug = await uniqueSlug(note.slug || "note", executor);
  const preferredPath = note.filePath || relativeNotePath(type, note.title);
  const filePath = await filePathAvailable(preferredPath, executor);
  const [created] = await executor
    .insert(notes)
    .values({
      id: note.id,
      type,
      title: note.title,
      slug,
      body: note.body ?? "",
      filePath,
      folderId,
    })
    .returning();
  return created.id;
}

async function restoreNoteProperties(
  noteId: string,
  properties: TrashNotePayload["properties"],
) {
  const values: Record<string, unknown> = {};
  for (const prop of properties) {
    values[prop.key] = prop.value;
  }
  if (Object.keys(values).length > 0) {
    await setNoteProperties(noteId, values);
  }
}

export async function restoreTrashSnapshot(id: string): Promise<void> {
  const [row] = await db
    .select()
    .from(trashSnapshots)
    .where(eq(trashSnapshots.id, id))
    .limit(1);
  if (!row) throw new Error("Snapshot not found");
  const payload = parsePayload(row.payload);
  if (!payload) throw new Error("Snapshot payload is invalid");

  const restoredNoteIds: string[] = [];

  if (payload.kind === "note") {
    const folderRows = await listFolders();
    const folderId = resolveRestoreNoteFolder(
      payload.note.folderId,
      payload.note.folderPath,
      folderRows,
    );
    const noteId = await restoreNoteRow(payload.note, folderId, db);
    await restoreNoteProperties(noteId, payload.note.properties);
    restoredNoteIds.push(noteId);
  } else {
    const existing = await listFolders();
    const existingIds = new Set(existing.map((folder) => folder.id));
    const rootParent = resolveRestoreFolderParent(
      payload.folders.find((folder) => folder.id === payload.rootId)?.parentId ??
        null,
      existingIds,
    );

    for (const folder of payload.folders) {
      if (existingIds.has(folder.id)) continue;
      const parentId =
        folder.id === payload.rootId ? rootParent : folder.parentId;
      await db.insert(folders).values({
        id: folder.id,
        name: folder.name,
        parentId,
        sortOrder: folder.sortOrder,
      });
      existingIds.add(folder.id);
    }

    const folderRows = await listFolders();
    for (const note of payload.notes) {
      const folderId = resolveRestoreNoteFolder(
        note.folderId,
        note.folderPath,
        folderRows,
      );
      const noteId = await restoreNoteRow(note, folderId, db);
      await restoreNoteProperties(noteId, note.properties);
      restoredNoteIds.push(noteId);
    }
  }

  await db.delete(trashSnapshots).where(eq(trashSnapshots.id, id));

  for (const noteId of restoredNoteIds) {
    try {
      await writeNoteToVault(noteId);
    } catch (error) {
      console.error("Obsidian write-through failed", error);
    }
  }
}

export async function moveFolderToParent(
  folderId: string,
  parentId: string | null,
) {
  const folderRows = await listFolders();
  if (!canNestFolder(folderRows, folderId, parentId)) {
    throw new Error("Cannot move a folder into itself");
  }
  if (parentId) {
    const [parent] = folderRows.filter((folder) => folder.id === parentId);
    if (!parent) throw new Error("Folder not found");
  }
  const siblings = folderRows.filter((folder) => folder.parentId === parentId);
  const sortOrder =
    siblings.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
  const [updated] = await db
    .update(folders)
    .set({ parentId, sortOrder })
    .where(eq(folders.id, folderId))
    .returning();
  if (!updated) throw new Error("Folder not found");
  return updated;
}

export async function moveNoteToFolder(noteId: string, folderId: string | null) {
  if (folderId) {
    const [folder] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(eq(folders.id, folderId))
      .limit(1);
    if (!folder) throw new Error("Folder not found");
  }
  const [updated] = await db
    .update(notes)
    .set({ folderId })
    .where(eq(notes.id, noteId))
    .returning();
  if (!updated) throw new Error("Note not found");
  return updated;
}

export async function moveFolderTreeToTrash(folderId: string): Promise<{
  filePaths: (string | null)[];
}> {
  await captureFolderSnapshot(folderId);
  const vaultNotes = await listNotesInFolderTree(folderId);
  await deleteFolder(folderId, true);
  return { filePaths: vaultNotes.map((note) => note.filePath) };
}

export async function moveNoteToTrash(noteId: string): Promise<{
  filePath: string | null;
}> {
  await captureNoteSnapshot(noteId);
  const note = await deleteNote(noteId);
  return { filePath: note.filePath };
}
