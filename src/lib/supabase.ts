import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anonKey);

export interface InitialAuthUrlInfo {
  isRecovery: boolean;
  tokenHash: string | null;
  errorDescription: string | null;
}

// Capture auth callback parameters synchronously BEFORE createClient() runs and strips window.location.hash.
function captureInitialAuthUrl(): InitialAuthUrlInfo {
  if (typeof window === 'undefined') {
    return { isRecovery: false, tokenHash: null, errorDescription: null };
  }
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const type = hash.get('type') ?? search.get('type');
  const tokenHash = search.get('token_hash') ?? search.get('token');
  const errorDescription =
    hash.get('error_description') ??
    search.get('error_description') ??
    hash.get('error') ??
    search.get('error');
  return {
    isRecovery: type === 'recovery',
    tokenHash: type === 'recovery' ? tokenHash : null,
    errorDescription: errorDescription ? errorDescription.replace(/\+/g, ' ') : null,
  };
}

export const initialAuthUrl = captureInitialAuthUrl();

// The anon key is public by design; access is enforced by row-level security.
// The service-role key must never be used in this codebase.
// detectSessionInUrl is enabled so Supabase password recovery links work (REC-001).
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

