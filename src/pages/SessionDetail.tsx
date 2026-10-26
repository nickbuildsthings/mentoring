import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMe } from '../auth/AuthProvider';
import { usePartnership } from '../auth/PartnershipContext';
import { ActionList, NewActionButton } from '../components/ActionDialog';
import { NewUpdateButton } from '../components/UpdateDialog';
import { UpdateList } from '../components/UpdateList';
import { Attribution, Badge, ConflictBanner, EmptyState, LoadError, PageHeader, SaveBar, Select, SharedNotice, Spinner, Text, TextArea, TextInput } from '../components/ui';
import { useEditor } from '../components/useEditor';
import {
  useActions, useArchive, useCreate, useObjectives, usePreparations, useProfiles, useSessionObjectives, useSessions,
  useSetSessionObjectives, useUpdate, useUpdates,
} from '../data/hooks';
import { formatDay, formatInstant, isoToLondonLocal, labels, londonLocalToIso, todayLondon } from '../lib/format';
import { buildSessionIcs } from '../lib/ics';
import { safeUrl } from '../lib/links';
import type { Objective, ObjectiveStage, ObjectiveStatus, Preparation, Session, SessionStatus } from '../lib/types';

interface Draft {
  scheduled_at: string;
  title: string;
  location: string;
  meeting_link: string;
  status: SessionStatus;
  is_review: boolean;
  discussion_notes: string;
  outcomes: string;
  review_changed: string;
  review_difficult: string;
  review_focus: string;
  objective_ids: string[];
}
const nul = (s: string) => (s.trim() === '' ? null : s.trim());

function defaultStart(): string {
  const d = new Date(Date.now() + 7 * 864e5);
  return isoToLondonLocal(d.toISOString()).slice(0, 11) + '10:00';
}

