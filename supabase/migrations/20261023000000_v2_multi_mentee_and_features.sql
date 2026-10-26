-- Mentoring Workspace v2: Multi-mentee partnerships, per-partnership RLS isolation,
-- in-app onboarding invites, schema hardening (REC-010), atomic session-objective sync (REC-003),
-- objective milestones & progress stages (REC-020), and two-way update comments (REC-017).

-- ---------------------------------------------------------------------------
-- 1. Profiles adjustments (REC-010, REC-014)
--    Remove the single-pair UNIQUE(role) constraint so multiple mentees (and mentors)
--    can exist, and change the auth.users FK from CASCADE to RESTRICT.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_key;
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- 2. Partnerships & In-App Onboarding Invites (REC-014, REC-019)
-- ---------------------------------------------------------------------------
create type public.partnership_status as enum ('pending', 'active', 'paused', 'completed');
create type public.objective_stage    as enum ('starting', 'building', 'confident', 'embedded');

create table public.partnerships (
  id                uuid primary key default gen_random_uuid(),
  mentor_id         uuid not null references public.profiles (id) on delete restrict,
  mentee_id         uuid references public.profiles (id) on delete restrict,
  mentee_name       text not null check (char_length(btrim(mentee_name)) between 1 and 80),
  title             text check (char_length(title) <= 200),
  status            public.partnership_status not null default 'active',
  purpose           text check (char_length(purpose) <= 5000),
  meeting_cadence   text check (char_length(meeting_cadence) <= 500),
  working_agreement text check (char_length(working_agreement) <= 5000),
  review_horizon    date,
  created_at timestamptz not null default now(), created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(), updated_by uuid references public.profiles (id),
  version    integer     not null default 1,
  archived_at timestamptz, archived_by uuid references public.profiles (id),
  check (mentee_id is null or mentor_id <> mentee_id)
);

create index on public.partnerships (mentor_id);
create index on public.partnerships (mentee_id);

create trigger partnerships_stamp before insert or update on public.partnerships
  for each row execute function public.stamp_row();

create table public.partnership_invites (
  partnership_id uuid primary key references public.partnerships (id) on delete cascade,
  code           text not null unique check (char_length(btrim(code)) between 6 and 64),
  mentor_id      uuid not null references public.profiles (id) on delete restrict,
  mentee_email   text check (mentee_email is null or char_length(btrim(mentee_email)) <= 254),
  created_at     timestamptz not null default now(),
  claimed_at     timestamptz,
  claimed_by     uuid references public.profiles (id) on delete restrict
);

-- Automatically pair the initial mentor + mentee when seeded via SQL (v1 compatibility)
create or replace function public.auto_pair_initial_profiles() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_mentor uuid;
  v_mentee uuid;
  v_mentee_name text;
begin
  if (select count(*) from public.partnerships) = 0 then
    select id into v_mentor from public.profiles where role = 'mentor' order by created_at asc limit 1;
    select id, display_name into v_mentee, v_mentee_name from public.profiles where role = 'mentee' order by created_at asc limit 1;
    if v_mentor is not null and v_mentee is not null and v_mentor <> v_mentee then
      insert into public.partnerships (mentor_id, mentee_id, mentee_name, status, created_by, updated_by)
      values (v_mentor, v_mentee, v_mentee_name, 'active', v_mentor, v_mentor);
    end if;
  end if;
  return new;
end $$;

create trigger profiles_auto_pair after insert on public.profiles
  for each row execute function public.auto_pair_initial_profiles();

-- Backfill a partnership if profiles already exist before this migration runs
do $$
declare
  v_mentor uuid;
  v_mentee uuid;
  v_mentee_name text;
begin
  if (select count(*) from public.partnerships) = 0 then
    select id into v_mentor from public.profiles where role = 'mentor' order by created_at asc limit 1;
    select id, display_name into v_mentee, v_mentee_name from public.profiles where role = 'mentee' order by created_at asc limit 1;
    if v_mentor is not null and v_mentee is not null then
      insert into public.partnerships (mentor_id, mentee_id, mentee_name, status, created_by, updated_by)
      values (v_mentor, v_mentee, v_mentee_name, 'active', v_mentor, v_mentor);
    end if;
  end if;
