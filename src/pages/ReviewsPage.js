import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Star, Calendar, Award, MessageSquare, TrendingUp } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

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

  return (
    <CreatorTopNavLayout>
      <div className="cmk-page-head cmk-rise">
        <h1>Reviews</h1>
        <p>See what brands think about your work and build your reputation.</p>
      </div>

      <div className="cmk-stats" style={{ gridTemplateColumns: 'repeat(3, minmax(200px, 280px))', justifyContent: 'start' }}>
        <div className="cmk-stat">
          <div className="cmk-ic cmk-ic-orange"><Star size={22} /></div>
          <div className="cmk-stat-lbl">Average Rating</div>
          <div className="cmk-stat-val">{avg ? avg.toFixed(1) : '—'}<span style={{ fontSize: 16, color: '#9296ba' }}> / 5</span></div>
          <div className="cmk-stat-meta"><Stars rating={Math.round(avg)} /></div>
        </div>
        <div className="cmk-stat">
          <div className="cmk-ic cmk-ic-indigo"><MessageSquare size={22} /></div>
          <div className="cmk-stat-lbl">Total Reviews</div>
          <div className="cmk-stat-val">{count}</div>
          <div className="cmk-stat-meta"><span>From completed campaigns</span></div>
        </div>
        <div className="cmk-stat">
          <div className="cmk-ic cmk-ic-green"><Award size={22} /></div>
          <div className="cmk-stat-lbl">5-Star Reviews</div>
          <div className="cmk-stat-val">{fiveStars}</div>
          <div className="cmk-stat-meta cmk-up"><TrendingUp size={14} /> {count ? Math.round((fiveStars / count) * 100) : 0}% <span>of all reviews</span></div>
        </div>
      </div>

      {loading ? (
        <div className="cmk-empty">Loading reviews…</div>
      ) : count === 0 ? (
        <div className="cmk-empty">No reviews yet. Complete campaigns to start receiving reviews from brands.</div>
      ) : (
        <div className="cmk-rev-grid">
          {reviews.map((review) => {
            const reviewText = review.review || review.review_text || review.comment || '';
            const campaign = campaigns[review.campaign_id];
            const reviewer = reviewers[review.reviewer_id];
            const campaignTitle = campaign?.title || 'Campaign';
            const businessName = reviewer?.nickname || reviewer?.full_name || 'Brand';
            return (
              <article key={review.id} className="cmk-rev-card cmk-rise">
                <div className="cmk-rev-top">
                  <div>
                    <div className="cmk-rev-camp">{campaignTitle}</div>
                    <div className="cmk-rev-brand">By {businessName}</div>
                  </div>
                  <Stars rating={review.rating} />
                </div>
                {reviewText && <p className="cmk-rev-text">{reviewText}</p>}
                <small className="cmk-rev-date">
                  <Calendar size={13} /> {review.created_at ? new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent review'}
                </small>
              </article>
            );
          })}
        </div>
      )}
    </CreatorTopNavLayout>
  );
}
