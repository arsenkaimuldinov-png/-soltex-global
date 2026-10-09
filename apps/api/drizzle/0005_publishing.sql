-- Phase G: publishing, revisions and releases (docs/admin-publishing.md, docs/admin-database.md).
-- Additive only: new enums, tables, indexes and triggers; no existing table or row is changed.
-- Existing content gets its first ("baseline") revision from the reconcile step that
-- `npm run db:migrate` and `npm run db:import` run after the migrations.
-- Rollback: drop the five new tables, the two functions and the three enums.
CREATE TYPE "public"."release_kind" AS ENUM('release', 'preview');--> statement-breakpoint
CREATE TYPE "public"."release_status" AS ENUM('queued', 'building', 'validating', 'ready', 'active', 'retired', 'failed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."revision_kind" AS ENUM('baseline', 'import', 'create', 'update', 'archive', 'unarchive', 'publish', 'unpublish', 'translation', 'approve', 'reopen', 'restore');--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "content_revisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_key" text NOT NULL,
	"number" integer NOT NULL,
	"kind" "revision_kind" NOT NULL,
	"locale" text,
	"source_revision" integer NOT NULL,
	"entity_version" integer NOT NULL,
	"title" text NOT NULL,
	"data" json NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "content_revisions_number" UNIQUE("entity_type","entity_id","number")
);
--> statement-breakpoint
CREATE TABLE "content_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" "release_kind" NOT NULL,
	"sha256" text NOT NULL,
	"store" json NOT NULL,
	"entity_revisions" jsonb NOT NULL,
	"translations" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "preview_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"release_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"cookie_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "preview_grants_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "preview_grants_cookie_hash_unique" UNIQUE("cookie_hash")
);
--> statement-breakpoint
CREATE TABLE "release_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "release_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"release_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"event" text NOT NULL,
	"from_status" "release_status",
	"to_status" "release_status",
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"kind" "release_kind" NOT NULL,
	"status" "release_status" NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"previous_release_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"note" text,
	"validation" jsonb,
	"failure" jsonb,
	"build_started_at" timestamp with time zone,
	"build_finished_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"artifact_sha256" text,
	"artifact_bytes" bigint,
	"artifact_files" integer,
	"artifact_pages" integer,
	"activated_at" timestamp with time zone,
	"activated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "releases_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_snapshots" ADD CONSTRAINT "content_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_grants" ADD CONSTRAINT "preview_grants_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_grants" ADD CONSTRAINT "preview_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_grants" ADD CONSTRAINT "preview_grants_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_events" ADD CONSTRAINT "release_events_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_events" ADD CONSTRAINT "release_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_snapshot_id_content_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."content_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_previous_release_id_releases_id_fk" FOREIGN KEY ("previous_release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_revisions_created" ON "content_revisions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "content_revisions_entity" ON "content_revisions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "preview_grants_user" ON "preview_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "release_events_release" ON "release_events" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "releases_status" ON "releases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "releases_created" ON "releases" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "releases_one_active" ON "releases" USING btree ("kind") WHERE status = 'active';--> statement-breakpoint
-- Append-only history (approved §4.2, review §M): revisions, snapshots and release events are never
-- changed or deleted by the application. The application role keeps INSERT and SELECT only; a
-- trigger refuses UPDATE and DELETE for everybody. (TRUNCATE stays possible for the owner role:
-- test databases are reset with it; the application role has no TRUNCATE right.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'soltex_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON "content_revisions", "content_snapshots", "release_events" FROM soltex_app;
    REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON "releases", "preview_grants" FROM soltex_app;
  END IF;
END
$$;
--> statement-breakpoint
CREATE FUNCTION "publishing_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (% refused)', TG_TABLE_NAME, TG_OP USING ERRCODE = 'insufficient_privilege';
END
$$;
--> statement-breakpoint
CREATE TRIGGER "content_revisions_append_only" BEFORE UPDATE OR DELETE ON "content_revisions" FOR EACH ROW EXECUTE FUNCTION "publishing_append_only"();
--> statement-breakpoint
CREATE TRIGGER "content_snapshots_append_only" BEFORE UPDATE OR DELETE ON "content_snapshots" FOR EACH ROW EXECUTE FUNCTION "publishing_append_only"();
--> statement-breakpoint
CREATE TRIGGER "release_events_append_only" BEFORE UPDATE OR DELETE ON "release_events" FOR EACH ROW EXECUTE FUNCTION "publishing_append_only"();
--> statement-breakpoint
-- A release's identity, snapshot and (once validated) artifact never change.
CREATE FUNCTION "releases_immutable_columns"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.key <> OLD.key OR NEW.kind <> OLD.kind OR NEW.snapshot_id <> OLD.snapshot_id
     OR NEW.created_at <> OLD.created_at OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR (OLD.artifact_sha256 IS NOT NULL AND (NEW.artifact_sha256 IS DISTINCT FROM OLD.artifact_sha256
         OR NEW.artifact_bytes IS DISTINCT FROM OLD.artifact_bytes OR NEW.artifact_files IS DISTINCT FROM OLD.artifact_files)) THEN
    RAISE EXCEPTION 'releases: identity, snapshot and artifact columns are immutable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER "releases_immutable" BEFORE UPDATE ON "releases" FOR EACH ROW EXECUTE FUNCTION "releases_immutable_columns"();
