CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" DROP CONSTRAINT "notes_type_check";--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folders_parent_id_idx" ON "folders" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_folder_id_idx" ON "notes" USING btree ("folder_id");--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_type_check" CHECK ("notes"."type" in ('problem', 'pattern', 'lld', 'hld', 'ai', 'note'));
--> statement-breakpoint
INSERT INTO "folders" ("name", "parent_id", "sort_order")
SELECT * FROM (VALUES ('DSA', NULL::uuid, 0), ('Pattern', NULL::uuid, 1)) AS seed(name, parent_id, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "folders");
--> statement-breakpoint
INSERT INTO "folders" ("name", "parent_id", "sort_order")
SELECT child.name, parent.id, child.sort_order
FROM (
  VALUES ('LLD', 0), ('HLD', 1), ('AI', 2)
) AS child(name, sort_order)
JOIN "folders" AS parent ON parent.name = 'DSA' AND parent.parent_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "folders" AS existing
  WHERE existing.parent_id = parent.id AND existing.name = child.name
);
--> statement-breakpoint
UPDATE "notes" SET "folder_id" = (
  SELECT id FROM "folders" WHERE name = 'DSA' AND parent_id IS NULL
) WHERE "type" = 'problem' AND "folder_id" IS NULL;
--> statement-breakpoint
UPDATE "notes" SET "folder_id" = (
  SELECT id FROM "folders" WHERE name = 'Pattern' AND parent_id IS NULL
) WHERE "type" = 'pattern' AND "folder_id" IS NULL;
--> statement-breakpoint
UPDATE "notes" SET "folder_id" = (
  SELECT id FROM "folders" WHERE name = 'LLD' AND parent_id = (
    SELECT id FROM "folders" WHERE name = 'DSA' AND parent_id IS NULL
  )
) WHERE "type" = 'lld' AND "folder_id" IS NULL;
--> statement-breakpoint
UPDATE "notes" SET "folder_id" = (
  SELECT id FROM "folders" WHERE name = 'HLD' AND parent_id = (
    SELECT id FROM "folders" WHERE name = 'DSA' AND parent_id IS NULL
  )
) WHERE "type" = 'hld' AND "folder_id" IS NULL;
--> statement-breakpoint
UPDATE "notes" SET "folder_id" = (
  SELECT id FROM "folders" WHERE name = 'AI' AND parent_id = (
    SELECT id FROM "folders" WHERE name = 'DSA' AND parent_id IS NULL
  )
) WHERE "type" = 'ai' AND "folder_id" IS NULL;