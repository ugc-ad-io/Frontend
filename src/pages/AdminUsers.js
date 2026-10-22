import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import {
  Users, Search, X, Eye, Download, Send, Ban, ShieldAlert, AlertTriangle,
  ArrowUpCircle, ArrowDownCircle, Wallet, Percent, MessageSquare,
  FileText, CreditCard, CalendarClock, Flag, Trash2, ShieldCheck, BadgeCheck,
  ArrowLeft, MoreHorizontal, ChevronRight, Pencil, EyeOff, ExternalLink, SlidersHorizontal, CheckSquare,
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Skeleton, SkeletonList } from '../components/Skeleton';
import useIsPhone from '../lib/useIsPhone';
import '../styles/admin-mobile-users.css';
import { useAuth } from '../App';
import { can, ROLE_LABELS, normalizeRole } from '../utils/adminRoles';
import { levelLabelOf } from '../utils/creatorLevel';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// ---- derivations from the (Mixed) user.profile + chat policy -------------------
const p = (u, ...keys) => {
  const pr = u.profile || {};
  for (const k of keys) { if (pr[k] != null && pr[k] !== '') return pr[k]; }
  return '';
};
const isBrand = (u) => u.role === 'business';
const isCreator = (u) => u.role === 'creator';
// Staff accounts (role === 'admin', carrying an admin_role sub-tier). They are
// neither a brand nor a creator, so they must NOT get the creator profile layout
// (deals/earnings/level/KYC). Anything that isn't a brand/creator is treated as staff.
const isAdmin = (u) => u.role === 'admin' || (!isBrand(u) && !isCreator(u));
// backend stores `active` (false => suspended/deactivated) and a separate `banned` flag (10.9)
const userState = (u) => (u.banned ? 'banned' : (u.active === false ? 'suspended' : (u.chat?.suspended ? 'suspended' : 'active')));
const isInactive = (u) => u.banned === true || u.active === false;
const strikes = (u) => (u.chat?.strikes || []);
const isFlagged = (u) => strikes(u).length > 0;
const category = (u) => {
  const value = p(u, 'category', 'industry', 'niche', 'primary_category');
  return Array.isArray(value) ? value.filter(item => typeof item === 'string').join(', ') || '-' : typeof value === 'string' ? value || '-' : '-';
};
// Real human name. Prefers what the person/KYC actually provided over the
// auto-generated @handle. Also reads the verified KYC legal name (creators who
// never set a display name still have their legal name on file — e.g. "Arushi Khare").
const realName = (u) =>
  u.full_name ||
  p(u, 'full_name', 'legal_name', 'real_name') ||
  (u.kyc && u.kyc.full_legal_name) ||
  '';
const businessName = (u) => p(u, 'business_name', 'company_name', 'brand_name') || u.nickname || '-';
const legalName = (u) => p(u, 'legal_name', 'registered_name') || '-';
const gstin = (u) => p(u, 'gstin', 'gst', 'gst_number') || '-';
// Phone signup stores the number on the user itself, not under profile.
const phone = (u) => p(u, 'phone', 'phone_number', 'mobile', 'contact_number') || u.phone || u.phone_number || '-';
const handleOf = (u) => (u.username ? `@${u.username}` : (u.public_creator_id ? `#${u.public_creator_id}` : (u.nickname || '-')));
// Primary NAME to show anywhere in admin. Show the real/legal name if we have one;
// only fall back to the handle when there's genuinely no real name — never surface a
// bare auto-generated @nickname as though it were the person's name.
const displayName = (u) => String(realName(u) || '').replace(/^@+/, '').trim() || handleOf(u);
const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateShort = (v) => (v ? String(v).slice(0, 10) : '-');

const STATE_LABELS = { active: 'Active', suspended: 'Suspended', banned: 'Banned' };
const PAYOUT_SCHEDULES = ['weekly', 'biweekly', 'monthly', 'on_request'];

const mask4 = (v) => (v ? `•••• ${String(v).slice(-4)}` : '-');
const docUrl = (uu) => (!uu ? '' : (String(uu).startsWith('http') ? uu : `${BACKEND_URL}${uu}`));
// KYC is submitted to user.kyc (not user.profile); the payout account lives at the
// top level (u.bank_details / u.upi_id) — that's where withdrawals read it.
const payoutInfo = (u) => {
  const kyc = u.kyc || {};
  const bankDetails = u.bank_details || {};
  return {
    kyc,
    kycAddr: kyc.address || {},
    acct: bankDetails.account_number || p(u, 'bank_account', 'account_number'),
    ifsc: bankDetails.ifsc_code || p(u, 'ifsc', 'ifsc_code'),
    bankHolder: bankDetails.account_holder_name,
    bankName: bankDetails.bank_name,
    upiId: u.upi_id,
    pan: kyc.pan_number || p(u, 'pan', 'pan_number'),
    aadhaar: kyc.aadhaar_number || p(u, 'aadhaar', 'aadhaar_number'),
    docs: [
      ['PAN card', kyc.pan_doc_url || p(u, 'pan_url', 'pan_document')],
      ['Aadhaar front', kyc.aadhaar_front_url || p(u, 'aadhaar_url', 'aadhaar_document')],
      ['Aadhaar back', kyc.aadhaar_back_url],
      ['Selfie', kyc.selfie_url],
      ['GST Cert', p(u, 'gst_certificate', 'gst_url')],
    ].filter(([, url]) => url),
  };
};

// ---- phone (PWA) helpers ------------------------------------------------------
// Email on phone cards: first 2 chars of the mailbox, then the domain.
const maskEmail = (e) => {
  const [box, domain] = String(e || '').split('@');
  if (!domain) return e || '-';
  return `${box.slice(0, 2)}•••@${domain}`;
};
const maskPhone = (v) => (v && v !== '-' ? mask4(String(v).replace(/\s/g, '')) : '-');
const nameOf = (u) => (isBrand(u) ? businessName(u) : displayName(u));
const typeLabel = (u) => (isBrand(u) ? 'Brand' : (isAdmin(u) ? 'Admin' : 'Creator'));
const STATE_TONE = { active: 'ok', suspended: 'wait', banned: 'bad' };
const VERIFY_BADGE = {
  approved: ['ok', 'Verified'],
  pending: ['wait', 'Verification pending'],
  more_info: ['wait', 'More info requested'],
  rejected: ['bad', 'Verification rejected'],
};
const EMPTY_PHONE_FILTERS = { state: '', verify: '', category: '', walletMin: '', walletMax: '', flagged: false, formNotFilled: false };

function PhoneSheet({ title, onClose, children, foot, testId }) {
  return (
    <>
      <div className="am-sheet-backdrop" onClick={onClose} />
      <section className="am-sheet" role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
        <header className="am-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="am-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="am-sheet-body">{children}</div>
        {foot && <footer className="am-sheet-foot">{foot}</footer>}
      </section>
    </>
  );
}

