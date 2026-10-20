import { supabase } from '../lib/supabase';
import type { Stamped, TableName } from '../lib/types';

/** Raised when the record changed since the editor loaded it. */
export class ConflictError<T extends Stamped = Stamped> extends Error {
  constructor(public latest: T) {
    super('This record was changed by someone else.');
    this.name = 'ConflictError';
  }
}

const PAGE = 1000;

export async function fetchAll<T>(table: string, orderBy = 'created_at'): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function insertRow<T extends Stamped>(table: TableName, values: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from(table).insert(values).select().single();
  if (error) throw error;
  return data as T;
}

/**
 * Optimistic-concurrency update: only succeeds if the row is still at `version`.
 * If nothing matched, the latest row is fetched so the caller can reconcile.
 */
export async function updateRow<T extends Stamped>(
  table: TableName,
  id: string,
  patch: Record<string, unknown>,
  version: number,
): Promise<T> {
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).eq('version', version).select();
  if (error) throw error;
  if (data && data.length === 1) return data[0] as T;
  const latest = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (latest.error) throw latest.error;
  if (latest.data) throw new ConflictError(latest.data as T);
  throw new Error('This record is no longer available.');
}

export async function setLinks(sessionId: string, objectiveIds: string[], current: string[]): Promise<void> {
  const add = objectiveIds.filter((id) => !current.includes(id));
  const remove = current.filter((id) => !objectiveIds.includes(id));
  if (add.length) {
    const { error } = await supabase.from('session_objectives').insert(add.map((objective_id) => ({ session_id: sessionId, objective_id })));
    if (error) throw error;
  }
  if (remove.length) {
    const { error } = await supabase.from('session_objectives').delete().eq('session_id', sessionId).in('objective_id', remove);
    if (error) throw error;
  }
}

export function friendlyError(e: unknown): string {
  const err = e as { message?: string; code?: string } | null;
  if (!err) return 'Something went wrong. Your text is still here — please try again.';
  if (err.message && /fetch|network|Failed to load/i.test(err.message)) {
    return 'Could not reach the server. Check your connection; your text is still here.';
  }
  if (err.code === '42501' || err.code === 'PGRST301') return 'You do not have permission to do that, or your session has expired.';
  if (err.code === '23514') return 'One of the values is not allowed (for example an overlong text or an invalid link).';
  return 'Could not save. Your text is still here — please try again.';
}