end $$;

-- Resolves the caller's default partnership when partnership_id is omitted
create or replace function public.default_partnership_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.partnerships
  where (mentor_id = (select auth.uid()) or mentee_id = (select auth.uid()))
    and archived_at is null
  order by created_at asc
  limit 1
$$;

create or replace function public.is_partnership_member(p_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.partnerships
    where id = p_id
      and (mentor_id = (select auth.uid()) or mentee_id = (select auth.uid()))
  )
$$;

create or replace function public.shares_partnership_with(other_user_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select other_user_id = (select auth.uid())
     or exists (
       select 1 from public.partnerships
       where (mentor_id = (select auth.uid()) and mentee_id = other_user_id)
          or (mentee_id = (select auth.uid()) and mentor_id = other_user_id)
     )
$$;

revoke all on function public.default_partnership_id() from public, anon;
revoke all on function public.is_partnership_member(uuid) from public, anon;
revoke all on function public.shares_partnership_with(uuid) from public, anon;
grant execute on function public.default_partnership_id() to authenticated;
grant execute on function public.is_partnership_member(uuid) to authenticated;
grant execute on function public.shares_partnership_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Add partnership_id and enriched mentoring columns to content tables
--    (REC-014, REC-017, REC-018, REC-020)
-- ---------------------------------------------------------------------------
alter table public.objectives
  add column partnership_id uuid default public.default_partnership_id() references public.partnerships (id) on delete restrict,
  add column progress_stage public.objective_stage not null default 'starting',
  add column milestones jsonb not null default '[]'::jsonb
    check (jsonb_typeof(milestones) = 'array' and jsonb_array_length(milestones) <= 30);

alter table public.sessions
  add column partnership_id uuid default public.default_partnership_id() references public.partnerships (id) on delete restrict;

alter table public.actions
  add column partnership_id uuid default public.default_partnership_id() references public.partnerships (id) on delete restrict;

alter table public.progress_updates
  add column partnership_id uuid default public.default_partnership_id() references public.partnerships (id) on delete restrict,
  add column discuss_next boolean not null default false,
  add column action_id uuid references public.actions (id) on delete set null;

-- Backfill any pre-existing rows with the initial partnership
do $$
declare v_pid uuid;
begin
  select id into v_pid from public.partnerships order by created_at asc limit 1;
  if v_pid is not null then
    update public.objectives       set partnership_id = v_pid where partnership_id is null;
    update public.sessions         set partnership_id = v_pid where partnership_id is null;
    update public.actions          set partnership_id = v_pid where partnership_id is null;
    update public.progress_updates set partnership_id = v_pid where partnership_id is null;
  end if;
end $$;

alter table public.objectives       alter column partnership_id set not null;
alter table public.sessions         alter column partnership_id set not null;
alter table public.actions          alter column partnership_id set not null;
alter table public.progress_updates alter column partnership_id set not null;

create index on public.objectives (partnership_id);
create index on public.sessions (partnership_id, scheduled_at desc);
create index on public.actions (partnership_id, status, due_date);
create index on public.progress_updates (partnership_id, occurred_on desc);

-- Preserve partnership_id immutability inside stamp_row()
create or replace function public.stamp_row() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at  := now();
    new.created_by  := auth.uid();
    new.updated_at  := now();
    new.updated_by  := auth.uid();
    new.version     := 1;
    new.archived_at := null;
    new.archived_by := null;
  else
    new.id         := old.id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
    new.version    := old.version + 1;
    if new.archived_at is distinct from old.archived_at then
      new.archived_at := case when new.archived_at is null then null else now() end;
      new.archived_by := case when new.archived_at is null then null else auth.uid() end;
    else
      new.archived_by := old.archived_by;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Schema hardening (REC-010)
--    - Reject NULL array elements in valid_links(text[])
--    - Enforce Europe/London default date on progress_updates.occurred_on
--    - Stamp created_by/created_at and validate same-partnership on session_objectives
-- ---------------------------------------------------------------------------
create or replace function public.valid_links(links text[]) returns boolean
language sql immutable
as $$
  select coalesce(bool_and(l is not null and l ~* '^https?://[^[:space:]]+$' and char_length(l) <= 2048), true)
         and coalesce(array_length(links, 1), 0) <= 10
  from unnest(links) as l
$$;

alter table public.progress_updates
  alter column occurred_on set default (now() at time zone 'Europe/London')::date;

create or replace function public.session_objectives_before_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_sess_pid uuid;
  v_obj_pid  uuid;
begin
  new.created_at := now();
  new.created_by := auth.uid();
  select partnership_id into v_sess_pid from public.sessions where id = new.session_id;
  select partnership_id into v_obj_pid  from public.objectives where id = new.objective_id;
  if v_sess_pid is null or v_obj_pid is null or v_sess_pid <> v_obj_pid then
    raise exception 'Session and objective must belong to the same partnership';
  end if;
  return new;
end $$;

create trigger session_objectives_stamp before insert on public.session_objectives
  for each row execute function public.session_objectives_before_insert();

-- ---------------------------------------------------------------------------
-- 5. Two-way coaching dialogue on Progress Updates (REC-017)
-- ---------------------------------------------------------------------------
create table public.progress_update_comments (
  id             uuid primary key default gen_random_uuid(),
  partnership_id uuid not null default public.default_partnership_id() references public.partnerships (id) on delete restrict,
  update_id      uuid not null references public.progress_updates (id) on delete cascade,
  content        text not null check (char_length(btrim(content)) between 1 and 5000),
  created_at timestamptz not null default now(), created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(), updated_by uuid references public.profiles (id),
  version    integer     not null default 1,
  archived_at timestamptz, archived_by uuid references public.profiles (id)
);

create index on public.progress_update_comments (partnership_id);
create index on public.progress_update_comments (update_id, created_at asc);

create or replace function public.comments_before_write() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_up_pid uuid;
begin
  select partnership_id into v_up_pid from public.progress_updates where id = new.update_id;
  if v_up_pid is null then
    raise exception 'Parent progress update not found';
  end if;
  new.partnership_id := v_up_pid;
  return new;
end $$;

create trigger progress_update_comments_link before insert or update on public.progress_update_comments
  for each row execute function public.comments_before_write();

create trigger progress_update_comments_stamp before insert or update on public.progress_update_comments
  for each row execute function public.stamp_row();

-- Allow either participant in the partnership to toggle discuss_next on an update
create or replace function public.toggle_update_discuss_next(p_update_id uuid, p_discuss_next boolean)
returns public.progress_updates
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.progress_updates;
begin
  select * into v_row from public.progress_updates where id = p_update_id;
  if v_row.id is null or not public.is_partnership_member(v_row.partnership_id) then
    raise exception 'Not authorised to modify this update' using errcode = '42501';
  end if;
  -- Update discuss_next directly without changing created_by or bumping editor conflict version
  alter table public.progress_updates disable trigger progress_updates_stamp;
  update public.progress_updates
     set discuss_next = p_discuss_next
   where id = p_update_id
   returning * into v_row;
  alter table public.progress_updates enable trigger progress_updates_stamp;
  return v_row;
exception when others then
  alter table public.progress_updates enable trigger progress_updates_stamp;
  raise;
end $$;

revoke all on function public.toggle_update_discuss_next(uuid, boolean) from public, anon;
grant execute on function public.toggle_update_discuss_next(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Atomic Session + Objective links RPC (REC-003)
-- ---------------------------------------------------------------------------
create or replace function public.sync_session_objectives(p_session_id uuid, p_objective_ids uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_pid uuid;
  v_oid uuid;
begin
  select partnership_id into v_pid from public.sessions where id = p_session_id;
  if v_pid is null or not public.is_partnership_member(v_pid) then
    raise exception 'Not authorised to modify session objectives' using errcode = '42501';
  end if;

  delete from public.session_objectives
   where session_id = p_session_id
     and not (objective_id = any(coalesce(p_objective_ids, array[]::uuid[])));

  foreach v_oid in array coalesce(p_objective_ids, array[]::uuid[]) loop
    insert into public.session_objectives (session_id, objective_id, created_by)
    values (p_session_id, v_oid, auth.uid())
    on conflict (session_id, objective_id) do nothing;
  end loop;
end $$;

revoke all on function public.sync_session_objectives(uuid, uuid[]) from public, anon;
grant execute on function public.sync_session_objectives(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. In-App Mentee Onboarding RPCs (REC-014)
-- ---------------------------------------------------------------------------
create or replace function public.create_mentee_partnership(
  p_mentee_name text,
  p_title text default null,
  p_purpose text default null,
  p_meeting_cadence text default null,
  p_mentee_email text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_partnership public.partnerships;
  v_code text;
begin
  if v_uid is null or not public.is_member() then
    raise exception 'Only an approved member can create a partnership' using errcode = '42501';
  end if;

  v_code := upper(substr(md5(random()::text || clock_timestamp()::text || v_uid::text), 1, 4) || '-' ||
                  substr(md5(clock_timestamp()::text || random()::text), 1, 4));

  insert into public.partnerships (mentor_id, mentee_id, mentee_name, title, status, purpose, meeting_cadence)
  values (
    v_uid,
    null,
    btrim(p_mentee_name),
    nullif(btrim(coalesce(p_title, '')), ''),
    'pending',
    nullif(btrim(coalesce(p_purpose, '')), ''),
    nullif(btrim(coalesce(p_meeting_cadence, '')), '')
  )
  returning * into v_partnership;

  insert into public.partnership_invites (partnership_id, code, mentor_id, mentee_email)
  values (v_partnership.id, v_code, v_uid, nullif(btrim(coalesce(p_mentee_email, '')), ''));

  return jsonb_build_object(
    'partnership_id', v_partnership.id,
    'invite_code', v_code,
    'mentee_name', v_partnership.mentee_name
  );
end $$;

create or replace function public.claim_partnership_invite(
  p_code text,
  p_display_name text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.partnership_invites;
  v_part public.partnerships;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_inv
    from public.partnership_invites
   where upper(btrim(code)) = upper(btrim(p_code))
     and claimed_at is null;

  if v_inv.partnership_id is null then
    raise exception 'Invalid or already claimed invitation code' using errcode = '22023';
  end if;

  select * into v_part from public.partnerships where id = v_inv.partnership_id;
  if v_part.mentor_id = v_uid then
    raise exception 'You cannot claim your own mentor invitation code' using errcode = '22023';
  end if;

  v_name := coalesce(nullif(btrim(coalesce(p_display_name, '')), ''), v_part.mentee_name);

  insert into public.profiles (id, display_name, role)
  values (v_uid, v_name, 'mentee')
  on conflict (id) do nothing;

  update public.partnerships
     set mentee_id = v_uid,
         mentee_name = v_name,
         status = 'active'
   where id = v_inv.partnership_id;

  update public.partnership_invites
     set claimed_at = now(),
         claimed_by = v_uid
   where partnership_id = v_inv.partnership_id;

  return v_inv.partnership_id;
end $$;

revoke all on function public.create_mentee_partnership(text, text, text, text, text) from public, anon;
revoke all on function public.claim_partnership_invite(text, text) from public, anon;
grant execute on function public.create_mentee_partnership(text, text, text, text, text) to authenticated;
grant execute on function public.claim_partnership_invite(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Row-Level Security: Per-Partnership Tenant Isolation (REC-014)
-- ---------------------------------------------------------------------------
alter table public.partnerships             enable row level security;
alter table public.partnerships             force row level security;
alter table public.partnership_invites      enable row level security;
alter table public.partnership_invites      force row level security;
alter table public.progress_update_comments enable row level security;
alter table public.progress_update_comments force row level security;

revoke all on public.partnerships, public.partnership_invites, public.progress_update_comments from anon, authenticated;
grant select, insert, update on public.partnerships to authenticated;
grant select on public.partnership_invites to authenticated;
grant select, insert, update on public.progress_update_comments to authenticated;

-- Profiles: members only see their own profile and profiles of people they share a partnership with
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (public.is_member() and public.shares_partnership_with(id));

-- Partnerships: visible and editable only by the mentor or mentee of that partnership
create policy partnerships_read on public.partnerships for select to authenticated
  using (public.is_partnership_member(id));
create policy partnerships_insert on public.partnerships for insert to authenticated
  with check (public.is_member() and (mentor_id = (select auth.uid()) or mentee_id = (select auth.uid())));
create policy partnerships_update on public.partnerships for update to authenticated
  using (public.is_partnership_member(id))
  with check (public.is_partnership_member(id));

-- Partnership invites: visible only to the mentor who created the invite
create policy partnership_invites_read on public.partnership_invites for select to authenticated
  using (mentor_id = (select auth.uid()));

-- Shared records (objectives, sessions, actions): scoped to partnership_id
do $$
declare t text;
begin
  foreach t in array array['objectives','sessions','actions'] loop
    execute format('drop policy if exists %I_read   on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);

    execute format('create policy %I_read   on public.%I for select to authenticated using (public.is_partnership_member(partnership_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.is_partnership_member(partnership_id))', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.is_partnership_member(partnership_id)) with check (public.is_partnership_member(partnership_id))', t, t);
  end loop;
end $$;

-- Session objectives: scoped via the parent session's partnership_id
drop policy if exists session_objectives_read   on public.session_objectives;
drop policy if exists session_objectives_insert on public.session_objectives;
drop policy if exists session_objectives_delete on public.session_objectives;

create policy session_objectives_read on public.session_objectives for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and public.is_partnership_member(s.partnership_id)));
create policy session_objectives_insert on public.session_objectives for insert to authenticated
  with check (exists (select 1 from public.sessions s where s.id = session_id and public.is_partnership_member(s.partnership_id)));
create policy session_objectives_delete on public.session_objectives for delete to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and public.is_partnership_member(s.partnership_id)));

-- Session preparation: scoped via the parent session's partnership_id; only author updates
drop policy if exists session_preparation_read   on public.session_preparation;
drop policy if exists session_preparation_insert on public.session_preparation;
drop policy if exists session_preparation_update on public.session_preparation;

create policy session_preparation_read on public.session_preparation for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and public.is_partnership_member(s.partnership_id)));
create policy session_preparation_insert on public.session_preparation for insert to authenticated
  with check (exists (select 1 from public.sessions s where s.id = session_id and public.is_partnership_member(s.partnership_id)));
create policy session_preparation_update on public.session_preparation for update to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and public.is_partnership_member(s.partnership_id)) and created_by = (select auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and public.is_partnership_member(s.partnership_id)) and created_by = (select auth.uid()));

