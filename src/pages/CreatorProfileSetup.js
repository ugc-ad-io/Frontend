import { useState, useRef, useMemo, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { useAuth } from '../App';
import { ImagePlus, ChevronDown, X, ArrowRight, ArrowLeft, User, Play, Plus, Instagram, Check, Trash2, Pencil,
  PersonStanding, Dumbbell, Circle, Palette, PenLine, Mic, Drama, Video, Clapperboard, Sparkles, Camera,
  Aperture, VolumeX, Lightbulb, Square, Image as ImageIcon, Users, UsersRound, PawPrint, Globe, Info,
  PartyPopper, Upload, Music2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CONTENT_CATEGORIES, resolveCategory } from '../constants/contentCategories';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// ── Step config ────────────────────────────────────────────────────────────
// Sign Up is the (already-done) step 1, so these display as steps 2..N+1.
// Steps 1-3 are built; step 4 is a stub until its design arrives.
const STEP_META = [
  { title: 'Profile Basics', sub: 'Just the essentials to get your creator profile started.' },
  { title: 'Contact Information', sub: 'We use this to communicate about projects and payments.' },
  { title: 'Build Your Creator Portfolio', sub: 'This is the profile brands will see when shortlisting creators. Add what shows your experience best.' },
  { title: 'Recording Setup & Equipment', sub: 'Select what you have access to. This helps brands match you with the right projects.' },
];
const TOTAL_STEPS = STEP_META.length;

// Contact step option lists (static for now — swap for an API later).
// `iso` drives the flag image (flagcdn.com) — emoji flags don't render on Windows.
const DIAL_CODES = [
  { code: '+91', iso: 'in' },
  { code: '+1', iso: 'us' },
  { code: '+44', iso: 'gb' },
  { code: '+61', iso: 'au' },
];
const flagUrl = (iso) => `https://flagcdn.com/24x18/${iso}.png`;
const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany'];
// All 28 states + 8 union territories of India.
const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
// Major cities per state/UT — the City dropdown is populated from the chosen State.
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

const GENDERS = ['Male', 'Female', 'Other'];

const BODY_TYPES = [
  { label: 'Average', icon: <PersonStanding size={16} /> },
  { label: 'Slim', icon: <PersonStanding size={16} /> },
  { label: 'Athletic', icon: <Dumbbell size={16} /> },
  { label: 'Plus Size', icon: <PersonStanding size={16} /> },
  { label: 'No Preference', none: true },
];

// Skin tone uses coloured swatches (lucide is monochrome, so a filled Circle
// communicates the tone where a person glyph couldn't).
const SKIN_TONES = [
  { label: 'Fair', icon: <Circle size={15} fill="#F2D2BD" color="#F2D2BD" /> },
  { label: 'Brown', icon: <Circle size={15} fill="#A56A43" color="#A56A43" /> },
  { label: 'Dark', icon: <Circle size={15} fill="#5C3A21" color="#5C3A21" /> },
  { label: 'No preference', icon: <Palette size={16} /> },
];

// ── Step 4 — Build Your Creator Portfolio ──────────────────────────────────
const SKILLS = [
  { label: 'Script Writing', icon: <PenLine size={16} /> },
  { label: 'Voiceovers', icon: <Mic size={16} /> },
  { label: 'Acting', icon: <Drama size={16} /> },
  { label: 'Videography (DOP)', icon: <Video size={16} /> },
  { label: 'Video Editing', icon: <Clapperboard size={16} /> },
  { label: 'Modelling', icon: <Sparkles size={16} /> },
];
const PLATFORMS = [
  { key: 'youtube', label: 'YouTube', badge: '▶', color: '#FF0000' },
  { key: 'linkedin', label: 'LinkedIn', badge: 'in', color: '#0A66C2' },
  { key: 'instagram', label: 'Instagram', Icon: Instagram, color: 'linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5)' },
  { key: 'tiktok', label: 'TikTok', Icon: Music2, color: '#111111' },
];
// Platform link validators — only accept genuine links/handles for each network,
// so a creator can't paste a random website where a specific profile is asked.
const LINK_RE = {
  youtube:   /^(https?:\/\/)?(www\.)?(youtube\.com\/(@[\w.-]+|channel\/|c\/|user\/)[\w./-]*|youtu\.be\/[\w-]+)\/?$/i,
  linkedin:  /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company|pub|school)\/[\w%.-]+\/?$/i,
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/[a-z0-9._]+\/?$|^@?[a-z0-9._]{1,30}$/i,
  tiktok:    /^(https?:\/\/)?(www\.)?tiktok\.com\/@?[\w.-]+\/?$|^@?[a-z0-9._]{1,30}$/i,
  facebook:  /^(https?:\/\/)?(www\.|m\.)?(facebook\.com|fb\.com|fb\.me)\/[^\s]+$/i,
  twitter:   /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/[a-z0-9_]{1,15}\/?$|^@?[a-z0-9_]{1,15}$/i,
  // Website / custom platforms: at least a real URL or a @handle, not gibberish.
  generic:   /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#][^\s]*)?$|^@?[a-z0-9._]{1,30}$/i,
};
// Map a platform label (from PLATFORMS or a user-added link) to a validator key.
const platformKey = (label) => {
  const s = String(label || '').toLowerCase();
  if (s.includes('youtube')) return 'youtube';
  if (s.includes('linkedin')) return 'linkedin';
  if (s.includes('instagram')) return 'instagram';
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('facebook')) return 'facebook';
  if (s.includes('twitter') || s === 'x' || s.startsWith('x ')) return 'twitter';
  return 'generic'; // website / custom
};
// Returns an error string if a filled link doesn't match its platform (empty is OK).
const linkError = (label, value) => {
  const v = String(value || '').trim();
  if (!v) return '';
  return LINK_RE[platformKey(label)].test(v) ? '' : `Enter a valid ${label} link or handle`;
};

