import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session as AuthSession } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'unauthorised' }
  | { status: 'ready'; me: Profile };

interface AuthApi {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    async function resolve(session: AuthSession | null) {
      if (!session) {
        qc.clear();
        if (!cancelled) setState({ status: 'signed-out' });
        return;
      }
      const { data, error } = await supabase.from('profiles').select('id, display_name, role').eq('id', session.user.id).maybeSingle();
      if (cancelled) return;
      if (error || !data) setState({ status: 'unauthorised' });
      else setState({ status: 'ready', me: data as Profile });
    }
    // Never call Supabase from inside the callback itself (it can deadlock); defer.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      setTimeout(() => void resolve(session), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  const api = useMemo<AuthApi>(
    () => ({
      state,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (!error) return null;
        // Deliberately generic: never reveal whether an address has an account.
        return error.status === 429
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : 'Those details were not recognised. Check your email address and password and try again.';
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [state],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

export function useMe(): Profile {
  const { state } = useAuth();
  if (state.status !== 'ready') throw new Error('useMe before sign-in');
  return state.me;
}
