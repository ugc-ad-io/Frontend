import { useState, lazy, Suspense } from 'react';
import { useParams, useNavigate, useLocation, matchPath } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Heart, MessageSquare, BadgeCheck, ShieldCheck, Star, Play, Camera, AlertCircle, WifiOff, User, MapPin, Sparkles, Clapperboard, Wallet as WalletIcon } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import withBrandGate from '../../brandkit/withBrandGate';
import BottomSheet from '../../shell/BottomSheet';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { brandName, creatorFirstName } from '../../../utils/displayName';
import { toggleSavedCreator, useSavedCreatorIds } from '../../../utils/savedCreators';
import { s3Preview } from '../../../utils/mediaPreview';
import { mediaUrl } from '../../../utils/mediaUrl';
import PhotoOrInitial from '../../../components/PhotoOrInitial';
import VideoViewer from '../../brandkit/VideoViewer';
import { API, assetUrl, inr, titleCase, loadErrorText } from '../../brandkit/kit';
import './profile.css';

// The existing private-brief flow, mounted as-is (loaded only when "Send a brief" is tapped).
const PlanBrief = lazy(() => import('../../../pages/PlanBrief'));

const isVid = (u) => /\.(mp4|webm|mov|m4v)(?:[?#]|$)|\/video\//i.test(String(u || ''));
const pfItemUrl = (it) => (typeof it === 'string' ? it : (it?.videoUrl || it?.link || it?.url || (Array.isArray(it?.urls) && it.urls[0]) || it?.original_url || ''));
const vidDelivery = (delivery) => {
  const raw = String(delivery ?? '').trim();
  if (!raw) return '';
  return /^\d+$/.test(raw) ? `${raw} day${Number(raw) > 1 ? 's' : ''}` : raw;
};
const vidPrice = (price, fallback) => {
  const raw = String(price ?? '').trim();
  if (!raw) return fallback;
  const digits = raw.replace(/[₹,\s]/g, '');
  return /^\d+$/.test(digits) ? inr(digits) : raw;
};
const relTime = (ts) => {
  if (!ts) return '';
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d < 1) return 'today';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
};
const Stars = ({ n = 0 }) => (
  <span className="ap-pf-stars" aria-label={`${Math.round(n)} out of 5`}>
    {'★★★★★'.split('').map((s, i) => <i key={i} className={i < Math.round(n) ? 'on' : ''}>{s}</i>)}
  </span>
);

function Tile({ v, onOpen }) {
  const [failed, setFailed] = useState(false);
  const [clipFailed, setClipFailed] = useState(false);
  const video = isVid(v.url);
  const src = mediaUrl(v.url);
  const clip = video && !clipFailed ? s3Preview(v.url, 'mp4') : '';
  const poster = video ? s3Preview(v.url, 'jpg') : '';
  return (
    <button type="button" className="ap-pf-tile" onClick={() => !failed && onOpen()} aria-label={`Play ${v.brand || v.category || 'video'}`}>
      <span className="ap-pf-tile-m">
        {failed ? (
          <span className="ap-pf-broken"><Camera size={18} />Media unavailable</span>
        ) : video ? (
          <video src={clip || `${src}#t=0.5`} poster={poster || undefined} muted playsInline preload="metadata" onError={() => (clip ? setClipFailed(true) : setFailed(true))} />
        ) : (
          <img src={src} alt="" onError={() => setFailed(true)} />
        )}
        {!failed && <span className="ap-pf-tile-p"><Play size={13} fill="currentColor" /></span>}
      </span>
      <b>{v.brand || v.category}</b>
      <small>{[v.brand ? v.category : '', v.priceLabel].filter(Boolean).join(' · ')}</small>
    </button>
  );
}

function Review({ rv, reviewers, revCampaigns, fallbackUrl, onClip }) {
  const text = rv.review || rv.review_text || rv.comment || '';
  const who = String(reviewers[rv.reviewer_id]?.name || rv.reviewer_name || 'Brand').replace('@', '');
  const camp = revCampaigns[rv.campaign_id] || {};
  const ws = camp.work_submission || {};
  const selBid = (camp.bids || []).find((b) => b.creator_id === camp.selected_creator) || {};
  const cat = titleCase(camp.category || camp.industry_type || '');
  const price = (camp.budget_max || camp.budget_min) ? inr(camp.budget_max || camp.budget_min) : '';
  const d = selBid.estimated_delivery_days || camp.estimated_delivery_days;
  const vid = (ws.work_files || []).find((f) => isVid(f)) || (ws.work_files || [])[0] || '';
  const clip = vid ? assetUrl(vid) : (fallbackUrl ? assetUrl(fallbackUrl) : '');
  return (
    <article className="ap-pf-rv">
      <div className="ap-pf-rv-top">
        <span className="ap-pf-rv-ava">{reviewers[rv.reviewer_id]?.photo ? <img src={reviewers[rv.reviewer_id].photo} alt="" /> : (who[0] || 'B').toUpperCase()}</span>
        <b>{who}</b>
        <Stars n={rv.rating} />
      </div>
      {text && <p>{text}</p>}
      <div className="ap-pf-rv-foot">
        <small>{[cat, price, d ? `${d} day${Number(d) > 1 ? 's' : ''}` : '', relTime(rv.created_at)].filter(Boolean).join(' · ')}</small>
        {clip && isVid(clip) && (
          <button type="button" className="ap-pf-rv-clip" aria-label="Play delivered clip" onClick={() => onClip(clip)}>
            <video src={`${mediaUrl(clip)}#t=0.5`} muted playsInline preload="metadata" /><span><Play size={12} fill="currentColor" /></span>
          </button>
        )}
      </div>
    </article>
  );
}

// Brand-facing creator profile (board M0 "Creator profile"). Same data as src/components/BrandCreatorProfile.js.
function BrandAppCreatorProfile() {
  // AppOverride renders this screen outside <Route>, so useParams() is empty there: read the id from the URL.
  const params = useParams();
  const { pathname } = useLocation();
  const id = params.id || matchPath('/dashboard/business/creator/:id', pathname)?.params.id;
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [reviewers, setReviewers] = useState({});
  const [revCampaigns, setRevCampaigns] = useState({});
  const [lb, setLb] = useState(null);
  const [clip, setClip] = useState('');
  const [allRev, setAllRev] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const saved = useSavedCreatorIds(me?.role === 'business').has(String(id));

  useLiveEffect(() => {
    let a = true;
    axios.get(`${API}/profile/${id}`)
      .then((r) => { if (a) { setData(r.data); setError(''); } })
      .catch((e) => { if (a) setError(loadErrorText(e, 'Could not load this profile.')); })
      .finally(() => { if (a) setLoading(false); });
    axios.get(`${API}/reviews/creator/${id}`).then((r) => { if (a) setReviews(Array.isArray(r.data) ? r.data : []); }).catch(() => {});
    return () => { a = false; };
  }, [id, attempt]);

  // Reviewer (brand) names + avatars.
  useLiveEffect(() => {
    const ids = [...new Set(reviews.map((r) => r.reviewer_id).filter(Boolean))];
    if (!ids.length) return undefined;
    let a = true;
    Promise.all(ids.map((rid) => axios.get(`${API}/profile/${rid}`).then((r) => [rid, r.data]).catch(() => [rid, null])))
      .then((pairs) => {
        if (!a) return;
        const m = {};
        pairs.forEach(([rid, d]) => {
          if (!d) return;
          m[rid] = { name: (d.profile && d.profile.business_name) || d.business_name || brandName(d), photo: assetUrl(d.profile_photo || d.logo || (d.profile && d.profile.logo)) };
        });
        setReviewers(m);
      });
    return () => { a = false; };
  }, [reviews]);

  // The campaign behind each review (price, delivery time, category, delivered video).
  useLiveEffect(() => {
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

  const reviewCount = reviews.length;
  const avgRating = reviewCount ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount : 0;

  const p = { ...(data || {}), ...(data?.profile || {}) };
  const name = data ? creatorFirstName(data) : '';
  const city = p.city || p.location || '';
  const country = p.country || 'India';
  const languages = Array.isArray(p.languages) ? p.languages : (p.languages ? [p.languages] : []);
  const rc = p.rate_card || {};
  const priceNum = String(rc.expected_payout || p.expectedPayout || '').replace(/[^0-9]/g, '');
  const avatar = assetUrl(data?.profile_photo || data?.profile_picture || p.profile_photo || p.profile_picture);
  const deliverables = Number(data?.deliverables_completed ?? p.deliverables_completed ?? 0);
  const basePrice = priceNum ? inr(priceNum) : (data?.budget_range || p.budget_range || 'On request');
  const categoryTxt = p.customCategory || p.category || '';
  const skills = Array.isArray(p.skills) ? p.skills : (Array.isArray(data?.tags) ? data.tags : []);
  const picked = [...new Map(
    [...(Array.isArray(p.content_categories) ? p.content_categories : []), ...(Array.isArray(p.contentCategories) ? p.contentCategories : [])]
      .map((v) => String(v || '').replace(/_/g, ' ').trim()).filter(Boolean).map((v) => [v.toLowerCase(), titleCase(v)]),
  ).values()];
  const nicheTxt = p.niche || categoryTxt || p.primary_category || (Array.isArray(p.categories) ? p.categories[0] : '') || skills[0] || '';
  const hlCategory = titleCase(nicheTxt || 'General');
  const hlCategories = picked.length ? picked.join(', ') : hlCategory;

  const portfolio = [...(Array.isArray(p.portfolio_items) ? p.portfolio_items : []), ...(Array.isArray(data?.portfolio) ? data.portfolio : []), ...(Array.isArray(p.portfolio) ? p.portfolio : [])];
  if (!portfolio.length && p.intro_video) portfolio.push(p.intro_video);
  const vids = portfolio
    .map((it) => {
      const url = pfItemUrl(it);
      const meta = typeof it === 'string' ? {} : it;
      return { url, category: titleCase(meta.category) || hlCategory, priceLabel: vidPrice(meta.price, basePrice), delivery: vidDelivery(meta.delivery), brand: meta.brand || '' };
    })
    .filter((v, i, all) => v.url && !String(v.url).startsWith('blob:') && all.findIndex((o) => o.url === v.url) === i);

  const vidDays = vids.map((v) => Number(String(v.delivery).replace(/[^0-9]/g, ''))).filter((n) => n > 0);
  const setDays = Number(p.delivery_days || p.avg_delivery_days || rc.delivery_days || 0) || 0;
  const days = setDays || (vidDays.length ? Math.max(...vidDays) : 0);
  const hlDelivery = days ? `${days} day${days > 1 ? 's' : ''}` : '';

  const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []));
  const groups = [
    { title: 'About', Icon: User, rows: [['Age', p.age], ['Gender', p.gender], ['Body type', p.bodyType], ['Skin tone', p.skinTone], ['Primary category', categoryTxt && titleCase(categoryTxt)]] },
    { title: 'Location', Icon: MapPin, rows: [['Country', p.country], ['State', p.state], ['City', p.city]] },
    { title: 'Skills & languages', Icon: Sparkles, rows: [['Skills', skills], ['Languages', languages]] },
    { title: 'Recording setup', Icon: Clapperboard, rows: [['Core setup', p.coreSetup], ['Who appears', p.appearIn], ['Can bring', p.bring], ['Weekly availability', p.weekly || p.availability_calendar?.weekly], ['Flexible hours', p.flexible ? 'Yes' : ''], ['Topics avoided', p.topics]] },
    { title: 'Pricing', Icon: WalletIcon, rows: [['Expected payout', vidPrice(rc.expected_payout || p.expectedPayout, '')], ['Payout period', rc.payout_period || p.payoutPeriod], ['Budget range', data?.budget_range || p.budget_range]] },
  ].map((g) => ({ ...g, rows: g.rows.map(([k, v]) => [k, list(v)]).filter(([, v]) => v.length) })).filter((g) => g.rows.length);

  const stats = [
    hlDelivery && ['Delivery', hlDelivery],
    ['Price / video', basePrice],
    deliverables > 0 && ['Deliverables', String(deliverables)],
  ].filter(Boolean);
  const bio = p.bio || p.about || p.description || '';

  const level = String(data?.level || p.level || '').toLowerCase();
  const levelLabel = { elite: 'Elite', l2: 'Level 2', l1: 'Level 1' }[level];
  const choice = !!(data?.ugcad_approved || p.ugcad_approved);

  const toggleSave = async () => {
    const now = await toggleSavedCreator({ id: id || data?.id });
    if (now !== saved) toast.success(now ? 'Creator saved to your list' : 'Removed from saved');
  };
  const retry = () => { setLoading(true); setError(''); setAttempt((n) => n + 1); };
  const begin = () => { setLb(null); setBriefOpen(true); };
  const message = () => navigate(`/messages?conv=${id}`);

  const heart = (
    <button type="button" className={`ap-bar-btn ap-pf-heart${saved ? ' is-on' : ''}`} onClick={toggleSave} aria-label={saved ? `Remove ${name || 'creator'} from saved` : `Save ${name || 'creator'}`} aria-pressed={saved} disabled={loading && !data}>
      <Heart size={22} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );

  if (error && !data) {
    return (
      <AppShell title="Creator" back tabs={false}>
        <div className="ap-empty" role="alert">
          {error.startsWith("You're offline") ? <WifiOff size={30} color="#6e6e96" /> : <AlertCircle size={30} color="#e5484d" />}
          <h3>Could not load this profile</h3>
          <p>{error}</p>
          <button type="button" className="ap-btn" onClick={retry}>Retry</button>
        </div>
      </AppShell>
    );
  }

  const shownReviews = reviews.slice(0, 3);
  const stat = (n) => reviews.filter((r) => Math.round(r.rating || 0) === n).length;
  const fallbackFor = (i) => (vids[i % (vids.length || 1)] || {}).url || '';
  const reviewProps = { reviewers, revCampaigns, onClip: setClip };

  return (
    <AppShell title={loading ? '' : name} back tabs={false} right={heart}>
      <section className="ap-pf-hero">
        <span className="ap-pf-ava">
          {loading ? <span className="ap-skel" style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%' }} /> : <PhotoOrInitial src={avatar} initial={name.charAt(0).toUpperCase()} />}
        </span>
        <div className="ap-pf-who">
          {loading ? (
            <><span className="ap-skel" style={{ display: 'block', width: 150, height: 26 }} /><span className="ap-skel" style={{ display: 'block', width: 200, height: 14, marginTop: 10 }} /></>
          ) : (
            <>
              <h2>{name}{data?.kyc_verified && <BadgeCheck size={20} color="#4E60E6" aria-label="Identity verified" />}</h2>
              {choice ? <span className="ap-pf-badge ap-pf-badge--choice">UGCAD.IO Choice</span>
                : levelLabel ? <span className="ap-pf-badge">{levelLabel}</span> : null}
              <div className="ap-pf-meta">
                {reviewCount > 0 && <span><Star size={13} fill="#07074E" color="#07074E" /> <strong>{avgRating.toFixed(1)}</strong> ({reviewCount})</span>}
                {deliverables > 0 && <span>{deliverables} deliverables</span>}
                {(city || country) && <span>{[city, country].filter(Boolean).join(', ')}</span>}
              </div>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="ap-pf-vh">
        <div className="ap-pf-sh"><h2 id="ap-pf-vh">Videos</h2>{vids.length > 0 && <small>Tap to play</small>}</div>
        {loading ? (
          <div className="ap-pf-strip">{[0, 1, 2].map((i) => <span key={i} className="ap-skel ap-pf-tsk" />)}</div>
        ) : vids.length === 0 ? (
          <div className="ap-card ap-pf-none"><b>No videos uploaded yet</b><small>{name} has not added any sample videos.</small></div>
        ) : (
          <div className="ap-pf-strip">{vids.map((v, i) => <Tile key={v.url} v={v} onOpen={() => setLb(i)} />)}</div>
        )}
      </section>

      {!loading && stats.length > 0 && (
        <section className="ap-pf-stats" aria-label="Highlights">
          {stats.map(([k, v]) => <div key={k}><b>{v}</b><small>{k}</small></div>)}
        </section>
      )}

      <section className="ap-card ap-pf-about" aria-labelledby="ap-pf-ah">
        <h2 id="ap-pf-ah">About {loading ? 'this creator' : name}</h2>
        {loading ? <span className="ap-skel" style={{ display: 'block', height: 60 }} /> : (
          <>
            {bio && <p className="ap-pf-bio">{bio}</p>}
            <dl className="ap-pf-facts">
              <div><dt>{hlCategories.includes(',') ? 'Categories' : 'Category'}</dt><dd>{hlCategories}</dd></div>
              {languages.length > 0 && <div><dt>Languages</dt><dd>{languages.slice(0, 4).join(', ')}</dd></div>}
            </dl>
            {groups.length === 0 && <p className="ap-pf-muted">This creator hasn&rsquo;t shared more details yet.</p>}
            {groups.map((g) => (
              <div className="ap-pf-group" key={g.title}>
                <span className="ap-pf-gic"><g.Icon size={17} /></span>
                <div>
                  <div className="ap-pf-gt">{g.title}</div>
                  {g.rows.map(([k, v]) => (
                    <div className="ap-pf-row" key={k}>
                      <small>{k}</small>
                      <div className="ap-pf-chipset">{v.map((x, i) => <span key={i}>{typeof x === 'string' ? x : (x?.label || x?.name || '')}</span>)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </section>

      <section className="ap-card" aria-labelledby="ap-pf-rh">
        <div className="ap-pf-rh"><h2 id="ap-pf-rh">Reviews</h2>{reviewCount > 0 && <strong>{`★ ${avgRating.toFixed(1)}`}</strong>}</div>
        {reviewCount === 0 ? (
          <div className="ap-pf-revempty"><Star size={24} color="#c9c9e2" /><b>No reviews yet</b><small>Reviews from brands appear here once a deal is completed.</small></div>
        ) : (
          <>
            <div className="ap-pf-sum">
              <div className="ap-pf-score"><b>{avgRating.toFixed(1)}</b><Stars n={avgRating} /><small>{reviewCount} review{reviewCount === 1 ? '' : 's'}</small></div>
              <div className="ap-pf-bars">
                {[5, 4, 3, 2, 1].map((n) => <div key={n}><span>{n}</span><i><em style={{ width: `${(stat(n) / reviewCount) * 100}%` }} /></i><span>{stat(n)}</span></div>)}
              </div>
            </div>
            {shownReviews.map((rv, i) => <Review key={rv.id || i} rv={rv} fallbackUrl={fallbackFor(i)} {...reviewProps} />)}
            {reviewCount > 3 && <button type="button" className="ap-link ap-pf-more" onClick={() => setAllRev(true)}>{`Show all ${reviewCount}`}</button>}
          </>
        )}
      </section>

      <div className="ap-pf-safe"><ShieldCheck size={20} color="#4E60E6" /><span><b>Your money is safe.</b> Payment stays in escrow until you approve the final video.</span></div>
      <div className="ap-pf-spacer" aria-hidden="true" />

      <div className="ap-pf-bar">
        <div className="ap-pf-from"><small>From</small><b>{loading ? '…' : basePrice}</b></div>
        <button type="button" className="ap-pf-msg" onClick={message} disabled={loading} aria-label={`Message ${name || 'creator'}`}><MessageSquare size={22} /></button>
        <button type="button" className="ap-pf-brief" onClick={begin} disabled={loading}>Send a brief</button>
      </div>

      <BottomSheet open={allRev} onClose={() => setAllRev(false)} title="All reviews" subtitle={`${reviewCount} from brands · ★ ${avgRating.toFixed(1)}`} tall>
        {reviews.map((rv, i) => <Review key={rv.id || i} rv={rv} fallbackUrl={fallbackFor(i)} {...reviewProps} />)}
      </BottomSheet>

      {lb != null && vids.length > 0 && (
        <VideoViewer
          items={vids.map((v) => ({ src: mediaUrl(v.url), name: v.brand || `${name}’s video`, sub: [v.category, v.priceLabel, v.delivery ? `delivered in ${v.delivery}` : ''].filter(Boolean).join(' · '), image: !isVid(v.url), watermark: true }))}
          index={Math.min(lb, vids.length - 1)}
          onIndex={setLb}
          onClose={() => setLb(null)}
          onBrief={begin}
          briefLabel={`Send ${name} a brief`}
        />
      )}
      {clip && <VideoViewer items={[{ src: mediaUrl(clip), name: 'Delivered video', watermark: true }]} onClose={() => setClip('')} />}

      <Suspense fallback={null}>
        {briefOpen && <PlanBrief creatorId={id} creatorName={name} onClose={() => setBriefOpen(false)} onPublished={() => setBriefOpen(false)} />}
      </Suspense>
    </AppShell>
  );
}

export default withBrandGate(BrandAppCreatorProfile);
