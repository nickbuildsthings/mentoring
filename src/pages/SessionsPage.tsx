import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSessionObjectives, useObjectives, useSessions } from '../data/hooks';
import { formatInstant, labels } from '../lib/format';
import type { SessionStatus } from '../lib/types';
import { Badge, EmptyState, LoadError, PageHeader, Spinner } from '../components/ui';

export function SessionsPage() {
  const sessions = useSessions();
  const links = useSessionObjectives().data ?? [];
  const objectives = useObjectives().data ?? [];
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | SessionStatus>('all');
  const [archived, setArchived] = useState(false);

  if (sessions.isPending) return <Spinner />;
  if (sessions.isError) return <LoadError error={sessions.error} retry={() => void sessions.refetch()} />;

  const needle = q.trim().toLowerCase();
  const list = sessions.data
    .filter((s) => (archived ? !!s.archived_at : !s.archived_at))
    .filter((s) => status === 'all' || s.status === status)
    .filter((s) => !needle || (s.title ?? '').toLowerCase().includes(needle))
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));

  return (
    <>
      <PageHeader title="Sessions"><Link to="/sessions/new" className="btn btn-primary">New session</Link></PageHeader>
      <div className="filters" role="search">
        <label>Search titles<input type="search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | SessionStatus)}>
            <option value="all">All</option>
            {(Object.keys(labels.session) as SessionStatus[]).map((s) => <option key={s} value={s}>{labels.session[s]}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived</label>
      </div>
      {list.length === 0 ? (
        <EmptyState title={archived ? 'No archived sessions' : 'No sessions yet'}
          action={!archived ? <Link to="/sessions/new" className="btn">Plan a session</Link> : undefined}>
          {archived ? 'Archived sessions can be restored from their page.' : 'Plan your next conversation, prepare together, then record what you agreed.'}
        </EmptyState>
      ) : (
        <ul className="cards">
          {list.map((s) => {
            const linked = links.filter((l) => l.session_id === s.id).map((l) => objectives.find((o) => o.id === l.objective_id)?.title).filter(Boolean);
            return (
              <li key={s.id} className={`card${s.archived_at ? ' card-archived' : ''}`}>
                <div className="card-top">
                  <Link to={`/sessions/${s.id}`}><strong>{formatInstant(s.scheduled_at)}{s.title ? ` — ${s.title}` : ''}</strong></Link>
                  <span className="badges">
                    <Badge status={s.status} label={labels.session[s.status]} />
                    {s.is_review && <Badge status="achieved" label="Progress review" tone="plain" />}
                    {s.archived_at && <Badge status="closed" label="Archived" tone="plain" />}
                  </span>
                </div>
                {linked.length > 0 && <p className="muted small">Objectives: {linked.join(', ')}</p>}
                {s.outcomes && <p className="small">{s.outcomes.slice(0, 200)}{s.outcomes.length > 200 ? '…' : ''}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
