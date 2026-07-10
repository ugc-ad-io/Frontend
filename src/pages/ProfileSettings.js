import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import CreatorProfileModal from '../components/CreatorProfileModal';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import {
  User,
  Lock,
  Shield,
  Camera,
  Save,
  LayoutDashboard,
  Zap,
  Bookmark,
  Star,
  Briefcase,
  FileCheck,
  MessageSquare,
  IndianRupee,
  Settings,
  Search,
  Bell,
  HelpCircle,
  Building2,
  Users,
  CreditCard,
  Wallet,
  Globe,
  CheckCircle,
  ChevronRight,
  MoreVertical,
  UserPlus,
  ClipboardList,
  Upload,
  Trash2,
  RefreshCw,
  BarChart3,
  LifeBuoy,
  Bolt,
  FileText,
  Package,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  Heart,
  ExternalLink,
  ScrollText,
  BookOpen,
  Cookie
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import './CreatorDashboard.css';
import './ProfileSettings.css';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'U').trim().charAt(0).toUpperCase();
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const getLevelInfo = (completedWorks) => {
  if (completedWorks >= 20) {
    return {
      badge: 'L2 (Pro)',
      level: 'L2 Professional',
      color: '#07074e',
      subtitle: 'Promo Eligible',
      nextLevel: null,
      currentWorks: completedWorks,
      nextWorks: null,
      benefits: '10% Higher Base Rates & Premium Support'
    };
  }
  if (completedWorks >= 10) {
    return {
      badge: 'L1 (Rising)',
      level: 'L1 Rising Star',
      color: '#27ae60',
      subtitle: 'Verified',
      nextLevel: 'L2 Professional',
      currentWorks: completedWorks,
      nextWorks: 20,
      benefits: 'Verified badge & Priority support'
    };
  }
  return {
    badge: 'New Creator',
    level: 'New Creator',
    color: '#999',
    subtitle: 'Not Verified',
    nextLevel: 'L1 Rising Star',
    currentWorks: completedWorks,
    nextWorks: 10,
    benefits: 'Complete 10 works to reach L1 Rising Star'
  };
};

const BRAND_TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'team', label: 'Team Members', icon: Users },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy & Security', icon: Shield },
  { id: 'follow', label: 'Follow Us', icon: Heart }
];

const CREATOR_TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Password', icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'language', label: 'Language', icon: Globe },
  { id: 'privacy', label: 'Privacy & Security', icon: Shield },
  { id: 'follow', label: 'Follow Us', icon: Heart }
];

