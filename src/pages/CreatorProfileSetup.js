import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { useAuth } from '../App';
import { ImagePlus, ChevronDown, Check, ArrowRight, Plus, PartyPopper, Info, Instagram, Music2, CloudUpload, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { CONTENT_CATEGORIES } from '../constants/contentCategories';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// The niche a creator makes content ABOUT (what) — separate from the content STYLE
// (how, in CONTENT_CATEGORIES). Same 20 the brand signup uses, so both sides match.
const NICHE_CATEGORIES = [
  { value: 'fashion', label: 'Fashion & Apparel' },
  { value: 'beauty', label: 'Beauty & Personal Care' },
  { value: 'health', label: 'Health & Wellness' },
  { value: 'food', label: 'Food & Beverages' },
  { value: 'home', label: 'Home & Living' },
  { value: 'jewellery', label: 'Jewellery & Accessories' },
  { value: 'electronics', label: 'Electronics & Gadgets' },
  { value: 'sports', label: 'Sports & Fitness' },
  { value: 'baby_kids', label: 'Baby, Kids & Family' },
  { value: 'pets', label: 'Pets & Pet Care' },
  { value: 'travel', label: 'Travel & Hospitality' },
  { value: 'automotive', label: 'Automotive & Accessories' },
  { value: 'education', label: 'Education & Learning' },
  { value: 'tech', label: 'Technology & Software' },
  { value: 'finance', label: 'Finance & Fintech' },
  { value: 'entertainment', label: 'Entertainment & Media' },
  { value: 'gaming', label: 'Gaming & Esports' },
  { value: 'luxury', label: 'Luxury & Lifestyle' },
  { value: 'fmcg', label: 'FMCG & Consumer Goods' },
  { value: 'other', label: 'Others' },
];

const PLATFORMS = [
  { key: 'youtube', label: 'YouTube', badge: '▶', color: '#FF0000' },
  { key: 'linkedin', label: 'LinkedIn', badge: 'in', color: '#0A66C2' },
  { key: 'instagram', label: 'Instagram', Icon: Instagram, color: 'linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5)' },
  { key: 'tiktok', label: 'TikTok', Icon: Music2, color: '#111111' },
];
// Share-sheet tracking params (?igsh=, ?si=, ?s=20) are allowed after the profile path.
const LINK_RE = {
  youtube:   /^(https?:\/\/)?(www\.)?(youtube\.com\/(@[\w.-]+|channel\/|c\/|user\/)[\w./-]*|youtu\.be\/[\w-]+)\/?(?:[?#][^\s]*)?$/i,
  linkedin:  /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company|pub|school)\/[\w%.-]+\/?(?:[?#][^\s]*)?$/i,
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/[a-z0-9._]+\/?(?:[?#][^\s]*)?$|^@?[a-z0-9._]{1,30}$/i,
  tiktok:    /^(https?:\/\/)?(www\.)?tiktok\.com\/@?[\w.-]+\/?(?:[?#][^\s]*)?$|^@?[a-z0-9._]{1,30}$/i,
};
const linkError = (key, value) => {
  const v = String(value || '').trim();
  if (!v) return '';
  return LINK_RE[key].test(v) ? '' : `Enter a valid ${key} link or @handle`;
};

// Dropdown-with-checkboxes used for both content pickers.
function MultiSelect({ options, selected, onToggle, placeholder, hasError }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const chosen = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  return (
    <div className={`ps-msel${hasError ? ' ps-msel--error' : ''}`} ref={ref}>
      <button type="button" className={`ps-msel__btn${open ? ' is-open' : ''}`} onClick={() => setOpen((v) => !v)}>
        <span className={chosen.length ? '' : 'ps-msel__ph'}>{chosen.length ? chosen.join(', ') : (placeholder || 'Select')}</span>
        <ChevronDown size={18} className="ps-msel__chev" />
      </button>
      {open && (
        <div className="ps-msel__menu" role="listbox">
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button key={o.value} type="button" role="option" aria-selected={on}
                className={`ps-msel__opt${on ? ' is-on' : ''}`} onClick={() => onToggle(o.value)}>
                <span className="ps-msel__box">{on && <Check size={13} />}</span>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CreatorProfileSetup() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const photoRef = useRef(null);
  const bannerRef = useRef(null);
  const videoRef = useRef(null);
  const prefilledRef = useRef(false);
  const linkRefs = useRef({});
  const [extraLinks, setExtraLinks] = useState([]); // user-added custom links: { id, url }

  const [data, setData] = useState({
    photoPreview: '', profilePicture: '',
    bannerPreview: '', banner: '',
    name: '',
    contentStyles: [], customStyle: '',
    contentCategories: [],
    videoName: '', videoPreview: '', videoUrl: '',
    pfCategory: '', pfPrice: '', pfDelivery: '',
    portfolio: [], // saved video cards: { id, category, price, delivery, videoUrl }
    links: { youtube: '', linkedin: '', instagram: '', tiktok: '' },
  });
  const pfIdRef = useRef(1);
  const set = (field, value) => setData((d) => ({ ...d, [field]: value }));
  const toggleIn = (field, value) => setData((d) => ({
    ...d, [field]: d[field].includes(value) ? d[field].filter((v) => v !== value) : [...d[field], value],
  }));
  const setLink = (platform, value) => setData((d) => ({ ...d, links: { ...d.links, [platform]: value } }));

  // Prefill from a previous submission (e.g. asked for more info) so it isn't re-entered.
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
      portfolio: Array.isArray(pr.portfolio_items) && pr.portfolio_items.length
        ? pr.portfolio_items.map((it, i) => ({
            id: i + 1, category: it.category || '', price: it.price || '', delivery: it.delivery || '',
            videoUrl: it.videoUrl || it.url || '',
          }))
        : d.portfolio,
      links: { ...d.links, ...(pr.social_links || {}) },
    }));
    if (Array.isArray(pr.portfolio_items)) pfIdRef.current = pr.portfolio_items.length + 1;
  }, [user?.id, user?.profile]);

  // Paint the backdrop the same dark navy while this page is mounted.
  useEffect(() => {
    const root = document.getElementById('root');
    const targets = [document.documentElement, document.body, root].filter(Boolean);
    const prev = targets.map((el) => el.style.background);
    targets.forEach((el) => { el.style.background = '#0a0a16'; });
    return () => { targets.forEach((el, i) => { el.style.background = prev[i]; }); };
  }, []);

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image is too large. Maximum 5MB.'); return; }
    set('photoPreview', URL.createObjectURL(file));
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/upload/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      let url = res.data?.file_url || res.data?.url;
      if (url && url.startsWith('/')) url = `${BACKEND_URL}${url}`;
      if (url) setData((d) => ({ ...d, profilePicture: url, photoPreview: url }));
      else toast.error('Photo upload failed. Please try again.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Photo upload failed'));
    } finally {
      setPhotoUploading(false);
    }
  };

  const onPickBanner = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image is too large. Maximum 5MB.'); return; }
    set('bannerPreview', URL.createObjectURL(file));
    setBannerUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/upload/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      let url = res.data?.file_url || res.data?.url;
      if (url && url.startsWith('/')) url = `${BACKEND_URL}${url}`;
      if (url) setData((d) => ({ ...d, banner: url, bannerPreview: url }));
      else toast.error('Banner upload failed. Please try again.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Banner upload failed'));
    } finally {
      setBannerUploading(false);
    }
  };

  const uploadVideoFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) { toast.error('Please drop a video file.'); return; }
    if (file.size > 100 * 1024 * 1024) { toast.error('Video is too large. Maximum 100MB.'); return; }
    setVideoUploading(true);
    setData((d) => ({ ...d, videoName: file.name, videoPreview: URL.createObjectURL(file) }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/upload/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      let url = res.data?.file_url || res.data?.url;
      if (url && url.startsWith('/')) url = `${BACKEND_URL}${url}`;
      if (url) setData((d) => ({ ...d, videoUrl: url }));
      else { toast.error('Video upload failed. Please try again.'); setData((d) => ({ ...d, videoName: '', videoPreview: '' })); }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Video upload failed'));
      setData((d) => ({ ...d, videoName: '', videoPreview: '' }));
    } finally {
      setVideoUploading(false);
    }
  };
  const onPickVideo = (e) => { uploadVideoFile(e.target.files?.[0]); e.target.value = ''; };
  const [videoDragOver, setVideoDragOver] = useState(false);
  const onVideoDrop = (e) => {
    e.preventDefault();
    setVideoDragOver(false);
    uploadVideoFile(e.dataTransfer.files?.[0]);
  };

  const draftReady = data.videoUrl && data.pfPrice.trim() && data.pfDelivery.trim() && data.pfCategory;
  const addPortfolioItem = () => {
    if (!draftReady) { toast.error('Add a video, price, delivery time, and category first'); return; }
    const id = pfIdRef.current++;
    setData((d) => ({
      ...d,
      portfolio: [...d.portfolio, { id, category: d.pfCategory, price: d.pfPrice, delivery: d.pfDelivery, videoUrl: d.videoUrl }],
      videoName: '', videoPreview: '', videoUrl: '', pfCategory: '', pfPrice: '', pfDelivery: '',
    }));
  };
  const removePortfolioItem = (id) => setData((d) => ({ ...d, portfolio: d.portfolio.filter((it) => it.id !== id) }));

  const linksFilled = Object.values(data.links).some((v) => v.trim());
  const linksValid = Object.entries(data.links).every(([k, v]) => !linkError(k, v));
  const checks = {
    profilePicture: !!data.profilePicture,
    name: data.name.trim() !== '',
    contentStyles: data.contentStyles.length > 0,
    contentCategories: data.contentCategories.length > 0,
    portfolio: data.portfolio.length > 0,
    links: linksFilled && linksValid,
  };
  const err = (k) => showErrors && !checks[k];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!Object.values(checks).every(Boolean)) {
      setShowErrors(true);
      setTimeout(() => {
        document.querySelector('.ps-card .ps-input--error, .ps-card .ps-upload--error, .ps-card .ps-msel--error, .ps-card .ps-pf--error, .ps-card .ps-link--error')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      return;
    }
    setSubmitting(true);
    const styleValue = (v) => (v === 'custom' ? (data.customStyle.trim() || 'Custom') : v);
    const styles = data.contentStyles.map(styleValue);
    const niches = data.contentCategories;
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
        intro_video: data.portfolio[0]?.videoUrl || '',
        portfolio_items: data.portfolio.map((it) => ({
          title: 'Portfolio Sample',
          category: it.category, price: it.price, delivery: it.delivery,
          videoUrl: it.videoUrl, url: it.videoUrl,
        })),
        social_links: {
          ...Object.fromEntries(Object.entries(data.links).filter(([, v]) => v.trim())),
          ...Object.fromEntries(extraLinks.filter((l) => l.url.trim()).map((l, i) => [`link_${i + 1}`, l.url.trim()])),
        },
        receive_briefs: true,
        terms_agreed: true,
      });
      setUser({ ...user, profile_completed: true, approval_status: 'pending' });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to submit profile'));
    } finally {
      setSubmitting(false);
    }
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
          <motion.div className="ps-card ps-thanks" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <div className="ps-thanks__icon"><Check size={40} strokeWidth={3} /></div>
            <h1 className="ps-thanks__title">Profile Submitted <PartyPopper size={24} /></h1>
            <p className="ps-thanks__text">
              Thanks for submitting your creator profile. Our team will review it and get back to
              you within <strong>24-48 hours</strong>. You can start browsing briefs right away.
            </p>
            <div className="ps-thanks__actions">
              <button className="ps-btn-primary ps-thanks__home" onClick={() => navigate('/dashboard/creator')}>
                Go to Dashboard <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.form className="ps-card" onSubmit={handleSubmit} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="ps-card__head">
              <h1 className="ps-title">Set up your creator profile</h1>
              <p className="ps-sub">A few essentials so brands know who they're hiring.</p>
            </div>

            <div className="ps-body">
              <div className="ps-field">
                <label className="ps-label">Profile photo</label>
                <label className={`ps-upload${err('profilePicture') ? ' ps-upload--error' : ''}`}>
                  <span className="ps-upload__icon">
                    {data.photoPreview ? <img src={data.photoPreview} alt="" className="ps-upload__preview" /> : <ImagePlus size={22} />}
                  </span>
                  <span className="ps-upload__text">
                    <span className="ps-upload__title">{photoUploading ? 'Uploading…' : (data.photoPreview ? 'Change photo' : 'Upload profile photo')}</span>
                    <span className="ps-upload__hint">JPG or PNG, up to 5MB</span>
                  </span>
                  <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
                </label>
                {err('profilePicture') && <span className="ps-error">A profile photo is required</span>}
              </div>

              <div className="ps-field">
                <label className="ps-label">Banner image <span className="ps-muted">(Optional)</span></label>
                <label className="ps-upload ps-upload--banner">
                  <span className="ps-upload__icon ps-upload__icon--banner">
                    {data.bannerPreview ? <img src={data.bannerPreview} alt="" className="ps-upload__preview" /> : <ImagePlus size={22} />}
                  </span>
                  <span className="ps-upload__text">
                    <span className="ps-upload__title">{bannerUploading ? 'Uploading…' : (data.bannerPreview ? 'Change banner' : 'Upload a banner image')}</span>
                    <span className="ps-upload__hint">Shown at the top of your profile · JPG or PNG, up to 5MB</span>
                  </span>
                  <input ref={bannerRef} type="file" accept="image/*" hidden onChange={onPickBanner} />
                </label>
              </div>

              <div className="ps-field">
                <label className="ps-label">Name</label>
                <input
                  className={`ps-input${err('name') ? ' ps-input--error' : ''}`}
                  placeholder="Your full name"
                  value={data.name}
                  onChange={(e) => set('name', e.target.value)}
                />
                {err('name') && <span className="ps-error">This field is required</span>}
              </div>

              <div className="ps-field">
                <label className="ps-label">Content style <span className="ps-muted">(Select one or more)</span></label>
                <MultiSelect
                  options={CONTENT_CATEGORIES}
                  selected={data.contentStyles}
                  onToggle={(v) => toggleIn('contentStyles', v)}
                  placeholder="Select the content you create"
                  hasError={err('contentStyles')}
                />
                {data.contentStyles.includes('custom') && (
                  <input className="ps-input" style={{ marginTop: 10 }} placeholder="Describe your custom content style"
                    value={data.customStyle} onChange={(e) => set('customStyle', e.target.value)} />
                )}
                {err('contentStyles') && <span className="ps-error">Select at least one</span>}
              </div>

              <div className="ps-field">
                <label className="ps-label">Content category <span className="ps-muted">(Select one or more)</span></label>
                <MultiSelect
                  options={NICHE_CATEGORIES}
                  selected={data.contentCategories}
                  onToggle={(v) => toggleIn('contentCategories', v)}
                  placeholder="Select what your content is about"
                  hasError={err('contentCategories')}
                />
                {err('contentCategories') && <span className="ps-error">Select at least one</span>}
              </div>

              <div className="ps-field">
                <label className="ps-label">Social links <span className="ps-muted">(At least one)</span></label>
                <div className="ps-links">
                  {PLATFORMS.map(({ key, label, badge, Icon, color }) => {
                    const lerr = showErrors && linkError(key, data.links[key]);
                    return (
                      <div key={key}>
                        <div className={`ps-link${lerr ? ' ps-link--error' : ''}`}>
                          <span className="ps-link__badge" style={{ background: color }}>
                            {Icon ? <Icon size={17} /> : badge}
                          </span>
                          <input
                            ref={(el) => { linkRefs.current[key] = el; }}
                            className="ps-link__input"
                            placeholder={`${label} profile`}
                            value={data.links[key]}
                            onChange={(e) => setLink(key, e.target.value)}
                          />
                          <button type="button" className="ps-link__add" onClick={() => linkRefs.current[key]?.focus()}>
                            +Add social link
                          </button>
                        </div>
                        {lerr && <span className="ps-error ps-link-err">{lerr}</span>}
                      </div>
                    );
                  })}
                  {extraLinks.map((l) => (
                    <div key={l.id} className="ps-link">
                      <span className="ps-link__badge" style={{ background: '#6d7bff' }}><Info size={16} /></span>
                      <input
                        className="ps-link__input"
                        placeholder="Website or custom link"
                        value={l.url}
                        onChange={(e) => setExtraLinks((ls) => ls.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))}
                      />
                      <button type="button" className="ps-link__remove" onClick={() => setExtraLinks((ls) => ls.filter((x) => x.id !== l.id))}>×</button>
                    </div>
                  ))}
                </div>
                <button type="button" className="ps-addlink" onClick={() => setExtraLinks((ls) => [...ls, { id: Date.now(), url: '' }])}>
                  <Plus size={15} /> Add another social link
                </button>
                {err('links') && <span className="ps-error">Add at least one valid social link</span>}
              </div>

              <div className="ps-field">
                <label className="ps-label">Upload your best video</label>
                <p className="ps-fieldsub">UGC, brand ads, reels, or speaking samples work best.</p>
                <div className={`ps-pf${err('videoUrl') ? ' ps-pf--error' : ''}`}>
                  {data.videoPreview ? (
                    <div className="ps-pf-preview">
                      <video src={data.videoPreview} className="ps-pf-vid" muted controls />
                      <button type="button" className="ps-pf-change" onClick={() => videoRef.current?.click()}>
                        {videoUploading ? 'Uploading…' : 'Change video'}
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`ps-pf-drop${videoDragOver ? ' is-over' : ''}`}
                      onClick={() => videoRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setVideoDragOver(true); }}
                      onDragLeave={() => setVideoDragOver(false)}
                      onDrop={onVideoDrop}
                    >
                      <CloudUpload size={26} className="ps-pf-cloud" />
                      <strong>{videoUploading ? 'Uploading…' : 'Drag & drop video'}</strong>
                      <span className="ps-pf-upload-cta"><Upload size={13} /> Upload</span>
                      <span className="ps-pf-max">(max 100 MB)</span>
                    </div>
                  )}
                  <input ref={videoRef} type="file" accept="video/*" hidden onChange={onPickVideo} />
                  <div className="ps-pf-fields">
                    <input className="ps-input" placeholder="Price" inputMode="numeric" value={data.pfPrice} onChange={(e) => set('pfPrice', e.target.value)} />
                    <input className="ps-input" placeholder="Delivery time (days)" inputMode="numeric" value={data.pfDelivery} onChange={(e) => set('pfDelivery', e.target.value)} />
                    <select className="ps-input" value={data.pfCategory} onChange={(e) => set('pfCategory', e.target.value)}>
                      <option value="" disabled>Category</option>
                      {NICHE_CATEGORIES.map((c) => <option key={c.value} value={c.label}>{c.label}</option>)}
                    </select>
                    <button type="button" className="ps-btn-primary ps-pf-add" disabled={videoUploading || !draftReady} onClick={addPortfolioItem}>
                      Add to Profile
                    </button>
                  </div>
                </div>
                {err('portfolio') && <span className="ps-error">Add at least one video to your profile</span>}

                {data.portfolio.length > 0 && (
                  <div className="ps-pf-list">
                    {data.portfolio.map((it) => (
                      <div className="ps-pf-card" key={it.id}>
                        <video src={it.videoUrl} className="ps-pf-card__vid" muted controls />
                        <div className="ps-pf-card__body">
                          <strong>{it.category}</strong>
                          <span>₹{it.price} · Delivered in {it.delivery} {/\d/.test(it.delivery) && !/day/i.test(it.delivery) ? 'day(s)' : ''}</span>
                        </div>
                        <button type="button" className="ps-pf-card__del" onClick={() => removePortfolioItem(it.id)}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ps-note"><Info size={15} /> You can edit this anytime from your profile settings.</div>
            </div>

            <div className="ps-actions">
              <button type="submit" className="ps-btn-primary" disabled={submitting || photoUploading || videoUploading}>
                {submitting ? <><span className="ps-spin" /> Submitting…</> : <>Submit Profile <ArrowRight size={18} /></>}
              </button>
            </div>
          </motion.form>
        )}
      </main>

      <style>{`
        .ps-root {
          --ps-purple: #6d7bff;
          min-height: 100vh;
          background: #0a0a16;
          color: #6d7bff;
          font-family: var(--font-body);
          position: relative;
          overflow-x: hidden;
        }
        .ps-root *, .ps-root *::before, .ps-root *::after { box-sizing: border-box; }
        .ps-root::before { content: ''; position: fixed; inset: 0; background: #0a0a16; z-index: -1; }
        .ps-topbar, .ps-main { background: transparent; }

        .ps-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        .ps-blob { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.45;
          background: linear-gradient(135deg, #1c2570, #11103f); }
        .ps-blob--1 { width: 520px; height: 520px; top: -12%; left: -6%; }
        .ps-blob--2 { width: 460px; height: 460px; bottom: -14%; right: -4%;
          background: linear-gradient(135deg, #1f2a72, #0c0c33); }
        .ps-grid { position: absolute; inset: 0; opacity: 0.25;
          background-image: radial-gradient(rgba(7,7,78,0.10) 1px, transparent 1px);
          background-size: 26px 26px; mask-image: radial-gradient(120% 80% at 50% 0%, #000, transparent 70%); }

        .ps-topbar { position: relative; z-index: 1; display: flex; align-items: center; gap: 16px;
          padding: 20px 7%; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .ps-brand { display: inline-flex; align-items: center; gap: 10px; background: none; border: none; cursor: pointer; padding: 0; }
        .ps-brand__logo { height: 28px; width: auto; display: block; }
        .ps-topbar__tag { margin-left: auto; font-size: 0.82rem; font-weight: 500; letter-spacing: 0.02em;
          color: rgba(255,255,255,0.6); padding: 6px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); }

        .ps-main { position: relative; z-index: 1; max-width: 660px; margin: 0 auto; padding: 26px 5% 80px; }

        .ps-card { position: relative; border-radius: 18px; padding: 26px 28px 22px;
          background: rgba(18,18,26,0.72);
          -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 30px 70px rgba(0,0,0,0.55); overflow: hidden; }
        .ps-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(109,123,255,0.55), transparent); }
        .ps-card__head { margin-bottom: 18px; }
        .ps-title { font-family: var(--font-head); font-size: var(--fs-h2); font-weight: var(--fw-head); margin: 0; color: #ffffff; letter-spacing: -0.01em; }
        .ps-sub { font-size: 0.85rem; color: rgba(255,255,255,0.66); margin: 6px 0 0; }
        .ps-body { display: flex; flex-direction: column; gap: 18px; }

        .ps-upload { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
          padding: 16px 18px; border-radius: 16px; cursor: pointer;
          border: 1px dashed rgba(255,255,255,0.20); background: rgba(255,255,255,0.04); transition: all 0.2s; }
        .ps-upload:hover { background: rgba(255,255,255,0.07); border-color: #6d7bff; }
        .ps-upload--error { border-color: #ef4444 !important; }
        .ps-upload__icon { width: 54px; height: 54px; border-radius: 14px; flex-shrink: 0; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: rgba(109,123,255,0.14); border: 1px solid rgba(109,123,255,0.32); color: #6d7bff; }
        .ps-upload__preview { width: 100%; height: 100%; object-fit: cover; }
        .ps-upload__text { display: flex; flex-direction: column; gap: 3px; }
        .ps-upload__title { font-size: 0.98rem; font-weight: 600; color: #ffffff; }
        .ps-upload__hint { font-size: 0.8rem; color: rgba(255,255,255,0.6); }
        .ps-upload__icon--banner { width: 84px; height: 54px; border-radius: 10px; }

        .ps-field { display: flex; flex-direction: column; gap: 7px; }
        .ps-label { font-size: 0.88rem; font-weight: 600; color: #ffffff; }
        .ps-muted { font-weight: 500; color: rgba(255,255,255,0.5); }
        .ps-input { width: 100%; padding: 10px 13px; border-radius: 10px; font-size: 0.88rem;
          color: #ffffff; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.14);
          outline: none; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; font-family: inherit; }
        .ps-input::placeholder { color: rgba(255,255,255,0.4); }
        .ps-input:focus { border-color: #6d7bff; background: rgba(255,255,255,0.06);
          box-shadow: 0 0 0 4px rgba(109,123,255,0.18); }
        .ps-input--error { border-color: #ef4444 !important; box-shadow: 0 0 0 3px rgba(239,68,68,0.16) !important; }

        .ps-msel { position: relative; }
        .ps-msel__btn { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 11px 13px; border-radius: 10px; font-size: 0.88rem; color: #ffffff; text-align: left;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.14); cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .ps-msel__btn.is-open { border-color: #6d7bff; box-shadow: 0 0 0 4px rgba(109,123,255,0.18); }
        .ps-msel__btn > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ps-msel__ph { color: rgba(255,255,255,0.45); }
        .ps-msel--error .ps-msel__btn { border-color: #ef4444; }
        .ps-msel__chev { flex-shrink: 0; color: rgba(255,255,255,0.5); transition: transform 0.2s; }
        .ps-msel__btn.is-open .ps-msel__chev { transform: rotate(180deg); }
        .ps-msel__menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 30; max-height: 260px; overflow-y: auto;
          padding: 6px; border-radius: 12px; background: #17171f; border: 1px solid rgba(255,255,255,0.14);
          box-shadow: 0 20px 50px rgba(0,0,0,0.55); display: flex; flex-direction: column; gap: 2px; }
        .ps-msel__opt { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 9px; cursor: pointer;
          font-family: inherit; font-size: 0.88rem; color: #eef; background: none; border: none; text-align: left; }
        .ps-msel__opt:hover { background: rgba(255,255,255,0.07); }
        .ps-msel__opt.is-on { background: rgba(109,123,255,0.20); color: #ffffff; }
        .ps-msel__box { flex-shrink: 0; width: 18px; height: 18px; border-radius: 5px; display: grid; place-items: center;
          border: 1.5px solid rgba(255,255,255,0.4); color: #fff; }
        .ps-msel__opt.is-on .ps-msel__box { background: #6d7bff; border-color: #6d7bff; }

        /* Portfolio video: drag & drop on the left, price/delivery/category on the right */
        .ps-fieldsub { font-size: 0.8rem; color: rgba(255,255,255,0.55); margin: -3px 0 2px; }
        .ps-pf { display: flex; gap: 16px; flex-wrap: wrap; padding: 16px; border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.02); }
        .ps-pf--error .ps-pf-drop { border-color: #ef4444; }
        .ps-pf-drop { flex: none; width: 190px; height: 190px; border-radius: 14px; border: 2px dashed rgba(109,123,255,0.5);
          background: rgba(109,123,255,0.06); color: #ffffff; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; padding: 10px; }
        .ps-pf-drop:hover, .ps-pf-drop.is-over { background: rgba(109,123,255,0.14); border-color: #6d7bff; }
        .ps-pf-cloud { color: #6d7bff; }
        .ps-pf-drop strong { font-size: 0.92rem; font-weight: 600; }
        .ps-pf-upload-cta { display: inline-flex; align-items: center; gap: 5px; font-size: 0.8rem; font-weight: 600; color: #6d7bff; margin-top: 4px; }
        .ps-pf-max { font-size: 0.74rem; color: rgba(255,255,255,0.5); }
        .ps-pf-preview { flex: none; width: 190px; display: flex; flex-direction: column; gap: 8px; }
        .ps-pf-vid { width: 100%; aspect-ratio: 1/1; border-radius: 12px; object-fit: cover; background: #000; }
        .ps-pf-change { border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.05); color: #fff;
          border-radius: 9px; padding: 7px 10px; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .ps-pf-change:hover { border-color: #6d7bff; color: #6d7bff; }
        .ps-pf-fields { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 10px; }
        .ps-pf-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .ps-pf-card { display: grid; grid-template-columns: 90px 1fr auto; align-items: center; gap: 12px;
          padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.03); }
        .ps-pf-card__vid { width: 90px; height: 64px; border-radius: 8px; object-fit: cover; background: #000; }
        .ps-pf-card__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .ps-pf-card__body strong { color: #ffffff; font-size: 0.9rem; }
        .ps-pf-card__body span { color: rgba(255,255,255,0.6); font-size: 0.82rem; }
        .ps-pf-card__del { flex-shrink: 0; padding: 7px 14px; border-radius: 9px; cursor: pointer; font-family: inherit;
          font-size: 0.8rem; font-weight: 600; color: #f06d6d; background: none; border: 1px solid rgba(240,109,109,0.4); }
        .ps-pf-card__del:hover { background: rgba(240,109,109,0.1); }

        /* Social platform rows */
        .ps-links { display: flex; flex-direction: column; gap: 10px; }
        .ps-link { display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 12px; border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.03); }
        .ps-link--error { border-color: #ef4444; }
        .ps-link__badge { width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0; color: #fff;
          display: flex; align-items: center; justify-content: center; font-size: 0.95rem; font-weight: 700; }
        .ps-link__input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: #ffffff;
          font-family: inherit; font-size: 0.95rem; }
        .ps-link__input::placeholder { color: rgba(255,255,255,0.4); }
        .ps-link__add { flex-shrink: 0; padding: 8px 14px; border-radius: 9px; cursor: pointer; font-family: inherit;
          font-size: 0.8rem; font-weight: 700; color: #ffffff; background: rgba(109,123,255,0.9); border: none; white-space: nowrap; }
        .ps-link__add:hover { background: #6d7bff; }
        .ps-link__remove { flex-shrink: 0; display: flex; background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.5); padding: 6px; font-size: 1.1rem; }
        .ps-link__remove:hover { color: #fff; }
        .ps-link-err { margin-top: -4px; margin-left: 12px; }
        .ps-addlink { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; margin-top: 4px;
          background: none; border: none; cursor: pointer; font-family: inherit; font-size: 0.88rem; font-weight: 600; color: #6d7bff; }

        @media (max-width: 560px) {
          .ps-pf-drop, .ps-pf-preview { width: 100%; }
        }

        .ps-note { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; line-height: 1.5;
          color: rgba(255,255,255,0.6); padding: 12px 14px;
          border-radius: 12px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.03); }
        .ps-note svg { flex-shrink: 0; }

        .ps-error { font-size: 0.82rem; color: #f06d6d; margin-top: 2px; }

        .ps-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 24px;
          padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.08); }
        .ps-btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 10px 26px; border-radius: 999px;
          font-size: 0.9rem; font-weight: 600; color: #ffffff; cursor: pointer; border: none; font-family: inherit;
          background: #6d7bff; transition: all 0.2s; width: 100%; justify-content: center; }
        .ps-btn-primary:hover { background: #5a63f5; transform: translateY(-2px); }
        .ps-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .ps-btn-primary.ps-pf-add { width: auto; align-self: flex-start; padding: 9px 22px; }
        .ps-spin { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #ffffff; animation: psSpin 0.7s linear infinite; }
        @keyframes psSpin { to { transform: rotate(360deg); } }

        .ps-thanks { text-align: center; padding: 48px 36px; display: flex; flex-direction: column; align-items: center; }
        .ps-thanks__icon { width: 84px; height: 84px; border-radius: 50%; display: flex; align-items: center;
          justify-content: center; color: #22c55e; margin-bottom: 22px;
          background: rgba(34,197,94,0.15); box-shadow: 0 0 0 10px rgba(34,197,94,0.10), 0 16px 40px rgba(34,197,94,0.22); }
        .ps-thanks__title { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-head); font-size: var(--fs-h2); font-weight: var(--fw-head); color: #ffffff; margin: 0 0 12px; }
        .ps-thanks__text { font-size: 0.95rem; line-height: 1.6; color: rgba(255,255,255,0.66); max-width: 420px; margin: 0 0 28px; }
        .ps-thanks__text strong { color: #ffffff; }
        .ps-thanks__actions { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; max-width: 260px; }

        @media (max-width: 560px) {
          .ps-card { padding: 26px 22px; }
        }
      `}</style>
    </div>
  );
}
