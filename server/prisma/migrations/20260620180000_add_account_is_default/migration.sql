-- AlterTable
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: for each user, set is_default = true on their account named 'Default'.
-- If a user has no 'Default' account, pick their oldest account instead.
-- This ensures every user ends up with exactly one default account.
WITH ranked AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        CASE WHEN name = 'Default' THEN 0 ELSE 1 END,
        created_at ASC
    ) AS rn
  FROM "account"
)
UPDATE "account"
SET "is_default" = true
FROM ranked
WHERE "account".id = ranked.id
  AND ranked.rn = 1;
