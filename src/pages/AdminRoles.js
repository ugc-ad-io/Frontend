import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { ShieldCheck, ShieldAlert, UserPlus, Check, X, Crown, Mail } from 'lucide-react';
import { useAuth } from '../App';
import AdminLayout from '../components/AdminLayout';
import { ADMIN_ROLES, ROLE_LABELS, ROLE_MATRIX, CAP_LABELS, ALL_CAPS, SCOPE_LABELS, isFounder as roleIsFounder } from '../utils/adminRoles';
import { SkeletonTable } from '../components/Skeleton';
import { CONTENT_CATEGORIES } from '../constants/contentCategories';

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
  const [selectedCats, setSelectedCats] = useState([]);
  const [savingCats, setSavingCats] = useState(false);
  const [customCat, setCustomCat] = useState('');
  // Custom-admin config (new-admin form)
  const [newCaps, setNewCaps] = useState([]);
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
  const [accessScope, setAccessScope] = useState('all');
  const [savingAccess, setSavingAccess] = useState(false);
  // Which custom-admin rows have their full feature list expanded inline.
  const [expandedCaps, setExpandedCaps] = useState(() => new Set());
  const toggleExpandCaps = (id) => setExpandedCaps((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  useEffect(() => { fetchStaff(); fetchCategories(); }, []);

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
    setAccessScope(m.admin_scope || 'all');
  };
  const toggleAccessCap = (c) => setAccessCaps((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
  const saveAccess = async () => {
    setSavingAccess(true);
    try {
      await axios.post(`${API}/admin/staff/role`, {
        user_id: accessMember.id, admin_role: 'custom', admin_caps: accessCaps, admin_scope: accessScope,
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
      if (newRole === 'custom') { payload.admin_caps = newCaps; payload.admin_scope = newScope; }
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
      setNewScope('all');
      fetchStaff();
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
      toast.success(`Reset code emailed to ${member.email}`);
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
          ? { admin_caps: member.admin_caps || [], admin_scope: member.admin_scope || 'all' }
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
  // demotes them back to a normal user — this removes the account entirely.
  const deleteStaff = async (member) => {
    if (!window.confirm(
      `Permanently DELETE ${member.email}?\n\nThis removes the account and all of their data. It cannot be undone.\n\n(To only remove admin access, use "Revoke" instead.)`
    )) return;
    setSavingId(member.id);
    try {
      await axios.delete(`${API}/admin/user/${member.id}`);
      toast.success(`Deleted ${member.email}`);
      fetchStaff();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to delete'));
    } finally {
      setSavingId(null);
    }
  };

  // ── Category work distribution ──
  const seesAllCategories = (m) => m.admin_role === 'founder' || m.admin_role === 'ops_senior';
  const openCatEditor = (m) => { setEditingMember(m); setSelectedCats(m.assigned_categories || []); setCustomCat(''); };
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
                    <td className="arl-cant">{r.cannotDo === '—' ? <span className="arl-none">No restrictions</span> : <><X size={13} /> {r.cannotDo}</>}</td>
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
                  <label key={c} className={`arl-cap-opt ${newCaps.includes(c) ? 'on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={newCaps.includes(c)}
                      onChange={() => setNewCaps((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c])}
                    /> {CAP_LABELS[c]}
                  </label>
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
                            <span className="arl-avatar">{(m.nickname || m.email)[0]?.toUpperCase()}</span>
                            <div>
                              <strong>{m.nickname || m.email.split('@')[0]}</strong>
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
                                          <span key={c} className="arl-feat-chip">{CAP_LABELS[c] || c}</span>
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
                              <button className="arl-delete" onClick={() => deleteStaff(m)} disabled={savingId === m.id}>Delete</button>
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

        {editingMember && (
          <div className="arl-modal-overlay" onClick={() => setEditingMember(null)}>
            <div className="arl-modal" onClick={(e) => e.stopPropagation()}>
              <div className="arl-modal-head">
                <h3>Categories — {editingMember.nickname || editingMember.email.split('@')[0]}</h3>
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
                <h3>Custom access — {accessMember.nickname || accessMember.email.split('@')[0]}</h3>
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
                    onClick={() => setAccessCaps(accessCaps.length === ALL_CAPS.length ? [] : [...ALL_CAPS])}
                  >
                    {accessCaps.length === ALL_CAPS.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="arl-cap-grid">
                  {ALL_CAPS.map((c) => (
                    <label key={c} className={`arl-cap-opt ${accessCaps.includes(c) ? 'on' : ''}`}>
                      <input type="checkbox" checked={accessCaps.includes(c)} onChange={() => toggleAccessCap(c)} /> {CAP_LABELS[c]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="arl-modal-foot">
                <span className="arl-muted">{accessCaps.length} feature{accessCaps.length === 1 ? '' : 's'} · {SCOPE_LABELS[accessScope]}</span>
                <div>
                  <button className="arl-revoke" onClick={() => setAccessCaps([])}>Clear</button>
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
                    Sends a 6-digit reset code to {pwdMember.email} so they set their own password — no password needed from you.
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
        .arl-cap-opt { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border: 1px solid #e6e8f5; border-radius: 10px; font-size: 13.5px; color: #2d3155; cursor: pointer; background: #fff; transition: .15s; }
        .arl-cap-opt:hover { border-color: #c9cffb; }
        .arl-cap-opt.on { border-color: #5b6bff; background: #eef0ff; color: #1e2a78; font-weight: 600; }
        .arl-cap-opt input { accent-color: #5b6bff; }
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
