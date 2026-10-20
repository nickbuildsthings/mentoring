import { useState } from 'react';
import { useCreate, useObjectives, useSessions, useUpdate } from '../data/hooks';
import { formatInstant, labels, todayLondon } from '../lib/format';
import { parseLinks } from '../lib/links';
import type { ProgressUpdate, UpdateType } from '../lib/types';
import { ConflictBanner, Modal, SaveBar, Select, SharedNotice, TextArea, TextInput } from './ui';
import { useEditor } from './useEditor';

interface Draft {
  type: UpdateType; content: string; links: string; occurred_on: string; objective_id: string; session_id: string;
  went_well: string; difficult: string; try_next: string;
}

export interface UpdateDefaults { objective_id?: string; session_id?: string; type?: UpdateType }

const PROMPTS: Record<UpdateType, string> = {
  reflection: 'Use the prompts below, or write freely.',
  evidence: 'Describe a concrete example that shows development — what you did and what it showed.',
  feedback: 'Record feedback given or received, and who it was from.',
  achievement: 'Describe what was achieved and why it matters.',
};

export function UpdateDialog({ update, defaults, onClose }: { update?: ProgressUpdate; defaults?: UpdateDefaults; onClose: () => void }) {
  const objectives = useObjectives().data ?? [];
  const sessions = useSessions().data ?? [];
  const create = useCreate<ProgressUpdate>('progress_updates');
  const patch = useUpdate<ProgressUpdate>('progress_updates');
  const [toDraft] = useState(() => (u: ProgressUpdate | undefined): Draft => ({
    type: u?.type ?? defaults?.type ?? 'reflection', content: u?.content ?? '', links: (u?.links ?? []).join('\n'),
    occurred_on: u?.occurred_on ?? todayLondon(), objective_id: u?.objective_id ?? defaults?.objective_id ?? '',
    session_id: u?.session_id ?? defaults?.session_id ?? '', went_well: '', difficult: '', try_next: '',
  }));
  const [linkProblem, setLinkProblem] = useState<string | null>(null);

  const editor = useEditor<Draft, ProgressUpdate>({
    record: update,
    toDraft,
    save: (d, base) => {
      const parsed = parseLinks(d.links);
      if (parsed.invalid.length) {
        setLinkProblem(`These aren’t valid web links (they must start with http:// or https://): ${parsed.invalid.join(', ')}`);
        return Promise.reject(new Error('Invalid links'));
      }
      setLinkProblem(null);
      const guided = d.type === 'reflection' && !update
        ? [['What went well', d.went_well], ['What was difficult', d.difficult], ['What to try next', d.try_next]]
            .filter(([, v]) => v.trim()).map(([h, v]) => `${h}:\n${v.trim()}`).join('\n\n')
        : '';
      const content = [d.content.trim(), guided].filter(Boolean).join('\n\n');
      const values = {
        type: d.type, content, links: parsed.links, occurred_on: d.occurred_on,
        objective_id: d.objective_id || null, session_id: d.session_id || null,
      };
      return base ? patch.mutateAsync({ id: base.id, patch: values, version: base.version }) : create.mutateAsync(values);
    },
    onSaved: onClose,
  });
  const d = editor.draft;
  const guided = d.type === 'reflection' && !update;
  const hasContent = d.content.trim() !== '' || (guided && (d.went_well + d.difficult + d.try_next).trim() !== '');

  return (
    <Modal title={update ? 'Edit progress update' : 'Add progress update'} onClose={onClose} dirty={editor.dirty}>
      <form onSubmit={(e) => { e.preventDefault(); void editor.submit(); }}>
        <SharedNotice />
        <ConflictBanner editor={editor} fields={[{ label: 'Text', read: (r) => r.content }]} />
        <Select label="Type" value={d.type} onChange={(v) => editor.set('type', v)}
          options={(Object.keys(labels.update) as UpdateType[]).map((t) => ({ value: t, label: labels.update[t] }))} />
        <TextInput label="Date" type="date" value={d.occurred_on} required onChange={(v) => editor.set('occurred_on', v)} />
        {guided ? (
          <>
            <p className="hint">{PROMPTS[d.type]}</p>
            <TextArea label="What went well?" value={d.went_well} rows={3} maxLength={5000} onChange={(v) => editor.set('went_well', v)} />
            <TextArea label="What was difficult?" value={d.difficult} rows={3} maxLength={5000} onChange={(v) => editor.set('difficult', v)} />
            <TextArea label="What will you try next?" value={d.try_next} rows={3} maxLength={5000} onChange={(v) => editor.set('try_next', v)} />
            <TextArea label="Anything else (optional)" value={d.content} rows={3} maxLength={10000} onChange={(v) => editor.set('content', v)} />
          </>
        ) : (
          <TextArea label="Details" hint={PROMPTS[d.type]} value={d.content} rows={6} required maxLength={20000} onChange={(v) => editor.set('content', v)} />
        )}
        <TextArea label="Links (optional)" hint="One web link per line." value={d.links} rows={2} onChange={(v) => editor.set('links', v)} />
        {linkProblem && <p className="notice notice-bad" role="alert">{linkProblem}</p>}
        <Select label="Linked objective (optional)" value={d.objective_id} onChange={(v) => editor.set('objective_id', v)}
          options={[{ value: '', label: 'None' }, ...objectives.filter((o) => !o.archived_at || o.id === d.objective_id).map((o) => ({ value: o.id, label: o.title }))]} />
        <Select label="Linked session (optional)" value={d.session_id} onChange={(v) => editor.set('session_id', v)}
          options={[{ value: '', label: 'None' }, ...[...sessions].reverse().filter((s) => !s.archived_at || s.id === d.session_id).map((s) => ({ value: s.id, label: `${formatInstant(s.scheduled_at)}${s.title ? ` — ${s.title}` : ''}` }))]} />
        <SaveBar editor={editor} label={update ? 'Save update' : 'Add update'} disabled={!hasContent} />
      </form>
      {editor.guard}
    </Modal>
  );
}

export function NewUpdateButton({ defaults, label = 'Add progress update', className = 'btn' }: { defaults?: UpdateDefaults; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && <UpdateDialog defaults={defaults} onClose={() => setOpen(false)} />}
    </>
  );
}
