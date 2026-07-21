import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../App';
import { creatorName, brandName, creatorFirstName } from '../utils/displayName';
import { X, Play, MessageSquare, ChevronLeft, Bookmark, User, MapPin, Sparkles, Clapperboard, Wallet, Pencil, Plus, Trash2, Camera, Check, Star, BadgeCheck } from 'lucide-react';
import { CONTENT_CATEGORIES } from '../constants/contentCategories';
import { apiErrorMessage } from '../utils/apiError';
import { toggleSavedCreator, isCreatorSaved } from '../utils/savedCreators';
import { Skeleton } from './Skeleton';

// Option lists mirrored from the signup form (CreatorProfileSetup) so editing
// uses the exact same choices instead of free text.
const GENDERS = ['Male', 'Female', 'Other'];
const BODY_TYPES = ['Average', 'Slim', 'Athletic', 'Plus Size', 'No Preference'];
const SKIN_TONES = ['Fair', 'Brown', 'Dark', 'No preference'];
const SKILLS_OPTS = ['Script Writing', 'Voiceovers', 'Acting', 'Videography (DOP)', 'Video Editing', 'Modelling'];
const LANGUAGES_OPTS = ['English', 'Hindi', 'Bengali', 'Marathi', 'Tamil', 'Telugu', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi', 'Bhojpuri'];
const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany'];
const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
const CITIES_BY_STATE = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati', 'Kakinada'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia', 'Arrah', 'Begusarai'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Raigarh'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Junagadh'],
  'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Hisar', 'Rohtak', 'Sonipat'],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Kullu', 'Manali'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh', 'Deoghar'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi-Dharwad', 'Mangaluru', 'Belagavi', 'Davanagere', 'Ballari', 'Tumakuru'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Rewa'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Thane', 'Navi Mumbai', 'Kolhapur'],
  'Manipur': ['Imphal', 'Thoubal', 'Bishnupur'],
  'Meghalaya': ['Shillong', 'Tura', 'Jowai'],
  'Mizoram': ['Aizawl', 'Lunglei', 'Champhai'],
  'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Bhilwara', 'Alwar'],
  'Sikkim': ['Gangtok', 'Namchi', 'Gyalshing'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore'],
  'Telangana': ['Hyderabad', 'Secunderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
  'Tripura': ['Agartala', 'Udaipur', 'Dharmanagar'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Noida', 'Bareilly'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rishikesh', 'Nainital'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Darjeeling', 'Kharagpur'],
  'Andaman and Nicobar Islands': ['Port Blair'],
  'Chandigarh': ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Silvassa', 'Daman', 'Diu'],
  'Delhi': ['New Delhi', 'Delhi', 'Dwarka', 'Rohini', 'Saket'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'],
  'Ladakh': ['Leh', 'Kargil'],
  'Lakshadweep': ['Kavaratti'],
  'Puducherry': ['Puducherry', 'Karaikal', 'Yanam', 'Mahe'],
};
const CORE_SETUP_OPTS = ['DSLR Camera', 'Iphone', 'Android Phone', 'Tripod / Stable mount', 'External microphone', 'Quiet / noise-controlled room', 'Artificial lighting', 'Green screen', 'Aesthetic background'];
const APPEAR_IN_OPTS = ['Solo only', 'Friends / peers', 'Family members', 'Pets / animals'];
const WEEKLY_OPTS = ['1–5 hrs / week', '6–10 hrs / week', '11–20 hrs / week', '20+ hrs / week'];
const TOPICS_OPTS = ['None', 'Alcohol', 'Gambling', 'Adult products'];
const PAYOUT_PERIODS = ['Per Video'];

function Sel({ label, value, onChange, options, placeholder }) {
  return (
    <label>{label}
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder || 'Select'}</option>
        {options.map((o) => (typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </label>
  );
}

function ChipsPick({ label, values, options, onToggle }) {
  const set = new Set(values || []);
  return (
    <div className="cpm-pickwrap">
      <span className="cpm-pick-label">{label}</span>
      <div className="cpm-pick">
        {options.map((o) => (
          <button type="button" key={o} className={set.has(o) ? 'on' : ''} onClick={() => onToggle(o)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function Stars({ n = 0, size = 14 }) {
  return (
    <span className="cpm-stars">
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} fill={i <= Math.round(n) ? '#f5b301' : 'none'} color={i <= Math.round(n) ? '#f5b301' : '#cfd2e6'} />)}
    </span>
  );
}

const relTime = (ts) => {
  if (!ts) return '';
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d < 1) return 'today';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
// The backend gates deliverable videos under /uploads and accepts the JWT either
// as an Authorization header OR a ?token= query param. A native <video>/<img> tag
// can't send headers, so sign backend URLs with the token — otherwise a brand
// viewing a creator's portfolio gets a 403 and the clip won't play.
const mediaUrl = (u) => {
  const base = assetUrl(u);
  if (!base || !base.startsWith(BACKEND_URL)) return base; // external / empty — leave alone
  const token = localStorage.getItem('token');
  if (!token) return base;
  return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
};
const isVideo = (u) => /\.(mp4|webm|mov|m4v)$/i.test(String(u || '').split('?')[0]);
const pfUrl = (it) => (typeof it === 'string' ? it : (it?.videoUrl || it?.link || it?.url || (Array.isArray(it?.urls) && it.urls[0]) || it?.original_url || ''));
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
// A portfolio item's own price, shown to the creator AND the brand — the whole
// point of asking the creator for a per-video rate is that buyers can see it.
// `fallback` is only used when that item has no price of its own.
// "Delivered in" is a free-text box, so a creator who types just "3" would
// otherwise render as a bare "3" on the card. Number-only values get a unit.
const vidDelivery = (delivery, fallback) => {
  const raw = String(delivery ?? '').trim();
  if (!raw) return fallback;
  return /^\d+$/.test(raw) ? `${raw} day${Number(raw) > 1 ? 's' : ''}` : raw;
};
const vidPrice = (price, fallback) => {
  const raw = String(price ?? '').trim();
  if (!raw) return fallback;
  const digits = raw.replace(/[₹,\s]/g, '');
  return /^\d+$/.test(digits) ? inr(digits) : raw;
};
function VideoTile({ url, onRemove, onEdit }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);   // big lightbox with real playback + sound
  const [failed, setFailed] = useState(false); // broken / removed media URL
  const src = mediaUrl(url);   // signed with ?token= so gated deliverable videos play
  const video = isVideo(url);  // classify on the raw url (the token contains dots)
  // Hover to preview — DESKTOP ONLY. On touch a tap fires mouseenter, which made the
  // clip auto-play while scrolling/tapping; there it plays only via the big lightbox.
  const canHover = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(hover: hover)').matches;
  const hoverPlay = () => { if (!canHover) return; const v = ref.current; if (v && video) { v.muted = true; v.play().then(() => setPlaying(true)).catch(() => {}); } };
  const hoverStop = () => { if (!canHover) return; const v = ref.current; if (v) { v.pause(); try { v.currentTime = 0.5; } catch {} setPlaying(false); } };
  return (
    <>
      <div className="cpm-vid" onClick={() => !failed && setOpen(true)} onMouseEnter={hoverPlay} onMouseLeave={hoverStop}>
        {failed ? (
          <span className="cpm-vid-broken"><Camera size={20} /> Media unavailable</span>
        ) : video ? (
          <video ref={ref} src={`${src}#t=0.5`} muted playsInline loop onError={() => setFailed(true)} />
        ) : (
          <img src={src} alt="" onError={() => setFailed(true)} />
        )}
        {!playing && !failed && <span className="cpm-play"><Play size={18} fill="currentColor" /></span>}
        {onEdit && <button type="button" className="cpm-vid-edit" onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label="Edit"><Pencil size={14} /></button>}
        {onRemove && <button type="button" className="cpm-vid-remove" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Remove"><Trash2 size={15} /></button>}
      </div>
      {open && (
        <div className="cpm-clip-ov" onClick={() => setOpen(false)}>
          <div className="cpm-clip-box" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="cpm-clip-x" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
            <div className="cpm-clip-frame">
              {video
                ? <video src={src} controls autoPlay playsInline className="cpm-clip-vid" />
                : <img src={src} alt="" className="cpm-clip-vid" />}
              <div className="cpm-clip-wm" aria-hidden="true">
                <img src="/watermark.jpeg" alt="" />
                <span>UGC.io</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Small playable clip shown inside a review's fact row (watermarked, like the
// brand work-review preview). Click toggles play; only one clip plays at a time.
function RevClip({ src: rawSrc }) {
  const [open, setOpen] = useState(false);
  const src = mediaUrl(rawSrc); // delivered clips are gated — sign them too
  return (
    <>
      <button type="button" className="cpm-rev-clip" onClick={(e) => { e.stopPropagation(); setOpen(true); }} aria-label="Play delivered clip">
        <video src={`${src}#t=0.5`} muted playsInline preload="metadata" />
        <span className="cpm-rev-wm" aria-hidden="true" />
        <span className="cpm-rev-clip-play"><Play size={16} fill="currentColor" /></span>
      </button>
      {open && (
        <div className="cpm-clip-ov" onClick={() => setOpen(false)}>
          <div className="cpm-clip-box" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="cpm-clip-x" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
            <div className="cpm-clip-frame">
              <video src={src} controls autoPlay playsInline className="cpm-clip-vid" />
              <div className="cpm-clip-wm" aria-hidden="true">
                <img src="/watermark.jpeg" alt="" />
                <span>UGC.io</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Rich creator profile — banner + avatar + stats + Videos/Details tabs.
 * Fetches /profile/:id. `asPage` renders it inline (no overlay) for the route page.
 */
export default function CreatorProfileModal({ id, fallbackName, photo, onClose, onMessage, onBegin, onEdit, asPage = false, editable = false }) {
  const { user: viewer } = useAuth();
  // Contact + payment details belong to the creator alone. A brand viewing this
  // profile must never see their real name, phone, address or pincode — that's
  // both a privacy leak and a way to take the deal off-platform. The backend
  // redacts these too (User.toRedacted); this keeps the UI honest regardless.
  // `editable` is only ever passed on the creator's own profile routes, so it's
  // an independent owner signal — trust it even if the id comparison can't run.
  const canSeePrivate = editable
    || (!!viewer && (String(viewer.id) === String(id) || viewer.role === 'admin'));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('videos');
  const [saved, setSaved] = useState(() => isCreatorSaved(id));

  // ── Own-profile editing (only when `editable`) ──────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});            // editable detail fields
  const [pf, setPf] = useState([]);                // editable portfolio list
  const [addOpen, setAddOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);    // index being edited, or null when adding new
  const [addForm, setAddForm] = useState({ title: '', brand: '', desc: '', url: '', category: '', price: '', delivery: '' });
  const [busy, setBusy] = useState('');            // 'photo' | 'banner' | 'work'
  const [localPhoto, setLocalPhoto] = useState('');
  const [localBanner, setLocalBanner] = useState('');
  const photoRef = useRef(null);
  const bannerRef = useRef(null);
  const workRef = useRef(null);

  // Scroll-spy: tabs double as anchors — clicking scrolls to the section, and
  // scrolling between stacked sections updates the active tab.
  const videosRef = useRef(null);
  const detailsRef = useRef(null);
  const reviewsRef = useRef(null);
  const scrollLock = useRef(false);
  const goTab = (t) => {
    const map = { videos: videosRef, details: detailsRef, reviews: reviewsRef };
    setTab(t);
    const el = map[t]?.current;
    if (el) {
      scrollLock.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => { scrollLock.current = false; }, 650);
    }
  };

  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    let a = true;
    axios.get(`${API}/profile/${id}`).then((r) => { if (a) setData(r.data); }).catch(() => {}).finally(() => { if (a) setLoading(false); });
    axios.get(`${API}/reviews/creator/${id}`).then((r) => { if (a) setReviews(Array.isArray(r.data) ? r.data : []); }).catch(() => {});
    return () => { a = false; };
  }, [id]);

  // While the profile is open, mark the body so the app's floating message FAB can
  // be hidden on mobile (it would otherwise overlap the bottom Send Message bar).
  useEffect(() => {
    document.body.classList.add('cpm-open');
    return () => document.body.classList.remove('cpm-open');
  }, []);

  const [reviewers, setReviewers] = useState({});
  const reviewCount = reviews.length;
  const avgRating = reviewCount ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount) : 0;

  // Resolve reviewer (brand) names + avatars for the review cards.
  useEffect(() => {
    const ids = [...new Set(reviews.map((r) => r.reviewer_id).filter(Boolean))];
    if (!ids.length) return undefined;
    let a = true;
    Promise.all(ids.map((rid) => axios.get(`${API}/profile/${rid}`).then((r) => [rid, r.data]).catch(() => [rid, null])))
      .then((pairs) => {
        if (!a) return;
        const m = {};
        pairs.forEach(([rid, d]) => {
          if (!d) return;
          m[rid] = {
            name: (d.profile && d.profile.business_name) || d.business_name || brandName(d),
            photo: assetUrl(d.profile_photo || d.logo || (d.profile && d.profile.logo)),
          };
        });
        setReviewers(m);
      });
    return () => { a = false; };
  }, [reviews]);

  // Resolve the campaign behind each review for the Fiverr-style detail row
  // (price · delivery time · category · delivered video).
  const [revCampaigns, setRevCampaigns] = useState({});
  useEffect(() => {
    const ids = [...new Set(reviews.map((r) => r.campaign_id).filter(Boolean))];
    if (!ids.length) return undefined;
    let a = true;
    Promise.all(ids.map((cid) => axios.get(`${API}/campaigns/${cid}`).then((r) => [cid, r.data]).catch(() => [cid, null])))
      .then((pairs) => {
        if (!a) return;
        const m = {};
        pairs.forEach(([cid, d]) => { if (d) m[cid] = d; });
        setRevCampaigns(m);
      });
    return () => { a = false; };
  }, [reviews]);

  // Seed the editable copies once data arrives.
  useEffect(() => {
    if (!data) return;
    const pr = data.profile || {};
    const sl = pr.social_links || {};
    setForm({
      fullName: pr.fullName || '', age: pr.age || '', gender: pr.gender || '',
      bodyType: pr.bodyType || '', skinTone: pr.skinTone || '',
      bio: pr.bio || '', category: pr.customCategory || pr.category || '',
      country: pr.country || '', state: pr.state || '', city: pr.city || '',
      pincode: pr.pincode || '', phone: pr.phone || '', address: pr.address || '',
      languages: Array.isArray(pr.languages) ? pr.languages : [],
      skills: Array.isArray(pr.skills) ? pr.skills : (Array.isArray(data.tags) ? data.tags : []),
      youtube: sl.youtube || '', instagram: sl.instagram || '', linkedin: sl.linkedin || '', tiktok: sl.tiktok || '',
      coreSetup: Array.isArray(pr.coreSetup) ? pr.coreSetup : [], appearIn: Array.isArray(pr.appearIn) ? pr.appearIn : [], bring: pr.bring || '',
      weekly: pr.weekly || (pr.availability_calendar && pr.availability_calendar.weekly) || '',
      flexible: !!pr.flexible, topics: Array.isArray(pr.topics) ? pr.topics : [],
      expectedPayout: (pr.rate_card && pr.rate_card.expected_payout) || pr.expectedPayout || '',
      payoutPeriod: (pr.rate_card && pr.rate_card.payout_period) || pr.payoutPeriod || '',
      budgetRange: data.budget_range || pr.budget_range || '',
      deliveryDays: String(pr.delivery_days || (pr.rate_card && pr.rate_card.delivery_days) || ''),
    });
    setPf(Array.isArray(data.portfolio) ? data.portfolio : []);
  }, [data]);

  const uploadFile = async (file, endpoint) => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await axios.post(`${API}${endpoint}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data;
  };

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy('photo');
    try {
      const r = await uploadFile(file, '/profile/upload-photo');
      setLocalPhoto(r.photo_url || '');
      toast.success('Profile photo updated');
    } catch { toast.error('Could not upload photo'); }
    finally { setBusy(''); if (photoRef.current) photoRef.current.value = ''; }
  };

  const onPickBanner = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image too large. Maximum 5MB.'); return; }
    setBusy('banner');
    try {
      // Dedicated endpoint that validates + persists in one step (mirrors the
      // profile-photo upload), so the banner can't silently fail mid-flow.
      const r = await uploadFile(file, '/profile/upload-banner');
      const url = r.banner || r.file_url || '';
      if (!url) { toast.error('Upload failed — no file URL returned.'); return; }
      setLocalBanner(url);
      setData((d) => (d ? { ...d, banner: url } : d));
      toast.success('Banner updated');
    } catch (err) {
      // Surface the real reason (status + server message) so failures aren't silent.
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message;
      toast.error(`Banner failed${status ? ` (${status})` : ''}: ${detail || 'unknown error'}`);
    } finally {
      setBusy(''); if (bannerRef.current) bannerRef.current.value = '';
    }
  };

  const persistPortfolio = async (next) => {
    setPf(next);
    try { await axios.patch(`${API}/profile/portfolio`, next); }
    catch { toast.error('Could not save your work'); }
  };

  const onPickWork = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    // Portfolio work must be a video only — reject images/other files.
    if (!(file.type || '').startsWith('video/')) {
      toast.error('Please upload a video file only.');
      if (workRef.current) workRef.current.value = '';
      return;
    }
    setBusy('work');
    try {
      const up = await uploadFile(file, '/upload/file');
      setAddForm((f) => ({ ...f, url: up.file_url || '' }));
      toast.success('Video uploaded — add details and save');
    } catch { toast.error('Could not upload video'); }
    finally { setBusy(''); if (workRef.current) workRef.current.value = ''; }
  };

  const resetAddForm = () => { setAddForm({ title: '', brand: '', desc: '', url: '', category: '', price: '', delivery: '' }); setEditIdx(null); };

  const saveWork = async () => {
    if (!addForm.url) { toast.error('Upload a video first'); return; }
    const item = { title: addForm.title || 'Untitled', brand: addForm.brand || '', description: addForm.desc || '', category: addForm.category || '', price: addForm.price || '', delivery: addForm.delivery || '', videoUrl: addForm.url, urls: [addForm.url] };
    const next = editIdx != null
      ? (pf || []).map((x, i) => (i === editIdx ? item : x))
      : [...(pf || []), item];
    await persistPortfolio(next);
    resetAddForm();
    setAddOpen(false);
    toast.success(editIdx != null ? 'Work updated' : 'Work added');
  };

  // Open the Add-Work form pre-filled with an existing item so it can be edited.
  const editWork = (idx) => {
    const it = (pf || [])[idx];
    const meta = typeof it === 'string' ? {} : (it || {});
    const url = meta.videoUrl || (Array.isArray(meta.urls) ? meta.urls[0] : '') || (typeof it === 'string' ? it : '');
    setAddForm({
      title: meta.title || '', brand: meta.brand || '', desc: meta.description || meta.desc || '',
      url, category: meta.category || '', price: meta.price || '', delivery: meta.delivery || '',
    });
    setEditIdx(idx);
    setAddOpen(true);
  };

  const removeWork = (idx) => { persistPortfolio((pf || []).filter((_, i) => i !== idx)); };

  const saveDetails = async () => {
    // Delivery time is required — a profile with no turnaround leaves brands
    // guessing, and the header used to invent "1 Day" to fill the gap.
    if (!(Number(form.deliveryDays) > 0)) {
      toast.error('Enter your typical delivery time (days) under Pricing & Delivery');
      return;
    }
    setSaving(true);
    try {
      const pr = data.profile || {};
      const skills = Array.isArray(form.skills) ? form.skills : [];
      const social_links = { ...(pr.social_links || {}) };
      ['youtube', 'instagram', 'linkedin', 'tiktok'].forEach((k) => { if (form[k]) social_links[k] = form[k]; else delete social_links[k]; });
      const payload = {
        ...pr,
        fullName: form.fullName, age: form.age, gender: form.gender,
        bodyType: form.bodyType, skinTone: form.skinTone,
        bio: form.bio, category: form.category,
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
          payout_period: form.payoutPeriod,
          delivery_days: form.deliveryDays ? Number(form.deliveryDays) : '',
        },
        budget_range: form.budgetRange,
        // Keep the full item objects — flattening these to bare URL strings (as
        // this did) wiped every clip's price / category / delivery on save.
        portfolio: (pf || []).filter((it) => pfUrl(it)),
        portfolio_items: pf || [],
      };
      const r = await axios.put(`${API}/profile/creator`, payload);
      setData((d) => ({ ...d, profile: { ...payload } }));
      setEditing(false);
      toast.success('Profile saved' + (r.data ? ' — submitted for review' : ''));
    } catch { toast.error('Could not save profile'); }
    finally { setSaving(false); }
  };

  // Prefer the nested profile, but fall back to any same-named field stored at the
  // user root so details still render for records that aren't fully nested.
  const p = { ...(data || {}), ...(data?.profile || {}) };
  // Show the creator's first name (no surname, no @username handle).
  const name = creatorFirstName(data) !== 'Creator'
    ? creatorFirstName(data)
    : ((fallbackName || '').trim().replace(/^@/, '').split(/\s+/)[0] || 'Creator');
  const publicId = data?.public_creator_id || String(id || '').slice(0, 12);
  const age = p.age;
  const gender = p.gender ? String(p.gender).charAt(0).toUpperCase() : '';
  const ageGender = [age, gender].filter(Boolean).join('');
  const city = p.city || p.location || '';
  const country = p.country || 'India';
  const languages = Array.isArray(p.languages) ? p.languages : (p.languages ? [p.languages] : []);
  const priceNum = String(p.rate_card?.expected_payout || p.expectedPayout || '').replace(/[^0-9]/g, '');
  const avatar = assetUrl(localPhoto || data?.profile_photo || data?.profile_picture || p.profile_photo || p.profile_picture || photo);
  const banner = assetUrl(localBanner || data?.banner || p.banner || '');
  const deliverables = Number(data?.deliverables_completed ?? p.deliverables_completed ?? 0);
  // Keep each portfolio item's own metadata (category / price / delivery) so the
  // video cards can show per-video values, falling back to the profile defaults.
  // Resolve the URL with pfUrl() — the SAME key priority the creator's own
  // (editable) view uses. Picking a different key order here meant a clip that
  // played fine for the creator could resolve to a dead `urls[0]`/`original_url`
  // on the brand view and render "Media unavailable".
  const realVids = (data?.portfolio || [])
    .map((it) => {
      const url = pfUrl(it);
      const meta = typeof it === 'string' ? {} : it;
      return { url, category: meta.category || '', price: meta.price || '', delivery: meta.delivery || '', brand: meta.brand || '' };
    })
    .filter((v) => v.url && !String(v.url).startsWith('blob:'));
  // Only the creator's own uploaded videos — no stock/sample fallback.
  const vids = realVids;

  // All the signup-form details (stored under user.profile via extra="allow").
  const phone = [p.dialCode, p.phone].filter(Boolean).join(' ');
  const categoryTxt = p.customCategory || p.category || '';
  const skills = Array.isArray(p.skills) ? p.skills : (Array.isArray(data?.tags) ? data.tags : []);
  const social = p.social_links || {};
  const rc = p.rate_card || {};
  // Quick-look highlights shown on the profile (price / category / delivery).
  // Category shows the creator's actual niche (not the generic "UGC"); fall back
  // to their first skill, then a neutral label — never the literal "UGC".
  const nicheTxt = p.niche || categoryTxt || p.primary_category
    || (Array.isArray(p.niches) ? p.niches[0] : '')
    || (Array.isArray(p.categories) ? p.categories[0] : '')
    || (skills[0] || '');
  const hlCategory = (nicheTxt || 'General').replace(/_/g, ' ');
  // The creator's configured rate, shown to the brand as well as the creator —
  // a brand shouldn't have to message someone just to learn their price.
  // Fallback used by the video cards when an item carries no price of its own.
  const basePrice = priceNum ? inr(priceNum) : (data?.budget_range || p.budget_range || 'On Request');
  // PRICE / VIDEO must be the creator's OWN configured rate (rate_card.expected_payout)
  // — the same number the brief/checkout charges. It must NOT be inferred from a
  // portfolio video's price: that quoted "From ₹11,000" while the brief priced the
  // deal at ₹0, because the brief reads the rate card. If no rate is set we say
  // "On Request" rather than invent one.
  const hlPrice = basePrice;
  // Delivery: the creator's own "Typical delivery (days)" field. If they never
  // set one, fall back to the slowest of their per-video delivery times rather
  // than the old hardcoded 1 — that default made EVERY profile claim "1 Day".
  const vidDayNums = realVids
    .map((v) => Number(String(v.delivery ?? '').replace(/[^0-9]/g, '')))
    .filter((n) => n > 0);
  const setDays = Number(p.delivery_days || p.avg_delivery_days || rc.delivery_days || 0) || 0;
  const hlDays = setDays || (vidDayNums.length ? Math.max(...vidDayNums) : 1);
  const hlDelivery = `${hlDays} day${hlDays > 1 ? 's' : ''}`;
  const Row = (label, value) => {
    const text = Array.isArray(value) ? value.filter(Boolean).join(', ') : value;
    if (text === '' || text === null || text === undefined) return null;
    return <div className="cpm-f" key={label}><label>{label}</label><span>{String(text)}</span></div>;
  };
  const Chips = (label, arr) => {
    const items = (Array.isArray(arr) ? arr : []).filter(Boolean);
    if (!items.length) return null;
    return <div className="cpm-f wide" key={label}><label>{label}</label><div className="cpm-chips">{items.map((x, i) => <span key={i}>{typeof x === 'string' ? x : (x?.label || x?.name || '')}</span>)}</div></div>;
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // Social links must be openable — the plain-text Row rendered them as dead text.
  // Prefix a bare handle/domain with https:// so the anchor actually navigates.
  const LinkRow = (label, value) => {
    const url = String(value || '').trim();
    if (!url) return null;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, '')}`;
    return (
      <div className="cpm-f wide" key={label}>
        <label>{label}</label>
        <a className="cpm-link" href={href} target="_blank" rel="noreferrer noopener">{url}</a>
      </div>
    );
  };

  // Build each section's rows, then drop any section that ended up empty so the
  // Details tab never shows a wall of blank cards.
  const detailSections = [
    {
      title: 'Basic Information', Icon: User, bio: p.bio,
      rows: [
        canSeePrivate ? Row('Full Name', p.fullName) : null,
        Row('Age', p.age), Row('Gender', p.gender),
        Row('Body Type', p.bodyType), Row('Skin Tone', p.skinTone), Row('Primary Category', categoryTxt),
      ].filter(Boolean),
    },
    {
      title: canSeePrivate ? 'Location & Contact' : 'Location', Icon: MapPin,
      rows: [
        Row('Country', p.country), Row('State', p.state), Row('City', p.city),
        canSeePrivate ? Row('Pincode', p.pincode) : null,
        canSeePrivate ? Row('Phone', phone) : null,
        canSeePrivate ? Row('Address', p.address) : null,
      ].filter(Boolean),
    },
    {
      title: 'Skills & Languages', Icon: Sparkles,
      rows: [
        Chips('Skills', skills), Chips('Languages', languages),
        ...Object.entries(social).map(([k, v]) => (v ? LinkRow(cap(k), v) : null)),
      ].filter(Boolean),
    },
    {
      title: 'Recording Setup', Icon: Clapperboard,
      rows: [
        Chips('Core Setup', p.coreSetup), Chips('Who Appears', p.appearIn), Row('Can Bring', p.bring),
        Row('Weekly Availability', p.weekly || p.availability_calendar?.weekly),
        Row('Flexible Hours', p.flexible ? 'Yes' : ''), Chips('Topics Avoided', p.topics),
      ].filter(Boolean),
    },
    {
      title: 'Pricing', Icon: Wallet,
      rows: [
        Row('Expected Payout', rc.expected_payout || p.expectedPayout),
        Row('Payout Period', rc.payout_period || p.payoutPeriod),
        Row('Budget Range', data?.budget_range || p.budget_range),
      ].filter(Boolean),
    },
  ].filter((s) => s.rows.length > 0 || s.bio);

  // Scroll-spy: highlight the tab for whichever stacked section the reader is on.
  useEffect(() => {
    if (loading || editing) return undefined;
    const order = [['videos', videosRef], ['details', detailsRef], ['reviews', reviewsRef]].filter(([, r]) => r.current);
    if (!order.length) return undefined;
    const onScroll = () => {
      if (scrollLock.current) return;
      const line = 150; // reference line just below the sticky tab bar
      let active = order[0][0];
      order.forEach(([key, r]) => { if (r.current && r.current.getBoundingClientRect().top - line <= 0) active = key; });
      setTab((prev) => (prev === active ? prev : active));
    };
    onScroll();
    // window catches page/body scroll; capture-phase document catches any nested
    // scroll container (e.g. the modal overlay), since scroll events don't bubble.
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
    };
  }, [loading, editing, editable, reviewCount, detailSections.length]);

  const content = (
      <div className="cpm" onClick={(e) => e.stopPropagation()}>
        <div
          className={`cpm-banner ${editable ? 'is-editable' : ''}`}
          // Layer the banner image OVER the gradient (not instead of it): a broken or
          // missing banner URL falls through to the gradient rather than showing white.
          style={banner ? { backgroundImage: `url(${banner}), linear-gradient(120deg,#5b6bff,#23236a 55%,#4452f0)` } : undefined}
          onClick={editable ? () => bannerRef.current?.click() : undefined}
        >
          {asPage
            ? <button type="button" className="cpm-banner-back" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Back"><ChevronLeft size={20} /></button>
            : <button type="button" className="cpm-x" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close"><X size={18} /></button>}
          {editable && (
            <>
              <button
                type="button"
                className="cpm-banner-edit"
                disabled={busy === 'banner'}
                onClick={(e) => { e.stopPropagation(); bannerRef.current && bannerRef.current.click(); }}
              >
                <Camera size={15} /> {busy === 'banner' ? 'Uploading…' : 'Change banner'}
              </button>
              <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={onPickBanner} />
            </>
          )}
        </div>

        <div className="cpm-phead">
          <div className="cpm-avatar-wrap">
            <span className={`cpm-avatar-lg ${editable ? 'is-editable' : ''}`} onClick={editable ? () => photoRef.current?.click() : undefined}>
              {avatar ? <img src={avatar} alt="" /> : name.replace('@', '').charAt(0).toUpperCase()}
            </span>
            {editable && <button type="button" className="cpm-avatar-cam" onClick={() => photoRef.current?.click()} aria-label="Change photo"><Camera size={16} /></button>}
            {editable && <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />}
          </div>

          <div className="cpm-actions">
            {editable ? (
              editing ? (
                <>
                  <button type="button" className="cpm-msg" onClick={saveDetails} disabled={saving}><Check size={16} /> {saving ? 'Saving…' : 'Save'}</button>
                  <button type="button" className="cpm-ghost" onClick={() => setEditing(false)}>Cancel</button>
                </>
              ) : (
                <>
                  <button type="button" className="cpm-ghost" onClick={() => { resetAddForm(); setAddOpen(true); goTab('videos'); }}><Plus size={16} /> Add Work</button>
                  <button type="button" className="cpm-msg" onClick={() => { setTab('details'); setEditing(true); }}><Pencil size={15} /> Edit Profile</button>
                </>
              )
            ) : onEdit ? (
              <button type="button" className="cpm-msg" onClick={onEdit}><Pencil size={15} /> Edit Profile</button>
            ) : (
              <>
                {onBegin && <button type="button" className="cpm-brief-btn" onClick={onBegin}>Send a Brief</button>}
                {onMessage && <button type="button" className="cpm-msg cpm-msg-top" onClick={onMessage}><MessageSquare size={16} /> Send Message</button>}
              </>
            )}
          </div>

          {/* Bookmark outside .cpm-actions so it can be pinned top-right on mobile
              while Send a Brief drops down beside the name. Brand-only. */}
          {!editable && !onEdit && viewer?.role === 'business' && (
            <button
              type="button"
              className={`cpm-save ${saved ? 'is-saved' : ''}`}
              onClick={() => {
                const now = toggleSavedCreator({
                  id: id || data?.id, name, public_creator_id: publicId, photo: avatar, banner,
                  category: hlCategory, price: hlPrice, location: [city, country].filter(Boolean).join(', '),
                  deliverables, delivery: hlDelivery,
                });
                setSaved(now);
                toast.success(now ? 'Creator saved to your list' : 'Removed from saved');
              }}
              aria-label={saved ? 'Saved' : 'Save creator'}
              title={saved ? 'Saved' : 'Save creator'}
            >
              <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
            </button>
          )}

          <h2 className="cpm-name">
            {(creatorFirstName(data) !== 'Creator' ? creatorFirstName(data) : name).replace('@', '').split(/\s+/)[0]}
            {/* Identity verified — admin-approved KYC. Tells brands this is a real,
                verified person. Only the boolean reaches the client. */}
            {data?.kyc_verified && (
              <span className="cpm-verified" title="Identity verified (KYC)">
                <BadgeCheck size={17} /> Verified
              </span>
            )}
          </h2>
          <div className="cpm-id">ID: {publicId}{(city || country) ? ` · ${[city, country].filter(Boolean).join(', ')}` : ''}</div>

          <div className="cpm-stats">
            <span><strong>{deliverables}</strong> deliverables</span>
            <span><strong>{languages.length}</strong> languages</span>
          </div>

          <div className="cpm-highlights">
            <div className="cpm-hl"><label>Category</label><strong>{hlCategory}</strong></div>
            <div className="cpm-hl"><label>Price / video</label><strong>{hlPrice}</strong></div>
            <div className="cpm-hl"><label>Delivery</label><strong>{hlDelivery}</strong></div>
          </div>

        </div>

        <div className="cpm-tabs">
          <button type="button" className={tab === 'videos' ? 'on' : ''} onClick={() => goTab('videos')}>Videos</button>
          <button type="button" className={tab === 'details' ? 'on' : ''} onClick={() => goTab('details')}>Details</button>
          {!editable && <button type="button" className={tab === 'reviews' ? 'on' : ''} onClick={() => goTab('reviews')}>Reviews{reviewCount > 0 ? ` (${reviewCount})` : ''}</button>}
        </div>

        <div className="cpm-tab-body">
          {loading ? (
            <div className="cpm-empty" aria-hidden="true" style={{ display: 'block' }}>
              {/* avatar + name/handle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <Skeleton width={72} height={72} radius="50%" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <Skeleton width="45%" height={18} />
                  <Skeleton width="30%" height={12} />
                </div>
              </div>
              {/* field rows */}
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <Skeleton width="35%" height={12} />
                  <Skeleton width="100%" height={40} radius={10} />
                </div>
              ))}
            </div>
          ) : editing ? (
            <div className="cpm-editform">
              {(() => {
                const fld = (k) => ({ value: form[k] || '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) });
                const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
                const toggle = (k) => (v) => setForm((f) => { const s = new Set(f[k] || []); s.has(v) ? s.delete(v) : s.add(v); return { ...f, [k]: [...s] }; });
                const cities = CITIES_BY_STATE[form.state] || [];
                return (
                  <>
                    <h5 className="cpm-ef-sec">Basic Information</h5>
                    <div className="cpm-ef-grid">
                      <label>Full Name<input {...fld('fullName')} /></label>
                      <label>Age<input type="number" {...fld('age')} /></label>
                      <Sel label="Gender" value={form.gender} onChange={set('gender')} options={GENDERS} />
                      <Sel label="Body Type" value={form.bodyType} onChange={set('bodyType')} options={BODY_TYPES} />
                      <Sel label="Skin Tone" value={form.skinTone} onChange={set('skinTone')} options={SKIN_TONES} />
                      <Sel label="Primary Category" value={form.category} onChange={set('category')} options={CONTENT_CATEGORIES} />
                    </div>
                    <label className="cpm-ef-bio">Bio<textarea rows={3} {...fld('bio')} /></label>

                    <h5 className="cpm-ef-sec">Location &amp; Contact</h5>
                    <div className="cpm-ef-grid">
                      <Sel label="Country" value={form.country} onChange={set('country')} options={COUNTRIES} />
                      <Sel label="State" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v, city: '' }))} options={STATES} />
                      <Sel label="City" value={form.city} onChange={set('city')} options={cities} placeholder={form.state ? 'Select city' : 'Select state first'} />
                      <label>Pincode<input {...fld('pincode')} /></label>
                      <label>Phone<input {...fld('phone')} /></label>
                    </div>
                    <label className="cpm-ef-bio">Address<textarea rows={2} {...fld('address')} /></label>

                    <h5 className="cpm-ef-sec">Skills &amp; Languages</h5>
                    <ChipsPick label="Skills" values={form.skills} options={SKILLS_OPTS} onToggle={toggle('skills')} />
                    <ChipsPick label="Languages" values={form.languages} options={LANGUAGES_OPTS} onToggle={toggle('languages')} />
                    <div className="cpm-ef-grid">
                      <label>YouTube<input {...fld('youtube')} /></label>
                      <label>Instagram<input {...fld('instagram')} /></label>
                      <label>LinkedIn<input {...fld('linkedin')} /></label>
                      <label>TikTok<input {...fld('tiktok')} /></label>
                    </div>

                    <h5 className="cpm-ef-sec">Recording Setup</h5>
                    <ChipsPick label="Core Setup" values={form.coreSetup} options={CORE_SETUP_OPTS} onToggle={toggle('coreSetup')} />
                    <ChipsPick label="Who Appears" values={form.appearIn} options={APPEAR_IN_OPTS} onToggle={toggle('appearIn')} />
                    <ChipsPick label="Topics Avoided" values={form.topics} options={TOPICS_OPTS} onToggle={toggle('topics')} />
                    <div className="cpm-ef-grid">
                      <Sel label="Weekly Availability" value={form.weekly} onChange={set('weekly')} options={WEEKLY_OPTS} />
                    </div>
                    <label className="cpm-ef-check"><input type="checkbox" checked={!!form.flexible} onChange={(e) => setForm((f) => ({ ...f, flexible: e.target.checked }))} /> Flexible working hours</label>

                    <h5 className="cpm-ef-sec">Pricing &amp; Delivery</h5>
                    <div className="cpm-ef-grid">
                      <label>Expected Payout<input {...fld('expectedPayout')} /></label>
                      <label>Payout Period<input value="Per Video" readOnly /></label>
                      <label>
                        Typical Delivery (days) *
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. 3"
                          value={form.deliveryDays}
                          onChange={(e) => setForm((f) => ({ ...f, deliveryDays: e.target.value.replace(/[^0-9]/g, '') }))}
                        />
                      </label>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <>
              <section className="cpm-sec-block" data-sec="videos" ref={videosRef}>
                {editable ? (
                  <>
                    {addOpen && (
                      <div className="cpm-addwork">
                        {addForm.url ? (
                          <div className="cpm-aw-preview">
                            <VideoTile url={addForm.url} />
                            <button type="button" className="cpm-aw-change" onClick={() => workRef.current?.click()}>{busy === 'work' ? 'Uploading…' : 'Change video'}</button>
                          </div>
                        ) : (
                          <button type="button" className="cpm-aw-up" onClick={() => workRef.current?.click()}>
                            <span>{busy === 'work' ? 'Uploading…' : <><Plus size={22} /> Upload video</>}</span>
                          </button>
                        )}
                        <input ref={workRef} type="file" accept="video/*" hidden onChange={onPickWork} />
                        <div className="cpm-aw-fields">
                          <input placeholder="Brand name" value={addForm.brand} onChange={(e) => setAddForm((f) => ({ ...f, brand: e.target.value }))} />
                          <div className="cpm-aw-row">
                            <input placeholder="Category (e.g. Beauty)" value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))} />
                            <input placeholder="Price / video (₹)" inputMode="numeric" value={addForm.price} onChange={(e) => setAddForm((f) => ({ ...f, price: e.target.value }))} />
                          </div>
                          <input placeholder="Delivered in (e.g. 2 days)" value={addForm.delivery} onChange={(e) => setAddForm((f) => ({ ...f, delivery: e.target.value }))} />
                          <div className="cpm-aw-actions">
                            <button type="button" className="cpm-msg" onClick={saveWork}><Check size={15} /> {editIdx != null ? 'Update work' : 'Save work'}</button>
                            <button type="button" className="cpm-ghost" onClick={() => { setAddOpen(false); resetAddForm(); }}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="cpm-vids">
                      {!addOpen && <button type="button" className="cpm-vid cpm-add-tile" onClick={() => { resetAddForm(); setAddOpen(true); }}><Plus size={26} /><span>Add Work</span></button>}
                      {(pf || []).map((it, i) => {
                        const u = pfUrl(it);
                        if (!u) return null;
                        const meta = typeof it === 'string' ? {} : it;
                        return (
                          <div className="cpm-vid-item" key={i}>
                            <VideoTile url={u} onRemove={() => removeWork(i)} onEdit={() => editWork(i)} />
                            <div className="cpm-vid-cap">
                              <div className="cpm-vid-headrow">
                                {meta.brand && <strong className="cpm-vid-brand">{meta.brand}</strong>}
                                <span className="cpm-vid-cat">{meta.category || hlCategory}</span>
                              </div>
                              <div className="cpm-vid-pricerow">
                                <div className="cpm-vid-price"><label>Price</label><strong>{vidPrice(meta.price, basePrice)}</strong></div>
                                <span className="cpm-vid-del"><label>Delivered in</label><strong>{vidDelivery(meta.delivery, hlDelivery)}</strong></span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="cpm-vids">
                    {vids.length === 0 && (
                      <div className="cpm-vids-empty" style={{ gridColumn: '1 / -1', padding: '28px', textAlign: 'center', color: 'var(--text-muted, #8a90a6)', fontSize: 14 }}>
                        No videos uploaded yet.
                      </div>
                    )}
                    {vids.slice(0, 12).map((v, i) => (
                      <div className="cpm-vid-item" key={i}>
                        <VideoTile url={v.url} />
                        <div className="cpm-vid-cap">
                          <div className="cpm-vid-headrow">
                            {v.brand && <strong className="cpm-vid-brand">{v.brand}</strong>}
                            <span className="cpm-vid-cat">{v.category || hlCategory}</span>
                          </div>
                          <div className="cpm-vid-pricerow">
                            <div className="cpm-vid-price"><label>Price</label><strong>{vidPrice(v.price, basePrice)}</strong></div>
                            <span className="cpm-vid-del"><label>Delivered in</label><strong>{vidDelivery(v.delivery, hlDelivery)}</strong></span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="cpm-sec-block" data-sec="details" ref={detailsRef}>
                <h4 className="cpm-sec-title">Details</h4>
                {detailSections.length === 0 ? (
                  <div className="cpm-empty">This creator hasn't shared more details yet.</div>
                ) : (
                  <div className="cpm-sections">
                    {detailSections.map((s) => (
                      <section key={s.title}>
                        <div className="cpm-sec-h"><span className="cpm-sec-ic"><s.Icon size={15} /></span><h4>{s.title}</h4></div>
                        {s.bio && <p className="cpm-bio">{s.bio}</p>}
                        {s.rows.length > 0 && <div className="cpm-grid">{s.rows}</div>}
                      </section>
                    ))}
                  </div>
                )}
              </section>

              {!editable && (
                <section className="cpm-sec-block" data-sec="reviews" ref={reviewsRef}>
                  <h4 className="cpm-sec-title">Reviews{reviewCount > 0 ? ` (${reviewCount})` : ''}</h4>
                  {reviewCount === 0 ? (
                    <div className="cpm-rev-empty">
                      <Star size={26} color="#cfd2e6" />
                      <strong>No reviews yet</strong>
                      <span>Reviews from brands appear here once a deal is completed.</span>
                    </div>
                  ) : (
                    <div className="cpm-reviews">
                      <div className="cpm-rev-head">
                        <h3>{reviewCount} Review{reviewCount > 1 ? 's' : ''}</h3>
                        <div className="cpm-rev-overall"><Stars n={avgRating} size={16} /> <b>{avgRating.toFixed(1)}</b></div>
                      </div>
                      <div className="cpm-rev-bars">
                        {[5, 4, 3, 2, 1].map((star) => {
                          const c = reviews.filter((r) => Math.round(r.rating || 0) === star).length;
                          const pct = reviewCount ? (c / reviewCount) * 100 : 0;
                          return (
                            <div className="cpm-rev-bar" key={star}>
                              <span>{star} Star{star > 1 ? 's' : ''}</span>
                              <div className="cpm-rev-track"><i style={{ width: `${pct}%` }} /></div>
                              <em>({c})</em>
                            </div>
                          );
                        })}
                      </div>
                      <div className="cpm-rev-list">
                        {reviews.map((rv, i) => {
                          const text = rv.review || rv.review_text || rv.comment || '';
                          const who = reviewers[rv.reviewer_id]?.name || rv.reviewer_name || 'Brand';
                          const photo = reviewers[rv.reviewer_id]?.photo;
                          const camp = revCampaigns[rv.campaign_id] || {};
                          const ws = camp.work_submission || {};
                          const selBid = (camp.bids || []).find((b) => b.creator_id === camp.selected_creator) || {};
                          const cat = (camp.category || camp.industry_type || 'UGC').replace(/_/g, ' ');
                          const price = (camp.budget_max || camp.budget_min)
                            ? `Up to ${inr(camp.budget_max || camp.budget_min)}` : 'On request';
                          const days = selBid.estimated_delivery_days || camp.estimated_delivery_days;
                          const duration = days ? `${days} day${Number(days) > 1 ? 's' : ''}` : '—';
                          // Prefer the actually-delivered work video; if the campaign
                          // has none stored, fall back to one of the creator's portfolio
                          // videos so every review still shows a (watermarked) clip.
                          const vid = (ws.work_files || []).find((f) => isVideo(f)) || (ws.work_files || [])[0] || '';
                          const fallbackVid = (vids[i % (vids.length || 1)] || {}).url || '';
                          const vidUrl = vid ? assetUrl(vid) : (fallbackVid ? assetUrl(fallbackVid) : '');
                          return (
                            <div className="cpm-rev-card" key={rv.id || i}>
                              <div className="cpm-rev-main">
                                <div className="cpm-rev-who">
                                  <span className="cpm-rev-ava">{photo ? <img src={photo} alt="" /> : (String(who).replace('@', '')[0] || 'B').toUpperCase()}</span>
                                  <strong>{String(who).replace('@', '')}</strong>
                                </div>
                                <div className="cpm-rev-meta"><Stars n={rv.rating} size={13} /> <b>{(rv.rating || 0).toFixed(0)}</b> <span>· {relTime(rv.created_at)}</span></div>
                                {text && <p className="cpm-rev-text">{text}</p>}
                                <div className="cpm-rev-facts">
                                  <div className="cpm-rev-fact"><strong>{price}</strong><label>Price</label></div>
                                  <div className="cpm-rev-fact"><strong>{duration}</strong><label>Duration</label></div>
                                  <div className="cpm-rev-fact"><span className="cpm-rev-cat">{cat}</span><label>Service</label></div>
                                </div>
                              </div>
                              {vidUrl && isVideo(vidUrl) && <div className="cpm-rev-media"><RevClip src={vidUrl} /></div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        {/* Mobile-only persistent bottom CTA — Send Message is always reachable while
            the profile is open. Rendered separately from the header actions so it
            can't disturb their layout. */}
        {!editable && !onEdit && onMessage && (
          <div className="cpm-mobilebar">
            <button type="button" className="cpm-msg" onClick={onMessage} style={{ width: '100%' }}>
              <MessageSquare size={16} /> Send Message
            </button>
          </div>
        )}

      <style>{`
        .cpm-ov{position:fixed;inset:0;background:rgba(15,22,58,.5);backdrop-filter:blur(3px);z-index:1400;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto}
        .cpm{position:relative;width:min(980px,100%);background:#fff;border-radius:22px;box-shadow:0 30px 70px rgba(15,22,58,.4);overflow:hidden}
        .cpm-page .cpm{width:100%;max-width:none;margin:0;box-shadow:none;border:none;border-radius:0}
        .cpm-banner{position:relative;height:190px;background:linear-gradient(120deg,#5b6bff,#23236a 55%,#4452f0);background-size:cover;background-position:center}
        .cpm-x,.cpm-banner-back{position:absolute;width:38px;height:38px;border-radius:50%;border:none;background:rgba(255,255,255,.92);color:#15163a;cursor:pointer;display:grid;place-items:center;z-index:2;box-shadow:0 4px 14px rgba(15,22,58,.25)}
        .cpm-x{top:16px;right:16px}
        .cpm-banner-back{top:16px;left:16px}
        .cpm-phead{position:relative;padding:0 28px 20px}
        .cpm-avatar-wrap{position:relative;width:108px;height:108px;margin-top:-54px}
        .cpm-avatar-lg{box-sizing:border-box;display:grid;place-items:center;width:108px;height:108px;border-radius:50%;border:4px solid #fff;overflow:hidden;background:linear-gradient(135deg,#5b6bff,#23236a);color:#fff;font-weight:800;font-size:38px;box-shadow:0 8px 22px -8px rgba(15,22,58,.4)}
        .cpm-avatar-lg img{width:100%;height:100%;object-fit:cover}
        .cpm-actions{position:absolute;right:28px;top:122px;display:flex;align-items:center;gap:10px}
        .cpm-msg{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#15163a;color:#fff;border:none;border-radius:30px;padding:11px 20px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit}
        .cpm-msg:hover{filter:brightness(1.12)}
        .cpm-brief-btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(100deg,#12124f,#07074e);color:#fff;border:none;border-radius:30px;padding:11px 22px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit;box-shadow:0 12px 26px -12px rgba(7,7,78,.7)}
        .cpm-brief-btn:hover{transform:translateY(-1px)}
        .cpm-save{width:44px;height:44px;border-radius:50%;border:1px solid #e6e8f3;background:#fff;color:#585c7e;cursor:pointer;display:grid;place-items:center}
        .cpm-save:hover{border-color:#cdd4ff;color:#4452f0}
        .cpm-save.is-saved{background:#eef0ff;border-color:#cdd4ff;color:#4452f0}
        .cpm-name{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:25px;font-weight:800;color:#15163a;margin:12px 0 2px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .cpm-verified{display:inline-flex;align-items:center;gap:5px;font-family:var(--font-body,inherit);font-size:12.5px;font-weight:700;
          color:#15803d;background:#e7f7ef;border:1px solid #b7e4cd;padding:4px 10px;border-radius:999px}
        .cpm-id{color:#9296ba;font-size:13px;font-weight:600}
        .cpm-stats{display:flex;flex-wrap:wrap;gap:8px 28px;margin-top:16px}
        .cpm-stats span{color:#9296ba;font-size:12.5px;font-weight:600}
        .cpm-stats strong{color:#15163a;font-size:17px;font-weight:800;margin-right:4px}
        .cpm-highlights{display:grid;grid-template-columns:auto auto auto;justify-content:space-between;gap:12px;margin-top:18px;
          padding:16px 18px;border:1px solid #ebedfb;border-radius:16px;background:linear-gradient(140deg,#fbfbff,#f4f5ff)}
        .cpm-highlights .cpm-hl:last-child{text-align:right}
        .cpm-hl{min-width:0}
        .cpm-hl label{display:block;color:#9296ba;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
        .cpm-hl strong{display:block;color:#07074e;font-size:16px;font-weight:800;margin-top:3px;text-transform:capitalize;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        /* Keep Category / Price / Delivery on ONE line (3 cols) even on phones —
           just shrink the text so ₹50,000 etc. still fit. */
        @media (max-width:520px){.cpm-highlights{grid-template-columns:auto auto auto;justify-content:space-between;gap:10px}
          .cpm-hl label{font-size:10px}.cpm-hl strong{font-size:14px}}
        .cpm-tabs{display:flex;gap:26px;border-bottom:1px solid #eef0f6;margin-top:20px;padding:0 28px;background:#fff}
        .cpm-tabs button{background:none;border:none;padding:14px 2px;font-size:15px;font-weight:700;color:#9296ba;cursor:pointer;font-family:inherit;border-bottom:2.5px solid transparent;margin-bottom:-1px}
        .cpm-tabs button.on{color:#15163a;border-bottom-color:#5b6bff}
        .cpm-tab-body{padding:22px 28px 4px}
        /* scroll-spy: each tab maps to a stacked section; the tab bar sticks while scrolling */
        .cpm-sec-block{scroll-margin-top:130px;padding-top:4px}
        .cpm-sec-block + .cpm-sec-block{margin-top:28px;border-top:1px solid #eef0f6;padding-top:24px}
        .cpm-sec-title{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:18px;font-weight:800;color:#15163a;margin:0 0 16px}
        .cpm-page .cpm{overflow:visible}
        .cpm-page .cpm-tabs{position:sticky;top:72px;z-index:6;margin-top:0}
        @media (max-width:760px){.cpm-page .cpm-tabs{top:0}}
        .cpm-stars{display:inline-flex;gap:2px;vertical-align:middle}
        .cpm-reviews{display:flex;flex-direction:column;gap:18px}
        .cpm-rev-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .cpm-rev-head h3{margin:0;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:19px;font-weight:800;color:#15163a}
        .cpm-rev-overall{display:inline-flex;align-items:center;gap:8px}
        .cpm-rev-overall b{font-size:16px;color:#15163a}
        .cpm-rev-bars{display:flex;flex-direction:column;gap:7px;max-width:420px}
        .cpm-rev-bar{display:grid;grid-template-columns:58px 1fr 44px;align-items:center;gap:10px;font-size:13px;color:#585c7e;font-weight:600}
        .cpm-rev-track{height:8px;border-radius:6px;background:#eef0f6;overflow:hidden}
        .cpm-rev-track i{display:block;height:100%;background:#15163a;border-radius:6px}
        .cpm-rev-bar em{font-style:normal;color:#9296ba;text-align:right}
        .cpm-rev-list{display:flex;flex-direction:column;gap:14px;border-top:1px solid #eef0f6;padding-top:18px}
        .cpm-rev-card{position:relative;border:1px solid #eef0f6;border-radius:14px;padding:16px 18px;background:#fff;display:flex;gap:20px;align-items:center}
        .cpm-rev-main{flex:1;min-width:0}
        .cpm-rev-media{flex:none}
        .cpm-rev-who{display:flex;align-items:center;gap:10px}
        .cpm-rev-ava{width:38px;height:38px;border-radius:50%;flex:none;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#5b6bff,#23236a);color:#fff;font-weight:800;font-size:15px}
        .cpm-rev-ava img{width:100%;height:100%;object-fit:cover}
        .cpm-rev-who strong{font-size:14.5px;color:#15163a}
        .cpm-rev-meta{display:flex;align-items:center;gap:6px;margin-top:10px;color:#9296ba;font-size:12.5px}
        .cpm-rev-meta b{color:#15163a;font-size:13px}
        .cpm-rev-card p{margin:10px 0 0;color:#3a3d63;font-size:14px;line-height:1.6}
        /* Fiverr-style review facts: Price | Duration | clip + Category, with
           thin vertical divider lines between each cell. */
        .cpm-rev-text{margin:10px 0 0!important}
        .cpm-rev-facts{display:flex;align-items:center;flex-wrap:wrap;gap:0;margin-top:16px;padding-top:16px;border-top:1px solid #eef0f6}
        .cpm-rev-fact{display:flex;flex-direction:column-reverse;min-width:0;padding:2px 22px}
        .cpm-rev-fact:first-child{padding-left:0}
        .cpm-rev-fact + .cpm-rev-fact{border-left:1px solid #e7e8f3}
        .cpm-rev-fact strong{color:#07074e;font-size:15px;font-weight:800;white-space:nowrap}
        .cpm-rev-fact label{color:#9296ba;font-size:12px;font-weight:600}
        .cpm-rev-fact-cat{flex-direction:row;align-items:center;gap:12px}
        .cpm-rev-cat{color:#15163a;font-size:14px;font-weight:700;text-transform:capitalize}
        /* inline playable, watermarked clip (matches the brand work-review preview) */
        .cpm-rev-clip{position:relative;flex:none;width:230px;aspect-ratio:16/10;border-radius:12px;overflow:hidden;
          border:1px solid #e7e8f3;background:#0b1020;cursor:pointer;padding:0}
        .cpm-rev-clip video{width:100%;height:100%;object-fit:cover;display:block}
        .cpm-rev-wm{position:absolute;inset:0;pointer-events:none;background-repeat:no-repeat;background-position:top 8px right 10px;background-size:44px auto;background-image:url("/ugcad-logo_-_Edited-removebg-preview.png")}
        /* small clip thumbnail keeps the subtle tiled text watermark (badge is too big here) */
        .cpm-rev-clip .cpm-rev-wm{opacity:.5;background-repeat:repeat;background-position:0 0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E%3Ctext x='0' y='50' transform='rotate(-28 60 40)' fill='%23ffffff' fill-opacity='0.55' font-family='Arial' font-size='12' font-weight='700'%3EUGCad.io%3C/text%3E%3C/svg%3E")}
        .cpm-clip-ov{position:fixed;inset:0;z-index:1600;background:rgba(8,10,30,.78);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px}
        .cpm-clip-box{position:relative;width:min(900px,96vw)}
        .cpm-clip-frame{position:relative;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 30px 80px -20px rgba(0,0,0,.6)}
        .cpm-clip-vid{display:block;width:100%;max-height:82vh;background:#000}
        .cpm-clip-x{position:absolute;top:-46px;right:0;width:38px;height:38px;border-radius:50%;border:none;background:#fff;color:#15163a;cursor:pointer;display:grid;place-items:center;z-index:2}
        .cpm-clip-wm{position:absolute;top:12px;right:14px;z-index:3;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:3px}
        .cpm-clip-wm img{width:46px;height:46px;object-fit:contain;border-radius:10px;opacity:.92;filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))}
        .cpm-clip-wm span{color:#fff;font-size:12px;font-weight:800;letter-spacing:.3px;text-shadow:0 1px 4px rgba(0,0,0,.7)}
        .cpm-rev-clip-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:28px;height:28px;
          border-radius:50%;background:rgba(255,255,255,.92);display:grid;place-items:center;color:var(--indigo,#5b6bff);box-shadow:0 3px 10px rgba(0,0,0,.3)}
        @media (max-width:560px){.cpm-rev-card{flex-direction:column;align-items:stretch}.cpm-rev-media{position:absolute;top:16px;right:18px;width:118px}.cpm-rev-who,.cpm-rev-meta{padding-right:130px}.cpm-rev-clip{width:100%;aspect-ratio:16/9}.cpm-rev-facts{gap:8px;flex-wrap:nowrap;justify-content:space-between}.cpm-rev-fact{padding:0;flex:1;min-width:0}.cpm-rev-fact+.cpm-rev-fact{border-left:none}.cpm-rev-fact strong{font-size:14px}.cpm-rev-cat{font-size:13px}}
        .cpm-vids{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:18px}
        .cpm-vid{position:relative;aspect-ratio:3/4;border-radius:14px;overflow:hidden;background:#0b1020;cursor:pointer;box-shadow:0 8px 22px -12px rgba(15,22,58,.4)}
        /* per-video caption: category chip + price / duration */
        .cpm-vid-item{display:flex;flex-direction:column;gap:8px}
        .cpm-vid-cap{padding:0 2px}
        /* Brand on the left, category chip pushed to the right — same line. */
        .cpm-vid-headrow{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px}
        .cpm-vid-headrow .cpm-vid-brand{margin-top:0;min-width:0;flex:1}
        .cpm-vid-headrow .cpm-vid-cat{flex:none}
        .cpm-vid-brand{display:block;margin-top:9px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:14.5px;font-weight:800;color:#15163a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cpm-vid-brand + .cpm-vid-catrow{margin-top:5px}
        .cpm-vid-cat{display:inline-block;padding:2px 10px;border-radius:20px;background:#eef0ff;color:#5b6bff;
          font-size:11.5px;font-weight:700;text-transform:capitalize}
        .cpm-vid-pd{display:flex;justify-content:space-between;gap:8px;margin-top:8px}
        .cpm-vid-pd span{display:flex;flex-direction:column-reverse;min-width:0}
        .cpm-vid-pd strong{color:#07074e;font-size:13.5px;font-weight:800;white-space:nowrap}
        .cpm-vid-pd label{color:#9296ba;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
        .cpm-vid-pd span:last-child{text-align:right;align-items:flex-end}
        /* Videos tab caption: category + delivered on one line, price below */
        .cpm-vid-catrow{display:flex;align-items:center;margin-top:8px}
        .cpm-vid-cat{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        /* price + delivered on one line */
        .cpm-vid-pricerow{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:8px}
        .cpm-vid-del{display:inline-flex;flex-direction:column;align-items:flex-end;text-align:right;white-space:nowrap;flex:none}
        .cpm-vid-price{display:flex;flex-direction:column}
        .cpm-vid-del label,.cpm-vid-price label{color:#9296ba;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
        .cpm-vid-del strong,.cpm-vid-price strong{color:#07074e;font-size:13.5px;font-weight:800;white-space:nowrap}
        .cpm-vid video,.cpm-vid img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .35s ease}
        .cpm-vid-broken{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#f1f2f9;color:#98a1ad;font-size:11.5px;font-weight:600;text-align:center;cursor:default}
        .cpm-vid:hover video,.cpm-vid:hover img{transform:scale(1.07)}
        .cpm-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.85);display:grid;place-items:center;color:#5b6bff;pointer-events:none;transition:opacity .2s ease}
        .cpm-vid:hover .cpm-play{opacity:0}
        .cpm-empty{text-align:center;color:#9296ba;padding:30px 0;font-size:14px}
        .cpm-rev-empty{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:34px 20px;border:1px dashed #e6e8f3;border-radius:16px;background:#fafbff}
        .cpm-rev-empty strong{color:#15163a;font-size:15px;font-weight:800}
        .cpm-rev-empty span{color:#9296ba;font-size:13px;max-width:320px}
        /* editable */
        .cpm-ghost{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #e6e8f3;color:#15163a;border-radius:30px;padding:10px 18px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit}
        .cpm-ghost:hover{border-color:#cdd4ff;color:#4452f0;background:#f6f7ff}
        .cpm-banner.is-editable{cursor:pointer}
        .cpm-banner-edit{position:absolute;right:16px;bottom:14px;z-index:3;display:inline-flex;align-items:center;gap:6px;background:rgba(15,22,58,.7);color:#fff;font-size:12px;font-weight:600;padding:8px 14px;border:none;border-radius:20px;cursor:pointer;font-family:inherit;backdrop-filter:blur(4px)}
        .cpm-banner-edit:hover{background:rgba(15,22,58,.9)}
        .cpm-banner-edit:disabled{opacity:.7;cursor:default}
        .cpm-avatar-lg.is-editable{cursor:pointer}
        .cpm-avatar-cam{position:absolute;right:2px;bottom:2px;width:30px;height:30px;border:2px solid #fff;border-radius:50%;background:#15163a;color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 2px 6px rgba(15,22,58,.3);z-index:2}
        .cpm-vid-remove{position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;border:none;background:rgba(15,22,58,.6);color:#fff;display:grid;place-items:center;cursor:pointer;z-index:3}
        .cpm-vid-remove:hover{background:#e5484d}
        .cpm-vid-edit{position:absolute;top:8px;right:44px;width:30px;height:30px;border-radius:50%;border:none;background:rgba(15,22,58,.6);color:#fff;display:grid;place-items:center;cursor:pointer;z-index:3}
        .cpm-vid-edit:hover{background:#6d7bff}
        .cpm-add-tile{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#f6f7ff!important;border:2px dashed #cdd4ff;color:#5b6bff;font-weight:700;font-size:13px;cursor:pointer}
        .cpm-add-tile span{font-size:13px}
        .cpm-addwork{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:18px;padding:16px;border:1px solid #eef0f6;border-radius:14px;background:#fbfbfe}
        .cpm-aw-up{flex:none;width:150px;aspect-ratio:3/4;border-radius:12px;border:2px dashed #cdd4ff;background:#f6f7ff;color:#5b6bff;font-weight:700;font-size:13px;cursor:pointer;display:grid;place-items:center;overflow:hidden;position:relative}
        .cpm-aw-up span{display:inline-flex;align-items:center;gap:6px}
        .cpm-aw-preview{flex:none;width:150px;display:flex;flex-direction:column;gap:8px}
        .cpm-aw-preview .cpm-vid{width:100%}
        .cpm-aw-change{border:1px solid #e6e8f3;background:#fff;color:#585c7e;border-radius:9px;padding:7px 10px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}
        .cpm-aw-change:hover{border-color:#cdd4ff;color:#4452f0}
        .cpm-aw-fields{flex:1;min-width:240px;display:flex;flex-direction:column;gap:10px}
        .cpm-aw-row{display:flex;gap:10px}
        .cpm-aw-row input{flex:1;min-width:0}
        .cpm-aw-fields input,.cpm-aw-fields textarea{border:1px solid #e6e8f3;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;color:#15163a;background:#fff;outline:none}
        .cpm-aw-fields input:focus,.cpm-aw-fields textarea:focus{border-color:#5b6bff}
        .cpm-aw-actions{display:flex;gap:10px;margin-top:2px}
        .cpm-editform{display:flex;flex-direction:column;gap:14px}
        .cpm-ef-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
        .cpm-editform label{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:700;color:#9296ba;text-transform:uppercase;letter-spacing:.3px}
        .cpm-editform input,.cpm-editform textarea,.cpm-editform select{border:1px solid #e6e8f3;border-radius:10px;padding:10px 12px;font-size:14px;font-weight:500;font-family:inherit;color:#15163a;background:#fff;outline:none;text-transform:none;letter-spacing:0}
        .cpm-editform input:focus,.cpm-editform textarea:focus,.cpm-editform select:focus{border-color:#5b6bff}
        .cpm-editform select{cursor:pointer;appearance:auto}
        .cpm-pickwrap{display:flex;flex-direction:column;gap:8px}
        .cpm-pick-label{font-size:11.5px;font-weight:700;color:#9296ba;text-transform:uppercase;letter-spacing:.3px}
        .cpm-pick{display:flex;flex-wrap:wrap;gap:8px}
        .cpm-pick button{background:#fff;border:1px solid #e6e8f3;color:#585c7e;border-radius:30px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s}
        .cpm-pick button:hover{border-color:#cdd4ff}
        .cpm-pick button.on{background:#eef0ff;border-color:#5b6bff;color:#4452f0}
        .cpm-ef-note{color:#9296ba;font-size:12.5px;margin:0}
        .cpm-ef-sec{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:12.5px;font-weight:800;color:#15163a;text-transform:uppercase;letter-spacing:.5px;margin:6px 0 0;padding-top:10px;border-top:1px solid #eef0f6}
        .cpm-editform .cpm-ef-sec:first-child{border-top:none;padding-top:0}
        .cpm-ef-check{flex-direction:row!important;align-items:center;gap:8px!important;text-transform:none!important;letter-spacing:0!important;font-size:13.5px!important;color:#15163a!important;font-weight:600!important}
        .cpm-ef-check input{width:16px;height:16px;accent-color:#5b6bff}
        /* Masonry-style columns instead of a grid. In a 2-col grid every row is as tall
           as its tallest card, so short cards (Location, Pricing) left big dead gaps
           underneath. Columns let each card sit right under the previous one. */
        .cpm-sections{column-count:2;column-gap:14px}
        @media (max-width:760px){.cpm-sections{column-count:1}}
        .cpm-sections section{break-inside:avoid;-webkit-column-break-inside:avoid;page-break-inside:avoid;
          display:inline-block;width:100%;margin:0 0 14px;
          border:1px solid #eef0f6;border-radius:16px;padding:18px 20px;background:#fff;box-shadow:0 1px 2px rgba(15,22,58,.04)}
        .cpm-sec-h{display:flex;align-items:center;gap:10px;margin-bottom:14px}
        .cpm-sec-ic{flex:none;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#eef0ff;color:#5b6bff}
        .cpm-sections h4{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:13px;font-weight:800;color:#15163a;text-transform:uppercase;letter-spacing:.5px;margin:0}
        .cpm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}
        .cpm-f{display:flex;flex-direction:column;gap:3px;min-width:0}
        .cpm-f.wide{grid-column:1/-1}
        .cpm-f label{font-size:11px;font-weight:700;color:#9296ba;text-transform:uppercase;letter-spacing:.3px}
        .cpm-f span{font-size:14px;color:#15163a;font-weight:600;overflow-wrap:anywhere}
        .cpm-link{font-size:14px;color:#4452f0;font-weight:600;overflow-wrap:anywhere;text-decoration:none}
        .cpm-link:hover{text-decoration:underline}
        .cpm-chips{display:flex;flex-wrap:wrap;gap:6px}
        .cpm-chips span{background:#eef0ff;color:#5b6bff;font-size:12px;font-weight:600;padding:3px 10px;border-radius:14px}
        .cpm-bio{margin:12px 0 0;color:#585c7e;font-size:13.5px;line-height:1.55}
        .cpm-foot{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:18px 28px 24px;padding:16px 18px;background:#eef0ff;border:1px solid #dfe2ff;border-radius:16px}
        .cpm-foot-text{display:flex;align-items:center;gap:10px;flex:1;min-width:200px}
        .cpm-foot-text span{font-size:22px}
        .cpm-foot-text strong{display:block;color:#15163a;font-size:15px}
        .cpm-foot-text p{margin:2px 0 0;color:#585c7e;font-size:12.5px}
        .cpm-begin{background:linear-gradient(100deg,#12124f,#07074e);color:#fff;border:none;border-radius:30px;padding:11px 22px;font-weight:800;font-size:13.5px;cursor:pointer;font-family:inherit;box-shadow:0 12px 26px -12px rgba(7,7,78,.7)}
        .cpm-begin:hover{filter:brightness(1.06)}
        .cpm-mobilebar{display:none}
        /* Hide the app's floating message FAB on mobile while a profile is open —
           it would sit right on top of the bottom Send Message bar. */
        @media(max-width:640px){body.cpm-open .cmk-post-fab{display:none}}
        @media(max-width:640px){
          /* Send Message lives in the fixed bottom bar on mobile — drop the top one. */
          .cpm-msg-top{display:none}
          /* Send a Brief drops down to sit on the name's line, right side. */
          .cpm-actions{position:absolute;top:82px;right:24px;left:auto;margin:0}
          /* Bookmark pinned up in the top-right (above Send a Brief). */
          .cpm-save{position:absolute;top:24px;right:24px;left:auto;width:40px;height:40px;margin:0;z-index:5}
          /* Reserve room so a longer name doesn't run under Send a Brief. */
          .cpm-name{padding-right:130px}
          /* Persistent bottom Send Message bar. */
          .cpm-mobilebar{display:block;position:fixed;left:0;right:0;bottom:0;z-index:1500;
            padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));
            background:#fff;border-top:1px solid #eef0f6;box-shadow:0 -6px 20px rgba(15,22,58,.12)}
          /* Room so the bar never covers the last content. */
          .cpm-tab-body{padding-bottom:84px}
        }
      `}</style>
      </div>
  );

  if (asPage) return <div className="cpm-page">{content}</div>;
  return <div className="cpm-ov" onClick={onClose}>{content}</div>;
}
