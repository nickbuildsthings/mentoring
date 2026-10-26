import { useState } from 'react';
import { useUpdate } from '../data/hooks';
import { formatDay } from '../lib/format';
import type { Partnership } from '../lib/types';
import { Attribution, ConflictBanner, SaveBar, SharedNotice, Text, TextArea, TextInput } from './ui';
import { useEditor } from './useEditor';

interface CharterDraft {
  title: string;
  purpose: string;
  meeting_cadence: string;
  working_agreement: string;
  review_horizon: string;
}

const toDraft = (p: Partnership | undefined): CharterDraft => ({
  title: p?.title ?? '',
  purpose: p?.purpose ?? '',
  meeting_cadence: p?.meeting_cadence ?? '',
  working_agreement: p?.working_agreement ?? '',
  review_horizon: p?.review_horizon ?? '',
});

const nul = (s: string) => (s.trim() === '' ? null : s.trim());

/**
 * Shared Mentoring Charter / Working Agreement panel (REC-019).
 * Captures the overarching purpose, cadence, expectations, and review horizon for a mentoring pair.
 */
export function CharterPanel({ partnership, defaultOpen = false }: { partnership: Partnership; defaultOpen?: boolean }) {
  const update = useUpdate<Partnership>('partnerships');
  const hasContent = Boolean(
    partnership.title || partnership.purpose || partnership.meeting_cadence || partnership.working_agreement || partnership.review_horizon,
  );
  const [editing, setEditing] = useState(defaultOpen || !hasContent);

  const editor = useEditor<CharterDraft, Partnership>({
    record: partnership,
    toDraft,
    save: (d, base) =>
      update.mutateAsync({
        id: (base ?? partnership).id,
        version: (base ?? partnership).version,
        patch: {
          title: nul(d.title),
          purpose: nul(d.purpose),
          meeting_cadence: nul(d.meeting_cadence),
          working_agreement: nul(d.working_agreement),
          review_horizon: nul(d.review_horizon),
        },
      }),
    onSaved: () => setEditing(false),
  });
  const d = editor.draft;

  if (!editing && hasContent) {
    return (
      <section aria-labelledby="h-charter" className="panel charter-panel">
        <div className="section-head">
          <h2 id="h-charter">Mentoring charter & working agreement</h2>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            Edit charter
          </button>
        </div>
        <div className="grid2">
          {partnership.title && (
            <div>
              <h4>Focus / theme</h4>
              <p>{partnership.title}</p>
            </div>
          )}
          {partnership.meeting_cadence && (
            <div>
              <h4>Meeting cadence</h4>
              <p>{partnership.meeting_cadence}</p>
            </div>
          )}
          {partnership.review_horizon && (
            <div>
              <h4>Target review horizon</h4>
              <p>{formatDay(partnership.review_horizon)}</p>
            </div>
          )}
        </div>
        {partnership.purpose && (
          <div>
            <h4>Overarching purpose</h4>
            <Text>{partnership.purpose}</Text>
          </div>
        )}
        {partnership.working_agreement && (
          <div>
            <h4>How we work together (expectations & feedback)</h4>
            <Text>{partnership.working_agreement}</Text>
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="h-charter" className="panel charter-panel">
      <div className="section-head">
        <h2 id="h-charter">Mentoring charter & working agreement</h2>
        {hasContent && (
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
            Collapse
          </button>
        )}
      </div>
      <p className="muted small">
        Agree the big-picture purpose of your mentoring relationship, how often you’ll meet, and how you both prefer to give and receive feedback.
      </p>
      <SharedNotice />
      <form onSubmit={(e) => { e.preventDefault(); void editor.submit(); }}>
        <ConflictBanner
          editor={editor}
          fields={[
            { label: 'Focus / theme', read: (r) => r.title ?? '', draftRead: (x) => x.title },
            { label: 'Purpose', read: (r) => r.purpose ?? '', draftRead: (x) => x.purpose },
            { label: 'Cadence', read: (r) => r.meeting_cadence ?? '', draftRead: (x) => x.meeting_cadence },
            { label: 'Working agreement', read: (r) => r.working_agreement ?? '', draftRead: (x) => x.working_agreement },
            { label: 'Review horizon', read: (r) => r.review_horizon ?? '', draftRead: (x) => x.review_horizon },
          ]}
        />
        <div className="grid2">
          <TextInput
            label="Mentoring focus or theme (optional)"
            value={d.title}
            maxLength={200}
            onChange={(v) => editor.set('title', v)}
            placeholder="e.g. Stepping into technical leadership"
          />
          <TextInput
            label="Meeting cadence (optional)"
            value={d.meeting_cadence}
            maxLength={500}
            onChange={(v) => editor.set('meeting_cadence', v)}
            placeholder="e.g. Fortnightly for 60 minutes"
          />
        </div>
        <TextArea
          label="Overarching purpose — what are we here to achieve together?"
          hint="What will make this mentoring relationship worthwhile over the next 6–12 months?"
          value={d.purpose}
          rows={3}
          maxLength={5000}
          onChange={(v) => editor.set('purpose', v)}
        />
        <TextArea
          label="Working agreement & expectations"
          hint="How will we prepare? How do we like to receive challenge or feedback? What happens if we need to reschedule?"
          value={d.working_agreement}
          rows={3}
          maxLength={5000}
          onChange={(v) => editor.set('working_agreement', v)}
        />
        <TextInput
          label="Target relationship review date (optional)"
          type="date"
          value={d.review_horizon}
          onChange={(v) => editor.set('review_horizon', v)}
        />
        <SaveBar editor={editor} label="Save charter" />
      </form>
      <Attribution record={partnership} />
      {editor.guard}
    </section>
  );
}
