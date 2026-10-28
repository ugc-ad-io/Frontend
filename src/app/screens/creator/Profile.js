import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { BadgeCheck, Camera, ChevronRight, Film, Pencil, Play, Plus, Star, Trash2, WifiOff, AlertCircle, RefreshCw, Wallet, Settings as SettingsIcon, Upload } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { apiErrorMessage } from '../../../utils/apiError';
import { uploadMedia } from '../../../utils/upload';
import { mediaUrl } from '../../../utils/mediaUrl';
import { s3Preview } from '../../../utils/mediaPreview';
import { creatorFirstName } from '../../../utils/displayName';
import { getProfileChecklist, getProfilePct, getProfileMissing } from '../../../utils/creatorProfileCompletion';
import { resolveLevelKey, LEVEL_META } from '../../../utils/creatorLevel';
import { CONTENT_CATEGORIES, NICHE_CATEGORIES } from '../../../constants/contentCategories';
import PhotoOrInitial from '../../../components/PhotoOrInitial';
import {
  GENDERS, BODY_TYPES, SKIN_TONES, SKILLS_OPTS, LANGUAGES_OPTS, COUNTRIES, STATES, CITIES_BY_STATE,
  CORE_SETUP_OPTS, APPEAR_IN_OPTS, WEEKLY_OPTS, TOPICS_OPTS,
} from './profileOptions';
import './profile.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const MAX_WORKS = 5; // same cap as the website's profile editor

