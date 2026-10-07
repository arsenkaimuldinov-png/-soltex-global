CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."page_kind" AS ENUM('page', 'template');--> statement-breakpoint
CREATE TYPE "public"."patent_legal_status" AS ENUM('granted', 'application');--> statement-breakpoint
CREATE TYPE "public"."redirect_source" AS ENUM('manual', 'slug_change', 'import');--> statement-breakpoint
CREATE TYPE "public"."translation_state" AS ENUM('missing', 'in_progress', 'approved');--> statement-breakpoint
CREATE TABLE "epcm_stage_translations" (
	"stage_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"tr_status" "translation_state",
	"approved_source_hash" text,
	"approved_at" date,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"title" text NOT NULL,
	"focus" text NOT NULL,
	"description" text NOT NULL,
	"deliverables" jsonb NOT NULL,
	CONSTRAINT "epcm_stage_translations_stage_id_locale_pk" PRIMARY KEY("stage_id","locale")
);
--> statement-breakpoint
CREATE TABLE "epcm_stages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"position" integer NOT NULL,
	"source_locale" text DEFAULT 'en' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"number" text NOT NULL,
	"image_id" uuid,
	CONSTRAINT "epcm_stages_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "locales" (
	"code" text PRIMARY KEY NOT NULL,
	"position" smallint NOT NULL,
	"is_source" boolean DEFAULT false NOT NULL,
	CONSTRAINT "locales_position_unique" UNIQUE("position")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"kind" "media_kind" NOT NULL,
	"src" text NOT NULL,
	"width" integer,
	"height" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "media_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "media_translations" (
	"media_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"alt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "media_translations_media_id_locale_pk" PRIMARY KEY("media_id","locale")
);
--> statement-breakpoint
CREATE TABLE "metric_translations" (
	"metric_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"label" text NOT NULL,
	"highlight" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "metric_translations_metric_id_locale_pk" PRIMARY KEY("metric_id","locale")
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"position" integer NOT NULL,
	"value" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "metrics_key_unique" UNIQUE("key"),
	CONSTRAINT "metrics_position_unique" UNIQUE("position")
);
--> statement-breakpoint
CREATE TABLE "office_translations" (
	"office_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"region" text NOT NULL,
	"title" text NOT NULL,
	"country" text NOT NULL,
	"address" text,
	"representative" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "office_translations_office_id_locale_pk" PRIMARY KEY("office_id","locale")
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"position" integer NOT NULL,
	"phone" text,
	"email" text NOT NULL,
	"whatsapp" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "offices_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "page_list_item_translations" (
	"item_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"texts" jsonb NOT NULL,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "page_list_item_translations_item_id_locale_pk" PRIMARY KEY("item_id","locale")
);
--> statement-breakpoint
CREATE TABLE "page_list_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"page_id" uuid NOT NULL,
	"list_key" text NOT NULL,
	"position" integer NOT NULL,
	"structure" json NOT NULL,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "page_list_items_position" UNIQUE("page_id","list_key","position")
);
--> statement-breakpoint
CREATE TABLE "page_media" (
	"page_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"position" integer NOT NULL,
	"media_id" uuid NOT NULL,
	CONSTRAINT "page_media_page_id_slot_pk" PRIMARY KEY("page_id","slot"),
	CONSTRAINT "page_media_position" UNIQUE("page_id","position")
);
--> statement-breakpoint
CREATE TABLE "page_translations" (
	"page_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"tr_status" "translation_state",
	"approved_source_hash" text,
	"approved_at" date,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"header_badge_label" text,
	"header_title" text,
	"header_subtitle" text,
	"header_description" text,
	"header_meta" jsonb,
	"header_action_label" text,
	"copy" jsonb NOT NULL,
	"body" jsonb,
	"seo_meta_title" text,
	"seo_meta_description" text,
	CONSTRAINT "page_translations_page_id_locale_pk" PRIMARY KEY("page_id","locale")
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"position" integer NOT NULL,
	"source_locale" text DEFAULT 'en' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"page_key" text NOT NULL,
	"kind" "page_kind" NOT NULL,
	"has_header" boolean NOT NULL,
	"header_badge_number" text,
	"list_keys" text[] NOT NULL,
	"has_seo" boolean NOT NULL,
	"og_image_id" uuid,
	"noindex" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pages_key_unique" UNIQUE("key"),
	CONSTRAINT "pages_page_key_unique" UNIQUE("page_key")
);
--> statement-breakpoint
CREATE TABLE "patent_translations" (
	"patent_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"tr_status" "translation_state",
	"approved_source_hash" text,
	"approved_at" date,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"title" text NOT NULL,
	"status_label" text,
	"patent_label" text,
	"jurisdiction" text,
	"abstract" text,
	"claims_summary" jsonb,
	"code" text,
	"location" text,
	"overview" text,
	"key_pillars" jsonb,
	"industrial_implementation" text,
	"image_caption" text,
	CONSTRAINT "patent_translations_patent_id_locale_pk" PRIMARY KEY("patent_id","locale")
);
--> statement-breakpoint
CREATE TABLE "patents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"position" integer NOT NULL,
	"source_locale" text DEFAULT 'en' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"placements" text[] NOT NULL,
	"patent_no" text NOT NULL,
	"legal_status" "patent_legal_status",
	"registry_number" text,
	"image_id" uuid,
	CONSTRAINT "patents_key_unique" UNIQUE("key"),
	CONSTRAINT "patents_placements_valid" CHECK ("patents"."placements" <@ ARRAY['home','registry']::text[] AND cardinality("patents"."placements") > 0)
);
--> statement-breakpoint
CREATE TABLE "product_translations" (
	"product_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"tr_status" "translation_state",
	"approved_source_hash" text,
	"approved_at" date,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"slug" text NOT NULL,
	"category_title" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"raw_materials" jsonb NOT NULL,
	"production_technology" text NOT NULL,
	"applications" jsonb NOT NULL,
	"characteristics" jsonb NOT NULL,
	"seo_meta_title" text,
	"seo_meta_description" text,
	CONSTRAINT "product_translations_product_id_locale_pk" PRIMARY KEY("product_id","locale"),
	CONSTRAINT "product_translations_locale_slug" UNIQUE("locale","slug")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"position" integer NOT NULL,
	"source_locale" text DEFAULT 'en' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"category_number" text NOT NULL,
	"image_id" uuid NOT NULL,
	"related_technology_id" uuid NOT NULL,
	"related_project_id" uuid NOT NULL,
	"og_image_id" uuid,
	"noindex" boolean DEFAULT false NOT NULL,
	CONSTRAINT "products_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "project_gallery" (
	"project_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"media_id" uuid NOT NULL,
	CONSTRAINT "project_gallery_project_id_position_pk" PRIMARY KEY("project_id","position")
);
--> statement-breakpoint
CREATE TABLE "project_translations" (
	"project_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"tr_status" "translation_state",
	"approved_source_hash" text,
	"approved_at" date,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"country" text NOT NULL,
	"years" text NOT NULL,
	"capacity" text,
	"type" text NOT NULL,
	"overview" text NOT NULL,
	"scope" jsonb NOT NULL,
	"technology" text NOT NULL,
	"results" jsonb,
	"specs" jsonb NOT NULL,
	"seo_meta_title" text,
	"seo_meta_description" text,
	CONSTRAINT "project_translations_project_id_locale_pk" PRIMARY KEY("project_id","locale"),
	CONSTRAINT "project_translations_locale_slug" UNIQUE("locale","slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"position" integer NOT NULL,
	"source_locale" text DEFAULT 'en' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"category_number" text NOT NULL,
	"image_id" uuid NOT NULL,
	"image_position" text,
	"related_technology_id" uuid NOT NULL,
	"og_image_id" uuid,
	"noindex" boolean DEFAULT false NOT NULL,
	CONSTRAINT "projects_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text NOT NULL,
	"status_code" smallint DEFAULT 301 NOT NULL,
	"all_locales" boolean DEFAULT true NOT NULL,
	"source" "redirect_source" DEFAULT 'manual' NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "redirects_key_unique" UNIQUE("key"),
	CONSTRAINT "redirects_from_path_unique" UNIQUE("from_path"),
	CONSTRAINT "redirects_status_code" CHECK ("redirects"."status_code" IN (301, 302)),
	CONSTRAINT "redirects_from_internal" CHECK ("redirects"."from_path" ~ '^/([^/\\[:cntrl:]][^\\[:cntrl:]]*)?$'),
	CONSTRAINT "redirects_to_internal" CHECK ("redirects"."to_path" ~ '^/([^/\\[:cntrl:]][^\\[:cntrl:]]*)?$'),
	CONSTRAINT "redirects_not_self" CHECK ("redirects"."from_path" <> "redirects"."to_path")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"site_name" text NOT NULL,
	"primary_email" text NOT NULL,
	"logo_id" uuid NOT NULL,
	"logo_reversed_id" uuid NOT NULL,
	"footer_background_id" uuid NOT NULL,
	"hq_email" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "settings_key_unique" UNIQUE("key"),
	CONSTRAINT "settings_singleton" CHECK ("settings"."key" = 'settings')
);
--> statement-breakpoint
CREATE TABLE "settings_translations" (
	"settings_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"tr_status" "translation_state",
	"approved_source_hash" text,
	"approved_at" date,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"footer_tagline" text NOT NULL,
	"footer_location" text NOT NULL,
	"copyright" text NOT NULL,
	"footer_background_alt" text NOT NULL,
	"hq_name" text NOT NULL,
	"hq_address_line1" text NOT NULL,
	"hq_address_line2" text NOT NULL,
	"hq_short_address" text NOT NULL,
	"hq_jurisdiction" text NOT NULL,
	"hq_hours" text NOT NULL,
	"default_site_title" text NOT NULL,
	"default_site_description" text NOT NULL,
	CONSTRAINT "settings_translations_settings_id_locale_pk" PRIMARY KEY("settings_id","locale")
);
--> statement-breakpoint
CREATE TABLE "technologies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"position" integer NOT NULL,
	"source_locale" text DEFAULT 'en' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"category_number" text NOT NULL,
	"image_id" uuid NOT NULL,
	"og_image_id" uuid,
	"noindex" boolean DEFAULT false NOT NULL,
	CONSTRAINT "technologies_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "technology_projects" (
	"technology_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"project_id" uuid NOT NULL,
	CONSTRAINT "technology_projects_technology_id_position_pk" PRIMARY KEY("technology_id","position"),
	CONSTRAINT "technology_projects_pair" UNIQUE("technology_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "technology_translations" (
	"technology_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"tr_status" "translation_state",
	"approved_source_hash" text,
	"approved_at" date,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"slug" text NOT NULL,
	"category_title" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text NOT NULL,
	"overview" text NOT NULL,
	"patent_info" jsonb,
	"raw_materials" jsonb NOT NULL,
	"process_principles" jsonb NOT NULL,
	"key_advantages" jsonb NOT NULL,
	"applications" jsonb NOT NULL,
	"products_produced" jsonb NOT NULL,
	"seo_meta_title" text,
	"seo_meta_description" text,
	CONSTRAINT "technology_translations_technology_id_locale_pk" PRIMARY KEY("technology_id","locale"),
	CONSTRAINT "technology_translations_locale_slug" UNIQUE("locale","slug")
);
--> statement-breakpoint
CREATE TABLE "video_translations" (
	"video_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"tr_status" "translation_state",
	"approved_source_hash" text,
	"approved_at" date,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"headline" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "video_translations_video_id_locale_pk" PRIMARY KEY("video_id","locale")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"position" integer NOT NULL,
	"source_locale" text DEFAULT 'en' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"number" text NOT NULL,
	"video_id" uuid NOT NULL,
	"poster_id" uuid NOT NULL,
	CONSTRAINT "videos_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "epcm_stage_translations" ADD CONSTRAINT "epcm_stage_translations_stage_id_epcm_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."epcm_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epcm_stage_translations" ADD CONSTRAINT "epcm_stage_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epcm_stages" ADD CONSTRAINT "epcm_stages_source_locale_locales_code_fk" FOREIGN KEY ("source_locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epcm_stages" ADD CONSTRAINT "epcm_stages_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_translations" ADD CONSTRAINT "media_translations_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_translations" ADD CONSTRAINT "media_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_translations" ADD CONSTRAINT "metric_translations_metric_id_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."metrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_translations" ADD CONSTRAINT "metric_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_translations" ADD CONSTRAINT "office_translations_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_translations" ADD CONSTRAINT "office_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_list_item_translations" ADD CONSTRAINT "page_list_item_translations_item_id_page_list_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."page_list_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_list_item_translations" ADD CONSTRAINT "page_list_item_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_list_items" ADD CONSTRAINT "page_list_items_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_media" ADD CONSTRAINT "page_media_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_media" ADD CONSTRAINT "page_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translations" ADD CONSTRAINT "page_translations_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translations" ADD CONSTRAINT "page_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_source_locale_locales_code_fk" FOREIGN KEY ("source_locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_translations" ADD CONSTRAINT "patent_translations_patent_id_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."patents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_translations" ADD CONSTRAINT "patent_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patents" ADD CONSTRAINT "patents_source_locale_locales_code_fk" FOREIGN KEY ("source_locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patents" ADD CONSTRAINT "patents_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_source_locale_locales_code_fk" FOREIGN KEY ("source_locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_related_technology_id_technologies_id_fk" FOREIGN KEY ("related_technology_id") REFERENCES "public"."technologies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_related_project_id_projects_id_fk" FOREIGN KEY ("related_project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_gallery" ADD CONSTRAINT "project_gallery_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_gallery" ADD CONSTRAINT "project_gallery_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_translations" ADD CONSTRAINT "project_translations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_translations" ADD CONSTRAINT "project_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_source_locale_locales_code_fk" FOREIGN KEY ("source_locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_related_technology_id_technologies_id_fk" FOREIGN KEY ("related_technology_id") REFERENCES "public"."technologies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_logo_reversed_id_media_id_fk" FOREIGN KEY ("logo_reversed_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_footer_background_id_media_id_fk" FOREIGN KEY ("footer_background_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings_translations" ADD CONSTRAINT "settings_translations_settings_id_settings_id_fk" FOREIGN KEY ("settings_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings_translations" ADD CONSTRAINT "settings_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_source_locale_locales_code_fk" FOREIGN KEY ("source_locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_projects" ADD CONSTRAINT "technology_projects_technology_id_technologies_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."technologies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_projects" ADD CONSTRAINT "technology_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_translations" ADD CONSTRAINT "technology_translations_technology_id_technologies_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."technologies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_translations" ADD CONSTRAINT "technology_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_translations" ADD CONSTRAINT "video_translations_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_translations" ADD CONSTRAINT "video_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_source_locale_locales_code_fk" FOREIGN KEY ("source_locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_poster_id_media_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;