import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { X, Check, Info, Pencil, Plus, Minus, UploadCloud, Mic, FileText, Link2, ChevronDown, Trash2, Tag } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const DURATIONS = ['15 Sec', '30 Sec', '45 Sec', '60 Sec', '90 Sec'];
const LANGUAGES = ['Hinglish', 'Hindi', 'English', 'Tamil', 'Telugu', 'Marathi', 'Bengali'];
const ORIENTATIONS = ['Portrait', 'Landscape', 'Square'];
const BACKGROUNDS = ['Green Screen', 'Home', 'Studio', 'Outdoor', 'Office', 'Plain Wall'];
const PRODUCTS = ['Yes', 'No'];
const LOGO_POSITIONS = ['No Preference', 'Top Left', 'Top Right', 'Bottom Left', 'Bottom Right', 'Center'];
const SLOTS = ['11:00 - 17:00', '17:00 - 23:00'];

const GST_RATE = 0.18;

const newVideo = () => ({
  name: '',
  duration: '30 Sec',
  language: 'Hinglish',
  orientation: 'Portrait',
  background: 'Green Screen',
  product: '',
  guidelinesOpen: false,
  logoPosition: 'No Preference',
  pronunciation: '',
  files: [],
  links: '',
  notes: '',
});

function Field({ label, children }) {
  return (
    <label className="pb-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <div className="pb-select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={16} />
    </div>
  );
}

