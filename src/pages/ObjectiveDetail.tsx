import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ActionList, NewActionButton } from '../components/ActionDialog';
import { UpdateList } from '../components/UpdateList';
import { NewUpdateButton } from '../components/UpdateDialog';
import { Attribution, Badge, ConflictBanner, EmptyState, LoadError, PageHeader, SaveBar, Select, Spinner, Text, TextArea, TextInput } from '../components/ui';
import { useEditor } from '../components/useEditor';
import { useActions, useArchive, useCreate, useObjectives, useSessionObjectives, useSessions, useUpdate, useUpdates } from '../data/hooks';
import { DEVELOPMENT_AREAS, formatDay, formatInstant, isObjectiveStalled, labels, todayLondon } from '../lib/format';
import type { Milestone, Objective, ObjectiveStage, ObjectiveStatus } from '../lib/types';

interface Draft {
  title: string;
  success_criteria: string;
  context: string;
  development_area: string;
  status: ObjectiveStatus;
  progress_stage: ObjectiveStage;
  milestones: Milestone[];
  review_date: string;
  closing_summary: string;
}

const toDraft = (o: Objective | undefined): Draft => ({
  title: o?.title ?? '',
  success_criteria: o?.success_criteria ?? '',
  context: o?.context ?? '',
  development_area: o?.development_area ?? '',
  status: o?.status ?? 'proposed',
  progress_stage: o?.progress_stage ?? 'starting',
  milestones: o?.milestones ?? [],
  review_date: o?.review_date ?? '',
  closing_summary: o?.closing_summary ?? '',
});
const nul = (s: string) => (s.trim() === '' ? null : s.trim());

export function ObjectiveDetail() {
  const { id } = useParams();
  const creating = id === 'new';
  const objectives = useObjectives();
  if (objectives.isPending) return <Spinner />;
  if (objectives.isError) return <LoadError error={objectives.error} retry={() => void objectives.refetch()} />;
  const record = creating ? undefined : objectives.data.find((o) => o.id === id);
  if (!creating && !record) return <EmptyState title="Objective not found" action={<Link to="/objectives" className="btn">Back to objectives</Link>} />;
  return <ObjectiveForm key={id} record={record} />;
}

