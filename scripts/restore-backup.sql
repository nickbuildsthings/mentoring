-- Restore helper for managed Supabase Postgres instances (REC-004)
--
-- Why this exists:
-- `pg_restore --disable-triggers` issues `ALTER TABLE ... DISABLE TRIGGER ALL`,
-- which attempts to disable PostgreSQL internal foreign-key constraint triggers
-- (`RI_ConstraintTrigger_*`) and fails on managed Supabase where `postgres` is
-- not a full superuser.
--
-- Instead, disable only USER triggers (`trg_*_ins`, `trg_*_upd`, etc.) before
-- running `pg_restore --data-only` (without `--disable-triggers`), then re-enable
-- USER triggers afterwards. This preserves original `created_by`, `updated_by`,
-- `created_at`, `updated_at`, `archived_at`, and `version` values while keeping
-- foreign-key integrity checks active.

-- Step 1: Run BEFORE `pg_restore --data-only --schema=public`
alter table public.partnerships disable trigger user;
alter table public.partnership_invites disable trigger user;
alter table public.objectives disable trigger user;
alter table public.sessions disable trigger user;
alter table public.session_objectives disable trigger user;
alter table public.session_preparation disable trigger user;
alter table public.actions disable trigger user;
alter table public.progress_updates disable trigger user;
alter table public.progress_update_comments disable trigger user;

-- Step 2: Run `pg_restore --data-only --schema=public -d <connection_string> mentoring-YYYYMMDD.dump`

-- Step 3: Run AFTER `pg_restore` completes
alter table public.partnerships enable trigger user;
alter table public.partnership_invites enable trigger user;
alter table public.objectives enable trigger user;
alter table public.sessions enable trigger user;
alter table public.session_objectives enable trigger user;
alter table public.session_preparation enable trigger user;
alter table public.actions enable trigger user;
alter table public.progress_updates enable trigger user;
alter table public.progress_update_comments enable trigger user;
