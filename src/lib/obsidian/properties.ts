import {
  PATTERN_PROPERTY_KEY,
  SYSTEM_PROPERTY_KEYS,
} from "@/lib/zettel/constants";
import { canonicalWikilinkTarget } from "@/lib/zettel/wikilink";
import {
  parsePropertyValue,
  type PropertyJson,
} from "@/lib/zettel/values";

export type PropertyDefLite = {
  key: string;
  valueType: string;
};

export type MappedProperty = {
  key: string;
  value: PropertyJson;
};

const YAML_KEY_ORDER = [
  "notion-id",
  "base",
  "Difficulty",
  "Status",
  "remarks",
  "Mistake Type",
  "Revision Count",
  "Pattern",
  "Description",
  "Last Solved Date",
  "Next Revision Date",
  "Key Insight",
];

export function frontmatterToPropertyValues(
  frontmatter: Record<string, unknown>,
  defs: PropertyDefLite[],
): MappedProperty[] {
  const byKey = new Map(defs.map((def) => [def.key, def]));
  const out: MappedProperty[] = [];

  for (const [key, raw] of Object.entries(frontmatter)) {
    const def = byKey.get(key);
    if (!def) continue;
    const normalized = normalizeFrontmatterValue(def, raw);
    const parsed = parsePropertyValue(def.valueType, normalized, def.key);
    if (parsed === null) continue;
    if (typeof parsed === "string" && parsed === "") continue;
    if (Array.isArray(parsed) && parsed.length === 0) continue;
    out.push({ key, value: parsed });
  }
  return out;
}

export function propertyValuesToFrontmatter(
  values: { key: string; valueType: string; value: unknown }[],
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  const yaml: Record<string, unknown> = { ...extras };
  for (const row of values) {
    if (omitEmptySystemProperty(row.key, row.value)) continue;
    if (row.value == null) {
      yaml[row.key] = emptyYamlValue(row.valueType);
      continue;
    }
    yaml[row.key] = yamlValueForProperty(row.valueType, row.key, row.value);
  }
  return orderYamlKeys(yaml);
}

export function unknownFrontmatter(
  frontmatter: Record<string, unknown>,
  defKeys: Iterable<string>,
): Record<string, unknown> {
  const known = new Set(defKeys);
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (!known.has(key)) {
      extras[key] = value;
    }
  }
  return extras;
}

function normalizeFrontmatterValue(
  def: PropertyDefLite,
  raw: unknown,
): unknown {
  if (def.valueType === "wikilink_list" || def.valueType === "multi_select") {
    if (raw == null || raw === "") return [];
    if (Array.isArray(raw)) return raw.map((item) => String(item));
    return [String(raw)];
  }
  if (def.valueType === "date") {
    return dateString(raw);
  }
  return raw;
}

function yamlValueForProperty(
  valueType: string,
  key: string,
  value: unknown,
): unknown {
  if (valueType === "wikilink" && typeof value === "string") {
    const inner = canonicalWikilinkTarget(value);
    return inner ? `[[${inner}]]` : "";
  }
  if (valueType === "wikilink_list" && key === PATTERN_PROPERTY_KEY) {
    const items = Array.isArray(value) ? value.map(String) : [];
    return items
      .map((item) =>
        canonicalWikilinkTarget(item, { stripPatternFolder: true }),
      )
      .filter(Boolean)
      .map((name) => `[[Patterns/${name}]]`);
  }
  if (valueType === "wikilink_list") {
    const items = Array.isArray(value) ? value.map(String) : [];
    return items
      .map((item) => canonicalWikilinkTarget(item))
      .filter(Boolean)
      .map((inner) => `[[${inner}]]`);
  }
  return value;
}

function omitEmptySystemProperty(key: string, value: unknown): boolean {
  if (!(SYSTEM_PROPERTY_KEYS as readonly string[]).includes(key)) {
    return false;
  }
  if (value == null) return true;
  return typeof value === "string" && value.trim() === "";
}

function emptyYamlValue(valueType: string): unknown {
  if (valueType === "wikilink_list" || valueType === "multi_select") {
    return [];
  }
  if (valueType === "checkbox") return false;
  return "";
}

function dateString(raw: unknown): unknown {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  return raw;
}

function orderYamlKeys(
  yaml: Record<string, unknown>,
): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of YAML_KEY_ORDER) {
    if (key in yaml) {
      ordered[key] = yaml[key];
    }
  }
  for (const [key, value] of Object.entries(yaml)) {
    if (!(key in ordered)) {
      ordered[key] = value;
    }
  }
  return ordered;
}
