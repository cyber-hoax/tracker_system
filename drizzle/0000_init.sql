CREATE TABLE "links" (
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "links_from_id_to_id_kind_pk" PRIMARY KEY("from_id","to_id","kind"),
	CONSTRAINT "links_kind_check" CHECK ("links"."kind" in ('pattern', 'wikilink', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "note_properties" (
	"note_id" uuid NOT NULL,
	"def_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "note_properties_note_id_def_id_pk" PRIMARY KEY("note_id","def_id")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"file_path" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector",
	CONSTRAINT "notes_type_check" CHECK ("notes"."type" in ('problem', 'pattern', 'lld', 'hld'))
);
--> statement-breakpoint
CREATE TABLE "property_defs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value_type" text NOT NULL,
	"options" jsonb,
	"is_system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "property_defs_value_type_check" CHECK ("property_defs"."value_type" in ('text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'wikilink', 'wikilink_list'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"subject" text NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"problems_count" integer DEFAULT 0 NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dsa" text DEFAULT '' NOT NULL,
	"lld" text DEFAULT '' NOT NULL,
	"hld" text DEFAULT '' NOT NULL,
	"ai" text DEFAULT '' NOT NULL,
	"personal" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_from_id_notes_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_to_id_notes_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_properties" ADD CONSTRAINT "note_properties_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_properties" ADD CONSTRAINT "note_properties_def_id_property_defs_id_fk" FOREIGN KEY ("def_id") REFERENCES "public"."property_defs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "links_to_id_idx" ON "links" USING btree ("to_id");--> statement-breakpoint
CREATE INDEX "note_properties_def_id_idx" ON "note_properties" USING btree ("def_id");--> statement-breakpoint
CREATE INDEX "note_properties_value_gin" ON "note_properties" USING gin ("value");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_slug_idx" ON "notes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_file_path_idx" ON "notes" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "notes_type_idx" ON "notes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notes_search_vector_idx" ON "notes" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "property_defs_key_idx" ON "property_defs" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reviews_week_start_idx" ON "weekly_reviews" USING btree ("week_start");