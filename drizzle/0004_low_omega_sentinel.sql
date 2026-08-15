CREATE TABLE "trash_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"payload" jsonb NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trash_snapshots_kind_check" CHECK ("trash_snapshots"."kind" in ('folder', 'note'))
);
--> statement-breakpoint
CREATE INDEX "trash_snapshots_deleted_at_idx" ON "trash_snapshots" USING btree ("deleted_at");