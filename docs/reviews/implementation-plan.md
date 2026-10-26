# Implementation Plan — Mentoring Workspace v2 (Multi-Mentee & Enriched Mentoring Lifecycle)

## 1. Provenance and traceability

- **Source review artifact:** [docs/reviews/application-review.md](file:///c:/Users/nicke/Documents/antigravity/epic-hertz/docs/reviews/application-review.md)
- **Plan date:** 2026-10-23
- **Accepted scope:** All 21 recommendations (`REC-001` through `REC-021`) marked **Accepted** in the Review Decision Log.
- **Core design principles preserved:**
  - Zero extra paid infrastructure or third-party backend dependencies (runs entirely on static Vite/Vercel + Supabase PostgreSQL/Auth/RLS).
  - Strict default-deny Row-Level Security (`FORCE ROW LEVEL SECURITY`) with server-side attribution (`stamp_row`) and optimistic concurrency (`version`).
  - Complete tenant isolation between mentoring partnerships: a mentee in Partnership A can never read, write, or infer the existence of Partnership B or Mentee B.

---

## 2. Resolved design decisions (Open questions resolution)

To ensure deterministic implementation without external service bottlenecks, the open questions from the review are resolved as follows:

1. **Multi-mentee & multi-partnership model (`REC-014`, `REC-019`):**
   - **Data model:** Introduce `public.partnerships` with `mentor_id` and `mentee_id`. Any user in `public.profiles` can be the mentor in multiple partnerships (supporting your primary goal of mentoring multiple people) and can also be a mentee in another partnership if desired.
   - **Zero-infrastructure in-app onboarding:** A mentor can create a new partnership in-app by entering a mentee's name (and optional email) to generate an **Invitation Code / Link** (`public.partnership_invites`). When the new mentee signs in (either via an account created for them with a temporary password or via self-signup with an invite code), calling the `public.claim_partnership_invite(code)` `SECURITY DEFINER` RPC automatically creates their `profiles` row (if needed) and binds them as `mentee_id` on that partnership—requiring zero manual SQL in the Supabase dashboard.
2. **Password provisioning & recovery (`REC-001`, `REC-013`):**
   - Enable `detectSessionInUrl: true` in `src/lib/supabase.ts` and handle the `PASSWORD_RECOVERY` event in `src/auth/AuthProvider.tsx` so Supabase recovery emails work as documented in `docs/SETUP.md`.
   - Add an in-app **Account & Security (`Change password` + optional `TOTP MFA`)** modal accessible from the top bar so any participant given a temporary password can immediately set a private password and optionally enroll a TOTP authenticator app (`REC-013`).
3. **Privacy & soft-archive vs. hard-delete (`REC-010`, `REC-017`):**
   - Preserve the non-destructive audit trail (`archived_at`) on core records while allowing authors of `progress_updates` and `progress_update_comments` to edit/clear accidental sensitive text and ensuring archived items are hidden from default views and excluded from the new **Development Portfolio** export (`REC-021`).

---

## 3. Traceability matrix (`REC-001` – `REC-021`)

| ID | Title | Phase | Primary Files Affected |
|---|---|---|---|
| **REC-001** | In-app password change & working `PASSWORD_RECOVERY` flow | Phase 3 | `src/lib/supabase.ts`, `src/auth/AuthProvider.tsx`, `src/components/AccountModal.tsx`, `docs/SETUP.md` |
| **REC-002** | Fix Review Workspace date auto-save race & expose `closing_summary` | Phase 4 | `src/pages/SessionDetail.tsx` |
| **REC-003** | Atomic session + objective-link saving & fix `useEditor` self-conflict flash | Phase 2 & 3 | `supabase/migrations/20261023000000_v2_multi_mentee_and_features.sql`, `src/components/useEditor.tsx`, `src/data/api.ts`, `src/pages/SessionDetail.tsx` |
| **REC-004** | Fix `docs/BACKUP.md` restore procedure for managed Supabase permissions & FK order | Phase 6 | `docs/BACKUP.md`, `scripts/restore-backup.sql` |
| **REC-005** | Reconcile package versions in `package.json` / `package-lock.json` & add GitHub Actions CI | Phase 1 & 6 | `package.json`, `package-lock.json`, `.github/workflows/ci.yml` |
| **REC-006** | Distinguish transient network/query errors from `unauthorised` in `AuthProvider` | Phase 3 | `src/auth/AuthProvider.tsx`, `src/App.tsx`, `src/pages/SignIn.tsx` |
| **REC-007** | Validate reflection combined length & 10-link cap client-side; preserve draft text on type switch | Phase 5 | `src/components/UpdateDialog.tsx`, `src/lib/links.ts`, `src/lib/links.test.ts` |
| **REC-008** | Include unlinked open actions in Session view & expand search to session notes/progress content | Phase 4 & 5 | `src/pages/SessionDetail.tsx`, `src/pages/SessionsPage.tsx`, `src/pages/ProgressPage.tsx`, `src/pages/ActionsPage.tsx`, `src/lib/export.ts` |
| **REC-009** | Show complete field diffs in `ConflictBanner` & sync archive/activate buttons with `useEditor` | Phase 3 & 5 | `src/components/ui.tsx`, `src/pages/ObjectiveDetail.tsx`, `src/pages/SessionDetail.tsx`, `src/components/ActionDialog.tsx`, `src/components/UpdateDialog.tsx` |
| **REC-010** | Harden schema edge cases (`valid_links` NULL check, `session_objectives` trigger, `profiles` FK, London `current_date`) | Phase 2 | `supabase/migrations/20261023000000_v2_multi_mentee_and_features.sql`, `supabase/tests/access.sql` |
| **REC-011** | Use native `<dialog>` for unsaved-changes route blocker (`guard`) | Phase 3 | `src/components/useEditor.tsx`, `src/styles.css` |
| **REC-012** | Optimise data fetching, pagination tie-breakers, cache `staleTime`, and export cache reuse | Phase 3 & 6 | `src/main.tsx`, `src/data/api.ts`, `src/data/hooks.ts`, `src/pages/ExportPage.tsx` |
| **REC-013** | Client-side `.ics` calendar invite download on sessions & optional TOTP MFA enrollment | Phase 3 & 4 | `src/lib/ics.ts`, `src/lib/ics.test.ts`, `src/pages/SessionDetail.tsx`, `src/components/AccountModal.tsx`, `src/auth/AuthProvider.tsx` |
| **REC-014** | Multi-mentee & multi-partnership tenancy model, per-partnership RLS isolation, Mentee Switcher, Mentor Overview & in-app onboarding | Phase 2 & 3 | `supabase/migrations/20261023000000_v2_multi_mentee_and_features.sql`, `supabase/tests/access.sql`, `src/auth/PartnershipContext.tsx`, `src/components/Layout.tsx`, `src/pages/MentorOverview.tsx`, `src/components/OnboardMenteeModal.tsx` |
| **REC-015** | Restructure `SessionDetail` into stage-aware Facilitation & Agenda workspace with post-session wrap-up | Phase 4 | `src/pages/SessionDetail.tsx`, `src/pages/Overview.tsx` |
| **REC-016** | Surface partner-blocked actions and support requests prominently on `Overview` and `SessionDetail` | Phase 4 | `src/pages/Overview.tsx`, `src/pages/SessionDetail.tsx` |
| **REC-017** | Two-way coaching dialogue on Progress Updates (partner comments & "Discuss in next session" flag) | Phase 2 & 5 | `supabase/migrations/20261023000000_v2_multi_mentee_and_features.sql`, `src/components/UpdateList.tsx`, `src/pages/SessionDetail.tsx`, `src/lib/types.ts` |
| **REC-018** | Structured coaching prompts across all `ProgressUpdate` types & one-click Action-to-Evidence promotion | Phase 5 | `src/components/UpdateDialog.tsx`, `src/components/ActionDialog.tsx` |
| **REC-019** | Shared Mentoring Charter / Working Agreement & guided 3-step first-run onboarding per partnership | Phase 2 & 4 | `supabase/migrations/20261023000000_v2_multi_mentee_and_features.sql`, `src/pages/Overview.tsx`, `src/components/CharterPanel.tsx` |
| **REC-020** | Deepen Objectives with milestones, confidence/progress trajectory, stalled alerts (>30d), and unified Story Timeline | Phase 2 & 5 | `supabase/migrations/20261023000000_v2_multi_mentee_and_features.sql`, `src/pages/ObjectiveDetail.tsx`, `src/pages/Overview.tsx`, `src/pages/ObjectivesPage.tsx` |
| **REC-021** | Enrich Progress Review Workspace with "Since last review" synthesis & add "Development Portfolio" export mode | Phase 4 & 6 | `src/pages/SessionDetail.tsx`, `src/lib/export.ts`, `src/lib/export.test.ts`, `src/pages/ExportPage.tsx` |

---

## 4. Phased implementation breakdown

### Phase 1: Toolchain & Dependency Verification (`REC-005`)
- **Goal:** Ensure `package.json` and `package-lock.json` resolve cleanly against the public npm registry so `npm run typecheck`, `npm test`, and `npm run build` can run deterministically after every subsequent phase.
- **Tasks:**
  1. Reconcile declared semver ranges in `package.json` (`typescript`, `vite`, `vitest`, `@vitejs/plugin-react`, `@types/node`, `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `@supabase/supabase-js`) with real published npm versions and regenerate `package-lock.json`.
  2. Run `npm test` and `npm run typecheck` to establish a green baseline before making schema or code changes.

---

### Phase 2: Database Schema Evolution, Multi-Mentee RLS & Atomic RPCs (`REC-014`, `REC-010`, `REC-003`, `REC-017`, `REC-019`, `REC-020`)
- **Goal:** Evolve the PostgreSQL schema via a new additive migration (`supabase/migrations/20261023000000_v2_multi_mentee_and_features.sql`) that preserves backward compatibility for existing data while unlocking multi-mentee partnerships, strict per-partnership RLS isolation, and enriched domain fields.
- **Schema changes in `supabase/migrations/20261023000000_v2_multi_mentee_and_features.sql`:**
  1. **Profiles & Multi-Mentee Partnerships (`REC-014`, `REC-010`, `REC-019`):**
     - Drop the global `profiles_role_key` (`UNIQUE(role)`) constraint on `public.profiles` so multiple mentees (and mentors) can exist. Keep `role` on `profiles` as the user's primary/default role (`mentor` or `mentee`) and change `profiles.id references auth.users(id)` to `ON DELETE RESTRICT` (`REC-010`).
     - Create `public.partnership_status as enum ('pending', 'active', 'paused', 'completed')`.
     - Create `public.partnerships`:
       - `id uuid primary key default gen_random_uuid()`
       - `mentor_id uuid not null references public.profiles(id) on delete restrict`
       - `mentee_id uuid references public.profiles(id) on delete restrict` (nullable while an invite is `pending`)
       - `mentee_Working_name text not null check (char_length(btrim(mentee_display_name)) between 1 and 80)`
       - `title text check (char_length(title) <= 200)` (e.g., `"Leadership Transition 2026"`)
       - `status public.partnership_status not null default 'active'`
       - **Mentoring Charter fields (`REC-019`):** `purpose text check (char_length(purpose) <= 5000)`, `meeting_cadence text check (char_length(meeting_cadence) <= 500)`, `working_agreement text check (char_length(working_agreement) <= 5000)`, `review_horizon date`
       - Standard `stamp_row()` audit/version columns (`created_at`, `created_by`, `updated_at`, `updated_by`, `version`, `archived_at`, `archived_by`).
     - Auto-backfill: If `public.profiles` already has a mentor and mentee from v1, automatically insert a default `partnerships` row linking them and backfill `partnership_id` on any existing rows.
     - Create `public.partnership_invites` + `SECURITY DEFINER` RPCs `public.create_mentee_partnership(...)` and `public.claim_partnership_invite(invite_code text, display_name text)` so mentors can onboard new mentees directly in-app (`REC-014`).
  2. **Per-Partnership Tenant Isolation (`REC-014`):**
     - Add `partnership_id uuid not null references public.partnerships(id) on delete restrict` (indexed) to `objectives`, `sessions`, `actions`, and `progress_updates`.
     - Create `public.is_partnership_member(p_id uuid) returns boolean security definer set search_path = ''` checking that `(select auth.uid())` is `mentor_id` or `mentee_id` on `public.partnerships where id = p_id`.
     - Update RLS policies on `objectives`, `sessions`, `actions`, `progress_updates`, `session_preparation` (via `session_id`), `session_objectives` (via `session_id`), and `profiles` (a user can read their own profile and profiles of partners they share a `partnerships` row with—never other mentees!).
  3. **Schema Hardening & Atomic Session Save (`REC-010`, `REC-003`):**
     - Fix `public.valid_links(links text[])` so `NULL` elements are rejected (`l is not null and l ~* '^https?://...'`).
     - Add a `BEFORE INSERT` trigger on `public.session_objectives` enforcing `new.created_by := auth.uid()`, `new.created_at := now()`, and verifying the linked `objective_id` belongs to the same `partnership_id` as `session_id`.
     - Change `progress_updates.occurred_on` default to `(now() at time zone 'Europe/London')::date`.
     - Add `public.save_session_with_objectives(...)` RPC (or transactional helper) so updating a session and its `session_objectives` links happens atomically (`REC-003`).
  4. **Enriched Mentoring Domain Fields (`REC-017`, `REC-020`):**
     - On `public.objectives` (`REC-020`):
       - Add `progress_stage text not null default 'starting' check (progress_stage in ('starting', 'building', 'confident', 'embedded'))`
       - Add `milestones jsonb not null default '[]'::jsonb check (jsonb_typeof(milestones) = 'array' and jsonb_array_length(milestones) <= 30)` (storing `[{ id, text, done }]`).
     - On `public.progress_updates` & `public.progress_update_comments` (`REC-017`):
       - Add `discuss_next boolean not null default false` and `action_id uuid references public.actions(id) on delete set null` on `public.progress_updates`.
       - Create `public.progress_update_comments` (`id`, `update_id`, `partnership_id`, `content`, plus `stamp_row()` columns) with RLS allowing both partnership members to read/insert and only the comment author (`created_by = auth.uid()`) to update/archive.
  5. **Database RLS Test Suite Update (`supabase/tests/access.sql`, `scripts/test-access.mjs`):**
     - Update `supabase/tests/access.sql` to test:
       - Mentor + Mentee A in Partnership 1, and Mentor + Mentee B in Partnership 2.
       - Strict isolation: Mentee A cannot read or write Mentee B's profile, partnership, objectives, sessions, preparations, actions, updates, or comments.
       - `valid_links(array[null::text])` rejection and `session_objectives.created_by` spoof prevention.

---

### Phase 3: Auth Resilience, Account Security, Multi-Mentee Context & Editor Hardening (`REC-001`, `REC-003`, `REC-006`, `REC-009`, `REC-011`, `REC-012`, `REC-013`, `REC-014`)
- **Goal:** Upgrade the front-end core (`supabase.ts`, `AuthProvider.tsx`, `PartnershipContext.tsx`, `useEditor.tsx`, `ui.tsx`, `Layout.tsx`) to support multi-mentee switching, onboarding, password changes/recovery, TOTP MFA, and rock-solid editor concurrency.
- **Tasks:**
  1. **Auth & Account Security (`REC-001`, `REC-006`, `REC-013`):**
     - Enable `detectSessionInUrl: true` in `src/lib/supabase.ts`.
     - In `src/auth/AuthProvider.tsx`, distinguish transient network/database errors (`status: 'error'` with a "Try again" button) from `!error && !data` (`status: 'unauthorised'` / invite-claim screen), and detect `PASSWORD_RECOVERY` events (`REC-001`, `REC-006`).
     - Create `src/components/AccountModal.tsx` (accessible from the top bar and automatically opened on `PASSWORD_RECOVERY`) allowing users to change their password (`supabase.auth.updateUser({ password })`) and optionally enroll/verify TOTP MFA (`supabase.auth.mfa`) (`REC-001`, `REC-013`).
     - Update `NoAccess` in `src/pages/SignIn.tsx` to include an **"Have an invitation code?"** form so a newly invited mentee can enter their invite code and immediately join their partnership (`REC-014`).
  2. **Multi-Mentee Partnership Context, Switcher & Onboarding UI (`REC-014`):**
     - Create `src/auth/PartnershipContext.tsx` holding the user's partnerships, the active `partnershipId` (persisted in `sessionStorage` / URL), the active user's role in that partnership (`mentor` or `mentee`), and whether "All Mentees (Mentor Overview)" mode is selected.
     - Scope all React Query hooks in `src/data/hooks.ts` by `partnershipId` (`queryKey: [table, partnershipId]`) and configure deterministic pagination ordering (`.order(orderBy).order('id')`) and sensible `staleTime` (`30_000` ms) (`REC-012`).
     - Update `src/components/Layout.tsx` to show:
       - A **Mentee / Partnership Switcher** pill/dropdown when the user has multiple partnerships (or is a mentor), including an **"All Mentees"** overview option and a **"+ Onboard Mentee"** button (`src/components/OnboardMenteeModal.tsx`).
       - An **"Account"** button opening `AccountModal` (`Change password` / `MFA`).
  3. **Editor Concurrency & Accessibility Hardening (`REC-003`, `REC-009`, `REC-011`):**
     - In `src/components/useEditor.tsx`, track an `inFlightSaveRef` and update `baseRef.current` and `baselineRef.current` before `invalidateQueries` triggers component re-renders so a user's own save never flashes a false self-conflict (`REC-003`).
     - Replace the `<div className="modal-backdrop">` route blocker in `src/components/useEditor.tsx` with a native `<dialog>` element so focus is trapped and `Escape` cancels navigation (`REC-011`).
     - Update `ConflictBanner` in `src/components/ui.tsx` to accept the user's current draft alongside the conflicting record and display all fields where the partner's value differs from the baseline/draft (explicitly showing `(cleared)` when a partner emptied a field) (`REC-009`).

---

### Phase 4: Overview, Contracting Charter, Stage-Aware Sessions & Review Synthesis (`REC-002`, `REC-008`, `REC-013`, `REC-014`, `REC-015`, `REC-016`, `REC-019`, `REC-021`)
- **Goal:** Transform the `Overview` and `SessionDetail` pages into rich, facilitative mentoring workspaces.
- **Tasks:**
  1. **Cross-Mentee Mentor Overview (`REC-014`):**
     - Create `src/pages/MentorOverview.tsx` (shown when a mentor selects *"All Mentees"* or from a toggle on `Overview`): shows cards for each active mentee partnership with their next session, preparation status, any `blocked` or `overdue` actions needing mentor attention, stalled objectives, and a button to onboard a new mentee.
  2. **Partnership Overview, Blocked-Action Alerts & Mentoring Charter (`REC-016`, `REC-019`, `REC-020`):**
     - On `src/pages/Overview.tsx`:
       - When a partnership is new (no charter/objectives/sessions yet), display a welcoming **3-Step Getting Started & Contracting Guide** (`1. Agree your Mentoring Charter → 2. Propose initial Objectives → 3. Plan your first Session`) (`REC-019`).
       - Add `src/components/CharterPanel.tsx` (viewable/editable from `Overview`) capturing the partnership's `purpose`, `meeting_cadence`, `working_agreement`, and `review_horizon` (`REC-019`).
       - Add a prominent **Blocked / Support Needed Banner** above the action list whenever *either* partner has a `blocked` action, showing the `blocked_note` even when the action filter is set to `Mine` (`REC-016`).
       - Badge active objectives on `Overview` when their `review_date` has passed or when they have had no activity (session, action, or update) in >30 days (`REC-020`).
  3. **Stage-Aware `SessionDetail`, `.ics` Calendar Invite & Post-Session Wrap-Up (`REC-002`, `REC-008`, `REC-013`, `REC-015`, `REC-021`):**
     - In `src/pages/SessionDetail.tsx`:
       - **Calendar export (`REC-013`):** Add a **"Download calendar invite (.ics)"** button (`src/lib/ics.ts`) on saved sessions.
       - **Stage-aware Facilitation layout (`REC-015`, `REC-008`):** For `planned` sessions (and when arriving via `#prep` from `Overview`), place **Preparation (Mentor & Mentee side-by-side)** and **Items to Check in This Session** (all open actions created before this session—including those without a `session_id` per `REC-008`—plus any `progress_updates` flagged `discuss_next = true` per `REC-017`) directly above the session notes, with a one-click **"Seed discussion notes from preparation"** button.
       - **Post-Session Wrap-Up (`REC-015`):** When `status === 'completed'`, show a **Session Wrap-Up** card prompting to (a) add agreed actions, (b) log an achievement/evidence, and (c) click **"Schedule next session"** (creating/opening a new session pre-linked to the active objectives).
       - **Enriched Review Workspace (`REC-002`, `REC-021`):**
         - Add a **"Since Last Review"** synthesis card counting sessions completed, actions completed, objectives achieved, and updates (including reflections!) logged since the previous review session.
         - Fix `ReviewObjective` (`REC-002`) so editing `review_date` saves on blur / explicit Save button rather than firing concurrent mutations on every keystroke, and reveal the `closing_summary` textarea when `status` is set to `achieved` or `closed`.
  4. **Expanded Session Search (`REC-008`):**
     - In `src/pages/SessionsPage.tsx`, search across `title`, `discussion_notes`, `outcomes`, and `location`.

---

### Phase 5: Deepened Objectives, Two-Way Progress Updates & Action Promotion (`REC-007`, `REC-008`, `REC-009`, `REC-017`, `REC-018`, `REC-020`)
- **Goal:** Make Objectives tell a chronological development story and make Progress Updates & Actions interactive and well-scaffolded.
- **Tasks:**
  1. **Objectives: Milestones, Confidence Trajectory & Unified Story Timeline (`REC-009`, `REC-020`):**
     - In `src/pages/ObjectiveDetail.tsx`:
       - Make the *"Agree and activate"* button on proposed objectives save immediately when the form has no other unsaved changes, and sync the *Archive/Restore* button with `useEditor` so archiving never triggers a false conflict (`REC-009`).
       - Add the **Progress / Confidence Stage** selector (`Starting out` → `Building capability` → `Confident` → `Embedded`) and an interactive **Milestones / Observable Checkpoints** checklist (`milestones` JSONB array) (`REC-020`).
       - Add a view toggle between **Sections** (`Actions`, `Updates`, `Sessions`) and a unified chronological **Objective Story Timeline** that interleaves creation, sessions where the objective was covered, completed actions, and reflections/evidence/feedback (`REC-020`).
  2. **Progress Updates: Two-Way Coaching Responses, Structured Prompts & Search (`REC-007`, `REC-008`, `REC-017`, `REC-018`):**
     - In `src/components/UpdateDialog.tsx` (`REC-007`, `REC-018`):
       - Provide structured coaching prompt fields for all four update types (`reflection`, `evidence`, `feedback`, `achievement`), parse saved headings back into structured fields when editing an existing update, and preserve entered prompt text if the user switches the `Type` dropdown before saving.
       - Enforce client-side validation for `<= 10` links (`src/lib/links.ts`) and `<= 20,000` combined characters with clear inline feedback.
       - Add a **"Flag to discuss in next session"** (`discuss_next`) checkbox.
     - In `src/components/UpdateList.tsx` (`REC-017`):
       - Display a **"Discuss next session"** badge/toggle on updates.
       - Render attributed **Coaching Responses / Comments** (`progress_update_comments`) beneath each update with an inline *"Add response / coaching question"* form so the mentor and mentee can converse on any reflection or piece of evidence.
     - In `src/pages/ProgressPage.tsx` (`REC-008`):
       - Add a keyword search input filtering across update `content` and comment text.
  3. **Action Completion Note & One-Click Promotion to Evidence (`REC-018`):**
     - In `src/components/ActionDialog.tsx`, when clicking **"Mark complete"** on an action card in `ActionList`, open a quick **Complete Action** modal where the user can jot an optional `completion_note` and check **"Also record this as Evidence / Achievement on Progress"** (automatically creating a linked `progress_updates` entry).

---

### Phase 6: Curated Portfolio Export, Backup Runbook & CI Pipeline (`REC-004`, `REC-005`, `REC-008`, `REC-012`, `REC-021`)
- **Goal:** Deliver the shareable Development Portfolio export, fix the managed-Supabase backup restore documentation/script, and add automated CI verification.
- **Tasks:**
  1. **Development Portfolio Export & Cache Reuse (`REC-008`, `REC-012`, `REC-021`):**
     - Update `src/lib/export.ts` and `src/pages/ExportPage.tsx`:
       - Reuse `queryClient.fetchQuery` scoped to the active `partnershipId` (`REC-012`).
       - Include session-linked `progress_updates`, `progress_update_comments`, `partnerships` Charter metadata, and `session_preparation` counts in the Full Mentoring Record export (`REC-008`, `REC-017`, `REC-019`).
       - Add a **"Download Development Portfolio (Shareable Markdown)"** button (`buildPortfolioMarkdown` in `src/lib/export.ts`) that exports a clean, professional summary of the Mentoring Charter, Objectives (with progress stage, milestones, and closing summaries), Achievements, Evidence, Feedback, and Completed Actions—excluding raw session `discussion_notes`, personal `difficulties`, `blocked_note`s, and archived items (`REC-021`).
  2. **Managed-Supabase Backup & Restore Procedure (`REC-004`):**
     - Update `docs/BACKUP.md` and add `scripts/restore-backup.sql` documenting how to disable *user* triggers (`ALTER TABLE ... DISABLE TRIGGER USER` rather than `--disable-triggers` which fails on system triggers in Supabase) and restore tables in topological parent-first order (`profiles` → `partnerships` → `objectives` → `sessions` → `session_objectives` → `session_preparation` → `actions` → `progress_updates` → `progress_update_comments`).
  3. **Automated Tests & GitHub Actions CI (`REC-005`):**
     - Add unit tests in `src/lib/*.test.ts` covering `.ics` generation (`REC-013`), `parseLinks` 10-link validation (`REC-007`), Full & Portfolio exports (`REC-008`, `REC-021`), and `useEditor` conflict/save logic.
     - Create `.github/workflows/ci.yml` running `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:db` (using PostgreSQL on Ubuntu) on every push and pull request.

---

## 5. Rollout, validation, and rollback plan

### Validation criteria
1. **Typecheck & Unit Tests:** `npm run typecheck` and `npm test` pass with zero errors.
2. **Production Bundle Build:** `npm run build` succeeds and produces `dist/` assets cleanly.
3. **Database Migration & Multi-Mentee RLS Suite:** `npm run test:db` applies `20260101000000_core_schema.sql` and `20261023000000_v2_multi_mentee_and_features.sql` to a throwaway PostgreSQL instance and passes all assertions in `supabase/tests/access.sql` (including cross-partnership isolation between Mentee A and Mentee B).

### Rollout order
1. **Backup (if existing data is present):** Run the `pg_dump` command in `docs/BACKUP.md` before applying the new migration.
2. **Database migration:** Apply `supabase/migrations/20261023000000_v2_multi_mentee_and_features.sql` to Supabase (`supabase db push` or SQL Editor). The migration automatically creates a default partnership for any existing mentor/mentee pair and backfills `partnership_id`.
3. **Front-end deployment:** Deploy the updated branch to Vercel.

### Rollback arrangement
- The v2 migration is additive (existing columns on `objectives`, `sessions`, `actions`, `progress_updates`, and `session_preparation` are preserved). If a front-end rollback is needed on Vercel, the previous deployment can be promoted immediately while keeping data intact; if a full database rollback is needed on a scratch/staging environment, restore from the pre-migration `pg_dump` using the updated `docs/BACKUP.md` procedure.
