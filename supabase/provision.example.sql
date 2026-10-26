-- Run once in the Supabase SQL editor AFTER creating the initial mentor (and optional first mentee)
-- in Authentication > Users. Replace the placeholders below.
-- Additional mentees can be onboarded directly inside the app via the "+ Mentee" button.

insert into public.profiles (id, display_name, role)
select id, 'MENTOR NAME', 'mentor' from auth.users where email = 'mentor@example.com'
on conflict (id) do update set display_name = excluded.display_name, role = excluded.role;

insert into public.profiles (id, display_name, role)
select id, 'MENTEE NAME', 'mentee' from auth.users where email = 'mentee@example.com'
on conflict (id) do update set display_name = excluded.display_name, role = excluded.role;

-- Create the initial partnership linking the mentor and first mentee:
insert into public.partnerships (mentor_id, mentee_id, mentee_name, status)
select m.id, e.id, e.display_name, 'active'
from public.profiles m
cross join public.profiles e
where m.role = 'mentor' and e.role = 'mentee'
  and not exists (
    select 1 from public.partnerships p where p.mentor_id = m.id and p.mentee_id = e.id
  );

-- Verify profiles and partnerships:
select id, display_name, role from public.profiles;
select id, mentor_id, mentee_id, mentee_name, status from public.partnerships;
