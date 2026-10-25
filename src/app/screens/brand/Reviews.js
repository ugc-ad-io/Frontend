import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { creatorFirstName } from '../../../utils/displayName';
import { API, Avatar, LoadError, Skeletons, assetUrl, loadErrorText } from './workShared';
import './work.css';

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

function Stars({ rating = 0, className = 'ap-wk-rv-stars' }) {
  const n = Math.round(rating);
  return <span className={className} aria-label={`${n} out of 5`}>{'★'.repeat(n)}<i>{'★'.repeat(5 - n)}</i></span>;
}

/** Reviews creators left about this brand (GET /reviews/business/:id) - mirror of the website's BrandReviewsPage. */
export default function BrandReviewsApp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [campaigns, setCampaigns] = useState({});
  const [reviewers, setReviewers] = useState({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [showAll, setShowAll] = useState(false);
  const lookups = useRef({ campaigns: {}, reviewers: {} });

  const fetchData = async () => {
    try {
      const reviewsRes = await axios.get(`${API}/reviews/business/${user.id}`);
      const list = reviewsRes.data || [];
      const campaignIds = [...new Set(list.map((r) => r.campaign_id).filter(Boolean))];
      const reviewerIds = [...new Set(list.map((r) => r.reviewer_id).filter(Boolean))];
      // Only look up campaigns / reviewers not seen yet (the page re-polls every 15s).
      const known = lookups.current;
      await Promise.all(campaignIds.filter((id) => !known.campaigns[id]).map(async (id) => {
        try { known.campaigns[id] = (await axios.get(`${API}/campaigns/${id}`)).data; } catch { /* skip */ }
      }));
      await Promise.all(reviewerIds.filter((id) => !known.reviewers[id]).map(async (id) => {
        try { known.reviewers[id] = (await axios.get(`${API}/profile/${id}`)).data; } catch { /* skip */ }
      }));
      setCampaigns({ ...known.campaigns });
      setReviewers({ ...known.reviewers });
      setReviews(list);
      setFailed('');
    } catch (e) {
      setFailed(loadErrorText(e, 'Could not load your reviews.'));
    } finally {
      setLoading(false);
    }
  };

  useLiveEffect(() => {
    if (user?.approval_status !== 'approved') { setLoading(false); return undefined; }
    fetchData();
    const interval = setInterval(() => { if (!document.hidden) fetchData(); }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count : 0;
  const fiveStars = reviews.filter((r) => (r.rating || 0) >= 5).length;
  const uniqueCreators = new Set(reviews.map((r) => r.reviewer_id).filter(Boolean)).size;
  const visible = showAll ? reviews : reviews.slice(0, 5);
  const retry = () => { setLoading(true); fetchData(); };

  return (
    <AppShell title="Reviews" subtitle="What creators say about working with you">
      <div className="ap-wk">
        {loading ? (
          <div className="ap-wk-list" aria-hidden="true">
            <div className="ap-skel" style={{ height: 150, borderRadius: 22 }} />
            <div className="ap-skel" style={{ height: 110, borderRadius: 20 }} />
            <div className="ap-skel" style={{ height: 110, borderRadius: 20 }} />
          </div>
        ) : count === 0 && failed ? (
          <LoadError title="Couldn't load reviews" message={failed} onRetry={retry} />
        ) : count === 0 ? (
          <div className="ap-card ap-empty">
            <h3>No reviews yet</h3>
            <p>Once creators complete campaigns with you, their reviews will appear here. Good reviews help you get better bids.</p>
            <button type="button" className="ap-btn" onClick={() => navigate('/dashboard/business/all-campaigns')}>View campaigns</button>
          </div>
        ) : (
          <>
            {failed && <div className="ap-wk-err" role="alert"><span>{failed}</span><button type="button" className="ap-btn ap-btn--sm" onClick={retry}>Retry</button></div>}
            <section className="ap-hero ap-wk-rv-hero" style={{ padding: 18, borderRadius: 22 }}>
              <div className="ap-wk-rv-row">
                <div>
                  <div className="ap-wk-rv-big">{avg ? avg.toFixed(1) : '-'}<small>/ 5</small></div>
                  <Stars rating={avg} className="ap-wk-star-row" />
                  <div className="ap-wk-rv-cap">{count} review{count === 1 ? '' : 's'} · {uniqueCreators} creator{uniqueCreators === 1 ? '' : 's'}</div>
                </div>
                <div className="ap-wk-rv-bars">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const c = reviews.filter((r) => Math.round(r.rating || 0) === star).length;
                    return (
                      <div key={star} className="ap-wk-rv-bar">
                        <span>{star}★</span>
                        <i><b style={{ width: `${count ? Math.round((c / count) * 100) : 0}%` }} /></i>
                        <span>{c}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="ap-wk-rv-stats">
              <div className="ap-card ap-wk-rv-stat"><b>{count}</b><small>Total reviews</small></div>
              <div className="ap-card ap-wk-rv-stat"><b>{fiveStars}</b><small>5-star · {count ? Math.round((fiveStars / count) * 100) : 0}%</small></div>
              <div className="ap-card ap-wk-rv-stat"><b>{uniqueCreators}</b><small>{uniqueCreators === 1 ? 'Creator' : 'Creators'}</small></div>
            </div>

            <div className="ap-sec-h"><h2>What creators say</h2></div>
            <div className="ap-wk-list">
              {visible.map((review) => {
                const text = review.review || review.review_text || review.comment || '';
                const reviewer = reviewers[review.reviewer_id];
                const campaign = campaigns[review.campaign_id];
                const creatorName = creatorFirstName(reviewer);
                const photo = reviewer?.profile_photo ? assetUrl(reviewer.profile_photo) : '';
                const creatorId = review.reviewer_id;
                const openProfile = () => {
                  if (!creatorId) { toast.error('This creator is unavailable'); return; }
                  navigate(`/dashboard/business/creator/${creatorId}`);
                };
                return (
                  <article key={review.id} className="ap-card ap-wk-rv-it">
                    <div className="ap-wk-rv-it-h">
                      <button type="button" className="ap-wk-rv-who" onClick={openProfile} aria-label={`View ${creatorName}'s profile`}>
                        <Avatar name={creatorName} src={photo} size={40} bg={avaColor(creatorName)} />
                        <span>
                          <b>{creatorName}</b>
                          <small>{campaign?.title || 'Campaign'} · {relTime(review.created_at)}</small>
                        </span>
                      </button>
                      <Stars rating={review.rating} />
                    </div>
                    {text ? <p className="ap-wk-rv-txt">{text}</p> : null}
                  </article>
                );
              })}
            </div>
            {count > 5 && (
              <button type="button" className="ap-btn ap-btn--ghost ap-wk-more" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show recent' : `View all ${count} reviews`} <ArrowRight size={15} />
              </button>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
