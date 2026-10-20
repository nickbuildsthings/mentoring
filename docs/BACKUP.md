# Backup and restoration (TECH-09)

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
`auth.users` is not in this dump. Supabase's own backups cover it; for the manual route, re-create the two users and re-run `supabase/provision.example.sql`, then restore data keyed on the original user IDs (see below).

## Restore verification (do this once before live use, and after schema changes)
1. Create a scratch Supabase project, apply `supabase/migrations/*`.
2. Create two users, then insert matching `profiles` rows **with the original user UUIDs** (or remap `created_by`/`updated_by`/`archived_by`).
3. `pg_restore --data-only --disable-triggers --schema=public -d <scratch> mentoring.dump`
   (`--disable-triggers` stops audit stamping from overwriting restored attribution and versions).
4. Sign in as each user: confirm objective, session, action and progress counts match, and run `npm run test:access` against the scratch project.
5. Record the date and result in the table above.

Backups contain mentoring content: encrypt them, restrict access to the two participants (or whoever they authorise), and delete scratch projects after testing.