function downloadIcs(session: Session) {
  const ics = buildSessionIcs(session);
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `mentoring-session-${session.scheduled_at.slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SessionDetail() {
  const { id } = useParams();
  const creating = id === 'new';
  const sessions = useSessions();
  const links = useSessionObjectives();
  if (sessions.isPending || links.isPending) return <Spinner />;
  if (sessions.isError) return <LoadError error={sessions.error} retry={() => void sessions.refetch()} />;
  const record = creating ? undefined : sessions.data.find((s) => s.id === id);
  if (!creating && !record) return <EmptyState title="Session not found" action={<Link to="/sessions" className="btn">Back to sessions</Link>} />;
  return <SessionPage key={id} record={record} />;
}

function SessionPage({ record }: { record?: Session }) {
  const navigate = useNavigate();
  const create = useCreate<Session>('sessions');
  const update = useUpdate<Session>('sessions');
  const setLinks = useSetSessionObjectives();
  const archive = useArchive<Session>('sessions');
  const objectives = useObjectives().data ?? [];
  const allLinks = useSessionObjectives().data ?? [];
  const sessions = useSessions().data ?? [];
  const actions = useActions().data ?? [];
  const updates = useUpdates().data ?? [];
  const preps = usePreparations().data ?? [];
  const profiles = useProfiles().data ?? [];
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const currentLinks = useMemo(() => (record ? allLinks.filter((l) => l.session_id === record.id).map((l) => l.objective_id) : []), [allLinks, record]);

  const toDraft = useMemo(() => (s: Session | undefined): Draft => ({
    scheduled_at: s ? isoToLondonLocal(s.scheduled_at) : defaultStart(),
    title: s?.title ?? '',
    location: s?.location ?? '',
    meeting_link: s?.meeting_link ?? '',
    status: s?.status ?? 'planned',
    is_review: s?.is_review ?? false,
    discussion_notes: s?.discussion_notes ?? '',
    outcomes: s?.outcomes ?? '',
    review_changed: s?.review_changed ?? '',
    review_difficult: s?.review_difficult ?? '',
    review_focus: s?.review_focus ?? '',
    objective_ids: [...currentLinks].sort(),
  }), [currentLinks]);

  const [linkProblem, setLinkProblem] = useState<string | null>(null);
  const editor = useEditor<Draft, Session>({
    record,
    toDraft,
    save: async (d, base) => {
      const link = d.meeting_link.trim();
      if (link && !safeUrl(link)) {
        setLinkProblem('The meeting link must be a web address starting with http:// or https://.');
        throw new Error('Invalid link');
      }
      setLinkProblem(null);
      const values = {
        scheduled_at: londonLocalToIso(d.scheduled_at),
        title: nul(d.title),
        location: nul(d.location),
        meeting_link: link ? safeUrl(link) : null,
        status: d.status,
        is_review: d.is_review,
        discussion_notes: nul(d.discussion_notes),
        outcomes: nul(d.outcomes),
        review_changed: nul(d.review_changed),
        review_difficult: nul(d.review_difficult),
        review_focus: nul(d.review_focus),
      };
      const saved = base
        ? await update.mutateAsync({ id: base.id, patch: values, version: base.version })
        : await create.mutateAsync(values);
      try {
        await setLinks.mutateAsync({ sessionId: saved.id, objectiveIds: d.objective_ids, current: base ? currentLinks : [] });
      } catch (err) {
        editor.adoptRecord(saved);
        if (!record) navigate(`/sessions/${saved.id}`, { replace: true });
        throw err;
      }
      return saved;
    },
    onSaved: (saved) => { if (!record) navigate(`/sessions/${saved.id}`, { replace: true }); },
  });
  const d = editor.draft;
  const toggleObjective = (oid: string) =>
    editor.set('objective_ids', (d.objective_ids.includes(oid) ? d.objective_ids.filter((x) => x !== oid) : [...d.objective_ids, oid]).sort());

  const linkable = objectives.filter((o) => !o.archived_at || d.objective_ids.includes(o.id));
  const sessionActions = record ? actions.filter((a) => a.session_id === record.id && !a.archived_at) : [];
  const sessionUpdates = record ? updates.filter((u) => u.session_id === record.id) : [];

  // REC-008 & REC-015: Carry-over actions include open actions from earlier sessions AND unlinked open actions created before this session
  const previousOutstanding = record
    ? actions.filter((a) => {
        if (a.archived_at || a.status === 'completed' || a.status === 'cancelled') return false;
        if (a.session_id === record.id) return false;
        if (!a.session_id) return a.created_at <= record.scheduled_at;
        const origin = sessions.find((s) => s.id === a.session_id);
        return Boolean(origin && origin.id !== record.id && origin.scheduled_at < record.scheduled_at);
      })
    : [];

  // REC-017: Progress updates flagged to discuss in the next session
  const flaggedUpdates = updates.filter((u) => !u.archived_at && u.discuss_next);

  const seedDiscussionFromPrep = () => {
    if (!record) return;
    const sessionPreps = preps.filter((p) => p.session_id === record.id);
    const sections: string[] = [];
    for (const p of sessionPreps) {
      const author = profiles.find((pr) => pr.id === p.created_by);
      const header = `### Preparation — ${author?.display_name ?? 'Participant'}`;
      const items = [
        p.topics && `- **Topics:** ${p.topics}`,
        p.recent_progress && `- **Recent progress:** ${p.recent_progress}`,
        p.difficulties && `- **Difficulties:** ${p.difficulties}`,
        p.support_needed && `- **Support needed:** ${p.support_needed}`,
      ].filter(Boolean);
      if (items.length > 0) sections.push(`${header}\n${items.join('\n')}`);
    }
    if (flaggedUpdates.length > 0) {
      sections.push(
        `### Flagged updates to discuss\n` +
          flaggedUpdates.map((u) => `- (${labels.update[u.type]}, ${formatDay(u.occurred_on)}) ${u.content.slice(0, 140)}`).join('\n'),
      );
    }
    if (previousOutstanding.length > 0) {
      sections.push(
        `### Carry-over actions\n` +
          previousOutstanding.map((a) => `- [${labels.action[a.status]}] ${a.title}`).join('\n'),
      );
    }
    if (sections.length === 0) return;
    const block = sections.join('\n\n');
    const nextNotes = d.discussion_notes.trim() ? `${d.discussion_notes.trim()}\n\n${block}` : block;
    editor.set('discussion_notes', nextNotes);
  };

  const isPlanned = Boolean(record && d.status === 'planned');
  const isCompleted = Boolean(record && d.status === 'completed');

  return (
    <>
      <p><Link to="/sessions">← Sessions</Link></p>
      <PageHeader title={record ? `Session — ${formatInstant(record.scheduled_at)}` : 'New session'}>
        {record && <Badge status={record.status} label={labels.session[record.status]} />}
        {record?.is_review && <Badge status="achieved" label="Progress review" tone="plain" />}
        {record?.archived_at && <Badge status="closed" label="Archived" tone="plain" />}
        {record && (
          <button type="button" className="btn btn-ghost small" onClick={() => downloadIcs(record)}>
            Download calendar invite (.ics)
          </button>
        )}
      </PageHeader>
      {record?.archived_at && <p className="notice notice-info">This session is archived. Its links stay navigable and it can be restored.</p>}

      {isCompleted && record && (
        <div className="notice notice-info row" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>Session completed</strong>
            <p className="small">Have you captured agreed actions, reflections or achievements from this conversation, and booked your next session?</p>
          </div>
          <div className="row">
            <Link to="/sessions/new" className="btn btn-primary">Schedule next session</Link>
          </div>
        </div>
      )}

      {/* REC-015: When session is planned, surface Preparation and Carry-over Agenda first so the conversation starts from shared preparation */}
      {isPlanned && record && (
        <>
          <PreparationSection session={record} onSeedAgenda={seedDiscussionFromPrep} />
          <CarryOverAgenda previousOutstanding={previousOutstanding} flaggedUpdates={flaggedUpdates} />
        </>
      )}

      <form className="panel" onSubmit={(e) => { e.preventDefault(); void editor.submit(); }}>
        <ConflictBanner editor={editor} fields={[
          { label: 'Date and time', read: (r) => isoToLondonLocal(r.scheduled_at), draftRead: (dr) => dr.scheduled_at },
          { label: 'Title', read: (r) => r.title ?? '', draftRead: (dr) => dr.title },
          { label: 'Status', read: (r) => labels.session[r.status], draftRead: (dr) => labels.session[dr.status] },
          { label: 'Location', read: (r) => r.location ?? '', draftRead: (dr) => dr.location },
          { label: 'Meeting link', read: (r) => r.meeting_link ?? '', draftRead: (dr) => dr.meeting_link },
          { label: 'Discussion notes', read: (r) => r.discussion_notes ?? '', draftRead: (dr) => dr.discussion_notes },
          { label: 'Agreed outcomes', read: (r) => r.outcomes ?? '', draftRead: (dr) => dr.outcomes },
          { label: 'Review: What has changed', read: (r) => r.review_changed ?? '', draftRead: (dr) => dr.review_changed },
          { label: 'Review: What remains difficult', read: (r) => r.review_difficult ?? '', draftRead: (dr) => dr.review_difficult },
          { label: 'Review: Focus next', read: (r) => r.review_focus ?? '', draftRead: (dr) => dr.review_focus },
        ]} />
        <h2>Details</h2>
        <div className="grid2">
          <TextInput label="Date and time (UK time)" type="datetime-local" value={d.scheduled_at} required onChange={(v) => editor.set('scheduled_at', v)} />
          <Select label="Status" value={d.status} onChange={(v) => editor.set('status', v)}
            options={(Object.keys(labels.session) as SessionStatus[]).map((s) => ({ value: s, label: labels.session[s] }))} />
        </div>
        <TextInput label="Title (optional)" value={d.title} maxLength={200} onChange={(v) => editor.set('title', v)} />
        <div className="grid2">
          <TextInput label="Location (optional)" value={d.location} maxLength={300} onChange={(v) => editor.set('location', v)} />
          <TextInput label="Meeting link (optional)" type="url" value={d.meeting_link} onChange={(v) => editor.set('meeting_link', v)} placeholder="https://" />
        </div>
        {linkProblem && <p className="notice notice-bad" role="alert">{linkProblem}</p>}
        <label className="check"><input type="checkbox" checked={d.is_review} onChange={(e) => editor.set('is_review', e.target.checked)} /> This is a progress review</label>

        <fieldset>
          <legend>Objectives covered</legend>
          {linkable.length === 0 ? <p className="muted">No objectives yet. <Link to="/objectives/new">Propose one</Link>.</p> : (
            <ul className="plain">{linkable.map((o) => (
              <li key={o.id}><label className="check"><input type="checkbox" checked={d.objective_ids.includes(o.id)} onChange={() => toggleObjective(o.id)} /> {o.title} <span className="muted small">({labels.objective[o.status]})</span></label></li>
            ))}</ul>
          )}
        </fieldset>

        <div className="section-head">
          <h2>Notes and outcomes</h2>
          {record && (
            <button type="button" className="btn btn-ghost small" onClick={seedDiscussionFromPrep}>
              Seed discussion notes from preparation
            </button>
          )}
        </div>
        <SharedNotice />
        <TextArea label="Discussion notes" value={d.discussion_notes} rows={8} maxLength={50000} onChange={(v) => editor.set('discussion_notes', v)} />
        <TextArea label="Summary of agreed outcomes" value={d.outcomes} rows={4} maxLength={10000} onChange={(v) => editor.set('outcomes', v)} />

        {d.is_review && (
          <>
            <h2>Review</h2>
            <TextArea label="What has changed?" value={d.review_changed} rows={3} maxLength={5000} onChange={(v) => editor.set('review_changed', v)} />
            <TextArea label="What remains difficult?" value={d.review_difficult} rows={3} maxLength={5000} onChange={(v) => editor.set('review_difficult', v)} />
            <TextArea label="What should be the focus next?" value={d.review_focus} rows={3} maxLength={5000} onChange={(v) => editor.set('review_focus', v)} />
          </>
        )}
        <div className="sticky-save"><SaveBar editor={editor} label={record ? 'Save session' : 'Create session'} /></div>
      </form>
      {editor.guard}

      {!record && <p className="muted">Save the session to add preparation notes, actions and progress updates.</p>}

      {record && (
        <>
          <Attribution record={record} />
          <p className="muted small">Record: <span className="mono">{record.id}</span></p>
          {record.meeting_link && <p>Meeting link: <a href={record.meeting_link} target="_blank" rel="noopener noreferrer">{record.meeting_link}</a></p>}
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={async () => {
              setArchiveError(null);
              try {
                const saved = await archive(record, !record.archived_at);
                editor.adoptRecord(saved);
              } catch {
                setArchiveError('Couldn’t change the archive state — it may have been edited elsewhere. Reload and try again.');
              }
            }}>{record.archived_at ? 'Restore session' : 'Archive session'}</button>
          </div>
          {archiveError && <p className="notice notice-bad" role="alert">{archiveError}</p>}

          {record.is_review && <ReviewSection currentSession={record} />}

          <section aria-labelledby="h-act">
            <div className="section-head">
              <h2 id="h-act">Actions from this session</h2>
              <NewActionButton defaults={{ session_id: record.id, objective_id: d.objective_ids.length === 1 ? d.objective_ids[0] : undefined }} />
            </div>
            <ActionList actions={sessionActions} showLinks={false} empty={<EmptyState title="No actions yet">Record what each of you has agreed to do next.</EmptyState>} />
          </section>

          <section aria-labelledby="h-upd">
            <div className="section-head">
              <h2 id="h-upd">Progress updates from this session</h2>
              <NewUpdateButton defaults={{ session_id: record.id, objective_id: d.objective_ids.length === 1 ? d.objective_ids[0] : undefined }} />
            </div>
            <UpdateList updates={[...sessionUpdates].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))} showLinks={false}
              empty={<p className="muted">No updates linked to this session.</p>} />
          </section>

          {!isPlanned && (
            <>
              <PreparationSection session={record} onSeedAgenda={seedDiscussionFromPrep} />
              <CarryOverAgenda previousOutstanding={previousOutstanding} flaggedUpdates={flaggedUpdates} />
            </>
          )}
        </>
      )}
    </>
  );
}

