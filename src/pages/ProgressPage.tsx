import { useState } from 'react';
import { NewUpdateButton } from '../components/UpdateDialog';
import { UpdateList } from '../components/UpdateList';
import { EmptyState, LoadError, PageHeader, Spinner } from '../components/ui';
import { useObjectives, useUpdates } from '../data/hooks';
import { labels } from '../lib/format';
import type { UpdateType } from '../lib/types';

export function ProgressPage() {
  const updates = useUpdates();
  const objectives = useObjectives().data ?? [];
  const [type, setType] = useState<'all' | UpdateType>('all');
  const [objective, setObjective] = useState('');
  const [archived, setArchived] = useState(false);

  if (updates.isPending) return <Spinner />;
  if (updates.isError) return <LoadError error={updates.error} retry={() => void updates.refetch()} />;

  const sorted = [...updates.data].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at));
  const achievements = sorted.filter((u) => u.type === 'achievement' && !u.archived_at);
  const list = sorted
    .filter((u) => (archived ? !!u.archived_at : !u.archived_at))
    .filter((u) => type === 'all' || u.type === type)
    .filter((u) => !objective || u.objective_id === objective);

  return (
    <>
      <PageHeader title="Progress"><NewUpdateButton className="btn btn-primary" label="Add progress update" /></PageHeader>
      <p className="muted">Reflections, examples, feedback and achievements — the evidence of development over time.</p>
      {achievements.length > 0 && type === 'all' && !archived && !objective && (
        <section aria-labelledby="h-ach">
          <h2 id="h-ach">★ Achievements</h2>
          <UpdateList updates={achievements.slice(0, 5)} />
        </section>
      )}
      <h2>All updates</h2>
      <div className="filters" role="search">
        <label>Type
          <select value={type} onChange={(e) => setType(e.target.value as 'all' | UpdateType)}>
            <option value="all">All types</option>
            {(Object.keys(labels.update) as UpdateType[]).map((t) => <option key={t} value={t}>{labels.update[t]}</option>)}
          </select>
        </label>
        <label>Objective
          <select value={objective} onChange={(e) => setObjective(e.target.value)}>
            <option value="">Any</option>
            {objectives.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived</label>
      </div>
      <UpdateList updates={list} empty={
        <EmptyState title={archived ? 'No archived updates' : 'No progress updates yet'}>
          {archived ? 'Archived updates can be restored by their author.' : 'Capture a reflection, a concrete example or something you’re pleased with. Small things count.'}
        </EmptyState>
      } />
    </>
  );
}
