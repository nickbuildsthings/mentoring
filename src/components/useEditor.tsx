import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConflictError, friendlyError } from '../data/api';
import type { Stamped } from '../lib/types';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Options<D, R extends Stamped> {
  /** The stored record, or undefined when creating. */
  record: R | undefined;
  toDraft: (record: R | undefined) => D;
  /** Persist the draft. For existing records use `base.version` for the concurrency check. */
  save: (draft: D, base: R | undefined) => Promise<R>;
  /** Called after a successful save (e.g. to navigate or close a dialog). */
  onSaved?: (saved: R) => void;
}

export interface Editor<D, R extends Stamped> {
  draft: D;
  set: <K extends keyof D>(key: K, value: D[K]) => void;
  patch: (values: Partial<D>) => void;
  dirty: boolean;
  state: SaveState;
  error: string | null;
  /** Latest stored version when it differs from what the user started from. */
  conflict: R | null;
  submit: () => Promise<void>;
  loadLatest: () => void;
  overwrite: () => Promise<void>;
  guard: ReactNode;
}

export function useEditor<D extends object, R extends Stamped>({ record, toDraft, save, onSaved }: Options<D, R>): Editor<D, R> {
  const baseRef = useRef<R | undefined>(record);
  const baselineRef = useRef<string>(JSON.stringify(toDraft(record)));
  const [draft, setDraft] = useState<D>(() => toDraft(record));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<R | null>(null);
  const [, bump] = useState(0);

  const isDirty = () => JSON.stringify(draftRef.current) !== baselineRef.current;
  const dirty = JSON.stringify(draft) !== baselineRef.current;

  const adopt = useCallback((r: R | undefined) => {
    baseRef.current = r;
    const next = toDraft(r);
    baselineRef.current = JSON.stringify(next);
    draftRef.current = next;
    setDraft(next);
    setConflict(null);
    bump((n) => n + 1);
  }, [toDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick up changes to the stored record, but never overwrite what the user is typing.
  useEffect(() => {
    if (!record) return;
    const base = baseRef.current;
    if (!base || base.id !== record.id) return adopt(record);
    if (record.version === base.version) return;
    if (!isDirty()) adopt(record);
    else setConflict(record);
  }, [record]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const blocker = useBlocker(() => isDirty());

  const run = useCallback(async (base: R | undefined) => {
    setState('saving');
    setError(null);
    const sent = draftRef.current;
    try {
      const saved = await save(sent, base);
      baseRef.current = saved;
      // Edits made while the save was in flight stay dirty.
      baselineRef.current = JSON.stringify(sent);
      setConflict(null);
      setState('saved');
      bump((n) => n + 1);
      onSaved?.(saved);
    } catch (e) {
      if (e instanceof ConflictError) {
        setConflict(e.latest as R);
        setState('error');
        setError('Someone else changed this while you were editing. Your text has been kept below.');
      } else {
        setState('error');
        setError(friendlyError(e));
      }
    }
  }, [save, onSaved]);

  const guard = blocker.state === 'blocked' ? (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="leave-title">
        <h2 id="leave-title">Leave without saving?</h2>
        <p>You have unsaved changes on this page.</p>
        <div className="row">
          <button type="button" className="btn" autoFocus onClick={() => blocker.reset()}>Stay and keep editing</button>
          <button type="button" className="btn btn-ghost" onClick={() => blocker.proceed()}>Leave and discard</button>
        </div>
      </div>
    </div>
  ) : null;

  return {
    draft,
    set: (key, value) => { setDraft((d) => ({ ...d, [key]: value })); setState('idle'); },
    patch: (values) => { setDraft((d) => ({ ...d, ...values })); setState('idle'); },
    dirty, state, error, conflict, guard,
    submit: () => run(baseRef.current),
    loadLatest: () => { if (conflict) { adopt(conflict); setState('idle'); setError(null); } },
    overwrite: async () => { if (conflict) { baseRef.current = conflict; await run(conflict); } },
  };
}
