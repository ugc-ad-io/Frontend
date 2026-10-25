import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Star, Check, WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { resolveLevelKey } from '../../../utils/creatorLevel';
import './profile.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const AVA_COLORS = ['#07074E', '#2A3AB8', '#9D174D', '#0F766E', '#B45309', '#7C3AED', '#0369A1'];
const avaColor = (name) => AVA_COLORS[(String(name || 'B').toUpperCase().charCodeAt(0) || 0) % AVA_COLORS.length];
const relTime = (d) => {
  if (!d) return 'Recent';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) { const w = Math.floor(days / 7); return `${w} week${w > 1 ? 's' : ''} ago`; }
  if (days < 365) { const m = Math.floor(days / 30); return `${m} month${m > 1 ? 's' : ''} ago`; }
  const y = Math.floor(days / 365); return `${y} year${y > 1 ? 's' : ''} ago`;
};

// Same five tiers as the backend (creator_features.py CREATOR_LEVELS); `days` = payout delay after approval at that level.
const LADDER = [
  { key: 'new', label: 'New', sub: 'Sign up', days: 12 },
  { key: 'verified', label: 'Verified', sub: 'ID verified', days: 7 },
  { key: 'l1', label: 'Level 1', sub: 'Rising', days: 5 },
  { key: 'l2', label: 'Pro', sub: 'Level 2', days: 3 },
  { key: 'elite', label: 'UGCAD.IO Choice', sub: 'Our pick', days: 2 },
];

function Stars({ rating = 0, size = 14 }) {
  return (
    <span className="ap-rv-stars" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} fill={i < rating ? '#F5A524' : 'none'} color={i < rating ? '#F5A524' : '#D3D4EA'} />
      ))}
    </span>
  );
}

