-- AlterTable
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "has_hit_free_limit" BOOLEAN NOT NULL DEFAULT false;
