import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { links, noteProperties, notes, propertyDefs } from "@/db/schema";
import { clipGraph } from "./graph-clip";
import { collapseAliasedPatternGraph } from "./pattern-aliases";
import { propertyConditions } from "./filters";
import type { ProblemFilters } from "./query";
import { noteHref } from "./slug";

export type GraphNode = {
  id: string;
  name: string;
  type: string;
  slug: string;
  href: string;
  status?: string;
  difficulty?: string;
};

export type GraphLink = {
  source: string;
  target: string;
  kind: string;
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export async function getGraphData(
  filters: ProblemFilters = {},
): Promise<GraphData> {
  const extra = await propertyConditions(filters);
  if (extra === null) {
    return { nodes: [], links: [] };
  }

  const [noteRows, linkRows] = await Promise.all([
    db
      .select({
        id: notes.id,
        title: notes.title,
        slug: notes.slug,
        type: notes.type,
      })
      .from(notes),
    db.select().from(links),
  ]);

  let seedIds: Set<string> | null = null;
  if (extra.length > 0) {
    const matched = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(...extra));
    seedIds = new Set(matched.map((row) => row.id));
  }

  const rawLinks: GraphLink[] = linkRows.map((row) => ({
    source: row.fromId,
    target: row.toId,
    kind: row.kind,
  }));

  const raw = clipGraph(
    noteRows.map((row) => ({
      id: row.id,
      name: row.title,
      type: row.type,
      slug: row.slug,
      href: noteHref(row.type, row.slug),
    })),
    rawLinks,
    seedIds,
  );
  const clipped = collapseAliasedPatternGraph(raw.nodes, raw.links);

  if (clipped.nodes.length === 0) {
    return clipped;
  }

  const props = await db
    .select({
      noteId: noteProperties.noteId,
      key: propertyDefs.key,
      value: noteProperties.value,
    })
    .from(noteProperties)
    .innerJoin(propertyDefs, eq(noteProperties.defId, propertyDefs.id))
    .where(
      inArray(
        noteProperties.noteId,
        clipped.nodes.map((node) => node.id),
      ),
    );

  const byNote = new Map<string, Record<string, unknown>>();
  for (const prop of props) {
    const current = byNote.get(prop.noteId) ?? {};
    current[prop.key] = prop.value;
    byNote.set(prop.noteId, current);
  }

  return {
    nodes: clipped.nodes.map((node) => {
      const values = byNote.get(node.id) ?? {};
      return {
        ...node,
        status: stringProp(values.Status),
        difficulty: stringProp(values.Difficulty),
      };
    }),
    links: clipped.links,
  };
}

function stringProp(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
