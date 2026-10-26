-- Seed a complete, synthetic Demo Mentee partnership ("Alex Rivera (Demo)")
-- Safe to run in the Supabase SQL Editor AFTER applying `20261023000000_v2_multi_mentee_and_features.sql`.
-- Idempotent: if an active "Alex Rivera (Demo)" partnership already exists for the mentor, it skips creation.

do $$
declare
  v_mentor uuid;
  v_pid    uuid;
  v_obj1   uuid := gen_random_uuid();
  v_obj2   uuid := gen_random_uuid();
  v_obj3   uuid := gen_random_uuid();
  v_sess1  uuid := gen_random_uuid();
  v_sess2  uuid := gen_random_uuid();
  v_sess3  uuid := gen_random_uuid();
  v_upd1   uuid := gen_random_uuid();
  v_upd4   uuid := gen_random_uuid();
begin
  select id into v_mentor from public.profiles where role = 'mentor' order by created_at asc limit 1;
  if v_mentor is null then
    raise exception 'No mentor profile found in public.profiles. Provision your mentor profile first.';
  end if;

  -- Check if demo partnership already exists
  select id into v_pid
  from public.partnerships
  where mentor_id = v_mentor
    and mentee_name = 'Alex Rivera (Demo)'
    and archived_at is null
  limit 1;

  if v_pid is not null then
    raise notice 'Demo partnership "Alex Rivera (Demo)" already exists (%).', v_pid;
    return;
  end if;

  -- 1. Create Partnership & Charter
  insert into public.partnerships (
    mentor_id, mentee_id, mentee_name, title, status,
    purpose, meeting_cadence, working_agreement, review_horizon,
    created_by, updated_by
  ) values (
    v_mentor,
    null,
    'Alex Rivera (Demo)',
    'Stepping into Staff-Level Technical Leadership',
    'active',
    'Build confidence leading cross-team architecture decisions, delegating high-visibility delivery work without micromanaging, and communicating technical strategy clearly to senior stakeholders.',
    'Fortnightly on Wednesdays, 45 minutes',
    E'- Share brief preparation notes at least 24 hours before each session\n- Keep everything discussed confidential within this partnership\n- Focus on real, upcoming situations rather than abstract theory\n- Challenge assumptions candidly and constructively',
    current_date + 90,
    v_mentor,
    v_mentor
  ) returning id into v_pid;

  -- 2. Create 3 Objectives across stages and statuses
  insert into public.objectives (
    id, partnership_id, title, success_criteria, context, development_area,
    status, progress_stage, review_date, closing_summary, milestones,
    created_by, updated_by
  ) values
  (
    v_obj1,
    v_pid,
    'Lead cross-team RFC and architecture reviews with confidence',
    'Independently chair at least three cross-team RFC reviews, surface trade-offs clearly without dominating the conversation, and publish a clear decision record within 48 hours of each review.',
    'Stepping from team-level tech lead into a cross-team leadership role where influencing without direct authority is essential.',
    'Professional judgement',
    'active',
    'confident',
    current_date + 30,
    null,
    jsonb_build_array(
      jsonb_build_object('id', 'demo-m1', 'text', 'Shadow mentor chairing the Q1 Platform RFC review', 'done', true),
      jsonb_build_object('id', 'demo-m2', 'text', 'Draft a lightweight 1-page RFC decision template', 'done', true),
      jsonb_build_object('id', 'demo-m3', 'text', 'Chair the Payments Service RFC review with 3+ teams', 'done', true),
      jsonb_build_object('id', 'demo-m4', 'text', 'Chair the Q3 Event Mesh Architecture Board review', 'done', false)
    ),
    v_mentor,
    v_mentor
  ),
  (
    v_obj2,
    v_pid,
    'Delegate feature delivery ownership to mid-level engineers',
    'Hand over end-to-end technical leadership of two major workstreams to mid-level engineers on the squad, shifting my involvement from writing core PRs to coaching and design review.',
    'Currently a bottleneck on code reviews and release coordination, leaving little capacity for strategic architecture work.',
    'Communication',
    'active',
    'building',
    current_date + 45,
    null,
    jsonb_build_array(
      jsonb_build_object('id', 'demo-m5', 'text', 'Write a clear guardrails & escalation checklist for workstream leads', 'done', true),
      jsonb_build_object('id', 'demo-m6', 'text', 'Delegate checkout webhook migration to Maya with weekly check-ins', 'done', true),
      jsonb_build_object('id', 'demo-m7', 'text', 'Hand over sprint release coordination to Sam', 'done', false)
    ),
    v_mentor,
    v_mentor
  ),
  (
    v_obj3,
    v_pid,
    'Establish a clear 6-month platform reliability roadmap',
    'Co-create and secure leadership sign-off on a pragmatic 6-month reliability roadmap tied to customer-facing SLOs rather than purely internal tech debt.',
    'Needed to align engineering priorities with Product before annual planning.',
    'Skills',
    'achieved',
    'embedded',
    current_date - 14,
    'Presented the SLO-framed roadmap to Engineering and Product leadership; secured 30% capacity allocation for Q2–Q3 and established a monthly reliability review.',
    jsonb_build_array(
      jsonb_build_object('id', 'demo-m8', 'text', 'Audit top 5 incident root causes from the past 6 months', 'done', true),
      jsonb_build_object('id', 'demo-m9', 'text', 'Reframe technical proposals around customer impact and error budgets', 'done', true),
      jsonb_build_object('id', 'demo-m10', 'text', 'Present roadmap to Product & Engineering Directors and agree Q2 allocation', 'done', true)
    ),
    v_mentor,
    v_mentor
  );

  -- 3. Create 3 Sessions (Kick-off, Mid-quarter Progress Review, and Upcoming Planned Session)
  insert into public.sessions (
    id, partnership_id, scheduled_at, title, location, meeting_link,
    status, is_review, discussion_notes, outcomes,
    review_changed, review_difficult, review_focus,
    created_by, updated_by
  ) values
  (
    v_sess1,
    v_pid,
    now() - interval '42 days',
    'Kick-off: Agreeing our charter & initial objectives',
    'Video call',
    'https://meet.example.com/demo-kickoff',
    'completed',
    false,
    E'Discussed what a successful 6 months of mentoring looks like for Alex.\n\nKey themes:\n- Moving from "strongest individual contributor in the room" to multiplier and facilitator.\n- Creating space for mid-level engineers to own outcomes even if they take a slightly different path.\n- Framing technical investments in terms of customer and product outcomes.',
    E'- Agreed our working charter and fortnightly cadence.\n- Activated three core objectives around RFC facilitation, delegation, and the reliability roadmap.\n- Agreed first step: reframe the reliability deck before meeting the Product Director.',
    null, null, null,
    v_mentor, v_mentor
  ),
  (
    v_sess2,
    v_pid,
    now() - interval '14 days',
    'Mid-quarter Progress Review',
    'Room 4B / Hybrid',
    'https://meet.example.com/demo-review',
    'completed',
    true,
    E'Reviewed progress across all three objectives.\n\n- Reliability roadmap objective is now complete and signed off.\n- Payments RFC review went very well; Alex used a structured decision table that prevented circular debate.\n- Delegation is progressing, though Alex noticed an urge to step back in when deadlines tighten.',
    E'- Marked "Establish a clear 6-month platform reliability roadmap" as Achieved.\n- Moved RFC facilitation stage to "Gaining confidence".\n- Agreed next focus: handing over release coordination and unblocking the Data Platform schema alignment.',
    'Much stronger executive framing in stakeholder conversations, and noticeably calmer facilitation in cross-team architecture reviews.',
    'Resisting the urge to jump in and fix code directly when a delegated task hits an unexpected edge case.',
    'Preparing for the Q3 Event Mesh Architecture Board and completing the release runbook handover.',
    v_mentor, v_mentor
  ),
  (
    v_sess3,
    v_pid,
    now() + interval '7 days',
    'Preparing for the Q3 Architecture Board & Delegation Check-in',
    'Video call',
    'https://meet.example.com/demo-upcoming',
    'planned',
    false,
    null,
    null,
    null, null, null,
    v_mentor, v_mentor
  );

  insert into public.session_objectives (session_id, objective_id, created_by) values
    (v_sess1, v_obj1, v_mentor),
    (v_sess1, v_obj2, v_mentor),
    (v_sess1, v_obj3, v_mentor),
    (v_sess2, v_obj1, v_mentor),
    (v_sess2, v_obj2, v_mentor),
    (v_sess2, v_obj3, v_mentor),
    (v_sess3, v_obj1, v_mentor),
    (v_sess3, v_obj2, v_mentor);

  -- Preparation for the upcoming session
  insert into public.session_preparation (
    session_id, topics, recent_progress, difficulties, support_needed,
    created_by, updated_by
  ) values (
    v_sess3,
    E'1. Dry-run the contentious trade-offs for the Event Mesh RFC before Thursday’s board.\n2. How to unblock the Data Platform schema versioning dependency without escalating prematurely.',
    'Completed the Payments RFC review and published the decision record within 24 hours. Maya shipped the checkout webhook migration independently.',
    'The Data Platform team restructure has left our schema versioning action blocked for 10 days.',
    'Could we spend 15 minutes role-playing potential pushback from the Principal Architect on the event retention trade-off?',
    v_mentor,
    v_mentor
  );

  -- 4. Create 4 Actions across statuses
  insert into public.actions (
    partnership_id, title, description, owner_role, due_date, status,
    objective_id, session_id, completion_note, blocked_note,
    created_by, updated_by
  ) values
  (
    v_pid,
    'Co-chair the Payments Service RFC review and publish decision record',
    'Use the new 1-page trade-off matrix to keep the discussion focused on options and constraints.',
    'mentee',
    current_date - 18,
    'completed',
    v_obj1,
    v_sess1,
    'Chaired the review with 12 engineers across 3 squads; decision record published the next morning.',
    null,
    v_mentor, v_mentor
  ),
  (
    v_pid,
    'Hand over sprint release coordination to Sam with a 1-page runbook',
    'Shadow Sam on the next release, then step back to observer only.',
    'mentee',
    current_date + 5,
    'in_progress',
    v_obj2,
    v_sess2,
    null,
    null,
    v_mentor, v_mentor
  ),
  (
    v_pid,
    'Share example stakeholder briefing deck from last year’s platform review',
    'Give Alex a concrete reference for structuring the Q3 Architecture Board pre-read.',
    'mentor',
    current_date + 4,
    'not_started',
    v_obj1,
    v_sess2,
    null,
    null,
    v_mentor, v_mentor
  ),
  (
    v_pid,
    'Agree event schema versioning contract with Data Platform lead',
    'Align on backwards-compatibility window before publishing the Event Mesh RFC.',
    'mentee',
    current_date - 2,
    'blocked',
    v_obj1,
    v_sess2,
    null,
    'Waiting on Data Platform team to confirm their Q3 tech lead after the team restructure — unsure whether to escalate or propose a provisional contract.',
    v_mentor, v_mentor
  );

  -- 5. Create 4 Progress Updates & 2 Coaching Replies
  insert into public.progress_updates (
    id, partnership_id, type, occurred_on, objective_id, session_id, discuss_next, links, content,
    created_by, updated_by
  ) values
  (
    v_upd1,
    v_pid,
    'achievement',
    current_date - 16,
    v_obj1,
    v_sess2,
    false,
    array['https://example.com/docs/payments-rfc-decision-record'],
    E'What was achieved:\nChaired the cross-team Payments Service RFC review (12 engineers across Checkout, Ledger, and SRE) and reached unanimous agreement on the idempotency design in 40 minutes.\n\nWhy it matters / impact:\nPreviously this RFC had stalled in async comments for three weeks. Writing the trade-off matrix ahead of time turned a heated debate into a structured evaluation.',
    v_mentor, v_mentor
  ),
  (
    gen_random_uuid(),
    v_pid,
    'evidence',
    current_date - 20,
    v_obj2,
    null,
    false,
    array['https://example.com/docs/delegation-guardrails'],
    E'What I did / example:\nDelegated full ownership of the checkout webhook migration to Maya using a 1-page guardrails document (SLO targets, rollback criteria, and weekly check-in points) rather than specifying the implementation.\n\nOutcome / observable difference:\nMaya designed a cleaner retry queue than I had originally sketched, presented it to the squad herself, and delivered it two days ahead of schedule.',
    v_mentor, v_mentor
  ),
  (
    gen_random_uuid(),
    v_pid,
    'feedback',
    current_date - 25,
    v_obj3,
    v_sess1,
    false,
    '{}',
    E'Source / context of feedback:\nDirect feedback from the Product Director after our Q2–Q3 Platform Reliability Roadmap review.\n\nKey takeaway & how I will use it:\n"Framing the database failover work in terms of checkout availability and customer trust made it immediately obvious why we should fund this now." I will keep leading with user-facing SLO impact in future proposals.',
    v_mentor, v_mentor
  ),
  (
    v_upd4,
    v_pid,
    'reflection',
    current_date - 5,
    v_obj2,
    null,
    true,
    '{}',
    E'Situation:\nDuring Wednesday’s design critique on the notification service, a mid-level engineer got stuck answering a question about rate limiting.\n\nWhat I noticed / learned:\nI jumped in after 5 seconds to answer for them instead of asking a guiding question. Afterwards I realised I accidentally took the microphone away from them.\n\nWhat I’ll try next:\nWait at least 10 seconds in silence, or ask "How are you thinking about the burst traffic case?" so they keep ownership of the room.',
    v_mentor, v_mentor
  );

  insert into public.progress_update_comments (
    partnership_id, update_id, content, created_by, updated_by
  ) values
  (
    v_pid,
    v_upd1,
    'Well done on this — separating the failure-mode constraints from personal preferences in the pre-read made all the difference. Great template to reuse for the Event Mesh board.',
    v_mentor, v_mentor
  ),
  (
    v_pid,
    v_upd4,
    'Really self-aware observation. Let’s talk in our next session about a quick pre-meeting cue you can agree with the presenter so they know when they want you to step in vs. hold back.',
    v_mentor, v_mentor
  );

  raise notice 'Seeded demo partnership "Alex Rivera (Demo)" (%)', v_pid;
end $$;
