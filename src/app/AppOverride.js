import { Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { APP_UI } from '../utils/appMode';
import { findAppScreen, loadAppScreen } from './registry';
import { useAuth } from '../App';
import CreatorPendingGate from '../components/CreatorPendingGate';
import RejectedGate from '../components/RejectedGate';
import MoreInfoGate from '../components/MoreInfoGate';

// Creators waiting for approval get the review screen on EVERY creator tab (Briefs, Orders, Inbox, ...),
// like brands do through withBrandGate. Setup and KYC stay open so they can finish them meanwhile.
const CREATOR_GATE_OPEN = new Set(['creator/Setup', 'creator/Kyc', 'creator/Signup']);
function creatorGate(user, hit, logout) {
  if (user?.role !== 'creator' || !hit.roles || !hit.roles.includes('creator') || CREATOR_GATE_OPEN.has(hit.name)) return null;
  if (user.approval_status === 'pending') return <CreatorPendingGate user={user} onLogout={logout} />;
  if (user.approval_status === 'rejected') return <RejectedGate user={user} onHome={logout} kind="creator" />;
  if (user.approval_status === 'more_info') return <MoreInfoGate kind="creator" user={user} onLogout={logout} />;
  return null;
}

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
  const { logout } = useAuth() || {};
  if (!APP_UI) return children;
  const hit = findAppScreen(pathname, user?.role);
  if (!hit) return children;
  const Screen = screenFor(hit.name);
  const el = creatorGate(user, hit, logout) || (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  );
  return hit.roles ? <ProtectedRoute allowedRoles={hit.roles}>{el}</ProtectedRoute> : el;
}
