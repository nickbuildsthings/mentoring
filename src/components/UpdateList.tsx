import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../auth/AuthProvider';
import { useArchive, useObjectives, useSessions } from '../data/hooks';
import { formatDay, formatInstant, labels } from '../lib/format';
import type { ProgressUpdate } from '../lib/types';
import { UpdateDialog } from './UpdateDialog';
import { Badge, EmptyState, Linkify, Text, useNames } from './ui';

const TYPE_ICON = { reflection: '✎', evidence: '◈', feedback: '✉', achievement: '★' } as const;

export function UpdateList({ updates, empty, showLinks = true }: { updates: ProgressUpdate[]; empty?: React.ReactNode; showLinks?: boolean }) {
  const me = useMe();
  const name = useNames();
  const objectives = useObjectives().data ?? [];
  const sessions = useSessions().data ?? [];
  const archive = useArchive('progress_updates');
  const [editing, setEditing] = useState<ProgressUpdate | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!updates.length) return <>{empty ?? <EmptyState title="No progress updates yet" />}</>;

  return (
    <>
      {message && <p className="notice notice-bad" role="alert">{message}</p>}
      <ul className="cards">
        {updates.map((u) => {
          const mine = u.created_by === me.id;
          const objective = objectives.find((o) => o.id === u.objective_id);
          const session = sessions.find((s) => s.id === u.session_id);
          return (
            <li key={u.id} className={`card${u.archived_at ? ' card-archived' : ''}`}>
              <div className="card-top">
                <strong><span aria-hidden="true">{TYPE_ICON[u.type]} </span>{labels.update[u.type]}</strong>
                <span className="badges">{u.archived_at && <Badge status="closed" label="Archived" tone="plain" />}</span>
              </div>
              <p className="muted small">{formatDay(u.occurred_on)} · {name(u.created_by)}{u.version > 1 && ` · edited ${formatInstant(u.updated_at)}`}</p>
              <Text>{u.content}</Text>
              <Linkify links={u.links} />
              {showLinks && (objective || session) && (
                <p className="small">
                  {objective && <>Objective: <Link to={`/objectives/${objective.id}`}>{objective.title}</Link></>}
                  {objective && session && ' · '}
                  {session && <>Session: <Link to={`/sessions/${session.id}`}>{formatInstant(session.scheduled_at)}</Link></>}
                </p>
              )}
              {mine ? (
                <div className="row">
                  <button className="btn" onClick={() => setEditing(u)}>Edit</button>
                  <button className="btn btn-ghost" onClick={async () => {
                    setMessage(null);
                    try { await archive(u, !u.archived_at); } catch { setMessage('Couldn’t update that item. Please try again.'); }
                  }}>{u.archived_at ? 'Restore' : 'Archive'}</button>
                </div>
              ) : (
                <p className="muted small">Only {name(u.created_by)} can edit this.</p>
              )}
            </li>
          );
        })}
      </ul>
      {editing && <UpdateDialog update={updates.find((x) => x.id === editing.id) ?? editing} onClose={() => setEditing(null)} />}
    </>
  );
}
