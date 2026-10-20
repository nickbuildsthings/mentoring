import { useState } from 'react';
import { PageHeader } from '../components/ui';
import { fetchAll } from '../data/api';
import { buildJson, buildMarkdown, type MentoringRecord } from '../lib/export';
import { todayLondon } from '../lib/format';

async function loadAll(): Promise<MentoringRecord> {
  const [profiles, objectives, sessions, session_objectives, session_preparation, actions, progress_updates] = await Promise.all([
    fetchAll<MentoringRecord['profiles'][number]>('profiles', 'role'),
    fetchAll<MentoringRecord['objectives'][number]>('objectives'),
    fetchAll<MentoringRecord['sessions'][number]>('sessions', 'scheduled_at'),
    fetchAll<MentoringRecord['session_objectives'][number]>('session_objectives'),
    fetchAll<MentoringRecord['session_preparation'][number]>('session_preparation'),
    fetchAll<MentoringRecord['actions'][number]>('actions'),
    fetchAll<MentoringRecord['progress_updates'][number]>('progress_updates', 'occurred_on'),
  ]);
  return { profiles, objectives, sessions, session_objectives, session_preparation, actions, progress_updates };
}

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
  const [busy, setBusy] = useState<'md' | 'json' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = async (kind: 'md' | 'json') => {
    setBusy(kind); setStatus(null); setFailed(false);
    try {
      const data = await loadAll();
      const stem = `mentoring-record-${todayLondon()}`;
      if (kind === 'md') download(`${stem}.md`, 'text/markdown', buildMarkdown(data));
      else download(`${stem}.json`, 'application/json', buildJson(data));
      const n = data.objectives.length + data.sessions.length + data.actions.length + data.progress_updates.length;
      setStatus(`Exported ${n} records (including archived).`);
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
        <p>Download the complete shared mentoring record — objectives, sessions, preparation, actions and progress updates, including archived items, with authorship, dates and stable identifiers.</p>
        <p className="muted small">Exports contain your mentoring content but never passwords, tokens or keys. Treat the files as confidential. An export is not a substitute for the operational backup.</p>
        <div className="row">
          <button className="btn btn-primary" disabled={busy !== null} onClick={() => void run('md')}>{busy === 'md' ? 'Preparing…' : 'Download Markdown (readable)'}</button>
          <button className="btn" disabled={busy !== null} onClick={() => void run('json')}>{busy === 'json' ? 'Preparing…' : 'Download JSON (structured)'}</button>
        </div>
        <p role="status" aria-live="polite" className={failed ? 'save-text bad' : 'save-text'}>{failed && '⚠ '}{status}</p>
      </div>
    </>
  );
}
