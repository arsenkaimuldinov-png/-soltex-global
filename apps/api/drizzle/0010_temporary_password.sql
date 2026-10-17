-- Phase M-1: initial passwords given by an Owner or Admin are temporary (ASVS 4.0.3 §2.3.1;
-- docs/admin-auth.md §2). Additive: existing users keep their passwords (false).
-- Rollback: drop the column.
ALTER TABLE "users" ADD COLUMN "password_temporary" boolean DEFAULT false NOT NULL;
