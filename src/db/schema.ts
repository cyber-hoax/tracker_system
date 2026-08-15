import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const noteTypes = ["problem", "pattern", "lld", "hld"] as const;
export const linkKinds = ["pattern", "wikilink", "manual"] as const;
export const propertyValueTypes = [
  "text",
  "number",
  "date",
  "select",
  "multi_select",
  "checkbox",
  "wikilink",
  "wikilink_list",
] as const;

export type NoteType = (typeof noteTypes)[number];
export type LinkKind = (typeof linkKinds)[number];
export type PropertyValueType = (typeof propertyValueTypes)[number];

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    body: text("body").notNull().default(""),
    filePath: text("file_path"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    searchVector: tsvector("search_vector"),
  },
  (table) => [
    uniqueIndex("notes_slug_idx").on(table.slug),
    uniqueIndex("notes_file_path_idx").on(table.filePath),
    index("notes_type_idx").on(table.type),
    index("notes_search_vector_idx").using("gin", table.searchVector),
    check(
      "notes_type_check",
      sql`${table.type} in ('problem', 'pattern', 'lld', 'hld')`,
    ),
  ],
);

export const propertyDefs = pgTable(
  "property_defs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    valueType: text("value_type").notNull(),
    options: jsonb("options").$type<unknown>(),
    isSystem: boolean("is_system").notNull().default(false),
  },
  (table) => [
    uniqueIndex("property_defs_key_idx").on(table.key),
    check(
      "property_defs_value_type_check",
      sql`${table.valueType} in ('text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'wikilink', 'wikilink_list')`,
    ),
  ],
);

export const noteProperties = pgTable(
  "note_properties",
  {
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    defId: uuid("def_id")
      .notNull()
      .references(() => propertyDefs.id, { onDelete: "cascade" }),
    value: jsonb("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.noteId, table.defId] }),
    index("note_properties_def_id_idx").on(table.defId),
    index("note_properties_value_gin").using("gin", table.value),
  ],
);

export const links = pgTable(
  "links",
  {
    fromId: uuid("from_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    toId: uuid("to_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.fromId, table.toId, table.kind] }),
    index("links_to_id_idx").on(table.toId),
    check(
      "links_kind_check",
      sql`${table.kind} in ('pattern', 'wikilink', 'manual')`,
    ),
  ],
);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ts: timestamp("ts", { withTimezone: true }).notNull(),
  subject: text("subject").notNull(),
  minutes: integer("minutes").notNull().default(0),
  notes: text("notes").notNull().default(""),
  problemsCount: integer("problems_count").notNull().default(0),
  extra: jsonb("extra").$type<Record<string, unknown>>().notNull().default({}),
});

export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weekStart: text("week_start").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dsa: text("dsa").notNull().default(""),
    lld: text("lld").notNull().default(""),
    hld: text("hld").notNull().default(""),
    ai: text("ai").notNull().default(""),
    personal: text("personal").notNull().default(""),
  },
  (table) => [uniqueIndex("weekly_reviews_week_start_idx").on(table.weekStart)],
);

export const notesRelations = relations(notes, ({ many }) => ({
  properties: many(noteProperties),
  outgoingLinks: many(links, { relationName: "links_from" }),
  incomingLinks: many(links, { relationName: "links_to" }),
}));

export const propertyDefsRelations = relations(propertyDefs, ({ many }) => ({
  values: many(noteProperties),
}));

export const notePropertiesRelations = relations(noteProperties, ({ one }) => ({
  note: one(notes, {
    fields: [noteProperties.noteId],
    references: [notes.id],
  }),
  def: one(propertyDefs, {
    fields: [noteProperties.defId],
    references: [propertyDefs.id],
  }),
}));

export const linksRelations = relations(links, ({ one }) => ({
  from: one(notes, {
    fields: [links.fromId],
    references: [notes.id],
    relationName: "links_from",
  }),
  to: one(notes, {
    fields: [links.toId],
    references: [notes.id],
    relationName: "links_to",
  }),
}));
