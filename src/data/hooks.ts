import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePartnership } from '../auth/PartnershipContext';
import {
  claimPartnershipInvite,
  createMenteePartnership,
  fetchAll,
  insertRow,
  setLinks,
  toggleDiscussNext,
  updateRow,
} from './api';
import type {
  Action,
  Objective,
  Partnership,
  PartnershipInvite,
  Preparation,
  Profile,
  ProgressUpdate,
  ProgressUpdateComment,
  Session,
  SessionObjective,
  Stamped,
  TableName,
} from '../lib/types';

const SCOPED = new Set(['objectives', 'sessions', 'actions', 'progress_updates', 'progress_update_comments']);

const useAll = <T,>(table: string, orderBy?: string, explicitPartnershipId?: string | null) => {
  const { activePartnershipId } = usePartnership();
  const pid = explicitPartnershipId !== undefined ? explicitPartnershipId : SCOPED.has(table) ? activePartnershipId : null;
  const queryKey = pid ? [table, pid] : [table];
  return useQuery({
    queryKey,
    queryFn: () => fetchAll<T>(table, orderBy, pid),
  });
};

export const usePartnerships = () => useAll<Partnership>('partnerships', 'created_at', null);
export const usePartnershipInvites = () => useAll<PartnershipInvite>('partnership_invites', 'created_at', null);
export const useObjectives = (partnershipId?: string | null) => useAll<Objective>('objectives', 'created_at', partnershipId);
export const useSessions = (partnershipId?: string | null) => useAll<Session>('sessions', 'scheduled_at', partnershipId);
export const useActions = (partnershipId?: string | null) => useAll<Action>('actions', 'created_at', partnershipId);
export const useUpdates = (partnershipId?: string | null) => useAll<ProgressUpdate>('progress_updates', 'occurred_on', partnershipId);
export const useUpdateComments = (partnershipId?: string | null) =>
  useAll<ProgressUpdateComment>('progress_update_comments', 'created_at', partnershipId);
export const usePreparations = () => useAll<Preparation>('session_preparation', 'created_at', null);
export const useSessionObjectives = () => useAll<SessionObjective>('session_objectives', 'created_at', null);
export const useProfiles = () => useAll<Profile>('profiles', 'role', null);

export function useCreate<T extends Stamped>(table: TableName) {
  const qc = useQueryClient();
  const { activePartnershipId } = usePartnership();
  return useMutation({
    mutationFn: (values: Record<string, unknown>) => {
      const payload =
        activePartnershipId && SCOPED.has(table) && values.partnership_id === undefined
          ? { ...values, partnership_id: activePartnershipId }
          : values;
      return insertRow<T>(table, payload);
    },
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

export function useToggleDiscussNext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { updateId: string; discussNext: boolean }) => toggleDiscussNext(v.updateId, v.discussNext),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['progress_updates'] }),
  });
}

export function useCreateMenteePartnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMenteePartnership,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['partnerships'] });
      await qc.invalidateQueries({ queryKey: ['partnership_invites'] });
    },
  });
}

export function useClaimPartnershipInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { code: string; displayName?: string }) => claimPartnershipInvite(v.code, v.displayName),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['profiles'] });
      await qc.invalidateQueries({ queryKey: ['partnerships'] });
      await qc.invalidateQueries({ queryKey: ['partnership_invites'] });
    },
  });
}

/** Archive (true) or restore (false) any record that has archive metadata. */
export function useArchive<T extends Stamped = Stamped>(table: TableName) {
  const update = useUpdate<T>(table);
  return (r: T, archive: boolean) =>
    update.mutateAsync({ id: r.id, version: r.version, patch: { archived_at: archive ? new Date().toISOString() : null } as Partial<T> });
}
