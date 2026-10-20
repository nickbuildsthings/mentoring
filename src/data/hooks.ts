import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAll, insertRow, setLinks, updateRow } from './api';
import type {
  Action, Objective, Preparation, Profile, ProgressUpdate, Session, SessionObjective, Stamped, TableName,
} from '../lib/types';

const useAll = <T,>(table: string, orderBy?: string) =>
  useQuery({ queryKey: [table], queryFn: () => fetchAll<T>(table, orderBy) });

export const useObjectives = () => useAll<Objective>('objectives');
export const useSessions = () => useAll<Session>('sessions', 'scheduled_at');
export const useActions = () => useAll<Action>('actions');
export const useUpdates = () => useAll<ProgressUpdate>('progress_updates', 'occurred_on');
export const usePreparations = () => useAll<Preparation>('session_preparation');
export const useSessionObjectives = () => useAll<SessionObjective>('session_objectives');
export const useProfiles = () => useAll<Profile>('profiles', 'role');

export function useCreate<T extends Stamped>(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, unknown>) => insertRow<T>(table, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}

export function useUpdate<T extends Stamped>(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; patch: Record<string, unknown>; version: number }) =>
      updateRow<T>(table, v.id, v.patch, v.version),
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}

export function useSetSessionObjectives() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { sessionId: string; objectiveIds: string[]; current: string[] }) =>
      setLinks(v.sessionId, v.objectiveIds, v.current),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session_objectives'] }),
  });
}

/** Archive (true) or restore (false) any record that has archive metadata. */
export function useArchive(table: TableName) {
  const update = useUpdate(table);
  return (r: Stamped, archive: boolean) =>
    update.mutateAsync({ id: r.id, version: r.version, patch: { archived_at: archive ? new Date().toISOString() : null } });
}
