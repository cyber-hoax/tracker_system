export type RemoteModel = {
  id: string;
  label: string;
  ownedBy: string;
};

type CatalogItem = {
  id?: string;
  name?: string;
  owned_by?: string;
  root?: string;
  parent?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function normalizeModelToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function itemFromUnknown(value: unknown): CatalogItem | null {
  if (typeof value === "string" && value.trim()) return { id: value.trim() };
  const record = asRecord(value);
  if (!record) return null;
  const id =
    (typeof record.id === "string" && record.id.trim()) ||
    (typeof record.name === "string" && record.name.trim()) ||
    "";
  if (!id) return null;
  return {
    id,
    name: typeof record.name === "string" ? record.name : undefined,
    owned_by: typeof record.owned_by === "string" ? record.owned_by : undefined,
    root: typeof record.root === "string" ? record.root : undefined,
    parent: typeof record.parent === "string" ? record.parent : null,
  };
}

function ownedByOf(item: CatalogItem): string {
  if (item.owned_by?.trim()) return item.owned_by.trim();
  const slash = item.id?.indexOf("/") ?? -1;
  return slash > 0 ? item.id!.slice(0, slash) : "other";
}

function preferCanonical(items: CatalogItem[]): CatalogItem[] {
  const groups = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const key = `${ownedByOf(item)}|${item.root || item.id}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const picked: CatalogItem[] = [];
  for (const group of groups.values()) {
    const owner = ownedByOf(group[0]);
    const canonical =
      group.find((item) => item.id === `${owner}/${item.root}`) ||
      group.find((item) => item.id?.startsWith(`${owner}/`)) ||
      group.find((item) => !item.parent) ||
      group[0];
    picked.push(canonical);
  }
  return picked;
}

export function parseModelCatalog(payload: unknown): RemoteModel[] {
  const record = asRecord(payload);
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(record?.data)
      ? record.data
      : Array.isArray(record?.models)
        ? record.models
        : [];
  const items = raw
    .map(itemFromUnknown)
    .filter((item): item is CatalogItem => Boolean(item?.id));
  return preferCanonical(items)
    .map((item) => ({
      id: item.id!,
      label: item.name?.trim() || item.id!,
      ownedBy: ownedByOf(item),
    }))
    .sort((a, b) => {
      const owner = a.ownedBy.localeCompare(b.ownedBy);
      return owner !== 0 ? owner : a.label.localeCompare(b.label);
    });
}

function versionParts(value: string): number[] {
  return [...value.matchAll(/\d+/g)].map((match) => Number(match[0]));
}

function versionDistance(requested: string, candidate: string): number {
  const want = versionParts(requested);
  const got = versionParts(candidate);
  if (want.length === 0) return 0;
  let score = 0;
  for (let index = 0; index < want.length; index += 1) {
    score += Math.abs(want[index] - (got[index] ?? 0)) * 10 ** (want.length - index);
  }
  return score;
}

function qualityRank(id: string): number {
  const tail = id.toLowerCase();
  if (tail.endsWith("-high") && !tail.includes("fast") && !tail.includes("xhigh")) {
    return 0;
  }
  if (/-high$/.test(tail)) return 1;
  if (!tail.includes("fast") && !tail.includes("medium") && !tail.includes("xhigh")) {
    return 2;
  }
  return 3;
}

export function resolveListedModel(
  requested: string,
  models: RemoteModel[],
): { id: string; label: string; note?: string } {
  if (models.length === 0) {
    return { id: requested.trim(), label: requested.trim() };
  }
  const want = requested.trim();
  if (!want) {
    return { id: models[0].id, label: models[0].label };
  }
  const exact = models.find((model) => model.id === want || model.label === want);
  if (exact) return { id: exact.id, label: exact.label };

  const normalized = normalizeModelToken(want);
  const sameToken = models.find(
    (model) =>
      normalizeModelToken(model.id) === normalized ||
      normalizeModelToken(model.label) === normalized,
  );
  if (sameToken) return { id: sameToken.id, label: sameToken.label };

  const words = want.split(/\s+/).filter(Boolean);
  const textWords = words.filter((word) => !/^\d+(\.\d+)*$/.test(word));
  if (words.length >= 2) {
    const provider = words[0].toLowerCase();
    const slug = words.slice(1).join("-").toLowerCase();
    const prefixed = models.find(
      (model) =>
        model.id.toLowerCase() === `${provider}/${slug}` ||
        model.id.toLowerCase() === `cu/${slug}`,
    );
    if (prefixed) return { id: prefixed.id, label: prefixed.label };
  }

  const family = models.filter((model) => {
    const haystack = normalizeModelToken(`${model.id} ${model.label} ${model.ownedBy}`);
    return textWords.every((word) => haystack.includes(normalizeModelToken(word)));
  });
  const pool = family.length > 0 ? family : models;
  const scored = [...pool].sort((left, right) => {
    const byVersion =
      versionDistance(want, left.id) - versionDistance(want, right.id);
    if (byVersion !== 0) return byVersion;
    return qualityRank(left.id) - qualityRank(right.id);
  });
  const best = scored[0];
  const note =
    normalizeModelToken(best.id) === normalized
      ? undefined
      : `${want} is not in the catalog. Using ${best.id}.`;
  return { id: best.id, label: best.label, note };
}
