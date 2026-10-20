import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ActionList, NewActionButton } from '../components/ActionDialog';
import { UpdateList } from '../components/UpdateList';
import { NewUpdateButton } from '../components/UpdateDialog';
import { Attribution, Badge, ConflictBanner, EmptyState, LoadError, PageHeader, SaveBar, Select, Spinner, TextArea, TextInput } from '../components/ui';
import { useEditor } from '../components/useEditor';
import { useActions, useArchive, useCreate, useObjectives, useSessionObjectives, useSessions, useUpdate, useUpdates } from '../data/hooks';
import { DEVELOPMENT_AREAS, formatDay, formatInstant, labels } from '../lib/format';
import type { Objective, ObjectiveStatus } from '../lib/types';

interface Draft {
  title: string; success_criteria: string; context: string; development_area: string;
  status: ObjectiveStatus; review_date: string; closing_summary: string;
}

const toDraft = (o: Objective | undefined): Draft => ({
  title: o?.title ?? '', success_criteria: o?.success_criteria ?? '', context: o?.context ?? '',
  development_area: o?.development_area ?? '', status: o?.status ?? 'proposed', review_date: o?.review_date ?? '',
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
  const archive = useArchive('objectives');
  const actions = useActions().data ?? [];
  const updates = useUpdates().data ?? [];
  const links = useSessionObjectives().data ?? [];
  const sessions = useSessions().data ?? [];
  const [showArchivedActions, setShowArchivedActions] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const editor = useEditor<Draft, Objective>({
    record,
    toDraft,
    save: (d, base) => {
      const values = {
        title: d.title.trim(), success_criteria: d.success_criteria.trim(), context: nul(d.context),
        development_area: nul(d.development_area), status: d.status, review_date: nul(d.review_date),
        closing_summary: nul(d.closing_summary),
      };
      return base ? update.mutateAsync({ id: base.id, patch: values, version: base.version }) : create.mutateAsync(values);
    },
    onSaved: (saved) => { if (!record) navigate(`/objectives/${saved.id}`, { replace: true }); },
  });
  const d = editor.draft;
  const closing = d.status === 'achieved' || d.status === 'closed';

  const myActions = record ? actions.filter((a) => a.objective_id === record.id && (showArchivedActions || !a.archived_at)) : [];
  const myUpdates = record
    ? updates.filter((u) => u.objective_id === record.id).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at))
    : [];
  const linkedSessions = record ? sessions.filter((s) => links.some((l) => l.objective_id === record.id && l.session_id === s.id)).sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)) : [];

  return (
    <>
      <p><Link to="/objectives">← Objectives</Link></p>
      <PageHeader title={record ? record.title : 'New objective'}>
        {record && <Badge status={record.status} label={labels.objective[record.status]} />}
        {record?.archived_at && <Badge status="closed" label="Archived" tone="plain" />}
      </PageHeader>
      {record?.archived_at && (
        <p className="notice notice-info">This objective is archived. It stays linked to its actions, sessions and updates, and can be restored.</p>
      )}
      {record?.status === 'proposed' && (
        <div className="notice notice-info">
          <p>This objective is <strong>proposed</strong> — it hasn’t yet been agreed as something you’ll both work on.</p>
          <button type="button" className="btn" onClick={() => editor.patch({ status: 'active' })}>Agree and activate</button>
          <span className="muted small"> (then save)</span>
        </div>
      )}

      <form className="panel" onSubmit={(e) => { e.preventDefault(); void editor.submit(); }}>
        <ConflictBanner editor={editor} fields={[
          { label: 'Title', read: (r) => r.title }, { label: 'What success looks like', read: (r) => r.success_criteria },
          { label: 'Status', read: (r) => labels.objective[r.status] }, { label: 'Context', read: (r) => r.context ?? '' },
          { label: 'Review summary', read: (r) => r.closing_summary ?? '' },
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
        <Select label="Status" value={d.status} onChange={(v) => editor.set('status', v)}
          hint="Proposed objectives are ideas not yet agreed. Active ones are being pursued."
          options={(Object.keys(labels.objective) as ObjectiveStatus[]).map((s) => ({ value: s, label: labels.objective[s] }))} />
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
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={async () => {
              setArchiveError(null);
              try { await archive(record, !record.archived_at); } catch { setArchiveError('Couldn’t change the archive state — it may have been edited elsewhere. Reload and try again.'); }
            }}>{record.archived_at ? 'Restore objective' : 'Archive objective'}</button>
          </div>
          {archiveError && <p className="notice notice-bad" role="alert">{archiveError}</p>}

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
          {record.review_date && <p className="muted small">Target review: {formatDay(record.review_date)}</p>}
        </>
      )}
    </>
  );
}
