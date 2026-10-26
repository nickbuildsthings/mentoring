import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../auth/AuthProvider';
import {
  useArchive,
  useCreate,
  useObjectives,
  useSessions,
  useToggleDiscussNext,
  useUpdateComments,
} from '../data/hooks';
import { formatDay, formatInstant, labels } from '../lib/format';
import type { ProgressUpdate, ProgressUpdateComment } from '../lib/types';
import { UpdateDialog } from './UpdateDialog';
import { Badge, EmptyState, Linkify, Text, TextArea, useNames } from './ui';

const TYPE_ICON = { reflection: '✎', evidence: '◈', feedback: '✉', achievement: '★' } as const;

function UpdateCommentsSection({ updateId }: { updateId: string }) {
  const me = useMe();
  const name = useNames();
  const allComments = useUpdateComments().data ?? [];
  const createComment = useCreate<ProgressUpdateComment>('progress_update_comments');
  const archiveComment = useArchive('progress_update_comments');

  const [openForm, setOpenForm] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const comments = allComments.filter((c) => c.update_id === updateId && !c.archived_at);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await createComment.mutateAsync({ update_id: updateId, content: text.trim() });
      setText('');
      setOpenForm(false);
    } catch {
      setErr('Could not save response. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="comments-box">
      {comments.length > 0 && (
        <ul className="plain comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment-item">
              <div className="row">
                <strong className="small">{name(c.created_by)}</strong>
                <span className="muted small">{formatInstant(c.created_at)}</span>
                {c.created_by === me.id && (
                  <button
                    type="button"
                    className="btn-link small muted"
                    onClick={() => void archiveComment(c, true)}
                  >
                    Remove
                  </button>
                )}
              </div>
              <Text>{c.content}</Text>
            </li>
          ))}
        </ul>
      )}
      {!openForm ? (
        <button type="button" className="btn btn-ghost small-btn" onClick={() => setOpenForm(true)}>
          💬 Add coaching response or question
        </button>
      ) : (
        <form onSubmit={(e) => void submitComment(e)} className="comment-form">
          <TextArea
            label="Coaching response or reflective question"
            value={text}
            rows={2}
            required
            maxLength={5000}
            onChange={setText}
            placeholder="Share encouragement, an observation, or a question to explore…"
          />
          {err && <p className="notice notice-bad small" role="alert">{err}</p>}
          <div className="row">
            <button type="submit" className="btn btn-primary small-btn" disabled={busy || !text.trim()}>
              {busy ? 'Posting…' : 'Post response'}
            </button>
            <button type="button" className="btn btn-ghost small-btn" onClick={() => setOpenForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function UpdateList({ updates, empty, showLinks = true }: { updates: ProgressUpdate[]; empty?: React.ReactNode; showLinks?: boolean }) {
  const me = useMe();
  const name = useNames();
  const objectives = useObjectives().data ?? [];
  const sessions = useSessions().data ?? [];
  const archive = useArchive('progress_updates');
  const toggleDiscuss = useToggleDiscussNext();
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
                <span className="badges">
                  {u.discuss_next && <Badge status="planned" label="Discuss next session" tone="good" />}
                  {u.archived_at && <Badge status="closed" label="Archived" tone="plain" />}
                </span>
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
              <div className="row">
                {mine ? (
                  <>
                    <button className="btn" onClick={() => setEditing(u)}>Edit</button>
                    <button className="btn btn-ghost" onClick={async () => {
                      setMessage(null);
                      try { await archive(u, !u.archived_at); } catch { setMessage('Couldn’t update that item. Please try again.'); }
                    }}>{u.archived_at ? 'Restore' : 'Archive'}</button>
                  </>
                ) : (
                  <span className="muted small">Authored by {name(u.created_by)}</span>
                )}
                {!u.archived_at && (
                  <button
                    type="button"
                    className="btn btn-ghost small-btn"
                    onClick={async () => {
                      setMessage(null);
                      try {
                        await toggleDiscuss.mutateAsync({ updateId: u.id, discussNext: !u.discuss_next });
                      } catch {
                        setMessage('Couldn’t update session flag. Please try again.');
                      }
                    }}
                  >
                    {u.discuss_next ? '✓ Flagged for next session' : 'Flag for next session'}
                  </button>
                )}
              </div>
              {!u.archived_at && <UpdateCommentsSection updateId={u.id} />}
            </li>
          );
        })}
      </ul>
      {editing && <UpdateDialog update={updates.find((x) => x.id === editing.id) ?? editing} onClose={() => setEditing(null)} />}
    </>
  );
}