export default function PlanBrief({ creatorId, creatorName = 'Creator', onClose, onPublished }) {
  const [stage, setStage] = useState('setup'); // 'setup' | 'payment'
  const [plan, setPlan] = useState(null); // the creator's single plan, fetched from their profile
  const [planLoading, setPlanLoading] = useState(true);
  const [dateChoice, setDateChoice] = useState('today');
  const [slot, setSlot] = useState(SLOTS[1]);
  const [videoCount, setVideoCount] = useState(1);
  const [videos, setVideos] = useState([newVideo()]);
  const [activeVideo, setActiveVideo] = useState(0);
  const [copyToRest, setCopyToRest] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch the creator's plan (price set during their signup → profile.rate_card).
  useEffect(() => {
    let active = true;
    setPlanLoading(true);
    axios.get(`${API}/profile/${creatorId}`)
      .then((res) => {
        if (!active) return;
        const p = res.data?.profile || {};
        const rc = p.rate_card || {};
        const price = parseInt(String(rc.expected_payout || rc.last_salary || '').replace(/[^0-9]/g, ''), 10) || 0;
        const humanize = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const tags = Array.isArray(p.tags) && p.tags.length
          ? p.tags.slice(0, 3).join(', ')
          : (humanize(p.niche) || humanize(p.category) || 'UGC Content');
        setPlan({
          id: 'creator-plan',
          name: p.plan_name || (p.category ? `${humanize(p.category)} Content` : 'Creator Plan'),
          price,
          tags,
        });
      })
      .catch(() => { if (active) setPlan({ id: 'creator-plan', name: 'Creator Plan', price: 0, tags: 'UGC Content' }); })
      .finally(() => { if (active) setPlanLoading(false); });
    return () => { active = false; };
  }, [creatorId]);

  const subtotal = (plan?.price || 0) * videoCount;
  const gst = Math.round(subtotal * GST_RATE * 100) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;
  const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const videoName = (v, i) => (v.name && v.name.trim()) || `Video ${i + 1}`;

  const setCount = (next) => {
    const n = Math.max(1, Math.min(10, next));
    setVideoCount(n);
    setVideos((cur) => {
      const arr = [...cur];
      while (arr.length < n) arr.push(copyToRest ? { ...arr[0], files: [...(arr[0].files || [])] } : newVideo());
      arr.length = n;
      return arr;
    });
    if (activeVideo >= n) setActiveVideo(n - 1);
  };

  const updateVideo = (patch) => {
    setVideos((cur) => {
      const arr = cur.map((v, i) => (i === activeVideo ? { ...v, ...patch } : v));
      if (copyToRest) return arr.map((v) => ({ ...arr[activeVideo] }));
      return arr;
    });
  };

  const renameVideo = (i) => {
    const next = window.prompt('Rename this video', videoName(videos[i], i));
    if (next === null) return;
    setVideos((cur) => cur.map((v, idx) => (idx === i ? { ...v, name: next.slice(0, 40) } : v)));
  };

  const deleteVideo = (i) => {
    if (videoCount <= 1) { toast.error('At least one video is required'); return; }
    setVideos((cur) => cur.filter((_, idx) => idx !== i));
    setVideoCount((c) => c - 1);
    setActiveVideo(0);
  };

  const modifyVideo = (i) => { setActiveVideo(i); setStage('setup'); };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await axios.post(`${API}/upload/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        urls.push({ name: file.name, url: res.data.file_url });
      }
      updateVideo({ files: [...(videos[activeVideo].files || []), ...urls] });
      toast.success('Files uploaded');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const composeBrief = () => {
    const lines = [];
    lines.push(`Plan: ${plan?.name} (₹${plan?.price}/video) — ${plan?.tags}`);
    lines.push(`Videos: ${videoCount}`);
    lines.push(`Delivery: ${dateChoice === 'today' ? 'Today' : 'Tomorrow'}, ${slot}`);
    videos.forEach((v, i) => {
      lines.push('');
      lines.push(`— Video ${i + 1} —`);
      lines.push(`Duration: ${v.duration} | Language: ${v.language} | Orientation: ${v.orientation} | Background: ${v.background}`);
      if (v.product) lines.push(`Features a product: ${v.product}`);
      if (v.logoPosition && v.logoPosition !== 'No Preference') lines.push(`Logo position: ${v.logoPosition}`);
      if (v.pronunciation) lines.push(`Brand name pronunciation: ${v.pronunciation}`);
      if ((v.files || []).length) lines.push(`Brand files: ${v.files.map((f) => f.url).join(', ')}`);
      if (v.links) lines.push(`Links: ${v.links}`);
      if (v.notes) lines.push(`Notes: ${v.notes}`);
    });
    return lines.join('\n');
  };

  const proceed = async () => {
    setSubmitting(true);
    try {
      await axios.post(`${API}/campaigns`, {
        title: `${plan?.name || 'Creator Plan'} — ${videoCount} video${videoCount > 1 ? 's' : ''}`,
        brief_text: composeBrief(),
        deliverables: `${videoCount} x ${plan?.name || 'Creator Plan'} (${videos[0].duration}, ${videos[0].orientation})`,
        budget_min: subtotal,
        budget_max: subtotal,
        requires_shipment: videos.some((v) => v.product === 'Yes'),
        delivery_date: dateChoice,
        delivery_slot: slot,
        plan: plan?.id,
        video_count: videoCount,
        selected_creator: creatorId,
      });
      toast.success('Brief sent — the deal has started with the creator');
      if (onPublished) onPublished();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to send brief'));
    } finally {
      setSubmitting(false);
    }
  };

  const v = videos[activeVideo] || newVideo();

  return (
    <div className="pb-overlay" onClick={onClose}>
      <div className="pb-modal" onClick={(e) => e.stopPropagation()}>
        {/* Left rail */}
        <aside className="pb-rail">
          <div className="pb-tabs">
            <button className="active" type="button">Plan</button>
          </div>

          <div className="pb-rail-body">
            {planLoading ? (
              <div className="pb-plan pb-plan-loading">Loading creator’s plan…</div>
            ) : (
              <div className="pb-plan is-selected">
                <div className="pb-plan-top">
                  <strong>{plan?.name || 'Creator Plan'}</strong>
                </div>
                <div className="pb-price">₹{(plan?.price || 0).toLocaleString('en-IN')} <small>/ video</small></div>
                <div className="pb-plan-tags">{plan?.tags}</div>
                <span className="pb-plan-check"><Check size={14} /></span>
              </div>
            )}

            <div className="pb-rail-section">
              <p className="pb-rail-label">Selected Creator</p>
              <div className="pb-creator"><span className="pb-creator-avatar">{(creatorName || 'C').charAt(0).toUpperCase()}</span><strong>{creatorName}</strong></div>
            </div>

            <div className="pb-rail-section">
              <p className="pb-rail-label">Date</p>
              <div className="pb-date-row">
                <button type="button" className={dateChoice === 'today' ? 'active' : ''} onClick={() => setDateChoice('today')}>Today, 25th Jun</button>
                <button type="button" className={dateChoice === 'tomorrow' ? 'active' : ''} onClick={() => setDateChoice('tomorrow')}>Tomorrow, 26th Jun</button>
              </div>
            </div>

            <div className="pb-rail-section">
              <p className="pb-rail-label">Delivery Slot</p>
              <Select value={slot} onChange={setSlot} options={SLOTS} />
            </div>
          </div>

          <div className="pb-rail-total">
            <span>Estimated total</span>
            <strong>₹{total.toLocaleString('en-IN')}</strong>
          </div>
        </aside>

        {/* Right content */}
        <section className="pb-content">
          <button className="pb-close" aria-label="Close" onClick={onClose}><X size={18} /></button>

          {stage === 'setup' ? (
          <>
          <div className="pb-head">
            <span className="pb-step">Step 1</span>
            <h2>Choose your plan &amp; set up your videos</h2>
            <p>Start fast — select a plan and basic preferences so we can tailor your project instantly.</p>
          </div>

          <div className="pb-scroll">
            <div className="pb-counter-row">
              <span>How many <strong>videos</strong> do you need?</span>
              <div className="pb-counter">
                <button type="button" onClick={() => setCount(videoCount - 1)}><Minus size={16} /></button>
                <span>{videoCount}</span>
                <button type="button" onClick={() => setCount(videoCount + 1)}><Plus size={16} /></button>
              </div>
            </div>

            {videoCount > 1 && (
              <div className="pb-video-tabs">
                {videos.map((_, i) => (
                  <button key={i} type="button" className={i === activeVideo ? 'active' : ''} onClick={() => setActiveVideo(i)}>
                    Video {i + 1}
                  </button>
                ))}
              </div>
            )}

            <div className="pb-video-title"><Check size={16} className="pb-video-title-check" /> Video {activeVideo + 1} Details <Pencil size={14} /></div>

            <div className="pb-grid">
              <Field label="Duration"><Select value={v.duration} onChange={(val) => updateVideo({ duration: val })} options={DURATIONS} /></Field>
              <Field label="Language"><Select value={v.language} onChange={(val) => updateVideo({ language: val })} options={LANGUAGES} /></Field>
              <Field label="Video Orientation"><Select value={v.orientation} onChange={(val) => updateVideo({ orientation: val })} options={ORIENTATIONS} /></Field>
              <Field label="Video Background"><Select value={v.background} onChange={(val) => updateVideo({ background: val })} options={BACKGROUNDS} /></Field>
              <Field label="Does it feature a product"><Select value={v.product} onChange={(val) => updateVideo({ product: val })} options={PRODUCTS} placeholder="Select" /></Field>
            </div>

            <button type="button" className="pb-guidelines-toggle" onClick={() => updateVideo({ guidelinesOpen: !v.guidelinesOpen })}>
              <Plus size={15} /> Add Brand Guidelines
            </button>

            {v.guidelinesOpen && (
              <div className="pb-guidelines">
                <p className="pb-guidelines-help">Upload your brand files: logo, assets, visuals, and supporting links.</p>
                <label className="pb-dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
                  <span className="pb-dropzone-icon"><UploadCloud size={22} /></span>
                  <strong>Choose a file or drag &amp; drop here</strong>
                  <small>JPEG, PNG, PDF, and MP4 formats, up to 500MB</small>
                  <span className="pb-browse">{uploading ? 'Uploading…' : 'Browse'}</span>
                  <input type="file" multiple hidden accept="image/*,application/pdf,video/mp4" onChange={(e) => handleFiles(e.target.files)} />
                </label>
                {(v.files || []).length > 0 && (
                  <div className="pb-files">
                    {v.files.map((f, i) => <span key={i} className="pb-file-chip"><FileText size={13} /> {f.name}</span>)}
                  </div>
                )}

                <div className="pb-or"><span>or</span></div>
                <Field label="Supporting links"><input type="text" value={v.links} onChange={(e) => updateVideo({ links: e.target.value })} placeholder="Paste reference / asset links" /></Field>

                <Field label="Preferred logo position in Video"><Select value={v.logoPosition} onChange={(val) => updateVideo({ logoPosition: val })} options={LOGO_POSITIONS} /></Field>

                <div className="pb-field">
                  <span>Add Brand Name Pronunciation (Optional)</span>
                  <div className="pb-pronounce">
                    <input type="text" value={v.pronunciation} onChange={(e) => updateVideo({ pronunciation: e.target.value })} placeholder="Type how the brand name is pronounced" />
                    <span className="pb-mic" title="Type the pronunciation"><Mic size={15} /></span>
                  </div>
                </div>

                <div className="pb-field">
                  <span>Additional Instructions (Optional)</span>
                  <div className="pb-notes-tabs"><span className="active"><FileText size={13} /> Add Notes</span><span><Link2 size={13} /> Upload files &amp; Links</span></div>
                  <textarea value={v.notes} onChange={(e) => updateVideo({ notes: e.target.value })} rows={3} placeholder="Add notes and additional details to be noted of.." />
                </div>
              </div>
            )}
          </div>

          <div className="pb-footer">
            <label className="pb-copy">
              <input type="checkbox" checked={copyToRest} onChange={(e) => { setCopyToRest(e.target.checked); if (e.target.checked) setVideos((cur) => cur.map(() => ({ ...cur[activeVideo] }))); }} />
              <span>Copy these responses to the rest videos</span>
            </label>
            <button type="button" className="pb-proceed" onClick={() => setStage('payment')} disabled={submitting}>Proceed</button>
          </div>
          </>
          ) : (
          <>
          <div className="pb-head">
            <span className="pb-step">Step 3</span>
            <h2>Payment</h2>
            <p>You&apos;re one step away from getting your video in motion 🎬</p>
          </div>

          <div className="pb-scroll pb-pay-body">
            <div className="pb-pay-videos">
              {videos.map((vid, i) => (
                <div key={i} className="pb-pay-card">
                  <div className="pb-pay-card-head">
                    <strong>{videoName(vid, i)} Details</strong>
                    <button type="button" className="pb-rename" onClick={() => renameVideo(i)}><Tag size={13} /> Rename</button>
                  </div>
                  <p className="pb-pay-specs">{vid.duration} / {vid.language} / Standard / {vid.orientation} / {vid.background} / {vid.product === 'Yes' ? 'Product added' : 'No product added'}</p>
                  <p className="pb-pay-actor">{creatorName} - - -</p>
                  <div className="pb-pay-actions">
                    <button type="button" className="pb-pay-del" onClick={() => deleteVideo(i)}><Trash2 size={14} /> Delete</button>
                    <button type="button" className="pb-pay-mod" onClick={() => modifyVideo(i)}><Pencil size={14} /> Modify</button>
                  </div>
                </div>
              ))}
            </div>

            <aside className="pb-summary">
              <div className="pb-summary-rows">
                {videos.map((vid, i) => (
                  <div key={i} className="pb-summary-row">
                    <span>{videoName(vid, i)}</span>
                    <div><strong>{inr(plan?.price || 0)}</strong><small>Breakdown</small></div>
                  </div>
                ))}
              </div>
              <div className="pb-summary-foot">
                <p className="pb-credits"><Info size={13} /> Available credits: 0</p>
                <div className="pb-summary-line"><span>Subtotal</span><strong>{inr(subtotal)}</strong></div>
                <div className="pb-summary-line"><span>GST <em>18%</em></span><strong>{inr(gst)}</strong></div>
                <div className="pb-summary-line pb-summary-total"><span>Total</span><strong>{inr(total)}</strong></div>
              </div>
            </aside>
          </div>

          <div className="pb-footer">
            <button type="button" className="pb-goback" onClick={() => setStage('setup')} disabled={submitting}>Go Back</button>
            <button type="button" className="pb-proceed" onClick={proceed} disabled={submitting}>{submitting ? 'Processing…' : 'Proceed to payment'}</button>
          </div>
          </>
          )}
        </section>
      </div>

      <style>{`
        .pb-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 18px; }
        .pb-modal { width: min(1000px, calc(100% - 220px)); height: min(640px, 92vh); background: #fff; border-radius: 18px; display: grid; grid-template-columns: 280px 1fr; overflow: hidden; box-shadow: 0 30px 70px rgba(15,23,42,0.35); font-family: inherit; transform: translateX(100px); }
        @media (max-width: 760px) { .pb-modal { transform: none; width: 100%; } }
        .pb-rail { background: #fafbfd; border-right: 1px solid #eef0f6; padding: 16px; display: flex; flex-direction: column; gap: 14px; overflow: auto; }
        .pb-tabs { display: flex; gap: 18px; border-bottom: 1px solid #eef0f6; }
        .pb-tabs button { background: none; border: 0; padding: 6px 2px 10px; font-weight: 700; color: #94a3b8; cursor: pointer; border-bottom: 2px solid transparent; }
        .pb-tabs button.active { color: #0f172a; border-bottom-color: #7387ff; }
        .pb-rail-body { display: flex; flex-direction: column; gap: 14px; }
        .pb-plan { position: relative; text-align: left; border: 1px solid #eef0f6; background: #fff; border-radius: 14px; padding: 12px; cursor: pointer; }
        .pb-plan.is-selected { background: #f1f3ff; border-color: #c3cbff; }
        .pb-plan-loading { color: #94a3b8; font-weight: 600; text-align: center; }
        .pb-plan-top { display: flex; align-items: center; gap: 8px; }
        .pb-plan-top strong { color: #0f172a; font-size: 0.98rem; }
        .pb-sample { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: #7387ff; border: 1px solid #c3cbff; border-radius: 999px; padding: 1px 7px; font-weight: 700; }
        .pb-price { font-size: 1.5rem; font-weight: 800; color: #7387ff; margin-top: 4px; }
        .pb-price small { font-size: 0.8rem; color: #94a3b8; font-weight: 600; }
        .pb-plan-tags { color: #94a3b8; font-size: 0.78rem; font-weight: 600; margin-top: 2px; }
        .pb-plan-check { position: absolute; top: 12px; right: 12px; width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; background: #7387ff; color: #fff; opacity: 0; }
        .pb-plan.is-selected .pb-plan-check { opacity: 1; }
        .pb-rail-section { display: grid; gap: 8px; }
        .pb-rail-label { color: #94a3b8; font-size: 0.78rem; font-weight: 800; margin: 0; }
        .pb-creator { display: flex; align-items: center; gap: 8px; }
        .pb-creator-avatar { width: 34px; height: 34px; border-radius: 999px; background: #e0e7ff; color: #4f46e5; display: grid; place-items: center; font-weight: 800; }
        .pb-creator strong { color: #0f172a; }
        .pb-date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .pb-date-row button { border: 1px solid #e2e8f0; background: #fff; border-radius: 12px; padding: 10px; font-weight: 700; color: #475569; cursor: pointer; font-size: 0.82rem; }
        .pb-date-row button.active { border-color: #7387ff; color: #7387ff; background: #f1f3ff; }
        .pb-addon { display: flex; align-items: center; gap: 8px; border: 1px solid #eef0f6; background: #fff; border-radius: 12px; padding: 10px 12px; cursor: pointer; text-align: left; }
        .pb-addon.is-selected { border-color: #c3cbff; background: #f1f3ff; }
        .pb-addon-check { width: 18px; height: 18px; border-radius: 6px; border: 1px solid #cbd5e1; display: grid; place-items: center; background: #fff; }
        .pb-addon.is-selected .pb-addon-check { background: #7387ff; border-color: #7387ff; color: #fff; }
        .pb-addon-name { flex: 1; font-weight: 700; color: #0f172a; font-size: 0.85rem; }
        .pb-addon-price { font-weight: 800; color: #7387ff; font-size: 0.85rem; }
        .pb-rail-total { margin-top: auto; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #eef0f6; padding-top: 12px; }
        .pb-rail-total span { color: #94a3b8; font-weight: 700; font-size: 0.82rem; }
        .pb-rail-total strong { color: #0f172a; font-size: 1.15rem; }

        .pb-content { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
        .pb-close { position: absolute; top: 14px; right: 14px; width: 36px; height: 36px; border: 0; border-radius: 999px; background: #f1f5f9; color: #0f172a; cursor: pointer; display: grid; place-items: center; z-index: 2; }
        .pb-head { padding: 22px 28px 14px; border-bottom: 1px solid #f1f5f9; }
        .pb-step { display: inline-block; color: #7387ff; border: 1px solid #c3cbff; border-radius: 999px; padding: 2px 12px; font-weight: 800; font-size: 0.78rem; margin-bottom: 8px; }
        .pb-head h2 { margin: 0; color: #0f172a; font-size: 1.3rem; }
        .pb-head p { margin: 6px 0 0; color: #94a3b8; font-size: 0.88rem; }
        .pb-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 28px; }
        .pb-counter-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .pb-counter-row span { color: #334155; }
        .pb-counter { display: flex; align-items: center; gap: 4px; border: 1px solid #e2e8f0; border-radius: 999px; padding: 4px; }
        .pb-counter button { width: 30px; height: 30px; border: 0; background: #f1f5f9; border-radius: 999px; cursor: pointer; display: grid; place-items: center; color: #0f172a; }
        .pb-counter > span { min-width: 28px; text-align: center; font-weight: 800; }
        .pb-video-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .pb-video-tabs button { border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 700; color: #64748b; cursor: pointer; font-size: 0.82rem; }
        .pb-video-tabs button.active { border-color: #7387ff; color: #7387ff; background: #f1f3ff; }
        .pb-video-title { display: flex; align-items: center; gap: 6px; font-weight: 800; color: #0f172a; padding-bottom: 10px; border-bottom: 2px solid #7387ff; width: fit-content; margin-bottom: 18px; }
        .pb-video-title-check { color: #16a34a; }
        .pb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; }
        .pb-field { display: grid; gap: 7px; font-size: 0.85rem; font-weight: 700; color: #334155; }
        .pb-field > span { color: #334155; }
        .pb-field input[type=text], .pb-field textarea { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; font: inherit; color: #0f172a; background: #fff; resize: vertical; }
        .pb-field input:focus, .pb-field textarea:focus { outline: none; border-color: #7387ff; }
        .pb-select { position: relative; }
        .pb-select select { width: 100%; appearance: none; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 34px 10px 12px; font: inherit; color: #0f172a; background: #fff; cursor: pointer; font-weight: 600; }
        .pb-select svg { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
        .pb-guidelines-toggle { margin-top: 18px; background: none; border: 0; color: #7387ff; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; padding: 0; }
        .pb-guidelines { margin-top: 16px; display: grid; gap: 16px; }
        .pb-guidelines-help { margin: 0; color: #475569; font-size: 0.88rem; }
        .pb-dropzone { border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 22px; display: grid; place-items: center; gap: 6px; text-align: center; cursor: pointer; background: #fbfcff; }
        .pb-dropzone-icon { width: 44px; height: 44px; border-radius: 999px; background: #eef2ff; color: #6366f1; display: grid; place-items: center; }
        .pb-dropzone strong { color: #334155; font-size: 0.9rem; }
        .pb-dropzone small { color: #94a3b8; font-size: 0.78rem; }
        .pb-browse { border: 1px solid #e2e8f0; border-radius: 9px; padding: 6px 16px; font-weight: 700; color: #334155; margin-top: 4px; }
        .pb-files { display: flex; flex-wrap: wrap; gap: 8px; }
        .pb-file-chip { display: inline-flex; align-items: center; gap: 5px; background: #f1f5f9; border-radius: 999px; padding: 5px 10px; font-size: 0.78rem; color: #334155; font-weight: 600; }
        .pb-or { text-align: center; position: relative; color: #94a3b8; font-weight: 700; }
        .pb-or::before, .pb-or::after { content: ''; position: absolute; top: 50%; width: 42%; height: 1px; background: #eef0f6; }
        .pb-or::before { left: 0; } .pb-or::after { right: 0; }
        .pb-pronounce { display: flex; gap: 8px; align-items: center; }
        .pb-pronounce input { flex: 1; }
        .pb-mic { width: 40px; height: 40px; border-radius: 999px; border: 1px solid #fecaca; color: #ef4444; display: grid; place-items: center; flex: 0 0 auto; }
        .pb-notes-tabs { display: flex; gap: 8px; }
        .pb-notes-tabs span { display: inline-flex; align-items: center; gap: 5px; font-size: 0.8rem; font-weight: 700; color: #94a3b8; padding: 5px 10px; border-radius: 8px; }
        .pb-notes-tabs span.active { background: #f1f3ff; color: #7387ff; }
        .pb-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 28px; border-top: 1px solid #f1f5f9; }
        .pb-copy { display: flex; align-items: center; gap: 8px; color: #64748b; font-weight: 600; font-size: 0.85rem; cursor: pointer; }
        .pb-copy input { width: 16px; height: 16px; }
        .pb-proceed { background: #7387ff; color: #fff; border: 0; border-radius: 11px; padding: 13px 34px; font-weight: 800; cursor: pointer; }
        .pb-proceed:disabled { opacity: 0.6; cursor: not-allowed; }
        .pb-goback { background: #f1f5f9; color: #475569; border: 0; border-radius: 11px; padding: 13px 28px; font-weight: 800; cursor: pointer; }

        /* Payment step */
        .pb-pay-body { display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }
        .pb-pay-videos { display: grid; gap: 16px; }
        .pb-pay-card { border: 1px solid #eef0f6; border-radius: 14px; padding: 16px; }
        .pb-pay-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .pb-pay-card-head strong { color: #0f172a; }
        .pb-rename { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; padding: 5px 10px; font-size: 0.78rem; font-weight: 700; color: #475569; cursor: pointer; }
        .pb-pay-specs { color: #94a3b8; font-size: 0.82rem; font-weight: 600; margin: 10px 0 4px; }
        .pb-pay-actor { color: #64748b; font-size: 0.82rem; margin: 0 0 12px; }
        .pb-pay-actions { display: flex; gap: 22px; border-top: 1px solid #f1f5f9; padding-top: 12px; }
        .pb-pay-del, .pb-pay-mod { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; font-weight: 700; cursor: pointer; font-size: 0.85rem; }
        .pb-pay-del { color: #ef4444; }
        .pb-pay-mod { color: #6366f1; }
        .pb-summary { border: 1px solid #eef0f6; border-radius: 14px; padding: 14px; position: sticky; top: 0; }
        .pb-summary-rows { display: grid; gap: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
        .pb-summary-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .pb-summary-row > span { color: #334155; font-weight: 600; font-size: 0.88rem; }
        .pb-summary-row > div { text-align: right; }
        .pb-summary-row strong { color: #0f172a; display: block; }
        .pb-summary-row small { color: #7387ff; font-size: 0.72rem; font-weight: 700; }
        .pb-summary-foot { display: grid; gap: 8px; padding-top: 12px; }
        .pb-credits { display: flex; align-items: center; gap: 6px; color: #7387ff; font-size: 0.78rem; font-weight: 700; margin: 0 0 4px; }
        .pb-summary-line { display: flex; align-items: center; justify-content: space-between; color: #475569; font-weight: 600; font-size: 0.9rem; }
        .pb-summary-line em { background: #f1f5f9; border-radius: 6px; padding: 1px 6px; font-style: normal; font-size: 0.72rem; }
        .pb-summary-total { border-top: 1px solid #f1f5f9; padding-top: 8px; color: #0f172a; font-size: 1.05rem; }
        .pb-summary-total strong { color: #0f172a; }
        @media (max-width: 760px) { .pb-pay-body { grid-template-columns: 1fr; } }
        @media (max-width: 760px) { .pb-modal { grid-template-columns: 1fr; height: 94vh; } .pb-rail { display: none; } .pb-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