function CarryOverAgenda({
  previousOutstanding,
  flaggedUpdates,
}: {
  previousOutstanding: ReturnType<typeof useActions>['data'] extends (infer T)[] | undefined ? T[] : never;
  flaggedUpdates: ReturnType<typeof useUpdates>['data'] extends (infer U)[] | undefined ? U[] : never;
}) {
  const blocked = previousOutstanding.filter((a) => a.status === 'blocked');
  return (
    <section aria-labelledby="h-prev">
      <h2 id="h-prev">Carry-over actions &amp; flagged updates</h2>
      {blocked.length > 0 && (
        <div className="notice notice-bad">
          <strong>⚠ {blocked.length} carry-over {blocked.length === 1 ? 'action is' : 'actions are'} blocked</strong>
          <p className="small">Discuss what is getting in the way and whether the approach needs to change.</p>
        </div>
      )}
      {flaggedUpdates.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h3>Updates flagged for discussion</h3>
          <UpdateList updates={flaggedUpdates} />
        </div>
      )}
      <h3>Outstanding actions from earlier</h3>
      <ActionList actions={previousOutstanding} empty={<p className="muted">Nothing outstanding from earlier sessions.</p>} />
    </section>
  );
}

interface PrepDraft { topics: string; recent_progress: string; difficulties: string; support_needed: string }
const PREP_FIELDS: { key: keyof PrepDraft; label: string; hint: string }[] = [
  { key: 'topics', label: 'Topics to discuss', hint: 'What would you like to use the time for?' },
  { key: 'recent_progress', label: 'Recent progress', hint: 'What has moved forward since last time?' },
  { key: 'difficulties', label: 'Difficulties', hint: 'Anything that has been hard or unclear.' },
  { key: 'support_needed', label: 'Support needed', hint: 'What would help from the other person?' },
];
const prepToDraft = (p: Preparation | undefined): PrepDraft => ({
  topics: p?.topics ?? '', recent_progress: p?.recent_progress ?? '', difficulties: p?.difficulties ?? '', support_needed: p?.support_needed ?? '',
});

