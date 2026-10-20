import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { isConfigured } from './lib/supabase';
import { ActionsPage } from './pages/ActionsPage';
import { ExportPage } from './pages/ExportPage';
import { NoAccess, SignIn } from './pages/SignIn';
import { ObjectiveDetail } from './pages/ObjectiveDetail';
import { ObjectivesPage } from './pages/ObjectivesPage';
import { Overview } from './pages/Overview';
import { ProgressPage } from './pages/ProgressPage';
import { SessionDetail } from './pages/SessionDetail';
import { SessionsPage } from './pages/SessionsPage';

function Protected() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <main className="centre"><Spinner label="Checking your sign-in…" /></main>;
  if (state.status === 'signed-out') return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  if (state.status === 'unauthorised') return <NoAccess />;
  return <Layout><Outlet /></Layout>;
}

function Root() {
  if (!isConfigured) {
    return (
      <main className="centre">
        <div className="panel">
          <h1>Not configured</h1>
          <p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see <code>.env.example</code>) and rebuild.</p>
        </div>
      </main>
    );
  }
  return <AuthProvider><Outlet /></AuthProvider>;
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/signin', element: <SignIn /> },
      {
        element: <Protected />,
        children: [
          { path: '/', element: <Overview /> },
          { path: '/objectives', element: <ObjectivesPage /> },
          { path: '/objectives/:id', element: <ObjectiveDetail /> },
          { path: '/sessions', element: <SessionsPage /> },
          { path: '/sessions/:id', element: <SessionDetail /> },
          { path: '/actions', element: <ActionsPage /> },
          { path: '/progress', element: <ProgressPage /> },
          { path: '/export', element: <ExportPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
