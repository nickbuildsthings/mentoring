# Setup and deployment

## 1. Supabase
1. Create a project (choose a UK/EU region).
2. **Authentication > Providers > Email**: enable email/password. **Disable "Allow new users to sign up"** (AUTH: no public registration). Consider enabling leaked-password protection and a minimum password length of 12.
3. **Authentication > Users**: create the two accounts (mentor and mentee) with strong, separate passwords.
4. Apply migrations from `supabase/migrations/` in order (SQL editor, or `supabase db push` with the CLI).
5. Edit and run `supabase/provision.example.sql` to register the two accounts as the mentor and the mentee.
   Only registered accounts can read or write anything; even if signup were accidentally enabled, a stranger would see no data.
6. **Authentication > URL configuration**: set the Site URL to the Vercel production URL.

## 2. Vercel
1. Import `nickbuildsthings/mentoring`; framework preset Vite (settings are in `vercel.json`, which also sets security headers and the SPA rewrite).
2. Environment variables (Production and Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — the **anon** key only.
   The service-role key must never be added to Vercel or to any `VITE_*` variable.
3. Deploy. If your Supabase project URL is not `*.supabase.co`, add it to `connect-src` in `vercel.json`.

## 3. Local development
```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```
Use a separate Supabase project (or the Supabase CLI local stack) with **synthetic data only**.

## 4. Tests
```powershell
npm test              # unit tests (time zone, overdue, links, export)
npm run typecheck
npm run test:db       # migrations + RLS tests on a throwaway local Postgres (needs Postgres server binaries; use WSL or CI on Windows)
```
Live API access test (TECH-12), against a staging project with two approved users and one extra, unapproved user:
```powershell
$env:SUPABASE_URL="https://xxxx.supabase.co"; $env:SUPABASE_ANON_KEY="..."
$env:MEMBER_EMAIL="..."; $env:MEMBER_PASSWORD="..."; $env:OUTSIDER_EMAIL="..."; $env:OUTSIDER_PASSWORD="..."
npm run test:access
```

## 5. Account recovery and exceptional deletion (admin)
- Password reset: Supabase dashboard > Authentication > Users > the user > send recovery / set password.
- Hard-deleting a record is intentionally not possible from the app. Use the SQL editor (service role) and delete children before parents (actions, progress updates, preparation and session links before sessions/objectives).