-- Progress updates: scoped to partnership_id; only author updates
drop policy if exists progress_updates_read   on public.progress_updates;
drop policy if exists progress_updates_insert on public.progress_updates;
drop policy if exists progress_updates_update on public.progress_updates;

create policy progress_updates_read on public.progress_updates for select to authenticated
  using (public.is_partnership_member(partnership_id));
create policy progress_updates_insert on public.progress_updates for insert to authenticated
  with check (public.is_partnership_member(partnership_id));
create policy progress_updates_update on public.progress_updates for update to authenticated
  using (public.is_partnership_member(partnership_id) and created_by = (select auth.uid()))
  with check (public.is_partnership_member(partnership_id) and created_by = (select auth.uid()));

-- Progress update comments: both partnership members read & insert; only comment author updates
create policy progress_update_comments_read on public.progress_update_comments for select to authenticated
  using (public.is_partnership_member(partnership_id));
create policy progress_update_comments_insert on public.progress_update_comments for insert to authenticated
  with check (public.is_partnership_member(partnership_id));
create policy progress_update_comments_update on public.progress_update_comments for update to authenticated
  using (public.is_partnership_member(partnership_id) and created_by = (select auth.uid()))
  with check (public.is_partnership_member(partnership_id) and created_by = (select auth.uid()));
