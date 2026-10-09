-- Phase F: translation review tracking (docs/admin-translations.md, docs/admin-database.md).
-- Additive only: new columns with defaults / NULL, no data rewritten, no existing column changed.
--   <entity>.source_revision                 revision of the source-language translatable text
--   <entity>_translations.version            concurrency token of one language row
--   <entity>_translations.approved_source_revision / approved_by   what an approval reviewed
--   <entity>_translations.edited_source_revision                   source revision of the last save
-- Approvals that already exist are linked to the current revision by the reconcile step that
-- `npm run db:migrate` and `npm run db:import` run after this migration (legacy source hash check).
-- Rollback: drop the added columns and constraints (no other object depends on them).
ALTER TABLE "epcm_stage_translations" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "epcm_stage_translations" ADD COLUMN "approved_source_revision" integer;--> statement-breakpoint
ALTER TABLE "epcm_stage_translations" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "epcm_stage_translations" ADD COLUMN "edited_source_revision" integer;--> statement-breakpoint
ALTER TABLE "epcm_stages" ADD COLUMN "source_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "page_translations" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "page_translations" ADD COLUMN "approved_source_revision" integer;--> statement-breakpoint
ALTER TABLE "page_translations" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "page_translations" ADD COLUMN "edited_source_revision" integer;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "source_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "patent_translations" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "patent_translations" ADD COLUMN "approved_source_revision" integer;--> statement-breakpoint
ALTER TABLE "patent_translations" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "patent_translations" ADD COLUMN "edited_source_revision" integer;--> statement-breakpoint
ALTER TABLE "patents" ADD COLUMN "source_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_translations" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_translations" ADD COLUMN "approved_source_revision" integer;--> statement-breakpoint
ALTER TABLE "product_translations" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "product_translations" ADD COLUMN "edited_source_revision" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_translations" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_translations" ADD COLUMN "approved_source_revision" integer;--> statement-breakpoint
ALTER TABLE "project_translations" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "project_translations" ADD COLUMN "edited_source_revision" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "source_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "technologies" ADD COLUMN "source_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "technology_translations" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "technology_translations" ADD COLUMN "approved_source_revision" integer;--> statement-breakpoint
ALTER TABLE "technology_translations" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "technology_translations" ADD COLUMN "edited_source_revision" integer;--> statement-breakpoint
ALTER TABLE "video_translations" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "video_translations" ADD COLUMN "approved_source_revision" integer;--> statement-breakpoint
ALTER TABLE "video_translations" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "video_translations" ADD COLUMN "edited_source_revision" integer;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "source_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "epcm_stage_translations" ADD CONSTRAINT "epcm_stage_translations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translations" ADD CONSTRAINT "page_translations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_translations" ADD CONSTRAINT "patent_translations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_translations" ADD CONSTRAINT "project_translations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_translations" ADD CONSTRAINT "technology_translations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_translations" ADD CONSTRAINT "video_translations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;