function PreparationSection({ session, onSeedAgenda }: { session: Session; onSeedAgenda?: () => void }) {
  const me = useMe();
  const { activePartnership } = usePartnership();
  const profiles = useProfiles().data ?? [];
  const preps = usePreparations().data ?? [];

  // Scope preparation cards to the two participants of the active partnership
  const participantIds = activePartnership
    ? [activePartnership.mentor_id, activePartnership.mentee_id].filter((x): x is string => Boolean(x))
    : profiles.map((p) => p.id);
  const participants = profiles.filter((p) => participantIds.includes(p.id));
  const ordered = [...(participants.length > 0 ? participants : profiles)].sort((a, b) =>
    a.role === b.role ? 0 : a.role === 'mentor' ? -1 : 1,
  );

  return (
    <section aria-labelledby="h-prep">
      <div className="section-head">
        <h2 id="h-prep">Preparation</h2>
        {onSeedAgenda && (
          <button type="button" className="btn btn-ghost small" onClick={onSeedAgenda}>
            Seed discussion notes from preparation
          </button>
        )}
      </div>
      <SharedNotice />
      <div className="grid2">
        {ordered.map((p) => {
          const prep = preps.find((x) => x.session_id === session.id && x.created_by === p.id);
          return p.id === me.id
            ? <OwnPreparation key={p.id} session={session} prep={prep} name={p.display_name} role={labels.role[p.role]} />
            : <OtherPreparation key={p.id} prep={prep} name={p.display_name} role={labels.role[p.role]} />;
        })}
      </div>
    </section>
  );
}

