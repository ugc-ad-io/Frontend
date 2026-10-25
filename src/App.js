import { createReadCache } from './lib/readCache';
import { useState, useEffect, createContext, useContext } from 'react';
import lazy from './lib/retryLazy';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import './styles/admin-theme.css';
import './styles/admin-mobile.css';
import Loader from './components/Loader';
import RouteLoadingBoundary from './components/RouteLoadingBoundary';
import AdminLayout from './components/AdminLayout';
import OverlayBack from './components/OverlayBack';
import AgreementGate from './components/AgreementGate';
import { Toaster } from 'sonner';
import { useLiveEffect, useLiveUpdates } from './lib/liveUpdates';
import HorizontalAccess from './components/HorizontalAccess';
import AppOverride from './app/AppOverride';
import { APP_UI } from './utils/appMode';

// ── Route-level code splitting ───────────────────────────────────────────────
// Every page is lazy-loaded so a visitor only downloads the chunk for the route
// they actually open. This keeps the giant dashboards (BusinessDashboard ~6.5k
// lines, AdminDashboard ~5.2k lines) and all other pages OUT of the initial
// homepage bundle. Three.js (the 3D logo) is already lazily loaded inside Landing.
const Landing = lazy(() => import('./pages/Landing'));
const CreatorLanding = lazy(() => import('./pages/CreatorLanding'));
const Auth = lazy(() => import('./pages/Auth'));
const CreatorSignup = lazy(() => import('./pages/CreatorSignup'));
const CreatorProfileSetup = lazy(() => import('./pages/CreatorProfileSetup'));
const BusinessProfileSetup = lazy(() => import('./pages/BusinessProfileSetup'));
const CreatorDashboard = lazy(() => import('./pages/CreatorDashboard'));
const BusinessDashboard = lazy(() => import('./pages/BusinessDashboard'));
const BrandHome = lazy(() => import('./pages/BrandHome'));
const BrandMultiBrief = lazy(() => import('./pages/BrandMultiBrief'));
const BrandPlans = lazy(() => import('./pages/BrandPlans'));
const BrandEditAddon = lazy(() => import('./pages/BrandEditAddon'));
const BrandInvoice = lazy(() => import('./pages/BrandInvoice'));
const BrandCreators = lazy(() => import('./pages/BrandCreators'));
const BrandWorkReview = lazy(() => import('./pages/BrandWorkReview'));
const BrandCampaigns = lazy(() => import('./pages/BrandCampaigns'));
const SavedCreators = lazy(() => import('./pages/SavedCreators'));
const BrandCampaignDetail = lazy(() => import('./pages/BrandCampaignDetail'));
const CreatorProfilePage = lazy(() => import('./pages/CreatorProfilePage'));
const CreatorMyProfilePage = lazy(() => import('./pages/CreatorMyProfilePage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const CampaignDetails = lazy(() => import('./pages/CampaignDetails'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const WorkSubmission = lazy(() => import('./pages/WorkSubmission'));
const WorkReview = lazy(() => import('./pages/WorkReview'));
const PayoutWithLayout = lazy(() => import('./pages/PayoutWithLayout'));
const CreatorKYC = lazy(() => import('./pages/CreatorKYC'));
const TeamAccept = lazy(() => import('./pages/TeamAccept'));
const ShipmentTracking = lazy(() => import('./pages/ShipmentTracking'));
const BrowseBriefs = lazy(() => import('./pages/BrowseBriefs'));
const SavedBriefs = lazy(() => import('./pages/SavedBriefs'));
const MyDealsPage = lazy(() => import('./pages/MyDealsPage'));
const MyDealsHubPage = lazy(() => import('./pages/MyDealsHubPage'));
const DisputeDetailPage = lazy(() => import('./pages/DisputeDetailPage'));
const MyBidsPage = lazy(() => import('./pages/MyBidsPage'));
const MyActiveWorkPage = lazy(() => import('./pages/MyActiveWorkPage'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));
const BrandReviewsPage = lazy(() => import('./pages/BrandReviewsPage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const NotFound = lazy(() => import('./pages/NotFoundPage'));
const AdminCampaigns = lazy(() => import('./pages/AdminCampaigns'));
const AdminWithdrawals = lazy(() => import('./pages/AdminWithdrawals'));
const AdminDisputes = lazy(() => import('./pages/AdminDisputes'));
const AdminAllCampaigns = lazy(() => import('./pages/AdminAllCampaigns'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminKYC = lazy(() => import('./pages/AdminKYC'));
const AdminHomeShowcase = lazy(() => import('./pages/AdminHomeShowcase'));
const AdminGST = lazy(() => import('./pages/AdminGST'));
const AdminMyCreators = lazy(() => import('./pages/AdminMyCreators'));
const AdminAssignments = lazy(() => import('./pages/AdminAssignments'));
const AdminFlaggedMessages = lazy(() => import('./pages/AdminFlaggedMessages'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const AdminDeals = lazy(() => import('./pages/AdminDeals'));
const AdminShipping = lazy(() => import('./pages/AdminShipping'));
const AdminEditing = lazy(() => import('./pages/AdminEditing'));
const AdminFinancials = lazy(() => import('./pages/AdminFinancials'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const AdminNotificationTemplates = lazy(() => import('./pages/AdminNotificationTemplates'));
const AdminRoles = lazy(() => import('./pages/AdminRoles'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminAuditLog = lazy(() => import('./pages/AdminAuditLog'));
const AdminProfiles = lazy(() => import('./pages/AdminProfiles'));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage'));

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// ── Global site theme (light default) ──────────────────────────────────────
export const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

function ThemeProvider({ children }) {
  // Default DARK during the light-theme rollout so half-converted pages don't load
  // looking broken. Flip this to 'light' once every page is fully themed.
  const [theme, setThemeState] = useState(() => localStorage.getItem('site-theme') || 'dark');

  useEffect(() => {
    localStorage.setItem('site-theme', theme);
    // Drive every page via a single attribute on <html>; pages style off
    // [data-theme="light"|"dark"] (or read useTheme()).
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (t) => setThemeState(t);
  const toggleTheme = () => setThemeState((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Instant navigation: stale-while-revalidate cache for GET /api reads ──────
// Every dashboard page mounts with loading=true and refetches from scratch, and
// several bust the browser cache with `?t=Date.now()` — so switching tabs or
// revisiting a page always waited on a fresh network round-trip, even for data
// pulled seconds ago. We keep GET responses in memory keyed by URL (the volatile
// t/_ cache-buster params stripped) and, on a repeat read within STALE_MS,
// resolve INSTANTLY from cache while revalidating in the background, so the page
// paints immediately and the cache is fresh next time. Any write clears the
// cache so data can't go stale after an action. Realtime reads are never cached.
const GET_CACHE_SKIP = /\/(auth|live|chat|messages|typing|unread-count|notifications)\b/i;
const baseAdapter = axios.getAdapter(axios.defaults.adapter);
const GET_CACHE = createReadCache(baseAdapter);
const getCacheKey = (config) =>
  `${localStorage.getItem('token') || ''}:${axios.getUri(config).replace(/([?&])(t|_)=\d+/g, '$1').replace(/[?&]+$/, '')}`;

axios.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get') { GET_CACHE.clear(); return config; } // a write invalidates cached reads
  const url = String(config.url || '');
  if (!url.includes('/api/') || GET_CACHE_SKIP.test(url) || config.responseType) return config;

  const key = getCacheKey(config);
  config.adapter = cfg => GET_CACHE.read(key, cfg);
  return config;
});

// Normalise FastAPI validation errors before they reach any catch block. FastAPI returns 422s as
// `detail: [{ loc, msg, type }, ...]` (an ARRAY of objects); many call sites do
// `toast.error(error.response?.data?.detail || '...')`, so without this the array/object is passed
// straight to toast/JSX and React throws:
//   "Objects are not valid as a React child (found: object with keys {loc, msg, type})".
// Collapsing detail to a STRING here fixes every such call site at once (and any future ones).
// Cold-start resilience: the backend (Render free tier) spins down after idle and
// takes ~30-60s to boot. During that window requests fail with a network error or a
// 502/503/504 from the edge — which made EVERY page show "failed to load". We retry
// idempotent GETs a few times with backoff so they succeed once the server wakes.
// POST/PUT/PATCH/DELETE are NEVER retried (could double-submit a bid, payment, etc.).
const COLD_START_RETRIES = 4;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config || {};
    const method = (config.method || 'get').toLowerCase();
    const status = error?.response?.status;

    // A saved login the server no longer accepts (expired / account removed): every call would keep
    // failing, so leave the dead session and return to sign-in once, remembering where the user was.
    // Only the backend's auth-dependency messages count (a wrong password at /auth/login is also a 401
    // and must stay on the form); /auth/me is handled by AuthProvider itself.
    if (status === 401 && localStorage.getItem('token') && !window.__ugcadSessionEnded
      && !String(config.url || '').includes('/auth/me')
      && /^(Token expired|Invalid token|User not found)$/.test(String(error.response.data?.detail || ''))) {
      window.__ugcadSessionEnded = true;
      localStorage.removeItem('token');
      if (!PUBLIC_PATHS.includes(window.location.pathname)) {
        window.location.replace(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      }
    }
    const isTransient = !error.response /* network error / timeout / ERR_FAILED */
      || [502, 503, 504].includes(status);

    if (method === 'get' && isTransient && !config.__noRetry) {
      config.__retryCount = (config.__retryCount || 0) + 1;
      if (config.__retryCount <= COLD_START_RETRIES) {
        await sleep(1500 * config.__retryCount); // 1.5s, 3s, 4.5s, 6s (~15s total)
        return axios(config);
      }
    }

    // Normalise FastAPI validation errors (detail can be an array/object) to a string
    // so call sites that render error.response.data.detail don't crash React.
    const data = error?.response?.data;
    if (data && data.detail != null && typeof data.detail !== 'string') {
      const d = data.detail;
      let msg;
      if (Array.isArray(d)) {
        msg = d.map((x) => (typeof x === 'string' ? x : x?.msg)).filter(Boolean).join(', ');
      } else if (typeof d === 'object') {
        msg = d.msg;
      }
      data.detail = msg || 'Something went wrong';
    }
    return Promise.reject(error);
  }
);

// Pages anyone can open without a session; they never wait on, or are replaced by, the auth check.
const PUBLIC_PATHS = ['/', '/auth', '/creator', '/creator/signup', '/team/accept', '/privacy-policy', '/terms', '/community-guidelines', '/cookie-policy', '/creator-brand-agreement'];

// Where each role lands after sign-in (mirrors routeForUser in pages/Auth.js).
export function homeForUser(user) {
  const role = user?.role;
  if (role === 'creator') return '/dashboard/creator';
  if (role === 'business') return '/dashboard/business/browse-creator';
  if (['admin', 'campaign_manager', 'support_staff'].includes(role)) return '/dashboard/admin';
  return '/';
}

// True when launched from the home screen (Android/desktop PWA or iOS "Add to Home Screen").
const isStandalone = () =>
  !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

function OfflineNotice({ onRetry, onSignOut }) {
  return (
    <main
      role="alert"
      className="app-full"
      style={{
        display: 'grid', placeItems: 'center', boxSizing: 'border-box',
        padding: '24px max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
        background: '#0A0A47', color: '#fff', textAlign: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420, minWidth: 0 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, color: '#fff' }}>Can&apos;t reach UGCad.io</h1>
        <p style={{ margin: '0 0 24px', color: 'rgba(255,255,255,0.75)', fontSize: 16, lineHeight: 1.5 }}>
          You&apos;re offline or our servers are not responding. You are still signed in. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          style={{ minHeight: 48, padding: '12px 32px', border: 0, borderRadius: 999, background: '#fff', color: '#0A0A47', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}
        >
          Try again
        </button>
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={onSignOut}
            style={{ minHeight: 44, padding: '8px 16px', border: 0, background: 'none', color: 'rgba(255,255,255,0.75)', font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Sign out instead
          </button>
        </div>
      </div>
    </main>
  );
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  useLiveUpdates(user ? localStorage.getItem('token') : null, () => GET_CACHE.clear());
  const [loading, setLoading] = useState(true);
  // True when a saved login could not be checked (offline / server down), as opposed to
  // being rejected (401). Without it an offline reload dropped a signed-in user on /auth.
  const [authError, setAuthError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useLiveEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API}/auth/me`, { timeout: 15000 })
        .then(res => {
          setUser(res.data);
          setAuthError(false);
        })
        .catch(error => {
          if (error?.response?.status === 401) { localStorage.removeItem('token'); setUser(null); setAuthError(false); }
          else setAuthError(true);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [retryTick]);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    // Login/signup/Google/Apple replies name the id `user_id`; /auth/me and every page
    // read `user.id`. Without it, straight after login every page matched nothing
    // (brand: "No campaigns yet") until a reload. Set it now, then load the full
    // profile /auth/me returns, exactly as on a fresh visit.
    setUser({ ...userData, id: userData?.id || userData?.user_id });
    axios.get(`${API}/auth/me`).then((res) => setUser(res.data)).catch(() => {});
  };

  const startBrandSession = (token, brandUser) => {
    const adminToken = localStorage.getItem('token');
    if (!localStorage.getItem('ops_admin_token')) {
      localStorage.setItem('ops_admin_token', adminToken || '');
      localStorage.setItem('ops_admin_user', JSON.stringify(user || {}));
    }
    localStorage.setItem('token', token);
    localStorage.setItem('ops_brand_name', brandUser?.profile?.business_name || brandUser?.business_name || brandUser?.email || 'Brand');
    setUser(brandUser);
    navigate('/dashboard/business', { replace: true });
  };

  const stopBrandSession = () => {
    const adminToken = localStorage.getItem('ops_admin_token');
    const adminUser = JSON.parse(localStorage.getItem('ops_admin_user') || 'null');
    if (!adminToken || !adminUser) return;
    localStorage.setItem('token', adminToken);
    localStorage.removeItem('ops_admin_token');
    localStorage.removeItem('ops_admin_user');
    localStorage.removeItem('ops_brand_name');
    setUser(adminUser);
    navigate('/dashboard/admin/deals', { replace: true });
  };

  const logout = () => {
    GET_CACHE.clear();
    localStorage.removeItem('token');
    localStorage.removeItem('ops_admin_token');
    localStorage.removeItem('ops_admin_user');
    localStorage.removeItem('ops_brand_name');
    setUser(null);
    // Land on the login screen. A full page load (not navigate) so the protected page
    // never re-renders with no user, and no cached data or timers from the session survive.
    window.location.replace('/auth');
  };

  if (loading && !PUBLIC_PATHS.includes(pathname)) {
    return <Loader />;
  }

  // Saved login, but the server could not be reached: say so and offer Retry, instead of
  // bouncing the user to the sign-in screen (their session is still valid).
  if (authError && !user && !PUBLIC_PATHS.includes(pathname) && localStorage.getItem('token')) {
    return (
      <OfflineNotice
        onRetry={() => { setLoading(true); setAuthError(false); setRetryTick((t) => t + 1); }}
        onSignOut={() => { localStorage.removeItem('token'); window.location.replace('/auth'); }}
      />
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, startBrandSession, stopBrandSession }}>
      {localStorage.getItem('ops_admin_token') && (
        <div className="ops-session-banner" role="status">
          <span>Operations mode: acting as <strong>{localStorage.getItem('ops_brand_name') || 'brand'}</strong></span>
          <button type="button" onClick={stopBrandSession}>Return to Admin</button>
        </div>
      )}
      {children}
      <HorizontalAccess />
      {/* One-time Creator & Brand Agreement gate. Only creators/brands are asked,
          only once their profile is approved and they reach the dashboard (never on
          signup or the profile form), and only until they accept the current version
          (tracked server-side, so accepting on the app clears it here too). The gate
          double-checks with the server, so it never shows for someone who already agreed. */}
      {user &&
        ['creator', 'business'].includes(user.role) &&
        user.approval_status === 'approved' &&
        pathname.startsWith('/dashboard') &&
        !window.ReactNativeWebView && // inside the mobile app, its native gate handles it
        user.agreement_accepted !== true &&
        !localStorage.getItem('ops_admin_token') && (
          <AgreementGate onAccepted={() => setUser({ ...user, agreement_accepted: true })} />
        )}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  const { pathname, search } = useLocation();

  if (!user) {
    // Remember where they were going so sign-in can return them there (deep links,
    // notification taps, installed-app shortcuts).
    const next = `${pathname}${search}`;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Wrong role for this page (e.g. a creator opening a brand URL): send them to their own home.
    return <Navigate to={homeForUser(user)} replace />;
  }

  return children;
}

// "/" is the marketing landing in a browser. Launched as the installed app it is an app
// start: signed-in users go straight to their dashboard, everyone else to sign-in. Only the
// first "/" of an app session is redirected, so the Back-to-home links still reach the landing.
function HomeRoute() {
  const { user, loading } = useAuth();
  const [launch] = useState(() => {
    try {
      if (window.ReactNativeWebView || !(isStandalone() || APP_UI) || sessionStorage.getItem('ugcad_launch_done')) return false;
      sessionStorage.setItem('ugcad_launch_done', '1');
      return true;
    } catch { return false; }
  });
  if (!launch) return <Landing />;
  if (user) return <Navigate to={homeForUser(user)} replace />;
  if (loading && localStorage.getItem('token')) return <Loader />;
  return <Navigate to="/auth" replace />;
}

// `/my-deals` serves two things: the "My Deals" hub (all deals + invites + bids)
// and, when opened with ?campaign= / ?deal=, the single-deal Deal Room. Keeping
// one path means every existing Deal Room deep link and notification keeps working.
function CreatorDealsRoute() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isDetail = searchParams.get('campaign') || searchParams.get('deal');
  if (user?.role === 'business') return <BrandNotificationDealRoute />;
  return isDetail ? <MyDealsPage /> : <MyDealsHubPage />;
}

function BrandNotificationDealRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dealId = params.get('deal');
  const campaignId = params.get('campaign');
  useEffect(() => {
    let cancelled = false;
    if (campaignId) {
      navigate(`/dashboard/business/campaign/${encodeURIComponent(campaignId)}`, { replace: true });
      return;
    }
    axios.get(`${API}/deals/business`).then(({ data }) => {
      if (cancelled) return;
      const deal = (data || []).find(item => item.deal_id === dealId);
      const target = deal?.campaign?.id;
      const creatorId = deal?.creator?.id || deal?.creator_id;
      navigate(target ? `/dashboard/business/campaign/${encodeURIComponent(target)}${creatorId ? `?creator=${encodeURIComponent(creatorId)}` : ''}` : '/dashboard/business/all-campaigns', { replace: true });
    }).catch(() => { if (!cancelled) navigate('/dashboard/business/all-campaigns', { replace: true }); });
    return () => { cancelled = true; };
  }, [dealId, campaignId, navigate]);
  return <Loader />;
}

// Resets scroll to the top on every route change so a new page never opens
// at the scroll position of the page you navigated from.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Installed app only: URLs that have a phone screen (src/app/screens) render it instead of the website page.
function AppRoutes({ children }) {
  const { user } = useAuth();
  return <AppOverride user={user} ProtectedRoute={ProtectedRoute}>{children}</AppOverride>;
}

function App() {
  // Keep the browser tab title correct. The emergent preview / live-edit tooling can inject a
  // test title onto the tab (e.g. "LIVE-EDIT-TEST-####"); re-assert ours and guard against any
  // external override so the tab always reads "UGCad.io". (No effect on the real deployed site,
  // whose <title> is already correct — this just neutralises the preview tool's injection.)
  useEffect(() => {
    const TITLE = 'UGCad.io';
    document.title = TITLE;
    const titleEl = document.querySelector('title');
    if (!titleEl) return undefined;
    const obs = new MutationObserver(() => {
      if (document.title !== TITLE) document.title = TITLE;
    });
    obs.observe(titleEl, { childList: true });
    return () => obs.disconnect();
  }, []);

  // Site-wide guard: number inputs (type=number or inputMode=numeric) accept only
  // digits (+ a decimal point) — letters/symbols are blocked at the keystroke, so
  // price / days / age / amount fields everywhere can never contain alphabets.
  useEffect(() => {
    const onKeyDown = (e) => {
      const el = e.target;
      if (!el || el.tagName !== 'INPUT') return;
      const numeric = el.type === 'number' || el.inputMode === 'numeric' || el.getAttribute('inputmode') === 'numeric';
      if (!numeric) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // e.key can be undefined during IME composition / some synthetic events.
      if (typeof e.key !== 'string') return;
      const nav = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (nav.includes(e.key)) return;
      if (e.key.length === 1 && !/[0-9.]/.test(e.key)) e.preventDefault();
    };
    // block pasting non-numeric text into number inputs too
    const onPaste = (e) => {
      const el = e.target;
      if (!el || el.tagName !== 'INPUT') return;
      const numeric = el.type === 'number' || el.inputMode === 'numeric' || el.getAttribute('inputmode') === 'numeric';
      if (!numeric) return;
      const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      if (/[^0-9.]/.test(text)) e.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('paste', onPaste, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('paste', onPaste, true);
    };
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <ThemeProvider>
        <AuthProvider>
          <ScrollToTop />
          <OverlayBack />
          <Toaster position="top-right" richColors closeButton mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 8px)", left: 16, right: 16 }} />
          <RouteLoadingBoundary>
          <AppRoutes>
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/creator" element={<CreatorLanding />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/team/accept" element={<TeamAccept />} />
            <Route path="/creator/signup" element={<CreatorSignup />} />
            {/* Public legal pages: the mobile app links to these paths. */}
            <Route path="/privacy-policy" element={<LegalPage docId="privacy" />} />
            <Route path="/terms" element={<LegalPage docId="terms" />} />
            <Route path="/community-guidelines" element={<LegalPage docId="guidelines" />} />
            <Route path="/cookie-policy" element={<LegalPage docId="cookies" />} />
            <Route path="/creator-brand-agreement" element={<LegalPage docId="agreement" />} />
            <Route
              path="/profile-setup/creator"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <CreatorProfileSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile-setup/business"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BusinessProfileSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/creator"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <CreatorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/browse-briefs"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <BrowseBriefs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/saved"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <SavedBriefs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-deals"
              element={
                <ProtectedRoute allowedRoles={['creator', 'business']}>
                  <CreatorDealsRoute />
                </ProtectedRoute>
              }
            />
            <Route
              path="/disputes/:id"
              element={
                <ProtectedRoute allowedRoles={['creator', 'business']}>
                  <DisputeDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-bids"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <MyBidsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-active-work"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <MyActiveWorkPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reviews"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <ReviewsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portfolio"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <PortfolioPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <CreatorMyProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/brand-home"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BrandHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <Navigate to="/brand-home" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/all-campaigns"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BrandCampaigns />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/saved-creators"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <SavedCreators />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/campaign/:id"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BrandCampaignDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/creator/:id"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <CreatorProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/post-brief"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BusinessDashboard page="post-brief" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/pending-bids"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BusinessDashboard page="pending-bids" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/browse-creator"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BrandCreators />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/work-review"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BrandWorkReview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/shipments"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BusinessDashboard page="shipments" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/multi-brief"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BrandMultiBrief />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/wallet"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BusinessDashboard page="wallet" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/plans"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BrandPlans />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/edit-addon"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BrandEditAddon />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/invoice/:id"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BrandInvoice />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/sent-briefs"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BusinessDashboard page="sent-briefs" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/reviews"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BrandReviewsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/:adminPage"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/applications"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminLayout isApplicationsPage={true}>
                    <ApplicationsPage />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            {/* Profile approvals — AdminProfiles renders its own AdminLayout. */}
            <Route
              path="/dashboard/admin/profiles"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminProfiles />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/campaigns"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminCampaigns />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/withdrawals"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminWithdrawals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/all-campaigns"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminAllCampaigns />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/disputes"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminDisputes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/users"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/kyc"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminKYC />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/gst"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminGST />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/home-showcase"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminHomeShowcase />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/my-creators"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminMyCreators />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/assignments"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminAssignments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/flagged"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminFlaggedMessages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/analytics"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/deals"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminDeals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/shipping"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminShipping />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/editing"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminEditing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/financials"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminFinancials />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/chat-oversight"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminFlaggedMessages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/audit-log"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminAuditLog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/notification-templates"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminNotificationTemplates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/roles"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminRoles />
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaign/:id"
              element={
                <ProtectedRoute>
                  <CampaignDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute allowedRoles={['creator', 'business']}>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute allowedRoles={['creator', 'business']}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:userId"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/work/submit"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <WorkSubmission />
                </ProtectedRoute>
              }
            />
            <Route
              path="/work-review/:id"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <WorkReview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/withdrawal"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <PayoutWithLayout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kyc"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <CreatorKYC />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipment"
              element={
                <ProtectedRoute allowedRoles={['business', 'creator', 'admin', 'campaign_manager', 'support_staff']}>
                  <ShipmentTracking />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['business', 'creator', 'admin', 'campaign_manager', 'support_staff']}>
                  <ProfileSettings />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AppRoutes>
          </RouteLoadingBoundary>
        </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
