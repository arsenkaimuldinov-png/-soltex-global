-- Phase K-1: leads, their history and the outbox (docs/admin-leads.md; approved §13, §19).
-- Additive only: new enums, a sequence and three tables. Personal data columns hold ciphertext only.
-- Rollback: drop the three tables, the sequence and the four enums.
CREATE TYPE "public"."consent_basis" AS ENUM('notice_only', 'checkbox');--> statement-breakpoint
CREATE TYPE "public"."lead_event_kind" AS ENUM('created', 'status', 'assignee', 'note', 'notified', 'notify_failed', 'deleted', 'restored', 'anonymized');--> statement-breakpoint
CREATE TYPE "public"."lead_form" AS ENUM('cta_section', 'inquiry_modal', 'contact_page');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'in_progress', 'qualified', 'won', 'lost', 'spam');--> statement-breakpoint
CREATE SEQUENCE "public"."lead_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "lead_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lead_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"kind" "lead_event_kind" NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note_enc" text
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"number" bigint NOT NULL,
	"form_type" "lead_form" NOT NULL,
	"locale" text NOT NULL,
	"page_path" text,
	"topic" text,
	"name" text,
	"company" text,
	"email_enc" text,
	"phone_enc" text,
	"message_enc" text,
	"email_bidx" text,
	"phone_bidx" text,
	"ip_hash" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"assignee_id" uuid,
	"spam_score" integer DEFAULT 0 NOT NULL,
	"spam_reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"consent_basis" "consent_basis" DEFAULT 'notice_only' NOT NULL,
	"privacy_notice_version" text,
	"consent_text_version" text,
	"consent_at" timestamp with time zone,
	"attribution" jsonb,
	"notified_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"anonymized_at" timestamp with time zone,
	CONSTRAINT "leads_reference_unique" UNIQUE("reference"),
	CONSTRAINT "leads_number_unique" UNIQUE("number"),
	CONSTRAINT "leads_reference" CHECK ("leads"."reference" ~ '^SOL-[0-9]{4}-[0-9]{6,}$')
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_events_lead" ON "lead_events" USING btree ("lead_id","at");--> statement-breakpoint
CREATE INDEX "leads_created" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_status" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_email_bidx" ON "leads" USING btree ("email_bidx");--> statement-breakpoint
CREATE INDEX "leads_phone_bidx" ON "leads" USING btree ("phone_bidx");--> statement-breakpoint
CREATE INDEX "outbox_due" ON "outbox" USING btree ("sent_at","next_attempt_at");
