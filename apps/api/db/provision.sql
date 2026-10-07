-- =============================================================================
-- Soltex Global: one-time database provisioning (approved architecture §17.1).
-- Run ONCE per environment as a PostgreSQL superuser, with passwords passed as psql variables
-- (never commit real passwords):
--
--   psql -h <host> -U postgres -v ON_ERROR_STOP=1 \
--        -v dbname=soltex \
--        -v migrate_password='…' -v app_password='…' -v backup_password='…' \
--        -f apps/api/db/provision.sql
--
-- Roles:
--   soltex_migrate  owns the database and schema; used ONLY by `npm run db:migrate` on deploy
--   soltex_app      application (API + worker): data read/write, no CREATE / ALTER / DROP / TRUNCATE
--   soltex_backup   logical backups: read-only (pg_read_all_data)
-- =============================================================================

CREATE ROLE soltex_migrate LOGIN PASSWORD :'migrate_password';
CREATE ROLE soltex_app LOGIN PASSWORD :'app_password';
CREATE ROLE soltex_backup LOGIN PASSWORD :'backup_password';

CREATE DATABASE :"dbname" OWNER soltex_migrate ENCODING 'UTF8' TEMPLATE template0;

\connect :"dbname"

REVOKE ALL ON DATABASE :"dbname" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"dbname" TO soltex_app, soltex_backup;

-- The public schema belongs to the migration role; nobody else may create objects in it.
ALTER SCHEMA public OWNER TO soltex_migrate;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO soltex_app, soltex_backup;

-- Every table and sequence the migration role creates is readable and writable by the app,
-- but only through DML (no TRUNCATE, REFERENCES, TRIGGER).
ALTER DEFAULT PRIVILEGES FOR ROLE soltex_migrate IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO soltex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE soltex_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO soltex_app;

GRANT pg_read_all_data TO soltex_backup;

-- Safety: the app role can never become a superuser-like role by accident.
ALTER ROLE soltex_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE soltex_backup NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
