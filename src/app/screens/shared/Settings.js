import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  User, Mail, Lock, Shield, ShieldCheck, ScrollText, UserX, Trash2, Bell, Heart, LifeBuoy, LogOut, ChevronRight, Building2, Users,
  CreditCard, Wallet, BadgeCheck, IndianRupee, Zap, FileCheck, MessageSquare, FileText, Search, RefreshCw, AlertTriangle, Eye, EyeOff,
  Instagram, Linkedin, Twitter, Youtube, UserPlus, Camera, WifiOff, BookOpen, Cookie,
} from 'lucide-react';
import { useAuth } from '../../../App';
import { apiErrorMessage } from '../../../utils/apiError';
import { DEFAULT_NOTIF, DEFAULT_PRIVACY, mergeNotif, mergePrivacy, persistPrefs } from '../../../utils/creatorPrefs';
import { LEGAL_CONTENT } from '../../../data/legalContent';
import LegalSections from '../../../components/LegalSections';
import { SUPPORT_EMAIL } from '../../../components/ContactSupportBox';
import { registerDevice } from '../../../utils/shellPush';
import { isShell, permissionStatus, requestPermission, openAppSettings } from '../../../utils/nativeBridge';
import { displayName as shownName } from '../../../utils/displayName';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import './settings.css';

// Phone version of src/pages/ProfileSettings.js (route /settings, creators and brands). Same endpoints and copy.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const initial = (s) => (String(s || 'U').trim().charAt(0) || 'U').toUpperCase();
const teamInitial = (name) => (String(name || 'U').replace(/[^a-zA-Z0-9]/g, '').charAt(0) || 'U').toUpperCase();
const fullUrl = (u) => (!u ? '' : String(u).startsWith('http') ? u : `${BACKEND_URL}${u}`);
const failMsg = (error, fallback) => (error?.response ? apiErrorMessage(error, fallback) : "You're offline. Check your connection and try again.");

const CREATOR_NOTIF_ROWS = [
  ['brief_matches', 'New brief matches', 'When a campaign matches your niche & rates', Zap],
  ['bid_updates', 'Bid updates', 'Shortlisted, accepted or rejected bids', FileCheck],
  ['messages', 'Direct messages', 'New chat messages from brands', MessageSquare],
  ['payout_alerts', 'Payout alerts', 'Escrow release and withdrawal updates', IndianRupee],
  ['weekly_digest', 'Weekly digest', 'A summary of your activity and earnings', FileText],
];
const BRAND_NOTIF_ROWS = [
  ['new_creator_applications', 'New creator applications', 'Alert when a creator applies to your brief', Users],
  ['deal_status_updates', 'Deal status updates', 'Milestone changes and content delivery alerts', RefreshCw],
  ['payment_escrow_alerts', 'Payment & escrow alerts', 'Wallet recharges and escrow lock notifications', IndianRupee],
  ['direct_messages', 'Direct messages', 'Instant alerts for new chat messages from creators', MessageSquare],
  ['weekly_workspace_reports', 'Weekly workspace reports', 'Summarized digest of your campaign performance', FileText],
];
const PRIVACY_ROWS = [
  ['public_profile', 'Public profile', 'Let brands discover your profile in search', Search],
  ['show_earnings', 'Show earnings', 'Display total earned on your public profile', IndianRupee],
  ['allow_messages', 'Allow direct messages', 'Let brands message you without a deal', MessageSquare],
];
const BUSINESS_TYPES = ['Sole Proprietorship', 'Partnership', 'LLP (Limited Liability Partnership)', 'Private Limited (Pvt Ltd)', 'One Person Company (OPC)', 'Public Limited', 'Individual / Freelancer', 'NGO / Non-profit', 'Other'];
const BUSINESS_CATEGORIES = ['Fashion & Apparel', 'Beauty & Cosmetics', 'Health & Wellness', 'Food & Beverage', 'Electronics & Tech', 'Home & Living', 'Fitness & Sports', 'Jewellery & Accessories', 'Travel & Hospitality', 'Baby & Kids', 'Automotive', 'Finance & Fintech', 'Education', 'Gaming', 'Pets', 'Other'];
const INDIAN_STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];
const TEAM_ROLES = [
  { key: 'admin', label: 'Admin', desc: 'Full access, and can invite or remove other team members.' },
  { key: 'member', label: 'Member', desc: 'Can create and manage campaigns, deals and work - but not the team.' },
  { key: 'viewer', label: 'Viewer', desc: 'Read-only. Can see everything but cannot make changes.' },
];
const SOCIALS = [
  { name: 'Instagram', handle: '@ugcad.app', icon: Instagram, url: 'https://www.instagram.com/ugcad.app', color: 'linear-gradient(45deg,#f09433,#dc2743 55%,#bc1888)' },
  { name: 'Twitter / X', handle: '@ugcad_io', icon: Twitter, soon: true, color: '#000' },
  { name: 'LinkedIn', handle: 'UGCad.io', icon: Linkedin, url: 'https://www.linkedin.com/company/ugcad-io/about/', color: '#0a66c2' },
  { name: 'YouTube', handle: 'UGCad.io', icon: Youtube, soon: true, color: '#ff0000' },
];
const LEGAL_DOCS = [
  { ...LEGAL_CONTENT.privacy, icon: Shield },
  { ...LEGAL_CONTENT.terms, icon: ScrollText },
  { ...LEGAL_CONTENT.agreement, icon: FileText },
  { ...LEGAL_CONTENT.guidelines, icon: BookOpen },
];
const defaultBrandProfile = { brand_name: '', contact_person: '', work_email: '', phone_number: '', website_url: '', logo_url: '' };
const defaultCompany = { business_type: '', gst_number: '', business_category: '', country: 'India', billing_address: '', city: '', state: '', pincode: '', kyb_status: 'pending' };
const defaultTeam = { members: [], seat_limit: 10, seats_used: 0 };
const defaultBilling = { plan_name: 'Brand Pro', commission_rate: 20, monthly_budget_used: 0, monthly_budget_limit: 0 };
const defaultBrandNotif = { new_creator_applications: true, deal_status_updates: true, payment_escrow_alerts: true, direct_messages: true, weekly_workspace_reports: false };
const defaultSummary = { active_plan: 'Pro', wallet_balance: 0, team_count: 0 };

