import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth, useMe } from '../auth/AuthProvider';
import { usePartnership } from '../auth/PartnershipContext';
import { AccountModal } from './AccountModal';
import { OnboardMenteeModal } from './OnboardMenteeModal';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/objectives', label: 'Objectives' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/actions', label: 'Actions' },
  { to: '/progress', label: 'Progress' },
];

export function Layout({ children }: { children: ReactNode }) {
  const me = useMe();
  const navigate = useNavigate();
  const { signOut, passwordRecovery } = useAuth();
  const {
    partnerships,
    activePartnership,
    viewMode,
    setViewMode,
    selectPartnership,
    partnerName,
    isMentorOfAny,
  } = usePartnership();

  const [showOnboard, setShowOnboard] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const handleSwitcherChange = (val: string) => {
    if (val === '__all__') {
      setViewMode('mentor-overview');
      navigate('/');
    } else if (val === '__new__') {
      setShowOnboard(true);
    } else {
      selectPartnership(val);
    }
  };

  const switcherValue = viewMode === 'mentor-overview' ? '__all__' : (activePartnership?.id ?? '');

  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Mentoring Workspace</span>

          {(partnerships.length > 0 || isMentorOfAny) && (
            <div className="partnership-switcher">
              <label htmlFor="mentee-switcher" className="sr-only">Active mentoring workspace</label>
              <select
                id="mentee-switcher"
                aria-label="Active mentoring workspace"
                className="switcher-select"
                value={switcherValue}
                onChange={(e) => handleSwitcherChange(e.target.value)}
              >
                {isMentorOfAny && partnerships.length > 0 && (
                  <option value="__all__">All mentees ({partnerships.length})</option>
                )}
                {partnerships.length === 0 && (
                  <option value="">Mentee: {partnerName}</option>
                )}
                {partnerships.map((p) => {
                  const isMentor = p.mentor_id === me.id;
                  const label = isMentor
                    ? `Mentee: ${p.mentee_name}${p.status === 'pending' ? ' (Invite pending)' : ''}`
                    : `Partnership: ${p.title || p.mentee_name}`;
                  return (
                    <option key={p.id} value={p.id}>
                      {label}
                    </option>
                  );
                })}
                {isMentorOfAny && <option value="__new__">+ Onboard new mentee…</option>}
              </select>
            </div>
          )}

          <nav aria-label="Main">
            <ul>
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    onClick={() => {
                      if (n.to !== '/' && viewMode === 'mentor-overview') {
                        setViewMode('partnership');
                      }
                    }}
                  >
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="who">
            {isMentorOfAny && (
              <button
                type="button"
                className="btn btn-ghost small-btn"
                onClick={() => setShowOnboard(true)}
                title="Onboard a new mentee or enter an invite code"
              >
                + Mentee
              </button>
            )}
            <NavLink to="/export" className="small-link">Export</NavLink>
            <button
              type="button"
              className="btn btn-ghost small-btn"
              onClick={() => setShowAccount(true)}
            >
              {me.display_name}
            </button>
            <button className="btn btn-ghost small-btn" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>
      </header>
      <main id="main" className="page">{children}</main>

      {showOnboard && <OnboardMenteeModal onClose={() => setShowOnboard(false)} />}
      {(showAccount || passwordRecovery) && <AccountModal onClose={() => setShowAccount(false)} />}
    </>
  );
}
