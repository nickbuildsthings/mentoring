import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMe } from '../auth/AuthProvider';
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
import { safeUrl } from '../lib/links';
import type { Objective, ObjectiveStatus, Preparation, Session, SessionStatus } from '../lib/types';

interface Draft {
  scheduled_at: string; title: string; location: string; meeting_link: string; status: SessionStatus; is_review: boolean;
  discussion_notes: string; outcomes: string; review_changed: string; review_difficult: string; review_focus: string; objective_ids: string[];
}
const nul = (s: string) => (s.trim() === '' ? null : s.trim());

function defaultStart(): string {
  const d = new Date(Date.now() + 7 * 864e5);
  return isoToLondonLocal(d.toISOString()).slice(0, 11) + '10:00';
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
  const archive = useArchive('sessions');
  const objectives = useObjectives().data ?? [];
  const allLinks = useSessionObjectives().data ?? [];
  const sessions = useSessions().data ?? [];
  const actions = useActions().data ?? [];
  const updates = useUpdates().data ?? [];
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const currentLinks = useMemo(() => (record ? allLinks.filter((l) => l.session_id === record.id).map((l) => l.objective_id) : []), [allLinks, record]);

  const toDraft = useMemo(() => (s: Session | undefined): Draft => ({
    scheduled_at: s ? isoToLondonLocal(s.scheduled_at) : defaultStart(), title: s?.title ?? '', location: s?.location ?? '',
    meeting_link: s?.meeting_link ?? '', status: s?.status ?? 'planned', is_review: s?.is_review ?? false,
    discussion_notes: s?.discussion_notes ?? '', outcomes: s?.outcomes ?? '', review_changed: s?.review_changed ?? '',
    review_difficult: s?.review_difficult ?? '', review_focus: s?.review_focus ?? '',
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
        scheduled_at: londonLocalToIso(d.scheduled_at), title: nul(d.title), location: nul(d.location),
        meeting_link: link ? safeUrl(link) : null, status: d.status, is_review: d.is_review,
        discussion_notes: nul(d.discussion_notes), outcomes: nul(d.outcomes), review_changed: nul(d.review_changed),
        review_difficult: nul(d.review_difficult), review_focus: nul(d.review_focus),
      };
      const saved = base
        ? await update.mutateAsync({ id: base.id, patch: values, version: base.version })
        : await create.mutateAsync(values);
      await setLinks.mutateAsync({ sessionId: saved.id, objectiveIds: d.objective_ids, current: base ? currentLinks : [] });
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
  const previousOutstanding = record
    ? actions.filter((a) => {
        const origin = sessions.find((s) => s.id === a.session_id);
        return origin && origin.id !== record.id && origin.scheduled_at < record.scheduled_at && !a.archived_at && a.status !== 'completed' && a.status !== 'cancelled';
      })
    : [];

  return (
    <>
      <p><Link to="/sessions">← Sessions</Link></p>
      <PageHeader title={record ? `Session — ${formatInstant(record.scheduled_at)}` : 'New session'}>
        {record && <Badge status={record.status} label={labels.session[record.status]} />}
        {record?.is_review && <Badge status="achieved" label="Progress review" tone="plain" />}
        {record?.archived_at && <Badge status="closed" label="Archived" tone="plain" />}
      </PageHeader>
      {record?.archived_at && <p className="notice notice-info">This session is archived. Its links stay navigable and it can be restored.</p>}

      <form className="panel" onSubmit={(e) => { e.preventDefault(); void editor.submit(); }}>
        <ConflictBanner editor={editor} fields={[
          { label: 'Title', read: (r) => r.title ?? '' }, { label: 'Status', read: (r) => labels.session[r.status] },
          { label: 'Discussion notes', read: (r) => r.discussion_notes ?? '' }, { label: 'Agreed outcomes', read: (r) => r.outcomes ?? '' },
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

        <h2>Notes and outcomes</h2>
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
              try { await archive(record, !record.archived_at); } catch { setArchiveError('Couldn’t change the archive state — it may have been edited elsewhere. Reload and try again.'); }
            }}>{record.archived_at ? 'Restore session' : 'Archive session'}</button>
          </div>
          {archiveError && <p className="notice notice-bad" role="alert">{archiveError}</p>}

          <PreparationSection session={record} />

          {record.is_review && <ReviewSection />}

          <section aria-labelledby="h-prev">
            <h2 id="h-prev">Outstanding actions from earlier sessions</h2>
            <ActionList actions={previousOutstanding} empty={<p className="muted">Nothing outstanding from earlier sessions.</p>} />
          </section>

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
        </>
      )}
    </>
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

function PreparationSection({ session }: { session: Session }) {
  const me = useMe();
  const profiles = useProfiles().data ?? [];
  const preps = usePreparations().data ?? [];
  const ordered = [...profiles].sort((a, b) => (a.role === b.role ? 0 : a.role === 'mentor' ? -1 : 1));
  return (
    <section aria-labelledby="h-prep">
      <h2 id="h-prep">Preparation</h2>
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
          {PREP_FIELDS.map((f) => prep[f.key] ? <div key={f.key}><h4>{f.label}</h4><Text>{prep[f.key]}</Text></div> : null)}
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
      <ConflictBanner editor={editor} fields={PREP_FIELDS.map((f) => ({ label: f.label, read: (r: Preparation) => r[f.key] ?? '' }))} />
      {PREP_FIELDS.map((f) => (
        <TextArea key={f.key} label={f.label} hint={f.hint} value={editor.draft[f.key]} rows={3} maxLength={5000} onChange={(v) => editor.set(f.key, v)} />
      ))}
      <SaveBar editor={editor} label="Save my preparation" />
      {editor.guard}
    </form>
  );
}

function ReviewSection() {
  const objectives = useObjectives().data ?? [];
  const updates = useUpdates().data ?? [];
  const actions = useActions().data ?? [];
  const active = objectives.filter((o) => o.status === 'active' && !o.archived_at);
  const recent = updates.filter((u) => !u.archived_at && u.type !== 'reflection').sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)).slice(0, 8);
  const open = actions.filter((a) => !a.archived_at && a.status !== 'completed' && a.status !== 'cancelled');
  return (
    <section aria-labelledby="h-review" className="review">
      <h2 id="h-review">Review workspace</h2>
      <p className="muted">Everything you need for this review in one place. Changes to status and review dates save straight away.</p>
      <h3>Active objectives</h3>
      {active.length === 0 ? <p className="muted">No active objectives.</p> : (
        <ul className="cards">{active.map((o) => <li key={o.id} className="card"><ReviewObjective objective={o} latest={updates.filter((u) => u.objective_id === o.id && !u.archived_at).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))[0]?.content} /></li>)}</ul>
      )}
      <h3>Recent evidence, feedback and achievements</h3>
      <UpdateList updates={recent} empty={<p className="muted">None recorded yet.</p>} />
      <h3>Outstanding actions</h3>
      <ActionList actions={open} empty={<p className="muted">No outstanding actions.</p>} />
    </section>
  );
}

