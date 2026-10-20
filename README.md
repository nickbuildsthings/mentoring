# Mentoring Workspace

A private web app for one mentor and one mentee: **objective → session → action → evidence or reflection → review**. React + Vite on Vercel, Supabase (Postgres, Auth, row-level security).

- Setup and deployment: [docs/SETUP.md](docs/SETUP.md)
- Backup and restore: [docs/BACKUP.md](docs/BACKUP.md)

## How it maps to the requirements
| Area | Where |
|---|---|
| Access (AUTH, TECH-03/04/12) | `supabase/migrations/*core_schema.sql` (RLS keyed to the `profiles` table, no public sign-up, no DELETE policies, `anon` has no grants); tests in `supabase/tests/` and `scripts/test-access.mjs` |
| Attribution, archive, conflicts | Server-side `stamp_row` trigger sets created/updated/archived metadata and a `version`; the UI updates with `where version = …` and offers *load theirs* / *save mine over theirs* on conflict (`src/components/useEditor.tsx`) |
| Authored content | `session_preparation` and `progress_updates` are editable only by their author (RLS) |
| Time | Europe/London throughout (`src/lib/format.ts`); "overdue" = due before today (London), not completed/cancelled |
| Export | `/export` — Markdown and JSON of everything including archived (`src/lib/export.ts`) |
| Safe rendering | User text rendered as plain text; links restricted to http(s) in both the UI and a DB constraint; strict CSP in `vercel.json` |

## Design decisions
- Email + password via Supabase Auth; generic sign-in errors; no in-app password reset (admin handles recovery).
- Progress reviews are sessions with `is_review = true` and a review workspace on the session page.
- Hard deletion is not exposed; archive/restore only.
- Progress-update and preparation archiving is author-only (consequence of "only the author may edit").

## Not yet verified
The UI has been exercised against a mocked Supabase API (not a live project); migrations and RLS against local Postgres 16. Run the live checks in `docs/SETUP.md` and complete `docs/BACKUP.md` before live use. Accessibility has had design care (labels, focus, text+icon status, dialogs) but no automated or screen-reader audit.
