"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { propertyValueTypes, type PropertyValueType } from "@/db/schema";
import { writeNoteToVault } from "@/lib/obsidian";
import {
  createNote,
  createPropertyDef,
  deletePropertyDef,
  noteHref,
  removeNoteProperty,
  setNoteProperty,
  updateNote,
  updatePropertyDefOptions,
} from "@/lib/zettel";
import type { PropertyJson } from "@/lib/zettel/values";

async function persistVault(noteId: string) {
  try {
    await writeNoteToVault(noteId);
  } catch (error) {
    console.error("Obsidian write-through failed", error);
    throw error instanceof Error
      ? error
      : new Error("Could not write Obsidian markdown");
  }
}

function revalidateNotes() {
  revalidatePath("/dsa");
  revalidatePath("/dsa/[slug]", "page");
  revalidatePath("/patterns");
  revalidatePath("/patterns/[slug]", "page");
  revalidatePath("/settings");
}

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createNoteAction(formData: FormData) {
  const type = asString(formData, "type");
  const title = asString(formData, "title");
  if (type !== "problem" && type !== "pattern") {
    throw new Error("Invalid note type");
  }
  const note = await createNote({ type, title });
  await persistVault(note.id);
  revalidateNotes();
  redirect(noteHref(note.type, note.slug));
}

export async function updateNoteAction(
  noteId: string,
  patch: { title?: string; body?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await updateNote(noteId, patch);
    await persistVault(noteId);
    revalidateNotes();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save note",
    };
  }
}

export async function setNotePropertyAction(
  noteId: string,
  defId: string,
  value: PropertyJson | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await setNoteProperty(noteId, defId, value);
    await persistVault(noteId);
    revalidateNotes();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save property",
    };
  }
}

export async function removeNotePropertyAction(
  noteId: string,
  defId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await removeNoteProperty(noteId, defId);
    await persistVault(noteId);
    revalidateNotes();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not remove property",
    };
  }
}

export async function createPropertyDefAction(formData: FormData) {
  const key = asString(formData, "key");
  const valueType = asString(formData, "valueType") as PropertyValueType;
  const optionsRaw = asString(formData, "options");
  const options = optionsRaw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!propertyValueTypes.includes(valueType)) {
    throw new Error("Invalid value type");
  }

  await createPropertyDef({
    key,
    valueType,
    options,
  });
  revalidatePath("/settings");
  revalidateNotes();
}

export async function updatePropertyOptionsAction(formData: FormData) {
  const id = asString(formData, "id");
  const options = asString(formData, "options")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  await updatePropertyDefOptions(id, options);
  revalidatePath("/settings");
  revalidateNotes();
}

export async function deletePropertyDefAction(id: string) {
  await deletePropertyDef(id);
  revalidatePath("/settings");
  revalidateNotes();
}
