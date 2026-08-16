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
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const noteTypes = ["problem", "pattern", "lld", "hld", "ai", "note"] as const;
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

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("folders_parent_id_idx").on(table.parentId),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    body: text("body").notNull().default(""),
    filePath: text("file_path"),
    folderId: uuid("folder_id").references(() => folders.id, {
      onDelete: "cascade",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    searchVector: tsvector("search_vector"),
  },
  (table) => [
    uniqueIndex("notes_slug_idx").on(table.slug),
    uniqueIndex("notes_file_path_idx").on(table.filePath),
    index("notes_type_idx").on(table.type),
    index("notes_folder_id_idx").on(table.folderId),
    index("notes_search_vector_idx").using("gin", table.searchVector),
    check(
      "notes_type_check",
      sql`${table.type} in ('problem', 'pattern', 'lld', 'hld', 'ai', 'note')`,
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

export const routines = pgTable(
  "routines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull().default("New chat"),
    providerId: text("provider_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("chat_conversations_updated_at_idx").on(table.updatedAt)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_messages_conversation_id_idx").on(table.conversationId),
    check(
      "chat_messages_role_check",
      sql`${table.role} in ('user', 'assistant', 'system')`,
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

export const trashSnapshots = pgTable(
  "trash_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("trash_snapshots_deleted_at_idx").on(table.deletedAt),
    check("trash_snapshots_kind_check", sql`${table.kind} in ('folder', 'note')`),
  ],
);

export const foldersRelations = relations(folders, ({ one, many }) => ({
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: "folder_parent",
  }),
  children: many(folders, { relationName: "folder_parent" }),
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ many, one }) => ({
  folder: one(folders, {
    fields: [notes.folderId],
    references: [folders.id],
  }),
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
