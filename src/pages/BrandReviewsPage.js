import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Star, Trophy, MessagesSquare, TrendingUp, Users, ArrowRight } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import { creatorFirstName } from '../utils/displayName';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';

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
    <span className="cmk-rev-stars">
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
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (user?.approval_status !== 'approved') { setLoading(false); return; }
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const reviewsRes = await axios.get(`${API}/reviews/business/${user.id}`);
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
    } catch (error) {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const count = reviews.length;
  const avg = count ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / count) : 0;
  const fiveStars = reviews.filter((r) => (r.rating || 0) >= 5).length;
  const uniqueCreators = new Set(reviews.map((r) => r.reviewer_id).filter(Boolean)).size;

  return (
    <BrandTopNavLayout>
      <div className="cmk-page-head cmk-rise">
        <h1>Reviews</h1>
        <p>See what creators think about working with you and build your brand reputation.</p>
      </div>

      {loading ? (
        <>
          <div className="cmk-rev-top">
            {/* 4 stat tiles — matches the 2×2 stats grid */}
            <div className="cmk-stats cmk-stats-sm cmk-stats-2l cmk-rev-stats cmk-rev-stats-2x2" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div className="cmk-stat" key={i}>
                  <div className="cmk-stat-head">
                    <Skeleton width={38} height={38} radius={12} />
                    <Skeleton width={100} height={12} />
                  </div>
                  <div className="cmk-stat-row" style={{ marginTop: 12 }}>
                    <Skeleton width={70} height={26} />
                    <Skeleton width={90} height={12} />
                  </div>
                </div>
              ))}
            </div>
            {/* Rating breakdown panel */}
            <section className="cmk-rev-panel cmk-rev-top-breakdown" aria-hidden="true">
              <Skeleton width={150} height={16} style={{ marginBottom: 16 }} />
              <div className="cmk-rb-list">
                {[5, 4, 3, 2, 1].map((s) => (
                  <div key={s} className="cmk-rb-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Skeleton width={54} height={12} />
                    <Skeleton height={8} radius={999} style={{ flex: 1 }} />
                    <Skeleton width={50} height={12} />
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Recent reviews list */}
          <section className="cmk-rev-panel cmk-rev-recent" aria-hidden="true">
            <Skeleton width={150} height={16} style={{ marginBottom: 16 }} />
            <div className="cmk-rr-list">
              {Array.from({ length: 3 }).map((_, i) => (
                <article className="cmk-rr-item" key={i} style={{ display: 'flex', gap: 14 }}>
                  <Skeleton width={44} height={44} radius="50%" style={{ flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                      <Skeleton width={110} height={14} />
                      <Skeleton width={90} height={14} />
                    </div>
                    <Skeleton width="100%" height={12} style={{ marginBottom: 6 }} />
                    <Skeleton width="75%" height={12} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
      <>
      <div className="cmk-rev-top">
      <div className="cmk-stats cmk-stats-sm cmk-stats-2l cmk-rev-stats cmk-rev-stats-2x2">
        <div className="cmk-stat">
          <div className="cmk-stat-head"><div className="cmk-ic cmk-ic-orange"><Star size={20} /></div><div className="cmk-stat-lbl">Average Rating</div></div>
          <div className="cmk-stat-row">
            <div className="cmk-stat-val">{avg ? avg.toFixed(1) : '—'}<span style={{ fontSize: 15, color: '#9296ba' }}> / 5</span></div>
            <div className="cmk-stat-meta"><Stars rating={Math.round(avg)} /></div>
          </div>
        </div>
        <div className="cmk-stat">
          <div className="cmk-stat-head"><div className="cmk-ic cmk-ic-indigo"><MessagesSquare size={20} /></div><div className="cmk-stat-lbl">Total Reviews</div></div>
          <div className="cmk-stat-row">
            <div className="cmk-stat-val">{count}</div>
            <div className="cmk-stat-meta"><span>From completed campaigns</span></div>
          </div>
        </div>
        <div className="cmk-stat">
          <div className="cmk-stat-head"><div className="cmk-ic cmk-ic-green"><Trophy size={20} /></div><div className="cmk-stat-lbl">5-Star Reviews</div></div>
          <div className="cmk-stat-row">
            <div className="cmk-stat-val">{fiveStars}</div>
            <div className="cmk-stat-meta cmk-up"><TrendingUp size={14} /> {count ? Math.round((fiveStars / count) * 100) : 0}% <span>of all reviews</span></div>
          </div>
        </div>
        <div className="cmk-stat">
          <div className="cmk-stat-head"><div className="cmk-ic cmk-ic-blue"><Users size={20} /></div><div className="cmk-stat-lbl">Creators</div></div>
          <div className="cmk-stat-row">
            <div className="cmk-stat-val">{uniqueCreators}</div>
            <div className="cmk-stat-meta"><span>{uniqueCreators === 1 ? 'Creator worked with' : 'Creators worked with'}</span></div>
          </div>
        </div>
      </div>

          <section className="cmk-rev-panel cmk-rev-top-breakdown">
            <h3 className="cmk-rev-h">Rating Breakdown</h3>
            <div className="cmk-rb-list">
              {[5, 4, 3, 2, 1].map((star) => {
                const c = reviews.filter((r) => Math.round(r.rating || 0) === star).length;
                const pct = count ? Math.round((c / count) * 100) : 0;
                return (
                  <div key={star} className="cmk-rb-row">
                    <span className="cmk-rb-label">{star} {star === 1 ? 'Star' : 'Stars'}</span>
                    <span className="cmk-rb-track"><i style={{ width: `${pct}%` }} /></span>
                    <span className="cmk-rb-val">{c} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </section>
      </div>

          {/* Recent Reviews (full width, below) */}
          <section className="cmk-rev-panel cmk-rev-recent">
            <div className="cmk-rev-phead">
              <h3 className="cmk-rev-h">Recent Reviews</h3>
              {count > 3 && (
                <button type="button" className="cmk-rev-all" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show recent' : 'View all reviews'} <ArrowRight size={15} />
                </button>
              )}
            </div>

            {count === 0 ? (
              <EmptyState icon={Star} title="No reviews yet" message="Once creators complete campaigns with you, their reviews will appear here." />
            ) : (
              <div className="cmk-rr-list">
                {(showAll ? reviews : reviews.slice(0, 3)).map((review) => {
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
                    <article key={review.id} className="cmk-rr-item">
                      <span
                        className={`cmk-rr-ava${creatorId ? ' is-link' : ''}`}
                        style={{ background: photo ? 'transparent' : avaColor(creatorName) }}
                        onClick={openProfile}
                        role={creatorId ? 'button' : undefined}
                        tabIndex={creatorId ? 0 : undefined}
                        onKeyDown={(e) => { if (creatorId && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openProfile(); } }}
                        title={creatorId ? `View ${creatorName}'s profile` : undefined}
                      >
                        {photo ? <img src={photo} alt="" /> : creatorName.charAt(0).toUpperCase()}
                      </span>
                      <div className="cmk-rr-main">
                        <div className="cmk-rr-top">
                          {creatorId ? (
                            <button type="button" className="cmk-rr-name" onClick={openProfile}>{creatorName}</button>
                          ) : (
                            <strong>{creatorName}</strong>
                          )}
                          <span className="cmk-rr-verified">Verified</span>
                          {creatorId && (
                            <button type="button" className="cmk-rr-viewbtn" onClick={openProfile}>
                              View profile <ArrowRight size={13} />
                            </button>
                          )}
                        </div>
                        <div className="cmk-rr-rating"><Stars rating={review.rating} /> <b>{(review.rating || 0).toFixed(1)}</b></div>
                        {reviewText && <p className="cmk-rr-text">{reviewText}</p>}
                        <div className="cmk-rr-camp">
                          <span>Campaign: {campaignTitle}</span>
                          <span className="cmk-rr-time">{relTime(review.created_at)}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
      </>
      )}
    </BrandTopNavLayout>
  );
}
