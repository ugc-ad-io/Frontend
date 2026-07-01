import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Star, Trophy, MessagesSquare, TrendingUp, Briefcase, ArrowRight } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const AVA_COLORS = ['#111827', '#ef6f6f', '#22a565', '#f0931d', '#5b6bff', '#23236a', '#2f8de0'];
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

function Stars({ rating = 0 }) {
  return (
    <span className="cmk-rev-stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={16} className={i < rating ? '' : 'empty'} />
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
    } catch (error) {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const count = reviews.length;
  const avg = count ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / count) : 0;
  const fiveStars = reviews.filter((r) => (r.rating || 0) >= 5).length;
  const uniqueBrands = new Set(reviews.map((r) => r.reviewer_id).filter(Boolean)).size;

  return (
    <CreatorTopNavLayout>
      <div className="cmk-page-head cmk-rise">
        <h1>Reviews</h1>
        <p>See what brands think about your work and build your reputation.</p>
      </div>

      <div className="cmk-stats cmk-stats-sm cmk-stats-2l cmk-rev-stats">
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
          <div className="cmk-stat-head"><div className="cmk-ic cmk-ic-blue"><Briefcase size={20} /></div><div className="cmk-stat-lbl">Brands Reviewed</div></div>
          <div className="cmk-stat-row">
            <div className="cmk-stat-val">{uniqueBrands}</div>
            <div className="cmk-stat-meta"><span>{uniqueBrands === 1 ? 'Brand worked with' : 'Brands worked with'}</span></div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="cmk-empty">Loading reviews…</div>
      ) : (
        <div className="cmk-rev-layout">
          {/* ── Rating Breakdown ── */}
          <section className="cmk-rev-panel cmk-rev-panel--fit">
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

          {/* ── Recent Reviews ── */}
          <section className="cmk-rev-panel">
            <div className="cmk-rev-phead">
              <h3 className="cmk-rev-h">Recent Reviews</h3>
              {count > 3 && (
                <button type="button" className="cmk-rev-all" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show recent' : 'View all reviews'} <ArrowRight size={15} />
                </button>
              )}
            </div>

            {count === 0 ? (
              <div className="cmk-empty" style={{ padding: '40px 0' }}>No reviews yet. Complete campaigns to start receiving reviews from brands.</div>
            ) : (
              <div className="cmk-rr-list">
                {(showAll ? reviews : reviews.slice(0, 3)).map((review) => {
                  const reviewText = review.review || review.review_text || review.comment || '';
                  const reviewer = reviewers[review.reviewer_id];
                  const campaign = campaigns[review.campaign_id];
                  const campaignTitle = campaign?.title || 'Campaign';
                  const businessName = reviewer?.nickname || reviewer?.full_name || 'Brand';
                  const photo = reviewer?.profile_photo ? (reviewer.profile_photo.startsWith('http') ? reviewer.profile_photo : `${BACKEND_URL}${reviewer.profile_photo}`) : '';
                  return (
                    <article key={review.id} className="cmk-rr-item">
                      <span className="cmk-rr-ava" style={{ background: photo ? 'transparent' : avaColor(businessName) }}>
                        {photo ? <img src={photo} alt="" /> : businessName.charAt(0).toUpperCase()}
                      </span>
                      <div className="cmk-rr-main">
                        <div className="cmk-rr-top">
                          <strong>{businessName}</strong>
                          <span className="cmk-rr-verified">Verified</span>
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
        </div>
      )}
    </CreatorTopNavLayout>
  );
}