const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
const isVideo = (u) => /\.(mp4|webm|mov|m4v)(?:[?#]|$)|\/video\//i.test(String(u || ''));
const pfUrl = (it) => (typeof it === 'string' ? it : (it?.videoUrl || it?.link || it?.url || (Array.isArray(it?.urls) && it.urls[0]) || it?.original_url || ''));
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const digits = (v) => String(v ?? '').replace(/[^0-9]/g, '');
const asList = (...sources) => {
  for (const s of sources) {
    const list = (Array.isArray(s) ? s : s ? [s] : []).map(String).filter(Boolean);
    if (list.length) return list;
  }
  return [];
};
const STYLE_VALUES = new Set(CONTENT_CATEGORIES.map((o) => o.value));
const NICHE_VALUES = new Set(NICHE_CATEGORIES.map((o) => o.value));
const vidPrice = (price, fallback) => {
  const raw = String(price ?? '').trim();
  if (!raw) return fallback;
  const d = raw.replace(/[₹,\s]/g, '');
  return /^\d+$/.test(d) ? inr(d) : raw;
};
const vidDelivery = (delivery, fallback) => {
  const raw = String(delivery ?? '').trim();
  if (!raw) return fallback;
  return /^\d+$/.test(raw) ? `${raw} day${Number(raw) > 1 ? 's' : ''}` : raw;
};
const labelOf = (list, value) => list.find((o) => o.value === value)?.label || String(value || '').replace(/_/g, ' ');
const href = (url) => (/^https?:\/\//i.test(url) ? url : `https://${String(url).replace(/^\/+/, '')}`);

// Portfolio lives in `portfolio` (added on the website) and/or profile.portfolio_items (signup); merge, de-duped by media URL.
function mergePortfolio(data) {
  if (!data) return [];
  const a = Array.isArray(data.portfolio) ? data.portfolio : [];
  const b = Array.isArray(data.profile?.portfolio_items) ? data.profile.portfolio_items : [];
  const seen = new Set();
  return [...a, ...b].filter((it) => {
    const u = pfUrl(it);
    if (!u || String(u).startsWith('blob:') || seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

function seedForm(data) {
  const pr = data?.profile || {};
  const sl = pr.social_links || {};
  return {
    fullName: pr.fullName || '', age: pr.age || '', gender: pr.gender || '',
    bodyType: pr.bodyType || '', skinTone: pr.skinTone || '',
    contentStyles: asList(pr.content_styles, pr.content_style, STYLE_VALUES.has(pr.category) ? pr.category : ''),
    contentCategories: asList(pr.content_categories, pr.niche, pr.primary_category).filter((v) => NICHE_VALUES.has(v)),
    country: pr.country || '', state: pr.state || '', city: pr.city || '',
    pincode: pr.pincode || '', phone: pr.phone || '', address: pr.address || '',
    languages: Array.isArray(pr.languages) ? pr.languages : [],
    skills: Array.isArray(pr.skills) ? pr.skills : (Array.isArray(data?.tags) ? data.tags : []),
    youtube: sl.youtube || '', instagram: sl.instagram || '', linkedin: sl.linkedin || '',
    coreSetup: Array.isArray(pr.coreSetup) ? pr.coreSetup : [], appearIn: Array.isArray(pr.appearIn) ? pr.appearIn : [], bring: pr.bring || '',
    weekly: pr.weekly || pr.availability_calendar?.weekly || '',
    flexible: !!pr.flexible, topics: Array.isArray(pr.topics) ? pr.topics : [],
    expectedPayout: pr.rate_card?.raw_payout || pr.rate_card?.expected_payout || pr.expectedPayout || '',
    editingPayout: pr.rate_card?.editing_payout || '',
    payoutPeriod: pr.rate_card?.payout_period || pr.payoutPeriod || '',
    budgetRange: data?.budget_range || pr.budget_range || '',
    deliveryDays: String(pr.delivery_days || pr.rate_card?.delivery_days || ''),
  };
}

// Same payload the website's profile editor sends to PUT /profile/creator.
function buildPayload(pr, form, pf) {
  const skills = Array.isArray(form.skills) ? form.skills : [];
  const social_links = { ...(pr.social_links || {}) };
  ['youtube', 'instagram', 'linkedin'].forEach((k) => { if (form[k]) social_links[k] = form[k]; else delete social_links[k]; });
  const styles = Array.isArray(form.contentStyles) ? form.contentStyles : [];
  const niches = Array.isArray(form.contentCategories) ? form.contentCategories : [];
  return {
    ...pr,
    fullName: form.fullName, age: form.age, gender: form.gender,
    bodyType: form.bodyType, skinTone: form.skinTone,
    content_styles: styles, content_style: styles[0] || '',
    content_categories: niches, niche: niches[0] || '',
    category: niches[0] || styles[0] || '', primary_category: niches[0] || styles[0] || '',
    country: form.country, state: form.state, city: form.city,
    pincode: form.pincode, phone: form.phone, address: form.address,
    languages: Array.isArray(form.languages) ? form.languages : [], skills, tags: skills, social_links,
    coreSetup: Array.isArray(form.coreSetup) ? form.coreSetup : [], appearIn: Array.isArray(form.appearIn) ? form.appearIn : [], bring: form.bring,
    weekly: form.weekly, flexible: !!form.flexible, topics: Array.isArray(form.topics) ? form.topics : [],
    availability_calendar: { ...(pr.availability_calendar || {}), weekly: form.weekly, flexible: !!form.flexible },
    expectedPayout: form.expectedPayout, payoutPeriod: form.payoutPeriod,
    delivery_days: form.deliveryDays ? Number(form.deliveryDays) : '',
    rate_card: {
      ...(pr.rate_card || {}),
      expected_payout: form.expectedPayout,
      raw_payout: form.expectedPayout,
      editing_payout: form.editingPayout || 0,
      payout_period: form.payoutPeriod,
      delivery_days: form.deliveryDays ? Number(form.deliveryDays) : '',
    },
    budget_range: form.budgetRange,
    // Keep the full item objects: flattening them to URLs wipes each clip's price / category.
    portfolio: (pf || []).filter((it) => pfUrl(it)),
    portfolio_items: pf || [],
  };
}

const SHEETS = {
  basic: 'Basic information',
  content: 'Niches & content style',
  location: 'Location & contact',
  skills: 'Skills & languages',
  setup: 'Recording setup',
  rates: 'Rates & delivery',
};

function Pick({ label, values, options, onToggle }) {
  const set = new Set(values || []);
  return (
    <div className="ap-prof-pick">
      <span className="ap-label">{label}</span>
      <div className="ap-prof-wrap">
        {options.map((o) => (
          <button type="button" key={o} className={`ap-chip${set.has(o) ? ' is-on' : ''}`} aria-pressed={set.has(o)} onClick={() => onToggle(o)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function Sel({ label, value, onChange, options, placeholder }) {
  return (
    <label className="ap-label">{label}
      <select className="ap-input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder || 'Select'}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function VideoThumb({ url, onClick }) {
  const [clipFailed, setClipFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = mediaUrl(url);
  const video = isVideo(url);
  const clip = video && !clipFailed ? s3Preview(url, 'mp4') : '';
  const poster = video ? s3Preview(url, 'jpg') : '';
  return (
    <button type="button" className="ap-prof-vid" onClick={() => !failed && onClick()} aria-label="Play video">
      {failed ? <span className="ap-prof-vid-bad"><Camera size={18} />Media unavailable</span>
        : video ? <video src={clip || `${src}#t=0.5`} poster={poster || undefined} muted playsInline preload="metadata" onError={() => (clip ? setClipFailed(true) : setFailed(true))} />
          : <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />}
      {!failed && <span className="ap-prof-play"><Play size={14} fill="currentColor" /></span>}
    </button>
  );
}

export default function CreatorProfile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [data, setData] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pf, setPf] = useState([]);
  const [form, setForm] = useState({});
  const [sheet, setSheet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [addForm, setAddForm] = useState({ title: '', url: '', category: '', price: '', delivery: '' });
  const [progress, setProgress] = useState(null);
  const [play, setPlay] = useState('');
  const [rm, setRm] = useState(null);
  const photoRef = useRef(null);
  const bannerRef = useRef(null);
  const workRef = useRef(null);
  const videosRef = useRef(null);
  const loadedRef = useRef(false);

  const id = user?.id;
  const load = () => {
    if (!id) return undefined;
    let live = true;
    axios.get(`${API}/profile/${id}`)
      .then((r) => { if (live) { setData(r.data); setLoadError(''); loadedRef.current = true; } })
      .catch((e) => {
        if (live && !loadedRef.current) setLoadError(e?.response ? apiErrorMessage(e, 'Could not load your profile.') : "You're offline. Check your connection and try again.");
      })
      .finally(() => { if (live) setLoading(false); });
    axios.get(`${API}/reviews/creator/${id}`).then((r) => { if (live) setReviews(Array.isArray(r.data) ? r.data : []); }).catch(() => {});
    return () => { live = false; };
  };
  useLiveEffect(load, [id]);
  useEffect(() => { if (data) setPf(mergePortfolio(data)); }, [data]);
  // /portfolio is the same screen: land on the videos.
  useEffect(() => {
    if (pathname === '/portfolio' && data) videosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pathname, data]);

  const pr = data?.profile || {};
  const p = { ...(data || {}), ...pr };
  const rc = p.rate_card || {};
  const name = data ? creatorFirstName(data) : '';
  const photo = assetUrl(data?.profile_photo || data?.profile_picture || pr.profile_photo || pr.profile_picture || user?.profile_photo || user?.profile_picture || user?.profile?.profile_photo || user?.profile?.profile_picture);
  const banner = assetUrl(data?.banner || p.banner || '');
  const price = Number(digits(rc.raw_payout || rc.expected_payout || p.expectedPayout));
  const editPay = Number(digits(rc.editing_payout));
  const days = Number(p.delivery_days || rc.delivery_days || 0);
  const avg = reviews.length ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;
  const levelKey = resolveLevelKey(user?.level ?? user?.level_key ?? user?.level_label);
  const isChoice = Boolean(user?.ugcad_approved) || levelKey === 'elite';
  const levelBadge = isChoice ? 'UGCAD.IO Choice' : LEVEL_META[levelKey]?.badge;
  const languages = Array.isArray(p.languages) ? p.languages : [];
  const niches = useMemo(() => asList(p.content_categories, p.contentCategories, p.niche, p.primary_category).map((v) => labelOf(NICHE_CATEGORIES, v)), [p.content_categories, p.contentCategories, p.niche, p.primary_category]);
  const styles = asList(p.content_styles, p.content_style).map((v) => labelOf(CONTENT_CATEGORIES, v));
  const works = pf.filter((it) => pfUrl(it));
  const pct = data ? getProfilePct(data) : 100;
  const missing = data ? getProfileMissing(data) : [];
  const social = p.social_links || {};
  const location = [p.city, p.country].filter(Boolean).join(', ');
  const basePrice = price ? inr(price) : (data?.budget_range || p.budget_range || 'On request');
  const deliveryTxt = days ? `${days} day${days > 1 ? 's' : ''}` : 'Not set';

  const retry = () => { setLoading(true); setLoadError(''); load(); };

  // ----- photo / banner -----
  const upload = async (file, endpoint) => {
    const fd = new FormData();
    fd.append('file', file);
    return (await axios.post(`${API}${endpoint}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  };
  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy) return;
    setBusy('photo');
    try {
      const r = await upload(file, '/profile/upload-photo');
      if (r.photo_url) {
        setData((d) => ({ ...d, profile_photo: r.photo_url }));
        if (setUser && user) setUser({ ...user, profile_photo: r.photo_url });
      }
      toast.success('Profile photo updated');
    } catch (err) { toast.error(apiErrorMessage(err, 'Could not upload photo')); }
    finally { setBusy(''); }
  };
  const onPickBanner = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image too large. Maximum 5MB.'); return; }
    setBusy('banner');
    try {
      const r = await upload(file, '/profile/upload-banner');
      const url = r.banner || r.file_url || '';
      if (!url) { toast.error('Upload failed - no file URL returned.'); return; }
      setData((d) => ({ ...d, banner: url }));
      toast.success('Banner updated');
    } catch (err) { toast.error(apiErrorMessage(err, 'Could not upload banner')); }
    finally { setBusy(''); }
  };

  // ----- details sheets -----
  const openSheet = (key) => { setForm(seedForm(data)); setSheet(key); };
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const fld = (k) => ({ value: form[k] || '', onChange: (e) => set(k)(e.target.value) });
  const toggle = (k) => (v) => setForm((f) => { const s = new Set(f[k] || []); if (s.has(v)) s.delete(v); else s.add(v); return { ...f, [k]: [...s] }; });
  const nicheToggle = (label) => toggle('contentCategories')(NICHE_CATEGORIES.find((o) => o.label === label).value);
  const styleToggle = (label) => toggle('contentStyles')(CONTENT_CATEGORIES.find((o) => o.label === label).value);

  const saveDetails = async () => {
    if (saving) return;
    if (sheet === 'rates' && !(Number(form.deliveryDays) > 0)) { toast.error('Enter your typical delivery time (days)'); return; }
    if (sheet === 'rates' && form.expectedPayout !== '' && !(Number(form.expectedPayout) > 0)) { toast.error('Enter a payout above 0'); return; }
    setSaving(true);
    try {
      const payload = buildPayload(pr, form, pf);
      const r = await axios.put(`${API}/profile/creator`, payload);
      setData((d) => ({ ...d, profile: { ...payload } }));
      setSheet(null);
      toast.success(r.data?.message === 'Profile submitted for review' ? 'Profile submitted for review' : 'Profile updated');
    } catch (err) { toast.error(apiErrorMessage(err, 'Could not save profile')); }
    finally { setSaving(false); }
  };

  // ----- work videos -----
  const persistPortfolio = async (next) => {
    const prev = pf;
    setPf(next);
    try {
      const saved = await axios.patch(`${API}/profile/portfolio`, next);
      if (setUser && user) setUser({ ...user, portfolio: next, ...(saved.data?.approval_status ? { approval_status: saved.data.approval_status } : {}) });
      return true;
    } catch (err) {
      setPf(prev);
      toast.error(apiErrorMessage(err, 'Could not save your work'));
      return false;
    }
  };
  // The first 3 videos are the ones on the brand-facing card, so the order is the creator's choice.
  const moveWork = (i, toFirst) => {
    let next;
    if (toFirst) next = [pf[i], ...pf.filter((_, j) => j !== i)];
    else {
      let j = i - 1;
      while (j >= 0 && !pfUrl(pf[j])) j -= 1;
      if (j < 0) return;
      next = [...pf];
      [next[j], next[i]] = [next[i], next[j]];
    }
    persistPortfolio(next);
  };
  const resetAdd = () => { setAddForm({ title: '', url: '', category: '', price: '', delivery: '' }); setEditIdx(null); setProgress(null); };
  const openAdd = () => {
    if (works.length >= MAX_WORKS) { toast.error(`You can add a maximum of ${MAX_WORKS} work videos.`); return; }
    resetAdd();
    setAddOpen(true);
  };
  const editWork = (idx) => {
    const it = pf[idx];
    const meta = typeof it === 'string' ? {} : (it || {});
    setAddForm({ title: meta.title || '', url: pfUrl(it), category: meta.category || '', price: meta.price || '', delivery: meta.delivery || '' });
    setEditIdx(idx);
    setAddOpen(true);
  };
  const onPickWork = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy) return;
    // Portfolio work must be a video only (same rule as the website editor).
    if (!(file.type || '').startsWith('video/')) { toast.error('Please upload a video file only.'); return; }
    setBusy('work');
    setProgress(0);
    try {
      const up = await uploadMedia(file, API, { onProgress: setProgress });
      let url = up?.file_url || up?.url || '';
      if (url.startsWith('/')) url = `${BACKEND_URL}${url}`;
      if (!url) { toast.error('Video upload failed. Please try again.'); return; }
      setAddForm((f) => ({ ...f, url }));
      toast.success('Video uploaded - add details and save');
    } catch (err) { toast.error(apiErrorMessage(err, 'Could not upload video')); }
    finally { setBusy(''); setProgress(null); }
  };
  const saveWork = async () => {
    if (saving || busy) return;
    if (!addForm.url) { toast.error('Upload a video first'); return; }
    if (editIdx == null && works.length >= MAX_WORKS) { toast.error(`You can add a maximum of ${MAX_WORKS} work videos.`); setAddOpen(false); return; }
    const item = { title: addForm.title.trim() || 'Untitled', description: '', category: addForm.category || '', price: addForm.price || '', delivery: addForm.delivery || '', videoUrl: addForm.url, urls: [addForm.url] };
    const next = editIdx != null ? pf.map((x, i) => (i === editIdx ? { ...(typeof x === 'object' ? x : {}), ...item } : x)) : [...pf, item];
    setSaving(true);
    const ok = await persistPortfolio(next);
    setSaving(false);
    if (ok) { toast.success(editIdx != null ? 'Work updated' : 'Work added'); setAddOpen(false); resetAdd(); }
  };
  const removeWork = async () => {
    const idx = rm;
    if (idx == null || saving) return;
    setSaving(true);
    const ok = await persistPortfolio(pf.filter((_, i) => i !== idx));
    setSaving(false);
    if (ok) { toast.success('Portfolio item removed'); setRm(null); }
  };

  // Finish-profile nudge: open whatever the first missing item needs.
  const finish = () => {
    const todo = getProfileChecklist(data).find((i) => i.mandatory && !i.done);
    const map = { avatar: () => photoRef.current?.click(), identity: () => openSheet('basic'), location: () => openSheet('location'), languages: () => openSheet('skills'), intro: openAdd };
    (map[todo?.key] || (() => openSheet('basic')))();
  };

  const Row = (label, value) => {
    const text = Array.isArray(value) ? value.filter(Boolean).join(', ') : value;
    if (text === '' || text == null) return null;
    return <div className="ap-prof-kv" key={label}><span>{label}</span><b>{String(text)}</b></div>;
  };
  const cards = [
    ['basic', 'Basic information', [Row('Full name', p.fullName), Row('Age', p.age), Row('Gender', p.gender), Row('Body type', p.bodyType), Row('Skin tone', p.skinTone)]],
    ['location', 'Location & contact', [Row('Country', p.country), Row('State', p.state), Row('City', p.city), Row('Pincode', p.pincode), Row('Phone', [p.dialCode, p.phone].filter(Boolean).join(' ')), Row('Address', p.address)]],
    ['skills', 'Skills & languages', [Row('Skills', Array.isArray(p.skills) ? p.skills : data?.tags), Row('Languages', languages), ...Object.entries(social).filter(([, v]) => v).map(([k, v]) => (
      <div className="ap-prof-kv" key={k}><span>{k.charAt(0).toUpperCase() + k.slice(1)}</span><a href={href(v)} target="_blank" rel="noreferrer noopener">{v}</a></div>
    ))]],
    ['setup', 'Recording setup', [Row('Core setup', p.coreSetup), Row('Who appears', p.appearIn), Row('Can bring', p.bring), Row('Weekly availability', p.weekly || p.availability_calendar?.weekly), Row('Flexible hours', p.flexible ? 'Yes' : ''), Row('Topics avoided', p.topics)]],
  ];

  const sheetBody = {
    basic: (
      <div className="ap-prof-form">
        <label className="ap-label">Full name<input className="ap-input" {...fld('fullName')} autoComplete="name" /></label>
        <label className="ap-label">Age<input className="ap-input" type="number" inputMode="numeric" {...fld('age')} /></label>
        <Sel label="Gender" value={form.gender} onChange={set('gender')} options={GENDERS} />
        <Sel label="Body type" value={form.bodyType} onChange={set('bodyType')} options={BODY_TYPES} />
        <Sel label="Skin tone" value={form.skinTone} onChange={set('skinTone')} options={SKIN_TONES} />
      </div>
    ),
    content: (
      <div className="ap-prof-form">
        <Pick label="Content categories (pick all that apply)" values={NICHE_CATEGORIES.filter((o) => (form.contentCategories || []).includes(o.value)).map((o) => o.label)} options={NICHE_CATEGORIES.map((o) => o.label)} onToggle={nicheToggle} />
        <Pick label="Content styles (pick all that apply)" values={CONTENT_CATEGORIES.filter((o) => (form.contentStyles || []).includes(o.value)).map((o) => o.label)} options={CONTENT_CATEGORIES.map((o) => o.label)} onToggle={styleToggle} />
      </div>
    ),
    location: (
      <div className="ap-prof-form">
        <Sel label="Country" value={form.country} onChange={set('country')} options={COUNTRIES} />
        <Sel label="State" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v, city: '' }))} options={STATES} />
        <Sel label="City" value={form.city} onChange={set('city')} options={CITIES_BY_STATE[form.state] || []} placeholder={form.state ? 'Select city' : 'Select state first'} />
        <label className="ap-label">Pincode<input className="ap-input" inputMode="numeric" {...fld('pincode')} /></label>
        <label className="ap-label">Phone<input className="ap-input" type="tel" inputMode="tel" {...fld('phone')} /></label>
        <label className="ap-label">Address<textarea className="ap-input" rows={2} {...fld('address')} /></label>
      </div>
    ),
    skills: (
      <div className="ap-prof-form">
        <Pick label="Skills" values={form.skills} options={SKILLS_OPTS} onToggle={toggle('skills')} />
        <Pick label="Languages" values={form.languages} options={LANGUAGES_OPTS} onToggle={toggle('languages')} />
        <label className="ap-label">YouTube<input className="ap-input" autoCapitalize="none" {...fld('youtube')} /></label>
        <label className="ap-label">Instagram<input className="ap-input" autoCapitalize="none" {...fld('instagram')} /></label>
        <label className="ap-label">LinkedIn<input className="ap-input" autoCapitalize="none" {...fld('linkedin')} /></label>
      </div>
    ),
    setup: (
      <div className="ap-prof-form">
        <Pick label="Core setup" values={form.coreSetup} options={CORE_SETUP_OPTS} onToggle={toggle('coreSetup')} />
        <Pick label="Who appears" values={form.appearIn} options={APPEAR_IN_OPTS} onToggle={toggle('appearIn')} />
        <Pick label="Topics avoided" values={form.topics} options={TOPICS_OPTS} onToggle={toggle('topics')} />
        <Sel label="Weekly availability" value={form.weekly} onChange={set('weekly')} options={WEEKLY_OPTS} />
        <label className="ap-prof-check"><input type="checkbox" checked={!!form.flexible} onChange={(e) => set('flexible')(e.target.checked)} /> Flexible working hours</label>
      </div>
    ),
    rates: (
      <div className="ap-prof-form">
        <label className="ap-label">Raw video payout per video (₹)<input className="ap-input" type="number" inputMode="numeric" min="1" {...fld('expectedPayout')} /></label>
        <label className="ap-label">Additional editing payout per video (₹)<input className="ap-input" type="number" inputMode="numeric" min="0" {...fld('editingPayout')} /></label>
        <label className="ap-label">Typical delivery (days) *<input className="ap-input" inputMode="numeric" placeholder="e.g. 3" value={form.deliveryDays || ''} onChange={(e) => set('deliveryDays')(digits(e.target.value))} /></label>
        <p className="ap-prof-note">Payout period: Per video. Brands see this price on your card.</p>
      </div>
    ),
  };

  const firstClip = works[0] ? assetUrl(pfUrl(works[0])) : '';

  return (
    <AppShell title="My profile" subtitle="This is what brands see">
      {loading && (
        <div className="ap-prof-skel" aria-busy="true" aria-label="Loading profile">
          <div className="ap-skel" style={{ height: 250, borderRadius: 20 }} />
          <div className="ap-skel" style={{ height: 70, borderRadius: 20 }} />
          <div className="ap-skel" style={{ height: 220, borderRadius: 20 }} />
        </div>
      )}

      {!loading && loadError && (
        <div className="ap-card ap-empty" role="alert">
          {loadError.startsWith("You're offline") ? <WifiOff size={30} color="#6e6e96" /> : <AlertCircle size={30} color="#e5484d" />}
          <h3>{loadError.startsWith("You're offline") ? "You're offline" : 'Could not load your profile'}</h3>
          <p>{loadError}</p>
          <button type="button" className="ap-btn" onClick={retry}><RefreshCw size={16} /> Retry</button>
        </div>
      )}

      {!loading && !loadError && data && (
        <>
          <section className="ap-card ap-prof-head">
            <div className="ap-prof-banner" style={banner ? { backgroundImage: `url(${banner}), linear-gradient(120deg,#5b6bff,#23236a 55%,#4452f0)` } : undefined}>
              <button type="button" className="ap-prof-cam ap-prof-cam--banner" onClick={() => bannerRef.current?.click()} disabled={busy === 'banner'} aria-label="Change banner">
                <Camera size={15} /> {busy === 'banner' ? 'Uploading…' : 'Banner'}
              </button>
              <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onPickBanner} />
            </div>
            <div className="ap-prof-who">
              <span className="ap-prof-ava">
                <span className="ap-prof-ava-i"><PhotoOrInitial src={photo} initial={(name || 'C').charAt(0).toUpperCase()} /></span>
                <button type="button" className="ap-prof-cam ap-prof-cam--ava" onClick={() => photoRef.current?.click()} disabled={busy === 'photo'} aria-label="Change photo"><Camera size={15} /></button>
                <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
              </span>
              <div className="ap-prof-id">
                <h2>{name}{data.kyc_verified && <span className="ap-pill ap-pill--ok"><BadgeCheck size={13} /> Verified</span>}</h2>
                <small>ID: {data.public_creator_id || String(id || '').slice(0, 12)}{location ? ` · ${location}` : ''}</small>
              </div>
            </div>
            {levelBadge && <button type="button" className="ap-prof-level" onClick={() => navigate('/reviews')}><Star size={14} fill="currentColor" /> {levelBadge}<ChevronRight size={16} /></button>}
            {p.bio ? <p className="ap-prof-bio">{p.bio}</p> : null}
            <div className="ap-prof-stats">
              <div><b>{Number(data.deliverables_completed ?? p.deliverables_completed ?? 0)}</b><small>deliverables</small></div>
              <div><b>{avg ? avg.toFixed(1) : '-'}</b><small>{reviews.length} review{reviews.length === 1 ? '' : 's'}</small></div>
              <div><b>{languages.length}</b><small>languages</small></div>
            </div>
            <div className="ap-prof-hl">
              <div><small>{niches.length > 1 ? 'Categories' : 'Category'}</small><b>{niches.length ? niches.join(', ') : 'Not set'}</b></div>
              <div><small>Price / video</small><b>{basePrice}</b></div>
              <div><small>Delivery</small><b>{deliveryTxt}</b></div>
            </div>
          </section>

          {pct < 100 && (
            <button type="button" className="ap-card ap-prof-strength" onClick={finish}>
              <span className="ap-prof-strength-t"><b>Profile {pct}% complete</b><span>Finish it</span></span>
              <span className="ap-prof-track"><i style={{ width: `${pct}%` }} /></span>
              <small>Still needed: {missing.join(' · ')}</small>
            </button>
          )}

          <section className="ap-card" ref={videosRef}>
            <div className="ap-prof-h">
              <h2>My videos</h2>
              <button type="button" className="ap-btn ap-btn--sm" onClick={openAdd} disabled={works.length >= MAX_WORKS}><Plus size={15} /> Add work</button>
            </div>
            {pf.length === 0 || works.length === 0 ? (
              <div className="ap-empty">
                <Film size={28} color="#7387ff" />
                <h3>No work yet</h3>
                <p>Add your best videos so brands can see what you make. The first 3 show on your card.</p>
                <button type="button" className="ap-btn" onClick={openAdd}><Upload size={16} /> Upload a video</button>
              </div>
            ) : (
              <>
                <div className="ap-prof-grid">
                  {pf.map((it, i) => {
                    const u = pfUrl(it);
                    if (!u) return null;
                    const meta = typeof it === 'string' ? {} : it;
                    const rank = works.indexOf(it);
                    return (
                      <div className="ap-prof-work" key={`${u}-${i}`}>
                        <div className="ap-prof-vwrap">
                          <VideoThumb url={u} onClick={() => setPlay(u)} />
                          {rank >= 0 && rank < 3 && <span className="ap-prof-tag">#{rank + 1} on card</span>}
                          <button type="button" className="ap-prof-vbtn ap-prof-vbtn--e" onClick={() => editWork(i)} aria-label="Edit video"><Pencil size={14} /></button>
                          <button type="button" className="ap-prof-vbtn ap-prof-vbtn--d" onClick={() => setRm(i)} aria-label="Remove video"><Trash2 size={14} /></button>
                        </div>
                        <b>{meta.title && meta.title !== 'Untitled' ? meta.title : (meta.category || 'Video')}</b>
                        <small>{vidPrice(meta.price, basePrice)} · {vidDelivery(meta.delivery, deliveryTxt)}</small>
                        {rank > 0 && (
                          <div className="ap-prof-order">
                            <button type="button" onClick={() => moveWork(i, true)}>Make first</button>
                            {rank > 1 && <button type="button" onClick={() => moveWork(i, false)}>Move earlier</button>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="ap-prof-note">The first 3 show on your card when brands search. Tap “Make first” to choose which one brands see first.</p>
              </>
            )}
          </section>

          <section className="ap-card">
            <div className="ap-prof-h"><h2>Rates</h2><button type="button" className="ap-link" onClick={() => openSheet('rates')}>Edit</button></div>
            <div className="ap-prof-rates">
              <div><small>Raw video</small><b>{price ? inr(price) : 'Not set'}</b><em>Brand edits it</em></div>
              <div><small>Edited by me</small><b>{editPay ? `+${inr(editPay)}` : '-'}</b><em>Extra if you edit</em></div>
              <div><small>Delivery</small><b>{deliveryTxt}</b><em>Typical</em></div>
            </div>
          </section>

          <section className="ap-card">
            <div className="ap-prof-h"><h2>Niches &amp; content style</h2><button type="button" className="ap-link" onClick={() => openSheet('content')}>Edit</button></div>
            {niches.length || styles.length ? (
              <div className="ap-prof-wrap ap-prof-tags">
                {niches.map((n) => <span key={n} className="ap-pill">{n}</span>)}
                {styles.map((n) => <span key={n} className="ap-pill ap-pill--muted">{n}</span>)}
              </div>
            ) : <p className="ap-prof-muted">Pick the niches and styles you make so briefs match you.</p>}
          </section>

          {cards.map(([key, title, rows]) => {
            const shown = rows.filter(Boolean);
            return (
              <section className="ap-card" key={key}>
                <div className="ap-prof-h"><h2>{title}</h2><button type="button" className="ap-link" onClick={() => openSheet(key)}>{shown.length ? 'Edit' : 'Add'}</button></div>
                {shown.length ? <div>{shown}</div> : <p className="ap-prof-muted">Nothing added yet.</p>}
              </section>
            );
          })}

          <section className="ap-card">
            <div className="ap-prof-h"><h2>How brands see you</h2></div>
            <div className="ap-prof-pv">
              <div className="ap-prof-pv-img">
                {firstClip ? (isVideo(firstClip) ? <video src={`${mediaUrl(firstClip)}#t=0.5`} muted playsInline preload="metadata" /> : <img src={mediaUrl(firstClip)} alt="" />) : <span><Film size={26} /></span>}
                {user?.ugcad_approved && <em>UGCAD.IO Choice</em>}
                <div className="ap-prof-pv-who">
                  <i><PhotoOrInitial src={photo} initial={(name || 'C').charAt(0).toUpperCase()} /></i>
                  <div>
                    <b>{name || 'You'}{data.kyc_verified ? ' ✓' : ''}</b>
                    <small>{avg ? <><Star size={11} fill="#F5A524" color="#F5A524" /> {avg.toFixed(1)} ({reviews.length})</> : 'No reviews yet'}{days ? ` · ${days}-day delivery` : ''}</small>
                  </div>
                </div>
              </div>
              <div className="ap-prof-pv-foot">
                <span>{price ? <>From <strong>{inr(price)}</strong> / video</> : 'Add your rate'}</span>
                <span className="ap-prof-pv-btn">Invite</span>
              </div>
            </div>
          </section>

          <section className="ap-card ap-prof-links">
            <button type="button" onClick={() => navigate('/reviews')}><Star size={19} /><span><b>Reviews &amp; level</b><small>{avg ? `${avg.toFixed(1)} ★ · ${reviews.length} review${reviews.length === 1 ? '' : 's'}` : 'No reviews yet'}</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => navigate('/withdrawal')}><Wallet size={19} /><span><b>Earnings &amp; withdraw</b><small>Balance, payouts and history</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => navigate('/settings')}><SettingsIcon size={19} /><span><b>Settings</b><small>Account, payout, notifications</small></span><ChevronRight size={18} /></button>
          </section>
        </>
      )}

      {/* Edit sections */}
      <BottomSheet
        open={Boolean(sheet)}
        onClose={() => !saving && setSheet(null)}
        title={SHEETS[sheet] || ''}
        tall={sheet === 'content' || sheet === 'skills' || sheet === 'setup' || sheet === 'location'}
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setSheet(null)} disabled={saving}>Cancel</button>
            <button type="button" className="ap-btn ap-prof-save" onClick={saveDetails} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        )}
      >
        {sheet ? sheetBody[sheet] : null}
      </BottomSheet>

      {/* Add / edit a work video */}
      <BottomSheet
        open={addOpen}
        onClose={() => !saving && !busy && setAddOpen(false)}
        title={editIdx != null ? 'Edit work' : 'Add work'}
        subtitle="Vertical video, up to 400 MB"
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setAddOpen(false)} disabled={saving || Boolean(busy)}>Cancel</button>
            <button type="button" className="ap-btn ap-prof-save" onClick={saveWork} disabled={saving || Boolean(busy) || !addForm.url}>{saving ? 'Saving…' : editIdx != null ? 'Update work' : 'Save work'}</button>
          </>
        )}
      >
        <div className="ap-prof-form">
          {addForm.url ? (
            <div className="ap-prof-addprev"><VideoThumb url={addForm.url} onClick={() => setPlay(addForm.url)} /></div>
          ) : null}
          <button type="button" className="ap-btn ap-btn--ghost" onClick={() => workRef.current?.click()} disabled={Boolean(busy)}>
            <Upload size={16} /> {busy === 'work' ? (progress != null && progress >= 100 ? 'Processing…' : `Uploading ${progress ?? 0}%`) : addForm.url ? 'Change video' : 'Upload video'}
          </button>
          {busy === 'work' && progress != null && <div className="ap-prof-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div>}
          <input ref={workRef} type="file" accept="video/*" hidden onChange={onPickWork} />
          <label className="ap-label">Title (optional)<input className="ap-input" maxLength={120} value={addForm.title} onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Skincare routine reel" /></label>
          <label className="ap-label">Category
            <select className="ap-input" value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}>
              <option value="">Category</option>
              {NICHE_CATEGORIES.map((c) => <option key={c.value} value={c.label}>{c.label}</option>)}
            </select>
          </label>
          <label className="ap-label">Price / video (₹)<input className="ap-input" inputMode="numeric" value={addForm.price} onChange={(e) => setAddForm((f) => ({ ...f, price: e.target.value }))} /></label>
          <label className="ap-label">Delivered in<input className="ap-input" value={addForm.delivery} onChange={(e) => setAddForm((f) => ({ ...f, delivery: e.target.value }))} placeholder="e.g. 2 days" /></label>
        </div>
      </BottomSheet>

      <BottomSheet open={rm != null} onClose={() => !saving && setRm(null)} title="Remove this video?" subtitle="It will no longer show on your profile."
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setRm(null)} disabled={saving}>Keep it</button>
            <button type="button" className="ap-btn ap-btn--danger ap-prof-save" onClick={removeWork} disabled={saving}>{saving ? 'Removing…' : 'Remove'}</button>
          </>
        )}
      />

      <BottomSheet open={Boolean(play)} onClose={() => setPlay('')} title="Preview" tall>
        {play && (isVideo(play) ? <video className="ap-prof-player" src={mediaUrl(play)} controls autoPlay playsInline /> : <img className="ap-prof-player" src={mediaUrl(play)} alt="" />)}
      </BottomSheet>
    </AppShell>
  );
}
