-- Phase J-2: responsive copies of images (docs/admin-media.md §9). Additive only: null = not made yet;
-- the publishing worker fills it. Rollback: drop the column.
ALTER TABLE "media" ADD COLUMN "variants" jsonb;
