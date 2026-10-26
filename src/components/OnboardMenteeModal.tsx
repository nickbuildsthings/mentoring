import { useState } from 'react';
import { usePartnership } from '../auth/PartnershipContext';
import { useClaimPartnershipInvite, useCreateMenteePartnership } from '../data/hooks';
import { Modal, TextArea, TextInput } from './ui';

export function OnboardMenteeModal({ onClose }: { onClose: () => void }) {
  const { invites, selectPartnership } = usePartnership();
  const createPartnership = useCreateMenteePartnership();
  const claimInvite = useClaimPartnershipInvite();

  const [tab, setTab] = useState<'create' | 'claim'>('create');
  const [menteeName, setMenteeName] = useState('');
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [cadence, setCadence] = useState('Fortnightly');
  const [created, setCreated] = useState<{ partnership_id: string; invite_code: string; mentee_name: string } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [claimCode, setClaimCode] = useState('');
  const [claimName, setClaimName] = useState('');
  const [claimError, setClaimError] = useState<string | null>(null);

  const pendingInvites = invites.filter((i) => !i.claimed_at);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      const res = await createPartnership.mutateAsync({
        mentee_name: menteeName.trim(),
        title: title.trim() || undefined,
        purpose: purpose.trim() || undefined,
        meeting_cadence: cadence.trim() || undefined,
      });
      setCreated(res);
      selectPartnership(res.partnership_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/create_mentee_partnership|schema cache|function/i.test(msg)) {
        setCreateError('Database migration required: please run supabase/migrations/20261023000000_v2_multi_mentee_and_features.sql in your Supabase SQL Editor first.');
      } else {
        setCreateError('Could not create the mentee workspace. Please try again.');
      }
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError(null);
    try {
      const pid = await claimInvite.mutateAsync({
        code: claimCode.trim(),
        displayName: claimName.trim() || undefined,
      });
      selectPartnership(pid);
      onClose();
    } catch {
      setClaimError('That invitation code was not recognised or has already been claimed.');
    }
  };

  return (
    <Modal title="Mentoring partnerships & onboarding" onClose={onClose}>
      <div className="seg" role="group" aria-label="Onboarding mode">
        <button
          type="button"
          className="btn btn-seg"
          aria-pressed={tab === 'create'}
          onClick={() => setTab('create')}
        >
          Onboard a new mentee
        </button>
        <button
          type="button"
          className="btn btn-seg"
          aria-pressed={tab === 'claim'}
          onClick={() => setTab('claim')}
        >
          Enter an invitation code
        </button>
      </div>

      {tab === 'create' ? (
        created ? (
          <div className="panel">
            <h3>Workspace ready for {created.mentee_name}</h3>
            <p className="small">
              Each mentee has a completely isolated workspace with you. They can never see your other mentees or their records.
            </p>
            <p>
              <strong>Invitation code:</strong> <code className="invite-code">{created.invite_code}</code>
            </p>
            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void navigator.clipboard?.writeText(created.invite_code);
                  setCopied(true);
                }}
              >
                {copied ? '✓ Copied code' : 'Copy invitation code'}
              </button>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Open {created.mentee_name}’s workspace
              </button>
            </div>
            <p className="muted small">
              <strong>How to onboard {created.mentee_name}:</strong> Create their account in Supabase Authentication (or invite them by email), then give them the invitation code above. On their first sign-in, they enter the code to link their account and set their private password. You can already start preparing objectives and sessions in their workspace now.
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => void handleCreate(e)}>
            <p className="muted small">
              Create a dedicated, private 1:1 workspace for a new mentee. You can prepare initial objectives, charter ideas, and your first session right away, and share the generated invitation code with them to link their account.
            </p>
            <TextInput
              label="Mentee’s name"
              value={menteeName}
              required
              maxLength={80}
              onChange={setMenteeName}
              placeholder="e.g. Alex Rivera"
            />
            <TextInput
              label="Mentoring focus or theme (optional)"
              value={title}
              maxLength={200}
              onChange={setTitle}
              placeholder="e.g. Transition to Engineering Manager"
            />
            <TextInput
              label="Suggested meeting cadence (optional)"
              value={cadence}
              maxLength={100}
              onChange={setCadence}
              placeholder="e.g. Fortnightly, 45 mins"
            />
            <TextArea
              label="Initial purpose / notes for your charter (optional)"
              value={purpose}
              rows={3}
              maxLength={5000}
              onChange={setPurpose}
              hint="You and your mentee can refine this together in your first session."
            />
            {createError && <p className="notice notice-bad" role="alert">{createError}</p>}
            <div className="row">
              <button type="submit" className="btn btn-primary" disabled={createPartnership.isPending || !menteeName.trim()}>
                {createPartnership.isPending ? 'Creating workspace…' : 'Create mentee workspace & invite code'}
              </button>
            </div>
          </form>
        )
      ) : (
        <form onSubmit={(e) => void handleClaim(e)}>
          <p className="muted small">
            If a mentor has shared an invitation code with you, enter it below to join that mentoring workspace.
          </p>
          <TextInput
            label="Invitation code"
            value={claimCode}
            required
            maxLength={64}
            onChange={setClaimCode}
            placeholder="e.g. A1B2-C3D4"
          />
          <TextInput
            label="Your display name (optional)"
            value={claimName}
            maxLength={80}
            onChange={setClaimName}
          />
          {claimError && <p className="notice notice-bad" role="alert">{claimError}</p>}
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={claimInvite.isPending || !claimCode.trim()}>
              {claimInvite.isPending ? 'Joining…' : 'Join mentoring workspace'}
            </button>
          </div>
        </form>
      )}

      {pendingInvites.length > 0 && (
        <section aria-labelledby="h-pending" className="panel">
          <h3 id="h-pending">Pending invitation codes</h3>
          <ul className="plain">
            {pendingInvites.map((inv) => (
              <li key={inv.partnership_id} className="row">
                <code>{inv.code}</code>
                <span className="muted small">Awaiting mentee claim</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Modal>
  );
}