// Picker options for "Add another social link".
const ADD_PLATFORMS = ['YouTube', 'Facebook', 'X (Twitter)', 'Website', 'Custom'];
const badgeFor = (label) => ({
  'YouTube': { c: '▶', bg: '#FF0000' },
  'Facebook': { c: 'f', bg: '#1877F2' },
  'X (Twitter)': { c: '𝕏', bg: '#111111' },
  'Website': { c: <Globe size={15} color="#fff" />, bg: '#6d28d9' },
}[label] || { c: (label || '?').charAt(0).toUpperCase(), bg: '#07074e' });
const LANGUAGES = ['English', 'Hindi', 'Bengali', 'Marathi', 'Tamil', 'Telugu', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi', 'Bhojpuri'];
const WEEKLY = ['1–5 hrs / week', '6–10 hrs / week', '11–20 hrs / week', '20+ hrs / week'];
const TOPICS = ['None', 'Alcohol', 'Gambling', 'Adult products'];
const PAYOUT_PERIODS = ['Per Video'];
// Step 5 — Recording Setup & Equipment
const CORE_SETUP = [
  { label: 'DSLR Camera', icon: <Camera size={16} /> },
  { label: 'Iphone', icon: <img src="https://cdn.simpleicons.org/apple/ffffff" alt="" width={15} height={15} /> },
  { label: 'Android Phone', icon: <img src="https://cdn.simpleicons.org/android/3DDC84" alt="" width={16} height={16} /> },
  { label: 'Tripod / Stable mount', icon: <Aperture size={16} /> },
  { label: 'External microphone', icon: <Mic size={16} /> },
  { label: 'Quiet / noise-controlled room', icon: <VolumeX size={16} /> },
  { label: 'Artificial lighting', icon: <Lightbulb size={16} /> },
  { label: 'Green screen', icon: <Square size={16} fill="#22C55E" color="#22C55E" /> },
  { label: 'Aesthetic background', icon: <ImageIcon size={16} /> },
];
const APPEAR_IN = [
  { label: 'Solo only', icon: <User size={16} /> },
  { label: 'Friends / peers', icon: <Users size={16} /> },
  { label: 'Family members', icon: <UsersRound size={16} /> },
  { label: 'Pets / animals', icon: <PawPrint size={16} /> },
];
const ADDONS = [
  { key: 'ownAccount', title: 'Post content from your own account', note: 'Includes organic posts or collab posts.', yes: 'Yes, I can post from my account' },
  { key: 'runAds', title: 'Run ads via your account (Collab / Branded Ads)', note: 'Only for brand-approved, paid collaborations.', yes: "Yes, I'm open to running ads" },
  { key: 'newAccount', title: 'Create a new account for a brand', note: 'For brands that need a fresh account for campaigns.', yes: 'Yes, I can set up an account' },
];

// Required fields per step — every one must be filled to proceed, and each filled
// field nudges the completion ring up. (mapLink stays optional.) Add a step's array
// here as you build it so it counts toward completion + validation automatically.
const STEP1_FIELDS = ['fullName', 'age', 'gender', 'bodyType', 'skinTone']; // photo is optional
const STEP2_FIELDS = ['phone', 'pincode', 'country', 'state', 'city', 'address'];
const STEP_FIELDS = { 1: STEP1_FIELDS, 2: STEP2_FIELDS };
const isFilled = (v) => String(v ?? '').trim() !== '';

// Indian PIN codes: the first digit is a postal zone mapping to a group of states.
// A gross cross-zone mismatch (e.g. a Kerala PIN with Himachal selected) is rejected;
// same-zone neighbours are allowed (finer precision would false-reject valid PINs).
const STATE_ZONE = {
  'Delhi': '1', 'Haryana': '1', 'Punjab': '1', 'Himachal Pradesh': '1', 'Jammu and Kashmir': '1', 'Ladakh': '1', 'Chandigarh': '1',
  'Uttar Pradesh': '2', 'Uttarakhand': '2',
  'Rajasthan': '3', 'Gujarat': '3', 'Dadra and Nagar Haveli and Daman and Diu': '3',
  'Chhattisgarh': '4', 'Madhya Pradesh': '4', 'Maharashtra': '4', 'Goa': '4',
  'Andhra Pradesh': '5', 'Telangana': '5', 'Karnataka': '5',
  'Kerala': '6', 'Tamil Nadu': '6', 'Puducherry': '6', 'Lakshadweep': '6',
  'West Bengal': '7', 'Odisha': '7', 'Arunachal Pradesh': '7', 'Assam': '7', 'Manipur': '7', 'Meghalaya': '7', 'Mizoram': '7', 'Nagaland': '7', 'Tripura': '7', 'Sikkim': '7', 'Andaman and Nicobar Islands': '7',
  'Bihar': '8', 'Jharkhand': '8',
};
const pinZoneMismatch = (pincode, state, country) => {
  if (country && !/india/i.test(country)) return false;
  const pin = String(pincode || '').replace(/\D/g, '');
  if (pin.length < 6) return false;               // only validate a complete 6-digit PIN
  const zone = STATE_ZONE[state];
  if (!zone) return false;                          // unknown state → don't block
  return pin[0] !== zone;
};

// Custom dial-code picker that shows real flag images (native <option> can't).
function DialCodeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const sel = DIAL_CODES.find((d) => d.code === value) || DIAL_CODES[0];
  return (
    <div className="ps-dial" ref={ref}>
      <button type="button" className="ps-dial__btn" onClick={() => setOpen((o) => !o)}>
        <img src={flagUrl(sel.iso)} alt="" className="ps-dial__flag" />
        <span>{sel.code}</span>
        <ChevronDown size={16} className="ps-dial__chev" />
      </button>
      {open && (
        <div className="ps-dial__menu">
          {DIAL_CODES.map((d) => (
            <button
              key={d.code}
              type="button"
              className={`ps-dial__opt${d.code === value ? ' ps-dial__opt--on' : ''}`}
              onClick={() => { onChange(d.code); setOpen(false); }}
            >
              <img src={flagUrl(d.iso)} alt="" className="ps-dial__flag" />
              <span>{d.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Per-language fluency picker shown on a selected language chip.
const FLUENCY = ['Native', 'Fluent', 'Conversational'];
function FluencyMenu({ value, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  return (
    <div className="ps-flu" ref={ref}>
      <button type="button" className="ps-flu__btn" onClick={() => setOpen((o) => !o)}>
        {value || 'Fluency'}
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && (
        <div className="ps-flu__menu">
          {FLUENCY.map((f) => (
            <button
              key={f}
              type="button"
              className={`ps-flu__opt${value === f ? ' ps-flu__opt--on' : ''}`}
              onClick={() => { onPick(f); setOpen(false); }}
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CreatorProfileSetup() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const fileRef = useRef(null);
  const linkRefs = useRef({}); // per-platform input refs, to focus on "+Add social link"
  const [step, setStep] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const [customOpen, setCustomOpen] = useState({});   // which "Other" inputs are open
  const [customDraft, setCustomDraft] = useState({});  // their draft text
  const [addOpen, setAddOpen] = useState(false);       // "Add another social link" picker
  const [addPlatform, setAddPlatform] = useState('YouTube');
  const [customPlatform, setCustomPlatform] = useState('');
  const extraIdRef = useRef(0);
  const [submitting, setSubmitting] = useState(false);     // Submit Application in progress
  const [submitted, setSubmitted] = useState(false);       // show the thank-you card
  const [editingId, setEditingId] = useState(null);        // portfolio item being edited
  const [editDraft, setEditDraft] = useState({ brand: '', desc: '' });
  const [justAddedId, setJustAddedId] = useState(null);    // shows the "Added" badge
  const pfIdRef = useRef(0);
  const brandRef = useRef(null);
  const [data, setData] = useState({
    photoPreview: '',
    fullName: '',
    age: '',
    gender: '',
    category: '',         // primary UGC content category (work-distribution tag)
    customCategory: '',
    bodyType: '',
    skinTone: '',
    // Step 2 — Contact Information
    dialCode: '+91',
    phone: '',
    pincode: '',
    country: '',
    state: '',
    city: '',
    address: '',
    mapLink: '',
    // Step 4 — Build Your Creator Portfolio
    skills: [],
    links: { youtube: '', linkedin: '', instagram: '', tiktok: '' },
    followers: { youtube: '', linkedin: '', instagram: '', tiktok: '' },
    showFollowers: { youtube: false, linkedin: false, instagram: false, tiktok: false },
    extraLinks: [], // user-added social links: { id, platform, url }
    ownAccount: '',
    runAds: '',
    newAccount: '',
    portfolio: [],
    pfBrand: '', pfDesc: '', pfLink: '', pfVideo: '', pfVideoUrl: '',
    languages: [],
    langFluency: {}, // { language: 'Native' | 'Fluent' | 'Conversational' }
    // Step 5 — Recording Setup & Equipment
    coreSetup: [],
    appearIn: [],
    bring: '',
    weekly: '',
    flexible: false,
    lastSalary: '', expectedPayout: '', payoutPeriod: 'Per Video',
    topics: ['None'],
    profile_picture: '', // real uploaded URL (photoPreview is just the local/preview src)
    profile_banner: '',  // optional cover/banner image URL (bannerPreview is the preview src)
  });
  const [photoUploading, setPhotoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerRef = useRef(null);
  const pfFileRef = useRef(null);

  // Paint html/#root/body the same lavender as this page while it's mounted, so
  // the backdrop / overscroll matches the light-purple theme; restore on unmount.
  useEffect(() => {
    const root = document.getElementById('root');
    const targets = [document.documentElement, document.body, root].filter(Boolean);
    const prev = targets.map((el) => el.style.background);
    targets.forEach((el) => { el.style.background = '#0a0a16'; });
    return () => { targets.forEach((el, i) => { el.style.background = prev[i]; }); };
  }, []);

  const set = (field, value) => setData((d) => ({ ...d, [field]: value }));
  // Toggle a value in an array field (multi-select chips).
  const toggleIn = (field, value) => setData((d) => {
    const arr = d[field];
    return { ...d, [field]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] };
  });
  // "None" topic is exclusive; picking any other clears None.
  const toggleTopic = (t) => setData((d) => {
    if (t === 'None') return { ...d, topics: ['None'] };
    const rest = d.topics.filter((x) => x !== 'None');
    return { ...d, topics: rest.includes(t) ? rest.filter((x) => x !== t) : [...rest, t] };
  });
  const setLink = (key, value) => setData((d) => ({ ...d, links: { ...d.links, [key]: value } }));
  const setFollowers = (key, value) => setData((d) => ({ ...d, followers: { ...d.followers, [key]: value } }));
  const toggleFollowers = (key) => setData((d) => ({ ...d, showFollowers: { ...d.showFollowers, [key]: !d.showFollowers[key] } }));
  const addPortfolio = () => {
    if (!isFilled(data.pfBrand) && !isFilled(data.pfLink) && !isFilled(data.pfVideo)) return;
    const id = `p${pfIdRef.current++}`;
    setData((d) => ({ ...d, portfolio: [...d.portfolio, { id, brand: d.pfBrand, desc: d.pfDesc, link: d.pfLink, video: d.pfVideo, videoUrl: d.pfVideoUrl }], pfBrand: '', pfDesc: '', pfLink: '', pfVideo: '', pfVideoUrl: '' }));
    setJustAddedId(id);
    setEditingId(null);
  };
  const startModify = (item) => { setEditingId(item.id); setEditDraft({ brand: item.brand, desc: item.desc }); setJustAddedId(null); };
  const cancelModify = () => setEditingId(null);
  const saveModify = () => {
    setData((d) => ({ ...d, portfolio: d.portfolio.map((it) => (it.id === editingId ? { ...it, brand: editDraft.brand, desc: editDraft.desc } : it)) }));
    setEditingId(null);
  };
  const deleteItem = (id) => {
    setData((d) => ({ ...d, portfolio: d.portfolio.filter((it) => it.id !== id) }));
    setEditingId((e) => (e === id ? null : e));
    setJustAddedId((j) => (j === id ? null : j));
  };
  // Extra social links.
  const closeAddSocial = () => { setAddOpen(false); setAddPlatform('YouTube'); setCustomPlatform(''); };
  const addSocial = () => {
    const label = addPlatform === 'Custom' ? customPlatform.trim() : addPlatform;
    if (!label) return;
    const id = `x${extraIdRef.current++}`;
    setData((d) => ({ ...d, extraLinks: [...d.extraLinks, { id, platform: label, url: '' }] }));
    closeAddSocial();
  };
  const setFluency = (lang, v) => setData((d) => ({ ...d, langFluency: { ...d.langFluency, [lang]: v } }));
  const setExtraUrl = (id, value) => setData((d) => ({ ...d, extraLinks: d.extraLinks.map((l) => (l.id === id ? { ...l, url: value } : l)) }));
  const removeExtra = (id) => setData((d) => ({ ...d, extraLinks: d.extraLinks.filter((l) => l.id !== id) }));
  // Custom "Other" entries (skills / languages / topics).
  const openCustom = (key) => setCustomOpen((o) => ({ ...o, [key]: !o[key] }));
  const setDraft = (key, v) => setCustomDraft((d) => ({ ...d, [key]: v }));
  const addCustom = (field) => {
    const v = (customDraft[field] || '').trim();
    if (!v) return;
    setData((d) => {
      if (field === 'topics') {
        const rest = d.topics.filter((x) => x !== 'None');
        return rest.includes(v) ? d : { ...d, topics: [...rest, v] };
      }
      return d[field].includes(v) ? d : { ...d, [field]: [...d[field], v] };
    });
    setDraft(field, '');
  };

  // Required-field checks per step → { key: boolean }. Steps with no requirements
  // (stubs) return {} and count as complete.
  const checksFor = (s) => {
    const f = STEP_FIELDS[s];
    if (f) {
      const base = Object.fromEntries(f.map((k) => [k, isFilled(data[k])]));
      if (s === 2) base.pincode = base.pincode && !pinZoneMismatch(data.pincode, data.state, data.country);
      return base;
    }
    if (s === 3) return {
      skills: data.skills.length > 0,
      profileLink: PLATFORMS.some((p) => isFilled(data.links[p.key])) || data.extraLinks.some((l) => isFilled(l.url)),
      // Every link that IS filled must be a genuine link for its platform.
      linksValid: PLATFORMS.every((p) => !linkError(p.label, data.links[p.key]))
        && data.extraLinks.every((l) => !linkError(l.platform, l.url)),
      portfolio: data.portfolio.length > 0,
      languages: data.languages.length > 0,
      expectedPayout: isFilled(data.expectedPayout),
    };
    return {};
  };

  // Completion includes optional fields too (e.g. the skippable final step), so the
  // ring can still reach 100% — kept separate from the required checks above.
  const completionFor = (s) => (s === TOTAL_STEPS
    ? { coreSetup: data.coreSetup.length > 0, appearIn: data.appearIn.length > 0 }
    : checksFor(s));

  // Field-granular completion: Sign Up counts as 1 done step; every other step adds
  // its filled-check fraction, so each detail the user fills nudges the ring up live.
  const percent = useMemo(() => {
    let credit = 1;
    for (let s = 1; s <= TOTAL_STEPS; s++) {
      const vals = Object.values(completionFor(s));
      if (vals.length) credit += vals.filter(Boolean).length / vals.length;
    }
    return Math.round((credit / (TOTAL_STEPS + 1)) * 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const checks = checksFor(step);
  const stepComplete = Object.values(checks).every(Boolean);

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large. Maximum 5MB.');
      return;
    }
    // Show an instant local preview, then upload so a real URL is persisted (the admin
    // panel can only display an uploaded URL — a local blob: ref is useless server-side).
    set('photoPreview', URL.createObjectURL(file));
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/upload/file`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      let url = res.data?.file_url || res.data?.url;
      if (url && url.startsWith('/')) url = `${BACKEND_URL}${url}`;
      if (url) {
        // Store under profile_picture — the canonical field the backend/app reads for avatars.
        setData((d) => ({ ...d, profile_picture: url, photoPreview: url }));
      } else {
        toast.error('Photo upload failed. Please try again.');
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Photo upload failed'));
    } finally {
      setPhotoUploading(false);
    }
  };
  const onPickBanner = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large. Maximum 5MB.');
      return;
    }
    set('bannerPreview', URL.createObjectURL(file));
    setBannerUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/upload/file`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      let url = res.data?.file_url || res.data?.url;
      if (url && url.startsWith('/')) url = `${BACKEND_URL}${url}`;
      if (url) {
        setData((d) => ({ ...d, profile_banner: url, banner: url, bannerPreview: url }));
        // Persist immediately via the dedicated banner endpoint (stored under `banner`).
        await axios.patch(`${API}/profile/banner`, { banner: url }).catch(() => {});
      } else {
        toast.error('Banner upload failed. Please try again.');
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Banner upload failed'));
    } finally {
      setBannerUploading(false);
    }
  };
  const onPickVideo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video is too large. Maximum 50MB.');
      return;
    }
    // Show an instant local preview, then upload so a real server URL is persisted
    // (a local blob: ref is useless once the session ends — the portfolio page can
    // only display an uploaded URL).
    setData((d) => ({ ...d, pfVideo: file.name, pfVideoUrl: URL.createObjectURL(file) }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/upload/file`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      let url = res.data?.file_url || res.data?.url;
      if (url && url.startsWith('/')) url = `${BACKEND_URL}${url}`;
      if (url) {
        setData((d) => ({ ...d, pfVideoUrl: url }));
      } else {
        toast.error('Video upload failed. Please try again.');
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Video upload failed'));
    }
  };

  const back = () => { setShowErrors(false); setStep((s) => Math.max(1, s - 1)); };
  const proceed = () => {
    if (!stepComplete) {
      // Reveal "This field is required" under every empty field, then scroll to the
      // FIRST incomplete one (not the top) so the user lands right on what to fix.
      setShowErrors(true);
      setTimeout(() => {
        const el = document.querySelector(
          '.ps-card .ps-input--error, .ps-card .ps-chips--error, .ps-card .ps-perm--error, .ps-card .ps-error'
        );
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      return;
    }
    setShowErrors(false);
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Final step → persist the creator profile to the backend, then show success.
      setSubmitting(true);
      // Map the form state to the backend's CreatorProfileUpdate fields (tags/social_links/etc.)
      // while keeping all the extra details (name, contact, equipment, languages, ...) — the
      // backend now stores extras too. This populates the model fields so the app can read them
      // consistently, and satisfies the required-ish fields so the submit doesn't 422.
      const creatorPayload = {
        ...data,
        category: resolveCategory(data.category, data.customCategory),
        bio: data.bio || '',
        tags: data.skills || [],
        // Deployed backend types portfolio as List[str] — sending the raw objects 422s. Send
        // string refs here; keep the full structured items under a separate (extra) key.
        portfolio: (data.portfolio || [])
          .map((p) => p.link || p.video || p.videoUrl || p.brand || '')
          .filter(Boolean),
        portfolio_items: data.portfolio || [],
        social_links: {
          ...Object.fromEntries(Object.entries(data.links || {}).filter(([, v]) => v && v.trim())),
          ...Object.fromEntries(
            (data.extraLinks || [])
              .filter((l) => l.url && l.url.trim())
              .map((l) => [String(l.platform || 'link').toLowerCase(), l.url])
          ),
        },
        rate_card: {
          last_salary: data.lastSalary || '',
          expected_payout: data.expectedPayout || '',
          payout_period: data.payoutPeriod || '',
        },
        availability_calendar: { weekly: data.weekly || '', flexible: !!data.flexible },
        payment_methods: {},
        receive_briefs: true,
        terms_agreed: true,
      };
      (async () => {
        try {
          await axios.put(`${API}/profile/creator`, creatorPayload);
          setUser({ ...user, profile_completed: true, approval_status: 'pending' });
          setSubmitted(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
          toast.error(apiErrorMessage(error, 'Failed to submit profile'));
        } finally {
          setSubmitting(false);
        }
      })();
    }
  };

  const meta = STEP_META[step - 1];
  // A field shows its error only after the user tries to proceed with it incomplete.
  const err = (k) => showErrors && checks[k] === false;
  const reqError = (f) => (err(f) ? <span className="ps-error">This field is required</span> : null);

  // Custom chips (user-added values not in the predefined list) + the "Other" toggle.
  const customTail = (field, predefined, label) => (
    <>
      {data[field].filter((v) => !predefined.includes(v)).map((v) => (
        <button
          key={v}
          type="button"
          className="ps-chip ps-chip--on"
          onClick={() => (field === 'topics' ? toggleTopic(v) : toggleIn(field, v))}
        >
          {v} <X size={13} />
        </button>
      ))}
      <button
        type="button"
        className={`ps-chip ps-chip--add${customOpen[field] ? ' ps-chip--add-on' : ''}`}
        onClick={() => openCustom(field)}
      >
        <Plus size={15} /> {label}
      </button>
    </>
  );
  // The reveal-on-click input row for adding a custom value.
  const customInput = (field, placeholder) => customOpen[field] && (
    <div className="ps-custom">
      <div className="ps-custom__row">
        <input
          className="ps-input"
          placeholder={placeholder}
          value={customDraft[field] || ''}
          onChange={(e) => setDraft(field, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(field); } }}
          autoFocus
        />
        <button type="button" className="ps-custom__add" onClick={() => addCustom(field)}>Add</button>
      </div>
      <p className="ps-custom__hint">Press <strong>Enter</strong> to add quickly.</p>
    </div>
  );

  const renderStep = () => {
    if (step === 1) {
      return (
        <>
          {/* Profile photo + banner, side by side */}
          <div className="ps-upload-row">
            {/* Photo upload (optional) */}
            <div className="ps-field">
              <button type="button" className="ps-upload" onClick={() => fileRef.current?.click()}>
                <span className="ps-upload__icon">
                  {data.photoPreview
                    ? <img src={data.photoPreview} alt="" className="ps-upload__preview" />
                    : <ImagePlus size={22} />}
                </span>
                <span className="ps-upload__text">
                  <span className="ps-upload__title">
                    {photoUploading ? 'Uploading…' : (data.photoPreview ? 'Change profile photo' : 'Upload profile photo')}
                  </span>
                  <span className="ps-upload__hint">Allowed images · Max 5MB</span>
                </span>
                <span className="ps-upload__cta">{photoUploading ? 'Wait…' : 'Browse'}</span>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
              </button>
            </div>

            {/* Banner upload (optional) */}
            <div className="ps-field">
              <button type="button" className="ps-upload" onClick={() => bannerRef.current?.click()}>
                <span className="ps-upload__icon">
                  {data.bannerPreview
                    ? <img src={data.bannerPreview} alt="" className="ps-upload__preview" />
                    : <ImagePlus size={22} />}
                </span>
                <span className="ps-upload__text">
                  <span className="ps-upload__title">
                    {bannerUploading ? 'Uploading…' : (data.bannerPreview ? 'Change banner image' : 'Upload banner image')}
                  </span>
                  <span className="ps-upload__hint">Wide cover image · Max 5MB</span>
                </span>
                <span className="ps-upload__cta">{bannerUploading ? 'Wait…' : 'Browse'}</span>
                <input ref={bannerRef} type="file" accept="image/*" hidden onChange={onPickBanner} />
              </button>
            </div>
          </div>

          {/* Full name */}
          <div className="ps-field">
            <label className="ps-label">Full Name</label>
            <input
              className={`ps-input${err('fullName') ? ' ps-input--error' : ''}`}
              placeholder="Enter your full name"
              value={data.fullName}
              onChange={(e) => set('fullName', e.target.value)}
            />
            {reqError('fullName')}
          </div>

          {/* Age + Gender */}
          <div className="ps-row">
            <div className="ps-field">
              <label className="ps-label">Age</label>
              <input
                className={`ps-input${err('age') ? ' ps-input--error' : ''}`}
                type="number"
                min="13"
                placeholder="Enter your age"
                value={data.age}
                onChange={(e) => set('age', e.target.value)}
              />
              {reqError('age')}
            </div>
            <div className="ps-field">
              <label className="ps-label">Gender</label>
              <div className="ps-select">
                <select
                  className={`ps-select__el${data.gender ? '' : ' ps-select__el--empty'}${err('gender') ? ' ps-select__el--error' : ''}`}
                  value={data.gender}
                  onChange={(e) => set('gender', e.target.value)}
                >
                  <option value="" disabled>Select an option</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <ChevronDown size={18} className="ps-select__chev" />
              </div>
              {reqError('gender')}
            </div>
          </div>

          {/* Body type */}
          <div className="ps-field">
            <label className="ps-label">Body Type</label>
            <div className={`ps-chips${err('bodyType') ? ' ps-chips--error' : ''}`}>
              {BODY_TYPES.map(({ label, icon, none }) => (
                <button
                  key={label}
                  type="button"
                  className={`ps-chip${data.bodyType === label ? ' ps-chip--on' : ''}`}
                  onClick={() => set('bodyType', label)}
                >
                  <span className="ps-chip__icon">{none ? <X size={16} /> : icon}</span>
                  {label}
                </button>
              ))}
            </div>
            {reqError('bodyType')}
          </div>

          {/* Skin tone */}
          <div className="ps-field">
            <label className="ps-label">Skin Tone</label>
            <div className={`ps-chips${err('skinTone') ? ' ps-chips--error' : ''}`}>
              {SKIN_TONES.map(({ label, icon }) => (
                <button
                  key={label}
                  type="button"
                  className={`ps-chip${data.skinTone === label ? ' ps-chip--on' : ''}`}
                  onClick={() => set('skinTone', label)}
                >
                  <span className="ps-chip__icon">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
            {reqError('skinTone')}
          </div>

          <div className="ps-field">
            <label className="ps-label">Primary content category</label>
            <div className="ps-select">
              <select
                className={`ps-select__el${data.category ? '' : ' ps-select__el--empty'}`}
                value={data.category}
                onChange={(e) => set('category', e.target.value)}
              >
                <option value="" disabled>Select the content you create</option>
                {CONTENT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <ChevronDown size={18} className="ps-select__chev" />
            </div>
            {data.category === 'custom' && (
              <input
                className="ps-input"
                style={{ marginTop: 10 }}
                placeholder="Describe your content category"
                value={data.customCategory}
                onChange={(e) => set('customCategory', e.target.value)}
              />
            )}
          </div>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          {/* Phone number */}
          <div className="ps-field">
            <label className="ps-label">Phone number</label>
            <div className="ps-phone">
              <DialCodeSelect value={data.dialCode} onChange={(v) => set('dialCode', v)} />
              <input
                className={`ps-input${err('phone') ? ' ps-input--error' : ''}`}
                type="tel"
                placeholder="Enter your phone number"
                value={data.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
            {reqError('phone')}
          </div>

          {/* Pincode */}
          <div className="ps-field">
            <label className="ps-label">Pincode</label>
            <input
              className={`ps-input${(err('pincode') || pinZoneMismatch(data.pincode, data.state, data.country)) ? ' ps-input--error' : ''}`}
              placeholder="e.g- 800001"
              value={data.pincode}
              onChange={(e) => set('pincode', e.target.value)}
            />
            {pinZoneMismatch(data.pincode, data.state, data.country)
              ? <span className="ps-error">This PIN code doesn’t match {data.state || 'the selected state'}.</span>
              : reqError('pincode')}
          </div>

          {/* Country */}
          <div className="ps-field">
            <label className="ps-label">Country</label>
            <div className="ps-select">
              <select
                className={`ps-select__el${data.country ? '' : ' ps-select__el--empty'}${err('country') ? ' ps-select__el--error' : ''}`}
                value={data.country}
                onChange={(e) => set('country', e.target.value)}
              >
                <option value="" disabled>Select an option</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={18} className="ps-select__chev" />
            </div>
            {reqError('country')}
          </div>

          {/* State + City */}
          <div className="ps-row">
            <div className="ps-field">
              <label className="ps-label">State</label>
              <div className="ps-select">
                <select
                  className={`ps-select__el${data.state ? '' : ' ps-select__el--empty'}${err('state') ? ' ps-select__el--error' : ''}`}
                  value={data.state}
                  onChange={(e) => { set('state', e.target.value); set('city', ''); }}
                >
                  <option value="" disabled>Select an option</option>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={18} className="ps-select__chev" />
              </div>
              {reqError('state')}
            </div>
            <div className="ps-field">
              <label className="ps-label">City</label>
              <div className="ps-select">
                <select
                  className={`ps-select__el${data.city ? '' : ' ps-select__el--empty'}${err('city') ? ' ps-select__el--error' : ''}`}
                  value={data.city}
                  disabled={!data.state}
                  onChange={(e) => set('city', e.target.value)}
                >
                  <option value="" disabled>{data.state ? 'Select an option' : 'Select a state first'}</option>
                  {(CITIES_BY_STATE[data.state] || []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={18} className="ps-select__chev" />
              </div>
              {reqError('city')}
            </div>
          </div>

          {/* Detailed Address */}
          <div className="ps-field">
            <label className="ps-label">Detailed Address</label>
            <input
              className={`ps-input${err('address') ? ' ps-input--error' : ''}`}
              placeholder="123 Main St, Anytown"
              value={data.address}
              onChange={(e) => set('address', e.target.value)}
            />
            {reqError('address')}
          </div>

          {/* Google Map Link */}
          <div className="ps-field">
            <label className="ps-label">Google Map Link (Optional)</label>
            <input
              className="ps-input"
              placeholder="Paste Google map link"
              value={data.mapLink}
              onChange={(e) => set('mapLink', e.target.value)}
            />
          </div>
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          {/* Skills */}
          <div className="ps-field">
            <label className="ps-label">Select all skills you have <span className="ps-muted">(Select all that apply)</span></label>
            <div className={`ps-chips${err('skills') ? ' ps-chips--error' : ''}`}>
              {SKILLS.map(({ label, icon }) => (
                <button
                  key={label}
                  type="button"
                  className={`ps-chip${data.skills.includes(label) ? ' ps-chip--on' : ''}`}
                  onClick={() => toggleIn('skills', label)}
                >
                  <span className="ps-chip__icon">{icon}</span>{label}
                </button>
              ))}
              {customTail('skills', SKILLS.map((s) => s.label), 'Others')}
            </div>
            {customInput('skills', 'Type a skill (e.g. Lighting, Directing)')}
            {err('skills') && <span className="ps-error">Select at least one skill</span>}
          </div>

          {/* Profile links */}
          <div className="ps-field">
            <label className="ps-label">Profile links</label>
            <p className="ps-hinttext">Add at least one profile link. Brands shortlist creators by skills, not followers.</p>
            <div className="ps-links">
              {PLATFORMS.map((p) => {
                const linkErr = showErrors ? linkError(p.label, data.links[p.key]) : '';
                return (
                  <Fragment key={p.key}>
                    <div className={`ps-link${linkErr ? ' ps-link--error' : ''}`}>
                      <span className="ps-link__badge" style={{ background: p.color }}>
                        {p.Icon ? <p.Icon size={18} color="#fff" /> : p.badge}
                      </span>
                      <input
                        ref={(el) => { linkRefs.current[p.key] = el; }}
                        className="ps-link__input"
                        placeholder={`${p.label} profile`}
                        value={data.links[p.key]}
                        onChange={(e) => setLink(p.key, e.target.value)}
                      />
                      {/* Show "+Add social link" only while the field is empty; once a
                          link is typed/pasted the button disappears. */}
                      {!data.links[p.key] && (
                        <button
                          type="button"
                          className="ps-link__add"
                          onClick={() => linkRefs.current[p.key]?.focus()}
                        >
                          +Add social link
                        </button>
                      )}
                    </div>
                    {linkErr && <span className="ps-error ps-link-err">{linkErr}</span>}
                  </Fragment>
                );
              })}

              {/* User-added social links */}
              {data.extraLinks.map((l) => {
                const b = badgeFor(l.platform);
                const linkErr = showErrors ? linkError(l.platform, l.url) : '';
                return (
                  <Fragment key={l.id}>
                    <div className={`ps-link${linkErr ? ' ps-link--error' : ''}`}>
                      <span className="ps-link__badge" style={{ background: b.bg }}>{b.c}</span>
                      <input
                        className="ps-link__input"
                        placeholder={`${l.platform} link`}
                        value={l.url}
                        onChange={(e) => setExtraUrl(l.id, e.target.value)}
                      />
                      <button type="button" className="ps-link__remove" onClick={() => removeExtra(l.id)}><X size={16} /></button>
                    </div>
                    {linkErr && <span className="ps-error ps-link-err">{linkErr}</span>}
                  </Fragment>
                );
              })}
            </div>

            {!addOpen ? (
              <button type="button" className="ps-addlink" onClick={() => setAddOpen(true)}><Plus size={15} /> Add another social link</button>
            ) : (
              <div className="ps-addbox">
                <div className="ps-addbox__row">
                  <div className="ps-select ps-addbox__select">
                    <select className="ps-select__el" value={addPlatform} onChange={(e) => setAddPlatform(e.target.value)}>
                      {ADD_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={18} className="ps-select__chev" />
                  </div>
                  <button type="button" className="ps-addbox__cancel" onClick={closeAddSocial}>Cancel</button>
                </div>
                {addPlatform === 'Custom' && (
                  <input
                    className="ps-input"
                    placeholder="Custom platform name (e.g. Snapchat)"
                    value={customPlatform}
                    onChange={(e) => setCustomPlatform(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSocial(); } }}
                    autoFocus
                  />
                )}
                <button type="button" className="ps-btn-soft ps-addbox__add" onClick={addSocial}>Add</button>
              </div>
            )}
            {err('profileLink') && <span className="ps-error">Add at least one profile link</span>}
          </div>

          {/* Portfolio videos */}
          <div className="ps-section">
            <h3 className="ps-h3">Upload your Portfolio videos</h3>
            <p className="ps-hinttext">UGC, brand ads, reels, or speaking samples work best.</p>
            <div className="ps-pf">
              <div className="ps-pf__left">
                <input ref={pfFileRef} type="file" accept="video/*" hidden onChange={onPickVideo} />
                {data.pfVideoUrl ? (
                  <>
                    <div className="ps-pf__thumb ps-pf__thumb--filled">
                      <video src={`${data.pfVideoUrl}#t=0.1`} muted preload="metadata" className="ps-pf__thumbimg" />
                      <span className="ps-pf__play"><Play size={18} /></span>
                    </div>
                    <button type="button" className="ps-pf__change" onClick={() => pfFileRef.current?.click()}>Change video</button>
                  </>
                ) : (
                  <>
                    <div className="ps-pf__thumb ps-pf__thumb--empty">
                      <img src="/uplaod.png" alt="Upload a video" className="ps-pf__thumbimg" />
                    </div>
                    <button type="button" className="ps-pf__upload" onClick={() => pfFileRef.current?.click()}>
                      <Upload size={15} /> Upload <span className="ps-muted">(max 200 MB)</span>
                    </button>
                  </>
                )}
              </div>
              <div className="ps-pf__right">
                <input ref={brandRef} className="ps-input" placeholder="Brand name" value={data.pfBrand} onChange={(e) => set('pfBrand', e.target.value)} />
                <textarea className="ps-input ps-textarea" placeholder="Description (Optional - not visible to clients)" value={data.pfDesc} onChange={(e) => set('pfDesc', e.target.value)} />
                <button type="button" className="ps-btn-soft" onClick={addPortfolio}>Add to Profile</button>
              </div>
            </div>

            {data.portfolio.length > 0 && (
              <>
                <button type="button" className="ps-addlink" onClick={() => brandRef.current?.focus()}><Plus size={15} /> Add More Videos</button>
                <div className="ps-vids">
                  {data.portfolio.map((it) => (
                    <div key={it.id} className="ps-vid">
                      <div className="ps-vid__thumb">
                        {it.videoUrl
                          ? <video src={`${it.videoUrl}#t=0.1`} muted preload="metadata" className="ps-vid__thumbimg" />
                          : <img src="/uplaod.png" alt="" className="ps-vid__thumbimg" />}
                        <span className="ps-pf__play"><Play size={18} /></span>
                      </div>
                      {editingId === it.id ? (
                        <div className="ps-vid__body">
                          <input className="ps-input" placeholder="Brand name" value={editDraft.brand} onChange={(e) => setEditDraft((d) => ({ ...d, brand: e.target.value }))} />
                          <textarea className="ps-input ps-textarea" placeholder="What was this video for and what was your role?" value={editDraft.desc} onChange={(e) => setEditDraft((d) => ({ ...d, desc: e.target.value }))} />
                          <div className="ps-vid__actions">
                            <button type="button" className="ps-btn-soft" onClick={saveModify}>Save Changes</button>
                            <button type="button" className="ps-vid__del" onClick={() => deleteItem(it.id)}><Trash2 size={14} /> Delete</button>
                            <button type="button" className="ps-vid__cancel" onClick={cancelModify}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="ps-vid__body">
                          <div className="ps-vid__name">{it.brand || it.link || it.video || 'Untitled'}</div>
                          <div className="ps-vid__desc">{isFilled(it.desc) ? it.desc : <span className="ps-muted">No description added yet.</span>}</div>
                          <div className="ps-vid__actions ps-vid__actions--read">
                            <div className="ps-vid__left">
                              {justAddedId === it.id && <span className="ps-vid__added"><Check size={14} /> Added</span>}
                              <button type="button" className="ps-vid__btn" onClick={() => startModify(it)}><Pencil size={14} /> Modify</button>
                            </div>
                            <button type="button" className="ps-vid__del ps-vid__del--out" onClick={() => deleteItem(it.id)}><Trash2 size={14} /> Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {err('portfolio') && <span className="ps-error">This field is required</span>}
          </div>

          {/* Languages */}
          <div className="ps-field">
            <label className="ps-label">Languages you can create in <span className="ps-muted">(Select all that apply)</span></label>
            <p className="ps-hinttext">Pick the languages you can confidently write / speak on camera.</p>
            <div className={`ps-chips${err('languages') ? ' ps-chips--error' : ''}`}>
              {/* Selected languages — each gets a fluency picker + remove */}
              {data.languages.map((l) => (
                <div key={l} className="ps-langchip">
                  <span className="ps-langchip__name">{l}</span>
                  <FluencyMenu value={data.langFluency[l]} onPick={(v) => setFluency(l, v)} />
                  <button type="button" className="ps-langchip__x" onClick={() => toggleIn('languages', l)}><X size={14} /></button>
                </div>
              ))}
              {/* Unselected predefined languages */}
              {LANGUAGES.filter((l) => !data.languages.includes(l)).map((l) => (
                <button key={l} type="button" className="ps-chip" onClick={() => toggleIn('languages', l)}>{l}</button>
              ))}
              <button
                type="button"
                className={`ps-chip ps-chip--add${customOpen.languages ? ' ps-chip--add-on' : ''}`}
                onClick={() => openCustom('languages')}
              >
                <Plus size={15} /> Other
              </button>
            </div>
            {customInput('languages', 'Type a language')}
            {err('languages') && <span className="ps-error">Select at least one language</span>}
          </div>

          {/* Compensation */}
          <div className="ps-section">
            <h3 className="ps-h3">Compensation Preferences</h3>
            <p className="ps-hinttext">We generally follow standardized pricing on the platform. The details below help us benchmark and may be used for internal or special projects.</p>
            <div className="ps-comp">
              <span className="ps-comp__label">Expected payout</span>
              <input
                className={`ps-input${err('expectedPayout') ? ' ps-input--error' : ''}`}
                placeholder="Per video or per month (e.g. ₹4,000 / video)"
                value={data.expectedPayout}
                onChange={(e) => set('expectedPayout', e.target.value)}
              />
              <div className="ps-select ps-comp__period">
                <select className="ps-select__el" value={data.payoutPeriod} onChange={(e) => set('payoutPeriod', e.target.value)}>
                  {PAYOUT_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDown size={18} className="ps-select__chev" />
              </div>
            </div>
            {err('expectedPayout') && <span className="ps-error">Enter your expected payout</span>}
          </div>

          {/* Topics to avoid */}
          <div className="ps-divider" />
          <div className="ps-field">
            <label className="ps-label">Topics you prefer not to work with <span className="ps-muted">(optional)</span></label>
            <p className="ps-hinttext">This helps us avoid mismatched projects.</p>
            <div className="ps-chips">
              {TOPICS.map((t) => (
                <button key={t} type="button" className={`ps-chip${data.topics.includes(t) ? ' ps-chip--on' : ''}`} onClick={() => toggleTopic(t)}>{t}</button>
              ))}
              {customTail('topics', TOPICS, 'Other')}
            </div>
            {customInput('topics', 'Type a topic')}
          </div>
        </>
      );
    }

    if (step === 4) {
      return (
        <>
          {/* Core setup */}
          <div className="ps-field">
            <label className="ps-label">Core Setup <span className="ps-muted">(What can you record with?)</span></label>
            <div className="ps-chips">
              {CORE_SETUP.map(({ label, icon }) => (
                <button
                  key={label}
                  type="button"
                  className={`ps-chip${data.coreSetup.includes(label) ? ' ps-chip--on' : ''}`}
                  onClick={() => toggleIn('coreSetup', label)}
                >
                  <span className="ps-chip__icon">{icon}</span>{label}
                </button>
              ))}
              {customTail('coreSetup', CORE_SETUP.map((s) => s.label), 'Others')}
            </div>
            {customInput('coreSetup', 'Type equipment (e.g. Gimbal)')}
            <p className="ps-hinttext">Select all that apply</p>
          </div>

          {/* Who can appear */}
          <div className="ps-field">
            <label className="ps-label">Who can appear in your videos?</label>
            <div className="ps-chips">
              {APPEAR_IN.map(({ label, icon }) => (
                <button
                  key={label}
                  type="button"
                  className={`ps-chip${data.appearIn.includes(label) ? ' ps-chip--on' : ''}`}
                  onClick={() => toggleIn('appearIn', label)}
                >
                  <span className="ps-chip__icon">{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>

          <div className="ps-note"><Info size={15} /> You can edit this anytime. Only relevant brands see your details.</div>
        </>
      );
    }

    // Remaining steps — placeholder until their designs are provided.
    return (
      <div className="ps-stub">
        <span className="ps-stub__icon"><User size={26} /></span>
        <h3 className="ps-stub__title">{meta.title}</h3>
        <p className="ps-stub__text">
          This step is coming next. Send the design for <strong>“{meta.title}”</strong> and it'll
          slot right in — the wizard, navigation, and completion bar are already wired up.
        </p>
      </div>
    );
  };

  return (
    <div className="ps-root">
      <div className="ps-bg" aria-hidden="true">
        <div className="ps-blob ps-blob--1" />
        <div className="ps-blob ps-blob--2" />
        <div className="ps-grid" />
      </div>

      <header className="ps-topbar">
        <button className="ps-brand" onClick={() => navigate('/')}>
          <img src="/newlogo-tight.png" alt="UGCad.io" className="ps-brand__logo" />
        </button>
        <span className="ps-topbar__tag">Creator onboarding</span>
      </header>

      <main className="ps-main">
        {submitted ? (
          <motion.div
            className="ps-card ps-thanks"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <motion.div
              className="ps-thanks__icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 16 }}
            >
              <Check size={40} strokeWidth={3} />
            </motion.div>
            <h1 className="ps-thanks__title">Application Submitted <PartyPopper size={24} /></h1>
            <p className="ps-thanks__text">
              Thanks for submitting your creator profile. Our team will review it and get back to
              you within <strong>24-48 hours</strong>. Keep an eye on your inbox!
            </p>
            <div className="ps-thanks__actions">
              <button className="ps-btn-primary ps-thanks__home" onClick={() => navigate('/')}>
                Back to Home <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Progress bar — sits at the top, above the form, and fills as you go */}
            <div className="ps-bar">
              <div className="ps-bar__top">
                <span className="ps-bar__label">Your Profile is <strong>{percent}%</strong> Complete</span>
              </div>
              <div className="ps-bar__track">
                <motion.span
                  className="ps-bar__fill"
                  animate={{ width: `${percent}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>
            </div>

            <motion.div
              className="ps-card"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <div className="ps-card__head">
                <span className="ps-step">Step {step + 1} of {TOTAL_STEPS + 1}</span>
                <h1 className="ps-title">{meta.title}</h1>
                <p className="ps-sub">{meta.sub}</p>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  className="ps-body"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.26, ease: 'easeOut' }}
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>

              <div className="ps-actions">
                {step > 1 && (
                  <button className="ps-btn-ghost" onClick={back} disabled={submitting}>
                    <ArrowLeft size={18} /> Go Back
                  </button>
                )}
                <button className="ps-btn-primary" onClick={proceed} disabled={submitting}>
                  {submitting
                    ? <><span className="ps-spin" /> Submitting…</>
                    : <>{step < TOTAL_STEPS ? 'Proceed' : 'Submit Application'} <ArrowRight size={18} /></>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');

        .ps-root {
          /* Dark backdrop with a light-purple card floating on top. */
          --ps-purple: #5b6bff;
          --ps-purple-deep: #4452f0;
          min-height: 100vh;
          background: #0a0a16;
          color: #7c5cff;
          font-family: var(--font-body);
          position: relative;
          overflow-x: hidden;
        }
        .ps-root *, .ps-root *::before, .ps-root *::after { box-sizing: border-box; }
        /* Guaranteed full-viewport dark backdrop behind everything. */
        .ps-root::before { content: ''; position: fixed; inset: 0; background: #0a0a16; z-index: -1; }
        .ps-topbar, .ps-main { background: transparent; }

        /* Background atmosphere */
        .ps-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        .ps-blob { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.45;
          background: linear-gradient(135deg, #2a1a6e, #11103f); }
        .ps-blob--1 { width: 520px; height: 520px; top: -12%; left: -6%; }
        .ps-blob--2 { width: 460px; height: 460px; bottom: -14%; right: -4%;
          background: linear-gradient(135deg, #3b1a6e, #0c0c33); }
        .ps-grid { position: absolute; inset: 0; opacity: 0.25;
          background-image: radial-gradient(rgba(7,7,78,0.10) 1px, transparent 1px);
          background-size: 26px 26px; mask-image: radial-gradient(120% 80% at 50% 0%, #000, transparent 70%); }

        /* Topbar */
        .ps-topbar { position: relative; z-index: 1; display: flex; align-items: center; gap: 16px;
          padding: 20px 7%; border-bottom: 1px solid rgba(7,7,78,0.06); }
        .ps-brand { display: inline-flex; align-items: center; gap: 10px; background: none; border: none; cursor: pointer; padding: 0; }
        .ps-brand__logo { height: 28px; width: auto; display: block; }
        .ps-brand__mark { width: 24px; height: 24px; border-radius: 7px;
          background: linear-gradient(135deg, #07074e, #07074e); box-shadow: 0 4px 16px rgba(7,7,78,0.55); }
        .ps-brand__name { color: #7c5cff; font-size: 1.25rem; font-weight: 700; }
        .ps-brand__name-2 { color: rgba(7,7,78,0.7); font-weight: 500; }
        .ps-topbar__tag { margin-left: auto; font-size: 0.82rem; font-weight: 500; letter-spacing: 0.02em;
          color: rgba(7,7,78,0.45); padding: 6px 14px; border-radius: 999px;
          border: 1px solid rgba(7,7,78,0.1); }

        /* Layout */
        .ps-main { position: relative; z-index: 1; max-width: 660px; margin: 0 auto; padding: 26px 5% 80px; }

        /* Top progress bar */
        .ps-bar { margin-bottom: 22px; }
        .ps-bar__top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
        .ps-bar__label { font-size: 0.98rem; font-weight: 600; color: #7c5cff; }
        .ps-bar__label strong { color: var(--ps-purple); }
        .ps-bar__hint { font-size: 0.82rem; color: rgba(7,7,78,0.45); }
        .ps-bar__track { width: 100%; height: 9px; border-radius: 999px; background: rgba(7,7,78,0.09);
          overflow: hidden; border: 1px solid rgba(7,7,78,0.06); }
        .ps-bar__fill { display: block; height: 100%; border-radius: 999px;
          background: linear-gradient(90deg, #5b6bff, #4452f0); box-shadow: 0 0 14px rgba(91,107,255,0.4); }

        /* Form card */
        .ps-card { position: relative; border-radius: 18px; padding: 26px 28px 22px;
          border: 1px solid #e6e9ff;
          background:
            radial-gradient(120% 100% at 50% -10%, rgba(91,107,255,0.06), transparent 55%),
            #ffffff;
          box-shadow: 0 20px 50px rgba(18,22,60,0.10); overflow: hidden; }
        .ps-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(7,7,78,0.7), transparent); }
        .ps-card__head { margin-bottom: 18px; }
        .ps-step { display: inline-block; padding: 4px 11px; border-radius: 999px; font-size: 0.68rem; font-weight: 700;
          background: linear-gradient(120deg, #07074e, #4f63e6); color: #7c5cff; }
        .ps-title { font-family: var(--font-head); font-size: var(--fs-h2); font-weight: var(--fw-head); margin: 11px 0 0; color: #7c5cff; letter-spacing: -0.01em; }
        .ps-sub { font-size: 0.85rem; color: rgba(7,7,78,0.55); margin: 5px 0 0; }
        .ps-body { display: flex; flex-direction: column; gap: 16px; }

        /* Upload */
        .ps-upload-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .ps-upload-row .ps-field { margin: 0; }
        .ps-upload { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; width: 100%; text-align: left;
          padding: 16px 18px; border-radius: 16px; cursor: pointer;
          border: 1px dashed rgba(7,7,78,0.4); background: rgba(7,7,78,0.05); transition: all 0.2s; }
        .ps-upload:hover { background: rgba(7,7,78,0.11); border-color: rgba(7,7,78,0.65); }
        .ps-upload__icon { width: 54px; height: 54px; border-radius: 14px; flex-shrink: 0; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: rgba(7,7,78,0.14); border: 1px solid rgba(7,7,78,0.25); color: var(--ps-purple); }
        .ps-upload__preview { width: 100%; height: 100%; object-fit: cover; }
        .ps-upload__text { display: flex; flex-direction: column; gap: 3px; }
        .ps-upload__title { font-size: 0.98rem; font-weight: 600; color: #7c5cff; }
        .ps-optional { font-weight: 500; color: rgba(7,7,78,0.4); }
        .ps-upload__hint { font-size: 0.8rem; color: rgba(7,7,78,0.45); }
        .ps-upload__cta { margin-left: 0; margin-top: 2px; padding: 8px 18px; border-radius: 10px; font-size: 0.85rem;
          font-weight: 600; color: #fff; background: var(--ps-purple); border: 1px solid var(--ps-purple); }
        /* Light theme: keep white text on the coloured / gradient surfaces. */
        .ps-step, .ps-btn-primary, .ps-btn-soft, .ps-thanks__icon,
        .ps-link__badge, .ps-pf__thumb, .ps-pf__play, .ps-vid__thumb { color: #fff; }
        /* Dark backdrop: elements OUTSIDE the white card need light text. */
        .ps-brand__name { color: #fff; }
        .ps-brand__name-2 { color: rgba(255,255,255,0.7); }
        .ps-topbar { border-bottom-color: rgba(255,255,255,0.08); }
        .ps-topbar__tag { color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.18); }
        .ps-bar__label { color: #fff; }
        .ps-bar__hint { color: rgba(255,255,255,0.55); }
        .ps-bar__track { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.08); }

        /* Fields */
        .ps-field { display: flex; flex-direction: column; gap: 7px; }
        .ps-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .ps-label { font-size: 0.88rem; font-weight: 600; color: #7c5cff; }
        .ps-input { width: 100%; padding: 10px 13px; border-radius: 10px; font-size: 0.88rem;
          color: #7c5cff; background: rgba(7,7,78,0.045); border: 1px solid rgba(7,7,78,0.12);
          outline: none; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; font-family: inherit; }
        .ps-input::placeholder { color: rgba(7,7,78,0.38); }
        .ps-input:focus { border-color: var(--ps-purple); background: rgba(7,7,78,0.06);
          box-shadow: 0 0 0 4px rgba(7,7,78,0.16); }

        .ps-select { position: relative; }
        .ps-select__el { width: 100%; padding: 10px 38px 10px 13px; border-radius: 10px; font-size: 0.88rem;
          color: #7c5cff; background: rgba(7,7,78,0.045); border: 1px solid rgba(7,7,78,0.12);
          outline: none; appearance: none; -webkit-appearance: none; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .ps-select__el--empty { color: rgba(7,7,78,0.38); }
        .ps-select__el:disabled { opacity: 0.5; cursor: not-allowed; }
        .ps-select__el:focus { border-color: var(--ps-purple); box-shadow: 0 0 0 4px rgba(7,7,78,0.16); }
        .ps-select__el option { color: #111; }
        .ps-select__chev { position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          color: rgba(7,7,78,0.5); pointer-events: none; }

        /* Phone number — dial-code picker + number input */
        .ps-phone { display: flex; gap: 12px; }
        .ps-phone .ps-input { flex: 1; }

        /* Custom flag dial-code dropdown */
        .ps-dial { position: relative; flex-shrink: 0; }
        .ps-dial__btn { display: flex; align-items: center; gap: 8px; height: 100%; min-height: 50px;
          padding: 0 14px; border-radius: 12px; cursor: pointer; font-family: inherit; font-size: 0.98rem;
          color: #7c5cff; background: rgba(7,7,78,0.045); border: 1px solid rgba(7,7,78,0.12); transition: all 0.2s; }
        .ps-dial__btn:hover { border-color: rgba(7,7,78,0.5); }
        .ps-dial__flag { width: 22px; height: 16px; border-radius: 3px; object-fit: cover; display: block;
          box-shadow: 0 0 0 1px rgba(7,7,78,0.12); }
        .ps-dial__chev { color: rgba(7,7,78,0.5); margin-left: 2px; }
        .ps-dial__menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 20; min-width: 120px;
          padding: 6px; border-radius: 12px; background: #ffffff; border: 1px solid rgba(7,7,78,0.12);
          box-shadow: 0 20px 50px rgba(0,0,0,0.55); display: flex; flex-direction: column; gap: 2px; }
        .ps-dial__opt { display: flex; align-items: center; gap: 9px; padding: 9px 12px; border-radius: 9px;
          cursor: pointer; font-family: inherit; font-size: 0.94rem; color: #7c5cff; background: none; border: none; text-align: left; }
        .ps-dial__opt:hover { background: rgba(7,7,78,0.06); }
        .ps-dial__opt--on { background: rgba(7,7,78,0.16); }

        /* Chips */
        .ps-chips { display: flex; flex-wrap: wrap; gap: 12px; }
        .ps-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 10px;
          font-size: 0.83rem; font-weight: 500; color: rgba(7,7,78,0.85); cursor: pointer; transition: all 0.18s;
          background: rgba(7,7,78,0.04); border: 1px solid rgba(7,7,78,0.12); font-family: inherit; }
        .ps-chip:hover { border-color: rgba(7,7,78,0.55); color: #7c5cff; transform: translateY(-1px); }
        .ps-chip--on { background: rgba(7,7,78,0.18); border-color: var(--ps-purple); color: #7c5cff;
          box-shadow: 0 0 0 3px rgba(7,7,78,0.16); }
        .ps-chip__icon { display: inline-flex; align-items: center; font-size: 0.98rem; }

        /* Selected language chip with fluency picker */
        .ps-langchip { display: inline-flex; align-items: center; gap: 8px; padding: 4px 6px 4px 12px; border-radius: 10px;
          background: rgba(7,7,78,0.16); border: 1px solid var(--ps-purple); color: #7c5cff; font-size: 0.83rem; }
        .ps-langchip__name { font-weight: 500; }
        .ps-langchip__x { display: flex; background: none; border: none; cursor: pointer; color: rgba(7,7,78,0.7); padding: 2px; }
        .ps-langchip__x:hover { color: #7c5cff; }
        .ps-flu { position: relative; }
        .ps-flu__btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 7px;
          background: rgba(7,7,78,0.1); border: 1px solid rgba(7,7,78,0.18); color: #7c5cff; cursor: pointer;
          font-family: inherit; font-size: 0.76rem; font-weight: 500; }
        .ps-flu__btn:hover { background: rgba(7,7,78,0.16); }
        .ps-flu__menu { position: absolute; top: calc(100% + 5px); left: 0; z-index: 30; min-width: 150px; padding: 5px;
          border-radius: 10px; background: #ffffff; border: 1px solid rgba(7,7,78,0.12);
          box-shadow: 0 18px 44px rgba(0,0,0,0.55); display: flex; flex-direction: column; gap: 2px; }
        .ps-flu__opt { padding: 8px 12px; border-radius: 7px; text-align: left; background: none; border: none; cursor: pointer;
          color: #7c5cff; font-family: inherit; font-size: 0.85rem; }
        .ps-flu__opt:hover { background: rgba(7,7,78,0.07); }
        .ps-flu__opt--on { background: rgba(7,7,78,0.18); }

        /* Stub steps */
        .ps-stub { text-align: center; padding: 34px 10px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .ps-stub__icon { width: 62px; height: 62px; border-radius: 18px; display: flex; align-items: center;
          justify-content: center; background: rgba(7,7,78,0.14); color: var(--ps-purple); }
        .ps-stub__title { font-family: var(--font-head); font-size: var(--fs-h3); font-weight: var(--fw-head); margin: 0; color: #7c5cff; }
        .ps-stub__text { font-size: 0.97rem; line-height: 1.6; color: rgba(7,7,78,0.55); max-width: 420px; margin: 0; }
        .ps-stub__text strong { color: #7c5cff; }

        /* Actions */
        .ps-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 24px;
          padding-top: 18px; border-top: 1px solid rgba(7,7,78,0.07); }
        .ps-btn-ghost { display: inline-flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: 999px;
          font-size: 0.88rem; font-weight: 600; color: #7c5cff; cursor: pointer; font-family: inherit;
          background: transparent; border: 1px solid rgba(7,7,78,0.22); margin-right: auto; transition: all 0.2s; }
        .ps-btn-ghost:hover { border-color: rgba(7,7,78,0.5); background: rgba(7,7,78,0.04); }
        .ps-btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 10px 26px; border-radius: 999px;
          font-size: 0.9rem; font-weight: 600; color: #7c5cff; cursor: pointer; border: none; font-family: inherit;
          background: linear-gradient(120deg, #07074e, #4f63e6);
          transition: all 0.2s; }
        .ps-btn-primary:hover { transform: translateY(-2px); }
        .ps-btn-primary:disabled, .ps-btn-ghost:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .ps-spin { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(7,7,78,0.4);
          border-top-color: #7c5cff; animation: psSpin 0.7s linear infinite; }
        @keyframes psSpin { to { transform: rotate(360deg); } }

        /* Thank-you / submitted card */
        .ps-thanks { text-align: center; padding: 48px 36px; display: flex; flex-direction: column; align-items: center; }
        .ps-thanks__icon { width: 84px; height: 84px; border-radius: 50%; display: flex; align-items: center;
          justify-content: center; color: #7c5cff; margin-bottom: 22px;
          background: linear-gradient(135deg, #07074e, #07074e); box-shadow: 0 0 0 10px rgba(7,7,78,0.14), 0 16px 40px rgba(7,7,78,0.5); }
        .ps-thanks__title { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-head); font-size: var(--fs-h2); font-weight: var(--fw-head); color: #7c5cff; margin: 0 0 12px; }
        .ps-thanks__text { font-size: 0.95rem; line-height: 1.6; color: rgba(7,7,78,0.65); max-width: 420px; margin: 0 0 28px; }
        .ps-thanks__text strong { color: #7c5cff; }
        .ps-thanks__actions { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .ps-thanks__home { margin-right: 0; }
        /* Validation */
        .ps-error { font-size: 0.82rem; color: #f06d6d; margin-top: 2px; }
        .ps-input--error, .ps-select__el--error { border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px rgba(239,68,68,0.16) !important; }
        .ps-upload--error { border-color: #ef4444 !important; }
        .ps-chips--error { border-radius: 14px; padding: 8px; margin: -8px;
          box-shadow: 0 0 0 1px #ef4444, 0 0 0 4px rgba(239,68,68,0.14); }

        /* ── Step 4 — Build Your Creator Portfolio ── */
        .ps-muted { font-weight: 500; color: rgba(7,7,78,0.42); }
        .ps-hinttext { font-size: 0.78rem; line-height: 1.5; color: rgba(7,7,78,0.5); margin: -2px 0 3px; }
        .ps-section { display: flex; flex-direction: column; gap: 9px; padding-top: 6px;
          border-top: 1px solid rgba(7,7,78,0.07); }
        .ps-h3 { font-family: var(--font-head); font-size: var(--fs-h3); font-weight: var(--fw-head); color: #7c5cff; margin: 4px 0 0; }
        .ps-chip--add { color: var(--ps-purple); border-style: dashed; }
        .ps-chip--add svg { color: var(--ps-purple); }
        .ps-chip--add-on { background: rgba(7,7,78,0.16); border-style: solid; border-color: var(--ps-purple); }

        /* Custom "Other" add-input */
        .ps-custom { margin-top: 10px; }
        .ps-custom__row { display: flex; gap: 10px; }
        .ps-custom__row .ps-input { flex: 1; }
        .ps-custom__add { padding: 0 24px; border-radius: 12px; cursor: pointer; font-family: inherit; font-weight: 600;
          font-size: 0.92rem; color: #7c5cff; background: rgba(7,7,78,0.07); border: 1px solid rgba(7,7,78,0.14); transition: all 0.2s; }
        .ps-custom__add:hover { background: rgba(7,7,78,0.2); border-color: rgba(7,7,78,0.45); }
        .ps-custom__hint { font-size: 0.82rem; color: rgba(7,7,78,0.45); margin: 8px 0 0; }
        .ps-custom__hint strong { color: #7c5cff; }

        /* Profile links */
        .ps-links { display: flex; flex-direction: column; gap: 10px; }
        .ps-link { display: flex; align-items: center; gap: 12px; padding: 8px 10px 8px 12px; border-radius: 14px;
          border: 1px solid rgba(7,7,78,0.12); background: rgba(7,7,78,0.03); }
        .ps-link--error { border-color: #ef4444; }
        .ps-link-err { margin-top: -4px; }
        .ps-link__badge { width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0; color: #7c5cff;
          display: flex; align-items: center; justify-content: center; font-size: 0.95rem; font-weight: 700; }
        .ps-link__input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: #7c5cff;
          font-family: inherit; font-size: 0.95rem; }
        .ps-link__input::placeholder { color: rgba(7,7,78,0.4); }
        .ps-link__followers { width: 110px; flex-shrink: 0; padding: 8px 12px; border-radius: 9px; color: #7c5cff;
          background: rgba(7,7,78,0.05); border: 1px solid rgba(7,7,78,0.14); outline: none; font-family: inherit; font-size: 0.88rem; }
        .ps-link__add { flex-shrink: 0; padding: 8px 14px; border-radius: 9px; cursor: pointer; font-family: inherit;
          font-size: 0.85rem; font-weight: 600; color: var(--ps-purple); background: rgba(7,7,78,0.12);
          border: 1px solid rgba(7,7,78,0.3); }
        .ps-link__add:hover { background: rgba(7,7,78,0.2); }
        .ps-addlink { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; margin-top: 2px;
          background: none; border: none; cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600; color: var(--ps-purple); }
        .ps-link__remove { flex-shrink: 0; display: flex; background: none; border: none; cursor: pointer;
          color: rgba(7,7,78,0.5); padding: 6px; }
        .ps-link__remove:hover { color: #7c5cff; }

        /* Add-another-social-link picker */
        .ps-addbox { display: flex; flex-direction: column; gap: 12px; margin-top: 6px; padding: 14px; border-radius: 14px;
          border: 1px solid rgba(7,7,78,0.3); background: rgba(7,7,78,0.05); }
        .ps-addbox__row { display: flex; gap: 10px; align-items: center; }
        .ps-addbox__select { flex: 1; }
        .ps-addbox__cancel { padding: 11px 22px; border-radius: 10px; cursor: pointer; font-family: inherit; font-weight: 600;
          font-size: 0.9rem; color: #7c5cff; background: rgba(7,7,78,0.06); border: 1px solid rgba(7,7,78,0.18); }
        .ps-addbox__cancel:hover { border-color: rgba(7,7,78,0.4); }
        .ps-addbox__add { align-self: flex-end; }

        /* Permissions */
        .ps-perm { display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; border-radius: 12px;
          border: 1px solid rgba(7,7,78,0.1); background: rgba(7,7,78,0.025); }
        .ps-perm--error { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.14); }
        .ps-perm__title { font-size: 0.9rem; font-weight: 600; color: #7c5cff; }
        .ps-perm__note { font-size: 0.74rem; color: var(--ps-purple); margin-bottom: 4px; }
        .ps-radio { display: flex; align-items: center; gap: 9px; padding: 5px 0; cursor: pointer;
          font-size: 0.86rem; color: rgba(7,7,78,0.85); }
        .ps-radio input { position: absolute; opacity: 0; pointer-events: none; }
        .ps-radio__dot { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
          border: 2px solid rgba(7,7,78,0.3); transition: all 0.15s; }
        .ps-radio input:checked + .ps-radio__dot { border-color: var(--ps-purple);
          box-shadow: inset 0 0 0 3.5px var(--ps-purple); }

        /* Portfolio uploader */
        .ps-pf { display: grid; grid-template-columns: 180px 1fr; gap: 16px; padding: 16px; border-radius: 16px;
          border: 1px solid rgba(7,7,78,0.1); background: rgba(7,7,78,0.025); }
        .ps-pf__left { display: flex; flex-direction: column; gap: 10px; }
        .ps-pf__thumb { position: relative; height: 90px; border-radius: 12px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #2d1b69, #4c1d95); color: #7c5cff; }
        .ps-pf__thumbimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        /* Section divider */
        .ps-divider { height: 1px; background: rgba(7,7,78,0.1); margin: 6px 0 4px; }
        .ps-pf__play { position: relative; z-index: 1; width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; color: #7c5cff;
          background: rgba(0,0,0,0.4); border: 1px solid rgba(7,7,78,0.4); }
        .ps-pf__change { padding: 8px; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 0.82rem;
          font-weight: 600; color: #7c5cff; background: rgba(7,7,78,0.06); border: 1px solid rgba(7,7,78,0.18); }
        .ps-pf__change:hover { border-color: var(--ps-purple); }
        .ps-pf__upload { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 9px; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 0.85rem;
          font-weight: 600; color: #7c5cff; background: rgba(7,7,78,0.05); border: 1px dashed rgba(7,7,78,0.22); }
        .ps-pf__or { text-align: center; font-size: 0.78rem; color: rgba(7,7,78,0.4); }
        .ps-pf__right { display: flex; flex-direction: column; gap: 10px; }
        .ps-textarea { min-height: 80px; resize: vertical; padding-top: 12px; }
        .ps-btn-soft { align-self: flex-start; padding: 10px 22px; border-radius: 999px; cursor: pointer;
          white-space: nowrap; font-family: inherit; font-size: 0.92rem; font-weight: 600; color: #7c5cff; border: none;
          background: linear-gradient(120deg, #07074e, #4f63e6); }
        /* Added portfolio video cards */
        .ps-vids { display: flex; flex-direction: column; gap: 14px; }
        .ps-vid { display: grid; grid-template-columns: 110px 1fr; gap: 14px; padding: 14px; border-radius: 14px;
          border: 1px solid rgba(7,7,78,0.1); background: rgba(7,7,78,0.025); }
        .ps-vid__thumb { position: relative; align-self: start; height: 120px; border-radius: 10px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #2d1b69, #4c1d95); color: #7c5cff; }
        .ps-vid__thumbimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .ps-vid__body { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
        .ps-vid__name { font-size: 0.92rem; font-weight: 600; color: #7c5cff; }
        .ps-vid__desc { font-size: 0.82rem; color: rgba(7,7,78,0.8); min-height: 46px; padding: 10px 12px;
          border-radius: 10px; border: 1px solid rgba(7,7,78,0.08); background: rgba(7,7,78,0.02); }
        .ps-vid__actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .ps-vid__actions--read { justify-content: space-between; }
        .ps-vid__left { display: flex; align-items: center; gap: 12px; }
        .ps-vid__btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 999px; cursor: pointer;
          font-family: inherit; font-size: 0.83rem; font-weight: 600; color: #7c5cff; background: rgba(7,7,78,0.06); border: 1px solid rgba(7,7,78,0.18); }
        .ps-vid__btn:hover { border-color: var(--ps-purple); }
        .ps-vid__del { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 999px; cursor: pointer;
          font-family: inherit; font-size: 0.83rem; font-weight: 600; color: #f06d6d; background: none; border: none; }
        .ps-vid__del--out { border: 1px solid rgba(240,109,109,0.4); }
        .ps-vid__del:hover { background: rgba(240,109,109,0.1); }
        .ps-vid__cancel { padding: 8px 14px; background: none; border: none; cursor: pointer; font-family: inherit;
          font-size: 0.83rem; font-weight: 600; color: rgba(7,7,78,0.7); }
        .ps-vid__cancel:hover { color: #7c5cff; }
        .ps-vid__added { display: inline-flex; align-items: center; gap: 5px; font-size: 0.83rem; font-weight: 600; color: #4ade80; }

        /* Info note (final step) */
        .ps-note { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; line-height: 1.5;
          color: rgba(7,7,78,0.6); padding: 12px 14px;
          border-radius: 12px; border: 1px solid rgba(7,7,78,0.1); background: rgba(7,7,78,0.025); }
        .ps-note svg { flex-shrink: 0; }

        /* Checkbox */
        .ps-check { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 0.92rem;
          color: rgba(7,7,78,0.8); margin-top: 4px; }
        .ps-check input { position: absolute; opacity: 0; pointer-events: none; }
        .ps-check__box { width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0;
          border: 2px solid rgba(7,7,78,0.3); transition: all 0.15s; }
        .ps-check input:checked + .ps-check__box { background: var(--ps-purple); border-color: var(--ps-purple);
          box-shadow: inset 0 0 0 2px #ffffff; }
        .ps-check strong { color: #7c5cff; }

        /* Compensation */
        .ps-comp { display: flex; align-items: center; gap: 12px; }
        .ps-comp__label { width: 130px; flex-shrink: 0; font-size: 0.92rem; color: rgba(7,7,78,0.7); }
        .ps-comp .ps-input { flex: 1; }
        .ps-comp__period { width: 150px; flex-shrink: 0; }

        /* Sidebar */
        .ps-side { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 18px; }
        .ps-progress { display: flex; align-items: center; gap: 16px; padding: 20px;
          border-radius: 20px; border: 1px solid rgba(7,7,78,0.09);
          background: radial-gradient(120% 120% at 100% 0%, rgba(7,7,78,0.16), transparent 60%), rgba(7,7,78,0.03); }
        .ps-progress__ring { position: relative; width: 66px; height: 66px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: conic-gradient(var(--ps-purple) var(--p), rgba(7,7,78,0.1) 0); }
        .ps-progress__ring::after { content: ''; position: absolute; inset: 6px; border-radius: 50%; background: #ffffff; }
        .ps-progress__pct { position: relative; z-index: 1; font-size: 0.9rem; font-weight: 700; color: #7c5cff; }
        .ps-progress__title { font-size: 0.95rem; font-weight: 600; color: #7c5cff; line-height: 1.3; }
        .ps-progress__hint { font-size: 0.8rem; color: rgba(7,7,78,0.5); margin-top: 5px; }

        .ps-tracker { display: flex; flex-direction: column; padding: 8px;
          border-radius: 20px; border: 1px solid rgba(7,7,78,0.08); background: rgba(7,7,78,0.025); }
        .ps-track { position: relative; display: flex; align-items: center; gap: 13px; padding: 11px 12px;
          border-radius: 14px; background: none; border: none; cursor: default; text-align: left; transition: background 0.2s; }
        .ps-track--done { cursor: pointer; }
        .ps-track--done:hover { background: rgba(7,7,78,0.04); }
        .ps-track:not(:last-child)::before { content: ''; position: absolute; left: 28px; top: 38px; bottom: -3px;
          width: 2px; background: rgba(7,7,78,0.1); }
        .ps-track--done::before { background: rgba(7,7,78,0.5); }
        .ps-track__dot { position: relative; z-index: 1; width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700;
          background: rgba(7,7,78,0.08); color: rgba(7,7,78,0.55); border: 1px solid rgba(7,7,78,0.12); }
        .ps-track--active .ps-track__dot { background: linear-gradient(120deg, #07074e, #4f63e6); color: #7c5cff;
          border-color: transparent; box-shadow: 0 0 0 4px rgba(7,7,78,0.18); }
        .ps-track--done .ps-track__dot { background: rgba(7,7,78,0.22); color: var(--ps-purple); border-color: rgba(7,7,78,0.5); }
        .ps-track__text { display: flex; flex-direction: column; }
        .ps-track__title { font-size: 0.92rem; font-weight: 600; color: rgba(7,7,78,0.6); }
        .ps-track--active .ps-track__title, .ps-track--done .ps-track__title { color: #7c5cff; }
        .ps-track__sub { font-size: 0.74rem; color: rgba(7,7,78,0.4); }

        /* Responsive */
        @media (max-width: 560px) {
          .ps-card { padding: 26px 22px; }
          .ps-row { grid-template-columns: 1fr; }
          .ps-upload-row { grid-template-columns: 1fr; }
          .ps-upload__cta { display: none; }
          /* Portfolio upload: stack the upload box above the brand/description
             fields instead of forcing them side-by-side (which overflowed). */
          .ps-pf { grid-template-columns: 1fr; }
          .ps-pf__thumb { height: 150px; }
          .ps-pf__right .ps-textarea { min-height: 90px; }
          /* Saved-video rows: keep a small thumb but let the body wrap cleanly. */
          .ps-vid { grid-template-columns: 84px 1fr; gap: 12px; }
          .ps-vid__actions { flex-wrap: wrap; }
          /* Footer nav buttons: stack full-width so "Submit Application" stops
             wrapping onto two lines and both buttons are easy to tap. */
          .ps-actions { flex-direction: column; align-items: stretch; gap: 12px; }
          .ps-btn-ghost, .ps-btn-primary {
            width: 100%;
            justify-content: center;
            margin-right: 0;
            padding: 13px 20px;
          }
        }

        /* ── Dark navy card theme (like the brand form) + light-purple accents ── */
        .ps-root { --ps-purple: #b9a8ff; --ps-purple-deep: #8b7bff; }
        .ps-card {
          background: rgba(18,18,26,0.72) !important;
          -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.10) !important;
          box-shadow: 0 30px 70px rgba(0,0,0,0.55) !important;
        }
        .ps-card::after { background: linear-gradient(90deg, transparent, rgba(185,168,255,0.55), transparent) !important; }
        .ps-title, .ps-card h1, .ps-card h2, .ps-card h3, .ps-card h4 { color: #ffffff !important; }
        .ps-title-accent { color: #ffffff !important; }
        .ps-sub, .ps-card > p, .ps-help, .ps-hint { color: rgba(255,255,255,0.66) !important; }
        .ps-label, .ps-card label { color: #ffffff !important; }
        .ps-input, .ps-select__el, .ps-card input, .ps-card textarea, .ps-card select {
          background: rgba(255,255,255,0.04) !important;
          border-color: rgba(255,255,255,0.14) !important;
          color: #ffffff !important;
        }
        .ps-input::placeholder, .ps-card input::placeholder, .ps-card textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
        .ps-input:focus, .ps-select__el:focus, .ps-card input:focus, .ps-card textarea:focus {
          border-color: #b9a8ff !important; background: rgba(255,255,255,0.06) !important;
          box-shadow: 0 0 0 4px rgba(185,168,255,0.18) !important;
        }
        .ps-chip { color: #ffffff !important; border-color: rgba(255,255,255,0.16) !important; background: rgba(255,255,255,0.03) !important; }
        .ps-chip--on, .ps-chip--add-on { background: rgba(185,168,255,0.20) !important; border-color: #b9a8ff !important; color: #ffffff !important; }
        .ps-chip--add { color: #b9a8ff !important; }
        .ps-step { color: #ffffff !important; }
        /* topbar + progress sit on the dark backdrop — white text */
        .ps-brand__name { color: #ffffff !important; }
        .ps-brand__name-2 { color: rgba(255,255,255,0.66) !important; }
        .ps-topbar__tag { color: rgba(255,255,255,0.6) !important; border-color: rgba(255,255,255,0.12) !important; }
        .ps-bar__label { color: #ffffff !important; }
        .ps-bar__label strong { color: #ffffff !important; }
        .ps-bar__hint { color: rgba(255,255,255,0.6) !important; }
        .ps-bar__track { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.10) !important; }
        /* upload / banner dropzones — white text + purple icon on the dark card */
        .ps-upload { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.20) !important; }
        .ps-upload:hover { background: rgba(255,255,255,0.07) !important; border-color: #b9a8ff !important; }
        .ps-upload__icon { background: rgba(185,168,255,0.14) !important; border-color: rgba(185,168,255,0.32) !important; color: #b9a8ff !important; }
        .ps-upload__title { color: #ffffff !important; }
        .ps-upload__hint, .ps-optional { color: rgba(255,255,255,0.6) !important; }
        /* buttons stay light purple */
        .ps-btn-primary, .ps-upload__cta { background: #b9a8ff !important; border-color: #b9a8ff !important; color: #1a1030 !important; }
        .ps-btn-primary:hover, .ps-upload__cta:hover { background: #a793ff !important; }

        /* ── Fixes: elements the dark override missed (were dark-navy = invisible) ── */
        /* Hints / muted / notes / descriptions → readable light grey. */
        .ps-hinttext, .ps-muted, .ps-custom__hint, .ps-pf__or, .ps-note,
        .ps-comp__label, .ps-thanks__text { color: rgba(255,255,255,0.6) !important; }
        .ps-thanks__text strong { color: #ffffff !important; }
        /* Section / item headings + values → white (match the other headings). */
        .ps-h3, .ps-vid__name, .ps-perm__title, .ps-thanks__title,
        .ps-check strong, .ps-custom__hint strong { color: #ffffff !important; }
        .ps-radio, .ps-check, .ps-vid__desc { color: rgba(255,255,255,0.85) !important; }
        .ps-dial__chev, .ps-select__chev { color: rgba(255,255,255,0.5) !important; }
        /* Profile-link rows: light text + visible placeholder / border. */
        .ps-link { background: rgba(255,255,255,0.03) !important; border-color: rgba(255,255,255,0.12) !important; }
        .ps-link__input { color: #ffffff !important; }
        .ps-link__input::placeholder { color: rgba(255,255,255,0.4) !important; }
        .ps-langchip { color: #ffffff !important; background: rgba(185,168,255,0.16) !important; border-color: #b9a8ff !important; }
        .ps-flu__btn { color: #ffffff !important; }
        /* Phone dial code (+91) and Go Back → light purple. */
        .ps-dial__btn { color: #b9a8ff !important; background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.14) !important; }
        .ps-btn-ghost { color: #b9a8ff !important; border-color: rgba(185,168,255,0.5) !important; }
        .ps-btn-ghost:hover { border-color: #b9a8ff !important; background: rgba(185,168,255,0.08) !important; }
        /* Success card: green tick, and a purple "Back to Home" with white text + arrow. */
        .ps-thanks__icon { background: rgba(34,197,94,0.15) !important; color: #22c55e !important;
          box-shadow: 0 0 0 10px rgba(34,197,94,0.10), 0 16px 40px rgba(34,197,94,0.22) !important; }
        .ps-thanks__home { background: #7c5cff !important; border-color: #7c5cff !important; color: #ffffff !important; }
        .ps-thanks__home:hover { background: #6b4cff !important; }

        /* ── Make all accent action text + icons WHITE (per request) ── */
        .ps-dial__btn, .ps-btn-ghost, .ps-link__add, .ps-addlink, .ps-pf__upload,
        .ps-pf__change, .ps-btn-soft, .ps-vid__btn, .ps-flu__btn, .ps-chip--add,
        .ps-link__badge, .ps-pf__play { color: #ffffff !important; }
        .ps-dial__btn svg, .ps-btn-ghost svg, .ps-link__add svg, .ps-addlink svg,
        .ps-pf__upload svg, .ps-pf__change svg, .ps-vid__btn svg, .ps-chip--add svg,
        .ps-btn-soft svg, .ps-flu__btn svg {
          color: #ffffff !important; stroke: #ffffff !important;
        }
        /* Play triangle is a filled glyph — keep it filled white. */
        .ps-pf__play svg { color: #ffffff !important; fill: #ffffff !important; stroke: #ffffff !important; }
      `}</style>
    </div>
  );
}
