-- Run once in the Supabase SQL editor AFTER creating the two users in
-- Authentication > Users (invite or "Add user"). Replace the placeholders.
-- Nobody else can ever read mentoring data: access is keyed to this table.
insert into public.profiles (id, display_name, role)
select id, 'MENTOR NAME', 'mentor' from auth.users where email = 'mentor@example.com';

insert into public.profiles (id, display_name, role)
select id, 'MENTEE NAME', 'mentee' from auth.users where email = 'mentee@example.com';

-- Verify: expect exactly two rows.
select id, display_name, role from public.profiles;