function OtherPreparation({ prep, name, role }: { prep?: Preparation; name: string; role: string }) {
  return (
    <div className="panel">
      <h3>{name} <span className="muted small">({role})</span></h3>
      {!prep ? <p className="muted">Not added yet.</p> : (
        <>
          {PREP_FIELDS.map((f) => prep[f.key] ? (
            <div key={f.key}>
              <h4>{f.label}{f.key === 'support_needed' ? ' (Support request)' : ''}</h4>
              <Text>{prep[f.key]}</Text>
            </div>
          ) : null)}
          <p className="muted small">Last edited {formatInstant(prep.updated_at)}</p>
        </>
      )}
    </div>
  );
}

function OwnPreparation({ session, prep, name, role }: { session: Session; prep?: Preparation; name: string; role: string }) {
  const create = useCreate<Preparation>('session_preparation');
  const update = useUpdate<Preparation>('session_preparation');
  const editor = useEditor<PrepDraft, Preparation>({
    record: prep,
    toDraft: prepToDraft,
    save: (d, base) => {
      const values = { topics: nul(d.topics), recent_progress: nul(d.recent_progress), difficulties: nul(d.difficulties), support_needed: nul(d.support_needed) };
      return base ? update.mutateAsync({ id: base.id, patch: values, version: base.version }) : create.mutateAsync({ ...values, session_id: session.id });
    },
  });
  return (
    <form className="panel" onSubmit={(e) => { e.preventDefault(); void editor.submit(); }}>
      <h3>{name} <span className="muted small">({role} — you)</span></h3>
      <ConflictBanner editor={editor} fields={PREP_FIELDS.map((f) => ({ label: f.label, read: (r: Preparation) => r[f.key] ?? '', draftRead: (dr: PrepDraft) => dr[f.key] }))} />
      {PREP_FIELDS.map((f) => (
        <TextArea key={f.key} label={f.label} hint={f.hint} value={editor.draft[f.key]} rows={3} maxLength={5000} onChange={(v) => editor.set(f.key, v)} />
      ))}
      <SaveBar editor={editor} label="Save my preparation" />
      {editor.guard}
    </form>
  );
}

