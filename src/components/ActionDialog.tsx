import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../auth/AuthProvider';
import { useArchive, useCreate, useObjectives, useProfiles, useSessions, useUpdate } from '../data/hooks';
import { formatDay, formatInstant, isOverdue, labels } from '../lib/format';
import type { Action, ActionStatus, MemberRole } from '../lib/types';
import { Badge, ConflictBanner, EmptyState, Modal, SaveBar, Select, TextArea, TextInput, useNames } from './ui';
import { useEditor } from './useEditor';

interface Draft {
  title: string; description: string; owner_role: MemberRole; due_date: string; status: ActionStatus;
  objective_id: string; session_id: string; completion_note: string; blocked_note: string;
}

const blank = (s: string | null | undefined) => s ?? '';
const nul = (s: string) => (s.trim() === '' ? null : s.trim());

export interface ActionDefaults { objective_id?: string; session_id?: string; owner_role?: MemberRole }

export function ActionDialog({ action, defaults, onClose }: { action?: Action; defaults?: ActionDefaults; onClose: () => void }) {
  const me = useMe();
  const objectives = useObjectives().data ?? [];
  const sessions = useSessions().data ?? [];
  const profiles = useProfiles().data ?? [];
  const create = useCreate<Action>('actions');
  const update = useUpdate<Action>('actions');

  const [toDraft] = useState(() => (a: Action | undefined): Draft => ({
    title: a?.title ?? '', description: blank(a?.description), owner_role: a?.owner_role ?? defaults?.owner_role ?? me.role,
    due_date: blank(a?.due_date), status: a?.status ?? 'not_started', objective_id: a?.objective_id ?? defaults?.objective_id ?? '',
    session_id: a?.session_id ?? defaults?.session_id ?? '', completion_note: blank(a?.completion_note), blocked_note: blank(a?.blocked_note),
  }));

  const editor = useEditor<Draft, Action>({
    record: action,
    toDraft,
    save: (d, base) => {
      const values = {
        title: d.title.trim(), description: nul(d.description), owner_role: d.owner_role, due_date: nul(d.due_date), status: d.status,
        objective_id: nul(d.objective_id), session_id: nul(d.session_id),
        completion_note: d.status === 'completed' ? nul(d.completion_note) : null,
        blocked_note: d.status === 'blocked' ? nul(d.blocked_note) : null,
      };
      return base ? update.mutateAsync({ id: base.id, patch: values, version: base.version }) : create.mutateAsync(values);
    },
    onSaved: onClose,
  });
  const d = editor.draft;
  const ownerName = (r: MemberRole) => profiles.find((p) => p.role === r)?.display_name;

  return (
    <Modal title={action ? 'Edit action' : 'New action'} onClose={onClose} dirty={editor.dirty}>
      <form onSubmit={(e) => { e.preventDefault(); void editor.submit(); }}>
        <ConflictBanner editor={editor} fields={[
          { label: 'Title', read: (r) => r.title }, { label: 'Status', read: (r) => labels.action[r.status] },
          { label: 'Due', read: (r) => formatDay(r.due_date) }, { label: 'Description', read: (r) => blank(r.description) },
        ]} />
        <TextInput label="What needs to happen?" value={d.title} required maxLength={200} onChange={(v) => editor.set('title', v)} />
        <Select label="Owner" value={d.owner_role} onChange={(v) => editor.set('owner_role', v)}
          options={(['mentor', 'mentee'] as const).map((r) => ({ value: r, label: `${labels.role[r]}${ownerName(r) ? ` — ${ownerName(r)}` : ''}` }))} />
        <TextInput label="Due date (optional)" type="date" value={d.due_date} onChange={(v) => editor.set('due_date', v)} />
        <Select label="Status" value={d.status} onChange={(v) => editor.set('status', v)}
          options={(Object.keys(labels.action) as ActionStatus[]).map((s) => ({ value: s, label: labels.action[s] }))} />
        {d.status === 'blocked' && (
          <TextArea label="What is in the way, or what support is needed?" value={d.blocked_note} rows={3} maxLength={5000} onChange={(v) => editor.set('blocked_note', v)} />
        )}
        {d.status === 'completed' && (
          <TextArea label="Completion note (optional)" hint="What happened, or what you learned." value={d.completion_note} rows={3} maxLength={5000} onChange={(v) => editor.set('completion_note', v)} />
        )}
        <TextArea label="Details (optional)" value={d.description} rows={3} maxLength={5000} onChange={(v) => editor.set('description', v)} />
        <Select label="Linked objective (optional)" value={d.objective_id} onChange={(v) => editor.set('objective_id', v)}
          options={[{ value: '', label: 'None' }, ...objectives.filter((o) => !o.archived_at || o.id === d.objective_id).map((o) => ({ value: o.id, label: o.title }))]} />
        <Select label="Originating session (optional)" value={d.session_id} onChange={(v) => editor.set('session_id', v)}
          options={[{ value: '', label: 'None' }, ...[...sessions].reverse().filter((s) => !s.archived_at || s.id === d.session_id).map((s) => ({ value: s.id, label: `${formatInstant(s.scheduled_at)}${s.title ? ` — ${s.title}` : ''}` }))]} />
        <SaveBar editor={editor} label={action ? 'Save action' : 'Create action'} />
      </form>
      {editor.guard}
    </Modal>
  );
}

