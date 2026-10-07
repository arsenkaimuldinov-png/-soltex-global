-- Reference data: the six content languages (order = display order). English is the source
-- language of all current content. Adding a language is a new migration plus site
-- configuration (apps/web/src/i18n/config.ts) — never an admin action.
INSERT INTO "locales" ("code", "position", "is_source") VALUES
  ('en', 1, true),
  ('ru', 2, false),
  ('zh', 3, false),
  ('tr', 4, false),
  ('ar', 5, false),
  ('es', 6, false);
--> statement-breakpoint
-- Reference data is read-only for the application role (when the role exists; see db/provision.sql).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'soltex_app') THEN
    REVOKE INSERT, UPDATE, DELETE ON "locales" FROM soltex_app;
  END IF;
END
$$;
