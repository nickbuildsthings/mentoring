import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth, useMe } from '../auth/AuthProvider';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/objectives', label: 'Objectives' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/actions', label: 'Actions' },
  { to: '/progress', label: 'Progress' },
];

export function Layout({ children }: { children: ReactNode }) {
  const me = useMe();
  const { signOut } = useAuth();
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Mentoring Workspace</span>
          <nav aria-label="Main">
            <ul>
              {NAV.map((n) => (
                <li key={n.to}><NavLink to={n.to} end={n.end}>{n.label}</NavLink></li>
              ))}
            </ul>
          </nav>
          <div className="who">
            <NavLink to="/export" className="small-link">Export</NavLink>
            <span className="muted small">{me.display_name}</span>
            <button className="btn btn-ghost" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>
      </header>
      <main id="main" className="page">{children}</main>
    </>
  );
}
