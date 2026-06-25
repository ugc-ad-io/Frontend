import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertCircle,
  Bookmark,
  Briefcase,
  Calendar,
  ClipboardList,
  Clock,
  FileCheck,
  IndianRupee,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Settings,
  Star,
  Upload,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { EmptyPanel, formatMoney } from '../components/CreatorComponents';
import DashboardLayout from '../components/DashboardLayout';
import CreateGigForm from '../components/CreateGigForm';
import './CreatorDashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending_approval', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

// Map gig status -> existing .pcd-status badge variant.
const statusClass = (status) => {
  if (status === 'approved' || status === 'completed') return 'approved';
  if (status === 'rejected' || status === 'cancelled') return 'rejected';
  if (status === 'in_progress' || status === 'active') return 'in_progress';
  return 'pending';
};
const statusLabel = (status) => (status || 'pending_approval').replace(/_/g, ' ');
const prettyCategory = (category) => (category || '').replace(/_/g, ' ');

export default function MyGigsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/creator') },
    { name: 'My Gigs', icon: ClipboardList, action: () => {}, active: true },
    { name: 'My Active Work', icon: Zap, action: () => navigate('/my-active-work') },
    { name: 'My Bids', icon: Bookmark, action: () => navigate('/my-bids') },
    { name: 'Reviews', icon: Star, action: () => navigate('/reviews') },
    { name: 'Portfolio', icon: User, action: () => navigate('/portfolio') },
    { name: 'Browse Briefs', icon: Briefcase, action: () => navigate('/browse-briefs') },
    { name: 'My Deals', icon: FileCheck, action: () => navigate('/my-deals') },
    { name: 'Messages', icon: MessageSquare, action: () => navigate('/messages') },
    { name: 'Payout', icon: IndianRupee, action: () => navigate('/withdrawal') },
    { name: 'Settings', icon: Settings, action: () => navigate('/settings') },
  ];

  useEffect(() => {
    if (!user?.id) return;
    if (user.approval_status && user.approval_status !== 'approved') return;
    fetchGigs();
    const interval = setInterval(fetchGigs, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.approval_status]);

  const fetchGigs = async () => {
    try {
      const res = await axios.get(`${API}/gigs/creator/${user.id}`, { params: { limit: 100 } });
      // Endpoint returns { data: [...], pagination }. Be defensive about shape.
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setGigs(list);
    } catch (error) {
      toast.error('Failed to load your gigs');
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const base = { all: gigs.length, pending_approval: 0, approved: 0, rejected: 0 };
    gigs.forEach((gig) => {
      if (base[gig.status] !== undefined) base[gig.status] += 1;
    });
    return base;
  }, [gigs]);

  const visibleGigs = filter === 'all' ? gigs : gigs.filter((gig) => gig.status === filter);

  return (
    <DashboardLayout
      navItems={navItems}
      title="My Gigs"
      description="Track the gigs you've submitted and their approval status"
      topbarExtra={null}
      sidebarExtra={null}
    >
      <section className="pcd-gigs-toolbar">
        <div className="pcd-gigs-filters">
          {FILTERS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={filter === tab.key ? 'active' : ''}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              <span>{counts[tab.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <button type="button" className="pcd-gigs-create" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Create a Gig
        </button>
      </section>

      {loading ? (
        <div className="pcd-empty-panel">Loading...</div>
      ) : !visibleGigs.length ? (
        <EmptyPanel
          text={
            filter === 'all'
              ? "You haven't created any gigs yet. Create one to offer your services to brands."
              : `No ${statusLabel(filter)} gigs.`
          }
        />
      ) : (
        <div className="pcd-campaign-grid">
          {visibleGigs.map((gig) => (
            <article key={gig.id} className="pcd-campaign-card">
              <div>
                <h3>{gig.title}</h3>
                <span className={`pcd-status ${statusClass(gig.status)}`}>{statusLabel(gig.status)}</span>
              </div>
              <p>
                {gig.description
                  ? `${gig.description.substring(0, 150)}${gig.description.length > 150 ? '...' : ''}`
                  : 'No description provided.'}
              </p>
              <dl>
                <div><dt><IndianRupee size={13} /> Budget</dt><dd>{formatMoney(gig.budget)}</dd></div>
                <div><dt>Category</dt><dd style={{ textTransform: 'capitalize' }}>{prettyCategory(gig.category) || 'N/A'}</dd></div>
                <div>
                  <dt><Calendar size={13} /> Deadline</dt>
                  <dd>{gig.deadline ? new Date(gig.deadline).toLocaleDateString() : 'N/A'}</dd>
                </div>
                <div><dt><Users size={13} /> Applications</dt><dd>{gig.applications_count || 0}</dd></div>
                <div>
                  <dt><Clock size={13} /> Submitted</dt>
                  <dd>{gig.created_at ? new Date(gig.created_at).toLocaleDateString() : 'Recent'}</dd>
                </div>
              </dl>

              {gig.status === 'pending_approval' && (
                <p className="pcd-gig-note pending">
                  <Clock size={14} /> Awaiting admin review. We'll notify you once it's approved.
                </p>
              )}
              {gig.status === 'approved' && (
                <p className="pcd-gig-note approved">
                  <FileCheck size={14} /> Live in the marketplace — brands can now discover and contact you.
                </p>
              )}
              {gig.status === 'rejected' && (
                <p className="pcd-gig-note rejected">
                  <AlertCircle size={14} />
                  <span>
                    <strong>Rejected:</strong> {gig.rejection_reason || 'No reason provided.'}
                    {' '}You can create a new gig with the requested changes.
                  </span>
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {showCreate && (
        <div
          className="pcd-gig-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Create a gig"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div className="pcd-gig-modal">
            <div className="pcd-gig-modal-head">
              <div>
                <h2>Create a New Gig</h2>
                <p>Set up a service offering to attract brands.</p>
              </div>
              <button type="button" className="pcd-gig-modal-close" aria-label="Close" onClick={() => setShowCreate(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="pcd-gig-modal-body">
              <CreateGigForm
                showTips={false}
                onSuccess={() => { setShowCreate(false); fetchGigs(); }}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
