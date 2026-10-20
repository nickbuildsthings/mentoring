-- Access-control and data-integrity tests. Run via `npm run test:db`.
\set ON_ERROR_STOP on
\set mentor '''00000000-0000-0000-0000-0000000000a1'''
\set mentee '''00000000-0000-0000-0000-0000000000b2'''
\set outsider '''00000000-0000-0000-0000-0000000000c3'''

insert into auth.users (id, email) values
  (:mentor::uuid, 'mentor@example.test'), (:mentee::uuid, 'mentee@example.test'), (:outsider::uuid, 'outsider@example.test');
insert into public.profiles (id, display_name, role) values
  (:mentor::uuid, 'Test Mentor', 'mentor'), (:mentee::uuid, 'Test Mentee', 'mentee');

create schema t;
create function t.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), false);
  execute case when u is null then 'set role anon' else 'set role authenticated' end;
end $$;
create function t.reset() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub', '', false); end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;
create function t.fails(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return true; end $$;
create function t.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
grant execute on all functions in schema t to anon, authenticated;

-- Seed as superuser via members so triggers stamp as real users
select t.as_user(:mentor::uuid);
insert into public.objectives (id, title, success_criteria, created_by)
  values ('10000000-0000-0000-0000-000000000001', 'Delegate more', 'Hands over two projects', :mentee::uuid);
insert into public.sessions (id, scheduled_at, title)
  values ('20000000-0000-0000-0000-000000000001', now() + interval '1 day', 'Session 1');
select t.assert((select created_by from public.objectives) = :mentor::uuid, 'created_by is stamped server-side and cannot be spoofed');
select t.assert((select version from public.objectives) = 1, 'new rows start at version 1');

-- 1. Unauthenticated (anon) access
select t.reset(); select t.as_user(null);
select t.assert(t.fails('select * from public.objectives'), 'anon cannot read objectives');
select t.assert(t.fails('select * from public.profiles'), 'anon cannot read profiles');
select t.assert(t.fails($$insert into public.objectives (title, success_criteria) values ('x','y')$$), 'anon cannot insert');
select t.assert(t.fails('select public.is_member()'), 'anon cannot call is_member');

-- 2. Authenticated but unapproved account
select t.reset(); select t.as_user(:outsider::uuid);
select t.assert((select count(*) from public.objectives) = 0, 'outsider sees no objectives');
select t.assert((select count(*) from public.sessions) = 0, 'outsider sees no sessions');
select t.assert((select count(*) from public.actions) = 0, 'outsider sees no actions');
select t.assert((select count(*) from public.progress_updates) = 0, 'outsider sees no progress updates');
select t.assert((select count(*) from public.session_preparation) = 0, 'outsider sees no preparation');
select t.assert((select count(*) from public.profiles) = 0, 'outsider sees no profiles');
select t.assert(t.fails($$insert into public.objectives (title, success_criteria) values ('x','y')$$), 'outsider cannot insert objectives');
select t.assert(t.fails($$insert into public.actions (title, owner_role) values ('x','mentee')$$), 'outsider cannot insert actions');
with u as (update public.objectives set title = 'hacked' returning 1) select t.assert((select count(*) from u) = 0, 'outsider cannot update objectives');
select t.assert(t.fails($$insert into public.profiles (id, display_name, role) values (gen_random_uuid(), 'x', 'mentor')$$), 'outsider cannot add themselves as a profile');

-- 3. Shared editing by either participant + version/attribution
select t.reset(); select t.as_user(:mentee::uuid);
select t.assert((select count(*) from public.objectives) = 1, 'mentee reads shared objective');
update public.objectives set title = 'Delegate effectively' where id = '10000000-0000-0000-0000-000000000001';
select t.assert((select updated_by from public.objectives) = :mentee::uuid and (select version from public.objectives) = 2, 'update stamps updated_by and bumps version');
select t.assert((select created_by from public.objectives) = :mentor::uuid, 'created_by is immutable');
with u as (update public.objectives set title = 'stale' where id = '10000000-0000-0000-0000-000000000001' and version = 1 returning 1)
  select t.assert((select count(*) from u) = 0, 'stale version matches no rows (conflict detection)');
select t.assert(t.fails($$delete from public.objectives$$), 'objectives cannot be deleted through the API');
select t.assert(t.fails($$delete from public.sessions$$), 'sessions cannot be deleted through the API');
select t.assert(t.fails($$delete from public.actions$$), 'actions cannot be deleted through the API');
select t.assert(t.fails($$delete from public.progress_updates$$), 'progress updates cannot be deleted through the API');
select t.assert(t.fails($$insert into public.profiles (id, display_name, role) values (gen_random_uuid(), 'x', 'mentor')$$), 'members cannot modify profiles');

-- 4. Archive / restore
update public.objectives set archived_at = now() where id = '10000000-0000-0000-0000-000000000001';
select t.assert((select archived_by from public.objectives) = :mentee::uuid, 'archive records who archived');
update public.objectives set archived_at = null where id = '10000000-0000-0000-0000-000000000001';
select t.assert((select archived_at is null and archived_by is null from public.objectives), 'restore clears archive metadata');

-- 5. Actions: completion timestamp
insert into public.actions (id, title, owner_role, objective_id) values ('30000000-0000-0000-0000-000000000001', 'Draft plan', 'mentee', '10000000-0000-0000-0000-000000000001');
update public.actions set status = 'completed', completion_note = 'Done' where id = '30000000-0000-0000-0000-000000000001';
select t.assert((select completed_at is not null from public.actions), 'completing an action records completed_at');
update public.actions set status = 'in_progress' where id = '30000000-0000-0000-0000-000000000001';
select t.assert((select completed_at is null from public.actions), 'reopening an action clears completed_at');

-- 6. Authored records: only the author edits
insert into public.progress_updates (id, type, content) values ('40000000-0000-0000-0000-000000000001', 'reflection', 'Went well');
select t.reset(); select t.as_user(:mentor::uuid);
select t.assert((select count(*) from public.progress_updates) = 1, 'mentor can read mentee reflection');
with u as (update public.progress_updates set content = 'edited by other' returning 1) select t.assert((select count(*) from u) = 0, 'mentor cannot edit mentee reflection');
with u as (update public.progress_updates set archived_at = now() returning 1) select t.assert((select count(*) from u) = 0, 'mentor cannot archive mentee reflection');
select t.assert(t.fails($$insert into public.progress_updates (type, content, links) values ('evidence', 'x', array['javascript:alert(1)'])$$), 'non-http(s) links are rejected');
insert into public.progress_updates (type, content, links) values ('evidence', 'ok', array['https://example.test/doc']);

-- 7. Preparation: one per author, only author edits
insert into public.session_preparation (session_id, topics) values ('20000000-0000-0000-0000-000000000001', 'Mentor topics');
select t.assert(t.fails($$insert into public.session_preparation (session_id, topics) values ('20000000-0000-0000-0000-000000000001', 'dup')$$), 'one preparation record per author per session');
select t.reset(); select t.as_user(:mentee::uuid);
insert into public.session_preparation (session_id, topics) values ('20000000-0000-0000-0000-000000000001', 'Mentee topics');
select t.assert((select count(*) from public.session_preparation) = 2, 'both preparations visible to both participants');
with u as (update public.session_preparation set topics = 'overwrite' where topics = 'Mentor topics' returning 1)
  select t.assert((select count(*) from u) = 0, 'mentee cannot edit mentor preparation');

-- 8. Session-objective links
insert into public.session_objectives (session_id, objective_id) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
select t.assert((select count(*) from public.session_objectives) = 1, 'session can be linked to objectives');
delete from public.session_objectives;
select t.assert((select count(*) from public.session_objectives) = 0, 'links can be removed');

-- 9. Admin-only constraints
select t.reset();
select t.assert(t.fails($$insert into public.profiles (id, display_name, role) values (:outsider::uuid, 'Third', 'mentor')$$), 'a second mentor cannot be added (max one mentor + one mentee)');
\o
\echo ALL ACCESS TESTS PASSED
