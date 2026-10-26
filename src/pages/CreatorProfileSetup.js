import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { uploadMedia, tooLargeMessage, MAX_UPLOAD_MB } from '../utils/upload';
import UploadProgress from '../components/UploadProgress';
import { useAuth } from '../App';
import { ImagePlus, Camera, Check, ArrowRight, ArrowLeft, Plus, Info, Instagram, CloudUpload, Upload, Lightbulb } from 'lucide-react';
import CreatorOnboardBar from '../components/CreatorOnboardBar';
import CreatorGate from '../components/CreatorGate';
import '../styles/creator-ui-onboarding.css';
import '../styles/creator-ui-mobile-profile.css';
import { NICHE_CATEGORIES, CONTENT_CATEGORIES } from '../constants/contentCategories';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;


// Instagram only — YouTube/LinkedIn/TikTok rows removed by request. The keys
// stay in LINK_RE and data.links so old submissions with those links still load.
const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', Icon: Instagram, color: 'linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5)' },
];
// Share-sheet tracking params (?igsh=, ?si=, ?s=20) are allowed after the profile path.
const LINK_RE = {
  youtube:   /^(https?:\/\/)?(www\.)?(youtube\.com\/(@[\w.-]+|channel\/|c\/|user\/)[\w./-]*|youtu\.be\/[\w-]+)\/?(?:[?#][^\s]*)?$/i,
  linkedin:  /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company|pub|school)\/[\w%.-]+\/?(?:[?#][^\s]*)?$/i,
  // Full profile link only, no bare @handle — a handle alone can't actually be
  // opened to verify the account is real, which is the whole point of asking.
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/[a-z0-9._]+\/?(?:[?#][^\s]*)?$/i,
  tiktok:    /^(https?:\/\/)?(www\.)?tiktok\.com\/@?[\w.-]+\/?(?:[?#][^\s]*)?$|^@?[a-z0-9._]{1,30}$/i,
};
const linkError = (key, value) => {
  const v = String(value || '').trim();
  if (!v) return '';
  if (LINK_RE[key].test(v)) return '';
  return key === 'instagram' ? 'Enter your full Instagram profile link (e.g. https://instagram.com/yourhandle)' : `Enter a valid ${key} link or @handle`;
};

export default function CreatorProfileSetup() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(null);
  const photoRef = useRef(null);
  const bannerRef = useRef(null);
  const videoRef = useRef(null);
  const prefilledRef = useRef(false);
  const linkRefs = useRef({});
  const [extraLinks, setExtraLinks] = useState([]); // user-added custom links: { id, url }

  const [addingMore, setAddingMore] = useState(false);
  const [step, setStep] = useState(0); // 0 About you, 1 Your videos, 2 Rates
  const [data, setData] = useState({
    photoPreview: '', profilePicture: '',
    bannerPreview: '', banner: '',
    name: '',
    contentStyles: [], customStyle: '',
    contentCategories: [],
    videoName: '', videoPreview: '', videoUrl: '',
    pfCategory: '', pfPrice: '', pfDelivery: '',
    rawPayout: '', editingPayout: '',
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
      rawPayout: String(pr.rate_card?.raw_payout || pr.rate_card?.expected_payout || ''),
      editingPayout: String(pr.rate_card?.editing_payout || ''),
      portfolio: Array.isArray(pr.portfolio_items) && pr.portfolio_items.length
        ? pr.portfolio_items.map((it, i) => ({
            id: i + 1, category: it.category || '', price: it.price || '', delivery: it.delivery || '',
            videoUrl: it.videoUrl || it.url || '',
          }))
        : d.portfolio,
      // Only the platforms the form has a rule for: a saved custom link (link_1, ...)
      // used to land here, and linkError() then threw on it, blanking the whole form
      // for exactly the creator who was asked for more info.
      links: { ...d.links, ...Object.fromEntries(Object.entries(pr.social_links || {}).filter(([k]) => k in LINK_RE)) },
    }));
    // Custom links were saved as link_1, link_2... and belong in the extra rows.
    setExtraLinks(Object.entries(pr.social_links || {}).filter(([k, v]) => /^link_\d+$/.test(k) && v).map(([, v], i) => ({ id: i + 1, url: String(v) })));
    if (Array.isArray(pr.portfolio_items)) pfIdRef.current = pr.portfolio_items.length + 1;
  }, [user?.id, user?.profile]);

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
    if (file.size > MAX_UPLOAD_MB * 1048576) { toast.error(tooLargeMessage(file)); return; }
    setVideoUploading(true);
    setVideoProgress(0);
    setData((d) => ({ ...d, videoName: file.name, videoPreview: URL.createObjectURL(file) }));
    try {
      const res = await uploadMedia(file, API, { onProgress: setVideoProgress });
      let url = res?.file_url || res?.url;
      if (url && url.startsWith('/')) url = `${BACKEND_URL}${url}`;
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
  const onPickVideo = (e) => { uploadVideoFile(e.target.files?.[0]); e.target.value = ''; };
  const [videoDragOver, setVideoDragOver] = useState(false);
  const onVideoDrop = (e) => {
    e.preventDefault();
    setVideoDragOver(false);
    uploadVideoFile(e.dataTransfer.files?.[0]);
  };

  const draftReady = data.videoUrl && Number(data.pfPrice) > 0 && Number(data.pfDelivery) > 0 && data.pfCategory;
  useEffect(() => {
    if (!draftReady || videoUploading) return;
    const timer = setTimeout(() => {
      const id = pfIdRef.current++;
      setData(d => ({ ...d, portfolio: [...d.portfolio, { id, category: d.pfCategory, price: d.pfPrice, delivery: d.pfDelivery, videoUrl: d.videoUrl }], videoName: '', videoPreview: '', videoUrl: '', pfCategory: '', pfPrice: '', pfDelivery: '' }));
      setAddingMore(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [draftReady, data.videoUrl, data.pfPrice, data.pfDelivery, data.pfCategory, videoUploading]);
  const removePortfolioItem = (id) => setData((d) => ({ ...d, portfolio: d.portfolio.filter((it) => it.id !== id) }));

  const linksFilled = Object.values(data.links).some((v) => v.trim());
  const linksValid = Object.entries(data.links).every(([k, v]) => !linkError(k, v));
  const checks = {
    profilePicture: !!data.profilePicture,
    name: data.name.trim() !== '',
    contentStyles: data.contentStyles.length > 0,
    contentCategories: data.contentCategories.length > 0,
    portfolio: data.portfolio.length > 0 || Boolean(draftReady),
    rawPayout: Number(data.rawPayout) > 0,
    links: linksFilled && linksValid,
  };
  const err = (k) => showErrors && !checks[k];

  // Which required fields belong to which wizard step (the final submit still checks all of them).
  const STEP_KEYS = [['profilePicture', 'name', 'links'], ['contentStyles', 'contentCategories', 'portfolio'], ['rawPayout']];
  const stepOk = (i) => STEP_KEYS[i].every((k) => checks[k]);
  const scrollToError = () => setTimeout(() => {
    document.querySelector('.cui-s .is-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 60);
  const goStep = (i) => { setShowErrors(false); setStep(i); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const goNext = () => {
    if (!stepOk(step)) { setShowErrors(true); scrollToError(); return; }
    goStep(step + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < 2) { goNext(); return; } // Enter inside a field on steps 1-2 moves on instead of submitting
    if (!Object.values(checks).every(Boolean)) {
      // jump back to the first step that still has something missing
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
        portfolio_items: portfolio.map((it) => ({
          title: 'Portfolio Sample',
          category: it.category, price: it.price, delivery: it.delivery,
          videoUrl: it.videoUrl, url: it.videoUrl,
        })),
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to submit profile'));
    } finally {
      setSubmitting(false);
    }
  };

  const nicheLabel = NICHE_CATEGORIES.find((c) => data.contentCategories[0] === c.value)?.label || '';
  const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
  const raw = Number(data.rawPayout) || 0;
  const edit = Number(data.editingPayout) || 0;
  const previewVideos = [...data.portfolio.map((it) => it.videoUrl), data.videoPreview].filter(Boolean).slice(0, 3);
  const STEP_NAMES = ['About you', 'Your videos', 'Rates', 'Get paid'];

  if (submitted) {
    return (
      <CreatorGate
        icon={Check}
        chip="In review"
        title="Profile submitted"
        lead="Thanks for submitting your creator profile. Our team will review it and get back to you within 24-48 hours."
        stage={1}
        actions={(
          <>
            <button type="button" className="cui-s-btn cui-s-btn--ink" onClick={() => navigate('/kyc')}>Add payout details</button>
            <button type="button" className="cui-s-btn" onClick={() => { logout(); }}>
              Back to sign in <ArrowRight size={16} />
            </button>
          </>
        )}
      />
    );
  }

  // Live "how brands see you" card, built from what the creator has entered so far.
  const sidePreview = (
    <div className="cui-s-card">
      <div className="cui-s-side-h">HOW BRANDS SEE YOU</div>
      <div className="cui-s-pv">
        <div className="cui-s-pv-v">
          {previewVideos.length
            ? previewVideos.map((u, i) => <video key={`${u}-${i}`} src={u} muted playsInline preload="metadata" />)
            : <span>Your videos show here</span>}
        </div>
        <div className="cui-s-pv-r">
          <span className="cui-s-pv-a">{data.photoPreview ? <img src={data.photoPreview} alt="" /> : (data.name.trim().charAt(0).toUpperCase() || '?')}</span>
          <div className="cui-s-pv-n">
            <b>{data.name.trim() || 'Your name'}</b>
            <span>{nicheLabel || 'Your niche'}</span>
          </div>
          {raw > 0 && (
            <div className="cui-s-pv-p"><small>From</small><strong>{money(raw)}</strong></div>
          )}
        </div>
      </div>
      {step === 2 && raw > 0 && (
        <div className="cui-s-sum">
          <div><span>Raw video</span><span>{money(raw)}</span></div>
          {edit > 0 && <div><span>With your edit</span><span>{money(raw + edit)}</span></div>}
        </div>
      )}
    </div>
  );
  const TIPS = [
    'Use your real name and a clear face photo - brands pick creators they can trust.',
    'Put your strongest hook in the first 3 seconds of each video.',
    'You can change your rates any time from your profile settings.',
  ];

  return (
    <div className="cui-s">
      <CreatorOnboardBar right={<span>Step {step + 1} of 4</span>} />

      <div className="cui-s-wrap">
        <div className="cui-s-steps" aria-label="Profile setup progress">
          {STEP_NAMES.map((name, i) => (
            <span key={name} style={{ display: 'contents' }}>
              {i > 0 && <span className={`cui-s-line${i <= step ? ' is-done' : ''}`} />}
              <div className={`cui-s-step${i === step ? ' is-now' : ''}${i < step ? ' is-done' : ''}`} aria-current={i === step ? 'step' : undefined}>
                <span className="cui-s-dot">{i < step ? <Check size={15} /> : i + 1}</span>
                <span>{name}</span>
              </div>
            </span>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cui-s-grid">
            <div className="cui-s-col">
              {step === 0 && (
                <>
                  <div className="cui-s-card">
                    <h1 className="cui-s-h">About you</h1>
                    <p className="cui-s-sub">Brands see this on your card and profile.</p>
                    <div className="cui-s-body">
                      <div className="cui-s-field">
                        <label className={`cui-s-pick${err('profilePicture') ? ' is-error' : ''}`}>
                          <span className="cui-s-avatar">
                            {data.photoPreview ? <img src={data.photoPreview} alt="" /> : <ImagePlus size={24} />}
                            <b><Camera size={13} /></b>
                          </span>
                          <span>
                            <strong>{photoUploading ? 'Uploading…' : (data.photoPreview ? 'Change photo' : 'Upload profile photo')}</strong>
                            <small>JPG or PNG, up to 5MB</small>
                          </span>
                          <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
                        </label>
                        {err('profilePicture') && <span className="cui-s-err">A profile photo is required</span>}
                      </div>

                      <div className="cui-s-field">
                        <label className="cui-s-pick">
                          <span className="cui-s-avatar is-wide">
                            {data.bannerPreview ? <img src={data.bannerPreview} alt="" /> : <ImagePlus size={22} />}
                          </span>
                          <span>
                            <strong>{bannerUploading ? 'Uploading…' : (data.bannerPreview ? 'Change banner' : 'Banner image')} <em style={{ fontStyle: 'normal', fontWeight: 500, color: '#9a9ac0' }}>(Optional)</em></strong>
                            <small>Shown at the top of your profile · JPG or PNG, up to 5MB</small>
                          </span>
                          <input ref={bannerRef} type="file" accept="image/*" hidden onChange={onPickBanner} />
                        </label>
                      </div>

                      <div className="cui-s-field">
                        <label className="cui-s-label" htmlFor="ps-name">Name brands see</label>
                        <div className={`cui-s-inp${err('name') ? ' is-error' : ''}`}>
                          <input id="ps-name" placeholder="Your full name" autoComplete="name" value={data.name} onChange={(e) => set('name', e.target.value)} />
                        </div>
                        {err('name') && <span className="cui-s-err">This field is required</span>}
                      </div>

                      <div className="cui-s-field">
                        <label className="cui-s-label">Instagram profile <em>(Required)</em></label>
                        <div className="cui-s-links">
                          {PLATFORMS.map(({ key, label, Icon, color }) => {
                            const lerr = showErrors && linkError(key, data.links[key]);
                            return (
                              <div key={key}>
                                <div className={`cui-s-link${lerr || err('links') ? ' is-error' : ''}`}>
                                  <span className="cui-s-link-b" style={{ background: color }}><Icon size={18} /></span>
                                  <input
                                    ref={(el) => { linkRefs.current[key] = el; }}
                                    aria-label={`${label} profile link`}
                                    placeholder={key === 'instagram' ? 'https://instagram.com/yourhandle' : `${label} profile`}
                                    value={data.links[key]}
                                    onChange={(e) => setLink(key, e.target.value)}
                                  />
                                </div>
                                {lerr && <span className="cui-s-err">{lerr}</span>}
                              </div>
                            );
                          })}
                          {extraLinks.map((l) => (
                            <div key={l.id} className="cui-s-link">
                              <span className="cui-s-link-b" style={{ background: '#7387ff' }}><Info size={17} /></span>
                              <input
                                aria-label="Website or custom link"
                                placeholder="Website or custom link"
                                value={l.url}
                                onChange={(e) => setExtraLinks((ls) => ls.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))}
                              />
                              <button type="button" className="cui-s-link-x" aria-label="Remove link" onClick={() => setExtraLinks((ls) => ls.filter((x) => x.id !== l.id))}>×</button>
                            </div>
                          ))}
                        </div>
                        <button type="button" className="cui-s-textbtn" onClick={() => setExtraLinks((ls) => [...ls, { id: Date.now(), url: '' }])}>
                          <Plus size={15} /> Add another social link
                        </button>
                        {err('links') && <span className="cui-s-err">Add your full Instagram profile link</span>}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="cui-s-card">
                    <h1 className="cui-s-h">Your best videos</h1>
                    <p className="cui-s-sub">UGC, brand ads, reels, or speaking samples work best. These show first on your card.</p>
                    <div className="cui-s-body">
                      {data.portfolio.length > 0 && (
                        <div className="cui-s-vids">
                          {data.portfolio.map((it) => (
                            <div className="cui-s-vid" key={it.id}>
                              <video src={it.videoUrl} muted playsInline preload="metadata" />
                              <button type="button" className="cui-s-vid-x" onClick={() => removePortfolioItem(it.id)} aria-label={`Remove ${it.category} video`}>Remove</button>
                              <div className="cui-s-vid-m">
                                {it.category}
                                <span>₹{it.price} · {it.delivery} {/\d/.test(it.delivery) && !/day/i.test(it.delivery) ? 'day(s)' : ''}</span>
                              </div>
                            </div>
                          ))}
                          {!addingMore && (
                            <button type="button" className="cui-s-addv" onClick={() => setAddingMore(true)}>
                              <Plus size={22} />+ Add more videos<small>or drag here</small>
                            </button>
                          )}
                        </div>
                      )}

                      {(data.portfolio.length === 0 || addingMore) && (
                        <div className={`cui-s-draft${err('portfolio') ? ' is-error' : ''}`}>
                          {data.videoPreview ? (
                            <div className="cui-s-prev">
                              <video src={data.videoPreview} muted controls playsInline />
                              <button type="button" className="cui-s-btn is-sm" onClick={() => videoRef.current?.click()}>
                                {videoUploading ? 'Uploading…' : 'Change video'}
                              </button>
                              <UploadProgress percent={videoUploading ? videoProgress : null} />
                            </div>
                          ) : (
                            <div
                              className={`cui-s-drop${videoDragOver ? ' is-over' : ''}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => videoRef.current?.click()}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); videoRef.current?.click(); } }}
                              onDragOver={(e) => { e.preventDefault(); setVideoDragOver(true); }}
                              onDragLeave={() => setVideoDragOver(false)}
                              onDrop={onVideoDrop}
                            >
                              <CloudUpload size={28} />
                              <strong>{videoUploading ? 'Uploading…' : 'Add video'}</strong>
                              <span className="cui-s-up"><Upload size={14} /> Upload</span>
                              <span>or drag here (max {MAX_UPLOAD_MB} MB)</span>
                              <UploadProgress percent={videoUploading ? videoProgress : null} />
                            </div>
                          )}
                          <input ref={videoRef} type="file" accept="video/*" hidden onChange={onPickVideo} />
                          <div className="cui-s-draft-f">
                            <div className="cui-s-inp"><input placeholder="Price" aria-label="Price" inputMode="numeric" value={data.pfPrice} onChange={(e) => set('pfPrice', e.target.value)} /></div>
                            <div className="cui-s-inp"><input placeholder="Delivery time (days)" aria-label="Delivery time in days" inputMode="numeric" value={data.pfDelivery} onChange={(e) => set('pfDelivery', e.target.value)} /></div>
                            <div className="cui-s-inp">
                              <select aria-label="Category" value={data.pfCategory} onChange={(e) => set('pfCategory', e.target.value)}>
                                <option value="" disabled>Category</option>
                                {NICHE_CATEGORIES.map((c) => <option key={c.value} value={c.label}>{c.label}</option>)}
                              </select>
                            </div>
                            <p className="cui-s-hint">Your video is added automatically once price, delivery time and category are filled.</p>
                          </div>
                        </div>
                      )}
                      {err('portfolio') && <span className="cui-s-err">Add at least one video to your profile</span>}
                    </div>
                  </div>

                  <div className="cui-s-card">
                    <h2 className="cui-s-h">What you make best</h2>
                    <p className="cui-s-sub">We use this to match you with briefs.</p>
                    <div className="cui-s-body">
                      <div className="cui-s-label">Content style <em>(Select one or more)</em></div>
                      <div className={`cui-s-chips${err('contentStyles') ? ' is-error' : ''}`}>
                        {CONTENT_CATEGORIES.map((o) => {
                          const on = data.contentStyles.includes(o.value);
                          return (
                            <button key={o.value} type="button" className={`cui-s-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggleIn('contentStyles', o.value)}>
                              {on && <Check size={14} />}{o.label}
                            </button>
                          );
                        })}
                      </div>
                      {data.contentStyles.includes('custom') && (
                        <div className="cui-s-inp"><input placeholder="Describe your custom content style" aria-label="Custom content style" value={data.customStyle} onChange={(e) => set('customStyle', e.target.value)} /></div>
                      )}
                      {err('contentStyles') && <span className="cui-s-err">Select at least one</span>}

                      <div className="cui-s-label">Content category <em>(Select one or more)</em></div>
                      <div className={`cui-s-chips${err('contentCategories') ? ' is-error' : ''}`}>
                        {NICHE_CATEGORIES.map((o) => {
                          const on = data.contentCategories.includes(o.value);
                          return (
                            <button key={o.value} type="button" className={`cui-s-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggleIn('contentCategories', o.value)}>
                              {on && <Check size={14} />}{o.label}
                            </button>
                          );
                        })}
                      </div>
                      {err('contentCategories') && <span className="cui-s-err">Select at least one</span>}
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <div className="cui-s-card">
                  <h1 className="cui-s-h">Price per video</h1>
                  <p className="cui-s-sub">You can change these any time from your profile settings.</p>
                  <div className="cui-s-body">
                    <div className="cui-s-rate">
                      <div>
                        <label htmlFor="raw-payout"><b>Raw video payout per video</b></label>
                        <small>The brand edits it</small>
                      </div>
                      <span className={`cui-s-money${err('rawPayout') ? ' is-error' : ''}`}>
                        ₹<input id="raw-payout" type="number" min="1" required inputMode="numeric" value={data.rawPayout} onChange={(e) => set('rawPayout', e.target.value)} />
                      </span>
                    </div>
                    {err('rawPayout') && <span className="cui-s-err">Enter a payout above 0</span>}
                    <div className="cui-s-rate">
                      <div>
                        <label htmlFor="editing-payout"><b>Additional editing payout per video</b></label>
                        <small>Extra if you also edit it (optional)</small>
                      </div>
                      <span className="cui-s-money">
                        +₹<input id="editing-payout" type="number" min="0" inputMode="numeric" value={data.editingPayout} onChange={(e) => set('editingPayout', e.target.value)} />
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="cui-s-col cui-s-aside">
              {sidePreview}
              <div className="cui-s-tip"><Lightbulb size={18} /><span>{TIPS[step]}</span></div>
            </div>
          </div>

          <div className="cui-s-foot">
            {step > 0
              ? <button type="button" className="cui-s-btn" onClick={() => goStep(step - 1)}><ArrowLeft size={16} /> Back</button>
              : <span />}
            {step < 2 ? (
              <button type="button" className="cui-s-btn cui-s-btn--pri" onClick={goNext} disabled={photoUploading || bannerUploading || videoUploading}>
                {step === 0 ? 'Next: your videos' : 'Next: your rates'} <ArrowRight size={16} />
              </button>
            ) : (
              <button type="submit" className="cui-s-btn cui-s-btn--pri" disabled={submitting || photoUploading || videoUploading}>
                {submitting ? <><span className="cui-s-spin" /> Submitting…</> : <>Submit profile <ArrowRight size={16} /></>}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
