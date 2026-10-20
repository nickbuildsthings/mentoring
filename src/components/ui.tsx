import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { Editor } from './useEditor';
import type { Stamped } from '../lib/types';
import { formatInstant } from '../lib/format';
import { useProfiles } from '../data/hooks';

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {hint && <p className="hint" id={`${htmlFor}-hint`}>{hint}</p>}
      {children}
    </div>
  );
}

interface InputProps {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
  required?: boolean; type?: string; maxLength?: number; disabled?: boolean; placeholder?: string;
}

export function TextInput({ label, value, onChange, hint, required, type = 'text', maxLength, disabled, placeholder }: InputProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input id={id} type={type} value={value} required={required} maxLength={maxLength} disabled={disabled} placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function TextArea({ label, value, onChange, hint, required, rows = 4, maxLength, disabled, placeholder }: InputProps & { rows?: number }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <textarea id={id} value={value} rows={rows} required={required} maxLength={maxLength} disabled={disabled} placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function Select<T extends string>({ label, value, onChange, options, hint, disabled }: {
  label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; hint?: string; disabled?: boolean;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

const STATUS_ICON: Record<string, string> = {
  proposed: '◇', active: '●', achieved: '✓', paused: '❚❚', closed: '■',
  planned: '◷', completed: '✓', cancelled: '✕',
  not_started: '○', in_progress: '◐', blocked: '⚠',
  overdue: '!',
};

/** Status is always shown as text plus a symbol, never colour alone. */
export function Badge({ status, label, tone }: { status: string; label: string; tone?: 'bad' | 'good' | 'plain' }) {
  return <span className={`badge badge-${tone ?? status}`}><span aria-hidden="true">{STATUS_ICON[status] ?? '•'}</span> {label}</span>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="page-header"><h1>{title}</h1><div className="row">{children}</div></div>;
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <p className="muted" role="status">{label}</p>;
}

export function LoadError({ error, retry }: { error: unknown; retry?: () => void }) {
  void error;
  return (
    <div className="notice notice-bad" role="alert">
      <p>We couldn’t load this. Check your connection and try again.</p>
      {retry && <button className="btn" onClick={retry}>Try again</button>}
    </div>
  );
}

export function useNames() {
  const profiles = useProfiles();
  const map = new Map((profiles.data ?? []).map((p) => [p.id, p.display_name]));
  return (id: string | null | undefined) => (id ? map.get(id) ?? 'Unknown' : '');
}

export function Attribution({ record }: { record: Stamped }) {
  const name = useNames();
  const edited = record.updated_at !== record.created_at && record.version > 1;
  return (
    <p className="muted small">
      Created by {name(record.created_by)} on {formatInstant(record.created_at)}
      {edited && <> · Last edited by {name(record.updated_by)} on {formatInstant(record.updated_at)}</>}
      {record.archived_at && <> · Archived by {name(record.archived_by)} on {formatInstant(record.archived_at)}</>}
    </p>
  );
}

export function SaveBar<D extends object, R extends Stamped>({ editor, label = 'Save', disabled }: { editor: Editor<D, R>; label?: string; disabled?: boolean }) {
  const { state, dirty, error } = editor;
  let text = '';
  if (state === 'saving') text = 'Saving…';
  else if (state === 'error') text = error ?? 'Could not save.';
  else if (state === 'saved' && !dirty) text = 'Saved';
  else if (dirty) text = 'Unsaved changes';
  return (
    <div className="savebar">
      <button type="submit" className="btn btn-primary" disabled={state === 'saving' || disabled || (!dirty && state !== 'error')}>{state === 'saving' ? 'Saving…' : label}</button>
      <span role="status" aria-live="polite" className={state === 'error' ? 'save-text bad' : 'save-text'}>
        {state === 'error' && <span aria-hidden="true">⚠ </span>}{state === 'saved' && !dirty && <span aria-hidden="true">✓ </span>}{text}
      </span>
    </div>
  );
}

export function ConflictBanner<D extends object, R extends Stamped>({ editor, fields }: { editor: Editor<D, R>; fields?: { label: string; read: (r: R) => string }[] }) {
  const name = useNames();
  const c = editor.conflict;
  if (!c) return null;
  return (
    <div className="notice notice-bad" role="alert">
      <p><strong>{name(c.updated_by) || 'Someone'} saved changes to this record</strong> at {formatInstant(c.updated_at)} while you were editing.</p>
      {fields && (
        <dl className="compare">
          {fields.filter((f) => f.read(c).trim() !== '').map((f) => (<div key={f.label}><dt>{f.label} (their version)</dt><dd>{f.read(c)}</dd></div>))}
        </dl>
      )}
      <div className="row">
        <button type="button" className="btn" onClick={editor.loadLatest}>Discard mine and load theirs</button>
        <button type="button" className="btn btn-ghost" onClick={() => void editor.overwrite()}>Save mine over theirs</button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, dirty, children }: { title: string; onClose: () => void; dirty?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { if (d?.open) d.close(); };
  }, []);
  const requestClose = () => {
    if (dirty && !window.confirm('Close without saving? Your changes will be lost.')) return;
    onClose();
  };
  return (
    <dialog ref={ref} className="dialog" aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); requestClose(); }}>
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="btn btn-ghost" onClick={requestClose} aria-label="Close dialog">✕</button>
      </div>
      {children}
    </dialog>
  );
}

export function SharedNotice() {
  return (
    <p className="notice notice-info small">
      <span aria-hidden="true">👥 </span>Everything written here is visible to both you and your mentoring partner. There are no private notes in this workspace.
    </p>
  );
}

export function Linkify({ links }: { links: string[] }) {
  if (!links.length) return null;
  return (
    <ul className="links">
      {links.map((l) => (<li key={l}><a href={l} target="_blank" rel="noopener noreferrer">{l}</a></li>))}
    </ul>
  );
}

export function Text({ children }: { children: string | null | undefined }) {
  if (!children) return null;
  return <p className="prewrap">{children}</p>;
}
