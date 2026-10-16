import { useLiveEffect } from '../lib/liveUpdates';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { ShieldCheck, ShieldAlert, UserPlus, Check, X, Crown, Mail, AlertTriangle, ArrowLeft, ChevronRight, KeyRound, UserMinus, Trash2, Layers } from 'lucide-react';
import { useAuth } from '../App';
import AdminLayout from '../components/AdminLayout';
import { ADMIN_ROLES, ROLE_LABELS, ROLE_MATRIX, CAP_LABELS, ALL_CAPS, SCOPE_LABELS, isFounder as roleIsFounder } from '../utils/adminRoles';
import { SkeletonTable } from '../components/Skeleton';
import { CONTENT_CATEGORIES } from '../constants/contentCategories';
import useIsPhone from '../lib/useIsPhone';
import '../styles/admin-mobile-platform.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
// Canonical category labels — the fallback list shown in the assign-categories
// picker when the /admin/categories endpoint returns nothing.
const FALLBACK_CATEGORIES = CONTENT_CATEGORIES.map((c) => c.label);

const ROLE_TONE = {
  founder: 'founder',
  ops_senior: 'senior',
  ops_regular: 'regular',
  finance: 'finance',
  custom: 'custom',
};
const ACCESS_MODE_LABELS = { view: 'View', edit: 'Edit', both: 'Both' };

// ---- Phone (PWA) helpers ----
const memberName = (m) => String(m.full_name || m.name || m.nickname || m.email.split('@')[0]).replace(/^@+/, '');
// chandan@gmail.com -> chand***@gmail.com (same rule as the Applications phone cards)
const maskEmail = (e) => {
  const [local, domain] = String(e || '').split('@');
  if (!local || !domain) return String(e || '');
  return `${local.slice(0, Math.min(5, Math.max(1, local.length - 2)))}***@${domain}`;
};
// The desktop picker stores a feature as caps[] + a mode ('view' | 'edit' | 'both').
// The phone shows it as two toggles; both off removes the feature. Same saved shape.
const capSides = (caps, modes, c) => {
  if (!caps.includes(c)) return { view: false, edit: false };
  const m = modes[c] || 'both';
  return { view: m !== 'edit', edit: m !== 'view' };
};
const flipCapSide = (caps, modes, c, side) => {
  const next = { ...capSides(caps, modes, c) };
  next[side] = !next[side];
  if (!next.view && !next.edit) return [caps.filter((x) => x !== c), modes];
  const mode = next.view && next.edit ? 'both' : (next.view ? 'view' : 'edit');
  return [caps.includes(c) ? caps : [...caps, c], { ...modes, [c]: mode }];
};

