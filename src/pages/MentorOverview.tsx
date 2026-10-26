import { useState } from 'react';
import { useMe } from '../auth/AuthProvider';
import { usePartnership } from '../auth/PartnershipContext';
import { OnboardMenteeModal } from '../components/OnboardMenteeModal';
import { Badge, EmptyState, LoadError, PageHeader, Spinner } from '../components/ui';
import { useActions, useObjectives, useSessions, useUpdates } from '../data/hooks';
import { formatDay, formatInstant, isOverdue, labels } from '../lib/format';

export function MentorOverview() {
  const me = useMe();
  const { partnerships, invites, selectPartnership } = usePartnership();
  const objectives = useObjectives(null);
  const sessions = useSessions(null);
  const actions = useActions(null);
  const updates = useUpdates(null);
  const [showOnboard, setShowOnboard] = useState(false);

  if (objectives.isPending || sessions.isPending || actions.isPending || updates.isPending) {
    return <Spinner label="Loading all mentoring partnerships…" />;
  }
  const failed = [objectives, sessions, actions, updates].find((q) => q.isError);
  if (failed) return <LoadError error={failed.error} retry={() => void failed.refetch()} />;

  const objs = (objectives.data ?? []).filter((o) => !o.archived_at);
  const sess = (sessions.data ?? []).filter((s) => !s.archived_at);
  const acts = (actions.data ?? []).filter((a) => !a.archived_at);
  const upds = (updates.data ?? []).filter((u) => !u.archived_at);
  const now = new Date().toISOString();

  const blockedAcrossAll = acts.filter((a) => a.status === 'blocked');

  return (
    <>
      <PageHeader title={`Mentor Portfolio — ${me.display_name}`}>
        <button type="button" className="btn btn-primary" onClick={() => setShowOnboard(true)}>
          + Onboard new mentee
        </button>
      </PageHeader>
      <p className="muted">
        Overview across all {partnerships.length} mentoring partnerships. Each mentee’s workspace is strictly isolated from every other mentee.
      </p>

      {blockedAcrossAll.length > 0 && (
        <section aria-labelledby="h-blocked-all" className="notice notice-bad" role="region">
          <h2 id="h-blocked-all">⚠ Support needed ({blockedAcrossAll.length} blocked)</h2>
          <ul className="plain">
            {blockedAcrossAll.map((a) => {
              const p = partnerships.find((x) => x.id === a.partnership_id);
              return (
                <li key={a.id} className="row">
                  <span>
                    <strong>{p?.mentee_name ?? 'Mentee'}:</strong> {a.title}
                    {a.blocked_note ? ` — “${a.blocked_note}”` : ''}
                  </span>
                  {p && (
                    <button type="button" className="btn small-btn" onClick={() => selectPartnership(p.id)}>
                      Open workspace
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {partnerships.length === 0 ? (
        <EmptyState
          title="No mentoring partnerships yet"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setShowOnboard(true)}>
              Onboard your first mentee
            </button>
          }
        >
          Create a dedicated workspace for a mentee to start planning objectives and sessions.
        </EmptyState>
      ) : (
        <ul className="cards">
          {partnerships.map((p) => {
            const pObjs = objs.filter((o) => o.partnership_id === p.id);
            const pActiveObjs = pObjs.filter((o) => o.status === 'active');
            const pProposedObjs = pObjs.filter((o) => o.status === 'proposed');
            const pSess = sess.filter((s) => s.partnership_id === p.id);
            const nextSession = pSess
              .filter((s) => s.status === 'planned' && s.scheduled_at >= now)
              .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
            const pActs = acts.filter((a) => a.partnership_id === p.id && a.status !== 'completed' && a.status !== 'cancelled');
            const pBlocked = pActs.filter((a) => a.status === 'blocked');
            const pOverdue = pActs.filter((a) => isOverdue(a));
            const pUpds = upds
              .filter((u) => u.partnership_id === p.id)
              .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
            const latestUpdate = pUpds[0];
            const invite = invites.find((i) => i.partnership_id === p.id && !i.claimed_at);

            return (
              <li key={p.id} className="card">
                <div className="card-top">
                  <div>
                    <strong>{p.mentee_name}</strong>
                    {p.title && <span className="muted"> — {p.title}</span>}
                  </div>
                  <span className="badges">
                    <Badge status={p.status} label={labels.partnership[p.status]} />
                    {pBlocked.length > 0 && <Badge status="blocked" label={`${pBlocked.length} blocked`} tone="bad" />}
                    {pOverdue.length > 0 && <Badge status="overdue" label={`${pOverdue.length} overdue`} tone="bad" />}
                    {pProposedObjs.length > 0 && <Badge status="proposed" label={`${pProposedObjs.length} proposed`} />}
                  </span>
                </div>

                {invite && (
                  <p className="notice notice-info small">
                    Invitation code for {p.mentee_name}: <code>{invite.code}</code>
                  </p>
                )}

                <p className="small">
                  <strong>Next session:</strong>{' '}
                  {nextSession ? (
                    <>
                      {formatInstant(nextSession.scheduled_at)}
                      {nextSession.title ? ` (${nextSession.title})` : ''}
                    </>
                  ) : (
                    <span className="muted">None scheduled</span>
                  )}
                </p>

                <p className="muted small">
                  {pActiveObjs.length} active objective{pActiveObjs.length === 1 ? '' : 's'} · {pActs.length} open action{pActs.length === 1 ? '' : 's'}
                  {p.meeting_cadence && ` · Cadence: ${p.meeting_cadence}`}
                </p>

                {latestUpdate && (
                  <p className="small">
                    <strong>Latest ({formatDay(latestUpdate.occurred_on)}):</strong>{' '}
                    {latestUpdate.content.slice(0, 140)}
                    {latestUpdate.content.length > 140 ? '…' : ''}
                  </p>
                )}

                <div className="row">
                  <button type="button" className="btn btn-primary" onClick={() => selectPartnership(p.id)}>
                    Open {p.mentee_name}’s workspace
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showOnboard && <OnboardMenteeModal onClose={() => setShowOnboard(false)} />}
    </>
  );
}
