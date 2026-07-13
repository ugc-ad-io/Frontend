import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Save, ShieldAlert, Mail, Check } from 'lucide-react';
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

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      NUMERIC_FIELDS.forEach(([k]) => { payload[k] = Number(draft[k]); });
      payload.restricted_categories = Array.isArray(draft.restricted_categories)
        ? draft.restricted_categories
        : String(draft.restricted_categories || '').split(',').map((s) => s.trim()).filter(Boolean);
      payload.feature_flags = draft.feature_flags;
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
        .as-card h3 { margin:0 0 12px; font-size:15px; color:#07074e; }
        .as-field input:focus, .as-card textarea:focus { outline:none; border-color:#5b6bff; box-shadow:0 0 0 3px rgba(91,107,255,0.16); }
        .as-save { margin-top:18px; display:inline-flex; align-items:center; gap:8px; padding:11px 20px; border:1px solid transparent; border-radius:10px; background:linear-gradient(100deg,#12124f,#07074e); color:#fff; font-weight:700; cursor:pointer; box-shadow:0 12px 26px -12px rgba(7,7,78,.7); }
        .as-save:hover { transform:translateY(-1px); }
        .as-save:disabled { background:#c5c5cf; cursor:not-allowed; transform:none; box-shadow:none; }
      `}</style>
    </AdminLayout>
  );
}
