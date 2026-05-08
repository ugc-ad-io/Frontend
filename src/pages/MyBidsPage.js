import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Bookmark,
  Briefcase,
  Eye,
  FileCheck,
  IndianRupee,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Star,
  User,
  Zap,
} from 'lucide-react';
import { getInitial, CampaignGrid } from '../components/CreatorComponents';
import DashboardLayout from '../components/DashboardLayout';
import './CreatorDashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function MyBidsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [myBids, setMyBids] = useState([]);
  const [loading, setLoading] = useState(true);

  const displayName = user?.nickname || user?.full_name || user?.email || 'Creator';

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/creator') },
    { name: 'My Active Work', icon: Zap, action: () => navigate('/my-active-work') },
    { name: 'My Bids', icon: Bookmark, action: () => {}, active: true },
    { name: 'Reviews', icon: Star, action: () => navigate('/reviews') },
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
      const res = await axios.get(`${API}/campaigns?t=${Date.now()}`);
      const allCampaigns = res.data;
      setMyBids(
        allCampaigns
          .filter((campaign) => campaign.bids?.some((bid) => bid.creator_id === user.id))
          .map((campaign) => ({
            ...campaign,
            myBid: campaign.bids.find((bid) => bid.creator_id === user.id)
          }))
      );
    } catch (error) {
      toast.error('Failed to load bids');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      navItems={navItems}
      title="My Bids"
      description="Track your submitted bids"
      topbarExtra={null}
      sidebarExtra={null}
    >
      {loading ? (
        <div className="pcd-empty-panel">Loading...</div>
      ) : (
        <CampaignGrid
          items={myBids}
          empty="No bids submitted yet."
          renderActions={(campaign) => (
            <button type="button" onClick={() => navigate(`/campaign/${campaign.id}`)}>
              <Eye size={16} /> View Campaign
            </button>
          )}
        />
      )}
    </DashboardLayout>
  );
}
