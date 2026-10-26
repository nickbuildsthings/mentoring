import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useObjectives, useUpdates } from '../data/hooks';
import { formatDay, isObjectiveStalled, labels, todayLondon } from '../lib/format';
import type { ObjectiveStatus } from '../lib/types';
import { Badge, EmptyState, LoadError, PageHeader, Spinner } from '../components/ui';

export function ObjectivesPage() {
  const objectives = useObjectives();
  const updates = useUpdates();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | ObjectiveStatus>('all');
  const [archived, setArchived] = useState(false);

  if (objectives.isPending) return <Spinner />;
  if (objectives.isError) return <LoadError error={objectives.error} retry={() => void objectives.refetch()} />;

  const today = todayLondon();
  const needle = q.trim().toLowerCase();
  const allUpdates = updates.data ?? [];

  const list = objectives.data
    .filter((o) => (archived ? !!o.archived_at : !o.archived_at))
    .filter((o) => status === 'all' || o.status === status)
    .filter((o) =>
      !needle ||
      [o.title, o.success_criteria, o.context ?? '', o.development_area ?? '', o.closing_summary ?? ''].some((s) =>
        s.toLowerCase().includes(needle),
      ),
    )
    .sort((a, b) => (a.status === b.status ? b.created_at.localeCompare(a.created_at) : order(a.status) - order(b.status)));

  return (
    <>
      <PageHeader title="Objectives"><Link to="/objectives/new" className="btn btn-primary">New objective</Link></PageHeader>
      <div className="filters" role="search">
        <label>Search objectives<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, criteria, area…" /></label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | ObjectiveStatus)}>
            <option value="all">All</option>
            {(Object.keys(labels.objective) as ObjectiveStatus[]).map((s) => <option key={s} value={s}>{labels.objective[s]}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived</label>
      </div>
      {list.length === 0 ? (
        <EmptyState title={archived ? 'No archived objectives' : 'No objectives yet'}
          action={!archived ? <Link to="/objectives/new" className="btn">Propose the first objective</Link> : undefined}>
          {archived ? 'Archived objectives will appear here and can be restored.' : 'An objective describes what successful development would look like. Either of you can propose one.'}
        </EmptyState>
      ) : (
        <ul className="cards">
          {list.map((o) => {
            const latest = allUpdates.filter((u) => u.objective_id === o.id && !u.archived_at).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at))[0];
            const milestones = o.milestones ?? [];
            const doneCount = milestones.filter((m) => m.done).length;
            const stalled = isObjectiveStalled(o, allUpdates, today);
            const reviewDue = o.status === 'active' && o.review_date && o.review_date <= today;
            return (
              <li key={o.id} className={`card${o.archived_at ? ' card-archived' : ''}`}>
                <div className="card-top">
                  <Link to={`/objectives/${o.id}`}><strong>{o.title}</strong></Link>
                  <span className="badges">
                    <Badge status={o.status} label={labels.objective[o.status]} />
                    {o.progress_stage && <Badge status="stage" label={labels.stage[o.progress_stage]} tone="plain" />}
                    {milestones.length > 0 && <Badge status="milestones" label={`${doneCount}/${milestones.length} milestones`} tone={doneCount === milestones.length ? 'good' : 'plain'} />}
                    {reviewDue && <Badge status="overdue" label="Review due" tone="bad" />}
                    {stalled && <Badge status="stalled" label="Needs check-in" tone="plain" />}
                    {o.archived_at && <Badge status="closed" label="Archived" tone="plain" />}
                  </span>
                </div>
                {o.status === 'proposed' && <p className="muted small">Proposed — not yet agreed.</p>}
                <p className="muted small">{[o.development_area, o.review_date && `Review ${formatDay(o.review_date)}`].filter(Boolean).join(' · ')}</p>
                {latest && <p className="small"><strong>Latest update ({formatDay(latest.occurred_on)}):</strong> {latest.content.slice(0, 160)}{latest.content.length > 160 ? '…' : ''}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

const order = (s: ObjectiveStatus) => ({ active: 0, proposed: 1, paused: 2, achieved: 3, closed: 4 })[s];
