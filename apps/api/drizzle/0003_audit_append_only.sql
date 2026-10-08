-- Audit log is append-only (approved architecture §17.2).
-- 1) The application role may only INSERT and SELECT (default privileges also granted
--    UPDATE/DELETE when the table was created; they are revoked here).
-- 2) A trigger refuses UPDATE, DELETE and TRUNCATE for everybody, including the table owner.
--    Retention pruning is possible only through an explicit, reviewed migration that drops and
--    recreates the trigger around the pruning statement.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'soltex_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON "audit_events" FROM soltex_app;
  END IF;
END
$$;
--> statement-breakpoint
CREATE FUNCTION "audit_events_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only (% refused)', TG_OP USING ERRCODE = 'insufficient_privilege';
END
$$;
--> statement-breakpoint
CREATE TRIGGER "audit_events_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION "audit_events_append_only"();
--> statement-breakpoint
CREATE TRIGGER "audit_events_no_truncate"
  BEFORE TRUNCATE ON "audit_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_events_append_only"();
