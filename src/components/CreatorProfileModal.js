import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Play, MessageSquare, ChevronLeft, Bookmark, User, MapPin, Sparkles, Clapperboard, Wallet, Pencil, Plus, Trash2, Camera, Check } from 'lucide-react';
import { CONTENT_CATEGORIES } from '../constants/contentCategories';
import { apiErrorMessage } from '../utils/apiError';

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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
const isVideo = (u) => /\.(mp4|webm|mov|m4v)$/i.test(String(u || '').split('?')[0]);
const pfUrl = (it) => (typeof it === 'string' ? it : (it?.videoUrl || it?.link || it?.url || (Array.isArray(it?.urls) && it.urls[0]) || it?.original_url || ''));
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const LEVEL_LABEL = { new: 'New', verified: 'Verified', l1: 'L1', l2: 'L2', elite: 'Elite' };
const FALLBACK_VIDEOS = [
  '/creator/video_01.mp4', '/creator/video_08.mp4', '/creator/video_27.mp4', '/creator/video_28.mp4',
  '/creator/video_29.mp4', '/creator/video_30.mp4', '/creator/video_32.mp4', '/creator/video_33.mp4',
];

function VideoTile({ url, onRemove }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const src = assetUrl(url);
  const toggle = () => {
    if (!ref.current) return;
    if (ref.current.paused) { ref.current.play().then(() => setPlaying(true)).catch(() => {}); }
    else { ref.current.pause(); setPlaying(false); }
  };
  return (
    <div className="cpm-vid" onClick={toggle}>
      {isVideo(src) ? <video ref={ref} src={`${src}#t=0.5`} playsInline loop /> : <img src={src} alt="" />}
      {!playing && <span className="cpm-play"><Play size={18} fill="currentColor" /></span>}
      {onRemove && <button type="button" className="cpm-vid-del" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Remove"><Trash2 size={15} /></button>}
    </div>
  );
}

/**
 * Rich creator profile — banner + avatar + stats + Videos/Details tabs.
 * Fetches /profile/:id. `asPage` renders it inline (no overlay) for the route page.
 */
export default function CreatorProfileModal({ id, fallbackName, photo, onClose, onMessage, onBegin, onEdit, asPage = false, editable = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('videos');
  const [saved, setSaved] = useState(false);

  // ── Own-profile editing (only when `editable`) ──────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});            // editable detail fields
  const [pf, setPf] = useState([]);                // editable portfolio list
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', brand: '', desc: '', url: '' });
  const [busy, setBusy] = useState('');            // 'photo' | 'banner' | 'work'
  const [localPhoto, setLocalPhoto] = useState('');
  const [localBanner, setLocalBanner] = useState('');
  const photoRef = useRef(null);
  const bannerRef = useRef(null);
  const workRef = useRef(null);

  useEffect(() => {
    let a = true;
    axios.get(`${API}/profile/${id}`).then((r) => { if (a) setData(r.data); }).catch(() => {}).finally(() => { if (a) setLoading(false); });
    return () => { a = false; };
  }, [id]);

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
      const up = await uploadFile(file, '/upload/file');
      const url = up.file_url || up.url || '';
      if (!url) { toast.error('Upload failed — no file URL returned.'); return; }
      // Show the new banner immediately; persistence is best-effort so a backend
      // hiccup (missing /profile/banner route, etc.) doesn't hide the upload.
      setLocalBanner(url);
      try {
        await axios.patch(`${API}/profile/banner`, { banner: url });
        toast.success('Banner updated');
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Banner uploaded but could not be saved to your profile'));
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not upload banner'));
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
    setBusy('work');
    try {
      const up = await uploadFile(file, '/upload/file');
      setAddForm((f) => ({ ...f, url: up.file_url || '' }));
      toast.success('Video uploaded — add details and save');
    } catch { toast.error('Could not upload video'); }
    finally { setBusy(''); if (workRef.current) workRef.current.value = ''; }
  };

  const saveWork = async () => {
    if (!addForm.url) { toast.error('Upload a video first'); return; }
    const item = { title: addForm.title || 'Untitled', brand: addForm.brand || '', description: addForm.desc || '', videoUrl: addForm.url, urls: [addForm.url] };
    await persistPortfolio([...(pf || []), item]);
    setAddForm({ title: '', brand: '', desc: '', url: '' });
    setAddOpen(false);
    toast.success('Work added');
  };

  const removeWork = (idx) => { persistPortfolio((pf || []).filter((_, i) => i !== idx)); };

  const saveDetails = async () => {
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
        rate_card: { ...(pr.rate_card || {}), expected_payout: form.expectedPayout, payout_period: form.payoutPeriod },
        budget_range: form.budgetRange,
        portfolio: (pf || []).map((it) => (typeof it === 'string' ? it : (it.videoUrl || it.link || it.url || (Array.isArray(it.urls) && it.urls[0]) || ''))).filter(Boolean),
        portfolio_items: pf || [],
      };
      const r = await axios.put(`${API}/profile/creator`, payload);
      setData((d) => ({ ...d, profile: { ...payload } }));
      setEditing(false);
      toast.success('Profile saved' + (r.data ? ' — submitted for review' : ''));
    } catch { toast.error('Could not save profile'); }
    finally { setSaving(false); }
  };

  const p = data?.profile || {};
  // Show the website username/handle the admin assigns — never the creator's real name.
  const name = (data?.nickname || '').trim()
    || (data?.username ? `@${data.username}` : '')
    || (data?.public_creator_id || '').trim()
    || (fallbackName || '').trim()
    || 'Creator';
  const publicId = data?.public_creator_id || String(id || '').slice(0, 12);
  const age = p.age;
  const gender = p.gender ? String(p.gender).charAt(0).toUpperCase() : '';
  const ageGender = [age, gender].filter(Boolean).join('');
  const city = p.city || p.location || '';
  const country = p.country || 'India';
  const languages = Array.isArray(p.languages) ? p.languages : (p.languages ? [p.languages] : []);
  const priceNum = String(p.rate_card?.expected_payout || p.expectedPayout || '').replace(/[^0-9]/g, '');
  const avatar = assetUrl(localPhoto || data?.profile_photo || photo);
  const banner = assetUrl(localBanner || data?.banner || p.banner || '');
  const levelKey = LEVEL_LABEL[String(data?.level || '').toLowerCase()] ? String(data.level).toLowerCase() : 'new';
  const levelLabel = data?.level_label || LEVEL_LABEL[levelKey];
  const deliverables = Number(data?.deliverables_completed ?? p.deliverables_completed ?? 0);
  const realVids = (data?.portfolio || [])
    .map((it) => (typeof it === 'string' ? it : ((Array.isArray(it.urls) && it.urls[0]) || it.original_url || it.url || it.video || '')))
    .filter((u) => u && !String(u).startsWith('blob:'));
  const vids = realVids.length ? realVids : FALLBACK_VIDEOS.slice(0, 6);

  // All the signup-form details (stored under user.profile via extra="allow").
  const phone = [p.dialCode, p.phone].filter(Boolean).join(' ');
  const categoryTxt = p.customCategory || p.category || '';
  const skills = Array.isArray(p.skills) ? p.skills : (Array.isArray(data?.tags) ? data.tags : []);
  const social = p.social_links || {};
  const rc = p.rate_card || {};
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

  // Build each section's rows, then drop any section that ended up empty so the
  // Details tab never shows a wall of blank cards.
  const detailSections = [
    {
      title: 'Basic Information', Icon: User, bio: p.bio,
      rows: [
        Row('Full Name', p.fullName), Row('Age', p.age), Row('Gender', p.gender),
        Row('Body Type', p.bodyType), Row('Skin Tone', p.skinTone), Row('Primary Category', categoryTxt),
      ].filter(Boolean),
    },
    {
      title: 'Location & Contact', Icon: MapPin,
      rows: [
        Row('Country', p.country), Row('State', p.state), Row('City', p.city),
        Row('Pincode', p.pincode), Row('Phone', phone), Row('Address', p.address),
      ].filter(Boolean),
    },
    {
      title: 'Skills & Languages', Icon: Sparkles,
      rows: [
        Chips('Skills', skills), Chips('Languages', languages),
        ...Object.entries(social).map(([k, v]) => (v ? Row(cap(k), v) : null)),
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

  const content = (
      <div className="cpm" onClick={(e) => e.stopPropagation()}>
        <div className={`cpm-banner ${editable ? 'is-editable' : ''}`} style={banner ? { backgroundImage: `url(${banner})` } : undefined} onClick={editable ? () => bannerRef.current?.click() : undefined}>
          {asPage
            ? <button type="button" className="cpm-banner-back" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Back"><ChevronLeft size={20} /></button>
            : <button type="button" className="cpm-x" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close"><X size={18} /></button>}
          {editable && (
            <>
              <span className="cpm-banner-edit"><Camera size={15} /> {busy === 'banner' ? 'Uploading…' : 'Change banner'}</span>
              <input ref={bannerRef} type="file" accept="image/*" hidden onChange={onPickBanner} />
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
                  <button type="button" className="cpm-ghost" onClick={() => { setTab('videos'); setAddOpen(true); }}><Plus size={16} /> Add Work</button>
                  <button type="button" className="cpm-msg" onClick={() => { setTab('details'); setEditing(true); }}><Pencil size={15} /> Edit Profile</button>
                </>
              )
            ) : onEdit ? (
              <button type="button" className="cpm-msg" onClick={onEdit}><Pencil size={15} /> Edit Profile</button>
            ) : (
              <>
                {onMessage && <button type="button" className="cpm-msg" onClick={onMessage}><MessageSquare size={16} /> Send Message</button>}
                <button type="button" className={`cpm-save ${saved ? 'is-saved' : ''}`} onClick={() => setSaved((v) => !v)} aria-label={saved ? 'Saved' : 'Save'} title={saved ? 'Saved' : 'Save'}>
                  <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
                </button>
              </>
            )}
          </div>

          <h2 className="cpm-name">{name.replace('@', '')}</h2>
          <div className="cpm-id">ID: {publicId}{(city || country) ? ` · ${[city, country].filter(Boolean).join(', ')}` : ''}</div>

          <div className="cpm-stats">
            <span><strong>{deliverables}</strong> deliverables</span>
            <span><strong>{languages.length}</strong> languages</span>
            <span><strong className={`cpm-lvl ${levelKey}`}>{levelLabel}</strong> level</span>
            <span><strong>{priceNum ? inr(priceNum) : '—'}</strong> {priceNum ? 'per video' : 'rate'}</span>
          </div>

          <div className="cpm-tabs">
            <button type="button" className={tab === 'videos' ? 'on' : ''} onClick={() => setTab('videos')}>Videos</button>
            <button type="button" className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}>Details</button>
          </div>
        </div>

        <div className="cpm-tab-body">
          {loading ? <div className="cpm-empty">Loading…</div> : tab === 'videos' ? (
            editable ? (
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
                    <input ref={workRef} type="file" accept="video/*,image/*" hidden onChange={onPickWork} />
                    <div className="cpm-aw-fields">
                      <input placeholder="Title" value={addForm.title} onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))} />
                      <input placeholder="Brand (optional)" value={addForm.brand} onChange={(e) => setAddForm((f) => ({ ...f, brand: e.target.value }))} />
                      <textarea placeholder="Description (optional)" rows={2} value={addForm.desc} onChange={(e) => setAddForm((f) => ({ ...f, desc: e.target.value }))} />
                      <div className="cpm-aw-actions">
                        <button type="button" className="cpm-msg" onClick={saveWork}><Check size={15} /> Save work</button>
                        <button type="button" className="cpm-ghost" onClick={() => { setAddOpen(false); setAddForm({ title: '', brand: '', desc: '', url: '' }); }}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="cpm-vids">
                  {!addOpen && <button type="button" className="cpm-vid cpm-add-tile" onClick={() => setAddOpen(true)}><Plus size={26} /><span>Add Work</span></button>}
                  {(pf || []).map((it, i) => { const u = pfUrl(it); return u ? <VideoTile key={i} url={u} onRemove={() => removeWork(i)} /> : null; })}
                </div>
              </>
            ) : (
              <div className="cpm-vids">{vids.slice(0, 12).map((v, i) => <VideoTile key={i} url={v} />)}</div>
            )
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
                      <label>Can Bring<input {...fld('bring')} /></label>
                      <Sel label="Weekly Availability" value={form.weekly} onChange={set('weekly')} options={WEEKLY_OPTS} />
                    </div>
                    <label className="cpm-ef-check"><input type="checkbox" checked={!!form.flexible} onChange={(e) => setForm((f) => ({ ...f, flexible: e.target.checked }))} /> Flexible working hours</label>

                    <h5 className="cpm-ef-sec">Pricing</h5>
                    <div className="cpm-ef-grid">
                      <label>Expected Payout<input {...fld('expectedPayout')} /></label>
                      <Sel label="Payout Period" value={form.payoutPeriod} onChange={set('payoutPeriod')} options={PAYOUT_PERIODS} />
                      <label>Budget Range<input {...fld('budgetRange')} /></label>
                    </div>
                  </>
                );
              })()}
              <p className="cpm-ef-note">Saving updates your profile and re-submits it for admin review.</p>
            </div>
          ) : detailSections.length === 0 ? (
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
        </div>

        {onBegin && (
          <div className="cpm-foot">
            <div className="cpm-foot-text"><span>🧑‍🎤</span><div><strong>Ready to Get Started?</strong><p>Send a brief to start work instantly and stay on track.</p></div></div>
            <button type="button" className="cpm-begin" onClick={onBegin}>Send a Brief</button>
          </div>
        )}

      <style>{`
        .cpm-ov{position:fixed;inset:0;background:rgba(15,22,58,.5);backdrop-filter:blur(3px);z-index:1400;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto}
        .cpm{position:relative;width:min(980px,100%);background:#fff;border-radius:22px;box-shadow:0 30px 70px rgba(15,22,58,.4);overflow:hidden}
        .cpm-page .cpm{width:100%;max-width:none;margin:0;box-shadow:none;border:none;border-radius:0}
        .cpm-banner{position:relative;height:190px;background:linear-gradient(120deg,#5b6bff,#8b5cf6 55%,#4452f0);background-size:cover;background-position:center}
        .cpm-x,.cpm-banner-back{position:absolute;width:38px;height:38px;border-radius:50%;border:none;background:rgba(255,255,255,.92);color:#15163a;cursor:pointer;display:grid;place-items:center;z-index:2;box-shadow:0 4px 14px rgba(15,22,58,.25)}
        .cpm-x{top:16px;right:16px}
        .cpm-banner-back{top:16px;left:16px}
        .cpm-phead{position:relative;padding:0 28px 20px}
        .cpm-avatar-wrap{position:relative;width:108px;height:108px;margin-top:-54px}
        .cpm-avatar-lg{box-sizing:border-box;display:grid;place-items:center;width:108px;height:108px;border-radius:50%;border:4px solid #fff;overflow:hidden;background:linear-gradient(135deg,#5b6bff,#8b5cf6);color:#fff;font-weight:800;font-size:38px;box-shadow:0 8px 22px -8px rgba(15,22,58,.4)}
        .cpm-avatar-lg img{width:100%;height:100%;object-fit:cover}
        .cpm-actions{position:absolute;right:28px;top:122px;display:flex;align-items:center;gap:10px}
        .cpm-msg{display:inline-flex;align-items:center;gap:8px;background:#15163a;color:#fff;border:none;border-radius:30px;padding:11px 20px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit}
        .cpm-msg:hover{filter:brightness(1.12)}
        .cpm-save{width:44px;height:44px;border-radius:50%;border:1px solid #e6e8f3;background:#fff;color:#585c7e;cursor:pointer;display:grid;place-items:center}
        .cpm-save:hover{border-color:#cdd4ff;color:#4452f0}
        .cpm-save.is-saved{background:#eef0ff;border-color:#cdd4ff;color:#4452f0}
        .cpm-name{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:25px;font-weight:800;color:#15163a;margin:12px 0 2px}
        .cpm-id{color:#9296ba;font-size:13px;font-weight:600}
        .cpm-stats{display:flex;flex-wrap:wrap;gap:8px 28px;margin-top:16px}
        .cpm-stats span{color:#9296ba;font-size:12.5px;font-weight:600}
        .cpm-stats strong{color:#15163a;font-size:17px;font-weight:800;margin-right:4px}
        .cpm-lvl{padding:2px 10px;border-radius:20px;color:#fff!important;font-size:13px!important}
        .cpm-lvl.elite{background:linear-gradient(135deg,#8b5cf6,#5b6bff)}
        .cpm-lvl.l2{background:linear-gradient(135deg,#5b6bff,#4452f0)}
        .cpm-lvl.l1{background:linear-gradient(135deg,#2f8de0,#56b8ff)}
        .cpm-lvl.verified{background:linear-gradient(135deg,#2bd47e,#15a35b)}
        .cpm-lvl.new{background:#6b7090}
        .cpm-tabs{display:flex;gap:26px;border-bottom:1px solid #eef0f6;margin-top:20px}
        .cpm-tabs button{background:none;border:none;padding:10px 2px;font-size:15px;font-weight:700;color:#9296ba;cursor:pointer;font-family:inherit;border-bottom:2.5px solid transparent;margin-bottom:-1px}
        .cpm-tabs button.on{color:#15163a;border-bottom-color:#5b6bff}
        .cpm-tab-body{padding:22px 28px 4px}
        .cpm-vids{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px}
        .cpm-vid{position:relative;aspect-ratio:3/4;border-radius:14px;overflow:hidden;background:#0b1020;cursor:pointer;box-shadow:0 8px 22px -12px rgba(15,22,58,.4)}
        .cpm-vid video,.cpm-vid img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .cpm-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.85);display:grid;place-items:center;color:#5b6bff;pointer-events:none}
        .cpm-empty{text-align:center;color:#9296ba;padding:30px 0;font-size:14px}
        /* editable */
        .cpm-ghost{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #e6e8f3;color:#15163a;border-radius:30px;padding:10px 18px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit}
        .cpm-ghost:hover{border-color:#cdd4ff;color:#4452f0;background:#f6f7ff}
        .cpm-banner.is-editable{cursor:pointer}
        .cpm-banner-edit{position:absolute;right:16px;bottom:14px;display:inline-flex;align-items:center;gap:6px;background:rgba(15,22,58,.55);color:#fff;font-size:12px;font-weight:600;padding:6px 12px;border-radius:20px;backdrop-filter:blur(4px)}
        .cpm-avatar-lg.is-editable{cursor:pointer}
        .cpm-avatar-cam{position:absolute;right:2px;bottom:2px;width:30px;height:30px;border:2px solid #fff;border-radius:50%;background:#15163a;color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 2px 6px rgba(15,22,58,.3);z-index:2}
        .cpm-vid-del{position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;border:none;background:rgba(15,22,58,.6);color:#fff;display:grid;place-items:center;cursor:pointer;z-index:3}
        .cpm-vid-del:hover{background:#e5484d}
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
        .cpm-sections{display:flex;flex-direction:column;gap:14px}
        .cpm-sections section{border:1px solid #eef0f6;border-radius:16px;padding:18px 20px;background:#fff;box-shadow:0 1px 2px rgba(15,22,58,.04)}
        .cpm-sec-h{display:flex;align-items:center;gap:10px;margin-bottom:14px}
        .cpm-sec-ic{flex:none;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#eef0ff;color:#5b6bff}
        .cpm-sections h4{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:13px;font-weight:800;color:#15163a;text-transform:uppercase;letter-spacing:.5px;margin:0}
        .cpm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}
        .cpm-f{display:flex;flex-direction:column;gap:3px;min-width:0}
        .cpm-f.wide{grid-column:1/-1}
        .cpm-f label{font-size:11px;font-weight:700;color:#9296ba;text-transform:uppercase;letter-spacing:.3px}
        .cpm-f span{font-size:14px;color:#15163a;font-weight:600;overflow-wrap:anywhere}
        .cpm-chips{display:flex;flex-wrap:wrap;gap:6px}
        .cpm-chips span{background:#eef0ff;color:#5b6bff;font-size:12px;font-weight:600;padding:3px 10px;border-radius:14px}
        .cpm-bio{margin:12px 0 0;color:#585c7e;font-size:13.5px;line-height:1.55}
        .cpm-foot{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:18px 28px 24px;padding:16px 18px;background:#eef0ff;border:1px solid #dfe2ff;border-radius:16px}
        .cpm-foot-text{display:flex;align-items:center;gap:10px;flex:1;min-width:200px}
        .cpm-foot-text span{font-size:22px}
        .cpm-foot-text strong{display:block;color:#15163a;font-size:15px}
        .cpm-foot-text p{margin:2px 0 0;color:#585c7e;font-size:12.5px}
        .cpm-begin{background:linear-gradient(100deg,#5b6bff,#4452f0);color:#fff;border:none;border-radius:30px;padding:11px 22px;font-weight:800;font-size:13.5px;cursor:pointer;font-family:inherit}
        .cpm-begin:hover{filter:brightness(1.06)}
        @media(max-width:640px){
          .cpm-actions{position:static;margin-top:12px}
          .cpm-msg{flex:1}
        }
      `}</style>
      </div>
  );

  if (asPage) return <div className="cpm-page">{content}</div>;
  return <div className="cpm-ov" onClick={onClose}>{content}</div>;
}
