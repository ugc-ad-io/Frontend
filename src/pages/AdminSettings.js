import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Save, ShieldAlert, Mail, Check, CreditCard, Plus, X } from 'lucide-react';
import { useAuth } from '../App';
import AdminLayout from '../components/AdminLayout';
import { isFounder as roleIsFounder } from '../utils/adminRoles';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const NUMERIC_FIELDS = [
  ['commission_rate', 'Commission rate (%)'],
  ['listing_fee', 'Listing fee (₹)'],
  ['revision_price', 'Revision price (₹)'],
  ['auto_approval_days', 'Auto-approval timer (days)'],
  ['late_ship_fee_per_day', 'Late-ship fee / day (₹)'],
  ['late_ship_fee_cap', 'Late-ship fee cap (₹)'],
];

export default function AdminSettings() {
  const { user } = useAuth();
  const isFounder = roleIsFounder(user);
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailHealth, setEmailHealth] = useState(null);
  const [testTo, setTestTo] = useState(user?.email || '');
  const [testing, setTesting] = useState(false);

  // Payment gateway keys (Razorpay/Cashfree) — previously only editable from an
  // unlinked legacy URL (/dashboard/admin/payments). Same backend endpoints, now
  // reachable from Settings where an admin would actually look for it.
  const [gateways, setGateways] = useState([]);
  const [gatewaysLoading, setGatewaysLoading] = useState(true);
  const [editingGateway, setEditingGateway] = useState(null); // gateway_name being edited, or 'new'
  const [gatewayDraft, setGatewayDraft] = useState({ gateway_name: 'razorpay', key_id: '', key_secret: '', enabled: true, is_default: true });
  const [savingGateway, setSavingGateway] = useState(false);

  const loadGateways = () => {
    setGatewaysLoading(true);
    axios.get(`${API}/admin/payment-gateways`)
      .then((r) => setGateways(Array.isArray(r.data) ? r.data : []))
      .catch((error) => toast.error(apiErrorMessage(error, 'Failed to load payment gateways')))
      .finally(() => setGatewaysLoading(false));
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/admin/settings`);
        setSettings(res.data.settings);
        setDraft(res.data.settings);
      } catch (error) {
        toast.error(apiErrorMessage(error, 'Failed to load settings'));
      } finally {
        setLoading(false);
      }
    })();
    axios.get(`${API}/admin/email/health`)
      .then((r) => setEmailHealth(r.data))
      .catch(() => setEmailHealth({ configured: false, unreachable: true }));
    loadGateways();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sends a REAL email and reports exactly what the provider said, so a failure is
  // diagnosable here instead of vanishing into the server log.
  const sendTestEmail = async () => {
    setTesting(true);
    try {
      const { data } = await axios.post(`${API}/admin/email/test`, { to: testTo.trim() });
      toast.success(`Sent to ${data.to} — check the inbox (and spam).`);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Test email failed'));
    } finally {
      setTesting(false);
    }
  };

  const setField = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const openEditGateway = (g) => {
    setGatewayDraft({ gateway_name: g.gateway_name, key_id: g.key_id || '', key_secret: '', enabled: g.enabled !== false, is_default: !!g.is_default });
    setEditingGateway(g.gateway_name);
  };

  const openAddGateway = () => {
    // Default to whichever of razorpay/cashfree isn't configured yet.
    const taken = new Set(gateways.map((g) => g.gateway_name));
    setGatewayDraft({ gateway_name: taken.has('razorpay') ? 'cashfree' : 'razorpay', key_id: '', key_secret: '', enabled: true, is_default: gateways.length === 0 });
    setEditingGateway('new');
  };

  const saveGateway = async () => {
    if (!gatewayDraft.key_id.trim() || !gatewayDraft.key_secret.trim()) {
      toast.error('Key ID and Key Secret are both required');
      return;
    }
    setSavingGateway(true);
    try {
      await axios.post(`${API}/admin/payment-gateway`, {
        gateway_name: gatewayDraft.gateway_name,
        key_id: gatewayDraft.key_id.trim(),
        key_secret: gatewayDraft.key_secret.trim(),
        enabled: gatewayDraft.enabled,
        is_default: gatewayDraft.is_default,
      });
      toast.success(`${gatewayDraft.gateway_name} saved`);
      setEditingGateway(null);
      loadGateways();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to save gateway'));
    } finally {
      setSavingGateway(false);
    }
  };

  // Quick toggle from the list — doesn't touch the keys, just enabled/is_default.
  const toggleGatewayEnabled = async (g) => {
    try {
      await axios.patch(`${API}/admin/payment-gateway/${g.gateway_name}`, { enabled: !g.enabled });
      loadGateways();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to update gateway'));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      NUMERIC_FIELDS.forEach(([k]) => { payload[k] = Number(draft[k]); });
      payload.restricted_categories = Array.isArray(draft.restricted_categories)
        ? draft.restricted_categories
        : String(draft.restricted_categories || '').split(',').map((s) => s.trim()).filter(Boolean);
      payload.feature_flags = draft.feature_flags;
      // Wallet recharge-bonus tiers: keep valid rows only (amount > 0), numeric.
      payload.wallet_bonus_tiers = (draft.wallet_bonus_tiers || [])
        .map((t) => ({ amount: Number(t.amount) || 0, bonus_percent: Number(t.bonus_percent) || 0, label: t.label || '' }))
        .filter((t) => t.amount > 0)
        .sort((a, b) => a.amount - b.amount);
      const res = await axios.put(`${API}/admin/settings`, payload);
      setSettings(res.data.settings);
      toast.success('Settings updated (logged to audit trail)');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLayout><p>Loading settings…</p></AdminLayout>;

  return (
    <AdminLayout>
      {!isFounder && (
        <div className="as-lock"><ShieldAlert size={16} /> Platform settings are founder-only. You can view but not change them.</div>
      )}
      {/* Email silently no-ops when RESEND_API_KEY is absent on the server, which is
          indistinguishable from "the feature is broken". Surface the real state. */}
      <section className={`as-card as-email ${emailHealth && !emailHealth.configured ? 'bad' : ''}`}>
        <h3><Mail size={16} /> Email delivery</h3>
        {!emailHealth ? (
          <p className="as-email-note">Checking…</p>
        ) : emailHealth.configured ? (
          <>
            <p className="as-email-note ok">
              <Check size={14} /> Configured — sending as <b>{emailHealth.from}</b>
            </p>
            {emailHealth.in_quiet_hours && (
              <p className="as-email-note warn">
                <ShieldAlert size={14} /> Quiet hours (10pm–8am IST): non-critical emails are held back right now.
                In-app notifications still record.
              </p>
            )}
          </>
        ) : (
          <p className="as-email-note bad">
            <ShieldAlert size={14} /> <b>Email is DISABLED on this server.</b> RESEND_API_KEY is not set, so every
            send is skipped silently. Add it to the environment and redeploy.
          </p>
        )}
        <div className="as-email-test">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
          />
          <button type="button" onClick={sendTestEmail} disabled={testing || !testTo.trim()}>
            {testing ? 'Sending…' : 'Send test email'}
          </button>
        </div>
      </section>

      <section className="as-card as-gateways">
        <div className="as-gw-head">
          <h3><CreditCard size={16} /> Payment gateways</h3>
          {isFounder && editingGateway === null && (
            <button type="button" className="as-gw-add" onClick={openAddGateway}><Plus size={14} /> Add gateway</button>
          )}
        </div>

        {gatewaysLoading ? (
          <p className="as-email-note">Loading…</p>
        ) : gateways.length === 0 && editingGateway !== 'new' ? (
          <p className="as-email-note bad">
            <ShieldAlert size={14} /> No payment gateway configured — checkout can't take real payments. Add one below.
          </p>
        ) : (
          <div className="as-gw-list">
            {gateways.map((g) => (
              <div className="as-gw-row" key={g.gateway_name}>
                <div className="as-gw-info">
                  <strong>{g.gateway_name}</strong>
                  <span className="as-gw-keyid">{g.key_id || '—'}</span>
                  {g.is_default && <span className="as-gw-tag default">Default</span>}
                  <span className={`as-gw-tag ${g.enabled !== false ? 'on' : 'off'}`}>{g.enabled !== false ? 'Enabled' : 'Disabled'}</span>
                </div>
                {isFounder && (
                  <div className="as-gw-actions">
                    <button type="button" className="as-gw-toggle" onClick={() => toggleGatewayEnabled(g)}>
                      {g.enabled !== false ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" className="as-gw-edit" onClick={() => openEditGateway(g)}>Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {isFounder && editingGateway !== null && (
          <div className="as-gw-form">
            <div className="as-gw-form-head">
              <strong>{editingGateway === 'new' ? 'Add gateway' : `Edit ${editingGateway}`}</strong>
              <button type="button" className="as-gw-close" onClick={() => setEditingGateway(null)} aria-label="Cancel"><X size={15} /></button>
            </div>
            {editingGateway === 'new' && (
              <div className="as-field">
                <label>Provider</label>
                <select value={gatewayDraft.gateway_name} onChange={(e) => setGatewayDraft((d) => ({ ...d, gateway_name: e.target.value }))}>
                  <option value="razorpay">Razorpay</option>
                  <option value="cashfree">Cashfree</option>
                </select>
              </div>
            )}
            <div className="as-field">
              <label>Key ID / Client ID</label>
              <input type="text" value={gatewayDraft.key_id} onChange={(e) => setGatewayDraft((d) => ({ ...d, key_id: e.target.value }))} placeholder="e.g. rzp_live_xxxxxxxx" />
            </div>
            <div className="as-field">
              <label>Key Secret / Client Secret</label>
              <input type="password" value={gatewayDraft.key_secret} onChange={(e) => setGatewayDraft((d) => ({ ...d, key_secret: e.target.value }))} placeholder="Paste the secret — it's never shown back" />
            </div>
            <label className="as-flag">
              <input type="checkbox" checked={gatewayDraft.enabled} onChange={(e) => setGatewayDraft((d) => ({ ...d, enabled: e.target.checked }))} />
              Enabled
            </label>
            <label className="as-flag">
              <input type="checkbox" checked={gatewayDraft.is_default} onChange={(e) => setGatewayDraft((d) => ({ ...d, is_default: e.target.checked }))} />
              Default gateway (used when a deal doesn't specify one)
            </label>
            <button type="button" className="as-gw-save" onClick={saveGateway} disabled={savingGateway}>
              <Save size={14} /> {savingGateway ? 'Saving…' : 'Save gateway'}
            </button>
          </div>
        )}
      </section>

      <div className="as-grid">
        <section className="as-card">
          <h3>Economics</h3>
          {NUMERIC_FIELDS.map(([key, label]) => (
            <div className="as-field" key={key}>
              <label>{label}</label>
              <input type="number" value={draft[key] ?? ''} disabled={!isFounder} onChange={(e) => setField(key, e.target.value)} />
            </div>
          ))}
        </section>

        <section className="as-card">
          <h3>Payout delay by level (days)</h3>
          {Object.entries(draft.payout_delay_days || {}).map(([lvl, days]) => (
            <div className="as-field" key={lvl}>
              <label className="as-lvl">{String(lvl).charAt(0).toUpperCase() + String(lvl).slice(1)}</label>
              <input type="number" value={days} disabled={!isFounder}
                onChange={(e) => setField('payout_delay_days', { ...draft.payout_delay_days, [lvl]: Number(e.target.value) })} />
            </div>
          ))}
        </section>

        <section className="as-card">
          <h3>Restricted brand categories</h3>
          <textarea rows="3" disabled={!isFounder}
            value={Array.isArray(draft.restricted_categories) ? draft.restricted_categories.join(', ') : draft.restricted_categories || ''}
            onChange={(e) => setField('restricted_categories', e.target.value)}
            placeholder="comma-separated" />

          <h3 style={{ marginTop: 16 }}>Feature flags</h3>
          {Object.entries(draft.feature_flags || {}).map(([flag, on]) => (
            <label className="as-flag" key={flag}>
              <input type="checkbox" checked={!!on} disabled={!isFounder}
                onChange={(e) => setField('feature_flags', { ...draft.feature_flags, [flag]: e.target.checked })} />
              {flag}
            </label>
          ))}
        </section>

        <section className="as-card">
          <h3>Recharge bonus tiers</h3>
          <p className="as-hint">A brand recharging ≥ the amount gets that instant % bonus. Highest matching tier wins.</p>
          <div className="as-tier-head"><span>Recharge ≥ (₹)</span><span>Bonus %</span></div>
          {(draft.wallet_bonus_tiers || []).map((t, i) => (
            <div className="as-tier-row" key={i}>
              <input type="number" min="0" value={t.amount ?? ''} disabled={!isFounder}
                onChange={(e) => setField('wallet_bonus_tiers', draft.wallet_bonus_tiers.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
              <input type="number" min="0" value={t.bonus_percent ?? ''} disabled={!isFounder}
                onChange={(e) => setField('wallet_bonus_tiers', draft.wallet_bonus_tiers.map((x, j) => j === i ? { ...x, bonus_percent: e.target.value } : x))} />
            </div>
          ))}
        </section>
      </div>

      {isFounder && (
        <button className="as-save" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? 'Saving…' : 'Save settings'}
        </button>
      )}

      <style>{`
        .as-lock { display:flex; align-items:center; gap:8px; background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; padding:10px 14px; border-radius:10px; margin-bottom:16px; }
        .as-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; }
        .as-card { background:#fff; border:1px solid #ececf1; border-radius:14px; padding:18px; }
        .as-card h3 { margin:0 0 12px; font-size:15px; }

        /* Email delivery panel */
        .as-email { margin-bottom:16px; }
        .as-email.bad { border-color:#fecaca; background:#fff5f5; }
        .as-email h3 { display:flex; align-items:center; gap:8px; }
        .as-email-note { display:flex; align-items:flex-start; gap:7px; margin:0 0 10px; font-size:13px; line-height:1.55; color:#4b4b66; }
        .as-email-note.ok { color:#0f7a43; }
        .as-email-note.warn { color:#a35b00; }
        .as-email-note.bad { color:#b42318; }
        .as-email-test { display:flex; gap:8px; flex-wrap:wrap; }
        .as-email-test input { flex:1; min-width:200px; padding:8px 11px; border:1px solid #e2e4f0; border-radius:8px; font-size:13.5px; font-family:inherit; }
        .as-email-test button { border:1px solid #d6dbff; background:#eef0ff; color:#3730a3; font-weight:700; font-size:13px; padding:8px 14px; border-radius:8px; cursor:pointer; }
        .as-email-test button:disabled { opacity:.5; cursor:not-allowed; }
        .as-field { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
        .as-field label { font-size:13px; color:#4b4b66; }
        /* Level keys come from the API lowercase (new / verified / l1 / l2 / elite) —
           capitalise them for display (JS already does; this guarantees it). */
        .as-field label.as-lvl { text-transform:capitalize; }
        .as-field input { width:120px; padding:7px 10px; border:1px solid #e2e4f0; border-radius:8px; }
        .as-card textarea { width:100%; padding:8px 10px; border:1px solid #e2e4f0; border-radius:8px; box-sizing:border-box; }
        .as-flag { display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:8px; text-transform:capitalize; }
        .as-hint { margin:0 0 12px; font-size:12.5px; color:#8a8fb0; line-height:1.5; }
        .as-tier-head, .as-tier-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; align-items:center; margin-bottom:8px; }
        .as-tier-head span { font-size:11.5px; font-weight:700; color:#8a8fb0; text-transform:uppercase; letter-spacing:.3px; }
        .as-tier-row input { width:100%; padding:7px 10px; border:1px solid #e2e4f0; border-radius:8px; box-sizing:border-box; }
        .as-card h3 { margin:0 0 12px; font-size:15px; color:#07074e; }
        .as-field input:focus, .as-card textarea:focus { outline:none; border-color:#5b6bff; box-shadow:0 0 0 3px rgba(91,107,255,0.16); }
        .as-save { margin-top:18px; display:inline-flex; align-items:center; gap:8px; padding:11px 20px; border:1px solid transparent; border-radius:10px; background:linear-gradient(100deg,#12124f,#07074e); color:#fff; font-weight:700; cursor:pointer; box-shadow:0 12px 26px -12px rgba(7,7,78,.7); }
        .as-save:hover { transform:translateY(-1px); }
        .as-save:disabled { background:#c5c5cf; cursor:not-allowed; transform:none; box-shadow:none; }

        /* Payment gateways */
        .as-gateways { margin-bottom:16px; }
        .as-gw-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .as-gw-head h3 { display:flex; align-items:center; gap:8px; margin:0; }
        .as-gw-add { display:inline-flex; align-items:center; gap:6px; border:1px solid #d6dbff; background:#eef0ff; color:#3730a3; font-weight:700; font-size:12.5px; padding:7px 12px; border-radius:8px; cursor:pointer; }
        .as-gw-add:hover { background:#e2e6ff; }
        .as-gw-list { display:flex; flex-direction:column; gap:8px; }
        .as-gw-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid #ececf1; border-radius:10px; flex-wrap:wrap; }
        .as-gw-info { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .as-gw-info strong { text-transform:capitalize; color:#15163a; font-size:13.5px; }
        .as-gw-keyid { font-family:monospace; font-size:12px; color:#6b6f8f; }
        .as-gw-tag { font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; text-transform:uppercase; letter-spacing:.3px; }
        .as-gw-tag.default { background:#eef0ff; color:#3730a3; }
        .as-gw-tag.on { background:#ecfdf3; color:#067647; }
        .as-gw-tag.off { background:#f1f5f9; color:#64748b; }
        .as-gw-actions { display:flex; gap:8px; }
        .as-gw-toggle, .as-gw-edit { border:1px solid #e2e4f0; background:#fff; color:#4b4b66; font-weight:600; font-size:12.5px; padding:6px 12px; border-radius:8px; cursor:pointer; }
        .as-gw-toggle:hover, .as-gw-edit:hover { background:#f7f8ff; }
        .as-gw-form { margin-top:14px; padding:14px; border:1px solid #e2e4f0; border-radius:10px; background:#fbfbfe; }
        .as-gw-form-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .as-gw-form-head strong { text-transform:capitalize; font-size:13.5px; color:#15163a; }
        .as-gw-close { border:none; background:none; cursor:pointer; color:#8a8fb0; padding:2px; }
        .as-gw-form .as-field { flex-direction:column; align-items:stretch; }
        .as-gw-form .as-field label { margin-bottom:5px; }
        .as-gw-form .as-field input, .as-gw-form .as-field select { width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #e2e4f0; border-radius:8px; font-family:inherit; }
        .as-gw-save { margin-top:6px; display:inline-flex; align-items:center; gap:7px; padding:9px 16px; border:1px solid transparent; border-radius:9px; background:linear-gradient(100deg,#12124f,#07074e); color:#fff; font-weight:700; font-size:13px; cursor:pointer; }
        .as-gw-save:disabled { background:#c5c5cf; cursor:not-allowed; }
      `}</style>
    </AdminLayout>
  );
}
