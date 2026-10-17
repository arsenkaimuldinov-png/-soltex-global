-- Phase J-1: media library metadata (docs/admin-media.md). Additive only: existing rows become
-- source 'legacy' (imported as is, URLs unchanged). Rollback: drop the constraint, index, columns and enum.
CREATE TYPE "public"."media_source" AS ENUM('legacy', 'upload');--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "source" "media_source" DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "storage_path" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "original_name" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "mime" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "bytes" bigint;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "sha256" text;--> statement-breakpoint
CREATE INDEX "media_sha256" ON "media" USING btree ("sha256");--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_upload_path" CHECK ("media"."source" <> 'upload' OR ("media"."storage_path" ~ '^originals/[0-9]{4}/[0-9a-f-]{36}\.(jpg|png|webp|avif|mp4)$' AND "media"."src" = ('/media/' || "media"."storage_path")));
