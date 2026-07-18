import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Star, Plus, Trash2, Save } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { CONTENT_CATEGORIES } from '../constants/contentCategories';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const CUSTOM = '__custom__';
// Category options (labels) for the Category dropdown; the list already ends in
// a 'Custom' entry, which we render as our own CUSTOM sentinel.
const CATEGORIES = CONTENT_CATEGORIES.filter((c) => c.value !== 'custom').map((c) => c.label);

// `source: creator_id` marks a Name auto-filled from a real creator; 'custom'
// means typed by hand. `videos` = that creator's clips, for the Video dropdown.
const BLANK = { source: 'custom', name: '', category: '', earned: '', deals: '', rating: '', level: '', video_url: '', videos: [] };

export default function AdminHomeShowcase() {
  const [items, setItems] = useState([]);
  const [creators, setCreators] = useState([]);   // real creators for the per-card picker
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/admin/top-earners`),
      axios.get(`${API}/admin/top-earners/creators`).catch(() => ({ data: { items: [] } })),
    ])
      .then(([saved, cr]) => {
        setItems(Array.isArray(saved.data?.items) ? saved.data.items.map((i) => ({ ...BLANK, source: 'custom', ...i })) : []);
        setCreators(Array.isArray(cr.data?.items) ? cr.data.items : []);
      })
      .catch((e) => toast.error(apiErrorMessage(e, 'Could not load the showcase')))
      .finally(() => setLoading(false));
  }, []);

  const setField = (idx, key, val) => setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  const addRow = () => setItems((cur) => [...cur, { ...BLANK }]);
  const removeRow = (idx) => setItems((cur) => cur.filter((_, i) => i !== idx));

  // NAME dropdown: pick a creator → auto-fill everything (incl. their videos);
  // "Custom" → clear for manual entry.
  const pickName = (idx, val) => {
    if (val === CUSTOM) {
      setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, source: 'custom', name: '', videos: [] } : it)));
      return;
    }
    const c = creators.find((x) => String(x.id) === String(val));
    if (!c) return;
    setItems((cur) => cur.map((it, i) => (i === idx ? {
      ...BLANK,
      source: String(c.id),
      name: c.name || '',
      category: c.category || '',
      earned: c.earned || '',
      deals: c.deals || '',
      rating: c.rating || '',
      level: c.level || '',
      videos: Array.isArray(c.videos) ? c.videos : (c.video_url ? [c.video_url] : []),
      video_url: c.video_url || (Array.isArray(c.videos) && c.videos[0]) || '',
    } : it)));
  };
  // CATEGORY / VIDEO dropdowns: pick a value, or CUSTOM → clear so the text input shows.
  const pickCategory = (idx, val) => setField(idx, 'category', val === CUSTOM ? '' : val);
  const pickVideo = (idx, val) => setField(idx, 'video_url', val === CUSTOM ? '' : val);

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
            {items.map((it, idx) => {
              const isCreator = it.source && it.source !== 'custom';
              const catInList = CATEGORIES.includes(it.category);
              const vids = Array.isArray(it.videos) ? it.videos : [];
              const vidInList = vids.includes(it.video_url);
              return (
              <div className="ahs-card" key={idx}>
                <div className="ahs-grid">
                  {/* NAME — pick a real creator (auto-fills the card) or type a custom name. */}
                  <label className="ahs-field">Name
                    <select value={isCreator ? it.source : CUSTOM} onChange={(e) => pickName(idx, e.target.value)}>
                      <option value={CUSTOM}>Custom (type a name)</option>
                      {creators.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.earned ? ` — ₹${Number(c.earned).toLocaleString('en-IN')}` : ''}</option>
                      ))}
                    </select>
                    {!isCreator && <input value={it.name} onChange={(e) => setField(idx, 'name', e.target.value)} placeholder="e.g. Priya Sharma" />}
                  </label>

                  {/* CATEGORY — pick from the list or Custom. */}
                  <label className="ahs-field">Category
                    <select value={catInList ? it.category : CUSTOM} onChange={(e) => pickCategory(idx, e.target.value)}>
                      <option value={CUSTOM}>Custom…</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {!catInList && <input value={it.category} onChange={(e) => setField(idx, 'category', e.target.value)} placeholder="Category" />}
                  </label>

                  <label>Earned (₹)<input inputMode="numeric" value={it.earned} onChange={(e) => setField(idx, 'earned', e.target.value.replace(/[^0-9]/g, ''))} placeholder="420000" /></label>
                  <label>Deals<input inputMode="numeric" value={it.deals} onChange={(e) => setField(idx, 'deals', e.target.value.replace(/[^0-9]/g, ''))} placeholder="128" /></label>
                  <label>Rating<input inputMode="decimal" value={it.rating} onChange={(e) => setField(idx, 'rating', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="4.9" /></label>
                  <label>Level<input value={it.level} onChange={(e) => setField(idx, 'level', e.target.value)} placeholder="Elite / L2 / New" /></label>

                  {/* VIDEO — pick one of the chosen creator's clips, or a custom URL. */}
                  <label className="ahs-field ahs-wide">Video
                    <select value={vidInList ? it.video_url : CUSTOM} onChange={(e) => pickVideo(idx, e.target.value)}>
                      <option value={CUSTOM}>Custom URL…</option>
                      {vids.map((v, i) => <option key={v} value={v}>Video {i + 1} — {String(v).split('/').pop()}</option>)}
                    </select>
                    {!vidInList && <input value={it.video_url} onChange={(e) => setField(idx, 'video_url', e.target.value)} placeholder="/showcase-reel.mp4 or https://…" />}
                  </label>
                </div>
                <button type="button" className="ahs-del" onClick={() => removeRow(idx)} aria-label="Remove card"><Trash2 size={16} /></button>
              </div>
            );})}
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
        .ahs-card{position:relative;background:#fff;border:1.5px solid #eef2f9;border-radius:14px;padding:16px 44px 16px 18px}
        .ahs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
        .ahs-grid label{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#8a90a6}
        .ahs-grid label.ahs-wide{grid-column:1 / -1}
        .ahs-grid input,.ahs-grid select{border:1px solid #dfe2ee;border-radius:9px;padding:9px 11px;font:inherit;font-size:14px;color:#15163a;font-weight:500;text-transform:none;letter-spacing:normal;background:#fff}
        .ahs-grid select{cursor:pointer}
        .ahs-field select+input{margin-top:6px}
        .ahs-grid input:focus,.ahs-grid select:focus{outline:none;border-color:#5b6bff;box-shadow:0 0 0 3px rgba(91,107,255,.15)}
        .ahs-del{position:absolute;top:12px;right:12px;width:30px;height:30px;display:grid;place-items:center;border:1px solid #fecdca;background:#fff;color:#dc2626;border-radius:8px;cursor:pointer}
        .ahs-del:hover{background:#fef2f2}
      `}</style>
    </AdminLayout>
  );
}