function ReviewObjective({ objective, latest }: { objective: Objective; latest?: string }) {
  const update = useUpdate<Objective>('objectives');
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (patch: Record<string, unknown>) => {
    setMsg(null);
    try { await update.mutateAsync({ id: objective.id, version: objective.version, patch }); setMsg('Saved'); }
    catch { setMsg('Couldn’t save — this objective may have been changed by someone else. Reload to see the latest.'); }
  };
  const overdue = objective.review_date && objective.review_date < todayLondon();
  return (
    <>
      <p><Link to={`/objectives/${objective.id}`}><strong>{objective.title}</strong></Link></p>
      <p className="small">{objective.success_criteria.slice(0, 200)}{objective.success_criteria.length > 200 ? '…' : ''}</p>
      {latest && <p className="small muted">Latest update: {latest.slice(0, 160)}{latest.length > 160 ? '…' : ''}</p>}
      <div className="grid2">
        <Select label="Status" value={objective.status} onChange={(v: ObjectiveStatus) => void save({ status: v })}
          options={(Object.keys(labels.objective) as ObjectiveStatus[]).map((s) => ({ value: s, label: labels.objective[s] }))} />
        <TextInput label={`Review date${overdue ? ' (past)' : ''}`} type="date" value={objective.review_date ?? ''} onChange={(v) => void save({ review_date: v || null })} />
      </div>
      {objective.review_date && <p className="muted small">Target review: {formatDay(objective.review_date)}</p>}
      <p role="status" aria-live="polite" className="muted small">{msg}</p>
    </>
  );
}