export default function CreatorReviews() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [campaigns, setCampaigns] = useState({});
  const [reviewers, setReviewers] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const loadedRef = useRef(false);

  const fetchData = async () => {
    try {
      const reviewsList = (await axios.get(`${API}/reviews/creator/${user.id}`)).data || [];
      const list = Array.isArray(reviewsList) ? reviewsList : [];
      const campaignIds = [...new Set(list.map((r) => r.campaign_id).filter(Boolean))];
      const reviewerIds = [...new Set(list.map((r) => r.reviewer_id).filter(Boolean))];
      const campaignsData = {};
      await Promise.all(campaignIds.map(async (id) => {
        try { campaignsData[id] = (await axios.get(`${API}/campaigns/${id}`)).data; } catch { /* title falls back to "Campaign" */ }
      }));
      const reviewersData = {};
      await Promise.all(reviewerIds.map(async (id) => {
        try { reviewersData[id] = (await axios.get(`${API}/profile/${id}`)).data; } catch { /* name falls back to "Brand" */ }
      }));
      setCampaigns(campaignsData);
      setReviewers(reviewersData);
      setReviews(list);
      setLoadError('');
      loadedRef.current = true;
    } catch (error) {
      // Background refreshes keep the last reviews on screen; only a first load shows the error.
      if (!loadedRef.current) setLoadError(error?.response ? 'Could not load your reviews.' : "You're offline. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };
  useLiveEffect(() => {
    if (user?.approval_status !== 'approved') { setLoading(false); return; }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const retry = () => { setLoading(true); setLoadError(''); fetchData(); };

  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count : 0;
  const fiveStars = reviews.filter((r) => (r.rating || 0) >= 5).length;
  const uniqueBrands = new Set(reviews.map((r) => r.reviewer_id).filter(Boolean)).size;

  const levelKey = resolveLevelKey(user?.level ?? user?.level_key ?? user?.level_label);
  const levelIdx = LADDER.findIndex((s) => s.key === levelKey);
  const isChoice = Boolean(user?.ugcad_approved) || levelKey === 'elite';
  const cur = isChoice ? LADDER.length - 1 : Math.max(0, levelIdx);
  const levelTitle = levelKey === 'elite' ? 'UGCAD.IO Choice' : `${LADDER[Math.max(0, levelIdx)].label}${isChoice ? ' · UGCAD.IO Choice' : ''}`;
  const payoutDays = LADDER[Math.max(0, levelIdx)].days;
  const next = LADDER[cur + 1];
  const offline = loadError.startsWith("You're offline");

  return (
    <AppShell title="Reviews & level" subtitle="What brands say about you" back="/profile">
      <section className="ap-card ap-rv-level">
        <small>Your level</small>
        <h2>{levelTitle}</h2>
        <span className="ap-rv-next">
          {next ? <><b>Next: {next.label}</b> · payout {payoutDays} days after approval</> : <><b>Top level reached</b> · payout {payoutDays} days after approval</>}
        </span>
        <ol className="ap-rv-ladder" aria-label="Creator levels">
          <span className="ap-rv-line" aria-hidden="true"><i style={{ width: `${(cur / (LADDER.length - 1)) * 100}%` }} /></span>
          {LADDER.map((s, i) => (
            <li key={s.key} className={i < cur ? 'is-done' : i === cur ? 'is-cur' : ''} aria-current={i === cur ? 'step' : undefined}>
              <span className="ap-rv-dot">{i < cur ? <Check size={16} strokeWidth={3} /> : i === LADDER.length - 1 ? <Star size={15} fill="#fff" color="#fff" /> : i + 1}</span>
              <b>{s.label}</b>
              <small>{s.sub}</small>
            </li>
          ))}
        </ol>
      </section>

      {loading ? (
        <div className="ap-prof-skel" aria-busy="true" aria-label="Loading reviews">
          <div className="ap-skel" style={{ height: 130, borderRadius: 20 }} />
          <div className="ap-skel" style={{ height: 200, borderRadius: 20 }} />
        </div>
      ) : user?.approval_status !== 'approved' ? (
        <div className="ap-card ap-empty">
          <Star size={30} color="#7387ff" />
          <h3>Reviews unlock after approval</h3>
          <p>Once your profile is approved and you complete deals, brand reviews show up here.</p>
        </div>
      ) : loadError && !reviews.length ? (
        <div className="ap-card ap-empty" role="alert">
          {offline ? <WifiOff size={30} color="#6e6e96" /> : <AlertCircle size={30} color="#e5484d" />}
          <h3>{offline ? "You're offline" : 'Could not load reviews'}</h3>
          <p>{loadError}</p>
          <button type="button" className="ap-btn" onClick={retry}><RefreshCw size={16} /> Retry</button>
        </div>
      ) : (
        <>
          <section className="ap-card">
            <div className="ap-rv-sum">
              <div className="ap-rv-avg">
                <b>{avg ? avg.toFixed(1) : '-'}</b>
                <Stars rating={Math.round(avg)} size={15} />
                <small>{count} review{count === 1 ? '' : 's'}</small>
              </div>
              <div className="ap-rv-bars">
                {[5, 4, 3, 2, 1].map((star) => {
                  const c = reviews.filter((r) => Math.round(r.rating || 0) === star).length;
                  const pct = count ? Math.round((c / count) * 100) : 0;
                  return (
                    <div key={star} className="ap-rv-bar">
                      <span>{star}★</span>
                      <span className="ap-rv-track"><i style={{ width: `${pct}%` }} /></span>
                      <span title={`${pct}%`}>{c}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {count === 0 ? (
              <div className="ap-empty">
                <Star size={28} color="#7387ff" />
                <h3>No reviews yet</h3>
                <p>Complete campaigns and deliver great work to start earning reviews from brands.</p>
                <button type="button" className="ap-btn" onClick={() => navigate('/browse-briefs')}>Find briefs</button>
              </div>
            ) : (
              <>
                <div className="ap-rv-list">
                  {(showAll ? reviews : reviews.slice(0, 3)).map((review) => {
                    const text = review.review || review.review_text || review.comment || '';
                    const reviewer = reviewers[review.reviewer_id];
                    const campaign = campaigns[review.campaign_id];
                    const brand = reviewer?.nickname || reviewer?.full_name || 'Brand';
                    const photo = reviewer?.profile_photo ? (reviewer.profile_photo.startsWith('http') ? reviewer.profile_photo : `${BACKEND_URL}${reviewer.profile_photo}`) : '';
                    return (
                      <article key={review.id} className="ap-rv-item">
                        <div className="ap-rv-item-h">
                          <span className="ap-rv-ava" style={{ background: photo ? 'transparent' : avaColor(brand) }}>
                            {photo ? <img src={photo} alt="" /> : brand.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <strong>{brand}</strong>
                            <small>{campaign?.title || 'Campaign'} · {relTime(review.created_at)}</small>
                          </div>
                          <Stars rating={Math.round(review.rating || 0)} />
                        </div>
                        {text && <p>{text}</p>}
                      </article>
                    );
                  })}
                </div>
                {count > 3 && (
                  <button type="button" className="ap-btn ap-btn--ghost ap-btn--block" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Show recent' : `View all ${count} reviews`}
                  </button>
                )}
              </>
            )}
          </section>

          <section className="ap-card">
            <h2 className="ap-card-h">At a glance</h2>
            <div className="ap-rv-glance">
              <div><small>Average rating</small><b>{avg ? `${avg.toFixed(1)} / 5` : '-'}</b></div>
              <div><small>Total reviews</small><b>{count}</b></div>
              <div><small>5-star reviews</small><b>{fiveStars} <em>({count ? Math.round((fiveStars / count) * 100) : 0}%)</em></b></div>
              <div><small>{uniqueBrands === 1 ? 'Brand worked with' : 'Brands worked with'}</small><b>{uniqueBrands}</b></div>
            </div>
            <p className="ap-rv-tip">
              {isChoice
                ? <>You&apos;re at the top level. <strong>Keep delivering on time</strong> and keep great reviews coming in to stay UGCAD.IO Choice.</>
                : <>Great reviews and on-time delivery help you move up. <strong>Your payout is released {payoutDays} days after approval</strong> at your level.</>}
            </p>
          </section>
        </>
      )}
    </AppShell>
  );
}
