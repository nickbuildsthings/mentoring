import { createMenteePartnership, insertRow, setLinks, updateRow } from './api';
import { todayLondon } from '../lib/format';
import type { Action, Objective, Partnership, Preparation, ProgressUpdate, ProgressUpdateComment, Session } from '../lib/types';

function addDaysIso(days: number, time = '10:00:00Z'): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T${time}`;
}

function addDaysDate(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return todayLondon(d);
}

/**
 * Creates a self-contained, synthetic demo mentee partnership ("Alex Rivera (Demo)")
 * populated with a Mentoring Charter, 3 Objectives (with stages & milestones),
 * 3 Sessions (kick-off, progress review, and upcoming planned session with preparation),
 * 4 Actions (completed, in progress, not started, and blocked), and 4 Progress Updates
 * (achievement, evidence, feedback, and a flagged reflection) with coaching replies.
 */
export async function seedDemoMenteeWorkspace(): Promise<string> {
  const created = await createMenteePartnership({
    mentee_name: 'Alex Rivera (Demo)',
    title: 'Stepping into Staff-Level Technical Leadership',
    purpose:
      'Build confidence leading cross-team architecture decisions, delegating high-visibility delivery work without micromanaging, and communicating technical strategy clearly to senior stakeholders.',
    meeting_cadence: 'Fortnightly on Wednesdays, 45 minutes',
  });
  const pid = created.partnership_id;

  // Enrich the charter with a working agreement and review horizon
  await updateRow<Partnership>(
    'partnerships',
    pid,
    {
      status: 'active',
      working_agreement:
        '- Share brief preparation notes at least 24 hours before each session\n- Keep everything discussed confidential within this partnership\n- Focus on real, upcoming situations rather than abstract theory\n- Challenge assumptions candidly and constructively',
      review_horizon: addDaysDate(90),
    },
    1,
  );

  // 1. Create 3 Objectives across stages and statuses
  const obj1 = await insertRow<Objective>('objectives', {
    partnership_id: pid,
    title: 'Lead cross-team RFC and architecture reviews with confidence',
    success_criteria:
      'Independently chair at least three cross-team RFC reviews, surface trade-offs clearly without dominating the conversation, and publish a clear decision record within 48 hours of each review.',
    context:
      'Stepping from team-level tech lead into a cross-team leadership role where influencing without direct authority is essential.',
    development_area: 'Professional judgement',
    status: 'active',
    progress_stage: 'confident',
    review_date: addDaysDate(30),
    milestones: [
      { id: 'demo-m1', text: 'Shadow mentor chairing the Q1 Platform RFC review', done: true },
      { id: 'demo-m2', text: 'Draft a lightweight 1-page RFC decision template', done: true },
      { id: 'demo-m3', text: 'Chair the Payments Service RFC review with 3+ teams', done: true },
      { id: 'demo-m4', text: 'Chair the Q3 Event Mesh Architecture Board review', done: false },
    ],
  });

  const obj2 = await insertRow<Objective>('objectives', {
    partnership_id: pid,
    title: 'Delegate feature delivery ownership to mid-level engineers',
    success_criteria:
      'Hand over end-to-end technical leadership of two major workstreams to mid-level engineers on the squad, shifting my involvement from writing core PRs to coaching and design review.',
    context:
      'Currently a bottleneck on code reviews and release coordination, leaving little capacity for strategic architecture work.',
    development_area: 'Communication',
    status: 'active',
    progress_stage: 'building',
    review_date: addDaysDate(45),
    milestones: [
      { id: 'demo-m5', text: 'Write a clear guardrails & escalation checklist for workstream leads', done: true },
      { id: 'demo-m6', text: 'Delegate checkout webhook migration to Maya with weekly check-ins', done: true },
      { id: 'demo-m7', text: 'Hand over sprint release coordination to Sam', done: false },
    ],
  });

  const obj3 = await insertRow<Objective>('objectives', {
    partnership_id: pid,
    title: 'Establish a clear 6-month platform reliability roadmap',
    success_criteria:
      'Co-create and secure leadership sign-off on a pragmatic 6-month reliability roadmap tied to customer-facing SLOs rather than purely internal tech debt.',
    context: 'Needed to align engineering priorities with Product before annual planning.',
    development_area: 'Skills',
    status: 'achieved',
    progress_stage: 'embedded',
    review_date: addDaysDate(-14),
    closing_summary:
      'Presented the SLO-framed roadmap to Engineering and Product leadership; secured 30% capacity allocation for Q2–Q3 and established a monthly reliability review.',
    milestones: [
      { id: 'demo-m8', text: 'Audit top 5 incident root causes from the past 6 months', done: true },
      { id: 'demo-m9', text: 'Reframe technical proposals around customer impact and error budgets', done: true },
      { id: 'demo-m10', text: 'Present roadmap to Product & Engineering Directors and agree Q2 allocation', done: true },
    ],
  });

  // 2. Create 3 Sessions (Kick-off, Mid-quarter Progress Review, and Upcoming Session)
  const sess1 = await insertRow<Session>('sessions', {
    partnership_id: pid,
    scheduled_at: addDaysIso(-42, '10:00:00Z'),
    title: 'Kick-off: Agreeing our charter & initial objectives',
    location: 'Video call',
    meeting_link: 'https://meet.example.com/demo-kickoff',
    status: 'completed',
    is_review: false,
    discussion_notes:
      'Discussed what a successful 6 months of mentoring looks like for Alex.\n\nKey themes:\n- Moving from "strongest individual contributor in the room" to multiplier and facilitator.\n- Creating space for mid-level engineers to own outcomes even if they take a slightly different path.\n- Framing technical investments in terms of customer and product outcomes.',
    outcomes:
      '- Agreed our working charter and fortnightly cadence.\n- Activated three core objectives around RFC facilitation, delegation, and the reliability roadmap.\n- Agreed first step: reframe the reliability deck before meeting the Product Director.',
  });
  await setLinks(sess1.id, [obj1.id, obj2.id, obj3.id], []);

  const sess2 = await insertRow<Session>('sessions', {
    partnership_id: pid,
    scheduled_at: addDaysIso(-14, '10:00:00Z'),
    title: 'Mid-quarter Progress Review',
    location: 'Room 4B / Hybrid',
    meeting_link: 'https://meet.example.com/demo-review',
    status: 'completed',
    is_review: true,
    discussion_notes:
      'Reviewed progress across all three objectives.\n\n- Reliability roadmap objective is now complete and signed off.\n- Payments RFC review went very well; Alex used a structured decision table that prevented circular debate.\n- Delegation is progressing, though Alex noticed an urge to step back in when deadlines tighten.',
    outcomes:
      '- Marked "Establish a clear 6-month platform reliability roadmap" as Achieved.\n- Moved RFC facilitation stage to "Gaining confidence".\n- Agreed next focus: handing over release coordination and unblocking the Data Platform schema alignment.',
    review_changed:
      'Much stronger executive framing in stakeholder conversations, and noticeably calmer facilitation in cross-team architecture reviews.',
    review_difficult:
      'Resisting the urge to jump in and fix code directly when a delegated task hits an unexpected edge case.',
    review_focus:
      'Preparing for the Q3 Event Mesh Architecture Board and completing the release runbook handover.',
  });
  await setLinks(sess2.id, [obj1.id, obj2.id, obj3.id], []);

  const sess3 = await insertRow<Session>('sessions', {
    partnership_id: pid,
    scheduled_at: addDaysIso(7, '10:00:00Z'),
    title: 'Preparing for the Q3 Architecture Board & Delegation Check-in',
    location: 'Video call',
    meeting_link: 'https://meet.example.com/demo-upcoming',
    status: 'planned',
    is_review: false,
    discussion_notes: null,
    outcomes: null,
  });
  await setLinks(sess3.id, [obj1.id, obj2.id], []);

  // Add session preparation for the upcoming session
  await insertRow<Preparation>('session_preparation', {
    session_id: sess3.id,
    topics:
      '1. Dry-run the contentious trade-offs for the Event Mesh RFC before Thursday’s board.\n2. How to unblock the Data Platform schema versioning dependency without escalating prematurely.',
    recent_progress:
      'Completed the Payments RFC review and published the decision record within 24 hours. Maya shipped the checkout webhook migration independently.',
    difficulties:
      'The Data Platform team restructure has left our schema versioning action blocked for 10 days.',
    support_needed:
      'Could we spend 15 minutes role-playing potential pushback from the Principal Architect on the event retention trade-off?',
  });

  // 3. Create 4 Actions across statuses
  await insertRow<Action>('actions', {
    partnership_id: pid,
    title: 'Co-chair the Payments Service RFC review and publish decision record',
    description: 'Use the new 1-page trade-off matrix to keep the discussion focused on options and constraints.',
    owner_role: 'mentee',
    due_date: addDaysDate(-18),
    status: 'completed',
    objective_id: obj1.id,
    session_id: sess1.id,
    completion_note: 'Chaired the review with 12 engineers across 3 squads; decision record published the next morning.',
  });

  await insertRow<Action>('actions', {
    partnership_id: pid,
    title: 'Hand over sprint release coordination to Sam with a 1-page runbook',
    description: 'Shadow Sam on the next release, then step back to observer only.',
    owner_role: 'mentee',
    due_date: addDaysDate(5),
    status: 'in_progress',
    objective_id: obj2.id,
    session_id: sess2.id,
  });

  await insertRow<Action>('actions', {
    partnership_id: pid,
    title: 'Share example stakeholder briefing deck from last year’s platform review',
    description: 'Give Alex a concrete reference for structuring the Q3 Architecture Board pre-read.',
    owner_role: 'mentor',
    due_date: addDaysDate(4),
    status: 'not_started',
    objective_id: obj1.id,
    session_id: sess2.id,
  });

  await insertRow<Action>('actions', {
    partnership_id: pid,
    title: 'Agree event schema versioning contract with Data Platform lead',
    description: 'Align on backwards-compatibility window before publishing the Event Mesh RFC.',
    owner_role: 'mentee',
    due_date: addDaysDate(-2),
    status: 'blocked',
    objective_id: obj1.id,
    session_id: sess2.id,
    blocked_note:
      'Waiting on Data Platform team to confirm their Q3 tech lead after the team restructure — unsure whether to escalate or propose a provisional contract.',
  });

  // 4. Create 4 Progress Updates across all 4 types + coaching replies
  const upd1 = await insertRow<ProgressUpdate>('progress_updates', {
    partnership_id: pid,
    type: 'achievement',
    occurred_on: addDaysDate(-16),
    objective_id: obj1.id,
    session_id: sess2.id,
    discuss_next: false,
    links: ['https://example.com/docs/payments-rfc-decision-record'],
    content:
      'What was achieved:\nChaired the cross-team Payments Service RFC review (12 engineers across Checkout, Ledger, and SRE) and reached unanimous agreement on the idempotency design in 40 minutes.\n\nWhy it matters / impact:\nPreviously this RFC had stalled in async comments for three weeks. Writing the trade-off matrix ahead of time turned a heated debate into a structured evaluation.',
  });

  await insertRow<ProgressUpdateComment>('progress_update_comments', {
    partnership_id: pid,
    update_id: upd1.id,
    content:
      'Well done on this — separating the failure-mode constraints from personal preferences in the pre-read made all the difference. Great template to reuse for the Event Mesh board.',
  });

  await insertRow<ProgressUpdate>('progress_updates', {
    partnership_id: pid,
    type: 'evidence',
    occurred_on: addDaysDate(-20),
    objective_id: obj2.id,
    session_id: null,
    discuss_next: false,
    links: ['https://example.com/docs/delegation-guardrails'],
    content:
      'What I did / example:\nDelegated full ownership of the checkout webhook migration to Maya using a 1-page guardrails document (SLO targets, rollback criteria, and weekly check-in points) rather than specifying the implementation.\n\nOutcome / observable difference:\nMaya designed a cleaner retry queue than I had originally sketched, presented it to the squad herself, and delivered it two days ahead of schedule.',
  });

  await insertRow<ProgressUpdate>('progress_updates', {
    partnership_id: pid,
    type: 'feedback',
    occurred_on: addDaysDate(-25),
    objective_id: obj3.id,
    session_id: sess1.id,
    discuss_next: false,
    links: [],
    content:
      'Source / context of feedback:\nDirect feedback from the Product Director after our Q2–Q3 Platform Reliability Roadmap review.\n\nKey takeaway & how I will use it:\n"Framing the database failover work in terms of checkout availability and customer trust made it immediately obvious why we should fund this now." I will keep leading with user-facing SLO impact in future proposals.',
  });

  const upd4 = await insertRow<ProgressUpdate>('progress_updates', {
    partnership_id: pid,
    type: 'reflection',
    occurred_on: addDaysDate(-5),
    objective_id: obj2.id,
    session_id: null,
    discuss_next: true,
    links: [],
    content:
      'Situation:\nDuring Wednesday’s design critique on the notification service, a mid-level engineer got stuck answering a question about rate limiting.\n\nWhat I noticed / learned:\nI jumped in after 5 seconds to answer for them instead of asking a guiding question. Afterwards I realised I accidentally took the microphone away from them.\n\nWhat I’ll try next:\nWait at least 10 seconds in silence, or ask "How are you thinking about the burst traffic case?" so they keep ownership of the room.',
  });

  await insertRow<ProgressUpdateComment>('progress_update_comments', {
    partnership_id: pid,
    update_id: upd4.id,
    content:
      'Really self-aware observation. Let’s talk in our next session about a quick pre-meeting cue you can agree with the presenter so they know when they want you to step in vs. hold back.',
  });

  return pid;
}
