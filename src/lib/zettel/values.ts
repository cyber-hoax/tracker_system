import type { PropertyValueType } from "@/db/schema";
import { PATTERN_PROPERTY_KEY } from "./constants";
import { canonicalWikilinkTarget } from "./wikilink";

export type PropertyJson = string | number | boolean | string[];

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function isWikilinkType(
  valueType: string,
): valueType is "wikilink" | "wikilink_list" {
  return valueType === "wikilink" || valueType === "wikilink_list";
}

/**
 * Normalize a UI/API value into the JSONB shape stored on `note_properties.value`.
 * Returns `null` when the property row should be deleted.
 *
 * JSONB encoding (graph/search/Obsidian-sync must follow this):
 * - text, date (YYYY-MM-DD), select, wikilink → JSON string
 * - number → JSON number
 * - checkbox → JSON boolean (`false` is stored)
 * - multi_select, wikilink_list → JSON string array
 */
export function parsePropertyValue(
  valueType: PropertyValueType | string,
  value: unknown,
  defKey?: string,
): PropertyJson | null {
  const stripPatternFolder = defKey === PATTERN_PROPERTY_KEY;

  switch (valueType) {
    case "text":
    case "select":
    case "date": {
      if (value == null) return null;
      return String(value).trim();
    }
    case "number": {
      if (value == null || value === "") return null;
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case "checkbox": {
      if (value == null) return null;
      return Boolean(value);
    }
    case "wikilink": {
      if (value == null) return null;
      return canonicalWikilinkTarget(String(value), { stripPatternFolder });
    }
    case "multi_select": {
      if (value == null) return null;
      const items = asStringArray(value)
        .map((item) => item.trim())
        .filter(Boolean);
      return [...new Set(items)];
    }
    case "wikilink_list": {
      if (value == null) return null;
      const items = asStringArray(value)
        .map((item) =>
          canonicalWikilinkTarget(item, { stripPatternFolder }),
        )
        .filter(Boolean);
      return [...new Set(items)];
    }
    default:
      return null;
  }
}

export function wikilinkTargetsFromValue(
  valueType: string,
  value: unknown,
): string[] {
  if (valueType === "wikilink" && typeof value === "string" && value.trim()) {
    return [value];
  }
  if (valueType === "wikilink_list") {
    return asStringArray(value).filter(Boolean);
  }
  return [];
}

export function propertyText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }
  return "";
}
