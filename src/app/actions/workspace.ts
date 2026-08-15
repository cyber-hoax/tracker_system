"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { noteTypes, type NoteType } from "@/db/schema";
import { deleteNoteFromVault, writeNoteToVault } from "@/lib/obsidian";
import {
  createFolder,
  noteTypeForFolder,
  renameFolder,
} from "@/lib/workspace/folders";
import {
  moveFolderToParent,
  moveFolderTreeToTrash,
  moveNoteToFolder,
  moveNoteToTrash,
  permanentlyDeleteSnapshot,
  restoreTrashSnapshot,
} from "@/lib/workspace/snapshots";
import { createNote, noteHref, updateNote } from "@/lib/zettel";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateWorkspace() {
  revalidatePath("/");
  revalidatePath("/dsa");
  revalidatePath("/dsa/[slug]", "page");
  revalidatePath("/patterns");
  revalidatePath("/patterns/[slug]", "page");
  revalidatePath("/notes");
  revalidatePath("/notes/[slug]", "page");
  revalidatePath("/graph");
  revalidatePath("/search");
  revalidatePath("/settings");
}

export async function createFolderAction(formData: FormData) {
  const name = asString(formData, "name");
  const parentRaw = asString(formData, "parentId");
  const parentId = parentRaw || null;
  await createFolder({ name, parentId });
  revalidateWorkspace();
}

export async function renameFolderAction(formData: FormData) {
  const id = asString(formData, "id");
  const name = asString(formData, "name");
  await renameFolder(id, name);
  revalidateWorkspace();
}

export async function moveFolderAction(
  folderId: string,
  parentId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await moveFolderToParent(folderId, parentId);
    revalidateWorkspace();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not move folder",
    };
  }
}

export async function moveNoteAction(
  noteId: string,
  folderId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await moveNoteToFolder(noteId, folderId);
    revalidateWorkspace();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not move note",
    };
  }
}

export async function renameNoteAction(
  noteId: string,
  title: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await updateNote(noteId, { title });
    try {
      await writeNoteToVault(noteId);
    } catch (error) {
      console.error("Obsidian write-through failed", error);
    }
    revalidateWorkspace();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not rename note",
    };
  }
}

export async function deleteFolderAction(
  id: string,
  _recursive = true,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { filePaths } = await moveFolderTreeToTrash(id);
    for (const filePath of filePaths) {
      await deleteNoteFromVault(filePath);
    }
    revalidateWorkspace();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not move folder to trash",
    };
  }
}

export async function createWorkspaceNoteAction(formData: FormData) {
  const title = asString(formData, "title");
  const folderId = asString(formData, "folderId") || null;
  const typeRaw = asString(formData, "type");
  const type: NoteType = noteTypes.includes(typeRaw as NoteType)
    ? (typeRaw as NoteType)
    : await noteTypeForFolder(folderId);
  const note = await createNote({ type, title, folderId });
  try {
    await writeNoteToVault(note.id);
  } catch (error) {
    console.error("Obsidian write-through failed", error);
  }
  revalidateWorkspace();
  redirect(noteHref(note.type, note.slug));
}

export async function deleteNoteAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { filePath } = await moveNoteToTrash(id);
    await deleteNoteFromVault(filePath);
    revalidateWorkspace();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not move note to trash",
    };
  }
}

export async function restoreTrashSnapshotAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await restoreTrashSnapshot(id);
    revalidateWorkspace();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not restore snapshot",
    };
  }
}

export async function permanentlyDeleteSnapshotAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await permanentlyDeleteSnapshot(id);
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not delete snapshot",
    };
  }
}
