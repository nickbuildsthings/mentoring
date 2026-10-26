import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAll } from '../data/api';
import type { MemberRole, Partnership, PartnershipInvite, Profile } from '../lib/types';
import { useMe } from './AuthProvider';

export type WorkspaceViewMode = 'partnership' | 'mentor-overview';

interface PartnershipContextValue {
  partnerships: Partnership[];
  invites: PartnershipInvite[];
  activePartnership: Partnership | null;
  activePartnershipId: string | null;
  viewMode: WorkspaceViewMode;
  setViewMode: (mode: WorkspaceViewMode) => void;
  selectPartnership: (id: string) => void;
  myRole: MemberRole;
  partnerName: string;
  partnerProfile: Profile | undefined;
  isMentorOfAny: boolean;
  isPending: boolean;
}

const STORAGE_KEY = 'mentoring_active_partnership_id';
const VIEW_MODE_KEY = 'mentoring_view_mode';

const PartnershipCtx = createContext<PartnershipContextValue | null>(null);

export function PartnershipProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const partnershipsQuery = useQuery({
    queryKey: ['partnerships'],
    queryFn: async () => {
      try {
        return await fetchAll<Partnership>('partnerships', 'created_at');
      } catch {
        return [] as Partnership[];
      }
    },
  });
  const invitesQuery = useQuery({
    queryKey: ['partnership_invites'],
    queryFn: async () => {
      try {
        return await fetchAll<PartnershipInvite>('partnership_invites', 'created_at');
      } catch {
        return [] as PartnershipInvite[];
      }
    },
  });
  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: () => fetchAll<Profile>('profiles', 'role'),
  });

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [viewMode, setViewModeState] = useState<WorkspaceViewMode>(() => {
    try {
      return sessionStorage.getItem(VIEW_MODE_KEY) === 'mentor-overview' ? 'mentor-overview' : 'partnership';
    } catch {
      return 'partnership';
    }
  });

  const profiles = profilesQuery.data ?? [];
  const activePartnerships = useMemo(
    () => (partnershipsQuery.data ?? []).filter((p) => !p.archived_at),
    [partnershipsQuery.data],
  );

  const activePartnership = useMemo<Partnership | null>(() => {
    if (activePartnerships.length === 0) return null;
    if (selectedId) {
      const match = activePartnerships.find((p) => p.id === selectedId);
      if (match) return match;
    }
    return activePartnerships[0];
  }, [activePartnerships, selectedId]);

  useEffect(() => {
    if (activePartnership && activePartnership.id !== selectedId) {
      setSelectedId(activePartnership.id);
      try {
        sessionStorage.setItem(STORAGE_KEY, activePartnership.id);
      } catch {
        // ignore storage errors
      }
    }
  }, [activePartnership, selectedId]);

  const selectPartnership = (id: string) => {
    setSelectedId(id);
    setViewModeState('partnership');
    try {
      sessionStorage.setItem(STORAGE_KEY, id);
      sessionStorage.setItem(VIEW_MODE_KEY, 'partnership');
    } catch {
      // ignore
    }
  };

  const setViewMode = (mode: WorkspaceViewMode) => {
    setViewModeState(mode);
    try {
      sessionStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // ignore
    }
  };

  const myRole: MemberRole = useMemo(() => {
    if (!activePartnership) return me.role;
    return activePartnership.mentor_id === me.id ? 'mentor' : 'mentee';
  }, [activePartnership, me]);

  const partnerProfile = useMemo(() => {
    if (activePartnership) {
      const partnerId = activePartnership.mentor_id === me.id ? activePartnership.mentee_id : activePartnership.mentor_id;
      return partnerId ? profiles.find((p) => p.id === partnerId) : undefined;
    }
    return profiles.find((p) => p.id !== me.id);
  }, [activePartnership, profiles, me.id]);

  const partnerName = useMemo(() => {
    if (partnerProfile) return partnerProfile.display_name;
    if (activePartnership && activePartnership.mentor_id === me.id) {
      return activePartnership.mentee_name;
    }
    return 'Mentoring partner';
  }, [partnerProfile, activePartnership, me.id]);

  const isMentorOfAny = me.role === 'mentor' || activePartnerships.some((p) => p.mentor_id === me.id);

  const value = useMemo<PartnershipContextValue>(
    () => ({
      partnerships: activePartnerships,
      invites: invitesQuery.data ?? [],
      activePartnership,
      activePartnershipId: activePartnership?.id ?? null,
      viewMode,
      setViewMode,
      selectPartnership,
      myRole,
      partnerName,
      partnerProfile,
      isMentorOfAny,
      isPending: partnershipsQuery.isPending,
    }),
    [
      activePartnerships,
      invitesQuery.data,
      activePartnership,
      viewMode,
      myRole,
      partnerName,
      partnerProfile,
      isMentorOfAny,
      partnershipsQuery.isPending,
    ],
  );

  return <PartnershipCtx.Provider value={value}>{children}</PartnershipCtx.Provider>;
}

const FALLBACK_PARTNERSHIP_CONTEXT: PartnershipContextValue = {
  partnerships: [],
  invites: [],
  activePartnership: null,
  activePartnershipId: null,
  viewMode: 'partnership',
  setViewMode: () => {},
  selectPartnership: () => {},
  myRole: 'mentee',
  partnerName: 'Them',
  partnerProfile: undefined,
  isMentorOfAny: false,
  isPending: false,
};

export function usePartnership(): PartnershipContextValue {
  return useContext(PartnershipCtx) ?? FALLBACK_PARTNERSHIP_CONTEXT;
}
