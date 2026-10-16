-- Phase I-2: optimistic lock for redirect edits in the admin (docs/admin-seo.md §8).
-- Additive only: existing rows get version 1. Rollback: drop the column.
ALTER TABLE "redirects" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