function ReviewSection({ currentSession }: { currentSession: Session }) {
  const objectives = useObjectives().data ?? [];
  const updates = useUpdates().data ?? [];
  const actions = useActions().data ?? [];
  const sessions = useSessions().data ?? [];

  // Find the most recent previous review session before this session
  const previousReview = sessions
    .filter((s) => s.is_review && !s.archived_at && s.id !== currentSession.id && s.scheduled_at < currentSession.scheduled_at)
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))[0];

  const sinceIso = previousReview?.scheduled_at ?? '0000-01-01T00:00:00Z';
  const sinceDate = sinceIso.slice(0, 10);

  const sessionsSince = sessions.filter(
    (s) => !s.archived_at && s.status === 'completed' && s.scheduled_at > sinceIso && s.scheduled_at <= currentSession.scheduled_at,
  );
  const actionsCompletedSince = actions.filter(
    (a) => !a.archived_at && a.status === 'completed' && (a.completed_at ?? a.updated_at) > sinceIso,
  );
  const objectivesAchieved = objectives.filter((o) => !o.archived_at && o.status === 'achieved');
  const updatesSince = updates.filter((u) => !u.archived_at && u.occurred_on >= sinceDate);

  const active = objectives.filter((o) => (o.status === 'active' || o.status === 'proposed' || o.status === 'paused') && !o.archived_at);
  // REC-008: Include reflections as well as evidence, feedback and achievements in the Review Workspace
  const recent = [...updates]
    .filter((u) => !u.archived_at)
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at))
    .slice(0, 10);
  const open = actions.filter((a) => !a.archived_at && a.status !== 'completed' && a.status !== 'cancelled');

  return (
    <section aria-labelledby="h-review" className="review">
      <h2 id="h-review">Review workspace</h2>
      <p className="muted">Everything you need for this progress review in one place.</p>

      <div className="panel" style={{ background: 'var(--emerald-tint)', borderColor: 'var(--emerald)' }}>
        <h3 style={{ marginTop: 0 }}>
          Since {previousReview ? `last review (${formatDay(previousReview.scheduled_at)})` : 'the start of your partnership'}
        </h3>
        <div className="grid2">
          <p className="small"><strong>{sessionsSince.length}</strong> completed {sessionsSince.length === 1 ? 'session' : 'sessions'}</p>
          <p className="small"><strong>{actionsCompletedSince.length}</strong> {actionsCompletedSince.length === 1 ? 'action' : 'actions'} completed</p>
          <p className="small"><strong>{updatesSince.length}</strong> progress {updatesSince.length === 1 ? 'update' : 'updates'} recorded</p>
          <p className="small"><strong>{objectivesAchieved.length}</strong> {objectivesAchieved.length === 1 ? 'objective' : 'objectives'} achieved overall</p>
        </div>
      </div>

      <h3>Objectives in focus</h3>
      {active.length === 0 ? <p className="muted">No active objectives.</p> : (
        <ul className="cards">
          {active.map((o) => (
            <li key={o.id} className="card">
              <ReviewObjective
                objective={o}
                latest={updates.filter((u) => u.objective_id === o.id && !u.archived_at).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))[0]?.content}
              />
            </li>
          ))}
        </ul>
      )}
      <h3>Recent reflections, evidence, feedback and achievements</h3>
      <UpdateList updates={recent} empty={<p className="muted">None recorded yet.</p>} />
      <h3>Outstanding actions</h3>
      <ActionList actions={open} empty={<p className="muted">No outstanding actions.</p>} />
    </section>
  );
}