export function ActionList({ actions, empty, showLinks = true }: { actions: Action[]; empty?: React.ReactNode; showLinks?: boolean }) {
  const [editing, setEditing] = useState<Action | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const objectives = useObjectives().data ?? [];
  const sessions = useSessions().data ?? [];
  const profiles = useProfiles().data ?? [];
  const update = useUpdate<Action>('actions');
  const archive = useArchive('actions');
  const name = useNames();

  if (!actions.length) return <>{empty ?? <EmptyState title="No actions here yet" />}</>;

  const quick = async (a: Action, fn: () => Promise<unknown>) => {
    setMessage(null);
    try { await fn(); } catch { setMessage(`Couldn’t update “${a.title}”. It may have been changed by someone else — open it to see the latest.`); }
  };

  return (
    <>
      {message && <p className="notice notice-bad" role="alert">{message}</p>}
      <ul className="cards">
        {actions.map((a) => {
          const overdue = isOverdue(a);
          const open = a.status !== 'completed' && a.status !== 'cancelled';
          const objective = objectives.find((o) => o.id === a.objective_id);
          const session = sessions.find((s) => s.id === a.session_id);
          const owner = profiles.find((p) => p.role === a.owner_role);
          return (
            <li key={a.id} className={`card${a.archived_at ? ' card-archived' : ''}`}>
              <div className="card-top">
                <strong>{a.title}</strong>
                <span className="badges">
                  <Badge status={a.status} label={labels.action[a.status]} />
                  {overdue && <Badge status="overdue" label="Overdue" tone="bad" />}
                  {a.archived_at && <Badge status="closed" label="Archived" tone="plain" />}
                </span>
              </div>
              <p className="muted small">
                {labels.role[a.owner_role]}{owner ? ` (${owner.display_name})` : ''}
                {a.due_date && <> · Due {formatDay(a.due_date)}</>}
                {a.completed_at && <> · Completed {formatInstant(a.completed_at)}</>}
              </p>
              {a.status === 'blocked' && a.blocked_note && <p className="prewrap"><strong>Blocked:</strong> {a.blocked_note}</p>}
              {a.status === 'completed' && a.completion_note && <p className="prewrap"><strong>Completion note:</strong> {a.completion_note}</p>}
              {a.description && <p className="prewrap">{a.description}</p>}
              {showLinks && (objective || session) && (
                <p className="small">
                  {objective && <>Objective: <Link to={`/objectives/${objective.id}`}>{objective.title}</Link></>}
                  {objective && session && ' · '}
                  {session && <>From session: <Link to={`/sessions/${session.id}`}>{formatInstant(session.scheduled_at)}</Link></>}
                </p>
              )}
              <div className="row">
                <button className="btn" onClick={() => setEditing(a)}>Edit</button>
                {open && !a.archived_at && (
                  <button className="btn" onClick={() => void quick(a, () => update.mutateAsync({ id: a.id, version: a.version, patch: { status: 'completed' } }))}>Mark complete</button>
                )}
                <button className="btn btn-ghost" onClick={() => void quick(a, () => archive(a, !a.archived_at))}>{a.archived_at ? 'Restore' : 'Archive'}</button>
                <span className="muted small">Last edited by {name(a.updated_by)}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {editing && <ActionDialog action={actions.find((x) => x.id === editing.id) ?? editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Convenience: a button that opens a "new action" dialog. */
export function NewActionButton({ defaults, label = 'New action', className = 'btn btn-primary' }: { defaults?: ActionDefaults; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && <ActionDialog defaults={defaults} onClose={() => setOpen(false)} />}
    </>
  );
}
