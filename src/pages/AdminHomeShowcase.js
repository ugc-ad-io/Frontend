import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Star, Plus, Trash2, Save } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const BLANK = { name: '', category: '', earned: '', deals: '', rating: '', level: '', video_url: '' };

export default function AdminHomeShowcase() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/top-earners`)
      .then((r) => setItems(Array.isArray(r.data?.items) ? r.data.items.map((i) => ({ ...BLANK, ...i })) : []))
      .catch((e) => toast.error(apiErrorMessage(e, 'Could not load the showcase')))
      .finally(() => setLoading(false));
  }, []);

  const setField = (idx, key, val) => setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  const addRow = () => setItems((cur) => [...cur, { ...BLANK }]);
  const removeRow = (idx) => setItems((cur) => cur.filter((_, i) => i !== idx));

  const save = async () => {
    // Every card needs at least a name.
    const clean = items.filter((it) => String(it.name || '').trim());
    setSaving(true);
    try {
      const r = await axios.put(`${API}/admin/top-earners`, {
        items: clean.map((it) => ({
          name: String(it.name).trim(),
          category: it.category || '',
          earned: Number(it.earned) || 0,
          deals: Number(it.deals) || 0,
          rating: Number(it.rating) || 0,
          level: it.level || '',
          video_url: it.video_url || '',
        })),
      });
      setItems((r.data?.items || []).map((i) => ({ ...BLANK, ...i })));
      toast.success('Home showcase saved — it updates on the creator home.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save'));
    } finally { setSaving(false); }
  };

  return (
    <AdminLayout>
      <div className="ahs">
        <div className="ahs-head">
          <div>
            <h2><Star size={18} /> Home Showcase — Top Earners</h2>
            <p>These cards rotate in the creator home hero. Leave the list empty to fall back to the built-in defaults.</p>
          </div>
          <div className="ahs-head-actions">
            <button type="button" className="ahs-add" onClick={addRow}><Plus size={15} /> Add card</button>
            <button type="button" className="ahs-save" onClick={save} disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>

        {loading ? (
          <div className="ahs-empty">Loading…</div>
        ) : !items.length ? (
          <div className="ahs-empty">No showcase cards yet — the hero shows the defaults. Click <strong>Add card</strong> to curate your own.</div>
        ) : (
          <div className="ahs-list">
            {items.map((it, idx) => (
              <div className="ahs-card" key={idx}>
                <div className="ahs-grid">
                  <label>Name<input value={it.name} onChange={(e) => setField(idx, 'name', e.target.value)} placeholder="e.g. Priya Sharma" /></label>
                  <label>Category<input value={it.category} onChange={(e) => setField(idx, 'category', e.target.value)} placeholder="Fashion" /></label>
                  <label>Earned (₹)<input inputMode="numeric" value={it.earned} onChange={(e) => setField(idx, 'earned', e.target.value.replace(/[^0-9]/g, ''))} placeholder="420000" /></label>
                  <label>Deals<input inputMode="numeric" value={it.deals} onChange={(e) => setField(idx, 'deals', e.target.value.replace(/[^0-9]/g, ''))} placeholder="128" /></label>
                  <label>Rating<input inputMode="decimal" value={it.rating} onChange={(e) => setField(idx, 'rating', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="4.9" /></label>
                  <label>Level<input value={it.level} onChange={(e) => setField(idx, 'level', e.target.value)} placeholder="Elite / L2 / New" /></label>
                  <label className="ahs-wide">Video URL<input value={it.video_url} onChange={(e) => setField(idx, 'video_url', e.target.value)} placeholder="/showcase-reel.mp4 or https://…" /></label>
                </div>
                <button type="button" className="ahs-del" onClick={() => removeRow(idx)} aria-label="Remove card"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .ahs-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px}
        .ahs-head h2{display:flex;align-items:center;gap:8px;margin:0 0 4px;font-size:1.15rem;color:#07074e}
        .ahs-head p{margin:0;color:#718096;font-size:0.86rem;max-width:560px;line-height:1.5}
        .ahs-head-actions{display:flex;gap:10px}
        .ahs-add{display:inline-flex;align-items:center;gap:7px;border:1.5px solid #d6dbff;background:#fff;color:#4452f0;font:inherit;font-weight:600;font-size:13px;padding:9px 14px;border-radius:10px;cursor:pointer}
        .ahs-add:hover{background:#eef0ff}
        .ahs-save{display:inline-flex;align-items:center;gap:7px;border:0;background:#07074e;color:#fff;font:inherit;font-weight:700;font-size:13px;padding:9px 18px;border-radius:10px;cursor:pointer}
        .ahs-save:hover{background:#14146b}
        .ahs-save:disabled{opacity:.6;cursor:not-allowed}
        .ahs-empty{background:#fff;border:1.5px solid #eef2f9;border-radius:14px;padding:40px;text-align:center;color:#8a90a6}
        .ahs-list{display:flex;flex-direction:column;gap:12px}
        .ahs-card{position:relative;background:#fff;border:1.5px solid #eef2f9;border-radius:14px;padding:16px 18px}
        .ahs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
        .ahs-grid label{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#8a90a6}
        .ahs-grid label.ahs-wide{grid-column:1 / -1}
        .ahs-grid input{border:1px solid #dfe2ee;border-radius:9px;padding:9px 11px;font:inherit;font-size:14px;color:#15163a;font-weight:500;text-transform:none;letter-spacing:normal}
        .ahs-grid input:focus{outline:none;border-color:#5b6bff;box-shadow:0 0 0 3px rgba(91,107,255,.15)}
        .ahs-del{position:absolute;top:12px;right:12px;width:30px;height:30px;display:grid;place-items:center;border:1px solid #fecdca;background:#fff;color:#dc2626;border-radius:8px;cursor:pointer}
        .ahs-del:hover{background:#fef2f2}
      `}</style>
    </AdminLayout>
  );
}
