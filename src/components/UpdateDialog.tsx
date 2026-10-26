import { useState } from 'react';
import { useCreate, useObjectives, useSessions, useUpdate } from '../data/hooks';
import { formatInstant, labels, todayLondon } from '../lib/format';
import { MAX_LINKS, parseLinks } from '../lib/links';
import type { ProgressUpdate, UpdateType } from '../lib/types';
import { ConflictBanner, Modal, SaveBar, Select, SharedNotice, TextArea, TextInput } from './ui';
import { useEditor } from './useEditor';

interface Draft {
  type: UpdateType;
  content: string;
  links: string;
  occurred_on: string;
  objective_id: string;
  session_id: string;
  discuss_next: boolean;
  p1: string;
  p2: string;
  p3: string;
}

export interface UpdateDefaults { objective_id?: string; session_id?: string; type?: UpdateType }

interface PromptSpec {
  heading: string;
  label: string;
  hint?: string;
}

const STRUCTURED_PROMPTS: Record<UpdateType, PromptSpec[]> = {
  reflection: [
    { heading: 'What went well', label: 'What went well?' },
    { heading: 'What was difficult', label: 'What was difficult?' },
    { heading: 'What to try next', label: 'What will you try next?' },
  ],
  evidence: [
    { heading: 'Situation and action', label: 'What did you do (situation & action)?', hint: 'Describe a concrete example of what you did or tried.' },
    { heading: 'Impact and what it showed', label: 'What impact did it have, or what did it demonstrate?' },
  ],
  feedback: [
    { heading: 'Source and context', label: 'Who was the feedback from, and in what context?' },
    { heading: 'Key message and takeaway', label: 'What was the key message, and how will you use it?' },
  ],
  achievement: [
    { heading: 'What was achieved', label: 'What was achieved?' },
    { heading: 'Why it matters', label: 'Why does this matter, and what helped you succeed?' },
  ],
};

const PROMPTS_INTRO: Record<UpdateType, string> = {
  reflection: 'Use the coaching prompts below, or write freely in the notes box.',
  evidence: 'Capture a concrete example that shows development in practice.',
  feedback: 'Record feedback given or received and what you are taking from it.',
  achievement: 'Celebrate a milestone or breakthrough and why it matters.',
};

const MAX_CONTENT_LENGTH = 20_000;

/**
 * Parses saved content back into structured prompt fields if headings match (REC-018),
 * so editing an existing reflection/update preserves the guided fields.
 */
