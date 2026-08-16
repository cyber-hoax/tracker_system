CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_title_trgm_idx" ON "notes" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_body_trgm_idx" ON "notes" USING gin ("body" gin_trgm_ops);
