import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AccountModal } from '../components/AccountModal';
import { TextInput } from '../components/ui';
import { claimPartnershipInvite } from '../data/api';

export function SignIn() {
  const {
    state,
    passwordRecovery,
    authNotice,
    clearAuthNotice,
    signIn,
    requestPasswordReset,
    changePassword,
  } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (passwordRecovery && (state.status === 'ready' || state.status === 'unauthorised')) {
    return (
      <main className="centre">
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            if (newPass !== confirmPass) {
              setError('The two passwords do not match.');
              return;
            }
            setBusy(true);
            const problem = await changePassword(newPass);
            setBusy(false);
            if (problem) setError(problem);
          }}
        >
          <h1>Set a new password</h1>
          <p className="muted">Choose a strong password of at least 12 characters to complete your account recovery.</p>
          <TextInput
            label="New password"
            type="password"
            value={newPass}
            required
            onChange={setNewPass}
            hint="Minimum 12 characters."
          />
          <TextInput
            label="Confirm new password"
            type="password"
            value={confirmPass}
            required
            onChange={setConfirmPass}
          />
          {error && (
            <p className="notice notice-bad" role="alert">
              <span aria-hidden="true">⚠ </span>
              {error}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </main>
    );
  }

  if (state.status === 'ready') return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;
  if (state.status === 'unauthorised') return <NoAccess />;

  if (resetMode) {
    return (
      <main className="centre">
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            clearAuthNotice();
            const problem = await requestPasswordReset(email);
            setBusy(false);
            if (problem) {
              setError(problem);
            } else {
              setResetSent(true);
            }
          }}
        >
          <h1>Reset your password</h1>
          <p className="muted">
            Enter your account email address and we will send you a password recovery link.
          </p>
          <TextInput label="Email address" type="email" value={email} required onChange={setEmail} />
          {error && (
            <p className="notice notice-bad" role="alert">
              <span aria-hidden="true">⚠ </span>
              {error}
            </p>
          )}
          {resetSent && (
            <p className="notice notice-info" role="status">
              If an account exists for that email address, a password reset link has been sent. Open it in this browser to choose a new password.
            </p>
          )}
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setResetMode(false);
                setResetSent(false);
                setError(null);
              }}
            >
              Back to sign in
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="centre">
      <form className="panel" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError(null); clearAuthNotice();
        const problem = await signIn(email, password);
        if (problem) setError(problem);
        setBusy(false);
      }}>
        <h1>Mentoring Workspace</h1>
        <p className="muted">A private space for mentoring partnerships. Sign in with your own account.</p>
        {authNotice && <p className="notice notice-bad" role="alert"><span aria-hidden="true">⚠ </span>{authNotice}</p>}
        <TextInput label="Email address" type="email" value={email} required onChange={setEmail} />
        <TextInput label="Password" type="password" value={password} required onChange={setPassword} />
        {error && <p className="notice notice-bad" role="alert"><span aria-hidden="true">⚠ </span>{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted small">
          Forgotten your password?{' '}
          <button
            type="button"
            className="btn btn-ghost small-btn"
            onClick={() => {
              setError(null);
              clearAuthNotice();
              setResetMode(true);
            }}
          >
            Send a password reset link
          </button>
        </p>
      </form>
    </main>
  );
}

export function NoAccess() {
  const { signOut, retryProfile, passwordRecovery, clearPasswordRecovery } = useAuth();
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
      {passwordRecovery && <AccountModal onClose={clearPasswordRecovery} />}
    </main>
  );
}

