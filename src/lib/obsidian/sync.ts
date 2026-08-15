import { readdir, readFile, rename, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  noteProperties,
  notes,
  type NoteType,
} from "@/db/schema";
import { findPatternNote, uniqueSlug, syncPropertyLinks } from "@/lib/zettel/links";
import { listPropertyDefs } from "@/lib/zettel/notes";
import { patternDbSlug, slugify } from "@/lib/zettel/slug";
import { asStringArray, type PropertyJson } from "@/lib/zettel/values";
import { PATTERN_PROPERTY_KEY } from "@/lib/zettel/constants";
import { conflictSiblingPath, decideSyncWinner } from "./conflict";
import { parseVaultMarkdown, serializeVaultMarkdown, stripPatternHubs } from "./markdown";
import {
  frontmatterToPropertyValues,
  propertyValuesToFrontmatter,
  unknownFrontmatter,
  type MappedProperty,
} from "./properties";
import {
  absoluteVaultPath,
  patternsDirRel,
  relativeNotePath,
  skipVaultFileReason,
  trackerDirRel,
  vaultRoot,
} from "./paths";

export type SkippedFile = { path: string; reason: string };

export type SyncReport = {
  imported: number;
  updated: number;
  written: number;
  unchanged: number;
  conflicts: string[];
  skipped: SkippedFile[];
  problems: number;
  patterns: number;
  error?: string;
};

type VaultFile = {
  relativePath: string;
  type: "problem" | "pattern";
  title: string;
  raw: string;
  mtime: Date;
};

type NoteRow = typeof notes.$inferSelect;

export async function syncFromObsidian(): Promise<SyncReport> {
  const report = emptyReport();
  const root = vaultRoot();
  if (!root) {
    report.error = "OBSIDIAN_VAULT is not set";
    return report;
  }

  const files = await listVaultFiles(report);
  const defs = await listPropertyDefs();
  const touched = new Set<string>();

  const patterns = files.filter((file) => file.type === "pattern");
  const problems = files.filter((file) => file.type === "problem");

  for (const file of [...patterns, ...problems]) {
    try {
      const noteId = await syncOneFile(file, defs, report);
      if (noteId) touched.add(noteId);
    } catch (error) {
      report.skipped.push({
        path: file.relativePath,
        reason: error instanceof Error ? error.message : "sync failed",
      });
    }
  }

  for (const noteId of touched) {
    await syncPropertyLinks(noteId);
  }

  const counts = await db
    .select({ type: notes.type })
    .from(notes);
  report.problems = counts.filter((row) => row.type === "problem").length;
  report.patterns = counts.filter((row) => row.type === "pattern").length;
  return report;
}

export async function writeNoteToVault(noteId: string): Promise<void> {
  if (!vaultRoot()) return;
  const bundle = await loadNoteBundle(noteId);
  if (!bundle) return;
  if (bundle.note.type !== "problem" && bundle.note.type !== "pattern") {
    return;
  }

  const type = bundle.note.type;
  const nextRel = relativeNotePath(type, bundle.note.title);
  let rel = bundle.note.filePath || nextRel;

  if (rel !== nextRel) {
    const renamed = await tryRenameVaultFile(rel, nextRel);
    rel = renamed;
    if (bundle.note.filePath !== rel) {
      await db.update(notes).set({ filePath: rel }).where(eq(notes.id, noteId));
    }
  } else if (!bundle.note.filePath) {
    await db.update(notes).set({ filePath: rel }).where(eq(notes.id, noteId));
  }

  const extras = await readUnknownFrontmatter(rel, bundle.defs.map((def) => def.key));
  const markdown = serializeVaultMarkdown({
    type,
    frontmatter: propertyValuesToFrontmatter(bundle.properties, extras),
    body: bundle.note.body,
    patterns: patternNames(bundle.properties),
  });

  const abs = absoluteVaultPath(rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, markdown, "utf8");

  if (type === "problem") {
    await writeMissingPatternHubs(patternNames(bundle.properties));
  }
}

