import { supabase } from '../lib/supabase';
import type { ProgressUpdate, Stamped, TableName } from '../lib/types';

/** Raised when the record changed since the editor loaded it. */
export class ConflictError<T extends Stamped = Stamped> extends Error {
  constructor(public latest: T) {
    super('This record was changed by someone else.');
    this.name = 'ConflictError';
  }
}

const PAGE = 1000;
const PARTNERSHIP_SCOPED_TABLES = new Set([
  'objectives',
  'sessions',
  'actions',
  'progress_updates',
  'progress_update_comments',
]);

export async function fetchAll<T>(table: string, orderBy = 'created_at', partnershipId?: string | null): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select('*');
    if (partnershipId && PARTNERSHIP_SCOPED_TABLES.has(table)) {
      q = q.eq('partnership_id', partnershipId);
    }
    q = q.order(orderBy, { ascending: true });
    if (orderBy !== 'created_at' && table !== 'partnership_invites') {
      q = q.order('created_at', { ascending: true });
    }
    if (table !== 'session_objectives' && table !== 'partnership_invites') {
      q = q.order('id', { ascending: true });
    }
    const { data, error } = await q.range(from, from + PAGE - 1);
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

/**
 * Atomically syncs the objectives linked to a session via the server-side RPC (REC-003),
 * falling back to diff-based insert/delete if the RPC is unavailable in a mocked test environment.
 */
export async function setLinks(sessionId: string, objectiveIds: string[], current: string[]): Promise<void> {
  const add = objectiveIds.filter((id) => !current.includes(id));
  const remove = current.filter((id) => !objectiveIds.includes(id));
  if (add.length === 0 && remove.length === 0) return;

  if (typeof supabase.rpc === 'function') {
    const { error } = await supabase.rpc('sync_session_objectives', {
      p_session_id: sessionId,
      p_objective_ids: objectiveIds,
    });
    if (!error) return;
    // Only fall back if the function does not exist on a v1/mock database
    if (error.code !== 'PGRST202' && !/function .* does not exist/i.test(error.message ?? '')) {
      throw error;
    }
  }

  if (add.length) {
    const { error } = await supabase.from('session_objectives').insert(add.map((objective_id) => ({ session_id: sessionId, objective_id })));
    if (error) throw error;
  }
  if (remove.length) {
    const { error } = await supabase.from('session_objectives').delete().eq('session_id', sessionId).in('objective_id', remove);
    if (error) throw error;
  }
}

export async function toggleDiscussNext(updateId: string, discussNext: boolean): Promise<ProgressUpdate> {
  const { data, error } = await supabase.rpc('toggle_update_discuss_next', {
    p_update_id: updateId,
    p_discuss_next: discussNext,
  });
  if (error) throw error;
  return data as ProgressUpdate;
}

export async function createMenteePartnership(input: {
  mentee_name: string;
  title?: string;
  purpose?: string;
  meeting_cadence?: string;
  mentee_email?: string;
}): Promise<{ partnership_id: string; invite_code: string; mentee_name: string }> {
  const { data, error } = await supabase.rpc('create_mentee_partnership', {
    p_mentee_name: input.mentee_name,
    p_title: input.title ?? null,
    p_purpose: input.purpose ?? null,
    p_meeting_cadence: input.meeting_cadence ?? null,
    p_mentee_email: input.mentee_email ?? null,
  });
  if (error) throw error;
  return data as { partnership_id: string; invite_code: string; mentee_name: string };
}

export async function claimPartnershipInvite(code: string, displayName?: string): Promise<string> {
  const { data, error } = await supabase.rpc('claim_partnership_invite', {
    p_code: code,
    p_display_name: displayName ?? null,
  });
  if (error) throw error;
  return data as string;
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
