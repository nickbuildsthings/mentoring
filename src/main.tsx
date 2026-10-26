import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './lib/supabase';
import { App } from './App';
import './styles.css';

function isAuthFailure(e: unknown): boolean {
  const err = e as { status?: number; code?: string; message?: string } | null;
  return !!err && (err.status === 401 || err.code === 'PGRST301' || /JWT expired/i.test(err.message ?? ''));
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // An expired or invalid session returns the user to sign-in without showing stale content.
    onError: (e) => { if (isAuthFailure(e)) void supabase.auth.signOut(); },
  }),
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
