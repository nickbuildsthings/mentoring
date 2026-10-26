import { useState } from 'react';
import { useMe } from '../auth/AuthProvider';
import { usePartnership } from '../auth/PartnershipContext';
import { ActionList, NewActionButton } from '../components/ActionDialog';
import { EmptyState, LoadError, PageHeader, Spinner } from '../components/ui';
import { useActions, useObjectives, useProfiles } from '../data/hooks';
import { isOverdue, labels } from '../lib/format';
import type { Action, ActionStatus, MemberRole } from '../lib/types';

export function sortActions(list: Action[]): Action[] {
  const rank = (a: Action) => (isOverdue(a) ? 0 : a.due_date ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.created_at.localeCompare(b.created_at));
}

export function ActionsPage() {
  const me = useMe();
  const { activePartnership } = usePartnership();
  const actions = useActions();
  const objectives = useObjectives().data ?? [];
  const profiles = useProfiles().data ?? [];
  const [q, setQ] = useState('');
  const [owner, setOwner] = useState<'any' | MemberRole>('any');
  const [status, setStatus] = useState<'open' | 'all' | ActionStatus>('open');
  const [objective, setObjective] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [archived, setArchived] = useState(false);

  if (actions.isPending) return <Spinner />;
  if (actions.isError) return <LoadError error={actions.error} retry={() => void actions.refetch()} />;

  const needle = q.trim().toLowerCase();
  const list = sortActions(actions.data
    .filter((a) => (archived ? !!a.archived_at : !a.archived_at))
    .filter((a) => owner === 'any' || a.owner_role === owner)
    .filter((a) => status === 'all' || (status === 'open' ? a.status !== 'completed' && a.status !== 'cancelled' : a.status === status))
    .filter((a) => !objective || a.objective_id === objective)
    .filter((a) => !overdueOnly || isOverdue(a))
    .filter((a) =>
      !needle ||
      [a.title, a.description ?? '', a.blocked_note ?? '', a.completion_note ?? ''].some((s) =>
        s.toLowerCase().includes(needle),
      ),
    ));

  const otherId = activePartnership
    ? (me.role === 'mentor' ? activePartnership.mentee_id : activePartnership.mentor_id)
    : undefined;
  const other = (otherId ? profiles.find((p) => p.id === otherId) : undefined) ?? profiles.find((p) => p.id !== me.id);
  const otherRole: MemberRole = me.role === 'mentor' ? 'mentee' : 'mentor';
  const otherLabel = other
    ? `${other.display_name} (${labels.role[other.role]})`
    : `${activePartnership?.mentee_name ?? labels.role[otherRole]} (${labels.role[otherRole]})`;

  return (
    <>
      <PageHeader title="Actions"><NewActionButton /></PageHeader>
      <div className="filters" role="search">
        <label>Search actions<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, details, notes…" /></label>
        <label>Owner
          <select value={owner} onChange={(e) => setOwner(e.target.value as 'any' | MemberRole)}>
            <option value="any">Both</option>
            <option value={me.role}>Me ({me.display_name})</option>
            <option value={other?.role ?? otherRole}>{otherLabel}</option>
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value as 'open' | 'all' | ActionStatus)}>
            <option value="open">Outstanding</option>
            <option value="all">All</option>
            {(Object.keys(labels.action) as ActionStatus[]).map((s) => <option key={s} value={s}>{labels.action[s]}</option>)}
          </select>
        </label>
        <label>Objective
          <select value={objective} onChange={(e) => setObjective(e.target.value)}>
            <option value="">Any</option>
            {objectives.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue only</label>
        <label className="check"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived</label>
      </div>
      <ActionList actions={list} empty={
        <EmptyState title={archived ? 'No archived actions' : 'Nothing matches'} action={!archived ? <NewActionButton className="btn" /> : undefined}>
          {archived ? 'Archived actions can be restored.' : 'Change the filters, or add an action to get started.'}
        </EmptyState>
      } />
    </>
  );
}
