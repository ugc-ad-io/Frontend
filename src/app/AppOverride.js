import { Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { APP_UI } from '../utils/appMode';
import { findAppScreen, loadAppScreen } from './registry';

const cache = new Map();
const screenFor = (name) => {
  if (!cache.has(name)) cache.set(name, lazy(() => loadAppScreen(name)));
  return cache.get(name);
};

/**
 * Wraps <Routes>. In the installed app, a URL that has a phone screen renders it (inside the
 * same ProtectedRoute rules as the website route); everything else renders the normal routes.
 */
export default function AppOverride({ children, user, ProtectedRoute }) {
  const { pathname } = useLocation();
  if (!APP_UI) return children;
  const hit = findAppScreen(pathname, user?.role);
  if (!hit) return children;
  const Screen = screenFor(hit.name);
  const el = (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  );
  return hit.roles ? <ProtectedRoute allowedRoles={hit.roles}>{el}</ProtectedRoute> : el;
}