function Switch({ on, onChange, label }) {
  return (
    <button type="button" className="ap-set-swwrap" aria-label={label} onClick={onChange}>
      <span className="ap-set-sw" role="switch" aria-checked={!!on} />
    </button>
  );
}

function Input({ id, label, error, hint, children }) {
  return (
    <div className="ap-set-f">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <span className="ap-set-err" role="alert">{error}</span> : hint ? <span className="ap-set-hint">{hint}</span> : null}
    </div>
  );
}

const Row = ({ icon: Icon, title, sub, onClick, right, bad, href }) => {
  const inner = (
    <>
      <span className={`ap-set-ic${bad ? ' bad' : ''}`}><Icon size={18} /></span>
      <span className="ap-set-t"><b>{title}</b>{sub ? <small>{sub}</small> : null}</span>
      {right || (onClick || href ? <ChevronRight size={18} className="ap-set-chev" /> : null)}
    </>
  );
  if (href) return <a className="ap-set-row" href={href}>{inner}</a>;
  if (onClick) return <button type="button" className="ap-set-row" onClick={onClick}>{inner}</button>;
  return <div className="ap-set-row" style={{ cursor: 'default' }}>{inner}</div>;
};

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section = params.get('s') || '';
  const isBrand = user?.role === 'business';
  const isCreator = user?.role === 'creator';
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const [state, setState] = useState('loading'); // loading | ok | error
  const [errMsg, setErrMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [creatorNotif, setCreatorNotif] = useState(DEFAULT_NOTIF);
  const [privacy, setPrivacy] = useState(DEFAULT_PRIVACY);
  const [savedNotif, setSavedNotif] = useState(DEFAULT_NOTIF);
  const [savedPrivacy, setSavedPrivacy] = useState(DEFAULT_PRIVACY);
  const [warnings, setWarnings] = useState(null);
  const [twoFA, setTwoFA] = useState(false);
  const [brandErr, setBrandErr] = useState('');
  const [brandProfile, setBrandProfile] = useState(defaultBrandProfile);
  const [company, setCompany] = useState(defaultCompany);
  const [team, setTeam] = useState(defaultTeam);
  const [billing, setBilling] = useState(defaultBilling);
  const [brandNotif, setBrandNotif] = useState(defaultBrandNotif);
  const [summary, setSummary] = useState(defaultSummary);
  const [logoBusy, setLogoBusy] = useState(false);

  const load = useCallback(async () => {
    setState('loading'); setErrMsg(''); setBrandErr('');
    try {
      const { data } = await axios.get(`${API}/auth/me`);
      const n = mergeNotif(data?.notification_prefs);
      const p = mergePrivacy(data?.privacy);
      setCreatorNotif(n); setSavedNotif(n); setPrivacy(p); setSavedPrivacy(p);
    } catch (error) {
      setErrMsg(failMsg(error, 'Could not load your settings'));
      setState('error');
      return;
    }
    setState('ok');
    axios.get(`${API}/chat/warnings`).then((r) => setWarnings(r.data)).catch(() => {});
    axios.get(`${API}/profile/2fa/status`).then((r) => setTwoFA(!!r.data?.enabled)).catch(() => {});
    if (user?.role === 'business') {
      try {
        const [p, c, t, b, n, s] = await Promise.all([
          axios.get(`${API}/business/settings/profile`), axios.get(`${API}/business/settings/company`), axios.get(`${API}/business/settings/team`),
          axios.get(`${API}/business/settings/billing`), axios.get(`${API}/business/settings/notifications`), axios.get(`${API}/business/settings/summary`),
        ]);
        setBrandProfile({ ...defaultBrandProfile, ...(p.data || {}) });
        setCompany({ ...defaultCompany, ...(c.data || {}) });
        setTeam({ ...defaultTeam, ...(t.data || {}) });
        setBilling({ ...defaultBilling, ...(b.data || {}) });
        setBrandNotif({ ...defaultBrandNotif, ...(n.data || {}) });
        setSummary({ ...defaultSummary, ...(s.data || {}) });
      } catch (error) {
        setBrandErr(failMsg(error, 'Failed to load brand settings'));
      }
    }
  }, [user?.role]);
  useEffect(() => { load(); }, [load]);

  const open = (s) => setParams(s ? { s } : {});
  const displayName = shownName(user, 'Settings');
  const brandLogo = fullUrl(brandProfile.logo_url || user?.brand_logo || user?.profile_photo || '');
  const photo = isBrand ? brandLogo : fullUrl(user?.profile_photo || user?.profile_picture || user?.profile?.profile_photo || user?.profile?.profile_picture || '');
  const who = isBrand ? (brandProfile.brand_name || user?.profile?.business_name || displayName) : displayName;

  // ---- saves ----
  const savePrefsGroup = async (key, next, saved, setCurrent, setSaved, okMsg, bad) => {
    setBusy(true);
    const r = await persistPrefs((body) => axios.put(`${API}/profile/preferences`, body), key, next, saved);
    setCurrent(r.value);
    if (r.ok) { setSaved(r.value); toast.success(okMsg); } else toast.error(failMsg(r.error, bad));
    setBusy(false);
  };
  const putBrand = async (path, body, setter, okMsg, bad, after) => {
    setBusy(true);
    try {
      const res = await axios.put(`${API}/business/settings/${path}`, body);
      setter((cur) => ({ ...cur, ...(res.data || {}) }));
      if (after) after(res.data);
      toast.success(okMsg);
    } catch (error) { toast.error(failMsg(error, bad)); } finally { setBusy(false); }
  };
  const saveBrandProfile = () => putBrand('profile', brandProfile, setBrandProfile, 'Profile settings saved', 'Failed to save profile settings', (d) => {
    const sp = { ...brandProfile, ...(d || {}) };
    setUser((cur) => (cur ? {
      ...cur, brand_name: sp.brand_name || cur.brand_name, business_name: sp.brand_name || cur.business_name,
      profile: { ...(cur.profile || {}), business_name: sp.brand_name || cur.profile?.business_name, contact_person: sp.contact_person, work_email: sp.work_email, phone_number: sp.phone_number, website_url: sp.website_url },
    } : cur));
  });
  const saveCompany = () => putBrand('company', company, setCompany, 'Company details saved', 'Failed to save company details');
  const saveBrandNotif = () => putBrand('notifications', brandNotif, setBrandNotif, 'Notification preferences saved', 'Failed to save notifications');

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axios.post(`${API}/business/settings/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const next = res.data.logo_url || res.data.brand_logo || res.data.photo_url || res.data.url || res.data.profile?.logo_url;
      if (!next) throw new Error('The server did not return the uploaded logo URL.');
      setBrandProfile((c) => ({ ...c, logo_url: next }));
      if (user?.id) localStorage.removeItem(`ugc_brand_logo_removed:${user.id}`);
      setUser((c) => (c ? { ...c, brand_logo: next, brand_logo_removed: false, profile: { ...(c.profile || {}), logo_url: next, brand_logo: next } } : c));
      toast.success('Logo updated');
    } catch (error) { toast.error(failMsg(error, 'Failed to upload logo')); } finally { setLogoBusy(false); }
  };

  // ---- team ----
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [removing, setRemoving] = useState(null);
  const canManage = ['owner', 'admin'].includes(user?.team_role || 'owner');
  const invite = async () => {
    const email = inviteEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast.error('Enter a valid email to invite'); return; }
    setBusy(true);
    try {
      const res = await axios.post(`${API}/business/settings/team/invite`, { email, role: inviteRole });
      toast.success('Invitation sent');
      setInviteEmail(''); setInviteRole('member'); setInviteOpen(false);
      setTeam({ ...defaultTeam, ...(res.data || {}) });
    } catch (error) { toast.error(failMsg(error, 'Failed to invite member')); } finally { setBusy(false); }
  };
  const removeMember = async () => {
    const m = removing;
    if (!m?.id) { toast.error('Cannot remove this member'); return; }
    setBusy(true);
    try {
      const res = await axios.delete(`${API}/business/settings/team/${m.id}`);
      toast.success(m.status === 'invited' ? 'Invite cancelled' : 'Team member removed');
      setTeam({ ...defaultTeam, ...(res.data || {}) });
      setRemoving(null);
    } catch (error) { toast.error(failMsg(error, 'Failed to remove member')); } finally { setBusy(false); }
  };

  // ---- password + 2FA ----
  const [pw, setPw] = useState({ old: '', next: '', confirm: '' });
  const [pwTried, setPwTried] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const pwErr = {
    old: !pw.old ? 'Enter your current password.' : '',
    next: pw.next.length < 8 ? 'Password must be at least 8 characters.' : '',
    confirm: pw.next !== pw.confirm ? 'New passwords do not match.' : '',
  };
  const changePassword = async (e) => {
    e.preventDefault();
    if (busy) return;
    setPwTried(true);
    if (pwErr.old || pwErr.next || pwErr.confirm) { toast.error(pwErr.confirm || pwErr.next || pwErr.old); return; }
    setBusy(true);
    try {
      // JSON body, not the query string: passwords in a URL end up in server and proxy logs.
      await axios.post(`${API}/profile/change-password`, { old_password: pw.old, new_password: pw.next });
      toast.success('Password changed successfully!');
      setPw({ old: '', next: '', confirm: '' }); setPwTried(false);
    } catch (error) { toast.error(failMsg(error, 'Failed to change password')); } finally { setBusy(false); }
  };
  const [qr, setQr] = useState({ show: false, code: '', secret: '', token: '' });
  const [disablePw, setDisablePw] = useState('');
  const setup2FA = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/profile/2fa/setup`);
      setQr({ show: true, code: data.qr_code || '', secret: data.secret || '', token: '' });
      toast.success('Scan the QR code with your authenticator app');
    } catch (error) { toast.error(failMsg(error, 'Failed to setup 2FA')); } finally { setBusy(false); }
  };
  const verify2FA = async () => {
    if (qr.token.length !== 6) { toast.error('Please enter a valid 6-digit code'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/profile/2fa/verify?token=${encodeURIComponent(qr.token)}`);
      toast.success('2FA enabled successfully!');
      setTwoFA(true); setQr({ show: false, code: '', secret: '', token: '' });
    } catch (error) { toast.error(failMsg(error, 'Invalid verification code')); } finally { setBusy(false); }
  };
  const disable2FA = async () => {
    if (!disablePw) { toast.error('Please enter your password'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/profile/2fa/disable?password=${encodeURIComponent(disablePw)}`);
      toast.success('2FA disabled successfully');
      setTwoFA(false); setDisablePw('');
    } catch (error) { toast.error(failMsg(error, 'Failed to disable 2FA')); } finally { setBusy(false); }
  };

  // ---- sheets: logout / deactivate / delete / legal ----
  const [sheet, setSheet] = useState(null); // 'logout' | 'deactivate' | 'delete'
  const [legal, setLegal] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const runAccount = async () => {
    setBusy(true);
    try {
      if (sheet === 'deactivate') { await axios.post(`${API}/profile/deactivate`); toast.success('Account deactivated'); }
      else { await axios.delete(`${API}/profile`); toast.success('Account deleted'); }
      logout();
    } catch {
      toast.error(`Could not ${sheet === 'delete' ? 'delete' : 'deactivate'} right now - please email ${SUPPORT_EMAIL}`);
      setBusy(false);
    }
  };
  const closeSheet = () => { if (!busy) { setSheet(null); setConfirmText(''); } };

  // ---- pieces ----
  const standing = () => {
    if (!warnings) return null;
    const strikes = warnings.warning_count || 0;
    const cardsOnly = warnings.action_cards_only_until && new Date(warnings.action_cards_only_until) > new Date();
    const banned = warnings.banned;
    const tone = banned || strikes >= 3 || cardsOnly ? { bg: '#fef2f2', bd: '#fecaca', fg: '#b91c1c' } : strikes >= 1 ? { bg: '#fff7ed', bd: '#fed7aa', fg: '#9a3412' } : { bg: '#f0fdf4', bd: '#bbf7d0', fg: '#166534' };
    const status = banned ? 'Account suspended' : cardsOnly ? 'Restricted - action cards only' : strikes === 0 ? 'Good standing' : `${strikes} active ${strikes === 1 ? 'strike' : 'strikes'}`;
    const consequence = banned ? `Your account has been suspended for repeated policy violations. Contact ${SUPPORT_EMAIL} to appeal.`
      : cardsOnly ? 'Free-text chat is temporarily disabled - you can only send structured offer/action cards until the restriction lifts.'
        : strikes === 0 ? 'No policy strikes on your account. Keep chats on-platform and free of contact info to stay clear.'
          : strikes === 1 ? 'You have 1 strike. A 2nd strike temporarily pauses your chat, a 3rd limits you to action cards only, and a 4th can suspend your account.'
            : strikes === 2 ? 'You have 2 strikes and your chat may be paused. A 3rd strike limits you to action cards only, and a 4th can suspend your account.'
              : 'You are limited to action cards only. Any further violation can suspend your account.';
    const Icon = strikes >= 1 || banned || cardsOnly ? AlertTriangle : Shield;
    return (
      <div className="ap-set-stand" style={{ background: tone.bg, borderColor: tone.bd, color: tone.fg }} data-testid="standing">
        <Icon size={22} style={{ flex: 'none' }} />
        <div style={{ minWidth: 0 }}>
          <b>Account standing: {status}<span className="n">{strikes} / 3 strikes</span></b>
          <p>{consequence}</p>
          {warnings.last_warning_at && strikes > 0 && <p>Last strike: {new Date(warnings.last_warning_at).toLocaleString()}</p>}
          {cardsOnly && <p>Restriction lifts: {new Date(warnings.action_cards_only_until).toLocaleString()}</p>}
        </div>
      </div>
    );
  };
  const brandField = (id, label, key, set, obj, opts = {}) => (
    <Input id={id} label={label}>
      <span className="ap-set-in">
        {opts.options ? (
          <select id={id} value={obj[key] || ''} onChange={(e) => set((c) => ({ ...c, [key]: e.target.value }))}>
            <option value="">{opts.placeholder || 'Select…'}</option>
            {obj[key] && !opts.options.includes(obj[key]) && <option value={obj[key]}>{obj[key]}</option>}
            {opts.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : opts.textarea ? (
          <textarea id={id} rows={3} value={obj[key] || ''} onChange={(e) => set((c) => ({ ...c, [key]: e.target.value }))} />
        ) : (
          <input
            id={id} type={opts.type || 'text'} inputMode={opts.numeric ? 'numeric' : undefined} placeholder={opts.placeholder} value={obj[key] || ''}
            onChange={(e) => set((c) => ({ ...c, [key]: opts.numeric ? e.target.value.replace(/[^0-9]/g, '') : e.target.value }))}
          />
        )}
      </span>
    </Input>
  );
  const brandGate = (children) => {
    if (brandErr) {
      return (
        <div className="ap-empty" role="alert">
          <h3>Couldn&rsquo;t load brand settings</h3><p>{brandErr}</p>
          <button type="button" className="ap-btn" onClick={load}>Retry</button>
        </div>
      );
    }
    return typeof children === 'function' ? children() : children;
  };
  const toggleList = (rows, values, setValues) => (
    <div className="ap-set-group">
      {rows.map(([key, title, desc, Icon]) => (
        <div className="ap-set-row" key={key} style={{ cursor: 'default' }}>
          <span className="ap-set-ic"><Icon size={18} /></span>
          <span className="ap-set-t"><b>{title}</b><small>{desc}</small></span>
          <Switch on={values[key]} label={`Toggle ${title}`} onChange={() => setValues((c) => ({ ...c, [key]: !c[key] }))} />
        </div>
      ))}
    </div>
  );

  // ---- section bodies ----
  // Mobile shell: phone push permission. Asked here (in context), never on the first launch screen.
  const [pushStatus, setPushStatus] = useState('');
  useEffect(() => {
    if (!isShell() || section !== 'notifications') return;
    permissionStatus('notifications').then((r) => setPushStatus((r && r.ok && r.status) || ''));
  }, [section]);
  const enablePush = async () => {
    const r = await requestPermission('notifications');
    setPushStatus((r && r.ok && r.status) || pushStatus);
    if (r && r.ok && r.status === 'granted') registerDevice(user?.id || user?.user_id, { force: true });
  };
  const pushCard = isShell() && ['denied', 'blocked'].includes(pushStatus) ? (
    <div className="ap-set-card" data-testid="push-blocked">
      <h2>Phone notifications are off</h2>
      <p>Turn them on to hear about messages, new briefs and payments.</p>
      <button type="button" className="ap-set-save" onClick={pushStatus === 'blocked' ? () => openAppSettings() : enablePush}>{pushStatus === 'blocked' ? 'Open Settings' : 'Turn on notifications'}</button>
    </div>
  ) : null;

  const SECTIONS = {
    profile: { title: 'Brand profile', render: () => brandGate(
      <div className="ap-set-card">
        <div className="ap-set-who">
          <span className="ap-set-av">{brandLogo ? <img src={brandLogo} alt="" /> : initial(who)}</span>
          <label className="ap-btn ap-btn--sm ap-btn--ghost" style={{ cursor: 'pointer' }}>
            <Camera size={16} /> {logoBusy ? 'Uploading…' : 'Change logo'}
            <input type="file" accept="image/*" onChange={uploadLogo} disabled={logoBusy} style={{ display: 'none' }} />
          </label>
        </div>
        {brandField('bs-name', 'Brand name', 'brand_name', setBrandProfile, brandProfile)}
        {brandField('bs-contact', 'Contact person', 'contact_person', setBrandProfile, brandProfile)}
        {brandField('bs-email', 'Work email', 'work_email', setBrandProfile, brandProfile, { type: 'email' })}
        {brandField('bs-phone', 'Phone number', 'phone_number', setBrandProfile, brandProfile, { numeric: true, placeholder: '9876543210' })}
        {brandField('bs-web', 'Website URL', 'website_url', setBrandProfile, brandProfile, { placeholder: 'https://yourbrand.com' })}
        <button type="button" className="ap-set-save" onClick={saveBrandProfile} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>) },
    company: { title: 'Company & GST', render: () => brandGate(
      <div className="ap-set-card">
        {brandField('co-type', 'Business type', 'business_type', setCompany, company, { options: BUSINESS_TYPES, placeholder: 'Select business type' })}
        {brandField('co-gst', 'GST number', 'gst_number', setCompany, company)}
        {brandField('co-cat', 'Business category', 'business_category', setCompany, company, { options: BUSINESS_CATEGORIES, placeholder: 'Select category' })}
        {brandField('co-country', 'Country', 'country', setCompany, company)}
        {brandField('co-addr', 'Billing address', 'billing_address', setCompany, company, { textarea: true })}
        {brandField('co-city', 'City', 'city', setCompany, company)}
        {brandField('co-state', 'State', 'state', setCompany, company, { options: INDIAN_STATES, placeholder: 'Select state' })}
        <Input id="co-pin" label="Pincode">
          <span className="ap-set-in"><input id="co-pin" inputMode="numeric" placeholder="6-digit pincode" value={company.pincode || ''} onChange={(e) => setCompany((c) => ({ ...c, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} /></span>
        </Input>
        <button type="button" className="ap-set-save" onClick={saveCompany} disabled={busy}>{busy ? 'Saving…' : 'Save company details'}</button>
      </div>) },
    team: { title: 'Team & roles', render: () => brandGate(
      <>
        <div className="ap-set-group" style={{ padding: '2px 16px' }}>
          {(team.members || []).length === 0 && <div className="ap-empty"><h3>No team members yet</h3><p>Invite coworkers to share campaigns, deals and the wallet.</p></div>}
          {(team.members || []).map((m) => {
            const isYou = String(m.id) === String(user?.id);
            return (
              <div className="ap-set-member" key={m.id || m.email}>
                <span className="ap-set-mav">{m.avatar_url ? <img src={fullUrl(m.avatar_url)} alt="" /> : teamInitial(m.name || m.email)}</span>
                <span className="ap-set-t">
                  <b>{String(m.name || m.email).replace(/^@/, '')}{isYou ? ' · you' : ''}</b>
                  <small>{m.email}</small>
                </span>
                <span className={`ap-pill ${m.status === 'invited' ? 'ap-pill--warn' : m.status === 'inactive' ? 'ap-pill--muted' : ''}`}>
                  {m.is_owner ? 'Owner' : m.status === 'invited' ? 'Invited' : m.status === 'inactive' ? 'Inactive' : m.role}
                </span>
                {canManage && !m.is_owner && (
                  <button type="button" className="ap-set-x" aria-label={m.status === 'invited' ? 'Cancel invite' : 'Remove member'} onClick={() => setRemoving(m)}><Trash2 size={18} /></button>
                )}
              </div>
            );
          })}
        </div>
        <p className="ap-set-hint" style={{ padding: '0 4px' }}>Workspace: <b>{team.seats_used || team.members?.length || 0} / {team.seat_limit || 10} seats used.</b></p>
        {canManage && <button type="button" className="ap-set-save" onClick={() => setInviteOpen(true)}><UserPlus size={16} style={{ verticalAlign: -3 }} /> Invite a team member</button>}
      </>) },
    billing: { title: 'Billing & plan', render: () => brandGate(() => {
      const used = Number(billing.monthly_budget_used || 0);
      const limit = Number(billing.monthly_budget_limit || 0);
      const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
      return (
        <>
          <div className="ap-set-card">
            <div className="ap-row"><span className="ap-row-t"><small>Active plan</small><b>{summary.active_plan || billing.plan_name || 'Pro'}</b></span>{!isShell() && <button type="button" className="ap-link" onClick={() => navigate('/dashboard/business/plans')}>See plans</button>}</div>
            <div className="ap-row"><span className="ap-row-t"><small>Wallet</small><b>{money(summary.wallet_balance)}</b></span></div>
            <div className="ap-row"><span className="ap-row-t"><small>Team count</small><b>{summary.team_count || team.members?.length || 0} members</b></span></div>
          </div>
          <div className="ap-set-card">
            <h2>Monthly campaign budget</h2>
            <div className="ap-set-meter"><i style={{ width: `${pct}%` }} /></div>
            <p>{money(used)} / {money(limit)} &middot; {pct}% used this month</p>
          </div>
          <div className="ap-set-group">
            <Row icon={RefreshCw} title="Billing history" onClick={() => navigate('/dashboard/business/wallet?view=history')} />
            <Row icon={CreditCard} title="Payment methods" onClick={() => navigate('/dashboard/business/wallet?view=recharge')} />
          </div>
        </>
      );
    }) },
    notifications: { title: isBrand ? 'Email alerts' : 'Notifications', render: () => (isBrand ? brandGate(
      <>
        {pushCard}
        {toggleList(BRAND_NOTIF_ROWS, brandNotif, setBrandNotif)}
        <button type="button" className="ap-set-save" onClick={saveBrandNotif} disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button>
      </>) : (
      <>
        {pushCard}
        {toggleList(CREATOR_NOTIF_ROWS, creatorNotif, setCreatorNotif)}
        <button type="button" className="ap-set-save" disabled={busy} onClick={() => savePrefsGroup('notification_prefs', creatorNotif, savedNotif, setCreatorNotif, setSavedNotif, 'Notification preferences saved', 'Could not save notification preferences')}>{busy ? 'Saving…' : 'Save preferences'}</button>
      </>)) },
    privacy: { title: 'Privacy & standing', render: () => (
      <>
        {standing()}
        {toggleList(PRIVACY_ROWS.filter(([k]) => isCreator || k !== 'show_earnings'), privacy, setPrivacy)}
        <button type="button" className="ap-set-save" disabled={busy} onClick={() => savePrefsGroup('privacy', privacy, savedPrivacy, setPrivacy, setSavedPrivacy, 'Privacy settings saved', 'Could not save privacy settings')}>{busy ? 'Saving…' : 'Save privacy settings'}</button>
      </>) },
    security: { title: 'Login & security', render: () => (
      <>
        <form className="ap-set-card" onSubmit={changePassword} noValidate>
          <h2>Change password</h2>
          {[['old', 'Current password', 'current-password'], ['next', 'New password (min 8 characters)', 'new-password'], ['confirm', 'Confirm new password', 'new-password']].map(([k, label, ac]) => (
            <Input key={k} id={`pw-${k}`} label={label} error={pwTried ? pwErr[k] : ''}>
              <span className={`ap-set-in${pwTried && pwErr[k] ? ' bad' : ''}`}>
                <input id={`pw-${k}`} type={showPw ? 'text' : 'password'} autoComplete={ac} value={pw[k]} onChange={(e) => setPw((c) => ({ ...c, [k]: e.target.value }))} />
                {k === 'old' && <button type="button" className="eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide passwords' : 'Show passwords'}>{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
              </span>
            </Input>
          ))}
          <button type="submit" className="ap-set-save" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
        </form>
        <div className="ap-set-card">
          <h2>Two-step login</h2>
          <p>{twoFA ? '2FA is enabled for this account.' : 'Add an extra layer of security with an authenticator app.'}</p>
          {!twoFA && !qr.show && <button type="button" className="ap-set-save" onClick={setup2FA} disabled={busy}>{busy ? 'Setting up…' : 'Set up 2FA'}</button>}
          {!twoFA && qr.show && (
            <div className="ap-set-qr">
              {qr.code && <img src={qr.code} alt="2FA QR code" />}
              {qr.secret && <code>{qr.secret}</code>}
              <Input id="tf-code" label="Enter the 6-digit code from your authenticator app">
                <span className="ap-set-in"><input id="tf-code" inputMode="numeric" maxLength={6} placeholder="000000" value={qr.token} onChange={(e) => setQr((c) => ({ ...c, token: e.target.value.replace(/\D/g, '').slice(0, 6) }))} /></span>
              </Input>
              <button type="button" className="ap-set-save" onClick={verify2FA} disabled={busy}>{busy ? 'Verifying…' : 'Verify & enable'}</button>
            </div>
          )}
          {twoFA && (
            <>
              <Input id="tf-off" label="Enter your password to disable 2FA">
                <span className="ap-set-in"><input id="tf-off" type="password" autoComplete="current-password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} /></span>
              </Input>
              <button type="button" className="ap-set-save bad" onClick={disable2FA} disabled={busy}>{busy ? 'Disabling…' : 'Disable 2FA'}</button>
            </>
          )}
        </div>
      </>) },
    legal: { title: 'Legal & policies', render: () => (
      <div className="ap-set-group">
        {LEGAL_DOCS.map((d) => <Row key={d.id} icon={d.icon} title={d.name} sub={d.desc} onClick={() => setLegal(d)} />)}
        <Row icon={Cookie} title="Cookie Policy" sub="How cookies and tracking are used" onClick={() => navigate('/cookie-policy')} />
      </div>) },
    account: { title: 'Close account', render: () => (
      <div className="ap-set-card">
        <h2 style={{ color: '#b42318' }}>Deactivate or delete account</h2>
        <div className="ap-set-group" style={{ boxShadow: 'none', padding: 0 }}>
          <Row icon={UserX} title="Deactivate account" sub={isBrand ? 'Temporarily hide your workspace. Reactivate anytime by logging back in.' : 'Temporarily hide your profile. Reactivate anytime by logging in.'} onClick={() => setSheet('deactivate')} />
          <Row icon={Trash2} bad title={isBrand ? 'Close account permanently' : 'Delete account'} sub={isBrand ? 'Permanently remove your account and all workspace data. This can’t be undone.' : 'Permanently remove your account and all data. This can’t be undone.'} onClick={() => setSheet('delete')} />
        </div>
      </div>) },
    follow: { title: 'Follow us', render: () => (
      <div className="ap-set-group">
        {SOCIALS.filter((s) => !(isShell() && s.soon)).map((s) => {
          const inner = (
            <>
              <span className="ic" style={{ background: s.color }}><s.icon size={20} /></span>
              <span className="ap-set-t"><b>{s.name}{s.soon ? ' (Coming soon)' : ''}</b><small>{s.handle}</small></span>
            </>
          );
          return s.soon ? <div key={s.name} className="ap-set-soc">{inner}</div> : <a key={s.name} className="ap-set-soc" href={s.url} target="_blank" rel="noreferrer">{inner}</a>;
        })}
      </div>) },
  };
  // Brand-only sections are not reachable for creators (and vice versa).
  const allowed = (k) => (['profile', 'company', 'team', 'billing'].includes(k) ? isBrand : true);
  const current = SECTIONS[section] && allowed(section) ? SECTIONS[section] : null;

  // ---- home list ----
  const notifOn = isBrand ? BRAND_NOTIF_ROWS.filter(([k]) => brandNotif[k]).length : CREATOR_NOTIF_ROWS.filter(([k]) => creatorNotif[k]).length;
  const notifTotal = isBrand ? BRAND_NOTIF_ROWS.length : CREATOR_NOTIF_ROWS.length;
  const strikes = warnings?.warning_count || 0;
  const standingSub = warnings ? (strikes === 0 ? 'Good standing · 0 strikes' : `${strikes} active ${strikes === 1 ? 'strike' : 'strikes'}`) : 'Who can see and message you';
  const KYC_LABEL = { verified: 'Verified', pending: 'Under review', rejected: 'Needs attention', not_submitted: 'Not verified yet' };
  const pendingInvites = (team.members || []).filter((m) => m.status === 'invited').length;
  const groups = isBrand ? [
    ['Account', [
      [Building2, 'Brand profile', [brandProfile.brand_name, brandProfile.website_url].filter(Boolean).join(' · ') || 'Logo and contact details', () => open('profile')],
      [FileText, 'Company & GST', company.gst_number ? `GSTIN ${company.gst_number}` : 'GSTIN not added', () => open('company')],
      [Users, 'Team & roles', `${team.seats_used || team.members?.length || 0} of ${team.seat_limit || 10} seats${pendingInvites ? ` · ${pendingInvites} pending` : ''}`, () => open('team')],
      [CreditCard, 'Billing & plan', `Wallet ${money(summary.wallet_balance)} · fee ${billing.commission_rate}%`, () => open('billing')],
    ]],
    ['Alerts', [[Bell, 'Email alerts', `${notifOn} of ${notifTotal} alerts on`, () => open('notifications')]]],
    ['Privacy & legal', [
      [Shield, 'Privacy & standing', standingSub, () => open('privacy')],
      [Lock, 'Login & security', `Two-step login ${twoFA ? 'on' : 'off'}`, () => open('security')],
      [ScrollText, 'Legal & policies', 'Terms, privacy policy, agreement', () => open('legal')],
      [UserX, 'Deactivate or close account', 'Hide or permanently remove your account', () => open('account')],
    ]],
  ] : [
    ['Account', [
      [User, 'Profile & photo', displayName, () => navigate('/profile')],
      [Mail, 'Email', user?.email || '', null],
      [Lock, 'Password & two-step login', `Two-step login ${twoFA ? 'on' : 'off'}`, () => open('security')],
    ]],
    ['Money', [
      [Wallet, 'Earnings & payouts', 'Balance, withdrawals and payout method', () => navigate('/withdrawal')],
      [BadgeCheck, 'Identity verification (KYC)', KYC_LABEL[user?.kyc?.status || 'not_submitted'] || 'Not verified yet', () => navigate('/kyc')],
    ]],
    ['Alerts', [[Bell, 'Notification preferences', `${notifOn} of ${notifTotal} alerts on`, () => open('notifications')]]],
    ['Privacy & legal', [
      [Shield, 'Privacy & account standing', standingSub, () => open('privacy')],
      [ScrollText, 'Legal & policies', 'Terms, privacy policy, creator agreement', () => open('legal')],
      [UserX, 'Deactivate or delete account', 'Hide or permanently remove your account', () => open('account')],
    ]],
  ];
  groups.push(['Help', [
    [Heart, 'Follow UGCad.io', 'Product news on social media', () => open('follow')],
    [LifeBuoy, 'Contact support', SUPPORT_EMAIL, null, `mailto:${SUPPORT_EMAIL}`],
  ]]);

  const shellProps = current
    ? { title: current.title, back: '/settings' }
    : { title: 'Settings', subtitle: 'Your account, alerts and privacy.' };

  let body;
  if (state === 'loading') {
    body = (
      <div className="ap-set" aria-busy="true" aria-label="Loading settings">
        <div className="ap-skel" style={{ height: 84, borderRadius: 20 }} />
        <div className="ap-skel" style={{ height: 190, borderRadius: 20 }} />
        <div className="ap-skel" style={{ height: 130, borderRadius: 20 }} />
        <div className="ap-skel" style={{ height: 190, borderRadius: 20 }} />
      </div>
    );
  } else if (state === 'error') {
    body = (
      <div className="ap-empty" role="alert">
        {!online ? <WifiOff size={36} color="#6e6e96" /> : <AlertTriangle size={36} color="#b42318" />}
        <h3>{online ? 'Couldn’t load settings' : 'You’re offline'}</h3>
        <p>{errMsg}</p>
        <button type="button" className="ap-btn" onClick={load}>Retry</button>
      </div>
    );
  } else if (current) {
    body = <div className="ap-set">{current.render()}</div>;
  } else {
    body = (
      <div className="ap-set">
        <div className="ap-card">
          <div className="ap-set-who">
            <span className="ap-set-av">{photo ? <img src={photo} alt="" /> : initial(who)}</span>
            <span className="ap-set-who-t">
              <b>{who}</b>
              <small>{[user?.email, isBrand ? (user?.team_role || 'owner').replace(/^./, (c) => c.toUpperCase()) : null, isBrand ? (summary.active_plan || billing.plan_name) : null].filter(Boolean).join(' · ')}</small>
            </span>
            {isCreator && <button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => navigate('/profile')}>View profile</button>}
          </div>
        </div>
        {isBrand && brandErr && (
          <div className="ap-set-offline" role="alert">
            {brandErr} <button type="button" className="ap-link" onClick={load}>Retry</button>
          </div>
        )}
        {groups.map(([title, rows]) => (
          <div key={title} style={{ display: 'contents' }}>
            <div className="ap-set-label">{title.toUpperCase()}</div>
            <div className="ap-set-group">
              {rows.map(([icon, t, sub, go, href]) => <Row key={t} icon={icon} title={t} sub={sub} onClick={go || undefined} href={href} />)}
            </div>
          </div>
        ))}
        <div className="ap-set-foot">
          <button type="button" onClick={() => setSheet('logout')}><LogOut size={18} aria-hidden="true" /> Log out</button>
        </div>
      </div>
    );
  }

  const del = sheet === 'delete';
  return (
    <AppShell {...shellProps}>
      {!online && state !== 'error' && <div className="ap-set-offline" role="status" style={{ marginBottom: 10 }}>You&rsquo;re offline. Changes can&rsquo;t be saved until you reconnect.</div>}
      {body}

      <BottomSheet
        open={sheet === 'logout'} onClose={closeSheet} title="Log out?"
        footer={<><button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={closeSheet}>Cancel</button><button type="button" className="ap-btn" style={{ flex: 1 }} onClick={() => { setSheet(null); logout(); }}>Log out</button></>}
      >
        <p style={{ margin: 0, color: '#6e6e96' }}>You can log back in any time with your email.</p>
      </BottomSheet>

      <BottomSheet
        open={sheet === 'deactivate' || del} onClose={closeSheet} title={del ? (isBrand ? 'Close account permanently?' : 'Delete account permanently?') : 'Deactivate your account?'}
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={closeSheet} disabled={busy}>Cancel</button>
            <button type="button" className={`ap-btn${del ? ' ap-btn--danger' : ''}`} style={{ flex: 1 }} onClick={runAccount} disabled={busy || (del && confirmText.trim().toUpperCase() !== 'DELETE')} data-testid="account-confirm">
              {busy ? 'Please wait…' : del ? 'Delete permanently' : 'Deactivate account'}
            </button>
          </>
        )}
      >
        <div className="ap-set-sheet">
          <span className={`big${del ? ' bad' : ''}`}>{del ? <Trash2 size={25} /> : <UserX size={25} />}</span>
          <p>
            {del
              ? 'All your profile information, activity, and account data will be permanently removed. This action cannot be undone.'
              : 'Your profile will be hidden until you log back in. You can reactivate your account at any time.'}
          </p>
          {del && (
            <Input id="del-confirm" label="Type DELETE to confirm">
              <span className="ap-set-in"><input id="del-confirm" autoCapitalize="characters" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" /></span>
            </Input>
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        open={inviteOpen} onClose={() => !busy && setInviteOpen(false)} title="Invite a team member" subtitle="They’ll get an email link to set a password and join your workspace."
        footer={<button type="button" className="ap-btn ap-btn--block" onClick={invite} disabled={busy || !inviteEmail.trim()}>{busy ? 'Sending…' : 'Send invitation'}</button>}
      >
        <div className="ap-set-state">
          <Input id="inv-email" label="Email address">
            <span className="ap-set-in"><input id="inv-email" type="email" inputMode="email" autoCapitalize="none" placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></span>
          </Input>
          <div className="ap-set-roles" role="radiogroup" aria-label="Role and access">
            {TEAM_ROLES.map((r) => (
              <button type="button" role="radio" aria-checked={inviteRole === r.key} key={r.key} className={`ap-set-role${inviteRole === r.key ? ' is-on' : ''}`} onClick={() => setInviteRole(r.key)}>
                <span className="rd" /><span><b>{r.label}</b><small>{r.desc}</small></span>
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={!!removing} onClose={() => !busy && setRemoving(null)} title={removing?.status === 'invited' ? 'Cancel this invite?' : 'Remove team member?'}
        footer={<><button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={() => setRemoving(null)} disabled={busy}>Keep</button><button type="button" className="ap-btn ap-btn--danger" style={{ flex: 1 }} onClick={removeMember} disabled={busy}>{busy ? 'Please wait…' : removing?.status === 'invited' ? 'Cancel invite' : 'Remove'}</button></>}
      >
        <p style={{ margin: 0, color: '#6e6e96' }}>{removing?.name || removing?.email}</p>
      </BottomSheet>

      <BottomSheet open={!!legal} onClose={() => setLegal(null)} title={legal?.name} subtitle={legal ? `Last updated: ${legal.updated}` : ''} tall>
        {legal && (
          <div className="ap-set-legal">
            <LegalSections doc={legal} pStyle={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.65, color: '#585c7e' }} />
          </div>
        )}
      </BottomSheet>
    </AppShell>
  );
}