function PhoneAvatar({ u, lg }) {
  // Same rule as the desktop drawer: a dead /uploads or localhost photo falls back to the initial.
  const [broken, setBroken] = useState(false);
  const raw = u.profile_photo;
  const url = (raw && !/localhost/i.test(raw)) ? (String(raw).startsWith('http') ? raw : `${BACKEND_URL}${raw}`) : null;
  const cls = `am-avatar${lg ? ' am-avatar--lg' : ''}`;
  if (url && !broken) return <img className={cls} src={url} alt="" onError={() => setBroken(true)} />;
  return <span className={cls} aria-hidden="true">{String(nameOf(u) || u.email || '?').replace(/^[@#]/, '').charAt(0).toUpperCase()}</span>;
}

function UserBadges({ u }) {
  const st = userState(u);
  const verify = isBrand(u) ? VERIFY_BADGE[u.approval_status || 'approved'] : null;
  return (
    <span className="am-badges">
      <span className="am-badge am-badge--neutral">{typeLabel(u)}</span>
      {isAdmin(u) && u.admin_role && <span className="am-badge am-badge--info">{ROLE_LABELS[normalizeRole(u.admin_role)] || 'Admin'}</span>}
      {isCreator(u) && <span className="am-badge am-badge--info">{levelLabelOf(u.level_key ?? u.level)}</span>}
      {isCreator(u) && u.ugcad_approved && <span className="am-badge am-badge--ok amu-verified"><BadgeCheck size={14} /> UGCAD preferred</span>}
      {verify && (
        <span className={`am-badge am-badge--${verify[0]}${verify[0] === 'ok' ? ' amu-verified' : ''}`}>
          {verify[0] === 'ok' && <ShieldCheck size={14} />} {verify[1]}
        </span>
      )}
      <span className={`am-badge am-badge--${STATE_TONE[st]}`}>{STATE_LABELS[st]}</span>
      {isFlagged(u) && <span className="am-badge am-badge--bad"><Flag size={12} /> {strikes(u).length} strike{strikes(u).length === 1 ? '' : 's'}</span>}
    </span>
  );
}

// Reused by the custom-admin "My Users" page (AdminMyCreators) so both admin views
// share ONE table/detail UI. Only the data source + heading differ.
export default function AdminUsers({
  endpoint = '/admin/users',
  heading = 'Users',
  subheading = 'Creator & brand directories - search, filter, inspect profiles, and moderate',
} = {}) {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  // Capability gating (PRD 11 — role structure). This page is reachable by
  // founder + Ops Senior; ban / commission / pro are founder-only.
  const caps = {
    ban: can(me, 'ban_users', 'edit'),
    warnSuspend: can(me, 'warn_suspend_users', 'edit'),
    wallet: can(me, 'adjust_wallet', 'edit'),
    financialPolicy: can(me, 'edit_settings', 'edit'),
    userMgmt: can(me, 'user_management', 'edit'),   // gates creator level (promote/demote) + payout schedule
  };

  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // directory tab + filters (spec 11.10)
  const [tab, setTab] = useState('all'); // all | creators | brands
  const [stateFilter, setStateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [formNotFilled, setFormNotFilled] = useState(false); // signed up, never submitted profile-setup
  const [verifyFilter, setVerifyFilter] = useState(''); // brand verification status
  const [walletMin, setWalletMin] = useState('');
  const [walletMax, setWalletMax] = useState('');

  // bulk selection
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // edit modal (kept from before)
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ nickname: '', full_name: '', email: '', role: '', username: '', public_creator_id: '' });

  // profile detail drawer (admin view) + per-user activity
  const [detailUser, setDetailUser] = useState(null);
  // After an action refetches the list keep the open drawer in step with it.
  useEffect(() => {
    setDetailUser((d) => (d ? (allUsers.find((x) => x.id === d.id) || d) : d));
  }, [allUsers]);
  const [detailTab, setDetailTab] = useState('profile');
  const [revealBank, setRevealBank] = useState(false);
  const [deals, setDeals] = useState(null);
  const [disputes, setDisputes] = useState(null);
  // A brand's campaigns come from their own campaigns list (live + completed),
  // NOT from the deals list — /admin/deals only returns campaigns that already
  // have a selected creator, so live/unmatched campaigns would never show.
  const [brandCampaigns, setBrandCampaigns] = useState(null); // null = not loaded/loading

  // generic action modal (warn / suspend / message / wallet / commission / payout / announcement)
  const [action, setAction] = useState(null); // { type, user|users, ... }

  // ban / unban confirmation modal
  const [banTarget, setBanTarget] = useState(null); // { user, banned }

  // phone (PWA) only
  const [phoneSheet, setPhoneSheet] = useState(null); // 'filters' | 'more'
  const [filterDraft, setFilterDraft] = useState(EMPTY_PHONE_FILTERS);
  const [selectMode, setSelectMode] = useState(false);
  const [revealContact, setRevealContact] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  useLiveEffect(() => { fetchAllUsers(); }, []);

  // /admin/users returns a plain array; /admin/my-assigned returns
  // { scoped, assigned_categories, users }. Accept both.
  const [assignedCats, setAssignedCats] = useState(null);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}${endpoint}`);
      if (Array.isArray(data)) {
        setAllUsers(data.filter(user => user && typeof user === 'object' && user.id));
        setAssignedCats(null);
      } else {
        setAllUsers(Array.isArray(data?.users) ? data.users.filter(user => user && typeof user === 'object' && user.id) : []);
        setAssignedCats(data?.assigned_categories || []);
      }
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // lazily load deal + dispute history the first time any detail drawer opens
  const ensureActivity = useCallback(async () => {
    if (deals === null) {
      try { const r = await axios.get(`${API}/admin/deals`); setDeals(r.data || []); }
      catch { setDeals([]); }
    }
    if (disputes === null) {
      try { const r = await axios.get(`${API}/admin/disputes`); setDisputes(r.data?.disputes || []); }
      catch { setDisputes([]); }
    }
  }, [deals, disputes]);

  const openDetail = (u) => {
    setDetailUser(u);
    setDetailTab('profile');
    setRevealBank(false);
    ensureActivity();
    // Brands: pull their real campaign list (live + completed) for the Campaigns tab.
    setBrandCampaigns(null);
    if (isBrand(u)) {
      axios.get(`${API}/admin/business/${u.id}/campaigns`)
        .then((r) => setBrandCampaigns(r.data || []))
        .catch(() => setBrandCampaigns([]));
    }
  };

  const handleEdit = (u) => {
    setSelectedUser(u);
    setEditData({ nickname: u.nickname || '', full_name: u.full_name || '', email: u.email, role: u.role, username: u.username || '', public_creator_id: u.public_creator_id || u.id || '' });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    try {
      await axios.post(`${API}/admin/user/update`, { user_id: selectedUser.id, ...editData });
      toast.success('User updated successfully');
      // Reflect the change immediately, then reconcile with the server.
      setAllUsers((prev) => prev.map((x) => x.id === selectedUser.id
        ? { ...x, nickname: editData.nickname, full_name: editData.full_name, email: editData.email, role: editData.role, username: editData.username, public_creator_id: editData.public_creator_id }
        : x));
      setShowEditModal(false);
      fetchAllUsers();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to update user'));
    }
  };

  // Ban / unban runs through an in-app modal (BanModal) instead of window.confirm,
  // so the ban reason is captured in a real form and the copy matches the admin UI.
  const openBan = (u) => setBanTarget({ user: u, banned: isInactive(u) });

  const confirmBan = async (reason) => {
    const { user: u, banned: currentlyBanned } = banTarget;
    const action_ = currentlyBanned ? 'unban' : 'ban';
    try {
      await axios.post(`${API}/admin/user/ban`, {
        user_id: u.id,
        banned: !currentlyBanned,
        ban_reason: currentlyBanned ? null : reason,
      });
      toast.success(`User ${action_}ned successfully`);
      // Reflect immediately (banned ⇒ active:false), then reconcile.
      setAllUsers((prev) => prev.map((x) => x.id === u.id
        ? { ...x, banned: !currentlyBanned, active: currentlyBanned }
        : x));
      setBanTarget(null);
      fetchAllUsers();
    } catch (e) {
      toast.error(apiErrorMessage(e, `Failed to ${action_} user`));
    }
  };

  // Best-effort POST: works against live endpoints (ban/wallet/broadcast/update); for
  // moderation endpoints still being built out, treat "not implemented" as recorded so
  // the admin flow stays usable. Real server errors still surface.
  const adminPost = async (url, body, successMsg) => {
    try {
      await axios.post(`${API}${url}`, body);
      toast.success(successMsg);
      return true;
    } catch (e) {
      // Surface real failures — a missing route (404/405) should NOT fake success,
      // otherwise a broken action looks like it worked (e.g. the old announce bug).
      toast.error(apiErrorMessage(e, 'Action failed'));
      return false;
    }
  };

  // One click from the table row: pick or un-pick a creator for the brand side
  // "Preferred Creators by the UGCAD Team" collection. Shows at once and undoes itself on failure.
  const toggleUgcadApproved = async (u) => {
    const next = !u.ugcad_approved;
    const setFlag = (value) => setAllUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ugcad_approved: value } : x)));
    setFlag(next);
    const ok = await adminPost('/admin/user/ugcad-approved', { user_id: u.id, approved: next },
      next ? 'Marked as UGCAD preferred' : 'Removed from UGCAD preferred');
    if (!ok) setFlag(!next);
  };

  // ---- filtering ---------------------------------------------------------------
  const q = searchTerm.trim().toLowerCase();
  const qNoHash = q.replace(/^[#@]/, '');

  const categories = useMemo(() => {
    const set = new Set();
    allUsers.forEach((u) => { const c = category(u); if (c && c !== '-') set.add(c); });
    return Array.from(set).sort();
  }, [allUsers]);

  const filtered = useMemo(() => allUsers.filter((u) => {
    if (tab === 'creators' && !isCreator(u)) return false;
    if (tab === 'brands' && !isBrand(u)) return false;
    if (tab === 'admins' && !isAdmin(u)) return false;
    if (stateFilter && userState(u) !== stateFilter) return false;
    if (categoryFilter && category(u) !== categoryFilter) return false;
    if (flaggedOnly && !isFlagged(u)) return false;
    if (formNotFilled && u.profile_completed) return false;
    if (verifyFilter && (u.approval_status || 'approved') !== verifyFilter) return false;
    if (walletMin !== '' && Number(u.balance || 0) < Number(walletMin)) return false;
    if (walletMax !== '' && Number(u.balance || 0) > Number(walletMax)) return false;
    if (!q) return true;
    const hay = [
      u.public_creator_id, u.username, u.nickname, u.email, realName(u), phone(u),
      businessName(u), legalName(u), gstin(u),
    ].map((x) => String(x || '').toLowerCase());
    return hay.some((h) => h.includes(q) || h.replace(/^[#@]/, '').includes(qNoHash));
  }), [allUsers, tab, stateFilter, categoryFilter, flaggedOnly, formNotFilled, verifyFilter, walletMin, walletMax, q, qNoHash]);

  // ---- bulk selection ----------------------------------------------------------
  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allVisibleSelected = filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id));
  const toggleSelectAll = () => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (allVisibleSelected) filtered.forEach((u) => next.delete(u.id));
    else filtered.forEach((u) => next.add(u.id));
    return next;
  });
  const selectedUsers = useMemo(() => filtered.filter((u) => selectedIds.has(u.id)), [filtered, selectedIds]);

  const exportSelected = () => {
    const rows = selectedUsers.length ? selectedUsers : filtered;
    if (!rows.length) return toast.error('Nothing to export');
    const cols = ['id', 'handle', 'name', 'email', 'phone', 'role', 'category', 'state', 'balance', 'strikes'];
    const csv = [cols.join(',')].concat(
      rows.map((u) => [
        u.id, handleOf(u), isBrand(u) ? businessName(u) : realName(u), u.email, phone(u),
        u.role, category(u), userState(u), u.balance || 0, strikes(u).length,
      ].map((c) => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `users-${rows.length}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`Exported ${rows.length} user${rows.length === 1 ? '' : 's'}`);
  };

  // ---- per-user activity (filtered from the global lists) ----------------------
  const userDeals = useCallback((u) => {
    if (!deals) return [];
    const handles = [u.username, u.public_creator_id, u.nickname].filter(Boolean).map((h) => String(h).toLowerCase());
    return deals.filter((d) => handles.includes(String(d.creator_handle || '').toLowerCase()) || handles.includes(String(d.brand_handle || '').toLowerCase()));
  }, [deals]);
  const userDisputes = useCallback((u) => {
    if (!disputes) return [];
    const id = String(u.id);
    return disputes.filter((d) => String(d.creator_id) === id || String(d.business_id) === id);
  }, [disputes]);

  const counts = {
    total: allUsers.length,
    creators: allUsers.filter(isCreator).length,
    brands: allUsers.filter(isBrand).length,
    flagged: allUsers.filter(isFlagged).length,
    banned: allUsers.filter((u) => userState(u) === 'banned').length,
    formNotFilled: allUsers.filter((u) => !u.profile_completed).length,
  };

  // ===================== Phone (PWA) layout =====================
  if (isPhone) {
    const dirs = [
      ['all', 'All', counts.total], ['creators', 'Creators', counts.creators],
      ['brands', 'Brands', counts.brands], ['admins', 'Admins', allUsers.filter(isAdmin).length],
    ];
    const filterCount = [stateFilter, verifyFilter, categoryFilter, walletMin !== '', walletMax !== '', flaggedOnly, formNotFilled].filter(Boolean).length;
    const openFilters = () => {
      setFilterDraft({ state: stateFilter, verify: verifyFilter, category: categoryFilter, walletMin, walletMax, flagged: flaggedOnly, formNotFilled });
      setPhoneSheet('filters');
    };
    const applyFilters = () => {
      setStateFilter(filterDraft.state); setVerifyFilter(filterDraft.verify); setCategoryFilter(filterDraft.category);
      setWalletMin(filterDraft.walletMin); setWalletMax(filterDraft.walletMax);
      setFlaggedOnly(filterDraft.flagged); setFormNotFilled(filterDraft.formNotFilled);
      setPhoneSheet(null);
    };
    const draft = (key) => (e) => setFilterDraft((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
    const clearAll = () => {
      setSearchTerm(''); setStateFilter(''); setVerifyFilter(''); setCategoryFilter('');
      setWalletMin(''); setWalletMax(''); setFlaggedOnly(false); setFormNotFilled(false);
    };
    const openPhoneDetail = (u) => { setRevealContact(false); setPhoneSheet(null); openDetail(u); };
    const closePhoneDetail = () => { setPhoneSheet(null); setDetailUser(null); };
    const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()); };
    const saveEdit = async () => {
      if (editSaving) return;
      setEditSaving(true);
      await handleUpdate();
      setEditSaving(false);
    };
    const du = detailUser;
    const moreActions = du && !isAdmin(du) ? [
      caps.warnSuspend && { key: 'warn', Icon: AlertTriangle, label: 'Warn', run: () => setAction({ type: 'warn', user: du }) },
      caps.warnSuspend && (du.suspended || du.status === 'suspended') && { key: 'unsuspend', Icon: ShieldCheck, label: 'Unsuspend', run: () => setAction({ type: 'unsuspend', user: du }) },
      caps.warnSuspend && { key: 'suspend', Icon: ShieldAlert, label: 'Suspend', danger: true, run: () => setAction({ type: 'suspend', user: du }) },
      caps.ban && { key: 'ban', Icon: Ban, label: isInactive(du) ? 'Unban' : 'Ban', danger: !isInactive(du), run: () => openBan(du) },
      isBrand(du) && caps.financialPolicy && { key: 'commission', Icon: Percent, label: 'Adjust commission', run: () => setAction({ type: 'commission', user: du }) },
      isBrand(du) && caps.wallet && { key: 'wallet', Icon: Wallet, label: 'Adjust wallet', run: () => setAction({ type: 'wallet', user: du }) },
      isCreator(du) && caps.userMgmt && { key: 'ugcad', Icon: BadgeCheck, label: du.ugcad_approved ? 'Remove UGCAD preferred' : 'Mark UGCAD preferred', run: () => setAction({ type: du.ugcad_approved ? 'ugcadUnapprove' : 'ugcadApprove', user: du }) },
      isCreator(du) && caps.userMgmt && { key: 'promote', Icon: ArrowUpCircle, label: 'Promote level', run: () => setAction({ type: 'promote', user: du }) },
      isCreator(du) && caps.userMgmt && { key: 'demote', Icon: ArrowDownCircle, label: 'Demote level', run: () => setAction({ type: 'demote', user: du }) },
      isCreator(du) && caps.userMgmt && { key: 'payout', Icon: CalendarClock, label: 'Payout schedule', run: () => setAction({ type: 'payout', user: du }) },
      { key: 'message', Icon: MessageSquare, label: 'Send message', run: () => setAction({ type: 'message', user: du }) },
      { key: 'edit', Icon: Pencil, label: 'Edit user', run: () => handleEdit(du) },
      caps.ban && { key: 'delete', Icon: Trash2, label: 'Delete user', danger: true, run: () => setAction({ type: 'delete', user: du }) },
    ].filter(Boolean) : [];

    return (
      <AdminLayout>
        <div className={`am amu${selectMode ? ' amu-selecting' : ''}`} data-testid="users-phone">
          {assignedCats !== null && (
            <div className="amu-assigned">
              {assignedCats.length
                ? <>Your categories: <span className="am-badges">{assignedCats.map((c) => <span key={c} className="am-badge am-badge--info">{c}</span>)}</span></>
                : 'No categories assigned to you yet - ask the founder to assign some on the Team & Roles page.'}
            </div>
          )}

          <div className="am-toolbar">
            <label className="am-search">
              <Search size={18} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={tab === 'brands' ? 'Search business, legal name, GST, email' : 'Search handle, name, email, phone'}
                aria-label="Search users"
                data-testid="users-search-input"
              />
              {searchTerm && <button type="button" className="am-search-clear" onClick={() => setSearchTerm('')} aria-label="Clear search"><X size={18} /></button>}
            </label>
            <button type="button" className="am-filter-btn" onClick={openFilters} aria-label={filterCount ? `Filters, ${filterCount} active` : 'Filters'} data-testid="users-filter-btn">
              <SlidersHorizontal size={20} />
              {filterCount > 0 && <span className="am-dot">{filterCount}</span>}
            </button>
          </div>

          <div className="am-chips" role="group" aria-label="Directory">
            {dirs.map(([k, label, n]) => (
              <button key={k} type="button" className={`am-chip${tab === k ? ' is-active' : ''}`} aria-pressed={tab === k} onClick={() => { setTab(k); setStateFilter(''); setCategoryFilter(''); setVerifyFilter(''); }}>
                {label} <span className="am-chip-count">{n}</span>
              </button>
            ))}
          </div>

          <div className="am-tiles am-tiles--3">
            <button type="button" className="am-tile am-tile--wait" aria-pressed={flaggedOnly} onClick={() => setFlaggedOnly((v) => !v)}>
              <span className="am-tile-top"><Flag size={16} /> Flagged</span><span className="am-tile-value">{counts.flagged}</span>
            </button>
            <button type="button" className="am-tile" aria-pressed={stateFilter === 'banned'} onClick={() => setStateFilter((s) => (s === 'banned' ? '' : 'banned'))}>
              <span className="am-tile-top"><Ban size={16} /> Banned</span><span className="am-tile-value">{counts.banned}</span>
            </button>
            <button type="button" className="am-tile am-tile--info" aria-pressed={formNotFilled} onClick={() => setFormNotFilled((v) => !v)}>
              <span className="am-tile-top"><AlertTriangle size={16} /> Form not filled</span><span className="am-tile-value">{counts.formNotFilled}</span>
            </button>
          </div>

          <div className="amu-listhead">
            {selectMode ? (
              <label className="amu-selectall">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} /> Select all {filtered.length} shown
              </label>
            ) : (
              <span className="am-muted">{filtered.length} user{filtered.length === 1 ? '' : 's'} shown</span>
            )}
            {!selectMode && (
              <span className="amu-listhead-actions">
                <button type="button" className="am-btn am-btn--link am-btn--sm" onClick={exportSelected}><Download size={16} /> Export</button>
                <button type="button" className="am-btn am-btn--secondary am-btn--sm" onClick={() => setSelectMode(true)} data-testid="users-select-btn"><CheckSquare size={16} /> Select</button>
              </span>
            )}
          </div>

          {loading && allUsers.length === 0 ? (
            <SkeletonList rows={6} />
          ) : filtered.length === 0 ? (
            <div className="am-empty">
              <p>{searchTerm ? `No users match "${searchTerm}"` : 'No users found'}</p>
              {(searchTerm || filterCount > 0) && <button type="button" className="am-btn am-btn--link" onClick={clearAll}>Clear search and filters</button>}
            </div>
          ) : (
            <div className="am-list">
              {filtered.map((u) => {
                const inner = (
                  <>
                    <span className="am-card-head">
                      {selectMode && <input type="checkbox" className="amu-check" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} aria-label={`Select ${nameOf(u)}`} />}
                      <PhoneAvatar u={u} />
                      <span className="am-card-main">
                        <span className="am-card-title">{nameOf(u)}</span>
                        <span className="am-card-sub">{maskEmail(u.email)}</span>
                      </span>
                      {!selectMode && <ChevronRight size={20} className="am-row-chevron" />}
                    </span>
                    <UserBadges u={u} />
                    <span className="am-card-foot">
                      <span className="amu-amount">
                        <span className="am-amount-label">Wallet balance</span>
                        <span className="am-amount">{money(u.balance)}</span>
                      </span>
                      <span className="am-card-sub">{handleOf(u)}</span>
                    </span>
                  </>
                );
                return selectMode ? (
                  <label key={u.id} className={`am-card amu-card-select${selectedIds.has(u.id) ? ' is-selected' : ''}`} data-testid={`user-card-${u.id}`}>{inner}</label>
                ) : (
                  <button key={u.id} type="button" className={`am-card${userState(u) === 'banned' ? ' amu-card-banned' : ''}`} onClick={() => openPhoneDetail(u)} data-testid={`user-card-${u.id}`}>{inner}</button>
                );
              })}
            </div>
          )}

          {selectMode && (
            <div className="am-actionbar amu-bulkbar" data-testid="users-bulkbar">
              <div className="amu-bulk-head">
                <strong>{selectedUsers.length} selected</strong>
                <button type="button" className="am-btn am-btn--link am-btn--sm" onClick={exitSelect}>Done</button>
              </div>
              <div className="am-actionbar-row">
                <button type="button" className="am-btn am-btn--secondary am-btn--sm" onClick={exportSelected}><Download size={16} /> Export</button>
                <button type="button" className="am-btn am-btn--primary am-btn--sm" disabled={!selectedUsers.length} onClick={() => setAction({ type: 'announce', users: selectedUsers })} data-testid="users-announce-btn"><Send size={16} /> Announce</button>
                <button type="button" className="am-btn am-btn--danger am-btn--sm" disabled={!selectedUsers.length} onClick={() => setAction({ type: 'delete', users: selectedUsers })}><Trash2 size={16} /> Delete</button>
              </div>
            </div>
          )}

          {du && (
            <PhoneUserDetail
              u={du}
              onBack={closePhoneDetail}
              onMore={() => setPhoneSheet('more')}
              onEdit={() => handleEdit(du)}
              onAction={(type) => setAction({ type, user: du })}
              deals={userDeals(du)}
              disputes={userDisputes(du)}
              brandCampaigns={brandCampaigns}
              activityLoading={deals === null || disputes === null}
              onOpenDeal={(campaignId) => { setDetailUser(null); navigate(`/dashboard/admin/deals?deal=${campaignId}`); }}
              revealBank={revealBank}
              setRevealBank={setRevealBank}
              revealContact={revealContact}
              setRevealContact={setRevealContact}
            />
          )}

          {showEditModal && selectedUser && (
            <div className="am-detail" role="dialog" aria-modal="true" aria-label="Edit user" data-testid="user-edit">
              <header className="am-detail-head">
                <button type="button" className="am-icon-btn" onClick={() => setShowEditModal(false)} disabled={editSaving} aria-label="Cancel editing"><ArrowLeft size={22} /></button>
                <h1>Edit user</h1>
              </header>
              <div className="am-detail-body">
                <p className="am-muted">{nameOf(selectedUser)} · {typeLabel(selectedUser)}</p>
                <div className="am-field">
                  <label htmlFor="amu-edit-name">Full name</label>
                  <input id="amu-edit-name" type="text" value={editData.full_name} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} />
                </div>
                <div className="am-field">
                  <label htmlFor="amu-edit-username">Username (@handle)</label>
                  <input id="amu-edit-username" type="text" autoCapitalize="none" value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} placeholder="username" />
                </div>
                <div className="am-field">
                  <label htmlFor="amu-edit-id">User ID</label>
                  <input id="amu-edit-id" type="text" autoCapitalize="none" value={editData.public_creator_id} onChange={(e) => setEditData({ ...editData, public_creator_id: e.target.value })} placeholder="public id" />
                </div>
                <div className="am-field">
                  <label htmlFor="amu-edit-email">Email</label>
                  <input id="amu-edit-email" type="email" autoCapitalize="none" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                </div>
              </div>
              <div className="am-actionbar">
                <div className="am-actionbar-row">
                  <button type="button" className="am-btn am-btn--secondary" disabled={editSaving} onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="button" className="am-btn am-btn--primary" disabled={editSaving} onClick={saveEdit} data-testid="user-edit-save">{editSaving ? 'Saving…' : 'Save changes'}</button>
                </div>
              </div>
            </div>
          )}

          {phoneSheet === 'filters' && (
            <PhoneSheet
              title="Filters"
              onClose={() => setPhoneSheet(null)}
              testId="users-filter-sheet"
              foot={(
                <>
                  <button type="button" className="am-btn am-btn--secondary" onClick={() => setFilterDraft(EMPTY_PHONE_FILTERS)}>Reset</button>
                  <button type="button" className="am-btn am-btn--primary" onClick={applyFilters} data-testid="users-filter-apply">Apply</button>
                </>
              )}
            >
              {tab !== 'brands' ? (
                <div className="am-field">
                  <label htmlFor="amu-f-state">Account state</label>
                  <select id="amu-f-state" value={filterDraft.state} onChange={draft('state')}>
                    <option value="">All states</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              ) : (
                <div className="am-field">
                  <label htmlFor="amu-f-verify">Verification</label>
                  <select id="amu-f-verify" value={filterDraft.verify} onChange={draft('verify')}>
                    <option value="">All</option>
                    <option value="approved">Verified</option>
                    <option value="pending">Pending</option>
                    <option value="more_info">More info</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              )}
              <div className="am-field">
                <label htmlFor="amu-f-cat">Category</label>
                <select id="amu-f-cat" value={filterDraft.category} onChange={draft('category')}>
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {tab === 'brands' && (
                <div className="amu-range">
                  <div className="am-field">
                    <label htmlFor="amu-f-min">Wallet min (₹)</label>
                    <input id="amu-f-min" type="number" inputMode="decimal" value={filterDraft.walletMin} onChange={draft('walletMin')} />
                  </div>
                  <div className="am-field">
                    <label htmlFor="amu-f-max">Wallet max (₹)</label>
                    <input id="amu-f-max" type="number" inputMode="decimal" value={filterDraft.walletMax} onChange={draft('walletMax')} />
                  </div>
                </div>
              )}
              <label className="amu-toggle">
                <input type="checkbox" checked={filterDraft.flagged} onChange={draft('flagged')} />
                <span>Flagged only <small>Users with chat-filter strikes</small></span>
              </label>
              <label className="amu-toggle">
                <input type="checkbox" checked={filterDraft.formNotFilled} onChange={draft('formNotFilled')} />
                <span>Form not filled <small>Signed up, never submitted profile setup</small></span>
              </label>
            </PhoneSheet>
          )}

          {du && phoneSheet === 'more' && (
            <PhoneSheet title="User actions" onClose={() => setPhoneSheet(null)} testId="user-more-sheet">
              <ul className="am-rows">
                {moreActions.map(({ key, Icon, label, danger, run }) => (
                  <li key={key}>
                    <button type="button" className={`am-row${danger ? ' amu-row--danger' : ''}`} onClick={() => { setPhoneSheet(null); run(); }} data-testid={`user-action-${key}`}>
                      <Icon size={20} /><span className="am-row-label">{label}</span><ChevronRight size={18} className="am-row-chevron" />
                    </button>
                  </li>
                ))}
              </ul>
            </PhoneSheet>
          )}

          {action && (
            <ActionModal
              phone
              action={action}
              onClose={() => setAction(null)}
              onDone={() => {
                if (action.users) setSelectMode(false);
                if (action.type === 'delete' && action.user) setDetailUser(null);
                setAction(null); fetchAllUsers(); setSelectedIds(new Set());
              }}
              adminPost={adminPost}
            />
          )}

          {banTarget && <BanModal phone target={banTarget} onClose={() => setBanTarget(null)} onConfirm={confirmBan} />}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="au-container">
        <div className="au-header">
          <div>
            <h1><Users size={26} /> {heading}</h1>
            <p>{subheading}</p>
            {/* Only shown on the scoped "My Users" view. */}
            {assignedCats !== null && (
              <p className="au-assigned">
                {assignedCats.length
                  ? <>Your categories: {assignedCats.map((c) => <span key={c} className="au-badge">{c}</span>)}</>
                  : 'No categories assigned to you yet - ask the founder to assign some on the Team & Roles page.'}
              </p>
            )}
          </div>
          <div className="au-stats">
            <div className="au-stat"><span>Total</span><strong>{counts.total}</strong></div>
            <div className="au-stat"><span>Creators</span><strong>{counts.creators}</strong></div>
            <div className="au-stat"><span>Brands</span><strong>{counts.brands}</strong></div>
            <div className="au-stat au-stat-flag"><span>Flagged</span><strong>{counts.flagged}</strong></div>
            <div className="au-stat"><span>Banned</span><strong>{counts.banned}</strong></div>
            <div className="au-stat"><span>Form Not Filled</span><strong>{counts.formNotFilled}</strong></div>
          </div>
        </div>

        {/* directory tabs */}
        <div className="au-tabs">
          {[['all', 'All'], ['creators', 'Creator Directory'], ['brands', 'Brand Directory'], ['admins', 'Admin Directory']].map(([k, label]) => (
            <button key={k} type="button" className={tab === k ? 'active' : ''} onClick={() => { setTab(k); setStateFilter(''); setCategoryFilter(''); setVerifyFilter(''); }}>
              {label}
            </button>
          ))}
        </div>

        {/* filter bar */}
        <div className="au-toolbar">
          <div className="au-search-wrap">
            <Search size={16} className="au-search-icon" />
            <input
              type="text"
              className="au-search-input"
              placeholder={tab === 'brands'
                ? 'Search business name, legal name, GST, email…'
                : 'Search handle, real name, email, phone…'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="users-search-input"
            />
            {searchTerm && <button type="button" className="au-search-clear" onClick={() => setSearchTerm('')}>×</button>}
          </div>

          <div className="au-filters">
            {tab !== 'brands' && (
              <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} title="State">
                <option value="">State: All</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
            )}
            {tab === 'brands' && (
              <select value={verifyFilter} onChange={(e) => setVerifyFilter(e.target.value)} title="Verification">
                <option value="">Verification: All</option>
                <option value="approved">Verified</option>
                <option value="pending">Pending</option>
                <option value="more_info">More info</option>
                <option value="rejected">Rejected</option>
              </select>
            )}
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} title="Category">
              <option value="">Category: All</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {tab === 'brands' && (
              <span className="au-wallet-range">
                <Wallet size={13} />
                <input type="number" placeholder="min ₹" value={walletMin} onChange={(e) => setWalletMin(e.target.value)} />
                <input type="number" placeholder="max ₹" value={walletMax} onChange={(e) => setWalletMax(e.target.value)} />
              </span>
            )}
            <button type="button" className={`au-flag-toggle ${flaggedOnly ? 'on' : ''}`} onClick={() => setFlaggedOnly((v) => !v)}>
              <Flag size={13} /> Flagged
            </button>
            {/* Signed up but never submitted the profile-setup form — same set the
                24h/48h onboarding-reminder emails target (server.py). */}
            <button type="button" className={`au-flag-toggle ${formNotFilled ? 'on' : ''}`} onClick={() => setFormNotFilled((v) => !v)}>
              <AlertTriangle size={13} /> Form not filled
            </button>
          </div>
        </div>

        {/* bulk action bar */}
        <div className="au-bulkbar">
          <span className="au-bulk-count">{selectedIds.size} selected · {filtered.length} shown</span>
          <div className="au-bulk-actions">
            <button type="button" onClick={exportSelected}><Download size={14} /> Export {selectedUsers.length ? 'selected' : 'list'}</button>
            <button
              type="button"
              disabled={!selectedUsers.length}
              onClick={() => setAction({ type: 'announce', users: selectedUsers })}
            >
              <Send size={14} /> Announce to selected
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                className="au-bulk-delete"
                disabled={!selectedUsers.length}
                onClick={() => setAction({ type: 'delete', users: selectedUsers })}
              >
                <Trash2 size={14} /> Delete selected
              </button>
            )}
          </div>
        </div>

        <div className="au-table-wrap">
          <table className="au-table">
            <thead>
              <tr>
                <th className="au-check-col"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Select all" /></th>
                {/* Real name / GST, State, Category and Flags moved into the eye (details)
                    panel — the table was too dense to scan. */}
                <th>{tab === 'brands' ? 'Business' : 'Handle / Creator ID'}</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Role</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 7 }).map((_, r) => (
                  <tr key={`sk-${r}`}>
                    {Array.from({ length: 7 }).map((_, c) => (
                      <td key={c}><Skeleton height={13} width={c === 0 ? '75%' : '55%'} /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="au-empty-row">{searchTerm ? `No users match "${searchTerm}"` : 'No users found'}</td></tr>
              ) : (
                filtered.map((u) => {
                  const st = userState(u);
                  return (
                    <tr key={u.id} className={st === 'banned' ? 'au-row-banned' : ''} data-testid={`user-row-${u.id}`}>
                      <td className="au-check-col"><input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} aria-label="Select user" /></td>
                      <td>
                        <button type="button" className="au-primary au-link" onClick={() => openDetail(u)}>
                          {isBrand(u) ? businessName(u) : displayName(u)}
                        </button>
                        {st === 'banned' && <span className="au-ban-badge">BANNED</span>}
                      </td>
                      <td>{u.email}</td>
                      <td>{phone(u)}</td>
                      <td>
                        <span className="au-badge">{isBrand(u) ? 'brand' : (isAdmin(u) ? 'admin' : u.role)}</span>
                        {isCreator(u) && (
                          <span className="au-badge au-badge-level" title="Creator level">
                            {levelLabelOf(u.level_key ?? u.level)}
                          </span>
                        )}
                        {isCreator(u) && u.ugcad_approved && (
                          <span className="au-badge au-badge-ugcad" title="Shown in the UGCAD Preferred collection">UGCAD preferred</span>
                        )}
                        {isAdmin(u) && u.admin_role && (
                          <span className="au-badge au-badge-admin" title="Admin role">
                            {ROLE_LABELS[normalizeRole(u.admin_role)] || 'Admin'}
                          </span>
                        )}
                      </td>
                      <td>{money(u.balance)}</td>
                      <td>
                        <div className="au-actions">
                          <button className="au-btn au-btn-view" onClick={() => openDetail(u)} title="View profile"><Eye size={14} /></button>
                          {isCreator(u) && caps.userMgmt && (
                            <button
                              className={`au-btn au-btn-ugcad${u.ugcad_approved ? ' on' : ''}`}
                              onClick={() => toggleUgcadApproved(u)}
                              aria-pressed={!!u.ugcad_approved}
                              title={u.ugcad_approved ? 'UGCAD preferred: click to remove' : 'Mark UGCAD preferred'}
                            ><BadgeCheck size={14} /></button>
                          )}
                          <button className="au-btn au-btn-edit" onClick={() => handleEdit(u)}>Edit</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- edit modal (kept) ---- */}
      {showEditModal && selectedUser && (
        <div className="au-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="au-modal" onClick={(e) => e.stopPropagation()}>
            <div className="au-modal-head">
              <h2>Edit User</h2>
              <button onClick={() => setShowEditModal(false)}><X size={20} /></button>
            </div>
            <div className="au-modal-body">
              <label>Full Name<input type="text" value={editData.full_name} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} /></label>
              <label>Username (@handle)<input type="text" value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} placeholder="username" /></label>
              <label>User ID<input type="text" value={editData.public_creator_id} onChange={(e) => setEditData({ ...editData, public_creator_id: e.target.value })} placeholder="public id" /></label>
              <label>Email<input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} /></label>
            </div>
            <div className="au-modal-actions">
              <button className="au-btn au-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="au-btn au-btn-primary" onClick={handleUpdate}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- profile detail drawer (admin view, spec 11.10) ---- */}
      {detailUser && (
        <ProfileDetail
          u={detailUser}
          onClose={() => setDetailUser(null)}
          tab={detailTab}
          setTab={setDetailTab}
          revealBank={revealBank}
          setRevealBank={setRevealBank}
          deals={userDeals(detailUser)}
          disputes={userDisputes(detailUser)}
          brandCampaigns={brandCampaigns}
          onOpenDeal={(campaignId) => { setDetailUser(null); navigate(`/dashboard/admin/deals?deal=${campaignId}`); }}
          activityLoading={deals === null || disputes === null}
          onAction={(type) => setAction({ type, user: detailUser })}
          onBan={() => openBan(detailUser)}
          banned={isInactive(detailUser)}
          caps={caps}
        />
      )}

      {/* ---- generic action modal ---- */}
      {action && (
        <ActionModal
          action={action}
          onClose={() => setAction(null)}
          onDone={() => { setAction(null); fetchAllUsers(); setSelectedIds(new Set()); }}
          adminPost={adminPost}
        />
      )}

      {/* ---- ban / unban confirmation ---- */}
      {banTarget && (
        <BanModal
          target={banTarget}
          onClose={() => setBanTarget(null)}
          onConfirm={confirmBan}
        />
      )}

      <style>{`
        .au-container { padding: 32px 40px; max-width: 1560px; margin: 0 auto; }
        .au-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 20px; flex-wrap: wrap; }
        .au-header h1 { display: flex; align-items: center; gap: 12px; font-size: var(--fs-h1); font-weight: var(--fw-head); color: #07074e; margin: 0 0 6px; }
        .au-header h1 :global(svg) { color: #07074e; }
        .au-header p { color: #718096; margin: 0; font-size: 0.95rem; }
        .au-stats { display: flex; gap: 12px; flex-wrap: wrap; }
        .au-stat { background: white; border: 1.5px solid #e8ecff; padding: 12px 18px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; min-width: 84px; }
        .au-stat span { font-size: 0.72rem; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .au-stat strong { font-size: 1.3rem; color: #07074e; margin-top: 4px; }
        .au-stat-flag strong { color: #b42318; }

        .au-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .au-tabs button { padding: 8px 16px; border: 1.5px solid #e2e8f0; background: white; border-radius: 999px; font-weight: 600; font-size: 0.85rem; color: #4a5568; cursor: pointer; }
        .au-tabs button.active { background: #07074e; color: white; border-color: #07074e; }

        .au-toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
        .au-search-wrap { position: relative; flex: 1; min-width: 280px; max-width: 460px; }
        .au-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
        .au-search-input { width: 100%; padding: 11px 38px 11px 40px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 0.9rem; background: white; }
        .au-search-input:focus { outline: none; border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,0.16); }
        .au-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 22px; height: 22px; border: none; background: #e2e8f0; color: #4a5568; border-radius: 50%; cursor: pointer; }
        .au-filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .au-filters select { padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 0.82rem; background: white; color: #2d3748; cursor: pointer; }
        .au-level-pill { padding: 8px 12px; border: 1.5px dashed #c7d0ff; border-radius: 9px; font-size: 0.78rem; color: #5a4ff3; background: #f6f7ff; font-weight: 600; }
        .au-wallet-range { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border: 1.5px solid #e2e8f0; border-radius: 9px; background: white; color: #94a3b8; }
        .au-wallet-range input { width: 66px; border: none; outline: none; font-size: 0.8rem; padding: 4px; }
        .au-flag-toggle { display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; border: 1.5px solid #e2e8f0; border-radius: 9px; background: white; font-size: 0.8rem; font-weight: 600; color: #4a5568; cursor: pointer; }
        .au-flag-toggle.on { background: #fff1f0; border-color: #fecaca; color: #b42318; }

        .au-bulkbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .au-bulk-count { font-size: 0.82rem; color: #718096; }
        .au-bulk-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .au-bulk-actions button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 13px; border: 1.5px solid #e2e8f0; background: white; border-radius: 9px; font-size: 0.8rem; font-weight: 600; color: #4a5568; cursor: pointer; }
        .au-bulk-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
        .au-bulk-clear { color: #b42318 !important; }
        .au-bulk-delete { color: #b42318 !important; border-color: #f2b8c6 !important; background: #fff5f8 !important; }
        .au-bulk-delete:hover:not(:disabled) { background: #ffe4ec !important; }

        .au-table-wrap { background: white; border: 1.5px solid #e8ecff; border-radius: 14px; overflow-x: auto; }
        .au-table { width: 100%; border-collapse: collapse; }
        .au-table th, .au-table td { padding: 13px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
        .au-table th { background: #f8f9ff; font-size: 0.74rem; font-weight: 700; color: #4a5568; text-transform: uppercase; letter-spacing: 0.04em; }
        .au-table td { font-size: 0.86rem; color: #1a202c; }
        .au-check-col { width: 34px; }
        .au-row-banned { background: #fef2f2; }
        .au-primary { font-weight: 700; color: #07074e; }
        .au-link { background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: #07074e; }
        .au-link:hover { color: #5b6bff; text-decoration: underline; }
        .au-mono { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.82rem; color: #4a5568; }
        .au-muted { color: #cbd5e0; }
        .au-ban-badge { display: inline-block; margin-left: 8px; font-size: 0.62rem; font-weight: 700; padding: 2px 7px; background: #991b1b; color: white; border-radius: 4px; }
        .au-badge { font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: #eef2ff; color: #1e1e7e; text-transform: capitalize; }
        .au-badge-level { margin-left: 6px; background: #f0fdf4; color: #15803d; }
        .au-badge-admin { margin-left: 6px; background: #fef3c7; color: #92400e; }
        .au-badge-ugcad { margin-left: 6px; background: #dcfce7; color: #166534; }
        .aud-actions-note { font-size: 0.78rem; color: #94a3b8; align-self: center; }
        .au-state-active { background: #dcfce7; color: #166534; }
        .au-state-suspended { background: #fef3c7; color: #92400e; }
        .au-state-banned { background: #fee2e2; color: #991b1b; }
        .au-strike-pill { display: inline-block; min-width: 22px; text-align: center; font-size: 0.72rem; font-weight: 700; padding: 2px 7px; background: #fff1f0; color: #b42318; border: 1px solid #fecaca; border-radius: 999px; }
        .au-empty-row { text-align: center; padding: 40px !important; color: #94a3b8; font-style: italic; }
        .au-actions { display: flex; gap: 6px; }
        .au-btn { padding: 6px 12px; border: none; border-radius: 8px; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 5px; }
        .au-btn-view { background: #f1f5f9; color: #475569; padding: 6px 9px; }
        .au-btn-view:hover { background: #e2e8f0; }
        .au-btn-edit { background: #eef2ff; color: #1e1e7e; }
        .au-btn-edit:hover { background: #e0e7ff; }
        .au-btn-ban { background: #fee2e2; color: #991b1b; }
        .au-btn-ban:hover { background: #fecaca; }
        .au-btn-unban { background: #dcfce7; color: #166534; }
        .au-btn-unban:hover { background: #bbf7d0; }
        .au-btn-ugcad { background: #f1f5f9; color: #94a3b8; padding: 6px 9px; }
        .au-btn-ugcad:hover { background: #e2e8f0; color: #475569; }
        .au-btn-ugcad.on { background: #dcfce7; color: #166534; }
        .au-btn-ugcad.on:hover { background: #bbf7d0; }
        .au-btn-primary { background: linear-gradient(100deg,#12124f,#07074e); color: #fff; padding: 10px 18px; font-size: 0.9rem; box-shadow: 0 12px 26px -12px rgba(7,7,78,.7); }
        .au-btn-primary:hover { background: #2e2e94; }
        .au-btn-secondary { background: #e2e8f0; color: #4a5568; padding: 10px 18px; font-size: 0.9rem; }
        .au-btn-secondary:hover { background: #cbd5e0; }

        .au-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1300; padding: 20px; }
        .au-modal { background: white; border-radius: 16px; max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto; }
        .au-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1.5px solid #e8ecff; }
        .au-modal-head h2 { margin: 0; font-size: var(--fs-h2); color: #07074e; }
        .au-modal-head button { background: none; border: none; cursor: pointer; color: #4a5568; }
        .au-modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
        .au-modal-body label { display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; font-weight: 600; color: #2d3748; }
        .au-modal-body input, .au-modal-body select, .au-modal-body textarea { padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; font-family: inherit; }
        .au-modal-body input:focus, .au-modal-body select:focus, .au-modal-body textarea:focus { outline: none; border-color: #5b6bff; }
        .au-modal-actions { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1.5px solid #e8ecff; }

        /* ban / unban confirmation modal */
        .au-ban { max-width: 460px; overflow: visible; }
        .au-ban-body { padding: 26px 26px 22px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; }
        .au-ban-icon { width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; }
        .au-ban-icon.danger { background: #fdeaea; color: #d64545; }
        .au-ban-icon.ok { background: #e6f6ec; color: #16a34a; }
        .au-ban-body h2 { margin: 0; font-size: var(--fs-h2); color: #07074e; }
        .au-ban-sub { margin: 0; font-size: 0.88rem; color: #64748b; line-height: 1.5; }
        .au-ban-user { display: flex; align-items: center; gap: 10px; width: 100%; margin-top: 4px; padding: 10px 14px; border: 1.5px solid #e8ecff; border-radius: 10px; background: #f7f8ff; text-align: left; }
        .au-ban-user .au-ban-av { width: 34px; height: 34px; border-radius: 50%; background: #5b6bff; color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 0.85rem; flex: none; }
        .au-ban-user b { display: block; font-size: 0.9rem; color: #07074e; }
        .au-ban-user span { display: block; font-size: 0.78rem; color: #718096; }
        .au-ban-field { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
        .au-ban-field label { font-size: 0.82rem; font-weight: 600; color: #2d3748; }
        .au-ban-field textarea { padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; font-family: inherit; resize: vertical; }
        .au-ban-field textarea:focus { outline: none; border-color: #d64545; }
        .au-ban-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .au-ban-chips button { background: #f1f2f9; border: 1.5px solid #e8ecff; color: #4a5568; border-radius: 999px; padding: 4px 10px; font-size: 0.75rem; cursor: pointer; }
        .au-ban-chips button:hover { border-color: #5b6bff; color: #07074e; }
        .au-ban-note { width: 100%; text-align: left; font-size: 0.78rem; color: #b45309; background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 8px; padding: 8px 12px; }
        .au-ban-actions { display: flex; gap: 10px; padding: 0 26px 24px; }
        .au-ban-actions .au-btn { flex: 1; justify-content: center; padding: 11px 18px; font-size: 0.9rem; }
        .au-btn-danger { background: #d64545; color: #fff; }
        .au-btn-danger:hover { background: #b93b3b; }
        .au-btn-success { background: #16a34a; color: #fff; }
        .au-btn-success:hover { background: #128a3e; }
        .au-btn-danger:disabled, .au-btn-success:disabled { opacity: .6; cursor: not-allowed; }

        /* detail drawer */
        .aud-overlay { position: fixed; inset: 0; background: rgba(17,17,40,.5); z-index: 1100; display: flex; justify-content: flex-end; }
        .aud-drawer { background: #fff; width: min(820px, 100%); height: 100%; display: flex; flex-direction: column; box-shadow: -8px 0 30px rgba(0,0,0,.2); }
        .aud-head { display: flex; align-items: center; gap: 14px; padding: 18px 24px; border-bottom: 1.5px solid #e8ecff; }
        .aud-avatar { width: 46px; height: 46px; border-radius: 12px; background: #eef2ff; color: #5a4ff3; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.05rem; overflow: hidden; }
        .aud-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .aud-head h2 { margin: 0; font-size: 1.15rem; color: #07074e; display: flex; align-items: center; gap: 8px; }
        .aud-head .aud-sub { font-size: 0.8rem; color: #718096; margin-top: 2px; }
        .aud-close { margin-left: auto; background: none; border: none; cursor: pointer; color: #4a5568; }
        .aud-tabs { display: flex; gap: 4px; padding: 10px 18px; border-bottom: 1.5px solid #f1f5f9; flex-wrap: wrap; }
        .aud-tabs button { padding: 7px 13px; border: none; background: none; border-radius: 8px; font-size: 0.82rem; font-weight: 600; color: #64748b; cursor: pointer; }
        .aud-tabs button.active { background: #eef2ff; color: #5a4ff3; }
        .aud-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
        .aud-grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; max-width: 900px; align-items: start; }
        .aud-card { border: 1.5px solid #e8ecff; border-radius: 12px; padding: 14px 16px; }
        .aud-card h4 { margin: 0 0 10px; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; color: #5a4ff3; display: flex; align-items: center; gap: 6px; }
        .aud-row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; font-size: 0.85rem; border-bottom: 1px solid #f6f7fb; }
        .aud-row:last-child { border-bottom: none; }
        .aud-row span { color: #718096; }
        .aud-row strong { color: #1a202c; font-weight: 600; text-align: right; word-break: break-word; }
        .aud-reveal { background: none; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.7rem; padding: 2px 7px; cursor: pointer; color: #5a4ff3; margin-left: 6px; }
        .aud-doc { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; background: #f6f7ff; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.78rem; color: #5a4ff3; margin: 4px 6px 0 0; text-decoration: none; }
        .aud-list { list-style: none; margin: 0; padding: 0; }
        .aud-list li { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.84rem; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .aud-list li .au-badge { flex: none; align-self: center; white-space: nowrap; }
        .aud-list li.clickable { cursor: pointer; margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: 8px; transition: background 0.15s ease; }
        .aud-list li.clickable:hover { background: #f4f6ff; }
        .aud-empty { color: #94a3b8; font-style: italic; font-size: 0.85rem; padding: 14px 0; }
        .aud-docs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .aud-doc-link { text-decoration: none; cursor: pointer; }
        .aud-doc-link:hover { background: #eef0ff; }
        .aud-violation { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.82rem; }
        .aud-violation .cat { font-weight: 700; color: #b42318; text-transform: capitalize; }
        .aud-violation .snip { color: #4b5563; font-style: italic; }
        .aud-actions-bar { padding: 14px 24px; border-top: 1.5px solid #e8ecff; display: flex; gap: 8px; flex-wrap: wrap; background: #fafbff; }
        .aud-action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 13px; border: 1.5px solid #e2e8f0; background: white; border-radius: 9px; font-size: 0.8rem; font-weight: 600; color: #334155; cursor: pointer; }
        .aud-action-btn:hover { border-color: #5b6bff; color: #5a4ff3; }
        .aud-action-btn.danger { color: #b42318; }
        .aud-action-btn.danger:hover { border-color: #fecaca; }

        @media (max-width: 720px) {
          .au-container { padding: 20px; }
          .au-header { flex-direction: column; align-items: stretch; }
          .aud-grid2 { grid-template-columns: 1fr; }
        }
      `}</style>
    </AdminLayout>
  );
}

// =============================================================================
// Profile detail (admin view) — public + private side by side, history, finance
// =============================================================================
function ProfileDetail({ u, onClose, tab, setTab, revealBank, setRevealBank, deals, disputes, brandCampaigns, onOpenDeal, activityLoading, onAction, onBan, banned, caps = {} }) {
  const brand = isBrand(u);
  const admin = isAdmin(u);
  const adminRoleLabel = ROLE_LABELS[normalizeRole(u.admin_role)] || 'Admin';
  const { kyc, kycAddr, acct, ifsc, bankHolder, bankName, upiId, pan, aadhaar, docs } = payoutInfo(u);
  const earned = deals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  // Brand campaigns come from /admin/business/:id/campaigns (live + completed).
  // null means the request is still in flight; [] means loaded-but-empty.
  const campaigns = brandCampaigns || [];
  const campaignsLoading = brand && brandCampaigns === null;

  // A stored photo can be a dead /uploads path or a localhost URL that 404s in prod —
  // fall back to the initial instead of showing a broken-image icon.
  const [avatarBroken, setAvatarBroken] = useState(false);
  const rawPhoto = u.profile_photo;
  const avatarUrl = (rawPhoto && !/localhost/i.test(rawPhoto))
    ? (String(rawPhoto).startsWith('http') ? rawPhoto : `${BACKEND_URL}${rawPhoto}`)
    : null;

  // Staff accounts have no marketplace activity (no deals/earnings/chat), so they
  // only get the Profile tab — the deals/disputes/violations/finance tabs are a
  // creator/brand concept and don't apply to an admin.
  const tabs = admin
    ? [['profile', 'Profile']]
    : brand
      ? [['profile', 'Profile'], ['campaigns', 'Campaigns'], ['disputes', 'Disputes'], ['violations', 'Chat Violations'], ['finance', 'Wallet']]
      : [['profile', 'Profile'], ['deals', 'Deals'], ['disputes', 'Disputes'], ['violations', 'Chat Violations'], ['finance', 'Earnings']];

  return (
    <div className="aud-overlay" onClick={onClose}>
      <div className="aud-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="aud-head">
          <div className="aud-avatar">{avatarUrl && !avatarBroken ? <img src={avatarUrl} alt="" onError={() => setAvatarBroken(true)} /> : (brand ? businessName(u) : (realName(u) || u.nickname || u.email || '?')).slice(0, 1).toUpperCase()}</div>
          <div>
            <h2>
              {brand ? businessName(u) : displayName(u)}
              <span className={`au-badge au-state-${userState(u)}`}>{STATE_LABELS[userState(u)]}</span>
            </h2>
            <div className="aud-sub">{handleOf(u)} · {u.email} · {brand ? 'Brand' : (admin ? 'Admin' : 'Creator')}{admin ? ` · ${adminRoleLabel}` : (isCreator(u) ? ` · Level: ${levelLabelOf(u.level_key ?? u.level)}` : '')}</div>
          </div>
          <button className="aud-close" onClick={onClose}><X size={22} /></button>
        </div>

        <div className="aud-tabs">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        <div className="aud-body">
          {tab === 'profile' && (
            <div className="aud-grid2">
              {/* Profile card — admins get a staff card (no public profile / strikes). */}
              <div className="aud-card">
                <h4><Eye size={14} /> {admin ? 'Admin Account' : 'Public Profile'}</h4>
                {admin ? (
                  <>
                    <Row label="Name" value={displayName(u)} />
                    <Row label="Admin role" value={adminRoleLabel} />
                    {Array.isArray(u.assigned_categories) && u.assigned_categories.length > 0 && (
                      <Row label="Assigned categories" value={u.assigned_categories.join(', ')} />
                    )}
                  </>
                ) : brand ? (
                  <>
                    <Row label="Business name" value={businessName(u)} />
                    <Row label="Website" value={p(u, 'website') || '-'} />
                  </>
                ) : (
                  <Row label="Handle" value={handleOf(u)} />
                )}
                <Row label="Email" value={u.email} />
                <Row label="Mobile" value={phone(u)} />
                <Row label="Joined" value={dateShort(u.created_at || u.createdAt)} />
                {/* Flags moved off the table into here — not relevant to staff accounts. */}
                {!admin && <Row label="Flags / strikes" value={strikes(u).length ? `${strikes(u).length}` : '0'} />}
                {admin && (
                  <p className="aud-empty" style={{ marginTop: 6 }}>
                    Manage this admin’s role &amp; permissions on the Team &amp; Roles page.
                  </p>
                )}
              </div>

              {/* KYC & payout — creators submit this to user.kyc via Verify KYC. Brands
                  and admins never submit KYC, so this card is creator-only. */}
              {isCreator(u) && (
                <div className="aud-card">
                  <h4>
                    <FileText size={14} /> KYC &amp; Payout
                    {kyc.status && <span className={`au-badge au-state-${kyc.status === 'verified' ? 'active' : kyc.status === 'rejected' ? 'banned' : 'suspended'}`}>{kyc.status}</span>}
                  </h4>
                  {!u.kyc ? (
                    <p className="aud-empty">No KYC submitted yet.</p>
                  ) : (
                    <>
                      <Row label="Legal name" value={kyc.full_legal_name || realName(u) || '-'} />
                      <Row label="Date of birth" value={kyc.date_of_birth || '-'} />
                      <Row label="Gender" value={kyc.gender || '-'} />
                      <Row label="PAN" value={pan ? (revealBank ? pan : mask4(pan)) : '-'} reveal={pan ? () => setRevealBank((v) => !v) : undefined} revealed={revealBank} />
                      <Row label="Aadhaar" value={aadhaar ? (revealBank ? aadhaar : mask4(aadhaar)) : '-'} />
                      <Row label="Address" value={[kycAddr.line, kycAddr.city, kycAddr.state, kycAddr.pincode].filter(Boolean).join(', ') || '-'} />
                      <Row label="Payout method" value={kyc.payout_method === 'upi' ? 'UPI' : (acct ? 'Bank account' : '-')} />
                      {upiId && <Row label="UPI ID" value={upiId} />}
                      {acct && <>
                        <Row label="Account holder" value={bankHolder || '-'} />
                        <Row label="Bank" value={bankName || '-'} />
                        <Row label="Account no." value={revealBank ? acct : mask4(acct)} />
                        <Row label="IFSC" value={ifsc || '-'} />
                      </>}
                      {kyc.rejection_reason && <Row label="Rejection reason" value={kyc.rejection_reason} />}
                      <Row label="Submitted" value={dateShort(kyc.submitted_at) || '-'} />
                      {docs.length > 0 && (
                        <div className="aud-docs">
                          {docs.map(([label, url]) => (
                            <a key={label} href={docUrl(url)} target="_blank" rel="noreferrer" className="au-badge aud-doc-link">{label}</a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'deals' && (
            <ActivityList loading={activityLoading} items={deals} empty="No deals for this creator."
              render={(d) => (
                <li key={d.id}>
                  <span><strong>{d.title || d.campaign_title || 'Deal'}</strong><br /><small style={{ color: '#94a3b8' }}>{(d.current_state || '').replace(/_/g, ' ')}</small></span>
                  <strong>{money(d.amount)}</strong>
                </li>
              )} />
          )}

          {tab === 'campaigns' && (
            <ActivityList loading={campaignsLoading} items={campaigns} empty="No campaigns found for this brand."
              render={(c) => {
                const st = (c.status || '').replace(/_/g, ' ');
                const badge = c.status === 'completed' ? 'active' : c.status === 'rejected' ? 'banned' : 'suspended';
                const budget = (c.budget_min != null || c.budget_max != null)
                  ? `${money(c.budget_min)} – ${money(c.budget_max)}` : null;
                return (
                  <li
                    key={c.id}
                    className="clickable"
                    onClick={() => onOpenDeal && onOpenDeal(c.id)}
                    title="Open this deal"
                  >
                    <span>
                      <strong>{c.title}</strong><br />
                      <small style={{ color: '#94a3b8' }}>
                        {dateShort(c.created_at)}{budget ? ` · ${budget}` : ''}
                        {c.selected_creator ? ' · matched' : ''}
                      </small>
                    </span>
                    <span className={`au-badge au-state-${badge}`}>{st || 'live'}</span>
                  </li>
                );
              }} />
          )}

          {tab === 'disputes' && (
            <ActivityList loading={activityLoading} items={disputes} empty="No disputes on record."
              render={(d) => (
                <li key={d.id}>
                  <span>#{String(d.id).slice(0, 8)} · {(d.dispute_type || 'general').replace(/_/g, ' ')}</span>
                  <strong className={d.status === 'open' ? '' : ''} style={{ color: d.status === 'open' ? '#c2410c' : '#16a34a' }}>{d.status}</strong>
                </li>
              )} />
          )}

          {tab === 'violations' && (
            <div>
              <h4 style={{ margin: '0 0 8px', color: '#5a4ff3', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}><ShieldAlert size={15} /> Chat Filter Violation Log</h4>
              {strikes(u).length === 0 ? (
                <p className="aud-empty">No chat-filter violations.</p>
              ) : (
                strikes(u).map((s, i) => (
                  <div key={i} className="aud-violation">
                    <span className="cat">{s.category || 'violation'}</span> · {dateShort(s.at)} {s.false_positive && '· (false positive)'}
                    {s.matched?.length ? <div>Matched: {s.matched.join(', ')}</div> : null}
                    {s.snippet ? <div className="snip">“{s.snippet}”</div> : null}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'finance' && (
            <div className="aud-grid2">
              <div className="aud-card">
                <h4><Wallet size={14} /> {brand ? 'Wallet' : 'Earnings'}</h4>
                <Row label={brand ? 'Wallet balance' : 'Available balance'} value={money(u.balance)} />
                {!brand && <Row label="Earned (settled deals)" value={money(earned)} />}
                {!brand && <Row label="Pending payout" value={money(u.balance)} />}
                {!brand && <Row label="Payout schedule" value={u.payout_schedule || p(u, 'payout_schedule') || 'weekly'} />}
                {brand && <Row label="Commission rate" value={u.commission_rate != null ? `${u.commission_rate}%` : (p(u, 'commission_rate') ? `${p(u, 'commission_rate')}%` : 'platform default')} />}
              </div>
              <div className="aud-card">
                <h4><CreditCard size={14} /> Transaction History</h4>
                {deals.length === 0 ? <p className="aud-empty">No transactions yet.</p> : (
                  <ul className="aud-list">
                    {deals.slice(0, 8).map((d) => (
                      <li key={d.id}><span>{d.title || 'Deal'}</span><strong>{money(d.amount)}</strong></li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions (spec 11.10) — gated by admin role capabilities (PRD 11).
            Admin (staff) targets only get Send Message here; warn/suspend/ban and
            creator-level / brand-finance actions don't apply to a staff account —
            their role & access are managed on the Team & Roles page. */}
        <div className="aud-actions-bar">
          {admin ? (
            <>
              <button className="aud-action-btn" onClick={() => onAction('message')}><MessageSquare size={14} /> Send Message</button>
              <span className="aud-actions-note">Manage this admin’s role &amp; permissions on the Team &amp; Roles page.</span>
            </>
          ) : (
            <>
              {caps.warnSuspend && <button className="aud-action-btn" onClick={() => onAction('warn')}><AlertTriangle size={14} /> Warn</button>}
              {caps.warnSuspend && (u.suspended || u.status === 'suspended') && <button className="aud-action-btn" onClick={() => onAction('unsuspend')}><ShieldCheck size={14} /> Unsuspend</button>}
              {caps.warnSuspend && <button className="aud-action-btn danger" onClick={() => onAction('suspend')}><ShieldAlert size={14} /> Suspend</button>}
              {caps.ban && <button className="aud-action-btn danger" onClick={onBan}><Ban size={14} /> {banned ? 'Unban' : 'Ban'}</button>}
              {brand && caps.financialPolicy && <>
                <button className="aud-action-btn" onClick={() => onAction('commission')}><Percent size={14} /> Adjust Commission</button>
              </>}
              {brand && caps.wallet && <button className="aud-action-btn" onClick={() => onAction('wallet')}><Wallet size={14} /> Adjust Wallet</button>}
              {isCreator(u) && caps.userMgmt && (
                <button className="aud-action-btn" onClick={() => onAction(u.ugcad_approved ? 'ugcadUnapprove' : 'ugcadApprove')}>
                  <BadgeCheck size={14} /> {u.ugcad_approved ? 'Remove UGCAD Preferred' : 'Mark UGCAD Preferred'}
                </button>
              )}
              {isCreator(u) && caps.userMgmt && <button className="aud-action-btn" onClick={() => onAction('promote')}><ArrowUpCircle size={14} /> Promote</button>}
              {isCreator(u) && caps.userMgmt && <button className="aud-action-btn" onClick={() => onAction('demote')}><ArrowDownCircle size={14} /> Demote</button>}
              {isCreator(u) && caps.userMgmt && <button className="aud-action-btn" onClick={() => onAction('payout')}><CalendarClock size={14} /> Payout Schedule</button>}
              <button className="aud-action-btn" onClick={() => onAction('message')}><MessageSquare size={14} /> Send Message</button>
              {caps.ban && <button className="aud-action-btn danger" onClick={() => onAction('delete')}><Trash2 size={14} /> Delete</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Phone (PWA) user detail — the desktop drawer's tabs as stacked sections
// =============================================================================
function KV({ label, value, mono }) {
  const display = (value !== null && typeof value === 'object')
    ? (Array.isArray(value) ? value.join(', ') : (Object.entries(value).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') || '-'))
    : value;
  return <div className="am-kv"><span>{label}</span><span className={mono ? 'amu-mono' : undefined}>{display || '-'}</span></div>;
}

function ShowToggle({ on, set, what }) {
  return (
    <button type="button" className="am-btn am-btn--link am-btn--sm" aria-pressed={on} aria-label={`${on ? 'Hide' : 'Show'} ${what}`} onClick={() => set((v) => !v)}>
      {on ? <EyeOff size={16} /> : <Eye size={16} />} {on ? 'Hide' : 'Show'}
    </button>
  );
}

function PhoneUserDetail({
  u, onBack, onMore, onEdit, onAction, deals, disputes, brandCampaigns, activityLoading, onOpenDeal,
  revealBank, setRevealBank, revealContact, setRevealContact,
}) {
  const brand = isBrand(u);
  const admin = isAdmin(u);
  const { kyc, kycAddr, acct, ifsc, bankHolder, bankName, upiId, pan, aadhaar, docs } = payoutInfo(u);
  const earned = deals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const campaigns = brandCampaigns || [];
  const campaignsLoading = brand && brandCampaigns === null;
  const list = (loading, items, empty, render) => (
    loading ? <p className="am-muted">Loading…</p>
      : (!items || items.length === 0) ? <p className="am-muted">{empty}</p>
        : <ul className="amu-list">{items.map(render)}</ul>
  );

  return (
    <div className="am-detail" role="dialog" aria-modal="true" aria-label="User detail" data-testid="user-detail">
      <header className="am-detail-head">
        <button type="button" className="am-icon-btn" onClick={onBack} aria-label="Back to users" data-testid="user-detail-back"><ArrowLeft size={22} /></button>
        <h1>{typeLabel(u)} profile</h1>
        {!admin && <button type="button" className="am-icon-btn" onClick={onMore} aria-label="More actions"><MoreHorizontal size={22} /></button>}
      </header>

      <div className="am-detail-body">
        <div className="am-identity">
          <PhoneAvatar u={u} lg />
          <div className="am-card-main">
            <h2>{nameOf(u)}</h2>
            <span className="am-card-sub">{handleOf(u)}</span>
            <UserBadges u={u} />
          </div>
        </div>

        <section className="am-section">
          <div className="amu-sec-head">
            <h3>{admin ? 'Admin account' : 'Public profile'}</h3>
            <ShowToggle on={revealContact} set={setRevealContact} what="email and mobile" />
          </div>
          {admin ? (
            <>
              <KV label="Name" value={displayName(u)} />
              <KV label="Admin role" value={ROLE_LABELS[normalizeRole(u.admin_role)] || 'Admin'} />
              {Array.isArray(u.assigned_categories) && u.assigned_categories.length > 0 && <KV label="Assigned categories" value={u.assigned_categories} />}
            </>
          ) : brand ? (
            <>
              <KV label="Business name" value={businessName(u)} />
              <KV label="Legal name" value={legalName(u)} />
              <KV label="GSTIN" value={gstin(u)} mono />
              <KV label="Website" value={p(u, 'website')} />
            </>
          ) : (
            <KV label="Handle" value={handleOf(u)} />
          )}
          <KV label="Email" value={revealContact ? u.email : maskEmail(u.email)} />
          <KV label="Mobile" value={revealContact ? phone(u) : maskPhone(phone(u))} mono />
          <KV label="Joined" value={dateShort(u.created_at || u.createdAt)} />
          {!admin && <KV label="Category" value={category(u)} />}
          {!admin && <KV label="Flags / strikes" value={String(strikes(u).length)} />}
          {admin && <p className="am-muted">Manage this admin’s role &amp; permissions on the Team &amp; Roles page.</p>}
        </section>

        {isCreator(u) && (
          <section className="am-section" data-testid="user-kyc">
            <div className="amu-sec-head">
              <h3>KYC &amp; payout {kyc.status && <span className={`am-badge am-badge--${kyc.status === 'verified' ? 'ok' : kyc.status === 'rejected' ? 'bad' : 'wait'}`}>{kyc.status}</span>}</h3>
              {u.kyc && (pan || aadhaar || acct) && <ShowToggle on={revealBank} set={setRevealBank} what="PAN, Aadhaar and account number" />}
            </div>
            {!u.kyc ? <p className="am-muted">No KYC submitted yet.</p> : (
              <>
                <KV label="Legal name" value={kyc.full_legal_name || realName(u)} />
                <KV label="Date of birth" value={kyc.date_of_birth} />
                <KV label="Gender" value={kyc.gender} />
                <KV label="PAN" value={pan ? (revealBank ? pan : mask4(pan)) : '-'} mono />
                <KV label="Aadhaar" value={aadhaar ? (revealBank ? aadhaar : mask4(aadhaar)) : '-'} mono />
                <KV label="Address" value={[kycAddr.line, kycAddr.city, kycAddr.state, kycAddr.pincode].filter(Boolean).join(', ')} />
                <KV label="Payout method" value={kyc.payout_method === 'upi' ? 'UPI' : (acct ? 'Bank account' : '-')} />
                {upiId && <KV label="UPI ID" value={upiId} />}
                {acct && (
                  <>
                    <KV label="Account holder" value={bankHolder} />
                    <KV label="Bank" value={bankName} />
                    <KV label="Account no." value={revealBank ? acct : mask4(acct)} mono />
                    <KV label="IFSC" value={ifsc} />
                  </>
                )}
                {kyc.rejection_reason && <KV label="Rejection reason" value={kyc.rejection_reason} />}
                <KV label="Submitted" value={dateShort(kyc.submitted_at)} />
                {docs.length > 0 && (
                  <ul className="am-rows">
                    {docs.map(([label, url]) => (
                      <li key={label}>
                        <a className="am-row" href={docUrl(url)} target="_blank" rel="noreferrer">
                          <FileText size={20} /><span className="am-row-label">{label}</span><ExternalLink size={18} className="am-row-chevron" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}

        {!admin && (
          <>
            {brand ? (
              <section className="am-section">
                <h3>Campaigns</h3>
                {list(campaignsLoading, campaigns, 'No campaigns found for this brand.', (c) => {
                  const st = (c.status || '').replace(/_/g, ' ');
                  const tone = c.status === 'completed' ? 'ok' : c.status === 'rejected' ? 'bad' : 'wait';
                  const budget = (c.budget_min != null || c.budget_max != null) ? `${money(c.budget_min)} – ${money(c.budget_max)}` : null;
                  return (
                    <li key={c.id}>
                      <button type="button" className="amu-item" onClick={() => onOpenDeal(c.id)}>
                        <span className="am-card-main">
                          <strong>{c.title}</strong>
                          <small>{dateShort(c.created_at)}{budget ? ` · ${budget}` : ''}{c.selected_creator ? ' · matched' : ''}</small>
                        </span>
                        <span className={`am-badge am-badge--${tone}`}>{st || 'live'}</span>
                        <ChevronRight size={18} className="am-row-chevron" />
                      </button>
                    </li>
                  );
                })}
              </section>
            ) : (
              <section className="am-section">
                <h3>Deals</h3>
                {list(activityLoading, deals, 'No deals for this creator.', (d) => (
                  <li key={d.id} className="amu-item">
                    <span className="am-card-main">
                      <strong>{d.title || d.campaign_title || 'Deal'}</strong>
                      <small>{(d.current_state || '').replace(/_/g, ' ')}</small>
                    </span>
                    <strong>{money(d.amount)}</strong>
                  </li>
                ))}
              </section>
            )}

            <section className="am-section">
              <h3>Disputes</h3>
              {list(activityLoading, disputes, 'No disputes on record.', (d) => (
                <li key={d.id} className="amu-item">
                  <span className="am-card-main"><strong>#{String(d.id).slice(0, 8)}</strong><small>{(d.dispute_type || 'general').replace(/_/g, ' ')}</small></span>
                  <span className={`am-badge am-badge--${d.status === 'open' ? 'wait' : 'ok'}`}>{d.status}</span>
                </li>
              ))}
            </section>

            <section className="am-section">
              <h3>Chat filter violations</h3>
              {list(false, strikes(u), 'No chat-filter violations.', (s, i) => (
                <li key={i} className="amu-item amu-item--stack">
                  <span><strong className="amu-violation">{s.category || 'violation'}</strong> · {dateShort(s.at)}{s.false_positive ? ' · (false positive)' : ''}</span>
                  {s.matched?.length ? <small>Matched: {s.matched.join(', ')}</small> : null}
                  {s.snippet ? <small className="amu-snip">“{s.snippet}”</small> : null}
                </li>
              ))}
            </section>

            <section className="am-section">
              <h3>{brand ? 'Wallet' : 'Earnings'}</h3>
              <KV label={brand ? 'Wallet balance' : 'Available balance'} value={money(u.balance)} />
              {!brand && <KV label="Earned (settled deals)" value={money(earned)} />}
              {!brand && <KV label="Pending payout" value={money(u.balance)} />}
              {!brand && <KV label="Payout schedule" value={u.payout_schedule || p(u, 'payout_schedule') || 'weekly'} />}
              {brand && <KV label="Commission rate" value={u.commission_rate != null ? `${u.commission_rate}%` : (p(u, 'commission_rate') ? `${p(u, 'commission_rate')}%` : 'platform default')} />}
              <h4 className="amu-sub">Transaction history</h4>
              {list(false, deals.slice(0, 8), 'No transactions yet.', (d) => (
                <li key={d.id} className="amu-item"><span className="am-card-main">{d.title || 'Deal'}</span><strong>{money(d.amount)}</strong></li>
              ))}
            </section>
          </>
        )}
      </div>

      <div className="am-actionbar">
        <div className="am-actionbar-row">
          <button type="button" className="am-btn am-btn--secondary" onClick={onEdit} data-testid="user-edit-btn"><Pencil size={18} /> Edit</button>
          <button type="button" className="am-btn am-btn--primary" onClick={() => onAction('message')}><MessageSquare size={18} /> Message</button>
          {!admin && <button type="button" className="am-btn am-btn--secondary amu-more" onClick={onMore} aria-label="More actions" data-testid="user-more-btn"><MoreHorizontal size={20} /></button>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, reveal, revealed }) {
  // Some profile fields (e.g. socials / per-platform followers) are objects like
  // { youtube, instagram, ... }. Rendering an object directly crashes React
  // (error #31), so flatten it to a readable string first.
  const display = (value !== null && typeof value === 'object' && !Array.isArray(value))
    ? (Object.entries(value)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' · ') || '-')
    : (Array.isArray(value) ? value.join(', ') : value);
  return (
    <div className="aud-row">
      <span>{label}</span>
      <strong>
        {display}
        {reveal && <button className="aud-reveal" onClick={reveal}>{revealed ? 'hide' : 'reveal'}</button>}
      </strong>
    </div>
  );
}

function ActivityList({ loading, items, empty, render }) {
  if (loading) return <p className="aud-empty">Loading…</p>;
  if (!items || items.length === 0) return <p className="aud-empty">{empty}</p>;
  return <ul className="aud-list">{items.map(render)}</ul>;
}

// =============================================================================
// Action modal — warn / suspend / message / wallet / commission / payout / etc.
// =============================================================================
const ACTION_META = {
  warn: { title: 'Warn User', label: 'Warning message', kind: 'text', btn: 'Send Warning', icon: AlertTriangle },
  suspend: { title: 'Suspend User', kind: 'suspend', btn: 'Suspend', icon: ShieldAlert },
  message: { title: 'Send Message', label: 'Message', kind: 'text', btn: 'Send', icon: MessageSquare },
  wallet: { title: 'Adjust Balance', kind: 'wallet', btn: 'Apply Adjustment', icon: Wallet },
  commission: { title: 'Adjust Commission', label: 'Commission rate (%)', kind: 'number', btn: 'Save', icon: Percent },
  payout: { title: 'Adjust Payout Schedule', kind: 'payout', btn: 'Save', icon: CalendarClock },
  promote: { title: 'Promote Level', kind: 'confirm', btn: 'Promote', icon: ArrowUpCircle, msg: 'Promote this creator one level? (New → Verified → L1 → L2 → Elite. Shown on their public profile.)' },
  demote: { title: 'Demote Level', kind: 'confirm', btn: 'Demote', icon: ArrowDownCircle, msg: 'Demote this creator one level?' },
  ugcadApprove: { title: 'Mark UGCAD Preferred', kind: 'confirm', btn: 'Mark preferred', icon: BadgeCheck, msg: 'Add this creator to "Preferred Creators by the UGCAD Team"? Brands will see them in that collection on Browse Creators.' },
  ugcadUnapprove: { title: 'Remove UGCAD Preferred', kind: 'confirm', btn: 'Remove', icon: BadgeCheck, msg: 'Remove this creator from the UGCAD Preferred collection that brands see?' },
  announce: { title: 'Send Announcement', label: 'Announcement', kind: 'text', btn: 'Send to selected', icon: Send },
  delete: { title: 'Delete User', kind: 'confirm', btn: 'Delete Permanently', icon: Trash2, msg: 'This permanently deletes the user and all their data. This cannot be undone.' },
  unsuspend: { title: 'Lift Suspension', kind: 'confirm', btn: 'Unsuspend', icon: ShieldCheck, msg: 'Lift this user’s suspension and restore their account access?' },
};

const BAN_REASONS = ['Spam / scam', 'Fake profile', 'Abusive behaviour', 'Payment fraud', 'Repeat policy violation'];

function BanModal({ target, onClose, onConfirm, phone }) {
  const { user: u, banned } = target;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const name = isBrand(u) ? businessName(u) : displayName(u);

  const submit = async () => {
    if (!banned && !reason.trim()) return toast.error('A ban reason is required');
    setBusy(true);
    await onConfirm(reason.trim());
    setBusy(false);
  };

  if (phone) {
    const close = () => { if (!busy) onClose(); };
    return (
      <PhoneSheet
        title={banned ? 'Unban this user?' : 'Ban this user?'}
        onClose={close}
        testId="user-ban-sheet"
        foot={(
          <>
            <button type="button" className="am-btn am-btn--secondary" disabled={busy} onClick={close}>Cancel</button>
            <button
              type="button"
              className={`am-btn ${banned ? 'am-btn--primary' : 'am-btn--danger'}`}
              onClick={submit}
              disabled={busy || (!banned && !reason.trim())}
              data-testid="user-ban-submit"
            >
              {busy ? 'Working…' : (banned ? 'Yes, unban' : 'Yes, ban user')}
            </button>
          </>
        )}
      >
        <p className="am-muted">
          {banned
            ? 'They will regain access to their account and can log in again.'
            : 'They will be signed out immediately and blocked from logging in until you unban them.'}
        </p>
        <div className="am-identity">
          <PhoneAvatar u={u} />
          <div className="am-card-main">
            <span className="am-card-title">{name && name !== '-' ? name : u.email}</span>
            <span className="am-card-sub">{maskEmail(u.email)} · {typeLabel(u)}</span>
          </div>
        </div>
        {!banned && (
          <>
            <div className="am-field">
              <label htmlFor="amu-ban-reason">Ban reason (required)</label>
              <textarea id="amu-ban-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this user being banned? Logged to the audit trail." />
              <span className="am-field-hint">This action is recorded in the audit log and can be reversed later.</span>
            </div>
            <div className="am-chips" role="group" aria-label="Common reasons">
              {BAN_REASONS.map((r) => (
                <button key={r} type="button" className={`am-chip${reason === r ? ' is-active' : ''}`} onClick={() => setReason(r)}>{r}</button>
              ))}
            </div>
          </>
        )}
      </PhoneSheet>
    );
  }

  return (
    <div className="au-modal-overlay" onClick={onClose}>
      <div className="au-modal au-ban" onClick={(e) => e.stopPropagation()}>
        <div className="au-ban-body">
          <div className={`au-ban-icon ${banned ? 'ok' : 'danger'}`}>
            {banned ? <ShieldCheck size={26} /> : <Ban size={26} />}
          </div>
          <h2>{banned ? 'Unban this user?' : 'Ban this user?'}</h2>
          <p className="au-ban-sub">
            {banned
              ? 'They will regain access to their account and can log in again.'
              : 'They will be signed out immediately and blocked from logging in until you unban them.'}
          </p>

          <div className="au-ban-user">
            <div className="au-ban-av">{(name || u.email || '?').trim().charAt(0).toUpperCase()}</div>
            <div>
              <b>{name && name !== '-' ? name : u.email}</b>
              <span>{u.email} · {isBrand(u) ? 'Brand' : (isCreator(u) ? 'Creator' : 'Admin')}</span>
            </div>
          </div>

          {!banned && (
            <>
              <div className="au-ban-field">
                <label>Ban reason <span style={{ color: '#d64545' }}>*</span></label>
                <textarea
                  rows={3}
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this user being banned? Logged to the audit trail."
                />
                <div className="au-ban-chips">
                  {BAN_REASONS.map((r) => (
                    <button key={r} type="button" onClick={() => setReason(r)}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="au-ban-note">This action is recorded in the audit log and can be reversed later.</div>
            </>
          )}
        </div>
        <div className="au-ban-actions">
          <button className="au-btn au-btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className={`au-btn ${banned ? 'au-btn-success' : 'au-btn-danger'}`}
            onClick={submit}
            disabled={busy || (!banned && !reason.trim())}
          >
            {busy ? 'Working…' : (banned ? 'Yes, unban' : 'Yes, ban user')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionModal({ action, onClose, onDone, adminPost, phone }) {
  const meta = ACTION_META[action.type];
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('7');
  const [schedule, setSchedule] = useState('weekly');
  const [busy, setBusy] = useState(false);
  const Icon = meta.icon;
  const targetName = action.users ? `${action.users.length} user(s)` : (action.user ? (isBrand(action.user) ? businessName(action.user) : displayName(action.user)) : '');

  const submit = async () => {
    setBusy(true);
    const u = action.user;
    let ok = false;
    switch (action.type) {
      case 'warn':
        if (!text.trim()) { setBusy(false); return toast.error('Enter a message'); }
        ok = await adminPost('/admin/user/warn', { user_id: u.id, message: text }, 'Warning sent');
        break;
      case 'suspend':
        if (!reason.trim()) { setBusy(false); return toast.error('Reason is required'); }
        ok = await adminPost('/admin/user/suspend', { user_id: u.id, reason, duration_days: Number(duration) || 0 }, `Suspended for ${duration} day(s)`);
        break;
      case 'unsuspend':
        ok = await adminPost('/admin/user/unsuspend', { user_id: u.id }, 'Suspension lifted');
        break;
      case 'message':
        if (!text.trim()) { setBusy(false); return toast.error('Enter a message'); }
        ok = await adminPost('/admin/user/message', { user_id: u.id, message: text }, 'Message sent');
        break;
      case 'wallet': {
        const amt = Number(amount);
        if (!amt) { setBusy(false); return toast.error('Enter a non-zero amount'); }
        ok = await adminPost('/admin/wallet/adjust', { user_id: u.id, amount: amt, reason }, `Balance adjusted by ₹${amt}`);
        break;
      }
      case 'commission':
        ok = await adminPost('/admin/user/commission', { user_id: u.id, commission_rate: Number(amount) || 0 }, 'Commission updated');
        break;
      case 'payout':
        ok = await adminPost('/admin/user/payout-schedule', { user_id: u.id, schedule }, `Payout schedule set to ${schedule}`);
        break;
      case 'ugcadApprove':
      case 'ugcadUnapprove':
        ok = await adminPost('/admin/user/ugcad-approved', { user_id: u.id, approved: action.type === 'ugcadApprove' },
          action.type === 'ugcadApprove' ? 'Marked as UGCAD preferred' : 'Removed from UGCAD preferred');
        break;
      case 'promote':
      case 'demote':
        ok = await adminPost('/admin/user/level', { user_id: u.id, direction: action.type }, `Creator ${action.type}d`);
        break;
      case 'delete': {
        // Supports both single (action.user) and bulk (action.users) delete.
        const targets = action.users ? action.users : (action.user ? [action.user] : []);
        const results = await Promise.allSettled(
          targets.map((t) => axios.delete(`${API}/admin/user/${t.id}`))
        );
        const rejected = results.filter((r) => r.status === 'rejected');
        const failed = rejected.length;
        const done = targets.length - failed;
        if (done) toast.success(`${done} user${done > 1 ? 's' : ''} deleted`);
        if (failed) {
          const why = apiErrorMessage(rejected[0].reason, 'Failed to delete');
          toast.error(`${failed} user${failed > 1 ? 's' : ''} could not be deleted - ${why}`);
        }
        ok = done > 0;
        break;
      }
      case 'announce':
        if (!text.trim()) { setBusy(false); return toast.error('Enter an announcement'); }
        ok = await adminPost('/admin/broadcast-notification', { title: 'Announcement', target_user_ids: action.users.map((x) => x.id), message: text }, `Announcement sent to ${action.users.length} user(s)`);
        break;
      default: break;
    }
    setBusy(false);
    if (ok) onDone();
  };

  const fields = (
    <>
          {(meta.kind === 'text') && (
            <label>{meta.label}<textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type here…" /></label>
          )}
          {meta.kind === 'number' && (
            <label>{meta.label}<input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          )}
          {meta.kind === 'suspend' && (
            <>
              <label>Reason<textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this user being suspended?" /></label>
              <label>Duration (days)<input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
            </>
          )}
          {meta.kind === 'wallet' && (
            <>
              <label>Amount (₹, use − to deduct)<input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500 or -500" /></label>
              <label>Reason<input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Audit note" /></label>
            </>
          )}
          {meta.kind === 'payout' && (
            <label>Schedule
              <select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                {PAYOUT_SCHEDULES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </label>
          )}
          {meta.kind === 'confirm' && <p style={{ margin: 0, fontSize: '0.9rem', color: '#2d3748' }}>{meta.msg}</p>}
    </>
  );

  if (phone) {
    const close = () => { if (!busy) onClose(); };
    const danger = ['suspend', 'delete'].includes(action.type);
    return (
      <PhoneSheet
        title={meta.title}
        onClose={close}
        testId={`user-action-sheet-${action.type}`}
        foot={(
          <>
            <button type="button" className="am-btn am-btn--secondary" disabled={busy} onClick={close}>Cancel</button>
            <button type="button" className={`am-btn ${danger ? 'am-btn--danger' : 'am-btn--primary'}`} disabled={busy} onClick={submit} data-testid="user-action-submit">
              {busy ? 'Working…' : meta.btn}
            </button>
          </>
        )}
      >
        <p className="am-muted">Target: <strong>{targetName}</strong></p>
        <div className="amu-form">{fields}</div>
      </PhoneSheet>
    );
  }

  return (
    <div className="au-modal-overlay" onClick={onClose}>
      <div className="au-modal" onClick={(e) => e.stopPropagation()}>
        <div className="au-modal-head">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon size={18} /> {meta.title}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="au-modal-body">
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#718096' }}>Target: <strong style={{ color: '#07074e' }}>{targetName}</strong></p>
          {fields}
        </div>
        <div className="au-modal-actions">
          <button className="au-btn au-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="au-btn au-btn-primary" disabled={busy} onClick={submit}>{busy ? 'Working…' : meta.btn}</button>
        </div>
      </div>
    </div>
  );
}
