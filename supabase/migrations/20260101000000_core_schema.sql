-- Mentoring Workspace: core schema, triggers and row-level security.
-- Exactly two approved accounts (one mentor, one mentee) share one workspace.

create type public.member_role     as enum ('mentor', 'mentee');
create type public.objective_status as enum ('proposed', 'active', 'achieved', 'paused', 'closed');
create type public.session_status  as enum ('planned', 'completed', 'cancelled');
create type public.action_status   as enum ('not_started', 'in_progress', 'blocked', 'completed', 'cancelled');
create type public.update_type     as enum ('reflection', 'evidence', 'feedback', 'achievement');

-- ---------------------------------------------------------------------------
-- Approved participants. Rows are inserted by deployment administration only
-- (see docs/SETUP.md). UNIQUE(role) caps the workspace at one mentor + one mentee.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  role         public.member_role not null unique,
  created_at   timestamptz not null default now()
);

create function public.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = (select auth.uid())) $$;

create function public.my_role() returns public.member_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

revoke all on function public.is_member() from public, anon;
revoke all on function public.my_role()  from public, anon;
grant execute on function public.is_member() to authenticated;
grant execute on function public.my_role()  to authenticated;

create function public.valid_links(links text[]) returns boolean
language sql immutable
as $$
  select coalesce(bool_and(l ~* '^https?://[^[:space:]]+$' and char_length(l) <= 2048), true)
         and coalesce(array_length(links, 1), 0) <= 10
  from unnest(links) as l
$$;

-- ---------------------------------------------------------------------------
-- Shared columns are stamped server-side so they cannot be spoofed:
-- created/updated attribution, optimistic-lock version, archive metadata.
-- ---------------------------------------------------------------------------
create function public.stamp_row() returns trigger
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
-- Objectives
-- ---------------------------------------------------------------------------
create table public.objectives (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(btrim(title)) between 1 and 200),
  success_criteria text not null check (char_length(btrim(success_criteria)) between 1 and 5000),
  context          text check (char_length(context) <= 5000),
  development_area text check (char_length(development_area) <= 100),
  status           public.objective_status not null default 'proposed',
  review_date      date,
  closing_summary  text check (char_length(closing_summary) <= 5000),
  created_at timestamptz not null default now(), created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(), updated_by uuid references public.profiles (id),
  version    integer     not null default 1,
  archived_at timestamptz, archived_by uuid references public.profiles (id)
);

-- ---------------------------------------------------------------------------
-- Sessions (records of mentoring conversations, including progress reviews)
-- ---------------------------------------------------------------------------
create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  scheduled_at     timestamptz not null,
  title            text check (char_length(title) <= 200),
  location         text check (char_length(location) <= 300),
  meeting_link     text check (meeting_link is null or public.valid_links(array[meeting_link])),
  status           public.session_status not null default 'planned',
  is_review        boolean not null default false,
  discussion_notes text check (char_length(discussion_notes) <= 50000),
  outcomes         text check (char_length(outcomes) <= 10000),
  review_changed   text check (char_length(review_changed) <= 5000),
  review_difficult text check (char_length(review_difficult) <= 5000),
  review_focus     text check (char_length(review_focus) <= 5000),
  created_at timestamptz not null default now(), created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(), updated_by uuid references public.profiles (id),
  version    integer     not null default 1,
  archived_at timestamptz, archived_by uuid references public.profiles (id)
);

create table public.session_objectives (
  session_id   uuid not null references public.sessions (id)   on delete restrict,
  objective_id uuid not null references public.objectives (id) on delete restrict,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references public.profiles (id),
  primary key (session_id, objective_id)
);

