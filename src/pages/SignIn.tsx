import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { TextInput } from '../components/ui';
import { claimPartnershipInvite } from '../data/api';

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
        <p className="muted">A private space for mentoring partnerships. Sign in with your own account.</p>
        <TextInput label="Email address" type="email" value={email} required onChange={setEmail} />
        <TextInput label="Password" type="password" value={password} required onChange={setPassword} />
        {error && <p className="notice notice-bad" role="alert"><span aria-hidden="true">⚠ </span>{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted small">Forgotten your password? Ask the person who set up the workspace to send a password reset.</p>
      </form>
    </main>
  );
}

export function NoAccess() {
  const { signOut, retryProfile } = useAuth();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await claimPartnershipInvite(code.trim(), name.trim() || undefined);
      await retryProfile();
    } catch {
      setError('That invitation code was not recognised or has already been used.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="centre">
      <div className="panel">
        <h1>No workspace linked yet</h1>
        <p>This account is not yet linked to an approved mentoring workspace, so no mentoring content is shown.</p>

        <form onSubmit={(e) => void handleClaim(e)} className="invite-claim-box">
          <h2>Have an invitation code?</h2>
          <p className="muted small">If your mentor gave you an invitation code, enter it below to join your workspace.</p>
          <TextInput
            label="Invitation code"
            value={code}
            required
            maxLength={64}
            onChange={setCode}
            placeholder="e.g. A1B2-C3D4"
          />
          <TextInput
            label="Your display name"
            value={name}
            maxLength={80}
            onChange={setName}
            placeholder="How your name should appear"
          />
          {error && <p className="notice notice-bad" role="alert">{error}</p>}
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={busy || !code.trim()}>
              {busy ? 'Joining…' : 'Join workspace'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
