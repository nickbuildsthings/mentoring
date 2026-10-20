import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../auth/AuthProvider';
import { ActionList, NewActionButton } from '../components/ActionDialog';
import { NewUpdateButton } from '../components/UpdateDialog';
import { Badge, EmptyState, LoadError, PageHeader, Spinner, useNames } from '../components/ui';
import { useActions, useObjectives, usePreparations, useProfiles, useSessions, useUpdates } from '../data/hooks';
import { formatDay, formatInstant, isOverdue, labels } from '../lib/format';
import { sortActions } from './ActionsPage';

type OwnerFilter = 'me' | 'other' | 'both';

export function Overview() {
  const me = useMe();
  const name = useNames();
  const objectives = useObjectives();
  const sessions = useSessions();
  const actions = useActions();
  const updates = useUpdates();
  const preps = usePreparations().data ?? [];
  const profiles = useProfiles().data ?? [];
  const [owner, setOwner] = useState<OwnerFilter>('me');

  const feed = useMemo(() => {
    type Item = { key: string; at: string; text: string; href?: string };
    const items: Item[] = [];
    for (const u of updates.data ?? []) {
      if (u.archived_at) continue;
      items.push({ key: `u${u.id}`, at: u.created_at, text: `${name(u.created_by)} added ${u.type === 'achievement' ? 'an' : 'a'} ${labels.update[u.type].toLowerCase()}: ${u.content.slice(0, 120)}${u.content.length > 120 ? '…' : ''}`, href: u.objective_id ? `/objectives/${u.objective_id}` : '/progress' });
    }
    for (const a of actions.data ?? []) {
      if (a.completed_at && !a.archived_at) items.push({ key: `a${a.id}`, at: a.completed_at, text: `${name(a.updated_by)} completed “${a.title}”`, href: '/actions' });
    }
    return items.sort((x, y) => y.at.localeCompare(x.at)).slice(0, 10);
  }, [updates.data, actions.data, name]);

  if (objectives.isPending || sessions.isPending || actions.isPending || updates.isPending) return <Spinner />;
  const failed = [objectives, sessions, actions, updates].find((q) => q.isError);
  if (failed) return <LoadError error={failed.error} retry={() => void failed.refetch()} />;

  const objs = objectives.data ?? [];
  const sess = sessions.data ?? [];
  const acts = actions.data ?? [];
  const upds = updates.data ?? [];
  const now = new Date().toISOString();
  const next = sess
    .filter((s) => s.status === 'planned' && !s.archived_at && s.scheduled_at >= now)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const active = objs.filter((o) => o.status === 'active' && !o.archived_at);
  const proposed = objs.filter((o) => o.status === 'proposed' && !o.archived_at);
  const outstanding = sortActions(acts.filter((a) => !a.archived_at && a.status !== 'completed' && a.status !== 'cancelled'))
    .filter((a) => owner === 'both' || (owner === 'me' ? a.owner_role === me.role : a.owner_role !== me.role));
  const otherName = profiles.find((p) => p.id !== me.id)?.display_name ?? 'Them';
  const overdueCount = outstanding.filter((a) => isOverdue(a)).length;

  return (
    <>
      <PageHeader title={`Hello, ${me.display_name}`} />
      <div className="row quick" aria-label="Quick actions">
        <Link to="/objectives/new" className="btn">New objective</Link>
        <Link to="/sessions/new" className="btn">New session</Link>
        <NewActionButton className="btn" />
        <NewUpdateButton />
      </div>

      <section aria-labelledby="h-next" className="panel">
        <h2 id="h-next">Next session</h2>
        {next ? (
          <>
            <p><Link to={`/sessions/${next.id}`}><strong>{formatInstant(next.scheduled_at)}{next.title ? ` — ${next.title}` : ''}</strong></Link>
              {next.is_review && <> <Badge status="achieved" label="Progress review" tone="plain" /></>}</p>
            {(next.location || next.meeting_link) && <p className="muted small">{next.location}{next.location && next.meeting_link ? ' · ' : ''}{next.meeting_link && <a href={next.meeting_link} target="_blank" rel="noopener noreferrer">Meeting link</a>}</p>}
            <ul className="plain">
              {profiles.map((p) => {
                const done = preps.some((x) => x.session_id === next.id && x.created_by === p.id);
                return <li key={p.id}>{done ? '✓' : '○'} {p.id === me.id ? 'You have' : `${p.display_name} has`}{done ? '' : ' not yet'} prepared</li>;
              })}
            </ul>
            <Link to={`/sessions/${next.id}`} className="btn">Open preparation notes</Link>
          </>
        ) : (
          <EmptyState title="No session planned" action={<Link to="/sessions/new" className="btn">Plan a session</Link>}>Schedule your next conversation so you can both prepare.</EmptyState>
        )}
      </section>

      <section aria-labelledby="h-act">
        <div className="section-head">
          <h2 id="h-act">Outstanding actions{overdueCount > 0 && <> <Badge status="overdue" label={`${overdueCount} overdue`} tone="bad" /></>}</h2>
          <div className="seg" role="group" aria-label="Filter actions by owner">
            {([['me', 'Mine'], ['other', otherName], ['both', 'Both']] as const).map(([v, l]) => (
              <button key={v} type="button" className="btn btn-seg" aria-pressed={owner === v} onClick={() => setOwner(v)}>{l}</button>
            ))}
          </div>
        </div>
        <ActionList actions={outstanding} empty={<EmptyState title="All clear">No outstanding actions for this view.</EmptyState>} />
      </section>

      <section aria-labelledby="h-obj">
        <div className="section-head"><h2 id="h-obj">Active objectives</h2><Link to="/objectives">All objectives</Link></div>
        {proposed.length > 0 && <p className="notice notice-info small">{proposed.length} proposed objective{proposed.length > 1 ? 's' : ''} awaiting agreement — <Link to="/objectives">review</Link>.</p>}
        {active.length === 0 ? (
          <EmptyState title="No active objectives" action={<Link to="/objectives/new" className="btn">Propose an objective</Link>}>Agree what development you’re working towards.</EmptyState>
        ) : (
          <ul className="cards">{active.map((o) => {
            const latest = upds.filter((u) => u.objective_id === o.id && !u.archived_at).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at))[0];
            return (
              <li key={o.id} className="card">
                <Link to={`/objectives/${o.id}`}><strong>{o.title}</strong></Link>
                {o.review_date && <p className="muted small">Review {formatDay(o.review_date)}</p>}
                {latest ? <p className="small"><strong>Latest ({formatDay(latest.occurred_on)}):</strong> {latest.content.slice(0, 160)}{latest.content.length > 160 ? '…' : ''}</p> : <p className="muted small">No progress updates yet.</p>}
              </li>
            );
          })}</ul>
        )}
      </section>

      <section aria-labelledby="h-feed">
        <h2 id="h-feed">Recent activity</h2>
        {feed.length === 0 ? <EmptyState title="Nothing yet">Reflections, achievements and completed actions will appear here.</EmptyState> : (
          <ul className="plain feed">{feed.map((i) => (
            <li key={i.key}><span className="muted small">{formatInstant(i.at)}</span><br />{i.href ? <Link to={i.href}>{i.text}</Link> : i.text}</li>
          ))}</ul>
        )}
      </section>
    </>
  );
}
