# Setup and deployment

## 1. Supabase
1. Create a project (choose a UK/EU region).
2. **Authentication > Providers > Email**: enable email/password.
   - Keep public sign-up disabled unless you want invited mentees to self-register before claiming an invite code (even if sign-up is enabled, uninvited accounts have zero read/write access under Row-Level Security until they claim a valid one-time mentor invite code).
   - Enable leaked-password protection and set a minimum password length of 12.
3. **Authentication > Users**: create the mentor account (and optionally the first mentee account) with strong, separate passwords.
4. Apply migrations from `supabase/migrations/` in order (`20260419000000_init.sql`, then `20261023000000_v2_multi_mentee_and_features.sql`) via the SQL editor or `supabase db push`.
5. Run `supabase/provision.example.sql` in the SQL editor to register the mentor (and optionally the first mentee and partnership).
6. **Onboarding additional mentees (in-app)**:
   - Once signed in as a mentor, click **`+ Mentee`** in the top header.
   - Enter the new mentee's name (and optional focus area) to create an isolated partnership workspace and generate a one-time invite code (`MNT-XXXX-XXXX`).
   - Invite or create the mentee's user in **Supabase > Authentication > Users**, share the invite code with them, and when they sign in they will be prompted to enter the invite code to join their partnership workspace.
7. **Authentication > URL configuration**: set the **Site URL** and **Redirect URLs** to the Vercel production URL so password recovery links (`PASSWORD_RECOVERY`) open directly into the in-app password change dialog.

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
npm test              # unit tests (time zone, overdue, links, ICS calendar, export, portfolio)
npm run typecheck
npm run test:db       # migrations + multi-mentee RLS isolation tests on a throwaway local Postgres
```
Live API access test (TECH-12), against a staging project with an approved member and an unapproved outsider user:
```powershell
$env:SUPABASE_URL="https://xxxx.supabase.co"; $env:SUPABASE_ANON_KEY="..."
$env:MEMBER_EMAIL="..."; $env:MEMBER_PASSWORD="..."; $env:OUTSIDER_EMAIL="..."; $env:OUTSIDER_PASSWORD="..."
npm run test:access
```

## 5. Account security, recovery and exceptional deletion
- **In-app password change & recovery**: Users can change their password at any time from the **Account** button in the header. When an admin sends a recovery email from **Supabase > Authentication > Users > Send recovery**, clicking the link opens the app Directly into the **Choose a new password** screen.
- **Two-factor authentication (TOTP MFA)**: Users can enroll an authenticator app from the **Account** dialog in the header.
- **Exceptional hard-deletion**: Hard-deleting a record is intentionally not possible from the app. Use the SQL editor (service role) and delete children before parents (`progress_update_comments`, `actions`, `progress_updates`, `session_preparation`, and `session_objectives` before `sessions` / `objectives` / `partnerships`). Note that `profiles` foreign keys use `ON DELETE RESTRICT`, so deleting a user from `auth.users` is blocked while they still own mentoring records.