// ugcad.io official social profiles (real brand logos as inline SVG).
const SOCIAL_LINKS = [
  { name: 'Instagram', handle: '@ugcad.app', icon: Instagram, url: 'https://www.instagram.com/ugcad.app?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==', color: 'linear-gradient(45deg,#f09433,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888)', path: 'M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.048 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.048-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 0 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z' },
  { name: 'Twitter / X', handle: '@ugcad_io', comingSoon: true, color: '#000000', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
  { name: 'LinkedIn', handle: 'UGCad.io', comingSoon: true, color: '#0a66c2', path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z' },
  { name: 'YouTube', handle: 'UGCad.io', comingSoon: true, color: '#ff0000', path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' }
];

const CREATOR_NOTIF_ROWS = [
  ['brief_matches', 'New brief matches', 'When a campaign matches your niche & rates', Zap],
  ['bid_updates', 'Bid updates', 'Shortlisted, accepted or rejected bids', FileCheck],
  ['messages', 'Direct messages', 'New chat messages from brands', MessageSquare],
  ['payout_alerts', 'Payout alerts', 'Escrow release and withdrawal updates', IndianRupee],
  ['weekly_digest', 'Weekly digest', 'A summary of your activity and earnings', FileText]
];

const CREATOR_PRIVACY_ROWS = [
  ['public_profile', 'Public profile', 'Let brands discover your profile in search', Search],
  ['show_earnings', 'Show earnings', 'Display total earned on your public profile', IndianRupee],
  ['allow_messages', 'Allow direct messages', 'Let brands message you without a deal', MessageSquare]
];

const APP_LANGUAGES = ['English', 'Hindi', 'Bengali', 'Marathi', 'Tamil', 'Telugu', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi'];

// Legal / policy documents - shown in-app in a modal card when opened.
const LEGAL_DOCS = [
  {
    id: 'privacy', name: 'Privacy Policy', desc: 'How we collect, use and protect your data', icon: Shield, updated: 'July 2026',
    sections: [
      { h: 'Information we collect', p: 'We collect the details you provide when you create an account and build your profile - name, contact details, payment information, portfolio content and the campaigns you take part in. We also collect basic usage data such as device, browser and pages visited.' },
      { h: 'How we use your information', p: 'Your information is used to match you with relevant brand campaigns, process payments and payouts, personalise your dashboard, keep the platform secure, and send important updates about your account and deals.' },
      { h: 'Sharing your information', p: 'We share only what is needed to complete a deal - for example, your profile and submitted content with the brand you are working with. We never sell your personal data. Trusted service providers (payments, hosting, analytics) process data on our behalf under strict agreements.' },
      { h: 'Data security', p: 'We use encryption, access controls and secure infrastructure to protect your data. Payments are handled by PCI-compliant partners and funds are held in escrow until work is approved.' },
      { h: 'Your rights', p: 'You can access, update or delete your information at any time from Settings. You may deactivate or permanently delete your account, and request a copy of your data by contacting us.' },
      { h: 'Contact', p: 'Questions about your privacy? Email us at privacy@ugcad.io.' },
    ],
  },
  {
    id: 'terms', name: 'Terms and Conditions', desc: 'The rules for using the UGCad.io platform', icon: ScrollText, updated: 'July 2026',
    sections: [
      { h: 'Acceptance of terms', p: 'By creating an account or using UGCad.io you agree to these Terms. If you do not agree, please do not use the platform.' },
      { h: 'Eligibility', p: 'You must be at least 18 years old (or the age of majority in your region) and able to enter into a binding contract to use UGCad.io.' },
      { h: 'Your account', p: 'You are responsible for the accuracy of your profile, keeping your login secure, and all activity under your account. You may not operate multiple accounts to abuse the platform.' },
      { h: 'Payments and escrow', p: 'Brand payments are held in escrow and released to creators once work is approved or auto-approved per the deal timeline. Platform commission and applicable taxes (such as TDS) are deducted as shown at checkout.' },
      { h: 'Content and licensing', p: 'You retain ownership of the content you create. By delivering approved content you grant the brand the usage rights agreed in the brief. You confirm your content is original and does not infringe third-party rights.' },
      { h: 'Prohibited conduct', p: 'No fraud, fake engagement, harassment, off-platform payment circumvention, or uploading unlawful or infringing material. Violations may lead to suspension or removal.' },
      { h: 'Termination', p: 'You may close your account anytime. We may suspend or terminate accounts that breach these Terms, with pending payouts settled per policy.' },
      { h: 'Limitation of liability', p: 'The platform is provided on an as-available basis. To the extent permitted by law, we are not liable for indirect or consequential losses arising from use of the platform.' },
    ],
  },
  {
    id: 'guidelines', name: 'Community Guidelines', desc: 'Standards for creators and brands', icon: BookOpen, updated: 'July 2026',
    sections: [
      { h: 'Be authentic', p: 'Represent yourself honestly. Use real profile details and only showcase work you actually created.' },
      { h: 'Deliver quality, on time', p: 'Follow the brief, meet deadlines, and communicate early if something changes. Great delivery builds your level and reputation.' },
      { h: 'Respect everyone', p: 'Keep messages professional. Harassment, hate speech, or discrimination of any kind is not tolerated.' },
      { h: 'No spam or fraud', p: 'No fake reviews, bots, inflated metrics, or attempts to move deals and payments off-platform.' },
      { h: 'Keep it safe and legal', p: 'Do not post content that is unlawful, infringing, sexually explicit, or harmful. Follow all applicable advertising and disclosure rules.' },
      { h: 'Reporting', p: 'See something that breaks these guidelines? Report it in-app or email trust@ugcad.io. We review every report.' },
    ],
  },
  {
    id: 'cookies', name: 'Cookie Policy', desc: 'How cookies and tracking are used', icon: Cookie, updated: 'July 2026',
    sections: [
      { h: 'What are cookies', p: 'Cookies are small text files stored on your device that help websites work and remember your preferences.' },
      { h: 'Essential cookies', p: 'Required for the platform to function - keeping you signed in, securing your session and enabling core features. These cannot be turned off.' },
      { h: 'Preference cookies', p: 'Remember choices like your language and dashboard settings to personalise your experience.' },
      { h: 'Analytics cookies', p: 'Help us understand how the platform is used so we can improve performance and features. This data is aggregated.' },
      { h: 'Managing cookies', p: 'You can control or delete cookies through your browser settings. Blocking essential cookies may affect how UGCad.io works.' },
    ],
  },
];

const readLS = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? { ...fallback, ...v } : fallback; }
  catch { return fallback; }
};

const defaultBrandProfile = {
  brand_name: '',
  contact_person: '',
  work_email: '',
  phone_number: '',
  website_url: '',
  logo_url: ''
};

const defaultCompany = {
  business_type: '',
  gst_number: '',
  business_category: '',
  country: 'India',
  billing_address: '',
  city: '',
  state: '',
  kyb_status: 'pending'
};

const defaultTeam = { members: [], seat_limit: 10, seats_used: 0 };
const defaultBilling = {
  plan_name: 'Brand Pro',
  commission_rate: 20,
  next_billing_date: '',
  monthly_budget_used: 0,
  monthly_budget_limit: 0,
  billing_history: [],
  payment_methods: []
};
const defaultNotifications = {
  new_creator_applications: true,
  deal_status_updates: true,
  payment_escrow_alerts: true,
  direct_messages: true,
  weekly_workspace_reports: false
};
const defaultSummary = { active_plan: 'Pro', wallet_balance: 0, team_count: 0 };

export default function ProfileSettings() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [brandTab, setBrandTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandProfile, setBrandProfile] = useState(defaultBrandProfile);
  const [company, setCompany] = useState(defaultCompany);
  const [team, setTeam] = useState(defaultTeam);
  const [billing, setBilling] = useState(defaultBilling);
  const [notificationPrefs, setNotificationPrefs] = useState(defaultNotifications);
  const [summary, setSummary] = useState(defaultSummary);
  const [logoUploading, setLogoUploading] = useState(false);
  
  // Profile states
  const [bio, setBio] = useState('');
  const [description, setDescription] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileBanner, setProfileBanner] = useState(user?.banner || user?.profile?.banner || '');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef(null);
  const [gender, setGender] = useState('');
  const [languages, setLanguages] = useState([]);
  const [country, setCountry] = useState('');
  const [ageRange, setAgeRange] = useState('');
  
  // Password states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 2FA states
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showQR, setShowQR] = useState(false);

  // Creator level states
  const [completedWorks, setCompletedWorks] = useState(0);

  // Creator preferences (persisted locally until a backend endpoint exists)
  const [creatorNotif, setCreatorNotif] = useState(() => readLS('ugc_creator_notif', {
    brief_matches: true, bid_updates: true, messages: true, payout_alerts: true, weekly_digest: false,
  }));
  const [appLang, setAppLang] = useState(() => localStorage.getItem('ugc_app_lang') || 'English');
  const [privacy, setPrivacy] = useState(() => readLS('ugc_creator_privacy', {
    public_profile: true, show_earnings: false, allow_messages: true,
  }));

  const [legalDoc, setLegalDoc] = useState(null);
  const saveCreatorNotif = () => { localStorage.setItem('ugc_creator_notif', JSON.stringify(creatorNotif)); toast.success('Notification preferences saved'); };
  const saveAppLang = () => { localStorage.setItem('ugc_app_lang', appLang); toast.success('Language preference saved'); };
  const savePrivacy = () => { localStorage.setItem('ugc_creator_privacy', JSON.stringify(privacy)); toast.success('Privacy settings saved'); };

  const handleDeactivate = async () => {
    if (!window.confirm('Deactivate your account? Your profile will be hidden until you log back in.')) return;
    try {
      await axios.post(`${API}/profile/deactivate`);
      toast.success('Account deactivated');
      logout();
      navigate('/');
    } catch {
      toast.error('Could not deactivate right now — please email support@ugcad.io');
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Permanently delete your account? This cannot be undone.')) return;
    if (!window.confirm('Are you absolutely sure? All your data will be removed forever.')) return;
    try {
      await axios.delete(`${API}/profile`);
      toast.success('Account deleted');
      logout();
      navigate('/');
    } catch {
      toast.error('Could not delete right now — please email support@ugcad.io');
    }
  };

  useEffect(() => {
    fetchUserData();
    check2FAStatus();
    if (user?.role === 'creator') {
      fetchCreatorStats();
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'business') {
      fetchBrandSettings();
    }
  }, [user?.role]);

  const fetchCreatorStats = async () => {
    try {
      const res = await axios.get(`${API}/campaigns?status=completed&creator_id=${user.id}`);
      const completedCampaigns = res.data || [];
      setCompletedWorks(completedCampaigns.length);
    } catch (error) {
      console.error('Failed to fetch creator stats:', error);
    }
  };

  const fetchBrandSettings = async () => {
    setBrandLoading(true);
    try {
      const [profileRes, companyRes, teamRes, billingRes, notificationsRes, summaryRes] = await Promise.all([
        axios.get(`${API}/business/settings/profile`),
        axios.get(`${API}/business/settings/company`),
        axios.get(`${API}/business/settings/team`),
        axios.get(`${API}/business/settings/billing`),
        axios.get(`${API}/business/settings/notifications`),
        axios.get(`${API}/business/settings/summary`)
      ]);
      setBrandProfile({ ...defaultBrandProfile, ...(profileRes.data || {}) });
      setCompany({ ...defaultCompany, ...(companyRes.data || {}) });
      setTeam({ ...defaultTeam, ...(teamRes.data || {}) });
      setBilling({ ...defaultBilling, ...(billingRes.data || {}) });
      setNotificationPrefs({ ...defaultNotifications, ...(notificationsRes.data || {}) });
      setSummary({ ...defaultSummary, ...(summaryRes.data || {}) });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to load brand settings'));
    } finally {
      setBrandLoading(false);
    }
  };

  const saveBrandProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.put(`${API}/business/settings/profile`, brandProfile);
      setBrandProfile({ ...brandProfile, ...(res.data || {}) });
      toast.success('Profile settings saved');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to save profile settings'));
    } finally {
      setLoading(false);
    }
  };

  const saveCompany = async () => {
    setLoading(true);
    try {
      const res = await axios.put(`${API}/business/settings/company`, company);
      setCompany({ ...company, ...(res.data || {}) });
      toast.success('Company details saved');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to save company details'));
    } finally {
      setLoading(false);
    }
  };

  const saveNotifications = async () => {
    setLoading(true);
    try {
      const res = await axios.put(`${API}/business/settings/notifications`, notificationPrefs);
      setNotificationPrefs({ ...notificationPrefs, ...(res.data || {}) });
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to save notifications'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/business/settings/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setBrandProfile(current => ({ ...current, logo_url: res.data.logo_url || res.data.photo_url || res.data.url || current.logo_url }));
      toast.success('Logo updated');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to upload logo'));
    } finally {
      setLogoUploading(false);
      event.target.value = '';
    }
  };

  const removeLogo = async () => {
    try {
      await axios.delete(`${API}/business/settings/logo`);
      setBrandProfile(current => ({ ...current, logo_url: '' }));
      toast.success('Logo removed');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to remove logo'));
    }
  };

  const inviteMember = async () => {
    const email = window.prompt('Enter team member email');
    if (!email) return;
    try {
      await axios.post(`${API}/business/settings/team/invite`, { email, role: 'viewer' });
      toast.success('Invitation sent');
      const res = await axios.get(`${API}/business/settings/team`);
      setTeam({ ...defaultTeam, ...(res.data || {}) });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to invite member'));
    }
  };

  const removeMember = async (member) => {
    if (!member.id) { toast.error('Cannot remove this member'); return; }
    if (!window.confirm(`Remove ${member.name || member.email} from your team?`)) return;
    try {
      await axios.delete(`${API}/business/settings/team/${member.id}`);
      toast.success('Team member removed');
      const res = await axios.get(`${API}/business/settings/team`);
      setTeam({ ...defaultTeam, ...(res.data || {}) });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to remove member'));
    }
  };

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setBio(response.data.bio || '');
      setDescription(response.data.description || '');
      setProfilePhoto(response.data.profile_photo || null);
      setGender(response.data.gender || '');
      // language can be stored as legacy string or new array — normalize to array
      const lang = response.data.language;
      if (Array.isArray(lang)) {
        setLanguages(lang.filter(Boolean));
      } else if (typeof lang === 'string' && lang.trim()) {
        setLanguages([lang]);
      } else {
        setLanguages([]);
      }
      setCountry(response.data.country || '');
      setAgeRange(response.data.age_range || '');
    } catch (error) {
      toast.error('Failed to load profile data');
    }
  };

  // Read the real 2FA state from the backend (Python is the source of truth).
  const check2FAStatus = async () => {
    try {
      const { data } = await axios.get(`${API}/profile/2fa/status`);
      setTwoFAEnabled(!!data.enabled);
    } catch { /* leave default */ }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image too large. Maximum 2MB allowed.');
      return;
    }

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/profile/upload-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setProfilePhoto(response.data.photo_url);
      setUser({ ...user, profile_photo: response.data.photo_url });
      toast.success('Profile photo updated!');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to upload photo'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large. Maximum 5MB allowed.');
      return;
    }
    setUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/upload/file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      let url = res.data?.file_url || res.data?.url;
      if (!url) { toast.error('Banner upload failed.'); return; }
      const fullUrl = url.startsWith('http') ? url : `${BACKEND_URL}${url}`;
      // Persist via the dedicated banner endpoint (stores under the user's `banner` field).
      await axios.patch(`${API}/profile/banner`, { banner: fullUrl });
      setProfileBanner(fullUrl);
      setUser({ ...user, banner: fullUrl });
      toast.success('Banner image updated!');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to upload banner'));
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('bio', bio || '');
      params.set('description', description || '');
      params.set('gender', gender || '');
      params.set('country', country || '');
      params.set('age_range', ageRange || '');
      // Send each language as a separate `language` query param so backend can collect as List[str]
      (languages || []).forEach((l) => params.append('language', l));
      console.log('[ProfileSave] Sending to', `${API}/profile/update-info?${params.toString()}`);
      console.log('[ProfileSave] Payload:', { bio, description, gender, languages, country, age_range: ageRange });
      const res = await axios.put(`${API}/profile/update-info?${params.toString()}`);
      console.log('[ProfileSave] Response:', res.status, res.data);
      // Verify by fetching /auth/me after save
      const verify = await axios.get(`${API}/auth/me`);
      console.log('[ProfileSave] After-save /auth/me:', {
        gender: verify.data?.gender,
        language: verify.data?.language,
        country: verify.data?.country,
        age_range: verify.data?.age_range
      });
      setUser({ ...user, bio, description, gender, language: languages, country, age_range: ageRange });
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('[ProfileSave] FAILED:', error?.response?.status, error?.response?.data, error);
      toast.error(apiErrorMessage(error, 'Failed to update profile'));
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = (lang) => {
    setLanguages((prev) => prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/profile/change-password?old_password=${encodeURIComponent(oldPassword)}&new_password=${encodeURIComponent(newPassword)}`);
      toast.success('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to change password'));
    } finally {
      setLoading(false);
    }
  };

  // Ask the backend to generate a secret + QR (stored server-side, not yet enabled).
  const handleSetup2FA = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/profile/2fa/setup`);
      setSecret(data.secret || '');
      setQrCode(data.qr_code || '');   // already a data: URI from the backend
      setShowQR(true);
      toast.success('Scan the QR code with your authenticator app');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to setup 2FA'));
    } finally {
      setLoading(false);
    }
  };

  // Verify the 6-digit code with the backend, which enables 2FA on success.
  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/profile/2fa/verify?token=${encodeURIComponent(verificationCode)}`);
      toast.success('2FA enabled successfully!');
      setTwoFAEnabled(true);
      setShowQR(false);
      setVerificationCode('');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Invalid verification code'));
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      toast.error('Please enter your password');
      return;
    }
    setLoading(true);
    try {
      // Backend re-checks the account password before disabling.
      await axios.post(`${API}/profile/2fa/disable?password=${encodeURIComponent(disablePassword)}`);
      toast.success('2FA disabled successfully');
      setTwoFAEnabled(false);
      setDisablePassword('');
      setShowQR(false);
      setSecret('');
      setQrCode('');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to disable 2FA'));
    } finally {
      setLoading(false);
    }
  };

  const displayName = user?.nickname || user?.full_name || user?.email || 'Settings';

  const navItems = user?.role === 'business'
    ? [
      { name: 'Brand Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/business') },
      { name: 'Post a Campaign', icon: FileCheck, action: () => navigate('/dashboard/business/post-brief') },
      { name: 'All Campaigns', icon: Briefcase, action: () => navigate('/dashboard/business/all-campaigns') },
      { name: 'Creator Bids', icon: User, action: () => navigate('/dashboard/business/pending-bids') },
      { name: 'Browse Creator', icon: Search, action: () => navigate('/dashboard/business/browse-creator') },
      { name: 'Work Review', icon: FileCheck, action: () => navigate('/dashboard/business/work-review') },
      { name: 'Messages', icon: MessageSquare, action: () => navigate('/messages') },
      { name: 'Manage Shipment', icon: Package, action: () => navigate('/dashboard/business/shipments') },
      { name: 'Wallet', icon: Wallet, action: () => navigate('/dashboard/business/wallet') },
      { name: 'Settings', icon: Settings, action: () => navigate('/settings'), active: true }
    ]
    : [
      { name: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/creator') },
      { name: 'My Active Work', icon: Zap, action: () => navigate('/my-active-work') },
      { name: 'My Bids', icon: Bookmark, action: () => navigate('/my-bids') },
      { name: 'Reviews', icon: Star, action: () => navigate('/reviews') },
      { name: 'Portfolio', icon: User, action: () => navigate('/portfolio') },
      { name: 'Browse Campaigns', icon: Briefcase, action: () => navigate('/browse-briefs') },
      { name: 'My Deals', icon: FileCheck, action: () => navigate('/my-deals') },
      { name: 'Messages', icon: MessageSquare, action: () => navigate('/messages') },
      { name: 'Payout', icon: IndianRupee, action: () => navigate('/withdrawal') },
      { name: 'Settings', icon: Settings, action: () => navigate('/settings'), active: true }
    ];

  const logoSrc = brandProfile.logo_url?.startsWith('http')
    ? brandProfile.logo_url
    : brandProfile.logo_url
      ? `${BACKEND_URL}${brandProfile.logo_url}`
      : '';

  const renderBrandField = (label, value, onChange, props = {}) => (
    <label className={props.full ? 'bs-field bs-full' : 'bs-field'}>
      <span>{label}</span>
      {props.textarea ? (
        <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} rows={props.rows || 3} />
      ) : (
        <input
          type={props.type || 'text'}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          disabled={props.disabled}
          placeholder={props.placeholder}
        />
      )}
    </label>
  );

  const renderBrandPanel = () => {
    if (brandLoading) {
      return <div className="bs-card bs-loading"><RefreshCw size={20} /> Loading settings...</div>;
    }

    if (brandTab === 'profile') {
      return (
        <section className="bs-card">
          <div className="bs-card-head">
            <span><User size={20} /></span>
            <div>
              <h2>Profile Settings</h2>
              <p>Update your basic brand information and workspace presence</p>
            </div>
          </div>
          <div className="bs-card-body bs-profile-grid">
            <div className="bs-logo-block">
              <label className="bs-logo-box">
                {logoSrc ? <img src={logoSrc} alt="Brand logo" /> : <strong>{getInitial(brandProfile.brand_name || displayName)}</strong>}
                <input type="file" accept="image/*" onChange={handleLogoUpload} />
              </label>
              <button type="button" onClick={removeLogo} disabled={!brandProfile.logo_url || logoUploading}>
                {logoUploading ? 'Uploading...' : 'Remove Logo'}
              </button>
            </div>
            <div className="bs-form-grid">
              {renderBrandField('Brand Name', brandProfile.brand_name, value => setBrandProfile(current => ({ ...current, brand_name: value })))}
              {renderBrandField('Contact Person', brandProfile.contact_person, value => setBrandProfile(current => ({ ...current, contact_person: value })))}
              {renderBrandField('Work Email', brandProfile.work_email, value => setBrandProfile(current => ({ ...current, work_email: value })), { type: 'email' })}
              {renderBrandField('Phone Number', brandProfile.phone_number, value => setBrandProfile(current => ({ ...current, phone_number: value })))}
              {renderBrandField('Website URL', brandProfile.website_url, value => setBrandProfile(current => ({ ...current, website_url: value })), { full: true, placeholder: 'https://yourbrand.com' })}
            </div>
          </div>
          <div className="bs-card-actions">
            <button type="button" className="bs-ghost">Cancel</button>
            <button type="button" className="bs-primary" onClick={saveBrandProfile} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </section>
      );
    }

    if (brandTab === 'company') {
      return (
        <section className="bs-card">
          <div className="bs-card-head">
            <span><Building2 size={20} /></span>
            <div>
              <h2>Company Details</h2>
              <p>Official information for billing, verification, and legal compliance</p>
            </div>
            <em className={`bs-kyb ${company.kyb_status}`}>KYB {company.kyb_status || 'pending'}</em>
          </div>
          <div className="bs-card-body bs-form-grid">
            {renderBrandField('Business Type', company.business_type, value => setCompany(current => ({ ...current, business_type: value })))}
            {renderBrandField('GST Number', company.gst_number, value => setCompany(current => ({ ...current, gst_number: value })))}
            {renderBrandField('Business Category', company.business_category, value => setCompany(current => ({ ...current, business_category: value })))}
            {renderBrandField('Country', company.country, value => setCompany(current => ({ ...current, country: value })))}
            {renderBrandField('Billing Address', company.billing_address, value => setCompany(current => ({ ...current, billing_address: value })), { full: true, textarea: true })}
            {renderBrandField('City', company.city, value => setCompany(current => ({ ...current, city: value })))}
            {renderBrandField('State', company.state, value => setCompany(current => ({ ...current, state: value })))}
          </div>
          <div className="bs-card-actions">
            <button type="button" className="bs-primary dark" onClick={saveCompany} disabled={loading}>{loading ? 'Saving...' : 'Save Company Details'}</button>
          </div>
        </section>
      );
    }

    if (brandTab === 'team') {
      return (
        <section className="bs-card">
          <div className="bs-card-head">
            <span><Users size={20} /></span>
            <div>
              <h2>Team Members</h2>
              <p>Invite and manage workspace collaborators and their permissions</p>
            </div>
            <button type="button" className="bs-primary small" onClick={inviteMember}><UserPlus size={16} /> Invite Member</button>
          </div>
          <div className="bs-team-table">
            <div className="bs-team-row bs-team-head"><span>Member</span><span>Role</span><span>Status</span><span>Actions</span></div>
            {(team.members || []).map(member => (
              <div className="bs-team-row" key={member.id || member.email}>
                <div className="bs-member">
                  {member.avatar_url ? <img src={member.avatar_url.startsWith('http') ? member.avatar_url : `${BACKEND_URL}${member.avatar_url}`} alt={member.name} /> : <i>{getInitial(member.name || member.email)}</i>}
                  <div><strong>{member.name || member.email}</strong><small>{member.email}</small></div>
                </div>
                <span className="bs-role">{member.role}</span>
                <span className={`bs-status ${member.status}`}><b /> {member.status}</span>
                <button type="button" className="bs-icon-only" title="Remove member" onClick={() => removeMember(member)}><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
          <p className="bs-seat-note">Workspace limit: <strong>{team.seats_used || team.members?.length || 0} / {team.seat_limit || 10} seats used.</strong> Pro plan allows up to {team.seat_limit || 10} members.</p>
        </section>
      );
    }

    if (brandTab === 'billing') {
      const used = Number(billing.monthly_budget_used || 0);
      const limit = Number(billing.monthly_budget_limit || 0);
      const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
      return (
        <section className="bs-card">
          <div className="bs-card-head">
            <span><CreditCard size={20} /></span>
            <div>
              <h2>Billing & Subscription</h2>
              <p>Manage your current plan, payment methods, and view billing history</p>
            </div>
          </div>
          <div className="bs-card-body">
            <div className="bs-ws-row">
              <div className="bs-ws-item"><small>Active Plan</small><strong>{summary.active_plan || billing.plan_name || 'Pro'}</strong></div>
              <div className="bs-ws-item"><small>Wallet</small><strong>{money(summary.wallet_balance)}</strong></div>
              <div className="bs-ws-item"><small>Team Count</small><strong>{summary.team_count || team.members?.length || 0} Members</strong></div>
            </div>
            <div className="bs-billing-grid">
              <div className="bs-plan-card">
                <div><small>Current Plan</small><h3>{billing.plan_name || 'Brand Pro'}</h3><p>Next billing: <strong>{billing.next_billing_date ? new Date(billing.next_billing_date).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not scheduled'}</strong></p></div>
                <div><small>Commission Rate</small><h4>{billing.commission_rate || 0}%</h4><button type="button">Upgrade to Enterprise</button></div>
              </div>
              <div className="bs-budget-card">
                <div><strong>Monthly Campaign Budget Progress</strong><b>{money(used)} / {money(limit)}</b></div>
                <span><i style={{ width: `${percent}%` }} /></span>
                <p>{percent}% of budget used this month <em><CheckCircle size={14} /> Normal usage</em></p>
              </div>
            </div>
            <div className="bs-billing-tabs">
              <button type="button"><RefreshCw size={16} /> Billing History</button>
              <button type="button"><CreditCard size={16} /> Payment Methods</button>
            </div>
          </div>
        </section>
      );
    }

    if (brandTab === 'notifications') {
      const rows = [
        ['new_creator_applications', 'New Creator Applications', 'Alert when a creator applies to your brief', Users],
        ['deal_status_updates', 'Deal Status Updates', 'Milestone changes and content delivery alerts', RefreshCw],
        ['payment_escrow_alerts', 'Payment & Escrow Alerts', 'Wallet recharges and escrow lock notifications', IndianRupee],
        ['direct_messages', 'Direct Messages', 'Instant alerts for new chat messages from creators', MessageSquare],
        ['weekly_workspace_reports', 'Weekly Workspace Reports', 'Summarized digest of your campaign performance', FileText]
      ];
      return (
        <section className="bs-card">
          <div className="bs-card-head">
            <span><Bell size={20} /></span>
            <div>
              <h2>Notification Settings</h2>
              <p>Configure how and when you want to be notified about workspace activities</p>
            </div>
          </div>
          <div className="bs-toggle-list">
            {rows.map(([key, title, desc, Icon]) => (
              <div className="bs-toggle-row" key={key}>
                <span><Icon size={20} /></span>
                <div><strong>{title}</strong><p>{desc}</p></div>
                <button
                  type="button"
                  className={notificationPrefs[key] ? 'is-on' : ''}
                  onClick={() => setNotificationPrefs(current => ({ ...current, [key]: !current[key] }))}
                  aria-label={`Toggle ${title}`}
                />
              </div>
            ))}
          </div>
          <div className="bs-card-actions">
            <button type="button" className="bs-primary" onClick={saveNotifications} disabled={loading}>{loading ? 'Saving...' : 'Save Preferences'}</button>
          </div>
        </section>
      );
    }

    if (brandTab === 'privacy') {
      return (
        <section className="bs-card">
          <div className="bs-card-head">
            <span><Shield size={20} /></span>
            <div>
              <h2>Privacy &amp; Security</h2>
              <p>Control who can see and reach your workspace</p>
            </div>
          </div>
          <div className="bs-toggle-list">
            {CREATOR_PRIVACY_ROWS.map(([key, title, desc, Icon]) => (
              <div className="bs-toggle-row" key={key}>
                <span><Icon size={20} /></span>
                <div><strong>{title}</strong><p>{desc}</p></div>
                <button
                  type="button"
                  className={privacy[key] ? 'is-on' : ''}
                  onClick={() => setPrivacy((c) => ({ ...c, [key]: !c[key] }))}
                  aria-label={`Toggle ${title}`}
                />
              </div>
            ))}
          </div>
          <div className="bs-card-actions">
            <button type="button" className="bs-primary" onClick={savePrivacy}>Save Privacy Settings</button>
          </div>
          <div className="bs-legal">
            <h3>Legal &amp; Policies</h3>
            {LEGAL_DOCS.map((d) => (
              <button type="button" key={d.name} className="bs-legal-row" onClick={() => setLegalDoc(d)}>
                <span className="bs-legal-ic"><d.icon size={18} /></span>
                <div><strong>{d.name}</strong><p>{d.desc}</p></div>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (brandTab === 'follow') {
      return (
        <section className="bs-card">
          <div className="bs-card-head">
            <span><Heart size={20} /></span>
            <div>
              <h2>Follow us</h2>
              <p>Stay updated with UGCad.io on social media</p>
            </div>
          </div>
          <div className="bs-social-grid">
            {SOCIAL_LINKS.map((s) => {
              const inner = (
                <>
                  <span className="bs-social-ic" style={{ background: s.color }}>
                    {s.icon
                      ? <s.icon size={22} />
                      : <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d={s.path} /></svg>}
                  </span>
                  <div><strong>{s.name}{s.comingSoon ? ' (Coming soon)' : ''}</strong><small>{s.handle}</small></div>
                </>
              );
              return s.comingSoon
                ? <div key={s.name} className="bs-social-card is-soon">{inner}</div>
                : <a key={s.name} className="bs-social-card" href={s.url} target="_blank" rel="noreferrer">{inner}</a>;
            })}
          </div>
        </section>
      );
    }

    return (
      <section className="bs-card">
        <div className="bs-card-head">
          <span><Lock size={20} /></span>
          <div>
            <h2>Security Settings</h2>
            <p>Manage password and two-factor authentication for your workspace</p>
          </div>
        </div>
        <div className="bs-security-grid">
          <form onSubmit={handleChangePassword} className="bs-security-box">
            <h3>Change Password</h3>
            <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Current password" required />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" required />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" required />
            <button type="submit" className="bs-primary" disabled={loading}>{loading ? 'Saving...' : 'Update Password'}</button>
          </form>
          <div className="bs-security-box">
            <h3>Two-Factor Authentication</h3>
            <p>{twoFAEnabled ? '2FA is enabled for this account.' : 'Add an extra layer of security with an authenticator app.'}</p>
            {!twoFAEnabled ? (
              <button type="button" className="bs-primary" onClick={handleSetup2FA} disabled={loading}>Setup 2FA</button>
            ) : (
              <>
                <input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} placeholder="Password to disable" />
                <button type="button" className="bs-ghost danger" onClick={handleDisable2FA} disabled={loading}>Disable 2FA</button>
              </>
            )}
            {showQR && <div className="bs-qr"><img src={qrCode} alt="2FA QR code" /><input value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /><button type="button" className="bs-primary" onClick={handleVerify2FA}>Verify</button></div>}
          </div>
        </div>
      </section>
    );
  };

  if (user?.role === 'business') {
    return (
      <BrandTopNavLayout>
        <div className="cmk-page-head cmk-rise" style={{ marginBottom: 18 }}>
          <h1>Settings</h1>
          <p>Manage preferences, profile, billing, and notifications</p>
        </div>
        <div className="bs-page bs-dashboard-page">
          <section className="bs-left">
            <div className="bs-tabs">
              {BRAND_TABS.map(tab => (
                <button key={tab.id} type="button" className={brandTab === tab.id ? 'active' : ''} onClick={() => setBrandTab(tab.id)}>
                  <tab.icon size={18} /> {tab.label}
                </button>
              ))}
            </div>
            {renderBrandPanel()}
          </section>
        </div>
        {legalDoc && (
          <div className="ps-legal-overlay" onClick={() => setLegalDoc(null)}>
            <div className="ps-legal-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ps-legal-modal-head">
                <span className="ps-legal-modal-ic"><legalDoc.icon size={20} /></span>
                <div className="ps-legal-modal-title"><h3>{legalDoc.name}</h3><small>Last updated: {legalDoc.updated}</small></div>
                <button type="button" className="ps-legal-modal-x" onClick={() => setLegalDoc(null)} aria-label="Close">✕</button>
              </div>
              <div className="ps-legal-modal-body">
                {legalDoc.sections.map((sec, i) => (
                  <div className="ps-legal-modal-sec" key={i}>
                    <h4>{sec.h}</h4>
                    <p>{sec.p}</p>
                  </div>
                ))}
                <p className="ps-legal-modal-foot">This summary is provided for your convenience and may be updated from time to time.</p>
              </div>
            </div>
            <style>{`
              .ps-legal-overlay{position:fixed;inset:0;z-index:1400;background:rgba(15,22,58,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px}
              .ps-legal-modal{width:min(560px,100%);max-height:86vh;display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 30px 70px -20px rgba(15,22,58,.5);animation:psLegalIn .2s ease}
              .ps-legal-modal-head{display:flex;align-items:center;gap:13px;padding:18px 20px;border-bottom:1px solid #eef0f6}
              .ps-legal-modal-ic{width:44px;height:44px;flex:none;border-radius:13px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#5b6bff,#6d7bff)}
              .ps-legal-modal-title{flex:1;min-width:0}
              .ps-legal-modal-title h3{margin:0;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:18px;color:#15163a}
              .ps-legal-modal-title small{color:#9296ba;font-size:12.5px}
              .ps-legal-modal-x{flex:none;width:34px;height:34px;border:none;background:#f1f3fa;color:#15163a;border-radius:10px;cursor:pointer;font-size:15px}
              .ps-legal-modal-x:hover{background:#e7eaf5}
              .ps-legal-modal-body{padding:20px;overflow-y:auto}
              .ps-legal-modal-sec{margin-bottom:16px}
              .ps-legal-modal-sec h4{margin:0 0 5px;font-size:14.5px;font-weight:800;color:#15163a}
              .ps-legal-modal-sec p{margin:0;color:#585c7e;font-size:14px;line-height:1.65}
              .ps-legal-modal-foot{margin:8px 0 0;color:#9296ba;font-size:12.5px;font-style:italic}
            `}</style>
          </div>
        )}
      </BrandTopNavLayout>
    );
  }

  return (
    <CreatorTopNavLayout>
      <div className="cmk-page-head cmk-rise" style={{ marginBottom: 18 }}>
        <h1>Settings</h1>
        <p>Manage your account information and security.</p>
      </div>
      <div className="ps-content">
          <div className="ps-container">
            <div className="ps-tab-sidebar">
              {CREATOR_TABS.map((t) => (
                <button
                  key={t.id}
                  className={`ps-tab-btn ${activeTab === t.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  <t.icon size={20} /> {t.label}
                </button>
              ))}
            </div>

            <div className="ps-panel">
              {activeTab === 'profile' && user?.id && (
                <CreatorProfileModal
                  id={user.id}
                  asPage
                  editable
                  photo={user?.profile_photo || user?.profile_picture}
                  onClose={() => navigate('/dashboard/creator')}
                />
              )}
              {false && (
                <>
                  {user?.role === 'creator' && (
                    <div style={{
                      background: '#f9f9f9',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      padding: '20px',
                      marginBottom: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Creator Level</p>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#07074e' }}>
                          {getLevelInfo(completedWorks).level}
                        </h3>
                        <p style={{ margin: '0', fontSize: '13px', color: '#999' }}>
                          {completedWorks} completed {completedWorks === 1 ? 'work' : 'works'}
                        </p>
                      </div>
                      <span style={{
                        background: getLevelInfo(completedWorks).color,
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '24px',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}>
                        {getLevelInfo(completedWorks).badge}
                      </span>
                    </div>
                  )}
                  <h2>Profile Information</h2>

                  <div className="ps-form-group">
                    <label>Profile Photo</label>
                    <div className="ps-photo-upload">
                      <div className="ps-photo-preview">
                        {profilePhoto ? (
                          <img src={`${BACKEND_URL}${profilePhoto}`} alt="Profile" />
                        ) : (
                          <div className="ps-photo-placeholder">
                            <Camera size={48} />
                          </div>
                        )}
                      </div>
                      <div className="ps-photo-actions">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          id="photo-upload"
                        />
                        <label htmlFor="photo-upload">
                          {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
                        </label>
                        <p className="ps-hint">JPG, PNG or WebP. Max 2MB.</p>
                      </div>
                    </div>
                  </div>

                  <div className="ps-form-group">
                    <label>Banner Image</label>
                    <div className="ps-banner-upload">
                      <div
                        className="ps-banner-preview"
                        style={{ cursor: 'pointer' }}
                        onClick={() => bannerInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') bannerInputRef.current?.click(); }}
                      >
                        {profileBanner ? (
                          <img src={profileBanner.startsWith('http') ? profileBanner : `${BACKEND_URL}${profileBanner}`} alt="Banner" />
                        ) : (
                          <div className="ps-banner-placeholder"><Camera size={28} /> Add a banner</div>
                        )}
                      </div>
                      <div className="ps-photo-actions">
                        <input
                          ref={bannerInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleBannerUpload}
                          id="banner-upload"
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          className="ps-upload-btn"
                          onClick={() => bannerInputRef.current?.click()}
                          disabled={uploadingBanner}
                        >
                          {uploadingBanner ? 'Uploading...' : (profileBanner ? 'Change Banner' : 'Upload Banner')}
                        </button>
                        <p className="ps-hint">Wide cover image. JPG, PNG or WebP. Max 5MB.</p>
                      </div>
                    </div>
                  </div>

                  <div className="ps-form-group">
                    <label>Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={4}
                      maxLength={500}
                    />
                    <span className="ps-char-count">{bio.length}/500</span>
                  </div>

                  <div className="ps-form-group">
                    <label>Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add a detailed description..."
                      rows={6}
                      maxLength={1000}
                    />
                    <span className="ps-char-count">{description.length}/1000</span>
                  </div>

                  <h3 className="ps-subsection-title">Creator Details</h3>

                  <div className="ps-form-group">
                    <label>Gender</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value)}>
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                    <span className="ps-hint">Optional - Creator's gender</span>
                  </div>

                  <div className="ps-form-group">
                    <label>Languages</label>
                    <div className="ps-multi-select">
                      {['English', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Arabic', 'Mandarin', 'Japanese', 'Korean', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Punjabi', 'Other'].map((lang) => (
                        <label key={lang} className={`ps-chip ${languages.includes(lang) ? 'is-selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={languages.includes(lang)}
                            onChange={() => toggleLanguage(lang)}
                          />
                          <span>{lang}</span>
                        </label>
                      ))}
                    </div>
                    <span className="ps-hint">Optional - Select all languages you speak ({languages.length} selected)</span>
                  </div>

                  <div className="ps-form-group">
                    <label>Country</label>
                    <select value={country} onChange={(e) => setCountry(e.target.value)}>
                      <option value="">Select country</option>
                      <option value="India">India</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="Germany">Germany</option>
                      <option value="France">France</option>
                      <option value="Spain">Spain</option>
                      <option value="Italy">Italy</option>
                      <option value="Brazil">Brazil</option>
                      <option value="Mexico">Mexico</option>
                      <option value="Japan">Japan</option>
                      <option value="South Korea">South Korea</option>
                      <option value="China">China</option>
                      <option value="UAE">UAE</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Other">Other</option>
                    </select>
                    <span className="ps-hint">Optional - Country of residence</span>
                  </div>

                  <div className="ps-form-group">
                    <label>Age Range</label>
                    <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)}>
                      <option value="">Select age range</option>
                      <option value="13-17">13-17 years old</option>
                      <option value="18-24">18-24 years old</option>
                      <option value="25-34">25-34 years old</option>
                      <option value="35-44">35-44 years old</option>
                      <option value="45-54">45-54 years old</option>
                      <option value="55+">55+ years old</option>
                    </select>
                    <span className="ps-hint">Optional - Creator's age range</span>
                  </div>

                  <button
                    className="ps-btn-primary"
                    onClick={handleUpdateProfile}
                    disabled={loading}
                  >
                    <Save size={20} /> {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}

              {activeTab === 'security' && (
                <>
                  <h2>Change Password</h2>
                  <form onSubmit={handleChangePassword}>
                    <div className="ps-form-group">
                      <label>Current Password</label>
                      <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                      />
                    </div>

                    <div className="ps-form-group">
                      <label>New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 8 characters)"
                        required
                      />
                    </div>

                    <div className="ps-form-group">
                      <label>Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                      />
                    </div>

                    <button type="submit" className="ps-btn-primary" disabled={loading}>
                      <Lock size={20} /> {loading ? 'Changing...' : 'Change Password'}
                    </button>
                  </form>
                </>
              )}

              {activeTab === 'security' && (
                <>
                  <h2 style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid #eef0f6' }}>Two-Factor Authentication</h2>
                  <p className="ps-panel-desc">
                    Add an extra layer of security to your account with 2FA using Google Authenticator.
                  </p>

                  {!twoFAEnabled ? (
                    <>
                      {!showQR ? (
                        <div className="ps-2fa-setup">
                          <div className="ps-info-box">
                            <Shield size={48} />
                            <h3>Enable Two-Factor Authentication</h3>
                            <p>Protect your account with an additional security layer</p>
                          </div>
                          <button
                            className="ps-btn-primary"
                            onClick={handleSetup2FA}
                            disabled={loading}
                          >
                            <Shield size={20} /> {loading ? 'Setting up...' : 'Setup 2FA'}
                          </button>
                        </div>
                      ) : (
                        <div className="ps-2fa-verification">
                          <h3>Scan QR Code</h3>
                          <p>Open Google Authenticator and scan this QR code:</p>
                          <div className="ps-qr-code">
                            <img src={qrCode} alt="QR Code" />
                          </div>
                          <div className="ps-secret-key">
                            <p><strong>Manual Entry Key:</strong></p>
                            <code>{secret}</code>
                          </div>
                          <div className="ps-form-group">
                            <label>Enter 6-digit code from Google Authenticator</label>
                            <input
                              type="text"
                              value={verificationCode}
                              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="000000"
                              maxLength={6}
                            />
                          </div>
                          <button
                            className="ps-btn-primary"
                            onClick={handleVerify2FA}
                            disabled={loading}
                          >
                            {loading ? 'Verifying...' : 'Verify & Enable'}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="ps-2fa-enabled">
                      <div className="ps-success-box">
                        <Shield size={48} />
                        <h3>2FA is Enabled</h3>
                        <p>Your account is protected with two-factor authentication</p>
                      </div>
                      <div className="ps-form-group">
                        <label>Enter your password to disable 2FA</label>
                        <input
                          type="password"
                          value={disablePassword}
                          onChange={(e) => setDisablePassword(e.target.value)}
                          placeholder="Enter your password"
                        />
                      </div>
                      <button
                        className="ps-btn-danger"
                        onClick={handleDisable2FA}
                        disabled={loading}
                      >
                        {loading ? 'Disabling...' : 'Disable 2FA'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'notifications' && (
                <>
                  <h2>Notifications</h2>
                  <p className="ps-panel-desc">Choose what you want to be notified about.</p>
                  <div className="ps-toggle-list">
                    {CREATOR_NOTIF_ROWS.map(([key, title, desc, Icon]) => (
                      <div className="ps-toggle-row" key={key}>
                        <span className="ps-toggle-ic"><Icon size={19} /></span>
                        <div className="ps-toggle-txt"><strong>{title}</strong><p>{desc}</p></div>
                        <button
                          type="button"
                          className={`ps-switch ${creatorNotif[key] ? 'is-on' : ''}`}
                          onClick={() => setCreatorNotif((c) => ({ ...c, [key]: !c[key] }))}
                          aria-label={`Toggle ${title}`}
                        ><i /></button>
                      </div>
                    ))}
                  </div>
                  <button className="ps-btn-primary" onClick={saveCreatorNotif}><Save size={20} /> Save Preferences</button>
                </>
              )}

              {activeTab === 'language' && (
                <>
                  <h2>Language</h2>
                  <p className="ps-panel-desc">Choose the language for your dashboard.</p>
                  <div className="ps-form-group">
                    <label>App language</label>
                    <select value={appLang} onChange={(e) => setAppLang(e.target.value)}>
                      {APP_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <span className="ps-hint">This controls the interface language across UGCad.io.</span>
                  </div>
                  <button className="ps-btn-primary" onClick={saveAppLang}><Save size={20} /> Save Language</button>
                </>
              )}

              {activeTab === 'privacy' && (
                <>
                  <h2>Privacy &amp; Security</h2>
                  <p className="ps-panel-desc">Control who can see and reach you.</p>
                  <div className="ps-toggle-list">
                    {CREATOR_PRIVACY_ROWS.map(([key, title, desc, Icon]) => (
                      <div className="ps-toggle-row" key={key}>
                        <span className="ps-toggle-ic"><Icon size={19} /></span>
                        <div className="ps-toggle-txt"><strong>{title}</strong><p>{desc}</p></div>
                        <button
                          type="button"
                          className={`ps-switch ${privacy[key] ? 'is-on' : ''}`}
                          onClick={() => setPrivacy((c) => ({ ...c, [key]: !c[key] }))}
                          aria-label={`Toggle ${title}`}
                        ><i /></button>
                      </div>
                    ))}
                  </div>
                  <button className="ps-btn-primary" onClick={savePrivacy}><Save size={20} /> Save Privacy Settings</button>

                  <div className="ps-legal">
                    <h3>Legal &amp; Policies</h3>
                    <div className="ps-legal-list">
                      {LEGAL_DOCS.map((d) => (
                        <button type="button" key={d.name} className="ps-legal-row" onClick={() => setLegalDoc(d)}>
                          <span className="ps-legal-ic"><d.icon size={19} /></span>
                          <div className="ps-legal-txt"><strong>{d.name}</strong><p>{d.desc}</p></div>
                          <ChevronRight size={18} className="ps-legal-arrow" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ps-danger-zone">
                    <h3>Deactivate or delete account</h3>
                    <div className="ps-danger-row">
                      <div><strong>Deactivate account</strong><p>Temporarily hide your profile. Reactivate anytime by logging in.</p></div>
                      <button type="button" className="ps-btn-outline-danger" onClick={handleDeactivate}>Deactivate</button>
                    </div>
                    <div className="ps-danger-row">
                      <div><strong>Delete account</strong><p>Permanently remove your account and all data. This can’t be undone.</p></div>
                      <button type="button" className="ps-btn-danger" onClick={handleDeleteAccount}><Trash2 size={16} /> Delete</button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'follow' && (
                <>
                  <h2>Follow us</h2>
                  <p className="ps-panel-desc">Stay updated with UGCad.io on social media.</p>
                  <div className="ps-social-grid">
                    {SOCIAL_LINKS.map((s) => {
                      const inner = (
                        <>
                          <span className="ps-social-ic" style={{ background: s.color }}>
                            {s.icon
                              ? <s.icon size={22} />
                              : <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d={s.path} /></svg>}
                          </span>
                          <div><strong>{s.name}{s.comingSoon ? ' (Coming soon)' : ''}</strong><small>{s.handle}</small></div>
                        </>
                      );
                      return s.comingSoon
                        ? <div key={s.name} className="ps-social-card is-soon">{inner}</div>
                        : <a key={s.name} className="ps-social-card" href={s.url} target="_blank" rel="noreferrer">{inner}</a>;
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
      </div>

      <style>{`
        .ps-toggle-list{display:flex;flex-direction:column;gap:10px;margin-bottom:22px}
        .ps-toggle-row{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid #eef0f6;border-radius:14px;background:#fff}
        .ps-toggle-ic{width:40px;height:40px;flex:none;border-radius:11px;display:grid;place-items:center;background:#eef0ff;color:#5b6bff}
        .ps-toggle-txt{flex:1;min-width:0}
        .ps-toggle-txt strong{display:block;font-size:14.5px;color:#15163a}
        .ps-toggle-txt p{margin:2px 0 0;color:#9296ba;font-size:12.5px}
        .ps-switch{flex:none;width:46px;height:26px;border-radius:20px;border:none;background:#dfe2ef;cursor:pointer;position:relative;transition:background .18s}
        .ps-switch i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .18s;box-shadow:0 2px 5px rgba(0,0,0,.2)}
        .ps-switch.is-on{background:linear-gradient(100deg,#5b6bff,#4452f0)}
        .ps-switch.is-on i{left:23px}

        .ps-legal{margin-top:28px;padding-top:22px;border-top:1px solid #eef0f6}
        .ps-legal h3{font-size:15px;color:#15163a;margin:0 0 14px}
        .ps-legal-list{display:flex;flex-direction:column;gap:10px}
        .ps-legal-row{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid #eef0f6;border-radius:14px;text-decoration:none;background:#fff;transition:.16s}
        .ps-legal-row:hover{border-color:#cdd4ff;background:#f7f8ff}
        .ps-legal-ic{width:40px;height:40px;flex:none;border-radius:11px;display:grid;place-items:center;background:#eef0ff;color:#5b6bff}
        .ps-legal-txt{flex:1;min-width:0}
        .ps-legal-txt strong{display:block;font-size:14.5px;color:#15163a}
        .ps-legal-txt p{margin:2px 0 0;color:#9296ba;font-size:12.5px}
        .ps-legal-arrow{flex:none;color:#9296ba}
        .ps-danger-zone{margin-top:30px;padding-top:22px;border-top:1px solid #eef0f6}
        .ps-danger-zone h3{font-size:15px;color:#e11d48;margin:0 0 14px}
        .ps-danger-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border:1px solid #fdd8e2;background:#fff5f8;border-radius:14px;margin-bottom:10px}
        .ps-danger-row strong{display:block;font-size:14px;color:#15163a}
        .ps-danger-row p{margin:3px 0 0;color:#9296ba;font-size:12.5px;max-width:420px}
        .ps-btn-outline-danger{flex:none;border:1px solid #f2b8c6;background:#fff;color:#e11d48;border-radius:11px;padding:9px 18px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit}
        .ps-btn-outline-danger:hover{background:#fff0f4}
        .ps-danger-row .ps-btn-danger{display:inline-flex;align-items:center;gap:7px;flex:none;width:auto;margin:0;padding:9px 18px}

        .ps-social-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .ps-social-card{display:flex;align-items:center;gap:13px;padding:16px;border:1px solid #eef0f6;border-radius:14px;text-decoration:none;transition:.16s;background:#fff}
        .ps-social-card:hover{border-color:#cdd4ff;background:#f7f8ff;transform:translateY(-2px)}
        .ps-social-ic{width:44px;height:44px;flex:none;border-radius:12px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#5b6bff,#6d7bff)}
        .ps-social-ic svg{display:block}
        .ps-social-card.is-soon{cursor:default}
        .ps-social-card.is-soon:hover{transform:none;border-color:#eef0f6;background:#fff}
        .ps-social-card.is-soon strong{color:#585c7e}
        .ps-social-card strong{display:block;font-size:14.5px;color:#15163a}
        .ps-social-card small{color:#9296ba;font-size:12.5px}
        @media (max-width:640px){.ps-social-grid{grid-template-columns:1fr}}
      `}</style>
      {legalDoc && (
        <div className="ps-legal-overlay" onClick={() => setLegalDoc(null)}>
          <div className="ps-legal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ps-legal-modal-head">
              <span className="ps-legal-modal-ic"><legalDoc.icon size={20} /></span>
              <div className="ps-legal-modal-title"><h3>{legalDoc.name}</h3><small>Last updated: {legalDoc.updated}</small></div>
              <button type="button" className="ps-legal-modal-x" onClick={() => setLegalDoc(null)} aria-label="Close">✕</button>
            </div>
            <div className="ps-legal-modal-body">
              {legalDoc.sections.map((sec, i) => (
                <div className="ps-legal-modal-sec" key={i}>
                  <h4>{sec.h}</h4>
                  <p>{sec.p}</p>
                </div>
              ))}
              <p className="ps-legal-modal-foot">This summary is provided for your convenience and may be updated from time to time.</p>
            </div>
          </div>
          <style>{`
            .ps-legal-overlay{position:fixed;inset:0;z-index:1400;background:rgba(15,22,58,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px}
            .ps-legal-modal{width:min(560px,100%);max-height:86vh;display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 30px 70px -20px rgba(15,22,58,.5);animation:psLegalIn .2s ease}
            @keyframes psLegalIn{from{transform:translateY(8px);opacity:.6}to{transform:none;opacity:1}}
            .ps-legal-modal-head{display:flex;align-items:center;gap:13px;padding:18px 20px;border-bottom:1px solid #eef0f6}
            .ps-legal-modal-ic{width:44px;height:44px;flex:none;border-radius:13px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#5b6bff,#6d7bff)}
            .ps-legal-modal-title{flex:1;min-width:0}
            .ps-legal-modal-title h3{margin:0;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:18px;color:#15163a}
            .ps-legal-modal-title small{color:#9296ba;font-size:12.5px}
            .ps-legal-modal-x{flex:none;width:34px;height:34px;border:none;background:#f1f3fa;color:#15163a;border-radius:10px;cursor:pointer;font-size:15px}
            .ps-legal-modal-x:hover{background:#e7eaf5}
            .ps-legal-modal-body{padding:20px;overflow-y:auto}
            .ps-legal-modal-sec{margin-bottom:16px}
            .ps-legal-modal-sec h4{margin:0 0 5px;font-size:14.5px;font-weight:800;color:#15163a}
            .ps-legal-modal-sec p{margin:0;color:#585c7e;font-size:14px;line-height:1.65}
            .ps-legal-modal-foot{margin:8px 0 0;color:#9296ba;font-size:12.5px;font-style:italic}
          `}</style>
        </div>
      )}
    </CreatorTopNavLayout>
  );
}