async function syncOneFile(
  file: VaultFile,
  defs: Awaited<ReturnType<typeof listPropertyDefs>>,
  report: SyncReport,
): Promise<string | null> {
  const parsed = parseVaultMarkdown(file.raw);
  const mapped = frontmatterToPropertyValues(parsed.frontmatter, defs);
  const body = stripPatternHubs(parsed.body);
  const existing = await findExistingNote(file);
  const fileFp = fingerprint(file.title, body, mapped);

  if (!existing) {
    const created = await insertNoteFromFile(file, body, mapped, defs);
    report.imported += 1;
    return created.id;
  }

  const dbProps = await mappedPropertiesForNote(existing.id, defs);
  const dbFp = fingerprint(existing.title, existing.body, dbProps);
  const winner = decideSyncWinner({
    fileMtime: file.mtime,
    dbUpdatedAt: existing.updatedAt,
    contentsEqual: fileFp === dbFp,
  });

  if (winner === "skip") {
    if (!existing.filePath) {
      await db
        .update(notes)
        .set({ filePath: file.relativePath })
        .where(eq(notes.id, existing.id));
    }
    report.unchanged += 1;
    return existing.id;
  }

  if (winner === "file") {
    await applyFileToNote(existing.id, file, body, mapped, defs);
    report.updated += 1;
    return existing.id;
  }

  if (winner === "db") {
    await writeNoteToVault(existing.id);
    report.written += 1;
    return existing.id;
  }

  const sibling = conflictSiblingPath(file.relativePath);
  const abs = absoluteVaultPath(sibling);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, file.raw, "utf8");
  await writeNoteToVault(existing.id);
  report.conflicts.push(file.relativePath);
  report.written += 1;
  return existing.id;
}

async function insertNoteFromFile(
  file: VaultFile,
  body: string,
  mapped: MappedProperty[],
  defs: Awaited<ReturnType<typeof listPropertyDefs>>,
) {
  const baseSlug =
    file.type === "pattern" ? patternDbSlug(file.title) : slugify(file.title);
  const slug = await uniqueSlug(baseSlug);
  const [created] = await db
    .insert(notes)
    .values({
      type: file.type satisfies NoteType,
      title: file.title,
      slug,
      body,
      filePath: file.relativePath,
      updatedAt: file.mtime,
    })
    .returning();
  await replaceProperties(created.id, mapped, defs);
  return created;
}

async function applyFileToNote(
  noteId: string,
  file: VaultFile,
  body: string,
  mapped: MappedProperty[],
  defs: Awaited<ReturnType<typeof listPropertyDefs>>,
) {
  await db
    .update(notes)
    .set({
      title: file.title,
      body,
      filePath: file.relativePath,
      updatedAt: file.mtime,
    })
    .where(eq(notes.id, noteId));
  await replaceProperties(noteId, mapped, defs);
}

async function replaceProperties(
  noteId: string,
  mapped: MappedProperty[],
  defs: Awaited<ReturnType<typeof listPropertyDefs>>,
) {
  const defByKey = new Map(defs.map((def) => [def.key, def]));
  const keep = new Set(mapped.map((row) => row.key));

  for (const def of defs) {
    if (keep.has(def.key)) continue;
    await db
      .delete(noteProperties)
      .where(
        and(eq(noteProperties.noteId, noteId), eq(noteProperties.defId, def.id)),
      );
  }

  for (const row of mapped) {
    const def = defByKey.get(row.key);
    if (!def) continue;
    await db
      .insert(noteProperties)
      .values({
        noteId,
        defId: def.id,
        value: row.value satisfies PropertyJson,
      })
      .onConflictDoUpdate({
        target: [noteProperties.noteId, noteProperties.defId],
        set: { value: row.value },
      });
  }
}

async function findExistingNote(file: VaultFile): Promise<NoteRow | null> {
  const [byPath] = await db
    .select()
    .from(notes)
    .where(eq(notes.filePath, file.relativePath))
    .limit(1);
  if (byPath) return byPath;

  const slug =
    file.type === "pattern" ? patternDbSlug(file.title) : slugify(file.title);
  const [bySlug] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.type, file.type), eq(notes.slug, slug)))
    .limit(1);
  return bySlug ?? null;
}

