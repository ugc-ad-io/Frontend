import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Save, ShieldAlert } from 'lucide-react';
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
  }, []);

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
              <label>{lvl}</label>
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
        .as-field { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
        .as-field label { font-size:13px; color:#4b4b66; }
        .as-field input { width:120px; padding:7px 10px; border:1px solid #e2e4f0; border-radius:8px; }
        .as-card textarea { width:100%; padding:8px 10px; border:1px solid #e2e4f0; border-radius:8px; box-sizing:border-box; }
        .as-flag { display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:8px; text-transform:capitalize; }
        .as-card h3 { margin:0 0 12px; font-size:15px; color:#07074e; }
        .as-field input:focus, .as-card textarea:focus { outline:none; border-color:#5b6bff; box-shadow:0 0 0 3px rgba(91,107,255,0.16); }
        .as-save { margin-top:18px; display:inline-flex; align-items:center; gap:8px; padding:11px 20px; border:1px solid transparent; border-radius:10px; background:linear-gradient(135deg,#5b6bff,#4452f0); color:#fff; font-weight:700; cursor:pointer; box-shadow:0 8px 18px -8px rgba(91,107,255,0.7); }
        .as-save:hover { transform:translateY(-1px); }
        .as-save:disabled { background:#c5c5cf; cursor:not-allowed; transform:none; box-shadow:none; }
      `}</style>
    </AdminLayout>
  );
}