function PhoneCapList({ caps, modes, onChange }) {
  return (
    <ul className="amp-caps" data-testid="cap-list">
      {ALL_CAPS.map((c) => {
        const on = capSides(caps, modes, c);
        return (
          <li key={c}>
            <span className="amp-cap-label">{CAP_LABELS[c]}</span>
            <span className="amp-cap-toggles">
              {['view', 'edit'].map((side) => (
                <button key={side} type="button" className="amp-toggle" aria-pressed={on[side]}
                  aria-label={`${CAP_LABELS[c]}: ${side}`} data-testid={`cap-${c}-${side}`}
                  onClick={() => onChange(...flipCapSide(caps, modes, c, side))}>
                  {side === 'view' ? 'View' : 'Edit'}
                </button>
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

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

export default function AdminRoles() {
  const { user } = useAuth();
  const founder = roleIsFounder(user);

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('ops_regular');
  const [newPassword, setNewPassword] = useState('');
  const [adding, setAdding] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);   // staff member pending deletion
  const [deleteConfirm, setDeleteConfirm] = useState('');   // must read DELETE to arm the button
  const [selectedCats, setSelectedCats] = useState([]);
  const [savingCats, setSavingCats] = useState(false);
  const [customCat, setCustomCat] = useState('');
  // Custom-admin config (new-admin form)
  const [newCaps, setNewCaps] = useState([]);
  const [newCapModes, setNewCapModes] = useState({});
  const [newScope, setNewScope] = useState('all');

  // Change-password modal: step 1 re-authenticates YOU, step 2 sets their new password.
  const [pwdMember, setPwdMember] = useState(null);
  const [pwdStep, setPwdStep] = useState('current'); // 'current' | 'new'
  const [curPwd, setCurPwd] = useState('');
  const [nextPwd, setNextPwd] = useState('');
  const [nextPwd2, setNextPwd2] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  // Custom-access editor for an existing member
  const [accessMember, setAccessMember] = useState(null);
  const [accessCaps, setAccessCaps] = useState([]);
  const [accessCapModes, setAccessCapModes] = useState({});
  const [accessScope, setAccessScope] = useState('all');
  const [savingAccess, setSavingAccess] = useState(false);
  // Which custom-admin rows have their full feature list expanded inline.
  const [expandedCaps, setExpandedCaps] = useState(() => new Set());
  const toggleExpandCaps = (id) => setExpandedCaps((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  // Phone (PWA) view state
  const isPhone = useIsPhone();
  const [phoneMemberId, setPhoneMemberId] = useState(null);
  const [phoneRolesOpen, setPhoneRolesOpen] = useState(false);
  const [phoneSheet, setPhoneSheet] = useState(null); // 'invite' | 'revoke'

  useLiveEffect(() => { fetchStaff(); fetchCategories(); }, []);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/admin/categories`);
      const fromApi = res.data?.categories || [];
      // Merge any extra values present in real applications with the canonical
      // list, and fall back to the canonical list if the API returns nothing.
      const merged = [...new Set([...(fromApi.length ? fromApi : FALLBACK_CATEGORIES), ...(res.data?.present || [])])];
      setCategoryOptions(merged.length ? merged : FALLBACK_CATEGORIES);
    } catch {
      setCategoryOptions(FALLBACK_CATEGORIES);
    }
  };

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/staff`);
      setStaff(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (member, admin_role) => {
    if (admin_role === member.admin_role) return;
    // Custom needs a capability + scope selection — open the access editor.
    if (admin_role === 'custom') { openAccessEditor(member); return; }
    setSavingId(member.id);
    try {
      await axios.post(`${API}/admin/staff/role`, { user_id: member.id, admin_role });
      toast.success(`${member.email} → ${ROLE_LABELS[admin_role]}`);
      fetchStaff();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to update role'));
    } finally {
      setSavingId(null);
    }
  };

  // ── Custom-admin access editor (capabilities + creator/brand scope) ──
  const openAccessEditor = (m) => {
    setAccessMember(m);
    setAccessCaps(m.admin_caps || []);
    setAccessCapModes(Object.fromEntries(
      (m.admin_caps || []).map((cap) => [cap, m.admin_cap_modes?.[cap] || 'both'])
    ));
    setAccessScope(m.admin_scope || 'all');
  };
  const toggleAccessCap = (c) => {
    setAccessCaps((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
    setAccessCapModes((cur) => ({ ...cur, [c]: cur[c] || 'both' }));
  };
  const saveAccess = async () => {
    setSavingAccess(true);
    try {
      await axios.post(`${API}/admin/staff/role`, {
        user_id: accessMember.id,
        admin_role: 'custom',
        admin_caps: accessCaps,
        admin_cap_modes: Object.fromEntries(accessCaps.map((cap) => [cap, accessCapModes[cap] || 'both'])),
        admin_scope: accessScope,
      });
      toast.success(`Custom access saved for ${accessMember.email}`);
      setAccessMember(null);
      fetchStaff();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to save custom access'));
    } finally {
      setSavingAccess(false);
    }
  };

  const addAdmin = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) { toast.error('Enter an email'); return; }
    // The founder always sets the password explicitly — nothing is auto-generated.
    const pwd = newPassword.trim();
    if (!pwd) { toast.error('Set a password for the new admin'); return; }
    if (pwd.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setAdding(true);
    try {
      const payload = { email, admin_role: newRole, password: pwd };
      if (newRole === 'custom') {
        payload.admin_caps = newCaps;
        payload.admin_cap_modes = Object.fromEntries(newCaps.map((cap) => [cap, newCapModes[cap] || 'both']));
        payload.admin_scope = newScope;
      }
      const res = await axios.post(`${API}/admin/staff/role`, payload);
      if (res.data?.created) {
        toast.success(`${email} created as ${ROLE_LABELS[newRole]}. They can log in with the password you set.`, { duration: 8000 });
      } else if (res.data?.password_set) {
        toast.success(`${email} set to ${ROLE_LABELS[newRole]} · password updated`);
      } else {
        toast.success(`${email} set to ${ROLE_LABELS[newRole]}`);
      }
      setNewEmail('');
      setNewPassword('');
      setNewCaps([]);
      setNewCapModes({});
      setNewScope('all');
      fetchStaff();
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to add admin'));
    } finally {
      setAdding(false);
    }
  };

  // Change an existing admin's password (founder-only). Opens a two-step card:
  // 1) confirm YOUR OWN password, 2) set their new password.
  const changePassword = (member) => {
    setPwdMember(member);
    setPwdStep('current');
    setCurPwd('');
    setNextPwd('');
    setNextPwd2('');
  };

  const closePwdModal = () => {
    if (pwdBusy) return;
    setPwdMember(null);
    setCurPwd('');
    setNextPwd('');
    setNextPwd2('');
  };

  // Step 1 — re-authenticate the founder with their own password.
  const confirmCurrentPassword = async (e) => {
    e.preventDefault();
    if (!curPwd.trim()) { toast.error('Enter your current password'); return; }
    setPwdBusy(true);
    try {
      await axios.post(`${API}/auth/verify-password`, { password: curPwd });
      setPwdStep('new');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Incorrect password'));
    } finally {
      setPwdBusy(false);
    }
  };

  // Alternative to setting a password yourself: email the admin a reset code so
  // they choose their own password (reuses the standard forgot-password flow).
  const sendResetEmail = async () => {
    const member = pwdMember;
    setPwdBusy(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email: member.email });
      toast.success(`Reset code emailed to ${member.email} - the email links them straight to set a new password.`);
      setPwdMember(null);
      setCurPwd('');
      setNextPwd('');
      setNextPwd2('');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send the reset email'));
    } finally {
      setPwdBusy(false);
    }
  };

  // Step 2 — set the member's new password (reuses /admin/staff/role).
  const submitNewPassword = async (e) => {
    e.preventDefault();
    const p = nextPwd.trim();
    if (p.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (p !== nextPwd2.trim()) { toast.error('Passwords do not match'); return; }
    const member = pwdMember;
    setPwdBusy(true);
    setSavingId(member.id);
    try {
      await axios.post(`${API}/admin/staff/role`, {
        user_id: member.id,
        admin_role: member.admin_role,
        password: p,
        ...(member.admin_role === 'custom'
          ? {
              admin_caps: member.admin_caps || [],
              admin_cap_modes: member.admin_cap_modes || {},
              admin_scope: member.admin_scope || 'all'
            }
          : {}),
      });
      toast.success(`Password updated for ${member.email}`);
      setPwdMember(null);
      setCurPwd('');
      setNextPwd('');
      setNextPwd2('');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to change password'));
    } finally {
      setPwdBusy(false);
      setSavingId(null);
    }
  };

  const revoke = async (member) => {
    setSavingId(member.id);
    try {
      await axios.post(`${API}/admin/staff/revoke`, { user_id: member.id });
      toast.success(`Revoked admin from ${member.email}`);
      fetchStaff();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to revoke'));
    } finally {
      setSavingId(null);
    }
  };

  // Permanently delete a staff member (founder-only). Unlike Revoke — which just
  // demotes them back to a normal user — this removes the account entirely, so it
  // asks the founder to type DELETE rather than relying on a one-click OK.
  const confirmDeleteStaff = async () => {
    const member = deleteTarget;
    if (!member || deleteConfirm.trim().toUpperCase() !== 'DELETE') return;
    setSavingId(member.id);
    try {
      await axios.delete(`${API}/admin/user/${member.id}`);
      toast.success(`Deleted ${member.email}`);
      setDeleteTarget(null);
      setDeleteConfirm('');
      fetchStaff();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to delete'));
    } finally {
      setSavingId(null);
    }
  };

  // ── Category work distribution ──
  const toggleCat = (c) => setSelectedCats((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
  const addCustomCat = () => {
    const v = customCat.trim();
    if (!v) return;
    if (!selectedCats.includes(v)) setSelectedCats((cur) => [...cur, v]);
    setCustomCat('');
  };
  const saveCats = async () => {
    setSavingCats(true);
    try {
      await axios.post(`${API}/admin/staff/categories`, { user_id: editingMember.id, categories: selectedCats });
      toast.success(`Updated categories for ${editingMember.email}`);
      setEditingMember(null);
      fetchStaff();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to update categories'));
    } finally {
      setSavingCats(false);
    }
  };

  // ===================== Phone (PWA) layout =====================
  // Same state, handlers, endpoints and confirmations as desktop. The wide tables
  // become cards; modals become full-screen pages or bottom sheets.
  if (isPhone) {
    const member = staff.find((m) => m.id === phoneMemberId) || null;
    const locked = member?.admin_role === 'founder';
    const busy = !!member && savingId === member.id;
    const short = (v) => v.trim().length > 0 && v.trim().length < 6;
    const badEmail = newEmail.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim());
    const roleBadge = (m) => (
      <span className={`am-badge am-badge--${m.admin_role === 'founder' ? 'info' : 'neutral'}`}>
        {m.admin_role === 'founder' && <Crown size={12} />} {ROLE_LABELS[m.admin_role] || m.role}
      </span>
    );
    const statusBadge = (m) => (m.banned
      ? <span className="am-badge am-badge--bad">Banned</span>
      : m.suspended ? <span className="am-badge am-badge--wait">Suspended</span>
        : <span className="am-badge am-badge--ok">Active</span>);
    const closeInvite = () => { if (!adding) setPhoneSheet(null); };
    const invite = async () => { if (await addAdmin()) setPhoneSheet(null); };
    const confirmRevoke = async () => { await revoke(member); setPhoneSheet(null); };
    const closeDelete = () => { if (!deleteTarget || savingId !== deleteTarget.id) setDeleteTarget(null); };
    const scopeField = (id, value, onChange) => (
      <div className="am-field">
        <label htmlFor={id}>This admin manages</label>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    );

    return (
      <AdminLayout>
        <div className="am amp" data-testid="roles-phone">
          <section className="am-section">
            <p className="amp-note"><ShieldCheck size={18} /> <span>You are signed in as <strong>{ROLE_LABELS[user?.admin_role] || 'Founder / Admin'}</strong></span></p>
            {founder && <span className="am-badges"><span className="am-badge am-badge--info"><Crown size={12} /> Full access</span></span>}
            {!founder && (
              <p className="amp-note amp-note--wait"><ShieldAlert size={16} /> <span>Only the Founder can add admins, change roles, passwords or remove admins. You can view the team below.</span></p>
            )}
          </section>

          <ul className="am-rows">
            <li>
              <button type="button" className="am-row" onClick={() => setPhoneRolesOpen(true)} data-testid="roles-structure-row">
                <Layers size={20} /><span className="am-row-label">Role structure</span><ChevronRight size={18} className="am-row-chevron" />
              </button>
            </li>
          </ul>

          <div className="am-section-head">
            <h2 className="am-section-title">Admin team {staff.length > 0 && <span className="am-chip-count">{staff.length}</span>}</h2>
            {founder && (
              <button type="button" className="am-btn am-btn--primary am-btn--sm" onClick={() => setPhoneSheet('invite')} data-testid="roles-invite">
                <UserPlus size={16} /> Add admin
              </button>
            )}
          </div>

          {loading ? <p className="am-empty">Loading team…</p> : staff.length === 0 ? <p className="am-empty">No admin staff found.</p> : (
            <div className="am-list">
              {staff.map((m) => (
                <button type="button" className="am-card" key={m.id} onClick={() => setPhoneMemberId(m.id)} data-testid={`staff-card-${m.id}`}>
                  <span className="am-card-head">
                    <span className="am-avatar" aria-hidden="true">{memberName(m)[0]?.toUpperCase()}</span>
                    <span className="am-card-main">
                      <span className="am-card-title">{memberName(m)}</span>
                      <span className="am-card-sub">{maskEmail(m.email)}</span>
                    </span>
                    <ChevronRight size={18} className="am-row-chevron" />
                  </span>
                  <span className="am-badges">
                    {roleBadge(m)}
                    {m.admin_role === 'custom' && <span className="am-badge am-badge--neutral">{SCOPE_LABELS[m.admin_scope || 'all']}</span>}
                    {statusBadge(m)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ---- Role structure reference ---- */}
          {phoneRolesOpen && (
            <div className="am-detail" role="dialog" aria-modal="true" aria-label="Role structure">
              <header className="am-detail-head">
                <button type="button" className="am-icon-btn" aria-label="Back" onClick={() => setPhoneRolesOpen(false)}><ArrowLeft size={22} /></button>
                <h1>Role structure</h1>
              </header>
              <div className="am-detail-body">
                {ROLE_MATRIX.map((r) => (
                  <section className="am-section" key={r.role}>
                    <span className="am-badges">{roleBadge({ admin_role: r.role })}</span>
                    <p className="amp-note amp-note--ok"><Check size={16} /> <span>{r.canDo}</span></p>
                    {r.cannotDo === '-'
                      ? <p className="am-muted">No restrictions</p>
                      : <p className="amp-note amp-note--bad"><X size={16} /> <span>{r.cannotDo}</span></p>}
                  </section>
                ))}
              </div>
            </div>
          )}

          {/* ---- Member detail ---- */}
          {member && (
            <div className="am-detail" role="dialog" aria-modal="true" aria-label={memberName(member)} data-testid="staff-detail">
              <header className="am-detail-head">
                <button type="button" className="am-icon-btn" aria-label="Back" onClick={() => setPhoneMemberId(null)} data-testid="staff-detail-back"><ArrowLeft size={22} /></button>
                <h1>{memberName(member)}</h1>
              </header>
              <div className="am-detail-body">
                <div className="am-identity">
                  <span className="am-avatar am-avatar--lg" aria-hidden="true">{memberName(member)[0]?.toUpperCase()}</span>
                  <div className="am-card-main">
                    <h2>{memberName(member)}</h2>
                    <span className="am-card-sub">{member.email}</span>
                    <span className="am-badges">{roleBadge(member)}{statusBadge(member)}</span>
                  </div>
                </div>

                <section className="am-section">
                  <h3>Role</h3>
                  {founder && !locked ? (
                    <div className="am-field">
                      <label htmlFor="arl-ph-role">Admin role</label>
                      <select id="arl-ph-role" value={member.admin_role} disabled={busy} onChange={(e) => changeRole(member, e.target.value)} data-testid="staff-detail-role">
                        {ADMIN_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <span className="am-field-hint">{busy ? 'Saving…' : 'Changes save immediately. Custom Admin opens the feature picker.'}</span>
                    </div>
                  ) : (
                    <>
                      <span className="am-badges">{roleBadge(member)}</span>
                      <p className="am-muted">{locked ? 'The Founder role is locked: it can’t be changed, revoked or deleted.' : 'Only the Founder can change roles.'}</p>
                    </>
                  )}
                </section>

                {member.admin_role === 'custom' && (
                  <section className="am-section">
                    <h3>Custom access</h3>
                    <div className="am-kv"><span>Manages</span><span>{SCOPE_LABELS[member.admin_scope || 'all']}</span></div>
                    {(member.admin_caps || []).length ? (
                      member.admin_caps.map((c) => (
                        <div className="am-kv" key={c}><span>{CAP_LABELS[c] || c}</span><span>{ACCESS_MODE_LABELS[member.admin_cap_modes?.[c] || 'both']}</span></div>
                      ))
                    ) : <p className="am-muted">No features yet</p>}
                    {founder && (
                      <button type="button" className="am-btn am-btn--secondary" onClick={() => openAccessEditor(member)} data-testid="staff-edit-access">Edit access</button>
                    )}
                  </section>
                )}

                <section className="am-section">
                  <h3>Account</h3>
                  {founder ? (
                    <ul className="am-rows">
                      <li>
                        <button type="button" className="am-row" onClick={() => changePassword(member)} disabled={busy} data-testid="staff-change-password">
                          <KeyRound size={20} /><span className="am-row-label">Change password</span><ChevronRight size={18} className="am-row-chevron" />
                        </button>
                      </li>
                      {!locked && (
                        <li>
                          <button type="button" className="am-row" onClick={() => setPhoneSheet('revoke')} disabled={busy} data-testid="staff-revoke">
                            <UserMinus size={20} /><span className="am-row-label">Revoke admin access</span><ChevronRight size={18} className="am-row-chevron" />
                          </button>
                        </li>
                      )}
                      {!locked && (
                        <li>
                          <button type="button" className="am-row" style={{ color: 'var(--am-bad-fg)' }} onClick={() => { setDeleteTarget(member); setDeleteConfirm(''); }} disabled={busy} data-testid="staff-delete">
                            <Trash2 size={20} /><span className="am-row-label">Delete account</span><ChevronRight size={18} className="am-row-chevron" />
                          </button>
                        </li>
                      )}
                    </ul>
                  ) : <p className="am-muted">Only the Founder can change passwords, revoke or delete admins.</p>}
                  {founder && locked && <p className="am-muted">The Founder account can’t be revoked or deleted.</p>}
                </section>
              </div>
            </div>
          )}

          {/* ---- Custom access editor (per-capability View / Edit) ---- */}
          {accessMember && (
            <div className="am-detail" role="dialog" aria-modal="true" aria-label="Custom access" data-testid="access-editor">
              <header className="am-detail-head">
                <button type="button" className="am-icon-btn" aria-label="Back" onClick={() => setAccessMember(null)} disabled={savingAccess}><ArrowLeft size={22} /></button>
                <h1>Custom access - {memberName(accessMember)}</h1>
              </header>
              <div className="am-detail-body">
                <p className="am-muted">Pick which side of the marketplace this admin manages and exactly which features they can use.</p>
                <section className="am-section">{scopeField('arl-ph-access-scope', accessScope, setAccessScope)}</section>
                <section className="am-section">
                  <div className="am-section-head">
                    <h3>Features</h3>
                    <span className="am-muted">{accessCaps.length} of {ALL_CAPS.length}</span>
                  </div>
                  <div className="amp-btns">
                    <button type="button" className="am-btn am-btn--secondary am-btn--sm" onClick={() => {
                      const selecting = accessCaps.length !== ALL_CAPS.length;
                      setAccessCaps(selecting ? [...ALL_CAPS] : []);
                      if (selecting) setAccessCapModes(Object.fromEntries(ALL_CAPS.map((cap) => [cap, accessCapModes[cap] || 'both'])));
                    }}>
                      {accessCaps.length === ALL_CAPS.length ? 'Deselect all' : 'Select all'}
                    </button>
                    <button type="button" className="am-btn am-btn--secondary am-btn--sm" onClick={() => { setAccessCaps([]); setAccessCapModes({}); }}>Clear</button>
                  </div>
                  <PhoneCapList caps={accessCaps} modes={accessCapModes} onChange={(c, m) => { setAccessCaps(c); setAccessCapModes(m); }} />
                </section>
              </div>
              <div className="am-actionbar">
                <span className="am-muted">{accessCaps.length} feature{accessCaps.length === 1 ? '' : 's'} · {SCOPE_LABELS[accessScope]}</span>
                <button type="button" className="am-btn am-btn--primary" onClick={saveAccess} disabled={savingAccess} data-testid="access-save">
                  {savingAccess ? 'Saving…' : 'Save access'}
                </button>
              </div>
            </div>
          )}

          {/* ---- Add admin (invite) ---- */}
          {phoneSheet === 'invite' && founder && (
            <PhoneSheet title="Add admin" onClose={closeInvite} testId="invite-sheet" foot={(
              <>
                <button type="button" className="am-btn am-btn--secondary" onClick={closeInvite} disabled={adding}>Cancel</button>
                <button type="button" className="am-btn am-btn--primary" onClick={invite} disabled={adding} data-testid="invite-submit">
                  <UserPlus size={18} /> {adding ? 'Adding…' : 'Grant access'}
                </button>
              </>
            )}>
              <div className="am-field">
                <label htmlFor="arl-ph-email">Email</label>
                <input id="arl-ph-email" type="email" inputMode="email" autoComplete="off" autoCapitalize="off" value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.com" data-testid="invite-email" />
                {badEmail ? <span className="am-field-error">Enter a valid email address.</span>
                  : <span className="am-field-hint">Creates the account if it doesn&apos;t exist yet.</span>}
              </div>
              <div className="am-field">
                <label htmlFor="arl-ph-pwd">Password</label>
                <input id="arl-ph-pwd" type="text" autoComplete="new-password" autoCapitalize="off" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" data-testid="invite-password" />
                {short(newPassword) ? <span className="am-field-error">Password must be at least 6 characters.</span>
                  : <span className="am-field-hint">They log in with this password. Nothing is auto-generated.</span>}
              </div>
              <div className="am-field">
                <label htmlFor="arl-ph-newrole">Role</label>
                <select id="arl-ph-newrole" value={newRole} onChange={(e) => setNewRole(e.target.value)} data-testid="invite-role">
                  {ADMIN_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {newRole === 'custom' && (
                <>
                  {scopeField('arl-ph-newscope', newScope, setNewScope)}
                  <div className="am-field">
                    <span className="am-field-label">Features this admin can use</span>
                    <PhoneCapList caps={newCaps} modes={newCapModes} onChange={(c, m) => { setNewCaps(c); setNewCapModes(m); }} />
                  </div>
                </>
              )}
            </PhoneSheet>
          )}

          {/* ---- Revoke ---- */}
          {phoneSheet === 'revoke' && member && founder && !locked && (
            <PhoneSheet title="Revoke admin access?" onClose={() => { if (!busy) setPhoneSheet(null); }} testId="revoke-sheet" foot={(
              <>
                <button type="button" className="am-btn am-btn--secondary" onClick={() => setPhoneSheet(null)} disabled={busy}>Cancel</button>
                <button type="button" className="am-btn am-btn--danger" onClick={confirmRevoke} disabled={busy} data-testid="revoke-confirm">{busy ? 'Revoking…' : 'Revoke'}</button>
              </>
            )}>
              <p className="am-muted"><strong>{member.email}</strong> goes back to a normal user. Their account and data are kept.</p>
            </PhoneSheet>
          )}

          {/* ---- Delete (type DELETE, same as desktop) ---- */}
          {deleteTarget && (
            <PhoneSheet title="Delete this admin?" onClose={closeDelete} testId="delete-sheet" foot={(
              <>
                <button type="button" className="am-btn am-btn--secondary" onClick={closeDelete}>Cancel</button>
                <button type="button" className="am-btn am-btn--danger" onClick={confirmDeleteStaff}
                  disabled={deleteConfirm.trim().toUpperCase() !== 'DELETE' || savingId === deleteTarget.id} data-testid="delete-confirm">
                  {savingId === deleteTarget.id ? 'Deleting…' : 'Delete account'}
                </button>
              </>
            )}>
              <p className="amp-note amp-note--bad"><AlertTriangle size={16} /> <span><strong>{deleteTarget.email}</strong> - this permanently removes their account and all of their data. It cannot be undone.</span></p>
              <p className="am-muted">Only want to take away their admin powers? Cancel and use <b>Revoke</b> instead - that keeps the account.</p>
              <div className="am-field">
                <label htmlFor="arl-ph-del">Type DELETE to confirm</label>
                <input id="arl-ph-del" autoComplete="off" autoCapitalize="characters" value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" data-testid="delete-input" />
              </div>
            </PhoneSheet>
          )}

          {/* ---- Change password (2 steps, same endpoints) ---- */}
          {pwdMember && (
            <PhoneSheet title="Change password" onClose={closePwdModal} testId="pwd-sheet">
              <p className="am-muted">{pwdMember.email}</p>
              <div className="amp-steps">
                <span className={pwdStep === 'current' ? 'is-on' : 'is-done'}>1. Confirm it&apos;s you</span>
                <span className={pwdStep === 'new' ? 'is-on' : ''}>2. New password</span>
              </div>
              {pwdStep === 'current' ? (
                <form className="amp-form" onSubmit={confirmCurrentPassword}>
                  <div className="am-field">
                    <label htmlFor="arl-ph-cur">Your current password</label>
                    <input id="arl-ph-cur" type="password" autoComplete="current-password" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} />
                    <span className="am-field-hint">Confirm your own password before setting another admin&apos;s password yourself.</span>
                  </div>
                  <button type="submit" className="am-btn am-btn--primary" disabled={pwdBusy}>{pwdBusy ? 'Checking…' : 'Continue'}</button>
                  <button type="button" className="am-btn am-btn--secondary" onClick={sendResetEmail} disabled={pwdBusy}>
                    <Mail size={18} /> Email them a reset code instead
                  </button>
                  <span className="am-field-hint">Sends a 6-digit reset code to {pwdMember.email} so they set their own password.</span>
                </form>
              ) : (
                <form className="amp-form" onSubmit={submitNewPassword}>
                  <div className="am-field">
                    <label htmlFor="arl-ph-new">New password</label>
                    <input id="arl-ph-new" type="password" autoComplete="new-password" value={nextPwd} onChange={(e) => setNextPwd(e.target.value)} placeholder="At least 6 characters" />
                    {short(nextPwd) && <span className="am-field-error">Password must be at least 6 characters.</span>}
                  </div>
                  <div className="am-field">
                    <label htmlFor="arl-ph-new2">Confirm new password</label>
                    <input id="arl-ph-new2" type="password" autoComplete="new-password" value={nextPwd2} onChange={(e) => setNextPwd2(e.target.value)} />
                    {nextPwd2.trim() && nextPwd2.trim() !== nextPwd.trim() && <span className="am-field-error">Passwords do not match.</span>}
                  </div>
                  <div className="am-actionbar-row">
                    <button type="button" className="am-btn am-btn--secondary" onClick={() => setPwdStep('current')} disabled={pwdBusy}>Back</button>
                    <button type="submit" className="am-btn am-btn--primary" disabled={pwdBusy}>{pwdBusy ? 'Saving…' : 'Update password'}</button>
                  </div>
                </form>
              )}
            </PhoneSheet>
          )}
        </div>
      </AdminLayout>
    );
  }


  return (
    <AdminLayout>
      <div className="arl">
        <div className={`arl-you arl-${ROLE_TONE[user?.admin_role] || 'founder'}`}>
          <ShieldCheck size={18} />
          <span>You are signed in as <strong>{ROLE_LABELS[user?.admin_role] || 'Founder / Admin'}</strong></span>
          {founder && <span className="arl-you-tag"><Crown size={12} /> full access</span>}
        </div>

        {!founder && (
          <div className="arl-lock"><ShieldAlert size={16} /> Only the Founder can assign or change admin roles. You can view the structure below.</div>
        )}

        {/* Role structure reference (PRD 11) */}
        <section className="arl-card">
          <h3>Role structure</h3>
          <div className="arl-table-wrap">
            <table className="arl-table">
              <thead>
                <tr><th>Role</th><th>Can do</th><th>Cannot do</th></tr>
              </thead>
              <tbody>
                {ROLE_MATRIX.map((r) => (
                  <tr key={r.role}>
                    <td><span className={`arl-badge ${ROLE_TONE[r.role]}`}>{ROLE_LABELS[r.role]}</span></td>
                    <td className="arl-can"><Check size={13} /> {r.canDo}</td>
                    <td className="arl-cant">{r.cannotDo === '-' ? <span className="arl-none">No restrictions</span> : <><X size={13} /> {r.cannotDo}</>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Team */}
        <section className="arl-card">
          <h3>Admin team {staff.length > 0 && <span className="arl-count">{staff.length}</span>}</h3>

          {founder && (
            <div className="arl-add">
              <input
                type="email"
                placeholder="Email to grant admin (creates account if new)"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                data-testid="roles-new-email"
              />
              <input
                type="text"
                placeholder="Set a password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                data-testid="roles-new-password"
              />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} data-testid="roles-new-role">
                {ADMIN_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button className="arl-add-btn" onClick={addAdmin} disabled={adding} data-testid="roles-add">
                <UserPlus size={15} /> {adding ? 'Adding…' : 'Grant access'}
              </button>
            </div>
          )}

          {founder && newRole === 'custom' && (
            <div className="arl-custom-box">
              <div className="arl-custom-scope">
                <label>This admin manages</label>
                <select value={newScope} onChange={(e) => setNewScope(e.target.value)}>
                  {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <label className="arl-custom-title">Features this admin can use</label>
              <div className="arl-cap-grid">
                {ALL_CAPS.map((c) => (
                  <div key={c} className={`arl-cap-opt ${newCaps.includes(c) ? 'on' : ''}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={newCaps.includes(c)}
                        onChange={() => {
                          setNewCaps((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
                          setNewCapModes((cur) => ({ ...cur, [c]: cur[c] || 'both' }));
                        }}
                      /> {CAP_LABELS[c]}
                    </label>
                    {newCaps.includes(c) && (
                      <select value={newCapModes[c] || 'both'} onChange={(e) => setNewCapModes((cur) => ({ ...cur, [c]: e.target.value }))}>
                        {Object.entries(ACCESS_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <SkeletonTable rows={5} cols={3} />
          ) : staff.length === 0 ? (
            <p className="arl-muted">No admin staff found.</p>
          ) : (
            <div className="arl-table-wrap">
              <table className="arl-table">
                <thead>
                  <tr><th>Member</th><th>Role</th><th></th></tr>
                </thead>
                <tbody>
                  {staff.map((m) => {
                    const locked = m.admin_role === 'founder'; // founder can't be demoted
                    return (
                      <tr key={m.id} data-testid={`staff-row-${m.id}`}>
                        <td>
                          <div className="arl-member">
                            <span className="arl-avatar">{String(m.full_name || m.name || m.nickname || m.email).replace(/^@+/, '')[0]?.toUpperCase()}</span>
                            <div>
                              <strong>{String(m.full_name || m.name || m.nickname || m.email.split('@')[0]).replace(/^@+/, '')}</strong>
                              <span className="arl-email">{m.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="arl-role-cell">
                            {founder && !locked ? (
                              <select
                                value={m.admin_role}
                                disabled={savingId === m.id}
                                onChange={(e) => changeRole(m, e.target.value)}
                                data-testid={`staff-role-${m.id}`}
                              >
                                {ADMIN_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                              </select>
                            ) : (
                              <span className={`arl-badge ${ROLE_TONE[m.admin_role]}`}>
                                {m.admin_role === 'founder' && <Crown size={12} />} {ROLE_LABELS[m.admin_role]}
                              </span>
                            )}
                            {/* For a Custom Admin, surface their scope + granted features
                                inline (fills the space next to the dropdown) + an edit shortcut. */}
                            {m.admin_role === 'custom' && (
                              <div className="arl-custom-inline">
                                <span className="arl-scope-chip">{SCOPE_LABELS[m.admin_scope || 'all']}</span>
                                {(m.admin_caps && m.admin_caps.length) ? (
                                  (() => {
                                    const expanded = expandedCaps.has(m.id);
                                    const shown = expanded ? m.admin_caps : m.admin_caps.slice(0, 3);
                                    const hidden = m.admin_caps.length - shown.length;
                                    return (
                                      <>
                                        {shown.map((c) => (
                                          <span key={c} className="arl-feat-chip">
                                            {CAP_LABELS[c] || c} · {ACCESS_MODE_LABELS[m.admin_cap_modes?.[c] || 'both']}
                                          </span>
                                        ))}
                                        {hidden > 0 && (
                                          <button type="button" className="arl-feat-chip arl-feat-more" onClick={() => toggleExpandCaps(m.id)}>+{hidden} more</button>
                                        )}
                                        {expanded && m.admin_caps.length > 3 && (
                                          <button type="button" className="arl-feat-chip arl-feat-more" onClick={() => toggleExpandCaps(m.id)}>Show less</button>
                                        )}
                                      </>
                                    );
                                  })()
                                ) : (
                                  <span className="arl-muted arl-nofeat">No features yet</span>
                                )}
                                {founder && (
                                  <button className="arl-cat-edit arl-inline-edit" onClick={() => openAccessEditor(m)}>Edit access</button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* The <td> itself must stay a table cell — it used to be
                            display:flex, which drops it out of the table layout and
                            is why the buttons wrapped and every row was a different
                            height. Flex lives on the wrapper instead. */}
                        <td className="arl-row-actions">
                          <div className="arl-actions">
                            {founder && (
                              <button className="arl-pwd" onClick={() => changePassword(m)} disabled={savingId === m.id}>Change password</button>
                            )}
                            {founder && !locked && (
                              <button className="arl-revoke" onClick={() => revoke(m)} disabled={savingId === m.id}>Revoke</button>
                            )}
                            {/* Revoke = demote to a normal user. Delete = remove the account entirely.
                                The founder row is locked and can never be deleted. */}
                            {founder && !locked && (
                              <button className="arl-delete" onClick={() => { setDeleteTarget(m); setDeleteConfirm(''); }} disabled={savingId === m.id}>Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Irreversible + destructive, so it gets a real modal that names exactly what is
            lost, points at Revoke as the softer option, and requires typing DELETE. */}
        {deleteTarget && (
          <div className="arl-modal-overlay" onClick={() => setDeleteTarget(null)}>
            <div className="arl-modal arl-modal-sm" onClick={(e) => e.stopPropagation()}>
              <div className="arl-modal-head">
                <h3 className="arl-danger-title"><AlertTriangle size={18} /> Delete this admin?</h3>
                <button onClick={() => setDeleteTarget(null)} aria-label="Close"><X size={18} /></button>
              </div>

              <div className="arl-del-who">
                <strong>{deleteTarget.nickname || deleteTarget.email.split('@')[0]}</strong>
                <span>{deleteTarget.email}</span>
              </div>

              <p className="arl-modal-sub">
                This permanently removes their account and all of their data. <b>It cannot be undone.</b>
              </p>
              <div className="arl-del-hint">
                Only want to take away their admin powers? Close this and use <b>Revoke</b> - that
                demotes them to a normal user and keeps the account.
              </div>

              <label className="arl-del-label">
                Type <b>DELETE</b> to confirm
                <input
                  autoFocus
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmDeleteStaff(); }}
                  placeholder="DELETE"
                />
              </label>

              <div className="arl-modal-foot">
                <span />
                <div>
                  <button className="arl-revoke" onClick={() => setDeleteTarget(null)}>Cancel</button>
                  <button
                    className="arl-delete-confirm"
                    onClick={confirmDeleteStaff}
                    disabled={deleteConfirm.trim().toUpperCase() !== 'DELETE' || savingId === deleteTarget.id}
                  >
                    {savingId === deleteTarget.id ? 'Deleting…' : 'Delete permanently'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingMember && (
          <div className="arl-modal-overlay" onClick={() => setEditingMember(null)}>
            <div className="arl-modal" onClick={(e) => e.stopPropagation()}>
              <div className="arl-modal-head">
                <h3>Categories - {editingMember.nickname || editingMember.email.split('@')[0]}</h3>
                <button onClick={() => setEditingMember(null)} aria-label="Close"><X size={18} /></button>
              </div>
              <p className="arl-modal-sub">This admin will only see applications whose category matches one of these. Founder &amp; Ops (Senior) always see everything.</p>

              {selectedCats.length > 0 && (
                <div className="arl-cat-selected">
                  {selectedCats.map((c) => (
                    <span key={c} className="arl-cat-chip on">{c}<button onClick={() => toggleCat(c)} aria-label={`Remove ${c}`}>×</button></span>
                  ))}
                </div>
              )}

              <div className="arl-cat-grid">
                {categoryOptions.length === 0 && <p className="arl-muted">No categories found yet.</p>}
                {categoryOptions.map((c) => (
                  <label key={c} className={`arl-cat-opt ${selectedCats.includes(c) ? 'on' : ''}`}>
                    <input type="checkbox" checked={selectedCats.includes(c)} onChange={() => toggleCat(c)} /> {c}
                  </label>
                ))}
              </div>

              <div className="arl-cat-custom">
                <input
                  type="text"
                  placeholder="Add a custom category…"
                  value={customCat}
                  onChange={(e) => setCustomCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCat(); } }}
                />
                <button onClick={addCustomCat} disabled={!customCat.trim()}>+ Add</button>
              </div>
              <div className="arl-modal-foot">
                <span className="arl-muted">{selectedCats.length} selected</span>
                <div>
                  <button className="arl-revoke" onClick={() => setSelectedCats([])}>Clear</button>
                  <button className="arl-add-btn" onClick={saveCats} disabled={savingCats}>{savingCats ? 'Saving…' : 'Save categories'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {accessMember && (
          <div className="arl-modal-overlay" onClick={() => setAccessMember(null)}>
            <div className="arl-modal" onClick={(e) => e.stopPropagation()}>
              <div className="arl-modal-head">
                <h3>Custom access - {accessMember.nickname || accessMember.email.split('@')[0]}</h3>
                <button onClick={() => setAccessMember(null)} aria-label="Close"><X size={18} /></button>
              </div>
              <p className="arl-modal-sub">Pick which side of the marketplace this admin manages and exactly which features they can use.</p>

              <div className="arl-modal-body">
                <div className="arl-custom-scope">
                  <label>This admin manages</label>
                  <select value={accessScope} onChange={(e) => setAccessScope(e.target.value)}>
                    {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div className="arl-custom-title-row">
                  <label className="arl-custom-title">Features</label>
                  <button
                    type="button"
                    className="arl-selectall"
                    onClick={() => {
                      const selecting = accessCaps.length !== ALL_CAPS.length;
                      setAccessCaps(selecting ? [...ALL_CAPS] : []);
                      if (selecting) setAccessCapModes(Object.fromEntries(ALL_CAPS.map((cap) => [cap, accessCapModes[cap] || 'both'])));
                    }}
                  >
                    {accessCaps.length === ALL_CAPS.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="arl-cap-grid">
                  {ALL_CAPS.map((c) => (
                    <div key={c} className={`arl-cap-opt ${accessCaps.includes(c) ? 'on' : ''}`}>
                      <label>
                        <input type="checkbox" checked={accessCaps.includes(c)} onChange={() => toggleAccessCap(c)} /> {CAP_LABELS[c]}
                      </label>
                      {accessCaps.includes(c) && (
                        <select value={accessCapModes[c] || 'both'} onChange={(e) => setAccessCapModes((cur) => ({ ...cur, [c]: e.target.value }))}>
                          {Object.entries(ACCESS_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="arl-modal-foot">
                <span className="arl-muted">{accessCaps.length} feature{accessCaps.length === 1 ? '' : 's'} · {SCOPE_LABELS[accessScope]}</span>
                <div>
                  <button className="arl-revoke" onClick={() => { setAccessCaps([]); setAccessCapModes({}); }}>Clear</button>
                  <button className="arl-add-btn" onClick={saveAccess} disabled={savingAccess}>{savingAccess ? 'Saving…' : 'Save access'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {pwdMember && (
          <div className="arl-pwd-ov" onClick={closePwdModal}>
            <div className="arl-pwd-card" onClick={(e) => e.stopPropagation()}>
              <div className="arl-pwd-head">
                <div>
                  <h3>Change password</h3>
                  <small>{pwdMember.email}</small>
                </div>
                <button type="button" onClick={closePwdModal} aria-label="Close" disabled={pwdBusy}><X size={18} /></button>
              </div>

              <div className="arl-pwd-steps">
                <span className={pwdStep === 'current' ? 'on' : 'done'}>1. Confirm it's you</span>
                <span className={pwdStep === 'new' ? 'on' : ''}>2. New password</span>
              </div>

              {pwdStep === 'current' ? (
                <form onSubmit={confirmCurrentPassword}>
                  <label className="arl-pwd-field">
                    <span>Your current password</span>
                    <input
                      type="password"
                      value={curPwd}
                      onChange={(e) => setCurPwd(e.target.value)}
                      placeholder="Enter your own password"
                      autoFocus
                      autoComplete="current-password"
                    />
                  </label>
                  <p className="arl-pwd-note">For security, confirm your own password before setting another admin's password yourself.</p>
                  <div className="arl-pwd-actions">
                    <button type="button" className="arl-revoke" onClick={closePwdModal} disabled={pwdBusy}>Cancel</button>
                    <button type="submit" className="arl-add-btn" disabled={pwdBusy}>{pwdBusy ? 'Checking…' : 'Continue'}</button>
                  </div>

                  <div className="arl-pwd-alt">
                    <span>or</span>
                  </div>
                  <button type="button" className="arl-pwd-reset" onClick={sendResetEmail} disabled={pwdBusy}>
                    <Mail size={15} /> Email them a reset code instead
                  </button>
                  <p className="arl-pwd-note" style={{ margin: '8px 0 0' }}>
                    Sends a 6-digit reset code to {pwdMember.email} so they set their own password - no password needed from you.
                  </p>
                </form>
              ) : (
                <form onSubmit={submitNewPassword}>
                  <label className="arl-pwd-field">
                    <span>New password for {pwdMember.email}</span>
                    <input
                      type="password"
                      value={nextPwd}
                      onChange={(e) => setNextPwd(e.target.value)}
                      placeholder="At least 6 characters"
                      autoFocus
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="arl-pwd-field">
                    <span>Confirm new password</span>
                    <input
                      type="password"
                      value={nextPwd2}
                      onChange={(e) => setNextPwd2(e.target.value)}
                      placeholder="Re-enter the new password"
                      autoComplete="new-password"
                    />
                  </label>
                  <div className="arl-pwd-actions">
                    <button type="button" className="arl-revoke" onClick={() => setPwdStep('current')} disabled={pwdBusy}>Back</button>
                    <button type="submit" className="arl-add-btn" disabled={pwdBusy}>{pwdBusy ? 'Saving…' : 'Update password'}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .arl { padding: 24px 28px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
        .arl-pwd-ov { position: fixed; inset: 0; background: rgba(15,18,40,0.5); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .arl-pwd-card { background: #fff; width: 100%; max-width: 430px; border-radius: 16px; padding: 22px; box-shadow: 0 30px 70px rgba(7,7,78,0.3); }
        .arl-pwd-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .arl-pwd-head h3 { margin: 0; font-size: 1.1rem; color: #07074e; }
        .arl-pwd-head small { color: #98a1ad; font-size: 0.78rem; word-break: break-all; }
        .arl-pwd-head button { border: none; background: #f3f4f8; width: 30px; height: 30px; border-radius: 8px; cursor: pointer; display: grid; place-items: center; color: #5b6573; flex: none; }
        .arl-pwd-steps { display: flex; gap: 8px; margin-bottom: 16px; }
        .arl-pwd-steps span { flex: 1; text-align: center; font-size: 0.72rem; font-weight: 700; padding: 6px 4px; border-radius: 7px; background: #f3f4f8; color: #98a1ad; }
        .arl-pwd-steps span.on { background: #eef0ff; color: #3730a3; }
        .arl-pwd-steps span.done { background: #e7f7ee; color: #067647; }
        .arl-pwd-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
        .arl-pwd-field > span { font-size: 0.79rem; font-weight: 600; color: #4a4f74; }
        .arl-pwd-field input { border: 1.5px solid #e2e4f0; border-radius: 10px; padding: 10px 12px; font-size: 0.9rem; color: #0f172a; outline: none; width: 100%; }
        .arl-pwd-field input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
        .arl-pwd-note { font-size: 0.75rem; color: #98a1ad; margin: 0 0 14px; line-height: 1.5; }
        .arl-pwd-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .arl-pwd-alt { display: flex; align-items: center; gap: 10px; margin: 16px 0 10px; color: #c3c7dc; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; }
        .arl-pwd-alt::before, .arl-pwd-alt::after { content: ''; flex: 1; height: 1px; background: #eef0f5; }
        .arl-pwd-reset { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid #d6dbff; background: #fff; color: #4452f0; font-weight: 600; font-size: 0.85rem; padding: 10px 12px; border-radius: 10px; cursor: pointer; }
        .arl-pwd-reset:hover:not(:disabled) { background: #eef0ff; }
        .arl-pwd-reset:disabled { opacity: 0.5; cursor: not-allowed; }
        .arl-you { display: flex; align-items: center; gap: 9px; border-radius: 12px; padding: 12px 16px; font-size: 0.9rem; color: #07074e; border: 1px solid #d6dbff; background: #eef0ff; }
        .arl-you strong { font-weight: 700; }
        .arl-you-tag { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #b54708; background: #fff3e0; border: 1px solid #fde6c8; border-radius: 6px; padding: 3px 8px; }
        .arl-you.regular, .arl-you.senior, .arl-you.finance { background:#f9fafb; border-color:#e6e8ec; color:#111827; }
        .arl-lock { display: flex; align-items: center; gap: 8px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; padding: 10px 14px; border-radius: 10px; font-size: 0.85rem; }
        .arl-card { background: #fff; border: 1px solid #e6e8ec; border-radius: 14px; padding: 18px 20px; }
        .arl-card h3 { margin: 0 0 14px; font-size: 1rem; color: #07074e; display: flex; align-items: center; gap: 8px; }
        .arl-count { font-size: 0.72rem; font-weight: 700; color: #4452f0; background: #eef0ff; border-radius: 999px; padding: 2px 9px; }
        .arl-table-wrap { overflow-x: auto; border: 1px solid #f1f5f9; border-radius: 10px; }
        .arl-table { width: 100%; border-collapse: collapse; }
        .arl-table th, .arl-table td { padding: 14px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 0.86rem; vertical-align: middle; }
        .arl-table td:first-child { width: 26%; min-width: 200px; }
        .arl-table th { background: #f9fafb; font-size: 0.7rem; font-weight: 700; color: #5b6573; text-transform: uppercase; letter-spacing: 0.04em; }
        .arl-table tbody tr:last-child td { border-bottom: 0; }
        .arl-can { color: #067647; } .arl-can svg, .arl-cant svg { vertical-align: -2px; margin-right: 3px; }
        .arl-cant { color: #b42318; }
        .arl-none { color: #98a1ad; font-style: italic; }
        .arl-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 11px; border-radius: 999px; font-size: 0.74rem; font-weight: 700; white-space: nowrap; }
        .arl-badge.founder { background: #fef3c7; color: #92400e; }
        .arl-badge.senior  { background: #e0e7ff; color: #3730a3; }
        .arl-badge.regular { background: #ecfdf3; color: #067647; }
        .arl-badge.finance { background: #eaeeff; color: #6b21a8; }
        .arl-badge.custom { background: #e0f2fe; color: #075985; }
        .arl-add { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }

        /* Custom-admin config (add form + editor modal) */
        .arl-custom-box { border: 1px solid #e8ecff; background: #f8f9ff; border-radius: 14px; padding: 16px 18px; margin-bottom: 16px; }
        .arl-custom-scope { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .arl-custom-scope label { font-size: 12.5px; font-weight: 700; color: #4a5568; }
        .arl-custom-scope select { padding: 8px 12px; border: 1px solid #d7dbf0; border-radius: 10px; font-family: inherit; font-size: 14px; color: #1a202c; background: #fff; }
        .arl-custom-title { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #9296ba; margin: 6px 0 10px; }
        /* Scrollable, padded body for the custom-access modal */
        .arl-modal-body { padding: 12px 20px 4px; overflow-y: auto; }
        .arl-modal-body .arl-custom-scope { margin-bottom: 16px; }
        .arl-modal-body .arl-custom-scope select { flex: 1; }
        .arl-custom-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .arl-custom-title-row .arl-custom-title { margin: 6px 0; }
        .arl-selectall { border: 1px solid #d6dbff; background: #fff; color: #4452f0; font-weight: 600; font-size: 12px; padding: 5px 11px; border-radius: 7px; cursor: pointer; }
        .arl-selectall:hover { background: #eef0ff; }
        .arl-cap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
        .arl-cap-opt { display: flex; align-items: center; gap: 8px; padding: 7px 8px 7px 12px; border: 1px solid #e6e8f5; border-radius: 10px; font-size: 13.5px; color: #2d3155; background: #fff; transition: .15s; }
        .arl-cap-opt:hover { border-color: #c9cffb; }
        .arl-cap-opt.on { border-color: #5b6bff; background: #eef0ff; color: #1e2a78; font-weight: 600; }
        .arl-cap-opt label { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .arl-cap-opt input { accent-color: #5b6bff; }
        .arl-cap-opt select { flex: none; height: 32px; border: 1px solid #ccd2f5; border-radius: 8px; padding: 0 8px; background: #fff; color: #252b5c; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
        .arl-custom-cell { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        /* Role cell: the dropdown/badge on its own line, then one wrapping row of
           chips underneath. Laying the select and the chips side by side let the
           chips spill and pushed "Edit access" onto a stray line of its own. */
        .arl-role-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 9px; }
        .arl-role-cell > select { width: 100%; max-width: 190px; }
        .arl-custom-inline { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        /* One chip size, so a row of them sits on a single baseline */
        .arl-scope-chip,
        .arl-feat-chip { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
        .arl-scope-chip { background: #e0f2fe; color: #075985; font-weight: 700; }
        .arl-feat-chip { background: #eef0ff; color: #3730a3; }
        .arl-feat-more { background: #eef1f6; color: #5b6573; border: none; cursor: pointer; font-family: inherit; }
        .arl-feat-more:hover { background: #e2e6ee; color: #3a4250; }
        .arl-nofeat { padding: 0; font-size: 12px; font-style: italic; }
        .arl-inline-edit { margin: 0; height: 24px; padding: 0 10px; font-size: 11.5px; line-height: 1; }
        .arl-add input { flex: 1; min-width: 220px; border: 1px solid #e6e8ec; border-radius: 8px; padding: 9px 12px; font-size: 0.88rem; }
        .arl-add select, .arl-table select { border: 1px solid #e6e8ec; border-radius: 8px; padding: 8px 10px; font-size: 0.85rem; background: #fff; cursor: pointer; }
        .arl-add input:focus, .arl-add select:focus, .arl-table select:focus { outline: none; border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,0.16); }
        .arl-add-btn { display: inline-flex; align-items: center; gap: 7px; border: 1px solid transparent; background: linear-gradient(100deg,#12124f,#07074e); color: #fff; font-weight: 600; padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; box-shadow: 0 12px 26px -12px rgba(7,7,78,.7); }
        .arl-add-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .arl-member { display: flex; align-items: center; gap: 10px; }
        .arl-avatar { width: 34px; height: 34px; flex: none; border-radius: 50%; background: linear-gradient(135deg, #5b6bff, #4452f0); color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; }
        .arl-member strong { display: block; color: #111827; font-size: 0.88rem; }
        .arl-email { font-size: 0.76rem; color: #98a1ad; }
        /* Actions: one right-aligned row that never wraps, so every row's buttons
           line up in the same place regardless of how many chips the role cell has. */
        /* Actions: one right-aligned row that never wraps, so every row's buttons
           line up in the same place regardless of how many chips the role cell has. */
        .arl-row-actions { text-align: right; width: 1%; white-space: nowrap; }
        .arl-actions { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
        .arl-delete { border: 1px solid #f2b8c6; background: #fff5f8; color: #b42318; font-weight: 700; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; white-space: nowrap; }
        .arl-delete:hover { background: #ffe4ec; }
        .arl-delete:disabled { opacity: 0.5; cursor: not-allowed; }
        .arl-pwd { border: 1px solid #d6dbff; background: #fff; color: #4452f0; font-weight: 600; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; white-space: nowrap; }
        .arl-pwd:hover { background: #eef0ff; }
        .arl-pwd:disabled { opacity: 0.5; cursor: not-allowed; }
        .arl-revoke { border: 1px solid #fecdca; background: #fff; color: #b42318; font-weight: 600; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; white-space: nowrap; }
        .arl-revoke:hover { background: #fef3f2; }
        .arl-revoke:disabled { opacity: 0.5; cursor: not-allowed; }
        .arl-muted { color: #98a1ad; font-size: 0.88rem; padding: 8px 2px; }
        .arl-allcats { display: inline-flex; align-items: center; gap: 5px; font-size: 0.8rem; font-weight: 600; color: #067647; }
        .arl-allcats svg { vertical-align: -2px; }
        .arl-cats { display: flex; flex-wrap: wrap; gap: 5px; }
        .arl-cat-chip { display: inline-flex; background: #eef0ff; color: #3730a3; border-radius: 999px; padding: 3px 9px; font-size: 0.72rem; font-weight: 600; }
        .arl-cat-edit { display: block; margin-top: 7px; border: 1px solid #d6dbff; background: #fff; color: #4452f0; font-weight: 600; padding: 5px 11px; border-radius: 7px; cursor: pointer; font-size: 0.76rem; }
        .arl-cat-edit:hover { background: #eef0ff; }
        .arl-modal-overlay { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 24px; background: rgba(7,7,46,0.45); backdrop-filter: blur(4px); }
        .arl-modal { width: min(560px, 100%); max-height: 86vh; display: flex; flex-direction: column; background: #fff; border-radius: 16px; box-shadow: 0 30px 80px -20px rgba(7,7,46,0.5); overflow: hidden; }
        .arl-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #f1f5f9; }
        .arl-modal-head h3 { margin: 0; font-size: 1rem; color: #07074e; }
        .arl-modal-head button { border: 1px solid #e6e8ec; background: #fff; border-radius: 8px; width: 32px; height: 32px; display: grid; place-items: center; cursor: pointer; color: #5b6573; }
        .arl-modal-sub { margin: 0; padding: 14px 20px 6px; color: #5b6573; font-size: 0.84rem; }

        /* Destructive delete-admin modal */
        .arl-modal-sm { width: min(440px, 100%); }
        .arl-danger-title { display: flex; align-items: center; gap: 8px; color: #b42318 !important; }
        .arl-del-who { display: flex; flex-direction: column; gap: 2px; margin: 16px 20px 0; padding: 12px 14px; border: 1px solid #f1f5f9; border-radius: 10px; background: #fafbff; }
        .arl-del-who strong { font-size: 0.92rem; color: #07074e; }
        .arl-del-who span { font-size: 0.8rem; color: #8b90ad; }
        .arl-del-hint { margin: 10px 20px 0; padding: 10px 12px; border-radius: 10px; background: #fff8ec; border: 1px solid #ffe1b0; color: #8a5a00; font-size: 0.79rem; line-height: 1.5; }
        .arl-del-label { display: flex; flex-direction: column; gap: 6px; margin: 16px 20px 4px; font-size: 0.79rem; font-weight: 700; color: #5b6573; }
        .arl-del-label input { border: 1px solid #e6e8f3; border-radius: 10px; padding: 9px 11px; font-size: 0.88rem; font-family: inherit; color: #07074e; outline: none; letter-spacing: 0.04em; }
        .arl-del-label input:focus { border-color: #b42318; box-shadow: 0 0 0 3px rgba(180,35,24,0.12); }
        .arl-delete-confirm { border: none; background: #b42318; color: #fff; font-weight: 700; font-size: 0.84rem; padding: 9px 16px; border-radius: 9px; cursor: pointer; }
        .arl-delete-confirm:hover:not(:disabled) { background: #96190f; }
        .arl-delete-confirm:disabled { opacity: 0.45; cursor: not-allowed; }
        .arl-cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; padding: 8px 20px 18px; overflow-y: auto; }
        .arl-cat-opt { display: flex; align-items: center; gap: 8px; border: 1px solid #e6e8ec; border-radius: 9px; padding: 9px 11px; font-size: 0.83rem; color: #334155; cursor: pointer; }
        .arl-cat-opt.on { border-color: #5b6bff; background: #eef0ff; color: #3730a3; font-weight: 600; }
        .arl-cat-selected { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 20px 0; }
        .arl-cat-chip.on { display: inline-flex; align-items: center; gap: 4px; }
        .arl-cat-chip.on button { border: 0; background: none; color: #6366f1; cursor: pointer; font-size: 0.95rem; line-height: 1; padding: 0 0 0 2px; }
        .arl-cat-custom { display: flex; gap: 8px; padding: 4px 20px 16px; }
        .arl-cat-custom input { flex: 1; border: 1px solid #e6e8ec; border-radius: 8px; padding: 9px 12px; font-size: 0.85rem; }
        .arl-cat-custom input:focus { outline: none; border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,0.16); }
        .arl-cat-custom button { border: 1px solid #d6dbff; background: #eef0ff; color: #4452f0; font-weight: 600; padding: 0 14px; border-radius: 8px; cursor: pointer; font-size: 0.82rem; }
        .arl-cat-custom button:disabled { opacity: 0.5; cursor: not-allowed; }
        .arl-modal-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 20px; border-top: 1px solid #f1f5f9; }
        .arl-modal-foot > div { display: flex; gap: 10px; }
        @media (max-width: 720px) { .arl { padding: 18px; } }
      `}</style>
    </AdminLayout>
  );
}
