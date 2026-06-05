import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import Landing from './pages/Landing';
import CreatorLanding from './pages/CreatorLanding';
import Auth from './pages/Auth';
import CreatorSignup from './pages/CreatorSignup';
import CreatorProfileSetup from './pages/CreatorProfileSetup';
import BusinessProfileSetup from './pages/BusinessProfileSetup';
import CreatorDashboard from './pages/CreatorDashboard';
import BusinessDashboard from './pages/BusinessDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ProfileSettings from './pages/ProfileSettings';
import CampaignDetails from './pages/CampaignDetails';
import MessagesPage from './pages/MessagesPage';
import ChatPage from './pages/ChatPage';
import WorkSubmission from './pages/WorkSubmission';
import WorkReview from './pages/WorkReview';
import PayoutWithLayout from './pages/PayoutWithLayout';
import ShipmentTracking from './pages/ShipmentTracking';
import BrowseBriefs from './pages/BrowseBriefs';
import MyDealsPage from './pages/MyDealsPage';
import MyBidsPage from './pages/MyBidsPage';
import MyActiveWorkPage from './pages/MyActiveWorkPage';
import ReviewsPage from './pages/ReviewsPage';
import PortfolioPage from './pages/PortfolioPage';
import CreateGig from './pages/CreateGig';
import AdminGigManagement from './pages/AdminGigManagement';
import AdminProfiles from './pages/AdminProfiles';
import AdminCampaigns from './pages/AdminCampaigns';
import AdminWithdrawals from './pages/AdminWithdrawals';
import AdminAllCampaigns from './pages/AdminAllCampaigns';
import AdminUsers from './pages/AdminUsers';
import AdminAssignments from './pages/AdminAssignments';
import AdminFlaggedMessages from './pages/AdminFlaggedMessages';
import AdminAnalytics from './pages/AdminAnalytics';
import BrowseApprovedGigs from './pages/BrowseApprovedGigs';
import GigDetailsPage from './pages/GigDetailsPage';
import ApplicationsPage from './pages/ApplicationsPage';
import AdminLayout from './components/AdminLayout';
import { Toaster } from 'sonner';

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
    return <div className="loading-screen">Loading...</div>;
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
  return (
    <div className="App">
      <BrowserRouter>
        <ThemeProvider>
        <AuthProvider>
          <ScrollToTop />
          <Toaster position="top-right" richColors />
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
        </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
