import { useLiveEffect } from '../lib/liveUpdates';
import { useState } from 'react';
import { useAuth } from '../App';
import axios from 'axios';
import { Star, Check } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import CreatorPageHead from '../components/CreatorPageHead';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { resolveLevelKey } from '../utils/creatorLevel';
import '../styles/creator-ui-reviews.css';

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

// Level ladder (same five tiers the backend uses: creator_features.py CREATOR_LEVELS).
// The top step is "UGCAD.IO Choice" - shown as reached for the backend's top tier or an admin-approved creator.
// `days` = how long after approval the payout is released at that level (PAYOUT_DELAY_DAYS_BY_LEVEL).
const LADDER = [
  { key: 'new', label: 'New', sub: 'Sign up', days: 12 },
  { key: 'verified', label: 'Verified', sub: 'ID verified', days: 7 },
  { key: 'l1', label: 'Level 1', sub: 'Rising', days: 5 },
  { key: 'l2', label: 'Pro', sub: 'Level 2', days: 3 },
  { key: 'elite', label: 'UGCAD.IO Choice', sub: 'Picked by our team', days: 2 },
];

function Stars({ rating = 0 }) {
  return (
    <span className="cui-r-stars" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={15} fill={i < rating ? '#F5A524' : 'none'} color={i < rating ? '#F5A524' : '#D3D4EA'} />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [campaigns, setCampaigns] = useState({});
  const [reviewers, setReviewers] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useLiveEffect(() => {
    if (user?.approval_status !== 'approved') { setLoading(false); return; }
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const reviewsRes = await axios.get(`${API}/reviews/creator/${user.id}`);
      const reviewsList = reviewsRes.data || [];
      const campaignIds = [...new Set(reviewsList.map((r) => r.campaign_id).filter(Boolean))];
      const reviewerIds = [...new Set(reviewsList.map((r) => r.reviewer_id).filter(Boolean))];

      const campaignsData = {};
      await Promise.all(campaignIds.map(async (id) => {
        try { campaignsData[id] = (await axios.get(`${API}/campaigns/${id}`)).data; } catch { /* skip */ }
      }));
      const reviewersData = {};
      await Promise.all(reviewerIds.map(async (id) => {
        try { reviewersData[id] = (await axios.get(`${API}/profile/${id}`)).data; } catch { /* skip */ }
      }));

      setCampaigns(campaignsData);
      setReviewers(reviewersData);
      setReviews(reviewsList);
      setLoadError('');
    } catch (error) {
      // Polled every 15s: keep the last reviews on screen; only show the error when nothing loaded yet.
      setLoadError(error?.response ? 'Could not load your reviews.' : "You're offline. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const count = reviews.length;
  const avg = count ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / count) : 0;
  const fiveStars = reviews.filter((r) => (r.rating || 0) >= 5).length;
  const uniqueBrands = new Set(reviews.map((r) => r.reviewer_id).filter(Boolean)).size;

  // Level ladder state
  const levelKey = resolveLevelKey(user?.level ?? user?.level_key ?? user?.level_label);
  const levelIdx = LADDER.findIndex((s) => s.key === levelKey);
  const isChoice = Boolean(user?.ugcad_approved) || levelKey === 'elite';
  const cur = isChoice ? LADDER.length - 1 : Math.max(0, levelIdx);
  const levelTitle = levelKey === 'elite' ? 'UGCAD.IO Choice' : `${LADDER[Math.max(0, levelIdx)].label}${isChoice ? ' · UGCAD.IO Choice' : ''}`;
  const payoutDays = LADDER[Math.max(0, levelIdx)].days;
  const next = LADDER[cur + 1];

  return (
    <CreatorTopNavLayout>
      <CreatorPageHead title="Reviews & level" subtitle="What brands say about you, and your level." hideSearch />

      <section className="cui-r-card cui-r-level">
        <div className="cui-r-level-h">
          <div>
            <small>Your level</small>
            <h2>{levelTitle}</h2>
          </div>
          <span className="cui-r-pill">
            {next
              ? <><strong>Next: {next.label}</strong> · payout {payoutDays} days after approval</>
              : <><strong>Top level reached</strong> · payout {payoutDays} days after approval</>}
          </span>
        </div>
        <ol className="cui-r-ladder" aria-label="Creator levels">
          <span className="cui-r-line" aria-hidden="true"><i style={{ width: `${(cur / (LADDER.length - 1)) * 100}%` }} /></span>
          {LADDER.map((s, i) => (
            <li key={s.key} className={i < cur ? 'is-done' : i === cur ? 'is-cur' : ''} aria-current={i === cur ? 'step' : undefined}>
              <span className={`cui-r-dot${i === LADDER.length - 1 ? ' is-top' : ''}`}>
                {i < cur ? <Check size={18} strokeWidth={3} /> : i === LADDER.length - 1 ? <Star size={17} fill="#fff" color="#fff" /> : i + 1}
              </span>
              <b>{s.label}</b>
              <small>{s.sub}</small>
            </li>
          ))}
        </ol>
      </section>

      {loading ? (
        <div className="cui-r-grid" aria-hidden="true">
          <section className="cui-r-card">
            <Skeleton width={140} height={44} style={{ marginBottom: 16 }} />
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0' }}>
                <Skeleton width={34} height={34} radius={10} style={{ flex: 'none' }} />
                <div style={{ flex: 1 }}><Skeleton width="40%" height={14} style={{ marginBottom: 8 }} /><Skeleton width="90%" height={12} /></div>
              </div>
            ))}
          </section>
          <section className="cui-r-card"><Skeleton width={160} height={16} style={{ marginBottom: 16 }} /><Skeleton height={60} /></section>
        </div>
      ) : loadError && !reviews.length ? (
        <div className="cui-r-card">
          <EmptyState title="Could not load reviews" message={loadError} action={{ label: 'Retry', onClick: () => { setLoading(true); fetchData(); } }} />
        </div>
      ) : (
        <div className="cui-r-grid">
          <section className="cui-r-card cui-r-main">
            <div className="cui-r-sum">
              <div className="cui-r-avg">
                <b>{avg ? avg.toFixed(1) : '-'}</b>
                <Stars rating={Math.round(avg)} />
                <small>{count} review{count === 1 ? '' : 's'}</small>
              </div>
              <div className="cui-r-bars">
                {[5, 4, 3, 2, 1].map((star) => {
                  const c = reviews.filter((r) => Math.round(r.rating || 0) === star).length;
                  const pct = count ? Math.round((c / count) * 100) : 0;
                  return (
                    <div key={star} className="cui-r-bar">
                      <span>{star}★</span>
                      <span className="cui-r-track"><i style={{ width: `${pct}%` }} /></span>
                      <span className="cui-r-n" title={`${pct}%`}>{c}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {count === 0 ? (
              <EmptyState icon={Star} title="No reviews yet" message="Complete campaigns and deliver great work to start earning reviews from brands." />
            ) : (
              <>
                <div className="cui-r-list">
                  {(showAll ? reviews : reviews.slice(0, 3)).map((review) => {
                    const reviewText = review.review || review.review_text || review.comment || '';
                    const reviewer = reviewers[review.reviewer_id];
                    const campaign = campaigns[review.campaign_id];
                    const campaignTitle = campaign?.title || 'Campaign';
                    const businessName = reviewer?.nickname || reviewer?.full_name || 'Brand';
                    const photo = reviewer?.profile_photo ? (reviewer.profile_photo.startsWith('http') ? reviewer.profile_photo : `${BACKEND_URL}${reviewer.profile_photo}`) : '';
                    return (
                      <article key={review.id} className="cui-r-item">
                        <div className="cui-r-item-h">
                          <span className="cui-r-ava" style={{ background: photo ? 'transparent' : avaColor(businessName) }}>
                            {photo ? <img src={photo} alt="" /> : businessName.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <strong>{businessName}</strong>
                            <small>{campaignTitle} · {relTime(review.created_at)}</small>
                          </div>
                          <Stars rating={Math.round(review.rating || 0)} />
                        </div>
                        {reviewText && <p>{reviewText}</p>}
                      </article>
                    );
                  })}
                </div>
                {count > 3 && (
                  <button type="button" className="cui-r-all" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Show recent' : `View all ${count} reviews`}
                  </button>
                )}
              </>
            )}
          </section>

          <aside className="cui-r-card cui-r-side">
            <h2>At a glance</h2>
            <dl>
              <div><dt>Average rating</dt><dd>{avg ? `${avg.toFixed(1)} / 5` : '-'}</dd></div>
              <div><dt>Total reviews</dt><dd>{count}</dd></div>
              <div><dt>5-star reviews</dt><dd>{fiveStars} <em>({count ? Math.round((fiveStars / count) * 100) : 0}%)</em></dd></div>
              <div><dt>{uniqueBrands === 1 ? 'Brand worked with' : 'Brands worked with'}</dt><dd>{uniqueBrands}</dd></div>
            </dl>
            <p className="cui-r-tip">
              {isChoice
                ? <>You&apos;re at the top level. <strong>Keep delivering on time</strong> and keep great reviews coming in to stay UGCAD.IO Choice.</>
                : <>Great reviews and on-time delivery help you move up. <strong>Your payout is released {payoutDays} days after approval</strong> at your level.</>}
            </p>
          </aside>
        </div>
      )}
    </CreatorTopNavLayout>
  );
}
