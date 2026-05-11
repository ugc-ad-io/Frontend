import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Bookmark,
  Briefcase,
  FileCheck,
  IndianRupee,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Star,
  User,
  Zap,
} from 'lucide-react';
import { getInitial, EmptyPanel } from '../components/CreatorComponents';
import DashboardLayout from '../components/DashboardLayout';
import './CreatorDashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ReviewsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const displayName = user?.nickname || user?.full_name || user?.email || 'Creator';

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/creator') },
    { name: 'My Active Work', icon: Zap, action: () => navigate('/my-active-work') },
    { name: 'My Bids', icon: Bookmark, action: () => navigate('/my-bids') },
    { name: 'Reviews', icon: Star, action: () => {}, active: true },
    { name: 'Portfolio', icon: User, action: () => navigate('/portfolio') },
    { name: 'Browse Briefs', icon: Briefcase, action: () => navigate('/browse-briefs') },
    { name: 'My Deals', icon: FileCheck, action: () => navigate('/my-deals') },
    { name: 'Messages', icon: MessageSquare, action: () => navigate('/messages') },
    { name: 'Payout', icon: IndianRupee, action: () => navigate('/withdrawal') },
    { name: 'Settings', icon: Settings, action: () => navigate('/settings') },
  ];

  useEffect(() => {
    if (user?.approval_status !== 'approved') return;
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/reviews/creator/${user.id}`);
      console.log('Reviews API response:', res.data);
      setReviews(res.data);
    } catch (error) {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      navItems={navItems}
      title="Reviews"
      description="See what brands think about your work"
      topbarExtra={null}
      sidebarExtra={null}
    >
      {loading ? (
        <div className="pcd-empty-panel">Loading...</div>
      ) : (
        <div className="pcd-review-grid">
          {reviews.length ? reviews.map((review) => {
            // Try to find review text in any possible field
            let reviewText = '';
            if (typeof review === 'object' && review !== null) {
              reviewText = review.review || review.review_text || review.comment || review.feedback || review.text || review.body || Object.values(review).find(val => typeof val === 'string' && val.length > 20) || '';
            }
            return (
            <article key={review.id} className="pcd-review-card">
              <div>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} size={16} className={index < review.rating ? 'filled' : ''} />
                ))}
              </div>
              {reviewText && <p className="review-text">{reviewText}</p>}
              <small>{review.created_at ? new Date(review.created_at).toLocaleDateString() : 'Recent review'}</small>
            </article>
            );
          }) : <EmptyPanel text="No reviews yet. Complete campaigns to receive reviews." />}
        </div>
      )}
    </DashboardLayout>
  );
}
