import { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import './styles/admin-theme.css';
import Loader from './components/Loader';
import AdminLayout from './components/AdminLayout';
import { Toaster } from 'sonner';

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
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const CampaignDetails = lazy(() => import('./pages/CampaignDetails'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const WorkSubmission = lazy(() => import('./pages/WorkSubmission'));
const WorkReview = lazy(() => import('./pages/WorkReview'));
const PayoutWithLayout = lazy(() => import('./pages/PayoutWithLayout'));
const ShipmentTracking = lazy(() => import('./pages/ShipmentTracking'));
const BrowseBriefs = lazy(() => import('./pages/BrowseBriefs'));
const MyDealsPage = lazy(() => import('./pages/MyDealsPage'));
const MyBidsPage = lazy(() => import('./pages/MyBidsPage'));
const MyActiveWorkPage = lazy(() => import('./pages/MyActiveWorkPage'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const CreateGig = lazy(() => import('./pages/CreateGig'));
const AdminGigManagement = lazy(() => import('./pages/AdminGigManagement'));
const AdminProfiles = lazy(() => import('./pages/AdminProfiles'));
const AdminCampaigns = lazy(() => import('./pages/AdminCampaigns'));
const AdminWithdrawals = lazy(() => import('./pages/AdminWithdrawals'));
const AdminAllCampaigns = lazy(() => import('./pages/AdminAllCampaigns'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminAssignments = lazy(() => import('./pages/AdminAssignments'));
const AdminFlaggedMessages = lazy(() => import('./pages/AdminFlaggedMessages'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const BrowseApprovedGigs = lazy(() => import('./pages/BrowseApprovedGigs'));
const GigDetailsPage = lazy(() => import('./pages/GigDetailsPage'));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage'));

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
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

// Normalise FastAPI validation errors before they reach any catch block. FastAPI returns 422s as
// `detail: [{ loc, msg, type }, ...]` (an ARRAY of objects); many call sites do
// `toast.error(error.response?.data?.detail || '...')`, so without this the array/object is passed
// straight to toast/JSX and React throws:
//   "Objects are not valid as a React child (found: object with keys {loc, msg, type})".
// Collapsing detail to a STRING here fixes every such call site at once (and any future ones).
axios.interceptors.response.use(
  (response) => response,
  (error) => {
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

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API}/auth/me`)
        .then(res => {
          setUser(res.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" />;
  }

  return children;
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

  return (
    <div className="App">
      <BrowserRouter>
        <ThemeProvider>
        <AuthProvider>
          <ScrollToTop />
          <Toaster position="top-right" richColors />
          <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/creator" element={<CreatorLanding />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/creator/signup" element={<CreatorSignup />} />
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
              path="/my-deals"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <MyDealsPage />
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
              path="/create-gig"
              element={
                <ProtectedRoute allowedRoles={['creator']}>
                  <CreateGig />
                </ProtectedRoute>
              }
            />
            <Route
              path="/brand-home"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BusinessDashboard page="overview" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BusinessDashboard page="overview" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/all-campaigns"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BusinessDashboard page="all-campaigns" />
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
                  <BusinessDashboard page="browse-creator" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/browse-approved-gigs"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BrowseApprovedGigs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gig/:gigId"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <GigDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business/work-review"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BusinessDashboard page="work-review" />
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
              path="/dashboard/business/wallet"
              element={
                <ProtectedRoute allowedRoles={['business']}>
                  <BusinessDashboard page="wallet" />
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
            <Route
              path="/dashboard/admin/gig-management"
              element={
                <ProtectedRoute allowedRoles={['admin', 'campaign_manager', 'support_staff']}>
                  <AdminGigManagement />
                </ProtectedRoute>
              }
            />
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
              path="/dashboard/admin/users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminUsers />
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
          </Routes>
          </Suspense>
        </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
