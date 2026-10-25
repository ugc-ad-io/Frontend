import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ImagePlus, Camera, Check, ArrowRight, ArrowLeft, Plus, Info, Instagram, CloudUpload, Hourglass } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { useAuth } from '../../../App';
import { apiErrorMessage } from '../../../utils/apiError';
import { uploadMedia, tooLargeMessage, MAX_UPLOAD_MB } from '../../../utils/upload';
import { mediaUrl } from '../../../utils/mediaUrl';
import { NICHE_CATEGORIES, CONTENT_CATEGORIES } from '../../../constants/contentCategories';
import './onboarding.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Instagram only (the website dropped the other platforms); the other keys stay so old submissions still load.
const LINK_RE = {
  youtube: /^(https?:\/\/)?(www\.)?(youtube\.com\/(@[\w.-]+|channel\/|c\/|user\/)[\w./-]*|youtu\.be\/[\w-]+)\/?(?:[?#][^\s]*)?$/i,
  linkedin: /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company|pub|school)\/[\w%.-]+\/?(?:[?#][^\s]*)?$/i,
  // Full profile link only, no bare @handle: a handle alone can't be opened to verify the account.
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/[a-z0-9._]+\/?(?:[?#][^\s]*)?$/i,
  tiktok: /^(https?:\/\/)?(www\.)?tiktok\.com\/@?[\w.-]+\/?(?:[?#][^\s]*)?$|^@?[a-z0-9._]{1,30}$/i,
};
const linkError = (key, value) => {
  const v = String(value || '').trim();
  if (!v || LINK_RE[key].test(v)) return '';
  return key === 'instagram' ? 'Enter your full Instagram profile link (e.g. https://instagram.com/yourhandle)' : `Enter a valid ${key} link or @handle`;
};

const STEP_NAMES = ['About you', 'Your videos', 'Your rates'];
const STEP_KEYS = [['profilePicture', 'name', 'links'], ['contentStyles', 'contentCategories', 'portfolio'], ['rawPayout']];
const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const toUrl = (res) => { const u = res?.file_url || res?.url; return u && u.startsWith('/') ? `${BACKEND_URL}${u}` : u; };

export default function CreatorSetup() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(null);
  const [extraLinks, setExtraLinks] = useState([]);
  const [addingMore, setAddingMore] = useState(false);
  const videoRef = useRef(null);
  const prefilledRef = useRef(false);
  const pfIdRef = useRef(1);
  const topRef = useRef(null);
  const [data, setData] = useState({
    photoPreview: '', profilePicture: '', bannerPreview: '', banner: '', name: '',
    contentStyles: [], customStyle: '', contentCategories: [],
    videoName: '', videoPreview: '', videoUrl: '', pfCategory: '', pfPrice: '', pfDelivery: '',
    rawPayout: '', editingPayout: '',
    portfolio: [],
    links: { youtube: '', linkedin: '', instagram: '', tiktok: '' },
  });
  const set = (field, value) => setData((d) => ({ ...d, [field]: value }));
  const toggleIn = (field, value) => setData((d) => ({ ...d, [field]: d[field].includes(value) ? d[field].filter((v) => v !== value) : [...d[field], value] }));

  // Prefill from a previous submission (e.g. "more info" requested) so it isn't re-entered.
  useEffect(() => {
    const pr = user?.profile;
    if (prefilledRef.current || !pr || typeof pr !== 'object' || !Object.keys(pr).length) return;
    prefilledRef.current = true;
    const styleVals = new Set(CONTENT_CATEGORIES.map((c) => c.value));
    const nicheVals = new Set(NICHE_CATEGORIES.map((c) => c.value));
    const pickKnown = (list, allowed) => (Array.isArray(list) ? list : [list]).filter((v) => allowed.has(v));
    setData((d) => ({
      ...d,
      photoPreview: pr.profile_picture || d.photoPreview,
      profilePicture: pr.profile_picture || d.profilePicture,
      bannerPreview: pr.banner || d.bannerPreview,
      banner: pr.banner || d.banner,
      name: pr.fullName || pr.full_name || pr.name || d.name,
      contentStyles: pickKnown(pr.content_styles || pr.content_style, styleVals),
      contentCategories: pickKnown(pr.content_categories || pr.niche || pr.primary_category, nicheVals),
      videoUrl: pr.intro_video || d.videoUrl,
      videoPreview: pr.intro_video || d.videoPreview,
      rawPayout: String(pr.rate_card?.raw_payout || pr.rate_card?.expected_payout || ''),
      editingPayout: String(pr.rate_card?.editing_payout || ''),
      portfolio: Array.isArray(pr.portfolio_items) && pr.portfolio_items.length
        ? pr.portfolio_items.map((it, i) => ({ id: i + 1, category: it.category || '', price: it.price || '', delivery: it.delivery || '', videoUrl: it.videoUrl || it.url || '' }))
        : d.portfolio,
      links: { ...d.links, ...Object.fromEntries(Object.entries(pr.social_links || {}).filter(([k]) => k in LINK_RE)) },
    }));
    setExtraLinks(Object.entries(pr.social_links || {}).filter(([k, v]) => /^link_\d+$/.test(k) && v).map(([, v], i) => ({ id: i + 1, url: String(v) })));
    if (Array.isArray(pr.portfolio_items)) pfIdRef.current = pr.portfolio_items.length + 1;
  }, [user?.id, user?.profile]);

  const upImage = async (file, kind) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image is too large. Maximum 5MB.'); return; }
    const isPhoto = kind === 'photo';
    set(isPhoto ? 'photoPreview' : 'bannerPreview', URL.createObjectURL(file));
    (isPhoto ? setPhotoUploading : setBannerUploading)(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/upload/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = toUrl(res.data);
      if (url) setData((d) => (isPhoto ? { ...d, profilePicture: url, photoPreview: url } : { ...d, banner: url, bannerPreview: url }));
      else toast.error(`${isPhoto ? 'Photo' : 'Banner'} upload failed. Please try again.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, `${isPhoto ? 'Photo' : 'Banner'} upload failed`));
    } finally {
      (isPhoto ? setPhotoUploading : setBannerUploading)(false);
    }
  };

  const onPickVideo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) { toast.error('Please choose a video file.'); return; }
    if (file.size > MAX_UPLOAD_MB * 1048576) { toast.error(tooLargeMessage(file)); return; }
    setVideoUploading(true);
    setVideoProgress(0);
    setData((d) => ({ ...d, videoName: file.name, videoPreview: URL.createObjectURL(file) }));
    try {
      const url = toUrl(await uploadMedia(file, API, { onProgress: setVideoProgress }));
      if (url) setData((d) => ({ ...d, videoUrl: url }));
      else { toast.error('Video upload failed. Please try again.'); setData((d) => ({ ...d, videoName: '', videoPreview: '' })); }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Video upload failed'));
      setData((d) => ({ ...d, videoName: '', videoPreview: '' }));
    } finally {
      setVideoUploading(false);
      setVideoProgress(null);
    }
  };

  const draftReady = Boolean(data.videoUrl) && Number(data.pfPrice) > 0 && Number(data.pfDelivery) > 0 && Boolean(data.pfCategory);
  const addDraft = () => {
    if (!draftReady || videoUploading) return;
    const id = pfIdRef.current++;
    setData((d) => ({ ...d, portfolio: [...d.portfolio, { id, category: d.pfCategory, price: d.pfPrice, delivery: d.pfDelivery, videoUrl: d.videoUrl }], videoName: '', videoPreview: '', videoUrl: '', pfCategory: '', pfPrice: '', pfDelivery: '' }));
    setAddingMore(false);
  };
  const removeItem = (id) => setData((d) => ({ ...d, portfolio: d.portfolio.filter((it) => it.id !== id) }));

  const linksFilled = Object.values(data.links).some((v) => v.trim());
  const linksValid = Object.entries(data.links).every(([k, v]) => !linkError(k, v));
  const checks = {
    profilePicture: !!data.profilePicture,
    name: data.name.trim() !== '',
    contentStyles: data.contentStyles.length > 0,
    contentCategories: data.contentCategories.length > 0,
    portfolio: data.portfolio.length > 0 || draftReady,
    rawPayout: Number(data.rawPayout) > 0,
    links: linksFilled && linksValid,
  };
  const err = (k) => showErrors && !checks[k];
  const stepOk = (i) => STEP_KEYS[i].every((k) => checks[k]);
  const toTop = () => setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  const scrollToError = () => setTimeout(() => document.querySelector('.ap-ob-f.is-error, .ap-ob-pick.is-error, .ap-ob-draft.is-error, .ap-ob-wrap.is-error, .ap-ob-link.is-error, .ap-ob-money.is-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  const goStep = (i) => { setShowErrors(false); setStep(i); toTop(); };
  const goNext = () => {
    if (!stepOk(step)) { setShowErrors(true); scrollToError(); return; }
    goStep(step + 1);
  };

  const submit = async () => {
    if (submitting) return;
    if (!Object.values(checks).every(Boolean)) {
      const bad = STEP_KEYS.findIndex((_, i) => !stepOk(i));
      if (bad !== step) setStep(bad);
      setShowErrors(true);
      scrollToError();
      return;
    }
    setSubmitting(true);
    const styleValue = (v) => (v === 'custom' ? (data.customStyle.trim() || 'Custom') : v);
    const styles = data.contentStyles.map(styleValue);
    const niches = data.contentCategories;
    const portfolio = draftReady ? [...data.portfolio, { category: data.pfCategory, price: data.pfPrice, delivery: data.pfDelivery, videoUrl: data.videoUrl }] : data.portfolio;
    try {
      await axios.put(`${API}/profile/creator`, {
        profile_picture: data.profilePicture,
        banner: data.banner,
        fullName: data.name.trim(),
        full_name: data.name.trim(),
        first_name: data.name.trim().split(/\s+/)[0] || '',
        content_styles: styles,
        content_style: styles[0] || '',
        content_categories: niches,
        niche: niches[0] || '',
        category: niches[0] || styles[0] || '',
        primary_category: niches[0] || styles[0] || '',
        intro_video: portfolio[0]?.videoUrl || '',
        portfolio_items: portfolio.map((it) => ({ title: 'Portfolio Sample', category: it.category, price: it.price, delivery: it.delivery, videoUrl: it.videoUrl, url: it.videoUrl })),
        social_links: {
          ...Object.fromEntries(Object.entries(data.links).filter(([, v]) => v.trim())),
          ...Object.fromEntries(extraLinks.filter((l) => l.url.trim()).map((l, i) => [`link_${i + 1}`, l.url.trim()])),
        },
        rate_card: { raw_payout: data.rawPayout, expected_payout: data.rawPayout, editing_payout: data.editingPayout || 0 },
        receive_briefs: true,
        terms_agreed: true,
      });
      setUser({ ...user, profile_completed: true, approval_status: 'pending' });
      setSubmitted(true);
      toTop();
    } catch (error) {
      toast.error(error?.response ? apiErrorMessage(error, 'Failed to submit profile') : "You're offline. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const busy = photoUploading || bannerUploading || videoUploading;

  if (submitted) {
    return (
      <AppShell title="Profile submitted" tabs={false}>
        <section className="ap-card ap-ob-gate">
          <span className="ap-ob-gate-ic"><Hourglass size={28} /></span>
          <h1>We’re checking your profile</h1>
          <p>Thanks for submitting your creator profile. Our team will review it and get back to you within 24-48 hours.</p>
          <div className="ap-ob-prog">
            <div className="ap-ob-seg" aria-hidden="true"><i className="on" /><i className="on" /><i /></div>
            <div className="ap-ob-prog-l"><span>Submitted</span><span className="now">In review</span><span>Live</span></div>
          </div>
          <div className="ap-ob-acts">
            <button type="button" className="ap-btn ap-btn--block" onClick={() => navigate('/kyc')}>Add payout details</button>
            <button type="button" className="ap-btn ap-btn--ghost ap-btn--block" onClick={() => logout()}>Back to sign in <ArrowRight size={16} /></button>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title="Set up your profile" tabs={false}>
      <div ref={topRef}>
        <div className="ap-ob-top"><span>Step {step + 1} of 3 · {STEP_NAMES[step]}</span><span>about {[4, 3, 1][step]} min</span></div>
        <div className="ap-ob-seg" style={{ gridTemplateColumns: 'repeat(3,1fr)' }} role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1}>
          {STEP_NAMES.map((n, i) => <i key={n} className={i <= step ? 'on' : ''} />)}
        </div>
      </div>

      {step === 0 && (
        <div className="ap-card ap-ob-card">
          <h2>About you</h2>
          <p className="ap-ob-sub">Brands see this on your card and profile.</p>

          <div className="ap-ob-f">
            <label className={`ap-ob-pick${err('profilePicture') ? ' is-error' : ''}`}>
              <span className="ap-ob-avatar">
                {data.photoPreview ? <img src={data.photoPreview} alt="" /> : <ImagePlus size={24} />}
                <b><Camera size={13} /></b>
              </span>
              <span>
                <strong>{photoUploading ? 'Uploading…' : (data.photoPreview ? 'Change photo' : 'Upload profile photo')}</strong>
                <small>JPG or PNG, up to 5MB</small>
              </span>
              <input type="file" accept="image/*" hidden onChange={(e) => { upImage(e.target.files?.[0], 'photo'); e.target.value = ''; }} />
            </label>
            {err('profilePicture') && <span className="ap-ob-err">A profile photo is required</span>}
          </div>

          <label className="ap-ob-pick">
            <span className="ap-ob-avatar is-wide">{data.bannerPreview ? <img src={data.bannerPreview} alt="" /> : <ImagePlus size={22} />}</span>
            <span>
              <strong>{bannerUploading ? 'Uploading…' : (data.bannerPreview ? 'Change banner' : 'Banner image')} <em style={{ fontStyle: 'normal', fontWeight: 500, color: '#9a9ac0' }}>(Optional)</em></strong>
              <small>Shown at the top of your profile</small>
            </span>
            <input type="file" accept="image/*" hidden onChange={(e) => { upImage(e.target.files?.[0], 'banner'); e.target.value = ''; }} />
          </label>

          <div className={`ap-ob-f${err('name') ? ' is-error' : ''}`}>
            <label htmlFor="ps-name">Name brands see</label>
            <input id="ps-name" className="ap-ob-in" placeholder="Your full name" autoComplete="name" value={data.name} onChange={(e) => set('name', e.target.value)} />
            {err('name') && <span className="ap-ob-err">This field is required</span>}
          </div>

          <div className="ap-ob-f">
            <span className="ap-ob-lbl">Instagram profile <em>(Required)</em></span>
            <div className={`ap-ob-link${(showErrors && linkError('instagram', data.links.instagram)) || err('links') ? ' is-error' : ''}`}>
              <span className="ap-ob-link-b" style={{ background: 'linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)' }}><Instagram size={18} /></span>
              <input aria-label="Instagram profile link" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://instagram.com/yourhandle" value={data.links.instagram} onChange={(e) => set('links', { ...data.links, instagram: e.target.value })} />
            </div>
            {showErrors && linkError('instagram', data.links.instagram) && <span className="ap-ob-err">{linkError('instagram', data.links.instagram)}</span>}
            {extraLinks.map((l) => (
              <div key={l.id} className="ap-ob-link">
                <span className="ap-ob-link-b" style={{ background: '#7387ff' }}><Info size={17} /></span>
                <input aria-label="Website or custom link" inputMode="url" autoCapitalize="none" placeholder="Website or custom link" value={l.url} onChange={(e) => setExtraLinks((ls) => ls.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))} />
                <button type="button" aria-label="Remove link" onClick={() => setExtraLinks((ls) => ls.filter((x) => x.id !== l.id))}>×</button>
              </div>
            ))}
            <button type="button" className="ap-ob-textbtn" onClick={() => setExtraLinks((ls) => [...ls, { id: Date.now(), url: '' }])}><Plus size={15} /> Add another social link</button>
            {err('links') && <span className="ap-ob-err">Add your full Instagram profile link</span>}
          </div>
        </div>
      )}

      {step === 1 && (
        <>
          <div className="ap-card ap-ob-card">
            <h2>Your best videos</h2>
            <p className="ap-ob-sub">UGC, brand ads, reels or speaking samples work best. These show first on your card.</p>

            {data.portfolio.length > 0 && (
              <div className="ap-ob-vids">
                {data.portfolio.map((it) => (
                  <div className="ap-ob-vid" key={it.id}>
                    <video src={`${mediaUrl(it.videoUrl)}#t=0.5`} muted playsInline preload="metadata" />
                    <button type="button" className="ap-ob-vid-x" onClick={() => removeItem(it.id)} aria-label={`Remove ${it.category} video`}>Remove</button>
                    <div className="ap-ob-vid-m">{it.category}<span>₹{it.price} · {it.delivery} {/\d/.test(it.delivery) && !/day/i.test(it.delivery) ? 'day(s)' : ''}</span></div>
                  </div>
                ))}
              </div>
            )}
            {data.portfolio.length > 0 && !addingMore && (
              <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setAddingMore(true)}><Plus size={16} /> Add more videos</button>
            )}

            {(data.portfolio.length === 0 || addingMore) && (
              <div className={`ap-ob-draft${err('portfolio') ? ' is-error' : ''}`}>
                {data.videoPreview ? (
                  <div className="ap-ob-prev">
                    <video src={data.videoPreview} muted controls playsInline />
                    <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" style={{ marginTop: 8 }} onClick={() => videoRef.current?.click()} disabled={videoUploading}>{videoUploading ? 'Uploading…' : 'Change video'}</button>
                  </div>
                ) : (
                  <button type="button" className="ap-ob-drop" onClick={() => videoRef.current?.click()} disabled={videoUploading}>
                    <CloudUpload size={28} />
                    <strong>Add video</strong>
                    <span>Tap to choose from your phone (max {MAX_UPLOAD_MB} MB)</span>
                  </button>
                )}
                {videoUploading && videoProgress != null && (
                  <>
                    <div className="ap-ob-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={videoProgress}><i style={{ width: `${videoProgress}%` }} /></div>
                    <span className="ap-ob-hint">{videoProgress >= 100 ? 'Processing…' : `Uploading ${videoProgress}%`}</span>
                  </>
                )}
                <input ref={videoRef} type="file" accept="video/*" hidden onChange={onPickVideo} />
                <div className="ap-ob-row2">
                  <input className="ap-ob-in" placeholder="Price (₹)" aria-label="Price" inputMode="numeric" value={data.pfPrice} onChange={(e) => set('pfPrice', e.target.value.replace(/\D/g, ''))} />
                  <input className="ap-ob-in" placeholder="Days to deliver" aria-label="Delivery time in days" inputMode="numeric" value={data.pfDelivery} onChange={(e) => set('pfDelivery', e.target.value.replace(/\D/g, ''))} />
                </div>
                <select className="ap-ob-in" aria-label="Category" value={data.pfCategory} onChange={(e) => set('pfCategory', e.target.value)}>
                  <option value="" disabled>Category</option>
                  {NICHE_CATEGORIES.map((c) => <option key={c.value} value={c.label}>{c.label}</option>)}
                </select>
                <button type="button" className="ap-btn" onClick={addDraft} disabled={!draftReady || videoUploading}>Add this video</button>
                <span className="ap-ob-hint">Add the video, a price, delivery days and a category. A ready video is also included when you submit.</span>
              </div>
            )}
            {err('portfolio') && <span className="ap-ob-err">Add at least one video to your profile</span>}
          </div>

          <div className="ap-card ap-ob-card">
            <h2>What you make best</h2>
            <p className="ap-ob-sub">We use this to match you with briefs.</p>
            <span className="ap-ob-lbl">Content style <em>(select one or more)</em></span>
            <div className={`ap-ob-wrap${err('contentStyles') ? ' is-error' : ''}`}>
              {CONTENT_CATEGORIES.map((o) => {
                const on = data.contentStyles.includes(o.value);
                return <button key={o.value} type="button" className={`ap-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggleIn('contentStyles', o.value)}>{on && <Check size={14} />}{o.label}</button>;
              })}
            </div>
            {data.contentStyles.includes('custom') && (
              <input className="ap-ob-in" placeholder="Describe your custom content style" aria-label="Custom content style" value={data.customStyle} onChange={(e) => set('customStyle', e.target.value)} />
            )}
            {err('contentStyles') && <span className="ap-ob-err">Select at least one</span>}

            <span className="ap-ob-lbl">Content category <em>(select one or more)</em></span>
            <div className={`ap-ob-wrap${err('contentCategories') ? ' is-error' : ''}`}>
              {NICHE_CATEGORIES.map((o) => {
                const on = data.contentCategories.includes(o.value);
                return <button key={o.value} type="button" className={`ap-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggleIn('contentCategories', o.value)}>{on && <Check size={14} />}{o.label}</button>;
              })}
            </div>
            {err('contentCategories') && <span className="ap-ob-err">Select at least one</span>}
          </div>
        </>
      )}

      {step === 2 && (
        <div className="ap-card ap-ob-card">
          <h2>Price per video</h2>
          <p className="ap-ob-sub">You can change these any time from your profile.</p>
          <div className="ap-ob-rate">
            <div><label htmlFor="raw-payout"><b>Raw video payout</b></label><small>The brand edits it</small></div>
            <span className={`ap-ob-money${err('rawPayout') ? ' is-error' : ''}`}>₹<input id="raw-payout" type="number" min="1" inputMode="numeric" value={data.rawPayout} onChange={(e) => set('rawPayout', e.target.value)} /></span>
          </div>
          {err('rawPayout') && <span className="ap-ob-err">Enter a payout above 0</span>}
          <div className="ap-ob-rate">
            <div><label htmlFor="editing-payout"><b>Additional editing payout</b></label><small>Extra if you also edit it (optional)</small></div>
            <span className="ap-ob-money">+₹<input id="editing-payout" type="number" min="0" inputMode="numeric" value={data.editingPayout} onChange={(e) => set('editingPayout', e.target.value)} /></span>
          </div>
          {Number(data.rawPayout) > 0 && (
            <p className="ap-ob-fine">Brands see: from <strong>{money(data.rawPayout)}</strong>{Number(data.editingPayout) > 0 ? <> · with your edit <strong>{money(Number(data.rawPayout) + Number(data.editingPayout))}</strong></> : null} per video.</p>
          )}
        </div>
      )}

      <div className="ap-ob-foot">
        {step > 0 && <button type="button" className="ap-btn ap-btn--ghost" onClick={() => goStep(step - 1)} disabled={submitting}><ArrowLeft size={16} /> Back</button>}
        {step < 2 ? (
          <button type="button" className="ap-btn ap-ob-next" onClick={goNext} disabled={busy}>{step === 0 ? 'Next: your videos' : 'Next: your rates'} <ArrowRight size={16} /></button>
        ) : (
          <button type="button" className="ap-btn ap-ob-next" onClick={submit} disabled={submitting || busy}>{submitting ? 'Submitting…' : <>Submit profile <ArrowRight size={16} /></>}</button>
        )}
      </div>
    </AppShell>
  );
}
