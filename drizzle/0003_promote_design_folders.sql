UPDATE "folders"
SET
  "parent_id" = NULL,
  "sort_order" = CASE "folders"."name"
    WHEN 'LLD' THEN 2
    WHEN 'HLD' THEN 3
    WHEN 'AI' THEN 4
    ELSE "folders"."sort_order"
  END
FROM "folders" AS dsa
WHERE dsa."name" = 'DSA'
  AND dsa."parent_id" IS NULL
  AND "folders"."parent_id" = dsa."id"
  AND "folders"."name" IN ('LLD', 'HLD', 'AI')
  AND NOT EXISTS (
    SELECT 1
    FROM "folders" AS root
    WHERE root."parent_id" IS NULL
      AND root."name" = "folders"."name"
      AND root."id" <> "folders"."id"
  );
--> statement-breakpoint
UPDATE "notes" AS n
SET "folder_id" = root."id"
FROM "folders" AS nested
JOIN "folders" AS dsa
  ON nested."parent_id" = dsa."id"
  AND dsa."name" = 'DSA'
  AND dsa."parent_id" IS NULL
JOIN "folders" AS root
  ON root."parent_id" IS NULL
  AND root."name" = nested."name"
  AND root."id" <> nested."id"
WHERE nested."name" IN ('LLD', 'HLD', 'AI')
  AND n."folder_id" = nested."id";
--> statement-breakpoint
UPDATE "folders" AS grandchild
SET "parent_id" = root."id"
FROM "folders" AS nested
JOIN "folders" AS dsa
  ON nested."parent_id" = dsa."id"
  AND dsa."name" = 'DSA'
  AND dsa."parent_id" IS NULL
JOIN "folders" AS root
  ON root."parent_id" IS NULL
  AND root."name" = nested."name"
  AND root."id" <> nested."id"
WHERE nested."name" IN ('LLD', 'HLD', 'AI')
  AND grandchild."parent_id" = nested."id";
--> statement-breakpoint
DELETE FROM "folders" AS nested
USING "folders" AS dsa, "folders" AS root
WHERE dsa."name" = 'DSA'
  AND dsa."parent_id" IS NULL
  AND nested."parent_id" = dsa."id"
  AND nested."name" IN ('LLD', 'HLD', 'AI')
  AND root."parent_id" IS NULL
  AND root."name" = nested."name"
  AND root."id" <> nested."id";