function ReviewObjective({ objective, latest }: { objective: Objective; latest?: string }) {
  const update = useUpdate<Objective>('objectives');
  const [status, setStatus] = useState<ObjectiveStatus>(objective.status);
  const [stage, setStage] = useState<ObjectiveStage>(objective.progress_stage ?? 'starting');
  const [reviewDate, setReviewDate] = useState<string>(objective.review_date ?? '');
  const [closingSummary, setClosingSummary] = useState<string>(objective.closing_summary ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty =
    status !== objective.status ||
    stage !== (objective.progress_stage ?? 'starting') ||
    reviewDate !== (objective.review_date ?? '') ||
    closingSummary !== (objective.closing_summary ?? '');

  const saveReviewChanges = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await update.mutateAsync({
        id: objective.id,
        version: objective.version,
        patch: {
          status,
          progress_stage: stage,
          review_date: reviewDate.trim() || null,
          closing_summary: closingSummary.trim() || null,
        },
      });
      setMsg('Saved');
    } catch {
      setMsg('Couldn’t save — this objective may have been changed by someone else. Reload to see the latest.');
    } finally {
      setSaving(false);
    }
  };

  const overdue = reviewDate && reviewDate < todayLondon();
  const isClosing = status === 'achieved' || status === 'closed';

  return (
    <>
      <div className="card-top">
        <Link to={`/objectives/${objective.id}`}><strong>{objective.title}</strong></Link>
        <Badge status={objective.status} label={labels.objective[objective.status]} />
      </div>
      <p className="small">{objective.success_criteria.slice(0, 200)}{objective.success_criteria.length > 200 ? '…' : ''}</p>
      {latest && <p className="small muted">Latest update: {latest.slice(0, 160)}{latest.length > 160 ? '…' : ''}</p>}
      <div className="grid2">
        <Select label="Status" value={status} onChange={(v: ObjectiveStatus) => { setStatus(v); setMsg(null); }}
          options={(Object.keys(labels.objective) as ObjectiveStatus[]).map((s) => ({ value: s, label: labels.objective[s] }))} />
        <Select label="Development stage" value={stage} onChange={(v: ObjectiveStage) => { setStage(v); setMsg(null); }}
          options={(Object.keys(labels.stage) as ObjectiveStage[]).map((s) => ({ value: s, label: labels.stage[s] }))} />
      </div>
      <TextInput label={`Target review date${overdue ? ' (past)' : ''}`} type="date" value={reviewDate} onChange={(v) => { setReviewDate(v); setMsg(null); }} />
      {(isClosing || closingSummary) && (
        <TextArea label="Closing / review summary" hint="What was learned or achieved, and what happens next." value={closingSummary} rows={3} maxLength={5000}
          onChange={(v) => { setClosingSummary(v); setMsg(null); }} />
      )}
      <div className="row" style={{ marginTop: '0.5rem' }}>
        <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={() => void saveReviewChanges()}>
          {saving ? 'Saving…' : 'Save objective review'}
        </button>
        {reviewDate && <span className="muted small">Target review: {formatDay(reviewDate)}</span>}
        {msg && <span role="status" aria-live="polite" className="small">{msg}</span>}
      </div>
    </>
  );
}
