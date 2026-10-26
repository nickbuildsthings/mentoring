import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { Modal, TextInput } from './ui';

interface FactorInfo {
  id: string;
  friendly_name?: string;
  status: string;
}

export function AccountModal({ onClose }: { onClose: () => void }) {
  const { passwordRecovery, clearPasswordRecovery, changePassword } = useAuth();
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [passMsg, setPassMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  // Optional TOTP MFA state (REC-013)
  const [factors, setFactors] = useState<FactorInfo[]>([]);
  const [enrolling, setEnrolling] = useState<{ id: string; secret: string; uri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [mfaMsg, setMfaMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const loadFactors = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      if (data?.totp) setFactors(data.totp as FactorInfo[]);
    } catch {
      // MFA API may be mocked in tests
    }
  };

  useEffect(() => {
    void loadFactors();
  }, []);

  const handleClose = () => {
    clearPasswordRecovery();
    onClose();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    if (newPass !== confirmPass) {
      setPassMsg({ text: 'The two passwords do not match.', bad: true });
      return;
    }
    setPassBusy(true);
    const problem = await changePassword(newPass);
    setPassBusy(false);
    if (problem) {
      setPassMsg({ text: problem, bad: true });
    } else {
      setNewPass('');
      setConfirmPass('');
      setPassMsg({ text: 'Your password has been updated.' });
    }
  };

  const startEnroll = async () => {
    setMfaMsg(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator App' });
    if (error || !data) {
      setMfaMsg({ text: error?.message ?? 'Could not start authenticator setup.', bad: true });
      return;
    }
    setEnrolling({ id: data.id, secret: data.totp.secret, uri: data.totp.uri });
  };

  const verifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrolling) return;
    setMfaMsg(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.id,
      code: totpCode.trim(),
    });
    if (error) {
      setMfaMsg({ text: 'Invalid code. Check your authenticator app and try again.', bad: true });
      return;
    }
    setEnrolling(null);
    setTotpCode('');
    setMfaMsg({ text: 'Two-factor authentication is now active on your account.' });
    await loadFactors();
  };

  const removeFactor = async (factorId: string) => {
    setMfaMsg(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setMfaMsg({ text: error.message || 'Could not remove authenticator.', bad: true });
      return;
    }
    setMfaMsg({ text: 'Authenticator removed.' });
    await loadFactors();
  };

  return (
    <Modal title={passwordRecovery ? 'Set a new password' : 'Account & security'} onClose={handleClose}>
      {passwordRecovery && (
        <p className="notice notice-info">
          Choose a new private password below to complete your account recovery.
        </p>
      )}
      <form onSubmit={(e) => void handlePasswordSubmit(e)}>
        <h3>Change password</h3>
        <p className="muted small">
          Use a strong password of at least 12 characters known only to you.
        </p>
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
        {passMsg && (
          <p role="status" className={passMsg.bad ? 'notice notice-bad' : 'notice notice-info'}>
            {passMsg.text}
          </p>
        )}
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={passBusy}>
            {passBusy ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>

      <hr className="divider" />

      <section aria-labelledby="h-mfa">
        <h3 id="h-mfa">Two-factor authentication (optional)</h3>
        <p className="muted small">
          Protect your mentoring notes with a time-based one-time code (TOTP) from an authenticator app.
        </p>
        {factors.filter((f) => f.status === 'verified').length > 0 ? (
          <ul className="plain">
            {factors
              .filter((f) => f.status === 'verified')
              .map((f) => (
                <li key={f.id} className="row">
                  <span>✓ {f.friendly_name || 'Authenticator app'} (active)</span>
                  <button type="button" className="btn btn-ghost" onClick={() => void removeFactor(f.id)}>
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        ) : !enrolling ? (
          <button type="button" className="btn" onClick={() => void startEnroll()}>
            Set up authenticator app
          </button>
        ) : null}

        {enrolling && (
          <form className="panel" onSubmit={(e) => void verifyEnroll(e)}>
            <p className="small">
              Enter this setup key into your authenticator app (such as 1Password, Bitwarden, Google Authenticator, or Apple Passwords):
            </p>
            <p className="mono notice">{enrolling.secret}</p>
            <TextInput
              label="6-digit verification code"
              value={totpCode}
              required
              maxLength={6}
              onChange={setTotpCode}
              placeholder="123456"
            />
            <div className="row">
              <button type="submit" className="btn btn-primary">Verify and activate</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEnrolling(null)}>Cancel</button>
            </div>
          </form>
        )}
        {mfaMsg && (
          <p role="status" className={mfaMsg.bad ? 'notice notice-bad' : 'notice notice-info'}>
            {mfaMsg.text}
          </p>
        )}
      </section>
    </Modal>
  );
}