async function mappedPropertiesForNote(
  noteId: string,
  defs: Awaited<ReturnType<typeof listPropertyDefs>>,
): Promise<MappedProperty[]> {
  const rows = await db
    .select()
    .from(noteProperties)
    .where(eq(noteProperties.noteId, noteId));
  const byDef = new Map(rows.map((row) => [row.defId, row.value]));
  const mapped: MappedProperty[] = [];
  for (const def of defs) {
    const value = byDef.get(def.id);
    if (value == null) continue;
    if (typeof value === "string" && value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    mapped.push({ key: def.key, value: value as PropertyJson });
  }
  return mapped;
}

async function loadNoteBundle(noteId: string) {
  const [note] = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
  if (!note) return null;
  const defs = await listPropertyDefs();
  const values = await db
    .select()
    .from(noteProperties)
    .where(eq(noteProperties.noteId, noteId));
  const valueByDef = new Map(values.map((row) => [row.defId, row.value]));
  const properties = defs.map((def) => ({
    key: def.key,
    valueType: def.valueType,
    value: valueByDef.get(def.id) ?? null,
  }));
  return { note, defs, properties };
}

function patternNames(
  properties: { key: string; value: unknown }[],
): string[] {
  const row = properties.find((prop) => prop.key === PATTERN_PROPERTY_KEY);
  return asStringArray(row?.value);
}

async function writeMissingPatternHubs(names: string[]): Promise<void> {
  for (const name of names) {
    const pattern = await findPatternNote(name);
    if (pattern && !pattern.filePath) {
      await writeNoteToVault(pattern.id);
    }
  }
}

function fingerprint(
  title: string,
  body: string,
  props: MappedProperty[],
): string {
  const values = Object.fromEntries(
    props
      .slice()
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((row) => [row.key, row.value]),
  );
  return JSON.stringify({
    title,
    body: stripPatternHubs(body),
    values,
  });
}

async function listVaultFiles(report: SyncReport): Promise<VaultFile[]> {
  const groups: { type: "problem" | "pattern"; dir: string }[] = [
    { type: "pattern", dir: patternsDirRel() },
    { type: "problem", dir: trackerDirRel() },
  ];
  const files: VaultFile[] = [];

  for (const group of groups) {
    const listed = await listMarkdownInDir(group.dir, report);
    for (const relativePath of listed) {
      const reason = skipVaultFileReason(relativePath);
      if (reason) {
        report.skipped.push({ path: relativePath, reason });
        continue;
      }
      const abs = absoluteVaultPath(relativePath);
      const [raw, info] = await Promise.all([
        readFile(abs, "utf8"),
        stat(abs),
      ]);
      const title = path.basename(relativePath, ".md");
      files.push({
        relativePath,
        type: group.type,
        title,
        raw,
        mtime: info.mtime,
      });
    }
  }
  return files;
}

async function listMarkdownInDir(
  relDir: string,
  report: SyncReport,
): Promise<string[]> {
  const root = vaultRoot();
  if (!root) return [];
  const abs = path.join(root, ...relDir.split("/"));
  try {
    const entries = await readdir(abs, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => `${relDir}/${entry.name}`);
  } catch (error) {
    const reason =
      error && typeof error === "object" && "code" in error && error.code === "ENOENT"
        ? "missing directory"
        : error instanceof Error
          ? error.message
          : "unreadable directory";
    report.skipped.push({ path: relDir, reason });
    return [];
  }
}

async function readUnknownFrontmatter(
  relativePath: string,
  defKeys: string[],
): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(absoluteVaultPath(relativePath), "utf8");
    const parsed = parseVaultMarkdown(raw);
    return unknownFrontmatter(parsed.frontmatter, defKeys);
  } catch {
    return {};
  }
}

async function tryRenameVaultFile(
  fromRel: string,
  toRel: string,
): Promise<string> {
  if (fromRel === toRel) return toRel;
  try {
    const fromAbs = absoluteVaultPath(fromRel);
    const toAbs = absoluteVaultPath(toRel);
    await mkdir(path.dirname(toAbs), { recursive: true });
    await rename(fromAbs, toAbs);
    return toRel;
  } catch {
    return fromRel;
  }
}

function emptyReport(): SyncReport {
  return {
    imported: 0,
    updated: 0,
    written: 0,
    unchanged: 0,
    conflicts: [],
    skipped: [],
    problems: 0,
    patterns: 0,
  };
}