function parseStructuredContent(type: UpdateType, raw: string): { p1: string; p2: string; p3: string; rest: string } {
  if (!raw) return { p1: '', p2: '', p3: '', rest: '' };
  const specs = STRUCTURED_PROMPTS[type];
  let remaining = raw;
  const extracted = ['', '', ''];

  specs.forEach((spec, idx) => {
    const escaped = spec.heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\n\\n)${escaped}:\\n([\\s\\S]*?)(?=\\n\\n[A-Z][\\w\\s]+:\\n|$)`);
    const m = regex.exec(remaining);
    if (m) {
      extracted[idx] = m[1].trim();
      remaining = remaining.replace(m[0], '').trim();
    }
  });

  return { p1: extracted[0], p2: extracted[1], p3: extracted[2], rest: remaining };
}

function combineDraftContent(d: Draft): string {
  const specs = STRUCTURED_PROMPTS[d.type];
  const vals = [d.p1, d.p2, d.p3];
  const guided = specs
    .map((s, i) => [s.heading, vals[i] ?? ''] as const)
    .filter(([, v]) => v.trim() !== '')
    .map(([h, v]) => `${h}:\n${v.trim()}`)
    .join('\n\n');
  return [guided, d.content.trim()].filter(Boolean).join('\n\n');
}

export function UpdateDialog({ update, defaults, onClose }: { update?: ProgressUpdate; defaults?: UpdateDefaults; onClose: () => void }) {
  const objectives = useObjectives().data ?? [];
  const sessions = useSessions().data ?? [];
  const create = useCreate<ProgressUpdate>('progress_updates');
  const patch = useUpdate<ProgressUpdate>('progress_updates');

  const [toDraft] = useState(() => (u: ProgressUpdate | undefined): Draft => {
    const initialType = u?.type ?? defaults?.type ?? 'reflection';
    const parsed = parseStructuredContent(initialType, u?.content ?? '');
    return {
      type: initialType,
      content: parsed.rest,
      links: (u?.links ?? []).join('\n'),
      occurred_on: u?.occurred_on ?? todayLondon(),
      objective_id: u?.objective_id ?? defaults?.objective_id ?? '',
      session_id: u?.session_id ?? defaults?.session_id ?? '',
      discuss_next: u?.discuss_next ?? false,
      p1: parsed.p1,
      p2: parsed.p2,
      p3: parsed.p3,
    };
  });

  const [problem, setProblem] = useState<string | null>(null);

  const editor = useEditor<Draft, ProgressUpdate>({
    record: update,
    toDraft,
    save: (d, base) => {
      const parsed = parseLinks(d.links);
      if (parsed.invalid.length) {
        setProblem(`These aren’t valid web links (they must start with http:// or https://): ${parsed.invalid.join(', ')}`);
        return Promise.reject(new Error('Invalid links'));
      }
      if (parsed.tooMany) {
        setProblem(`Please include at most ${MAX_LINKS} web links on a single update (you entered ${parsed.links.length}).`);
        return Promise.reject(new Error('Too many links'));
      }
      const content = combineDraftContent(d);
      if (content.length > MAX_CONTENT_LENGTH) {
        setProblem(`This update is ${content.length.toLocaleString()} characters long, which exceeds the ${MAX_CONTENT_LENGTH.toLocaleString()}-character limit. Please shorten it slightly.`);
        return Promise.reject(new Error('Content too long'));
      }
      setProblem(null);
      const values = {
        type: d.type,
        content,
        links: parsed.links,
        occurred_on: d.occurred_on,
        objective_id: d.objective_id || null,
        session_id: d.session_id || null,
        discuss_next: d.discuss_next,
      };
      return base ? patch.mutateAsync({ id: base.id, patch: values, version: base.version }) : create.mutateAsync(values);
    },
    onSaved: onClose,
  });

  const d = editor.draft;
  const specs = STRUCTURED_PROMPTS[d.type];
  const combinedLength = combineDraftContent(d).length;
  const hasContent = combinedLength > 0;

  // Preserve any typed structured prompt text when switching update type (REC-007)
  const handleTypeChange = (nextType: UpdateType) => {
    if (nextType === d.type) return;
    if (d.p3.trim() && STRUCTURED_PROMPTS[nextType].length < 3) {
      const prevHeading = STRUCTURED_PROMPTS[d.type][2]?.heading ?? 'Notes';
      const folded = [d.content.trim(), `${prevHeading}:\n${d.p3.trim()}`].filter(Boolean).join('\n\n');
      editor.patch({ type: nextType, content: folded, p3: '' });
    } else {
      editor.set('type', nextType);
    }
  };

  return (
    <Modal title={update ? 'Edit progress update' : 'Add progress update'} onClose={onClose} dirty={editor.dirty}>
      <form onSubmit={(e) => { e.preventDefault(); void editor.submit(); }}>
        <SharedNotice />
        <ConflictBanner
          editor={editor}
          fields={[
            { label: 'Type', read: (r) => labels.update[r.type], draftRead: (x) => labels.update[x.type] },
            { label: 'Date', read: (r) => r.occurred_on, draftRead: (x) => x.occurred_on },
            { label: 'Text', read: (r) => r.content, draftRead: (x) => combineDraftContent(x) },
            { label: 'Links', read: (r) => (r.links ?? []).join('\n'), draftRead: (x) => x.links },
          ]}
        />
        <div className="grid2">
          <Select
            label="Type"
            value={d.type}
            onChange={handleTypeChange}
            options={(Object.keys(labels.update) as UpdateType[]).map((t) => ({ value: t, label: labels.update[t] }))}
          />
          <TextInput label="Date" type="date" value={d.occurred_on} required onChange={(v) => editor.set('occurred_on', v)} />
        </div>

        <p className="hint">{PROMPTS_INTRO[d.type]}</p>
        {specs[0] && (
          <TextArea
            label={specs[0].label}
            hint={specs[0].hint}
            value={d.p1}
            rows={2}
            maxLength={5000}
            onChange={(v) => editor.set('p1', v)}
          />
        )}
        {specs[1] && (
          <TextArea
            label={specs[1].label}
            hint={specs[1].hint}
            value={d.p2}
            rows={2}
            maxLength={5000}
            onChange={(v) => editor.set('p2', v)}
          />
        )}
        {specs[2] && (
          <TextArea
            label={specs[2].label}
            hint={specs[2].hint}
            value={d.p3}
            rows={2}
            maxLength={5000}
            onChange={(v) => editor.set('p3', v)}
          />
        )}
        <TextArea
          label="Additional notes or free-form details (optional if prompts above are used)"
          value={d.content}
          rows={4}
          maxLength={15000}
          onChange={(v) => editor.set('content', v)}
        />
        {combinedLength > MAX_CONTENT_LENGTH && (
          <p className="notice notice-bad small" role="alert">
            Combined length is {combinedLength.toLocaleString()} / {MAX_CONTENT_LENGTH.toLocaleString()} characters.
          </p>
        )}

        <TextArea
          label={`Links (optional, up to ${MAX_LINKS})`}
          hint="One web link (http:// or https://) per line."
          value={d.links}
          rows={2}
          onChange={(v) => editor.set('links', v)}
        />
        {problem && <p className="notice notice-bad" role="alert">{problem}</p>}

        <div className="grid2">
          <Select
            label="Linked objective (optional)"
            value={d.objective_id}
            onChange={(v) => editor.set('objective_id', v)}
            options={[{ value: '', label: 'None' }, ...objectives.filter((o) => !o.archived_at || o.id === d.objective_id).map((o) => ({ value: o.id, label: o.title }))]}
          />
          <Select
            label="Linked session (optional)"
            value={d.session_id}
            onChange={(v) => editor.set('session_id', v)}
            options={[{ value: '', label: 'None' }, ...[...sessions].reverse().filter((s) => !s.archived_at || s.id === d.session_id).map((s) => ({ value: s.id, label: `${formatInstant(s.scheduled_at)}${s.title ? ` — ${s.title}` : ''}` }))]}
          />
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={d.discuss_next}
            onChange={(e) => editor.set('discuss_next', e.target.checked)}
          />
          Bring this up in our next mentoring session
        </label>

        <SaveBar editor={editor} label={update ? 'Save update' : 'Add update'} disabled={!hasContent || combinedLength > MAX_CONTENT_LENGTH} />
      </form>
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
