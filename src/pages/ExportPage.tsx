import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePartnership } from '../auth/PartnershipContext';
import { PageHeader } from '../components/ui';
import { fetchAll } from '../data/api';
import { buildJson, buildMarkdown, buildPortfolioMarkdown, type MentoringRecord } from '../lib/export';
import { todayLondon } from '../lib/format';
import type { Partnership } from '../lib/types';

function download(filename: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportPage() {
  const qc = useQueryClient();
  const { activePartnership, activePartnershipId } = usePartnership();
  const [busy, setBusy] = useState<'md' | 'json' | 'portfolio' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const loadAll = async (partnership: Partnership | null, pid: string | null): Promise<MentoringRecord> => {
    const scope = pid ?? undefined;
    const keyScope = pid ?? 'default';
    const [
      allProfiles,
      objectives,
      sessions,
      session_objectives,
      session_preparation,
      actions,
      progress_updates,
      progress_update_comments,
    ] = await Promise.all([
      qc.fetchQuery({ queryKey: ['profiles'], queryFn: () => fetchAll<MentoringRecord['profiles'][number]>('profiles', 'role') }),
      qc.fetchQuery({ queryKey: ['objectives', keyScope], queryFn: () => fetchAll<MentoringRecord['objectives'][number]>('objectives', 'created_at', scope) }),
      qc.fetchQuery({ queryKey: ['sessions', keyScope], queryFn: () => fetchAll<MentoringRecord['sessions'][number]>('sessions', 'scheduled_at', scope) }),
      qc.fetchQuery({ queryKey: ['session_objectives', keyScope], queryFn: () => fetchAll<MentoringRecord['session_objectives'][number]>('session_objectives', 'created_at', scope) }),
      qc.fetchQuery({ queryKey: ['session_preparation', keyScope], queryFn: () => fetchAll<MentoringRecord['session_preparation'][number]>('session_preparation', 'created_at', scope) }),
      qc.fetchQuery({ queryKey: ['actions', keyScope], queryFn: () => fetchAll<MentoringRecord['actions'][number]>('actions', 'created_at', scope) }),
      qc.fetchQuery({ queryKey: ['progress_updates', keyScope], queryFn: () => fetchAll<MentoringRecord['progress_updates'][number]>('progress_updates', 'occurred_on', scope) }),
      qc.fetchQuery({
        queryKey: ['progress_update_comments', keyScope],
        queryFn: () => fetchAll<NonNullable<MentoringRecord['progress_update_comments']>[number]>('progress_update_comments', 'created_at', scope),
      }),
    ]);

    const profiles = partnership
      ? allProfiles.filter((p) => p.id === partnership.mentor_id || p.id === partnership.mentee_id)
      : allProfiles;

    return {
      partnership: partnership ?? undefined,
      profiles,
      objectives,
      sessions,
      session_objectives,
      session_preparation,
      actions,
      progress_updates,
      progress_update_comments,
    };
  };

  const run = async (kind: 'md' | 'json' | 'portfolio') => {
    setBusy(kind); setStatus(null); setFailed(false);
    try {
      const data = await loadAll(activePartnership, activePartnershipId);
      const day = todayLondon();
      if (kind === 'md') {
        download(`mentoring-record-${day}.md`, 'text/markdown', buildMarkdown(data));
      } else if (kind === 'portfolio') {
        download(`development-portfolio-${day}.md`, 'text/markdown', buildPortfolioMarkdown(data));
      } else {
        download(`mentoring-record-${day}.json`, 'application/json', buildJson(data));
      }
      const n =
        data.objectives.length +
        data.sessions.length +
        data.session_preparation.length +
        data.actions.length +
        data.progress_updates.length +
        (data.progress_update_comments?.length ?? 0);
      setStatus(`Exported ${n} records (including preparation, updates and coaching replies).`);
    } catch {
      setFailed(true);
      setStatus('The export could not be completed. Nothing has been downloaded — please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Export" />
      <div className="panel">
        <h2>Complete Mentoring Record</h2>
        <p>Download the complete shared mentoring record — charter, objectives, milestones, sessions, preparation, actions, progress updates and coaching replies, including archived items, with authorship, dates and stable identifiers.</p>
        <p className="muted small">Exports contain your mentoring content for the active partnership but never passwords, tokens or keys. Treat the files as confidential. An export is not a substitute for the operational backup.</p>
        <div className="row">
          <button className="btn btn-primary" disabled={busy !== null} onClick={() => void run('md')}>
            {busy === 'md' ? 'Preparing…' : 'Download Markdown (readable)'}
          </button>
          <button className="btn" disabled={busy !== null} onClick={() => void run('json')}>
            {busy === 'json' ? 'Preparing…' : 'Download JSON (structured)'}
          </button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--mist-dark)', margin: '1.25rem 0' }} />

        <h2>Shareable Development Portfolio</h2>
        <p>Download a clean summary of active &amp; achieved objectives, milestones, completed actions, and evidence/feedback/achievements — omitting internal session discussion notes, private reflections, blocked notes, and coaching threads — suitable for sharing with a line manager or appraisal panel.</p>
        <div className="row">
          <button className="btn" disabled={busy !== null} onClick={() => void run('portfolio')}>
            {busy === 'portfolio' ? 'Preparing…' : 'Download Development Portfolio (Markdown)'}
          </button>
        </div>

        <p role="status" aria-live="polite" className={failed ? 'save-text bad' : 'save-text'}>{failed && '⚠ '}{status}</p>
      </div>
    </>
  );
}
