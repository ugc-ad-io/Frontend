import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { ShieldCheck, ShieldAlert, UserPlus, Check, X, Crown } from 'lucide-react';
import { useAuth } from '../App';
import AdminLayout from '../components/AdminLayout';
import { ADMIN_ROLES, ROLE_LABELS, ROLE_MATRIX, isFounder as roleIsFounder } from '../utils/adminRoles';
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

  const addAdmin = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) { toast.error('Enter an email'); return; }
    const pwd = newPassword.trim();
    if (pwd && pwd.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setAdding(true);
    try {
      const res = await axios.post(`${API}/admin/staff/role`, { email, admin_role: newRole, ...(pwd ? { password: pwd } : {}) });
      if (res.data?.created && res.data?.temp_password) {
        toast.success(`${email} created as ${ROLE_LABELS[newRole]}. Temp password: ${res.data.temp_password}`, { duration: 12000 });
      } else if (res.data?.created) {
        toast.success(`${email} created as ${ROLE_LABELS[newRole]} with the password you set.`, { duration: 8000 });
      } else if (res.data?.password_set) {
        toast.success(`${email} set to ${ROLE_LABELS[newRole]} · password updated`);
      } else {
        toast.success(`${email} set to ${ROLE_LABELS[newRole]}`);
      }
      setNewEmail('');
      setNewPassword('');
      fetchStaff();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to add admin'));
    } finally {
      setAdding(false);
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
                placeholder="Password (optional — auto-generated if blank)"
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

          {loading ? (
            <p className="arl-muted">Loading team…</p>
          ) : staff.length === 0 ? (
            <p className="arl-muted">No admin staff found.</p>
          ) : (
            <div className="arl-table-wrap">
              <table className="arl-table">
                <thead>
                  <tr><th>Member</th><th>Role</th><th>Categories handled</th><th></th></tr>
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
                        </td>
                        <td>
                          {seesAllCategories(m) ? (
                            <span className="arl-allcats"><Check size={12} /> All categories</span>
                          ) : (m.assigned_categories && m.assigned_categories.length) ? (
                            <div className="arl-cats">{m.assigned_categories.map((c) => <span key={c} className="arl-cat-chip">{c}</span>)}</div>
                          ) : (
                            <span className="arl-muted">None assigned</span>
                          )}
                          {founder && !seesAllCategories(m) && (
                            <button className="arl-cat-edit" onClick={() => openCatEditor(m)} data-testid={`staff-cats-${m.id}`}>
                              {m.assigned_categories && m.assigned_categories.length ? 'Edit' : 'Assign'} categories
                            </button>
                          )}
                        </td>
                        <td className="arl-row-actions">
                          {founder && !locked && (
                            <button className="arl-revoke" onClick={() => revoke(m)} disabled={savingId === m.id}>Revoke</button>
                          )}
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
      </div>

      <style>{`
        .arl { padding: 24px 28px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
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
        .arl-table th, .arl-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 0.86rem; vertical-align: top; }
        .arl-table th { background: #f9fafb; font-size: 0.7rem; font-weight: 700; color: #5b6573; text-transform: uppercase; letter-spacing: 0.04em; }
        .arl-table tbody tr:last-child td { border-bottom: 0; }
        .arl-can { color: #067647; } .arl-can svg, .arl-cant svg { vertical-align: -2px; margin-right: 3px; }
        .arl-cant { color: #b42318; }
        .arl-none { color: #98a1ad; font-style: italic; }
        .arl-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 11px; border-radius: 999px; font-size: 0.74rem; font-weight: 700; white-space: nowrap; }
        .arl-badge.founder { background: #fef3c7; color: #92400e; }
        .arl-badge.senior  { background: #e0e7ff; color: #3730a3; }
        .arl-badge.regular { background: #ecfdf3; color: #067647; }
        .arl-badge.finance { background: #f3e8ff; color: #6b21a8; }
        .arl-add { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .arl-add input { flex: 1; min-width: 220px; border: 1px solid #e6e8ec; border-radius: 8px; padding: 9px 12px; font-size: 0.88rem; }
        .arl-add select, .arl-table select { border: 1px solid #e6e8ec; border-radius: 8px; padding: 8px 10px; font-size: 0.85rem; background: #fff; cursor: pointer; }
        .arl-add input:focus, .arl-add select:focus, .arl-table select:focus { outline: none; border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,0.16); }
        .arl-add-btn { display: inline-flex; align-items: center; gap: 7px; border: 1px solid transparent; background: linear-gradient(100deg,#12124f,#07074e); color: #fff; font-weight: 600; padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; box-shadow: 0 12px 26px -12px rgba(7,7,78,.7); }
        .arl-add-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .arl-member { display: flex; align-items: center; gap: 10px; }
        .arl-avatar { width: 34px; height: 34px; flex: none; border-radius: 50%; background: linear-gradient(135deg, #5b6bff, #4452f0); color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; }
        .arl-member strong { display: block; color: #111827; font-size: 0.88rem; }
        .arl-email { font-size: 0.76rem; color: #98a1ad; }
        .arl-row-actions { text-align: right; }
        .arl-revoke { border: 1px solid #fecdca; background: #fff; color: #b42318; font-weight: 600; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; }
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
