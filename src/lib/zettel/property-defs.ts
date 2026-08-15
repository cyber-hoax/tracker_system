import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  noteProperties,
  propertyDefs,
  propertyValueTypes,
  type PropertyValueType,
} from "@/db/schema";
import { SYSTEM_PROPERTY_KEYS } from "./constants";
import { isWikilinkType } from "./values";
import { syncPropertyLinks } from "./links";

export type CreatePropertyDefInput = {
  key: string;
  valueType: PropertyValueType;
  options?: string[] | null;
};

export async function createPropertyDef(input: CreatePropertyDefInput) {
  const key = input.key.trim();
  if (!key) throw new Error("Property key is required");
  if (!propertyValueTypes.includes(input.valueType)) {
    throw new Error("Invalid value type");
  }

  const needsOptions =
    input.valueType === "select" || input.valueType === "multi_select";
  const options = needsOptions
    ? (input.options ?? []).map((item) => item.trim()).filter(Boolean)
    : null;
  if (needsOptions && (!options || options.length === 0)) {
    throw new Error("Select properties need at least one option");
  }

  const existing = await db
    .select({ id: propertyDefs.id })
    .from(propertyDefs)
    .where(eq(propertyDefs.key, key))
    .limit(1);
  if (existing[0]) {
    throw new Error(`Property "${key}" already exists`);
  }

  const isSystem = (SYSTEM_PROPERTY_KEYS as readonly string[]).includes(key);

  const [created] = await db
    .insert(propertyDefs)
    .values({
      key,
      valueType: input.valueType,
      options,
      isSystem,
    })
    .returning();
  return created;
}

export async function updatePropertyDefOptions(id: string, options: string[]) {
  const [def] = await db
    .select()
    .from(propertyDefs)
    .where(eq(propertyDefs.id, id))
    .limit(1);
  if (!def) throw new Error("Property not found");
  if (def.valueType !== "select" && def.valueType !== "multi_select") {
    throw new Error("Only select properties have options");
  }
  const next = [...new Set(options.map((item) => item.trim()).filter(Boolean))];
  if (next.length === 0) throw new Error("Keep at least one option");
  const [updated] = await db
    .update(propertyDefs)
    .set({ options: next })
    .where(eq(propertyDefs.id, id))
    .returning();
  return updated;
}

/**
 * Removing a def cascade-deletes `note_properties` rows. Property-derived
 * `links` are then rebuilt for every note that had a value.
 */
export async function deletePropertyDef(id: string) {
  const [def] = await db
    .select()
    .from(propertyDefs)
    .where(eq(propertyDefs.id, id))
    .limit(1);
  if (!def) throw new Error("Property not found");
  if (def.isSystem) {
    throw new Error("System properties cannot be deleted");
  }

  const affected = isWikilinkType(def.valueType)
    ? await db
        .select({ noteId: noteProperties.noteId })
        .from(noteProperties)
        .where(eq(noteProperties.defId, id))
    : [];

  await db.delete(propertyDefs).where(eq(propertyDefs.id, id));

  for (const { noteId } of affected) {
    await syncPropertyLinks(noteId);
  }
}
