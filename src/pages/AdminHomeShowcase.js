import { useLiveEffect } from '../lib/liveUpdates';
import { useState } from 'react';
import axios from 'axios';
import { uploadMedia } from '../utils/upload';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Star, Plus, Trash2, Save, Upload, Database, ArrowLeft, ChevronRight, Video } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import useIsPhone from '../lib/useIsPhone';
import '../styles/admin-mobile-platform.css';
import { CONTENT_CATEGORIES } from '../constants/contentCategories';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const CUSTOM = '__custom__';
// Level codes ("l1"/"new") → display labels ("L1"/"New").
const prettyLevel = (v) => {
  const s = String(v || '').trim();
  const m = { new: 'New', verified: 'Verified', l1: 'L1', l2: 'L2', elite: 'Elite' };
  if (m[s.toLowerCase()]) return m[s.toLowerCase()];
  if (/^l\d+$/i.test(s)) return s.toUpperCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
};
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
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const [pulling, setPulling] = useState(false);
  const isPhone = useIsPhone();
  const [phoneIdx, setPhoneIdx] = useState(null); // phone: index of the card being edited

  // Upload a showcase video straight from the editor and set it as this card's video.
  const uploadVideo = async (idx, file) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { toast.error('Video too large. Maximum 100MB.'); return; }
    setUploadingIdx(idx);
    try {
      const r = { data: await uploadMedia(file, API) };
      const url = r.data?.file_url || r.data?.url || '';
      if (!url) throw new Error('No URL returned');
      setField(idx, 'video_url', url);
      toast.success('Video uploaded');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Upload failed'));
    } finally { setUploadingIdx(null); }
  };

  useLiveEffect(() => {
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

  // Seed the whole list from REAL payout data: GET /admin/top-earners/suggest ranks
  // creators by released earnings and returns them in card shape. Nothing is written
  // until Save, so this is a starting point the admin can still edit.
  //
  // This button was removed by 6426af4 when the per-card Name dropdown landed, which
  // left the suggest endpoint live but unreachable - the per-card picker fills ONE
  // card from a creator you already know, and there was no longer any way to ask
  // "who are my actual top three?".
  const pullFromData = async () => {
    if (items.length && !window.confirm('Replace the current cards with your top earners from live data?')) return;
    setPulling(true);
    try {
      const r = await axios.get(`${API}/admin/top-earners/suggest?limit=3`);
      const suggested = Array.isArray(r.data?.items) ? r.data.items : [];
      if (!suggested.length) {
        toast.message('No paid earnings yet', { description: 'No creator has a released payout to rank. Add cards manually for now.' });
        return;
      }
      setItems(suggested.map((i) => ({
        ...BLANK,
        ...i,
        // Mark the card as coming from a real creator so the Name dropdown shows them
        // selected rather than snapping back to "Custom", and normalise the level code
        // the same way the per-card picker does ("l1" -> "L1").
        source: i.id ? String(i.id) : 'custom',
        level: prettyLevel(i.level),
        videos: Array.isArray(i.videos) ? i.videos : (i.video_url ? [i.video_url] : []),
      })));
      toast.success(`Pulled ${suggested.length} top earner${suggested.length === 1 ? '' : 's'} - review and Save.`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not pull from data'));
    } finally { setPulling(false); }
  };

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
      level: prettyLevel(c.level),
      videos: Array.isArray(c.videos) ? c.videos : (c.video_url ? [c.video_url] : []),
      video_url: c.video_url || (Array.isArray(c.videos) && c.videos[0]) || '',
    } : it)));
  };
  // CATEGORY dropdown: pick a value, or CUSTOM → clear so the text input shows.
  const pickCategory = (idx, val) => setField(idx, 'category', val === CUSTOM ? '' : val);

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
      toast.success('Home showcase saved - it updates on the creator home.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save'));
    } finally { setSaving(false); }
  };

  // ===================== Phone (PWA) layout =====================
  // Same list state and handlers: tap a card to edit it full-screen; Save still
  // writes the whole list (order = list order, as on desktop).
  if (isPhone) {
    const it = phoneIdx === null ? null : items[phoneIdx];
    const isCreator = it && it.source && it.source !== 'custom';
    const catInList = it && CATEGORIES.includes(it.category);
    const saveBtn = (label) => (
      <button type="button" className="am-btn am-btn--primary" onClick={save} disabled={saving} data-testid="showcase-save">
        <Save size={18} /> {saving ? 'Saving…' : label}
      </button>
    );
    const numField = (key, label, mode, re, placeholder) => (
      <div className="am-field">
        <label htmlFor={`ahs-ph-${key}`}>{label}</label>
        <input id={`ahs-ph-${key}`} inputMode={mode} value={it[key]} placeholder={placeholder}
          onChange={(e) => setField(phoneIdx, key, e.target.value.replace(re, ''))} />
      </div>
    );
    return (
      <AdminLayout>
        <div className="am amp" data-testid="showcase-phone">
          <p className="am-muted">These cards rotate in the creator home hero. Leave the list empty to fall back to the built-in defaults.</p>
          <div className="amp-btns">
            <button type="button" className="am-btn am-btn--secondary" onClick={pullFromData} disabled={pulling}><Database size={18} /> {pulling ? 'Pulling…' : 'Pull top earners'}</button>
            <button type="button" className="am-btn am-btn--secondary" onClick={() => { addRow(); setPhoneIdx(items.length); }} data-testid="showcase-add"><Plus size={18} /> Add card</button>
          </div>

          {loading ? <p className="am-empty">Loading…</p> : !items.length ? (
            <p className="am-empty">No showcase cards yet - the hero shows the defaults. Tap <strong>Add card</strong> to curate your own.</p>
          ) : (
            <div className="am-list">
              {items.map((card, idx) => (
                <button type="button" className="am-card" key={idx} onClick={() => setPhoneIdx(idx)} data-testid={`showcase-card-${idx}`}>
                  <span className="am-card-head">
                    <span className="am-avatar" aria-hidden="true">{idx + 1}</span>
                    <span className="am-card-main">
                      <span className="am-card-title">{card.name || 'Untitled card'}</span>
                      <span className="am-card-sub">{[card.category, card.level].filter(Boolean).join(' · ') || 'No category'}</span>
                    </span>
                    <ChevronRight size={18} className="am-row-chevron" />
                  </span>
                  <span className="am-card-foot">
                    <span>
                      <span className="am-amount-label">Earned</span>{' '}
                      <span className="am-amount">₹{(Number(card.earned) || 0).toLocaleString('en-IN')}</span>
                    </span>
                    <span className="am-badges">
                      <span className="am-badge am-badge--neutral">{card.deals || 0} deals</span>
                      {card.rating ? <span className="am-badge am-badge--neutral">★ {card.rating}</span> : null}
                      <span className={`am-badge am-badge--${card.video_url ? 'ok' : 'wait'}`}><Video size={12} /> {card.video_url ? 'Video' : 'No video'}</span>
                      {!String(card.name || '').trim() && <span className="am-badge am-badge--bad">Needs a name</span>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {!loading && <div className="amp-btns">{saveBtn('Save showcase')}</div>}
          {!loading && items.some((c) => !String(c.name || '').trim()) && (
            <p className="am-field-error">Cards without a name are dropped when you save.</p>
          )}

          {it && (
            <div className="am-detail" role="dialog" aria-modal="true" aria-label={`Card ${phoneIdx + 1}`} data-testid="showcase-editor">
              <header className="am-detail-head">
                <button type="button" className="am-icon-btn" aria-label="Back" onClick={() => setPhoneIdx(null)} data-testid="showcase-back"><ArrowLeft size={22} /></button>
                <h1>{it.name || `Card ${phoneIdx + 1}`}</h1>
              </header>
              <div className="am-detail-body">
                <section className="am-section">
                  <div className="am-field">
                    <label htmlFor="ahs-ph-source">Creator</label>
                    <select id="ahs-ph-source" value={isCreator ? it.source : CUSTOM} onChange={(e) => pickName(phoneIdx, e.target.value)}>
                      <option value={CUSTOM}>Custom (type a name)</option>
                      {creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <span className="am-field-hint">Picking a creator fills in the card from their real data.</span>
                  </div>
                  {!isCreator && (
                    <div className="am-field">
                      <label htmlFor="ahs-ph-name">Name</label>
                      <input id="ahs-ph-name" type="text" value={it.name} onChange={(e) => setField(phoneIdx, 'name', e.target.value)} placeholder="e.g. Priya Sharma" />
                      {!String(it.name || '').trim() && <span className="am-field-error">A name is required, or the card is dropped on save.</span>}
                    </div>
                  )}
                  <div className="am-field">
                    <label htmlFor="ahs-ph-cat">Category</label>
                    <select id="ahs-ph-cat" value={catInList ? it.category : CUSTOM} onChange={(e) => pickCategory(phoneIdx, e.target.value)}>
                      <option value={CUSTOM}>Custom…</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {!catInList && (
                    <div className="am-field">
                      <label htmlFor="ahs-ph-catc">Custom category</label>
                      <input id="ahs-ph-catc" type="text" value={it.category} onChange={(e) => setField(phoneIdx, 'category', e.target.value)} placeholder="Category" />
                    </div>
                  )}
                </section>
                <section className="am-section">
                  <h3>Figures</h3>
                  {numField('earned', 'Earned (₹)', 'numeric', /[^0-9]/g, '420000')}
                  {numField('deals', 'Deals', 'numeric', /[^0-9]/g, '128')}
                  {numField('rating', 'Rating', 'decimal', /[^0-9.]/g, '4.9')}
                  <div className="am-field">
                    <label htmlFor="ahs-ph-level">Level</label>
                    <input id="ahs-ph-level" type="text" value={it.level} onChange={(e) => setField(phoneIdx, 'level', e.target.value)} placeholder="Elite / L2 / New" />
                  </div>
                </section>
                <section className="am-section">
                  <h3>Video</h3>
                  {it.video_url && <video className="amp-video" src={it.video_url} controls playsInline preload="metadata" />}
                  <div className="am-field">
                    <label htmlFor="ahs-ph-video">Video URL</label>
                    <input id="ahs-ph-video" type="text" inputMode="url" autoCapitalize="off" value={it.video_url} onChange={(e) => setField(phoneIdx, 'video_url', e.target.value)} placeholder="/showcase-reel.mp4 or https://…" />
                    <span className="am-field-hint">Paste a link or upload a clip (max 100MB).</span>
                  </div>
                  <label className={`am-btn am-btn--secondary${uploadingIdx === phoneIdx ? ' amp-busy' : ''}`}>
                    <input type="file" accept="video/*" hidden disabled={uploadingIdx === phoneIdx}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadVideo(phoneIdx, f); }} />
                    <Upload size={18} /> {uploadingIdx === phoneIdx ? 'Uploading…' : 'Upload video'}
                  </label>
                </section>
              </div>
              <div className="am-actionbar">
                <div className="am-actionbar-row">
                  <button type="button" className="am-btn am-btn--danger" onClick={() => { removeRow(phoneIdx); setPhoneIdx(null); }} data-testid="showcase-remove">
                    <Trash2 size={18} /> Remove
                  </button>
                  {saveBtn('Save all')}
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="ahs">
        <div className="ahs-head">
          <div>
            <h2><Star size={18} /> Home Showcase - Top Earners</h2>
            <p>These cards rotate in the creator home hero. Leave the list empty to fall back to the built-in defaults.</p>
          </div>
          <div className="ahs-head-actions">
            <button type="button" className="ahs-add" onClick={pullFromData} disabled={pulling}><Database size={15} /> {pulling ? 'Pulling…' : 'Pull top earners'}</button>
            <button type="button" className="ahs-add" onClick={addRow}><Plus size={15} /> Add card</button>
            <button type="button" className="ahs-save" onClick={save} disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>

        {loading ? (
          <div className="ahs-empty">Loading…</div>
        ) : !items.length ? (
          <div className="ahs-empty">No showcase cards yet - the hero shows the defaults. Click <strong>Add card</strong> to curate your own.</div>
        ) : (
          <div className="ahs-list">
            {items.map((it, idx) => {
              const isCreator = it.source && it.source !== 'custom';
              const catInList = CATEGORIES.includes(it.category);
              return (
              <div className="ahs-card" key={idx}>
                <div className="ahs-grid">
                  {/* NAME — pick a real creator (auto-fills the card) or type a custom name. */}
                  <label className="ahs-field">Name
                    <select value={isCreator ? it.source : CUSTOM} onChange={(e) => pickName(idx, e.target.value)}>
                      <option value={CUSTOM}>Custom (type a name)</option>
                      {creators.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
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

                  {/* VIDEO — paste a URL or upload a clip. */}
                  <label className="ahs-field ahs-wide">Video
                    <div className="ahs-vid-row">
                      <input value={it.video_url} onChange={(e) => setField(idx, 'video_url', e.target.value)} placeholder="/showcase-reel.mp4 or https://… or upload →" />
                      <label className="ahs-upload">
                        <input type="file" accept="video/*" hidden disabled={uploadingIdx === idx}
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadVideo(idx, f); }} />
                        <Upload size={15} /> {uploadingIdx === idx ? 'Uploading…' : 'Upload video'}
                      </label>
                    </div>
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
        .ahs-head-actions{display:flex;gap:10px;flex-wrap:wrap}
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
        /* Custom chevron, inset from the edge so it isn't jammed against the border. */
        .ahs-grid select{cursor:pointer;appearance:none;-webkit-appearance:none;-moz-appearance:none;padding-right:34px;
          background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%235b6bff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 6l4 4 4-4'/></svg>");
          background-repeat:no-repeat;background-position:right 11px center}
        .ahs-field select+input{margin-top:6px}
        .ahs-vid-row{display:flex;gap:10px;align-items:stretch}
        .ahs-vid-row input{flex:1;min-width:0}
        /* Higher specificity so it overrides the .ahs-grid label column/uppercase rule. */
        .ahs-grid label.ahs-upload{display:inline-flex;flex-direction:row;align-items:center;gap:7px;flex:0 0 auto;border:1.5px solid #d6dbff;background:#fff;color:#4452f0;font-size:13px;font-weight:600;text-transform:none;letter-spacing:normal;padding:0 14px;border-radius:9px;cursor:pointer;white-space:nowrap;margin:0}
        .ahs-grid label.ahs-upload:hover{background:#eef0ff}
        .ahs-grid input:focus,.ahs-grid select:focus{outline:none;border-color:#5b6bff;box-shadow:0 0 0 3px rgba(91,107,255,.15)}
        .ahs-del{position:absolute;top:12px;right:12px;width:30px;height:30px;display:grid;place-items:center;border:1px solid #fecdca;background:#fff;color:#dc2626;border-radius:8px;cursor:pointer}
        .ahs-del:hover{background:#fef2f2}
      `}</style>
    </AdminLayout>
  );
}
