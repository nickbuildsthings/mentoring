import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { TextInput } from '../components/ui';

export function SignIn() {
  const { state, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'ready') return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;
  if (state.status === 'unauthorised') return <NoAccess />;

  return (
    <main className="centre">
      <form className="panel" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError(null);
        const problem = await signIn(email, password);
        if (problem) setError(problem);
        setBusy(false);
      }}>
        <h1>Mentoring Workspace</h1>
        <p className="muted">A private space for two people. Sign in with your own account.</p>
        <TextInput label="Email address" type="email" value={email} required onChange={setEmail} />
        <TextInput label="Password" type="password" value={password} required onChange={setPassword} />
        {error && <p className="notice notice-bad" role="alert"><span aria-hidden="true">⚠ </span>{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted small">Forgotten your password? Ask the person who set up the workspace to reset it.</p>
      </form>
    </main>
  );
}

export function NoAccess() {
  const { signOut } = useAuth();
  return (
    <main className="centre">
      <div className="panel">
        <h1>No access</h1>
        <p>This account is not approved for this workspace, so no mentoring content is shown.</p>
        <button className="btn" onClick={() => void signOut()}>Sign out</button>
      </div>
    </main>
  );
}