function ObjectiveForm({ record }: { record?: Objective }) {
  const navigate = useNavigate();
  const create = useCreate<Objective>('objectives');
  const update = useUpdate<Objective>('objectives');
  const archive = useArchive<Objective>('objectives');
  const actions = useActions().data ?? [];
  const updates = useUpdates().data ?? [];
  const links = useSessionObjectives().data ?? [];
  const sessions = useSessions().data ?? [];
  const [showArchivedActions, setShowArchivedActions] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [newMilestoneText, setNewMilestoneText] = useState('');
  const [viewMode, setViewMode] = useState<'sections' | 'timeline'>('sections');
  const [activating, setActivating] = useState(false);

  const editor = useEditor<Draft, Objective>({
    record,
    toDraft,
    save: (d, base) => {
      const values = {
        title: d.title.trim(),
        success_criteria: d.success_criteria.trim(),
        context: nul(d.context),
        development_area: nul(d.development_area),
        status: d.status,
        progress_stage: d.progress_stage,
        milestones: d.milestones.filter((m) => m.text.trim() !== '').map((m) => ({ ...m, text: m.text.trim() })),
        review_date: nul(d.review_date),
        closing_summary: nul(d.closing_summary),
      };
      return base ? update.mutateAsync({ id: base.id, patch: values, version: base.version }) : create.mutateAsync(values);
    },
    onSaved: (saved) => { if (!record) navigate(`/objectives/${saved.id}`, { replace: true }); },
  });
  const d = editor.draft;
  const closing = d.status === 'achieved' || d.status === 'closed';
  const today = todayLondon();
  const stalled = record ? isObjectiveStalled(record, updates, today) : false;

  const myActions = record ? actions.filter((a) => a.objective_id === record.id && (showArchivedActions || !a.archived_at)) : [];
  const myUpdates = record
    ? updates.filter((u) => u.objective_id === record.id).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at))
    : [];
  const linkedSessions = record ? sessions.filter((s) => links.some((l) => l.objective_id === record.id && l.session_id === s.id)).sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)) : [];

  const addMilestone = () => {
    const trimmed = newMilestoneText.trim();
    if (!trimmed) return;
    const next: Milestone = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: trimmed,
      done: false,
    };
    editor.set('milestones', [...d.milestones, next]);
    setNewMilestoneText('');
  };

  const toggleMilestone = (mid: string) => {
    editor.set(
      'milestones',
      d.milestones.map((m) => (m.id === mid ? { ...m, done: !m.done } : m)),
    );
  };

  const removeMilestone = (mid: string) => {
    editor.set('milestones', d.milestones.filter((m) => m.id !== mid));
  };

  const agreeAndActivate = async () => {
    if (!record) return;
    if (!editor.dirty) {
      setActivating(true);
      try {
        const saved = await update.mutateAsync({ id: record.id, patch: { status: 'active' }, version: record.version });
        editor.adoptRecord(saved);
      } catch {
        editor.patch({ status: 'active' });
      } finally {
        setActivating(false);
      }
    } else {
      editor.patch({ status: 'active' });
    }
  };

  const storyItems = useMemo(() => {
    if (!record) return [];
    const items: { id: string; date: string; kind: string; title: string; detail?: string; to?: string }[] = [
      {
        id: `created-${record.id}`,
        date: record.created_at.slice(0, 10),
        kind: 'Objective created',
        title: `Proposed: ${record.title}`,
        detail: record.success_criteria,
      },
    ];
    for (const s of linkedSessions) {
      if (s.archived_at) continue;
      items.push({
        id: `sess-${s.id}`,
        date: s.scheduled_at.slice(0, 10),
        kind: `Session (${labels.session[s.status]})`,
        title: `${formatInstant(s.scheduled_at)}${s.title ? ` — ${s.title}` : ''}`,
        detail: s.outcomes ?? s.discussion_notes ?? undefined,
        to: `/sessions/${s.id}`,
      });
    }
    for (const a of actions.filter((x) => x.objective_id === record.id && !x.archived_at)) {
      const dateStr = (a.completed_at ?? a.updated_at).slice(0, 10);
      items.push({
        id: `act-${a.id}`,
        date: dateStr,
        kind: `Action (${labels.action[a.status]})`,
        title: a.title,
        detail: a.completion_note ?? a.blocked_note ?? a.description ?? undefined,
      });
    }
    for (const u of myUpdates.filter((x) => !x.archived_at)) {
      items.push({
        id: `upd-${u.id}`,
        date: u.occurred_on,
        kind: labels.update[u.type],
        title: `${labels.update[u.type]} (${formatDay(u.occurred_on)})`,
        detail: u.content,
      });
    }
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [record, linkedSessions, actions, myUpdates]);

  return (
    <>
      <p><Link to="/objectives">← Objectives</Link></p>
      <PageHeader title={record ? record.title : 'New objective'}>
        {record && <Badge status={record.status} label={labels.objective[record.status]} />}
        {record?.progress_stage && <Badge status="stage" label={labels.stage[record.progress_stage]} tone="plain" />}
        {stalled && <Badge status="stalled" label="Needs check-in (>30d)" tone="plain" />}
        {record?.archived_at && <Badge status="closed" label="Archived" tone="plain" />}
      </PageHeader>
      {record?.archived_at && (
        <p className="notice notice-info">This objective is archived. It stays linked to its actions, sessions and updates, and can be restored.</p>
      )}
      {record?.status === 'proposed' && (
        <div className="notice notice-info">
          <p>This objective is <strong>proposed</strong> — it hasn’t yet been agreed as something you’ll both work on.</p>
          <button type="button" className="btn btn-primary" disabled={activating} onClick={() => void agreeAndActivate()}>
            {activating ? 'Activating…' : 'Agree and activate'}
          </button>
          {editor.dirty && <span className="muted small"> (then save your other edits below)</span>}
        </div>
      )}

      <form className="panel" onSubmit={(e) => { e.preventDefault(); void editor.submit(); }}>
        <ConflictBanner editor={editor} fields={[
          { label: 'Title', read: (r) => r.title, draftRead: (dr) => dr.title },
          { label: 'What success looks like', read: (r) => r.success_criteria, draftRead: (dr) => dr.success_criteria },
          { label: 'Status', read: (r) => labels.objective[r.status], draftRead: (dr) => labels.objective[dr.status] },
          { label: 'Stage', read: (r) => (r.progress_stage ? labels.stage[r.progress_stage] : ''), draftRead: (dr) => labels.stage[dr.progress_stage] },
          { label: 'Context', read: (r) => r.context ?? '', draftRead: (dr) => dr.context },
          { label: 'Development area', read: (r) => r.development_area ?? '', draftRead: (dr) => dr.development_area },
          { label: 'Review date', read: (r) => r.review_date ?? '', draftRead: (dr) => dr.review_date },
          { label: 'Review summary', read: (r) => r.closing_summary ?? '', draftRead: (dr) => dr.closing_summary },
        ]} />
        <TextInput label="Objective" value={d.title} required maxLength={200} onChange={(v) => editor.set('title', v)} />
        <TextArea label="What would successful development look like?" hint="Describe it in observable terms — what will you be doing, or doing differently?"
          value={d.success_criteria} required rows={4} maxLength={5000} onChange={(v) => editor.set('success_criteria', v)} />
        <TextArea label="Context (optional)" hint="Why this matters now." value={d.context} rows={3} maxLength={5000} onChange={(v) => editor.set('context', v)} />
        <div className="grid2">
          <div className="field">
            <label htmlFor="dev-area">Development area (optional)</label>
            <input id="dev-area" list="dev-areas" value={d.development_area} maxLength={100} onChange={(e) => editor.set('development_area', e.target.value)} />
            <datalist id="dev-areas">{DEVELOPMENT_AREAS.map((a) => <option key={a} value={a} />)}</datalist>
          </div>
          <TextInput label="Target review date (optional)" type="date" value={d.review_date} onChange={(v) => editor.set('review_date', v)} />
        </div>
        <div className="grid2">
          <Select label="Status" value={d.status} onChange={(v) => editor.set('status', v)}
            hint="Proposed objectives are ideas not yet agreed. Active ones are being pursued."
            options={(Object.keys(labels.objective) as ObjectiveStatus[]).map((s) => ({ value: s, label: labels.objective[s] }))} />
          <Select label="Development stage" value={d.progress_stage} onChange={(v) => editor.set('progress_stage', v)}
            hint="Where you feel you are on this capability right now."
            options={(Object.keys(labels.stage) as ObjectiveStage[]).map((s) => ({ value: s, label: labels.stage[s] }))} />
        </div>

        <fieldset>
          <legend>Success milestones (optional)</legend>
          <p className="hint">Break "What success looks like" into observable signposts you can check off along the way.</p>
          {d.milestones.length > 0 && (
            <ul className="plain">
              {d.milestones.map((m) => (
                <li key={m.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--mist)', padding: '0.25rem 0' }}>
                  <label className="check" style={{ flex: 1 }}>
                    <input type="checkbox" checked={m.done} onChange={() => toggleMilestone(m.id)} />
                    <span style={m.done ? { textDecoration: 'line-through', color: 'var(--ink-soft)' } : undefined}>{m.text}</span>
                  </label>
                  <button type="button" className="btn btn-ghost small" onClick={() => removeMilestone(m.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <div className="row" style={{ marginTop: '0.5rem' }}>
            <input
              type="text"
              value={newMilestoneText}
              maxLength={300}
              onChange={(e) => setNewMilestoneText(e.target.value)}
              placeholder="Add a concrete milestone…"
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addMilestone();
                }
              }}
            />
            <button type="button" className="btn" onClick={addMilestone}>Add milestone</button>
          </div>
        </fieldset>

        {(closing || d.closing_summary) && (
          <TextArea label="Review summary" hint="What was learned or achieved, and what happens next." value={d.closing_summary} rows={4} maxLength={5000}
            onChange={(v) => editor.set('closing_summary', v)} />
        )}
        <SaveBar editor={editor} label={record ? 'Save objective' : 'Create objective'} />
      </form>
      {editor.guard}

      {record && (
        <>
          <p className="muted small">Record: <span className="mono">{record.id}</span></p>
          <Attribution record={record} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-ghost" onClick={async () => {
              setArchiveError(null);
              try {
                const saved = await archive(record, !record.archived_at);
                editor.adoptRecord(saved);
              } catch {
                setArchiveError('Couldn’t change the archive state — it may have been edited elsewhere. Reload and try again.');
              }
            }}>{record.archived_at ? 'Restore objective' : 'Archive objective'}</button>

            <div className="seg" role="group" aria-label="Objective view mode">
              <button type="button" className="btn btn-seg" aria-pressed={viewMode === 'sections'} onClick={() => setViewMode('sections')}>
                Sections view
              </button>
              <button type="button" className="btn btn-seg" aria-pressed={viewMode === 'timeline'} onClick={() => setViewMode('timeline')}>
                Story timeline ({storyItems.length})
              </button>
            </div>
          </div>
          {archiveError && <p className="notice notice-bad" role="alert">{archiveError}</p>}

          {viewMode === 'timeline' ? (
            <section aria-labelledby="h-story">
              <h2 id="h-story">Objective story timeline</h2>
              <p className="muted small">Chronological journey combining sessions, actions and progress updates for this objective.</p>
              <ul className="cards timeline-list">
                {storyItems.map((item) => (
                  <li key={item.id} className="card">
                    <div className="card-top">
                      <strong>{item.to ? <Link to={item.to}>{item.title}</Link> : item.title}</strong>
                      <span className="badges">
                        <Badge status="story" label={item.kind} tone="plain" />
                        <span className="muted small">{formatDay(item.date)}</span>
                      </span>
                    </div>
                    {item.detail && <Text>{item.detail}</Text>}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <>
              <section aria-labelledby="h-actions">
                <div className="section-head">
                  <h2 id="h-actions">Actions</h2>
                  <NewActionButton defaults={{ objective_id: record.id }} className="btn" />
                </div>
                <label className="check"><input type="checkbox" checked={showArchivedActions} onChange={(e) => setShowArchivedActions(e.target.checked)} /> Include archived</label>
                <ActionList actions={myActions} showLinks={false} empty={<EmptyState title="No actions for this objective">Agree a small next step and add it here.</EmptyState>} />
              </section>

              <section aria-labelledby="h-updates">
                <div className="section-head">
                  <h2 id="h-updates">Progress updates</h2>
                  <NewUpdateButton defaults={{ objective_id: record.id }} />
                </div>
                <UpdateList updates={myUpdates} showLinks={false}
                  empty={<EmptyState title="No progress updates yet">Reflections, examples, feedback and achievements will build up here, newest first.</EmptyState>} />
              </section>

              <section aria-labelledby="h-sessions">
                <h2 id="h-sessions">Sessions that covered this objective</h2>
                {linkedSessions.length === 0 ? <p className="muted">None yet. Link this objective from a session’s page.</p> : (
                  <ul className="plain">{linkedSessions.map((s) => (
                    <li key={s.id}><Link to={`/sessions/${s.id}`}>{formatInstant(s.scheduled_at)}{s.title ? ` — ${s.title}` : ''}</Link> · {labels.session[s.status]}{s.archived_at ? ' · Archived' : ''}</li>
                  ))}</ul>
                )}
              </section>
            </>
          )}
          {record.review_date && <p className="muted small">Target review: {formatDay(record.review_date)}</p>}
        </>
      )}
    </>
  );
}
