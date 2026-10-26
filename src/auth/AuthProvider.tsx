import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session as AuthSession } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'error'; message: string }
  | { status: 'unauthorised'; userId: string; email?: string }
  | { status: 'ready'; me: Profile };

interface AuthApi {
  state: AuthState;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<string | null>;
  retryProfile: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const sessionRef = useRef<AuthSession | null>(null);

  const resolve = useCallback(
    async (session: AuthSession | null, isCancelled?: () => boolean) => {
      sessionRef.current = session;
      if (!session) {
        qc.clear();
        if (!isCancelled?.()) setState({ status: 'signed-out' });
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (isCancelled?.()) return;
      if (error) {
        // Distinguish transient network/server errors from genuine lack of profile approval (REC-006).
        const code = (error as { code?: string; status?: number }).code;
        const status = (error as { status?: number }).status;
        if (status === 401 || code === 'PGRST301') {
          await supabase.auth.signOut();
          return;
        }
        setState({
          status: 'error',
          message: 'We could not verify your account right now. Check your internet connection and try again.',
        });
        return;
      }
      if (!data) {
        setState({ status: 'unauthorised', userId: session.user.id, email: session.user.email });
      } else {
        setState({ status: 'ready', me: data as Profile });
      }
    },
    [qc],
  );

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    // Never call Supabase from inside the callback itself (it can deadlock); defer.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      if (event === 'TOKEN_REFRESHED') return;
      setTimeout(() => void resolve(session, isCancelled), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [resolve]);

  const api = useMemo<AuthApi>(
    () => ({
      state,
      passwordRecovery,
      clearPasswordRecovery: () => setPasswordRecovery(false),
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (!error) return null;
        // Deliberately generic: never reveal whether an address has an account.
        return error.status === 429
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : 'Those details were not recognised. Check your email address and password and try again.';
      },
      async signOut() {
        setPasswordRecovery(false);
        await supabase.auth.signOut();
      },
      async changePassword(newPassword) {
        if (newPassword.length < 12) {
          return 'Please choose a password of at least 12 characters.';
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) return error.message || 'Could not update password. Please try again.';
        setPasswordRecovery(false);
        return null;
      },
      async retryProfile() {
        setState({ status: 'loading' });
        const { data } = await supabase.auth.getSession();
        await resolve(data.session ?? sessionRef.current);
      },
    }),
    [state, passwordRecovery, resolve],
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
