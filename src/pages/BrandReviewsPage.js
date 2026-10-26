import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Star, ArrowRight } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import BrandPageHead from '../components/BrandPageHead';
import { creatorFirstName } from '../utils/displayName';
import '../styles/creator-marketplace.css';
import '../styles/brand-mobile.css';
import '../styles/brand-ui-pages.css';
import '../styles/brand-ui-reviews.css';
import '../styles/brand-ui-mobile-b.css';
import PhotoOrInitial from '../components/PhotoOrInitial';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const AVA_COLORS = ['#111827', '#ef6f6f', '#22a565', '#f0931d', '#5b6bff', '#23236a', '#2f8de0'];
const avaColor = (name) => AVA_COLORS[(String(name || 'C').toUpperCase().charCodeAt(0) || 0) % AVA_COLORS.length];
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

function Stars({ rating = 0 }) {
  return (
    <span className="bui-rv-stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={16} className={i < rating ? '' : 'empty'} />
      ))}
    </span>
  );
}

/**
 * Brand-side reviews page — the mirror of the creator ReviewsPage. Shows the
 * reviews CREATORS left for this brand after a completed deal
 * (GET /reviews/business/:id, reviewee_role == 'business').
 */
export default function BrandReviewsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [campaigns, setCampaigns] = useState({});
  const [reviewers, setReviewers] = useState({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const lookups = useRef({ campaigns: {}, reviewers: {} });

  useLiveEffect(() => {
    if (user?.approval_status !== 'approved') { setLoading(false); return; }
    fetchData();
    const interval = setInterval(() => { if (!document.hidden) fetchData(); }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const reviewsRes = await axios.get(`${API}/reviews/business/${user.id}`);
      const reviewsList = reviewsRes.data || [];
      const campaignIds = [...new Set(reviewsList.map((r) => r.campaign_id).filter(Boolean))];
      const reviewerIds = [...new Set(reviewsList.map((r) => r.reviewer_id).filter(Boolean))];

      // The page re-polls every 15s: only look up campaigns / reviewers not seen yet, so a quiet
      // page costs one request per tick instead of one per review twice over (mobile data).
      const known = lookups.current;
      await Promise.all(campaignIds.filter((id) => !known.campaigns[id]).map(async (id) => {
        try { known.campaigns[id] = (await axios.get(`${API}/campaigns/${id}`)).data; } catch { /* skip */ }
      }));
      await Promise.all(reviewerIds.filter((id) => !known.reviewers[id]).map(async (id) => {
        try { known.reviewers[id] = (await axios.get(`${API}/profile/${id}`)).data; } catch { /* skip */ }
      }));

      setCampaigns({ ...known.campaigns });
      setReviewers({ ...known.reviewers });
      setReviews(reviewsList);
      setFailed(false);
    } catch (error) {
      // The page re-polls every 15s: say it once (inline), not as a toast every tick.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const count = reviews.length;
  const avg = count ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / count) : 0;
  const fiveStars = reviews.filter((r) => (r.rating || 0) >= 5).length;
  const uniqueCreators = new Set(reviews.map((r) => r.reviewer_id).filter(Boolean)).size;

  const visible = showAll ? reviews : reviews.slice(0, 3);

  return (
    <BrandTopNavLayout>
      <div className="bui-main">
        <BrandPageHead title="Reviews" subtitle="What creators say about working with you. Good reviews help you get better bids." />

        {loading ? (
          <div aria-hidden="true">
            <div className="bui-rv-stats">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bui-rv-sk" style={{ height: 112, borderRadius: 14 }} />)}
            </div>
            <div className="bui-rv-sk" style={{ height: 220, borderRadius: 14, marginTop: 24 }} />
          </div>
        ) : (
          <>
            <div className="bui-rv-stats">
              <section className="bui-rv-hero">
                <span className="bui-rv-glow" aria-hidden="true" />
                <div>
                  <small>Average rating</small>
                  <div className="bui-rv-big"><b>{avg ? avg.toFixed(1) : '-'}</b><span>/ 5</span></div>
                  <Stars rating={Math.round(avg)} />
                </div>
              </section>
              <div className="bui-rv-stat"><small>Total reviews</small><b>{count}</b><span>From completed campaigns</span></div>
              <div className="bui-rv-stat"><small>5-star reviews</small><b>{fiveStars}</b><span>{count ? Math.round((fiveStars / count) * 100) : 0}% of all reviews</span></div>
              <div className="bui-rv-stat"><small>Creators</small><b>{uniqueCreators}</b><span>{uniqueCreators === 1 ? 'Creator worked with' : 'Creators worked with'}</span></div>
            </div>

            <div className="bui-rv-cols">
              <section className="bui-rv-panel">
                <h2 className="bui-rv-h">Rating breakdown</h2>
                <div className="bui-rv-bars">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const c = reviews.filter((r) => Math.round(r.rating || 0) === star).length;
                    const pct = count ? Math.round((c / count) * 100) : 0;
                    return (
                      <div key={star} className="bui-rv-bar">
                        <span>{star} star</span>
                        <i><b style={{ width: `${pct}%` }} /></i>
                        <span>{c} · {pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="bui-rv-panel bui-rv-panel--list">
                <h2 className="bui-rv-h">What creators say about you</h2>

                {count === 0 && failed ? (
                  <div className="bui-empty" style={{ border: 0 }}>
                    <h3>Couldn't load reviews</h3>
                    <p>Check your connection and try again.</p>
                    <button type="button" className="bui-btn" onClick={() => { setLoading(true); fetchData(); }}>Try again</button>
                  </div>
                ) : count === 0 ? (
                  <div className="bui-empty" style={{ border: 0 }}>
                    <h3>No reviews yet</h3>
                    <p>Once creators complete campaigns with you, their reviews will appear here.</p>
                  </div>
                ) : (
                  <>
                    {visible.map((review) => {
                      const reviewText = review.review || review.review_text || review.comment || '';
                      const reviewer = reviewers[review.reviewer_id];
                      const campaign = campaigns[review.campaign_id];
                      const campaignTitle = campaign?.title || 'Campaign';
                      // First name only — a creator's full legal name shouldn't be on
                      // display here (matches the creator card / bid list elsewhere).
                      const creatorName = creatorFirstName(reviewer);
                      const photo = reviewer?.profile_photo ? (reviewer.profile_photo.startsWith('http') ? reviewer.profile_photo : `${BACKEND_URL}${reviewer.profile_photo}`) : '';
                      // The reviewer is a creator — let the brand open their full profile
                      // straight from the review (avatar + name are the hit target).
                      const creatorId = review.reviewer_id;
                      const openProfile = () => {
                        if (!creatorId) { toast.error('This creator is unavailable'); return; }
                        navigate(`/dashboard/business/creator/${creatorId}`);
                      };
                      return (
                        <article key={review.id} className="bui-rv-item">
                          <span
                            className={`bui-rv-ava${creatorId ? ' is-link' : ''}`}
                            style={{ background: photo ? 'transparent' : avaColor(creatorName) }}
                            onClick={openProfile}
                            role={creatorId ? 'button' : undefined}
                            tabIndex={creatorId ? 0 : undefined}
                            onKeyDown={(e) => { if (creatorId && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openProfile(); } }}
                            title={creatorId ? `View ${creatorName}'s profile` : undefined}
                          >
                            <PhotoOrInitial src={photo} initial={creatorName.charAt(0).toUpperCase()} />
                          </span>
                          <div className="bui-rv-main">
                            <div className="bui-rv-top">
                              {creatorId ? (
                                <button type="button" className="bui-rv-name" onClick={openProfile}>{creatorName}</button>
                              ) : (
                                <strong className="bui-rv-name">{creatorName}</strong>
                              )}
                              <Stars rating={review.rating} />
                              <b>{(review.rating || 0).toFixed(1)}</b>
                              <span className="bui-rv-tag">Verified</span>
                              <span className="bui-rv-when">{relTime(review.created_at)}</span>
                            </div>
                            <div className="bui-rv-camp">Campaign: {campaignTitle}</div>
                            {reviewText && <p className="bui-rv-text">{reviewText}</p>}
                          </div>
                        </article>
                      );
                    })}
                    {count > 3 && (
                      <button type="button" className="bui-rv-more" onClick={() => setShowAll((v) => !v)}>
                        {showAll ? 'Show recent' : `View all ${count} reviews`} <ArrowRight size={15} />
                      </button>
                    )}
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </BrandTopNavLayout>
  );
}
