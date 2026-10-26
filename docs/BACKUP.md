# Backup and restoration (TECH-09 / REC-004)

User exports are **not** backups. Before live use, confirm and record the following.

## Arrangements
| Item | Decision / evidence |
|---|---|
| Supabase plan | Free projects have **no** automated backups. Use Pro (daily backups, 7-day retention) or the manual routine below. Record the plan: ______ |
| Point-in-time recovery | Optional paid add-on. Enabled? ______ |
| Manual logical backup | Weekly `pg_dump` (below), stored encrypted outside Supabase and Vercel |
| Backup owner / frequency | ______ |
| Last restore test date | ______ |

## Manual backup (data and schema, no credentials in the repo)
Get the connection string from Supabase > Project Settings > Database (use the session pooler on IPv4-only networks).
```powershell
$env:PGPASSWORD = "<db password>"
pg_dump "postgresql://postgres.<ref>@<host>:5432/postgres" --schema=public --no-owner --format=custom --file=mentoring-$(Get-Date -Format yyyyMMdd).dump
```
`auth.users` is not in this dump. Supabase's own backups cover it; for the manual route, re-create the users in `auth.users` (or preserve their UUIDs via the Admin API / SQL editor), then restore `public` data keyed on the original user IDs (see below).

## Restore verification on managed Supabase (REC-004)
> **Important:** Do **not** pass `--disable-triggers` to `pg_restore` against a managed Supabase database. `pg_restore --disable-triggers` issues `ALTER TABLE ... DISABLE TRIGGER ALL`, which attempts to disable PostgreSQL system foreign-key triggers (`RI_ConstraintTrigger_*`) and fails because the managed `postgres` role is not a superuser.Instead, disable only `USER` triggers using `scripts/restore-backup.sql`.

1. Create a scratch Supabase project and apply `supabase/migrations/*` in order.
2. Create the users in `auth.users` with their original UUIDs (or remap `mentor_id`, `mentee_id`, `created_by`, `updated_by`, and `archived_by`), and insert matching `public.profiles` rows.
3. Disable user audit/version triggers before restoring data (see Step 1 of `scripts/restore-backup.sql`):
   ```sql
   alter table public.partnerships disable trigger user;
   alter table public.partnership_invites disable trigger user;
   alter table public.objectives disable trigger user;
   alter table public.sessions disable trigger user;
   alter table public.session_objectives disable trigger user;
   alter table public.session_preparation disable trigger user;
   alter table public.actions disable trigger user;
   alter table public.progress_updates disable trigger user;
   alter table public.progress_update_comments disable trigger user;
   ```
4. Restore the data **without** `--disable-triggers` (in table dependency order: `partnerships`, `objectives`, `sessions`, `session_objectives`, `session_preparation`, `actions`, `progress_updates`, `progress_update_comments`):
   ```powershell
   pg_restore --data-only --schema=public -d "postgresql://postgres.<ref>@<host>:5432/postgres" mentoring-YYYYMMDD.dump
   ```
5. Re-enable user triggers immediately after the restore completes (Step 3 of `scripts/restore-backup.sql`):
   ```sql
   alter table public.partnerships enable trigger user;
   alter table public.partnership_invites enable trigger user;
   alter table public.objectives enable trigger user;
   alter table public.sessions enable trigger user;
   alter table public.session_objectives enable trigger user;
   alter table public.session_preparation enable trigger user;
   alter table public.actions enable trigger user;
   alter table public.progress_updates enable trigger user;
   alter table public.progress_update_comments enable trigger user;
   ```
6. Sign in as each user: confirm partnership, objective, session, action, and progress counts match, and run `npm run test:access` against the scratch project.
7. Record the date and result in the table above.

Backups contain confidential mentoring content: encrypt them at rest, restrict access to authorised participants, and delete scratch projects immediately after testing.