-- One preparation record per participant per session; created_by is the author.
create table public.session_preparation (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions (id) on delete restrict,
  topics          text check (char_length(topics) <= 5000),
  recent_progress text check (char_length(recent_progress) <= 5000),
  difficulties    text check (char_length(difficulties) <= 5000),
  support_needed  text check (char_length(support_needed) <= 5000),
  created_at timestamptz not null default now(), created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(), updated_by uuid references public.profiles (id),
  version    integer     not null default 1,
  archived_at timestamptz, archived_by uuid references public.profiles (id)
);
create unique index session_preparation_author_uq on public.session_preparation (session_id, created_by);

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------
create table public.actions (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(btrim(title)) between 1 and 200),
  description     text check (char_length(description) <= 5000),
  owner_role      public.member_role not null,
  due_date        date,
  status          public.action_status not null default 'not_started',
  objective_id    uuid references public.objectives (id) on delete restrict,
  session_id      uuid references public.sessions (id)   on delete restrict,
  completed_at    timestamptz,
  completion_note text check (char_length(completion_note) <= 5000),
  blocked_note    text check (char_length(blocked_note) <= 5000),
  created_at timestamptz not null default now(), created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(), updated_by uuid references public.profiles (id),
  version    integer     not null default 1,
  archived_at timestamptz, archived_by uuid references public.profiles (id)
);

create function public.actions_before_write() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status is distinct from 'completed' then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Progress updates (reflection / evidence / feedback / achievement)
-- ---------------------------------------------------------------------------
create table public.progress_updates (
  id           uuid primary key default gen_random_uuid(),
  type         public.update_type not null,
  content      text not null check (char_length(btrim(content)) between 1 and 20000),
  links        text[] not null default '{}' check (public.valid_links(links)),
  occurred_on  date not null default current_date,
  objective_id uuid references public.objectives (id) on delete restrict,
  session_id   uuid references public.sessions (id)   on delete restrict,
  created_at timestamptz not null default now(), created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(), updated_by uuid references public.profiles (id),
  version    integer     not null default 1,
  archived_at timestamptz, archived_by uuid references public.profiles (id)
);

-- Triggers
do $$
declare t text;
begin
  foreach t in array array['objectives','sessions','session_preparation','actions','progress_updates'] loop
    execute format('create trigger %I_stamp before insert or update on public.%I
                    for each row execute function public.stamp_row()', t, t);
  end loop;
end $$;
create trigger actions_status before insert or update on public.actions
  for each row execute function public.actions_before_write();

-- Helpful indexes
create index on public.actions (status, due_date);
create index on public.actions (objective_id);
create index on public.actions (session_id);
create index on public.progress_updates (objective_id, occurred_on desc);
create index on public.progress_updates (session_id);
create index on public.sessions (scheduled_at desc);
create index on public.session_objectives (objective_id);

-- ---------------------------------------------------------------------------
-- Row-level security. Default deny; no DELETE policies (records are archived).
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.objectives          enable row level security;
alter table public.sessions            enable row level security;
alter table public.session_objectives  enable row level security;
alter table public.session_preparation enable row level security;
alter table public.actions             enable row level security;
alter table public.progress_updates    enable row level security;

alter table public.profiles            force row level security;
alter table public.objectives          force row level security;
alter table public.sessions            force row level security;
alter table public.session_objectives  force row level security;
alter table public.session_preparation force row level security;
alter table public.actions             force row level security;
alter table public.progress_updates    force row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.objectives, public.sessions, public.actions,
      public.progress_updates, public.session_preparation to authenticated;
grant select, insert, delete on public.session_objectives to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (public.is_member());

-- Shared records: either participant may read, create and edit.
do $$
declare t text;
begin
  foreach t in array array['objectives','sessions','actions'] loop
    execute format('create policy %I_read   on public.%I for select to authenticated using (public.is_member())', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.is_member())', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.is_member()) with check (public.is_member())', t, t);
  end loop;
end $$;

create policy session_objectives_read   on public.session_objectives for select to authenticated using (public.is_member());
create policy session_objectives_insert on public.session_objectives for insert to authenticated with check (public.is_member());
create policy session_objectives_delete on public.session_objectives for delete to authenticated using (public.is_member());

-- Authored records: both read; only the author writes.
do $$
declare t text;
begin
  foreach t in array array['session_preparation','progress_updates'] loop
    execute format('create policy %I_read   on public.%I for select to authenticated using (public.is_member())', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.is_member())', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated
                    using (public.is_member() and created_by = (select auth.uid()))
                    with check (public.is_member() and created_by = (select auth.uid()))', t, t);
  end loop;
end $$;
