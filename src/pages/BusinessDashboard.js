import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Briefcase, LogOut, MessageSquare, CheckCircle, Eye, Package, FileCheck, TrendingUp, DollarSign, Users, Search, Wallet, Lock, Activity } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const budgetColors = ['#7387FF', '#9F9FD1', '#07074E', '#27AE60', '#F59E0B'];

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `Rs. ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

const stageTone = (stage) => {
  if (['awaiting_review', 'revision_requested'].includes(stage)) return 'warning';
  if (['completed', 'delivered'].includes(stage)) return 'success';
  return 'info';
};

const actionTarget = (url) => {
  if (!url) return null;
  if (url.startsWith('/campaigns/')) return url.replace('/campaigns/', '/campaign/');
  if (url.startsWith('/shipment/')) return `/shipment?campaign=${url.split('/').pop()}`;
  return url;
};

export default function BusinessDashboard({ page = 'overview' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [pendingCampaigns, setPendingCampaigns] = useState([]);
  const [completedCampaigns, setCompletedCampaigns] = useState([]);
  const [workSubmissions, setWorkSubmissions] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    objectives: [],
    budget_min: '',
    budget_max: '',
    brief_text: '',
    requires_shipment: false,
    shipment_option: 'no'
  });
  const [objectiveInput, setObjectiveInput] = useState('');

  useEffect(() => {
    if (user?.approval_status === 'approved') {
      fetchCampaigns();
    }
  }, [user?.id]);

  const fetchCampaigns = async () => {
    try {
      const [response, dashboardRes] = await Promise.all([
        axios.get(`${API}/campaigns`),
        axios.get(`${API}/business/dashboard`)
      ]);
      const allCampaigns = response.data;
      setDashboardData(dashboardRes.data || null);

      // Filter to only show this business's campaigns
      const myCampaigns = allCampaigns.filter(c => c.business_id === user.id);
      setCampaigns(myCampaigns);

      // Get work submissions for campaigns with work_submitted status
      const workSubmittedCampaigns = myCampaigns.filter(c => c.status === 'work_submitted');
      if (workSubmittedCampaigns.length > 0) {
        const workRes = await axios.get(`${API}/work/pending-review`);
        setWorkSubmissions(workRes.data || []);
      } else {
        setWorkSubmissions([]);
      }

      // Categorize campaigns
      setActiveCampaigns(myCampaigns.filter(c => c.status === 'active' || c.status === 'in_progress'));
      setPendingCampaigns(myCampaigns.filter(c => c.status === 'pending_approval'));
      setCompletedCampaigns(myCampaigns.filter(c => c.status === 'completed'));
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      toast.error(error.response?.data?.detail || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addObjective = () => {
    if (objectiveInput.trim() && !formData.objectives.includes(objectiveInput.trim())) {
      setFormData(prev => ({
        ...prev,
        objectives: [...prev.objectives, objectiveInput.trim()]
      }));
      setObjectiveInput('');
    }
  };

  const removeObjective = (obj) => {
    setFormData(prev => ({
      ...prev,
      objectives: prev.objectives.filter(o => o !== obj)
    }));
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    
    if (formData.objectives.length === 0) {
      toast.error('Please add at least one objective');
      return;
    }

    try {
      await axios.post(`${API}/campaigns`, {
        ...formData,
        budget_min: parseFloat(formData.budget_min),
        budget_max: parseFloat(formData.budget_max),
        requires_shipment: formData.shipment_option === 'yes'
      });
      toast.success('Campaign created and submitted for approval!');
      setShowCreateModal(false);
      setFormData({
        title: '',
        objectives: [],
        budget_min: '',
        budget_max: '',
        brief_text: '',
        requires_shipment: false,
        shipment_option: 'no'
      });
      fetchCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create campaign');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleViewCampaign = (campaignId) => {
    navigate(`/campaign/${campaignId}`);
  };

  // Calculate stats
  const totalSpent = completedCampaigns.reduce((sum, c) => sum + (c.budget_max || 0), 0);
  const totalBidsReceived = campaigns.reduce((sum, c) => sum + (c.bids?.length || 0), 0);
  const businessTabs = [
    { id: 'overview', label: 'Brand Dashboard', icon: TrendingUp, path: '/dashboard/business' },
    { id: 'all-campaigns', label: `All Campaigns (${campaigns.length})`, icon: Briefcase, path: '/dashboard/business/all-campaigns' },
    { id: 'pending-bids', label: `Pending Bids (${totalBidsReceived})`, icon: Users, path: '/dashboard/business/pending-bids' },
    { id: 'work-review', label: 'Work Review', icon: FileCheck, path: '/dashboard/business/work-review' },
    { id: 'shipments', label: 'Shipments', icon: Package, path: '/dashboard/business/shipments' }
  ];
  const activeTab = businessTabs.some(tab => tab.id === page) ? page : 'overview';
  const pageTitle = businessTabs.find(tab => tab.id === activeTab)?.label.replace(/\s\(\d+\)$/, '') || 'Business Dashboard';
  const dashboardMetrics = dashboardData?.metrics || {};
  const dashboardPerformance = dashboardData?.campaign_performance || [];
  const dashboardFunnel = dashboardData?.creator_funnel || {};
  const dashboardTopCampaigns = dashboardData?.top_campaigns || [];
  const dashboardActiveDeals = dashboardData?.active_deals || [];
  const dashboardPendingActions = dashboardData?.pending_actions || [];
  const dashboardBudget = dashboardData?.budget_usage || { used: 0, total: 0, categories: [] };
  const maxPerformanceValue = Math.max(
    1,
    ...dashboardPerformance.flatMap(item => [
      Number(item.deals_closed || 0),
      Number(item.approved_deliveries || 0),
      Number(item.applications_received || 0),
      Number(item.spend_k || 0)
    ])
  );
  const chartXs = dashboardPerformance.map((_, index) => 46 + (index * 514) / Math.max(1, dashboardPerformance.length - 1));
  const chartY = (value) => 248 - (Number(value || 0) / maxPerformanceValue) * 184;
  const maxFunnelValue = Math.max(
    1,
    Number(dashboardFunnel.viewed_brief || 0),
    Number(dashboardFunnel.applied || 0),
    Number(dashboardFunnel.accepted || 0),
    Number(dashboardFunnel.live || 0)
  );
  const funnelHeight = (value) => Math.max(16, (Number(value || 0) / maxFunnelValue) * 235);

  if (user?.approval_status === 'pending') {
    return (
      <div className="approval-page">
        <header className="approval-header">
          <div className="header-container">
            <div className="logo-section">
              <div className="logo-icon">UGC</div>
              <span className="logo-text">Business Platform</span>
            </div>
            <button className="header-logout-btn" onClick={handleLogout} data-testid="logout-btn">
              <LogOut size={18} /> Logout
            </button>
          </div>
        </header>

        <div className="approval-content">
          <div className="approval-card">
            <div className="icon-wrapper">
              <CheckCircle size={80} className="pending-icon" />
            </div>
            <h1>Business Profile Under Review</h1>
            <p className="subtitle">Thank you for joining our platform!</p>
            
            <div className="info-box">
              <div className="info-item">
                <div className="info-icon">⏱️</div>
                <div>
                  <h3>Review Time</h3>
                  <p>Typically 24-48 hours</p>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon">✉️</div>
                <div>
                  <h3>We'll Notify You</h3>
                  <p>Via email once approved</p>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon">🚀</div>
                <div>
                  <h3>What's Next?</h3>
                  <p>Create your first campaign</p>
                </div>
              </div>
            </div>

            <div className="status-message">
              <p>Your business profile is being verified by our team. We review all business accounts to maintain quality standards and protect our creator community.</p>
            </div>

            <button className="btn-primary" onClick={handleLogout} data-testid="home-btn">
              Back to Home
            </button>
          </div>
        </div>

        <footer className="approval-footer">
          <div className="footer-container">
            <div className="footer-section">
              <h4>UGC Platform</h4>
              <p>Connecting creators with brands worldwide</p>
            </div>
            <div className="footer-section">
              <h4>Support</h4>
              <p>help@ugcplatform.com</p>
              <p>Mon-Fri, 9AM-6PM EST</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <p>Terms of Service</p>
              <p>Privacy Policy</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2025 UGC Platform. All rights reserved.</p>
          </div>
        </footer>

        <style jsx>{`
          .approval-page {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            background: linear-gradient(135deg, #f8f9ff 0%, #e8ecff 100%);
          }

          .approval-header {
            background: white;
            border-bottom: 2px solid #e2e8f0;
            padding: 20px 8%;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }

          .header-container {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .logo-section {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .logo-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 1rem;
          }

          .logo-text {
            font-size: 1.25rem;
            font-weight: 700;
            color: #1a202c;
          }

          .header-logout-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            color: #4a5568;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .header-logout-btn:hover {
            border-color: #667eea;
            color: #667eea;
          }

          .approval-content {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
          }

          .approval-card {
            background: white;
            padding: 60px 48px;
            border-radius: 24px;
            max-width: 800px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            text-align: center;
          }

          .icon-wrapper {
            margin-bottom: 24px;
          }

          .pending-icon {
            color: #667eea;
            animation: pulse 2s ease-in-out infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.05); }
          }

          .approval-card h1 {
            font-size: 2.5rem;
            font-weight: 700;
            color: #1a202c;
            margin-bottom: 12px;
          }

          .subtitle {
            font-size: 1.125rem;
            color: #718096;
            margin-bottom: 40px;
          }

          .info-box {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 24px;
            margin-bottom: 40px;
            padding: 32px;
            background: #f8f9ff;
            border-radius: 16px;
          }

          .info-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            text-align: center;
          }

          .info-icon {
            width: 56px;
            height: 56px;
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.75rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }

          .info-item h3 {
            font-size: 1rem;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 4px;
          }

          .info-item p {
            font-size: 0.875rem;
            color: #718096;
          }

          .status-message {
            padding: 24px;
            background: #e0e7ff;
            border-radius: 12px;
            margin-bottom: 32px;
            border-left: 4px solid #667eea;
          }

          .status-message p {
            color: #3730a3;
            line-height: 1.6;
            margin: 0;
          }

          .approval-footer {
            background: white;
            border-top: 2px solid #e2e8f0;
            padding: 48px 8% 24px;
            margin-top: auto;
          }

          .footer-container {
            max-width: 1400px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 40px;
            margin-bottom: 32px;
          }

          .footer-section h4 {
            font-size: 1.125rem;
            font-weight: 700;
            color: #1a202c;
            margin-bottom: 16px;
          }

          .footer-section p {
            color: #718096;
            line-height: 1.8;
            margin-bottom: 8px;
          }

          .footer-bottom {
            max-width: 1400px;
            margin: 0 auto;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #a0aec0;
            font-size: 0.875rem;
          }

          @media (max-width: 768px) {
            .approval-header {
              padding: 16px 5%;
            }

            .logo-text {
              font-size: 1rem;
            }

            .logo-icon {
              width: 40px;
              height: 40px;
              font-size: 0.875rem;
            }

            .approval-card {
              padding: 40px 24px;
            }

            .approval-card h1 {
              font-size: 2rem;
            }

            .info-box {
              grid-template-columns: 1fr;
              padding: 24px;
            }

            .footer-container {
              grid-template-columns: 1fr;
              gap: 32px;
            }
          }
        `}</style>
      </div>
    );
  }

  if (user?.approval_status === 'rejected') {
    return (
      <div className="dashboard-container">
        <div className="approval-pending">
          <h2>Profile Not Approved</h2>
          <p>Unfortunately, your profile was not approved. Please contact support.</p>
          <button className="btn-primary" onClick={handleLogout}>Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <aside className="business-sidebar">
        <div>
          <div className="business-sidebar-brand">
            <div className="business-sidebar-mark">U</div>
            <span>UGCad.io</span>
          </div>
          <nav className="business-sidebar-nav" aria-label="Business dashboard">
            <span className="business-nav-label">Business</span>
            {businessTabs.map(({ id, label, icon: Icon, path }) => (
              <button
                key={id}
                type="button"
                className={`business-nav-item ${activeTab === id ? 'active' : ''}`}
                onClick={() => navigate(path)}
                data-testid={`tab-${id}`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="business-sidebar-profile">
          <div className="business-avatar">
            {(user?.nickname || user?.full_name || 'B').trim().charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{user?.nickname || user?.full_name || 'Business'}</strong>
            <span>Approved Business</span>
          </div>
        </div>
      </aside>

      <main className="business-main">
        <div className="dashboard-header">
          <div className="header-content">
            <div>
              <h1>{activeTab === 'overview' ? 'Business Dashboard' : pageTitle}</h1>
              <p>Welcome back, {user?.nickname}!</p>
            </div>
            {activeTab === 'overview' && (
              <div className="brand-search">
                <Search size={20} />
                <input type="search" placeholder="Search deals, creators, briefs..." aria-label="Search dashboard" />
              </div>
            )}
            <div className="header-actions">
              {activeTab === 'overview' && (
                <div className="role-switch" aria-label="Role switch">
                  <span>Creator</span>
                  <strong>Brand</strong>
                </div>
              )}
              {activeTab !== 'overview' && (
                <>
                  <button className="btn-primary" onClick={() => setShowCreateModal(true)} data-testid="create-campaign-btn">
                    <Plus size={20} /> Create Campaign
                  </button>
                  <button className="btn-secondary" onClick={() => navigate('/messages')} data-testid="messages-btn">
                    <MessageSquare size={20} /> Messages
                  </button>
                  <button className="btn-secondary" onClick={() => navigate('/settings')} data-testid="settings-btn">
                    <Users size={20} /> Settings
                  </button>
                  <button className="btn-secondary" onClick={handleLogout} data-testid="logout-btn">
                    <LogOut size={20} /> Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={`dashboard-content ${activeTab !== 'overview' ? 'dashboard-content-page' : ''}`}>
        {activeTab === 'overview' && (
          <>
            <div className="brand-metrics-grid">
              <div className="brand-metric-card" data-testid="active-deals-card">
                <div className="metric-head">
                  <span className="metric-icon pulse"><Activity size={20} /></span>
                  <span className="metric-trend">UP</span>
                </div>
                <p>Active Deals</p>
                <strong>{dashboardMetrics.active_deals || 0}</strong>
                <small>{Number(dashboardMetrics.active_deals_change_this_week || 0) >= 0 ? '+' : ''}{dashboardMetrics.active_deals_change_this_week || 0} this week</small>
              </div>
              <div className="brand-metric-card" data-testid="escrow-card">
                <div className="metric-head">
                  <span className="metric-icon lock"><Lock size={20} /></span>
                </div>
                <p>In Escrow</p>
                <strong>{formatMoney(dashboardMetrics.in_escrow)}</strong>
                <small>Funds locked in live deals</small>
              </div>
              <div className="brand-metric-card" data-testid="delivered-card">
                <div className="metric-head">
                  <span className="metric-icon success"><CheckCircle size={20} /></span>
                  <span className="metric-trend">UP</span>
                </div>
                <p>Delivered This Month</p>
                <strong>{dashboardMetrics.delivered_this_month || 0}</strong>
                <small>{Number(dashboardMetrics.delivered_monthly_change_percent || 0) >= 0 ? '+' : ''}{dashboardMetrics.delivered_monthly_change_percent || 0}% vs last month</small>
              </div>
              <div className="brand-metric-card" data-testid="wallet-card">
                <div className="metric-head">
                  <span className="metric-icon wallet"><Wallet size={20} /></span>
                </div>
                <p>Wallet Balance</p>
                <strong>{formatMoney(dashboardMetrics.wallet_balance)}</strong>
                <small>Available to spend</small>
              </div>
            </div>
          </>
        )}

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="brand-overview-grid">
              <section className="brand-panel performance-panel">
                <div className="panel-title-row">
                  <h2>Campaign Performance</h2>
                  <div className="period-switch">
                    <span>Weekly</span>
                    <strong>Monthly</strong>
                    <span>Quarterly</span>
                  </div>
                </div>
                <div className="performance-chart" aria-label="Campaign performance chart">
                  <div className="chart-grid-lines">
                    <span>{Math.ceil(maxPerformanceValue)}</span>
                    <span>{Math.ceil(maxPerformanceValue * 0.75)}</span>
                    <span>{Math.ceil(maxPerformanceValue * 0.5)}</span>
                    <span>{Math.ceil(maxPerformanceValue * 0.25)}</span>
                    <span>0</span>
                  </div>
                  <svg viewBox="0 0 640 300" preserveAspectRatio="none">
                    <polyline points={dashboardPerformance.map((item, index) => `${chartXs[index]},${chartY(item.spend_k)}`).join(' ')} className="line spend" />
                    <polyline points={dashboardPerformance.map((item, index) => `${chartXs[index]},${chartY(item.applications_received)}`).join(' ')} className="line applications" />
                    {dashboardPerformance.map((item, index) => {
                      const x = chartXs[index];
                      const dealsHeight = Math.max(4, (Number(item.deals_closed || 0) / maxPerformanceValue) * 120);
                      const deliveriesHeight = Math.max(4, (Number(item.approved_deliveries || 0) / maxPerformanceValue) * 120);
                      return (
                      <g key={x}>
                        <rect x={x - 22} y={250 - dealsHeight} width="36" height={dealsHeight} rx="6" className="bar deals" />
                        <rect x={x + 20} y={250 - deliveriesHeight} width="36" height={deliveriesHeight} rx="6" className="bar deliveries" />
                      </g>
                      );
                    })}
                    {dashboardPerformance.map((item, index) => (
                      <circle key={`s-${item.month}`} cx={chartXs[index]} cy={chartY(item.spend_k)} r="6" className="dot spend" />
                    ))}
                    {dashboardPerformance.map((item, index) => (
                      <circle key={`a-${item.month}`} cx={chartXs[index]} cy={chartY(item.applications_received)} r="6" className="dot applications" />
                    ))}
                  </svg>
                  <div className="chart-months">
                    {dashboardPerformance.map(item => <span key={item.month}>{item.month}</span>)}
                  </div>
                </div>
                <div className="chart-legend">
                  <span><i className="legend-deals" /> Deals Closed</span>
                  <span><i className="legend-deliveries" /> Approved Deliveries</span>
                  <span><i className="legend-applications" /> Applications Received</span>
                  <span><i className="legend-spend" /> Spend (K)</span>
                </div>
              </section>

              <section className="brand-panel funnel-panel">
                <h2>Creator Funnel</h2>
                <div className="funnel-bars">
                  <div className="funnel-bar applied" style={{ height: `${funnelHeight(dashboardFunnel.viewed_brief)}px` }}>
                    <span>Viewed Brief<br /><strong>value : {dashboardFunnel.viewed_brief || 0}</strong></span>
                  </div>
                  <div className="funnel-bar shortlisted" style={{ height: `${funnelHeight(dashboardFunnel.applied)}px` }}></div>
                  <div className="funnel-bar accepted" style={{ height: `${funnelHeight(dashboardFunnel.accepted)}px` }}></div>
                  <div className="funnel-bar live" style={{ height: `${funnelHeight(dashboardFunnel.live)}px` }}></div>
                </div>
                <div className="funnel-labels"><span>Viewed</span><span>Applied</span><span>Accepted</span><span>Live</span></div>
              </section>

              <aside className="brand-side-stack">
                <section className="brand-panel top-campaigns-panel">
                  <h2>Top Campaigns</h2>
                  {dashboardTopCampaigns.length ? dashboardTopCampaigns.map((campaign, index) => (
                    <button key={campaign.id || campaign.title} type="button" onClick={() => campaign.id && handleViewCampaign(campaign.id)}>
                      <span>{index + 1}</span>
                      {campaign.title || 'Untitled Campaign'}
                    </button>
                  )) : <p className="empty-inline">No campaigns yet</p>}
                </section>
                <div className="mini-kpi-grid">
                  <section className="brand-panel mini-kpi">
                    <p>Approval Rate</p>
                    <strong>{dashboardMetrics.approval_rate || 0}%</strong>
                  </section>
                  <section className="brand-panel mini-kpi">
                    <p>Avg Rating</p>
                    <strong>{dashboardMetrics.avg_rating || 0}</strong>
                  </section>
                </div>
              </aside>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="brand-lower-grid">
              <section className="brand-panel active-deals-panel">
                <div className="panel-title-row">
                  <h2>Active Deals</h2>
                  <button type="button" onClick={() => navigate('/dashboard/business/all-campaigns')}>View All</button>
                </div>
                <div className="deals-table">
                  <div className="deals-row deals-head">
                    <span>Campaign</span>
                    <span>Creator</span>
                    <span>Stage</span>
                    <span>Due Date</span>
                    <span>Escrow</span>
                    <span>Action</span>
                  </div>
                  {dashboardActiveDeals.length ? dashboardActiveDeals.map((deal) => {
                    const tone = stageTone(deal.stage);
                    return (
                    <div className="deals-row" key={deal.campaign_id}>
                      <strong>{deal.campaign_title || 'Untitled Campaign'}</strong>
                      <span className="creator-handle">{deal.creator_nickname ? `@${deal.creator_nickname.replace(/^@/, '')}` : '-'}</span>
                      <span className={`deal-stage ${tone}`}>{deal.stage_label || deal.stage || '-'}</span>
                      <span>{formatDate(deal.due_date)}</span>
                      <strong>{formatMoney(deal.escrow_amount)}</strong>
                      {tone === 'success' ? (
                        <span className="approved-action"><CheckCircle size={16} /> Approved</span>
                      ) : (
                        <button
                          type="button"
                          className={tone === 'warning' ? 'review-btn' : 'view-btn'}
                          onClick={() => deal.next_action === 'review' ? navigate(`/campaign/${deal.campaign_id}`) : handleViewCampaign(deal.campaign_id)}
                        >
                          {deal.next_action_label || 'View'}
                        </button>
                      )}
                    </div>
                    );
                  }) : (
                    <div className="deals-empty">No active deals yet</div>
                  )}
                </div>
              </section>

              <aside className="brand-right-rail">
                <section className="brand-panel pending-actions-panel">
                  <h2>Pending Actions</h2>
                  {dashboardPendingActions.length ? dashboardPendingActions.map((action) => {
                    const Icon = action.type?.includes('shipment') ? Package : action.type?.includes('message') ? MessageSquare : action.type?.includes('delivery') ? CheckCircle : Eye;
                    const tone = action.type?.includes('shipment') ? 'info' : action.type?.includes('message') ? 'chat' : action.type?.includes('delivery') ? 'success' : 'warning';
                    const target = actionTarget(action.target_url);
                    return (
                    <button key={action.type || action.label} type="button" className={`pending-action ${tone}`} onClick={() => target && navigate(target)} disabled={!target}>
                      <span><Icon size={17} /></span>
                      {action.label} {Number(action.count || 0) > 0 ? `(${action.count})` : ''}
                    </button>
                    );
                  }) : <p className="empty-inline">No pending actions</p>}
                </section>

                <section className="brand-panel budget-panel">
                  <h2>Budget Usage</h2>
                  <p>{formatMoney(dashboardBudget.used)} / {formatMoney(dashboardBudget.total)} used</p>
                  {(dashboardBudget.categories || []).length ? dashboardBudget.categories.map((category, index) => {
                    const value = `${Math.round(Number(category.percent || 0))}%`;
                    const color = budgetColors[index % budgetColors.length];
                    return (
                    <div className="budget-line" key={category.label || index}>
                      <div><strong>{category.label || 'Other'}</strong><span>{value}</span></div>
                      <i><b style={{ width: value, background: color }} /></i>
                    </div>
                    );
                  }) : <p className="empty-inline">No budget usage yet</p>}
                </section>

                <section className="brand-panel quick-actions-panel">
                  <h2>Quick Actions</h2>
                  <div className="quick-action-grid">
                    <button type="button" onClick={() => setShowCreateModal(true)}><FileCheck size={20} />Post a Brief</button>
                    <button type="button" onClick={() => navigate('/dashboard/business/pending-bids')}><Users size={20} />Browse Creators</button>
                    <button type="button"><Wallet size={20} />Top Up Wallet</button>
                    <button type="button"><DollarSign size={20} />Download Report</button>
                  </div>
                </section>
              </aside>
            </div>
          )}

          {activeTab === 'all-campaigns' && (
            <div className="all-campaigns-section">
              <h2>All Your Campaigns</h2>
              {loading ? (
                <div className="loading">Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div className="empty-state">
                  <Briefcase size={64} />
                  <p>No campaigns yet. Create your first campaign to get started!</p>
                  <button className="btn-primary" onClick={() => setShowCreateModal(true)}>Create Campaign</button>
                </div>
              ) : (
                <div className="campaigns-grid">
                  {campaigns.map(campaign => (
                    <div key={campaign.id} className="campaign-card-detailed" data-testid={`campaign-${campaign.id}`}>
                      <div className="campaign-header">
                        <h3>{campaign.title}</h3>
                        <span className={`badge badge-${campaign.status.replace('_', '-')}`}>{campaign.status.replace('_', ' ')}</span>
                      </div>
                      <p className="campaign-description">{campaign.brief_text.substring(0, 120)}...</p>
                      <div className="campaign-stats">
                        <div className="stat">
                          <span className="stat-label">Budget</span>
                          <span className="stat-value">${campaign.budget_min} - ${campaign.budget_max}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Bids</span>
                          <span className="stat-value">{campaign.bids?.length || 0}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Status</span>
                          <span className="stat-value">{campaign.status.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <div className="campaign-actions-row">
                        <button
                          className="btn-secondary"
                          onClick={() => handleViewCampaign(campaign.id)}
                          data-testid={`view-campaign-${campaign.id}`}
                        >
                          <Eye size={18} /> View Details
                        </button>
                        {campaign.selected_creator && (
                          <button
                            className="btn-secondary"
                            onClick={() => navigate(`/chat/${campaign.selected_creator}`)}
                            data-testid={`chat-creator-${campaign.id}`}
                          >
                            <MessageSquare size={18} /> Chat
                          </button>
                        )}
                        {campaign.requires_shipment && campaign.selected_creator && (
                          <button
                            className="btn-secondary"
                            onClick={() => navigate(`/shipment?campaign=${campaign.id}`)}
                            data-testid={`shipment-${campaign.id}`}
                          >
                            <Package size={18} /> Shipment
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pending-bids' && (
            <div className="bids-section">
              <h2>Campaigns with Pending Bids</h2>
              {campaigns.filter(c => c.bids && c.bids.length > 0 && !c.selected_creator).length === 0 ? (
                <div className="empty-state">
                  <Users size={64} />
                  <p>No pending bids at the moment</p>
                </div>
              ) : (
                <div className="bids-grid">
                  {campaigns.filter(c => c.bids && c.bids.length > 0 && !c.selected_creator).map(campaign => (
                    <div key={campaign.id} className="bid-campaign-card" data-testid={`bid-campaign-${campaign.id}`}>
                      <div className="bid-campaign-header">
                        <h3>{campaign.title}</h3>
                        <span className="bid-count">{campaign.bids.length} Bids</span>
                      </div>
                      <p className="campaign-budget">Budget: ${campaign.budget_min} - ${campaign.budget_max}</p>
                      <div className="bids-preview">
                        {campaign.bids.slice(0, 2).map((bid, idx) => (
                          <div key={idx} className="bid-preview-item">
                            <span className="creator-name">{bid.creator_nickname}</span>
                            <span className="bid-amount">${bid.amount}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        className="btn-primary"
                        onClick={() => handleViewCampaign(campaign.id)}
                        data-testid={`review-bids-${campaign.id}`}
                      >
                        Review All Bids
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'work-review' && (
            <div className="work-review-section">
              <h2>Work Submissions to Review</h2>
              {workSubmissions.length === 0 ? (
                <div className="empty-state">
                  <FileCheck size={64} />
                  <p>No work submissions pending review</p>
                  <p className="hint">Work submissions from creators will appear here</p>
                </div>
              ) : (
                <div className="work-submissions-grid">
                  {workSubmissions.map(work => {
                    const campaign = campaigns.find(c => c.id === work.campaign_id);
                    return (
                      <div key={work.id} className="work-card" data-testid={`work-${work.id}`}>
                        <div className="work-header">
                          <h3>{campaign?.title || 'Campaign'}</h3>
                          <span className="badge badge-pending">Pending Review</span>
                        </div>
                        <p className="creator-name">Creator: {work.creator_id}</p>
                        <p className="work-description">{work.description}</p>
                        <div className="work-files">
                          <strong>Files:</strong>
                          <ul>
                            {work.work_files?.map((file, idx) => (
                              <li key={idx}>
                                <a href={file} target="_blank" rel="noopener noreferrer">
                                  File {idx + 1}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="work-actions">
                          <button className="btn-primary" onClick={() => navigate(`/work-review/${work.id}`)}>
                            <CheckCircle size={18} /> Review & Approve
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'shipments' && (
            <div className="shipments-section">
              <h2>Campaign Shipments</h2>
              {campaigns.filter(c => c.requires_shipment || c.shipment_option === 'yes').length === 0 ? (
                <div className="empty-state">
                  <Package size={64} />
                  <p>No campaigns requiring shipment</p>
                  <p className="hint">Campaigns with shipment requirements will appear here</p>
                </div>
              ) : (
                <div className="shipments-grid">
                  {campaigns.filter(c => c.requires_shipment || c.shipment_option === 'yes').map(campaign => (
                    <div key={campaign.id} className="shipment-card" data-testid={`shipment-${campaign.id}`}>
                      <div className="shipment-header">
                        <h3>{campaign.title}</h3>
                        <span className={`badge ${campaign.selected_creator ? 'badge-active' : 'badge-pending'}`}>
                          {campaign.selected_creator ? 'Ready to Ship' : 'Awaiting Creator Selection'}
                        </span>
                      </div>
                      <div className="shipment-details">
                        <p className="shipment-info">
                          <strong>Status:</strong> {campaign.status.replace('_', ' ')}
                        </p>
                        <p className="shipment-info">
                          <strong>Creator:</strong> {campaign.selected_creator ? campaign.selected_creator : 'Not yet selected'}
                        </p>
                        <p className="shipment-info">
                          <strong>Budget:</strong> ${campaign.budget_min} - ${campaign.budget_max}
                        </p>
                      </div>
                      {campaign.selected_creator ? (
                        <button
                          className="btn-primary"
                          onClick={() => navigate(`/shipment?campaign=${campaign.id}`)}
                          data-testid={`manage-shipment-${campaign.id}`}
                        >
                          <Package size={18} /> Manage Shipment
                        </button>
                      ) : (
                        <button
                          className="btn-secondary"
                          onClick={() => navigate(`/campaign/${campaign.id}`)}
                          data-testid={`view-campaign-${campaign.id}`}
                        >
                          <Eye size={18} /> View Campaign & Select Creator
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Campaign</h2>
            <form onSubmit={handleCreateCampaign} className="campaign-form">
              <div className="form-group">
                <label htmlFor="title">Campaign Title</label>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="input-field"
                  placeholder="e.g., T-Shirt UGC Campaign"
                  required
                  data-testid="campaign-title-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="objectives">Campaign Objectives</label>
                <div className="objective-input-wrapper">
                  <input
                    id="objectives"
                    type="text"
                    value={objectiveInput}
                    onChange={(e) => setObjectiveInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addObjective())}
                    className="input-field"
                    placeholder="e.g., Increase brand awareness"
                    data-testid="objective-input"
                  />
                  <button type="button" onClick={addObjective} className="btn-secondary" data-testid="add-objective-btn">
                    Add
                  </button>
                </div>
                <div className="objectives-list">
                  {formData.objectives.map((obj, idx) => (
                    <span key={idx} className="objective-tag" data-testid={`objective-${idx}`}>
                      {obj}
                      <button type="button" onClick={() => removeObjective(obj)} data-testid={`remove-objective-${idx}`}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="budget-row">
                <div className="form-group">
                  <label htmlFor="budget_min">Min Budget ($)</label>
                  <input
                    id="budget_min"
                    type="number"
                    value={formData.budget_min}
                    onChange={(e) => handleInputChange('budget_min', e.target.value)}
                    className="input-field"
                    placeholder="100"
                    required
                    data-testid="budget-min-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="budget_max">Max Budget ($)</label>
                  <input
                    id="budget_max"
                    type="number"
                    value={formData.budget_max}
                    onChange={(e) => handleInputChange('budget_max', e.target.value)}
                    className="input-field"
                    placeholder="500"
                    required
                    data-testid="budget-max-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="brief_text">Campaign Brief</label>
                <textarea
                  id="brief_text"
                  value={formData.brief_text}
                  onChange={(e) => handleInputChange('brief_text', e.target.value)}
                  className="textarea-field"
                  placeholder="Describe your campaign requirements, target audience, content style, etc."
                  required
                  data-testid="brief-text-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="shipment_option">Will you ship your product to creator for the video?</label>
                <select
                  id="shipment_option"
                  value={formData.shipment_option}
                  onChange={(e) => handleInputChange('shipment_option', e.target.value)}
                  className="input-field"
                  data-testid="shipment-option-select"
                >
                  <option value="no">No - Creator uses their own</option>
                  <option value="yes">Yes - I will ship the product</option>
                  <option value="not_sure">Not Sure - Discuss with creator</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" data-testid="submit-campaign-btn">
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </main>

      <style jsx>{`
        .dashboard-page {
          min-height: 100vh;
          display: flex;
          background: #F3F3FF;
        }

        .business-sidebar {
          width: 300px;
          min-height: 100vh;
          position: sticky;
          top: 0;
          align-self: flex-start;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 32px;
          background: #07074E;
          color: white;
          border-top-right-radius: 32px;
          border-bottom-right-radius: 32px;
        }

        .business-sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
          font-size: 20px;
          font-weight: 700;
        }

        .business-sidebar-mark,
        .business-avatar {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          background: #667eea;
          color: white;
          font-weight: 800;
        }

        .business-sidebar-mark {
          width: 32px;
          height: 32px;
          border-radius: 8px;
        }

        .business-sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .business-nav-label {
          padding: 0 16px 6px;
          color: #b7b7e6;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .business-nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: rgba(255, 255, 255, 0.74);
          cursor: pointer;
          text-align: left;
          transition: 180ms ease;
        }

        .business-nav-item:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .business-nav-item.active {
          color: #07074E;
          background: white;
          font-weight: 700;
        }

        .business-nav-item span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .business-sidebar-profile {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
        }

        .business-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
        }

        .business-sidebar-profile strong,
        .business-sidebar-profile span {
          display: block;
        }

        .business-sidebar-profile span {
          margin-top: 2px;
          color: #b7b7e6;
          font-size: 12px;
          font-weight: 600;
        }

        .business-main {
          flex: 1;
          min-width: 0;
          background: #F3F3FF;
        }

        .dashboard-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }

        .approval-pending {
          text-align: center;
          background: white;
          padding: 60px 40px;
          border-radius: 24px;
          max-width: 600px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
        }

        .approval-pending h2 {
          font-size: 2rem;
          margin-bottom: 16px;
          color: #1a202c;
        }

        .approval-pending p {
          color: #718096;
          margin-bottom: 12px;
          line-height: 1.6;
        }

        .approval-pending button {
          margin-top: 24px;
        }

        .dashboard-header {
          background: transparent;
          border-bottom: 0;
          padding: 28px 8% 8px;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .dashboard-header h1 {
          font-size: 2rem;
          font-weight: 700;
          color: #07074E;
          margin-bottom: 4px;
        }

        .dashboard-header p {
          color: #9F9FD1;
          font-weight: 600;
          max-width: 440px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-actions button {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dashboard-content {
          padding: 24px 8% 40px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .brand-search {
          flex: 1;
          max-width: 520px;
          min-width: 240px;
          height: 52px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 20px;
          border: 2px solid #8EA0FF;
          border-radius: 999px;
          background: white;
          color: #9F9FD1;
          box-shadow: 0 8px 24px rgba(115, 135, 255, 0.14);
        }

        .brand-search input {
          width: 100%;
          border: 0;
          outline: 0;
          color: #07074E;
          font-weight: 600;
        }

        .brand-search input::placeholder {
          color: #B7B7E6;
        }

        .role-switch {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px;
          border-radius: 999px;
          background: white;
          box-shadow: 0 8px 24px rgba(7, 7, 78, 0.08);
          color: #9F9FD1;
          font-weight: 700;
        }

        .role-switch span,
        .role-switch strong {
          padding: 10px 20px;
          border-radius: 999px;
        }

        .role-switch strong {
          background: #07074E;
          color: white;
        }

        .brand-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(180px, 1fr));
          gap: 28px;
          margin-bottom: 28px;
        }

        .brand-metric-card,
        .brand-panel {
          background: white;
          border-radius: 22px;
          box-shadow: 0 16px 34px rgba(7, 7, 78, 0.06);
        }

        .brand-metric-card {
          min-height: 210px;
          padding: 26px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .metric-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .metric-icon {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          color: #7387FF;
          background: #EEF0FF;
          box-shadow: 0 8px 18px rgba(115, 135, 255, 0.16);
        }

        .metric-icon.success {
          color: #27AE60;
          background: #DDF7E9;
        }

        .metric-icon.wallet {
          color: #F59E0B;
          background: #FFF1D8;
        }

        .metric-icon.lock {
          color: #7387FF;
        }

        .metric-trend {
          padding: 7px 10px;
          border-radius: 999px;
          background: #DDF7E9;
          color: #27AE60;
          font-size: 12px;
          font-weight: 800;
        }

        .brand-metric-card p {
          margin: 8px 0 0;
          color: #9F9FD1;
          font-size: 16px;
          font-weight: 800;
        }

        .brand-metric-card strong {
          color: #07074E;
          font-size: 34px;
          line-height: 1;
          letter-spacing: 0;
        }

        .brand-metric-card small {
          display: block;
          padding-top: 16px;
          border-top: 1px solid #EEF0FF;
          color: #9F9FD1;
          font-weight: 700;
        }

        .dashboard-content:not(.dashboard-content-page) .tab-content {
          background: transparent;
          padding: 0;
          border-radius: 0;
          box-shadow: none;
          min-height: 0;
        }

        .brand-overview-grid {
          display: grid;
          grid-template-columns: minmax(420px, 2fr) minmax(280px, 1.08fr) minmax(260px, 1fr);
          gap: 28px;
          align-items: stretch;
        }

        .brand-panel {
          padding: 28px;
        }

        .brand-panel h2 {
          margin: 0;
          color: #07074E;
          font-size: 21px;
          font-weight: 800;
        }

        .performance-panel {
          min-height: 440px;
        }

        .panel-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }

        .period-switch {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px;
          border-radius: 12px;
          background: #F0F1FF;
          color: #9F9FD1;
          font-weight: 800;
        }

        .period-switch span,
        .period-switch strong {
          padding: 9px 14px;
          border-radius: 10px;
          font-size: 14px;
        }

        .period-switch strong {
          color: #07074E;
          background: white;
          box-shadow: 0 4px 10px rgba(7, 7, 78, 0.12);
        }

        .performance-chart {
          position: relative;
          height: 290px;
          padding-left: 48px;
        }

        .performance-chart svg {
          position: absolute;
          inset: 0 0 28px 48px;
          width: calc(100% - 48px);
          height: calc(100% - 28px);
          overflow: visible;
        }

        .chart-grid-lines {
          position: absolute;
          inset: 0 0 28px 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          color: #9F9FD1;
          font-size: 13px;
          font-weight: 700;
        }

        .chart-grid-lines span::after {
          content: "";
          position: absolute;
          left: 48px;
          right: 0;
          height: 1px;
          margin-top: 8px;
          border-top: 1px dashed #E5E7FF;
        }

        .bar.deals {
          fill: #07074E;
        }

        .bar.deliveries {
          fill: #7387FF;
        }

        .line {
          fill: none;
          stroke-width: 5;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .line.spend,
        .dot.spend {
          stroke: #F59E0B;
          fill: white;
        }

        .line.applications,
        .dot.applications {
          stroke: #27AE60;
          fill: white;
        }

        .dot {
          stroke-width: 4;
        }

        .chart-months,
        .chart-legend {
          display: flex;
          align-items: center;
          color: #9F9FD1;
          font-weight: 700;
        }

        .chart-months {
          position: absolute;
          left: 78px;
          right: 20px;
          bottom: 0;
          justify-content: space-between;
        }

        .chart-legend {
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: 18px;
          font-size: 13px;
          color: #07074E;
        }

        .chart-legend i {
          width: 10px;
          height: 10px;
          display: inline-block;
          border-radius: 50%;
          margin-right: 6px;
        }

        .legend-deals { background: #07074E; }
        .legend-deliveries { background: #7387FF; }
        .legend-applications { background: #27AE60; }
        .legend-spend { background: #F59E0B; }

        .funnel-panel {
          min-height: 440px;
          display: flex;
          flex-direction: column;
        }

        .funnel-bars {
          flex: 1;
          display: grid;
          grid-template-columns: 1.1fr 0.8fr 0.65fr 0.65fr;
          gap: 20px;
          align-items: end;
          padding-top: 42px;
        }

        .funnel-bar {
          position: relative;
          border-radius: 8px 8px 0 0;
          background: #07074E;
        }

        .funnel-bar.applied {
          height: 235px;
          background: linear-gradient(180deg, #EEF0FF 0%, #9F9FD1 100%);
        }

        .funnel-bar.shortlisted {
          height: 112px;
          background: #7387FF;
        }

        .funnel-bar.accepted {
          height: 44px;
          background: #3347B9;
        }

        .funnel-bar.live {
          height: 42px;
        }

        .funnel-bar span {
          position: absolute;
          left: 50%;
          top: 46%;
          transform: translate(-10%, -50%);
          width: 120px;
          padding: 16px;
          border-radius: 14px;
          background: white;
          color: #07074E;
          box-shadow: 0 14px 28px rgba(7, 7, 78, 0.12);
          font-weight: 800;
          line-height: 1.55;
        }

        .funnel-bar span strong {
          color: #7387FF;
        }

        .funnel-labels {
          display: flex;
          justify-content: space-around;
          color: #9F9FD1;
          font-weight: 800;
          font-size: 13px;
        }

        .brand-side-stack {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .top-campaigns-panel {
          min-height: 194px;
        }

        .top-campaigns-panel button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 0;
          border: 0;
          background: transparent;
          color: #07074E;
          cursor: pointer;
          font-weight: 700;
          text-align: left;
        }

        .top-campaigns-panel button span {
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #EEF0FF;
          color: #7387FF;
          font-size: 12px;
        }

        .empty-inline,
        .deals-empty {
          margin: 16px 0 0;
          color: #9F9FD1;
          font-weight: 700;
        }

        .deals-empty {
          padding: 28px;
          border-top: 1px solid #EEF0FF;
        }

        .mini-kpi-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          flex: 1;
        }

        .mini-kpi {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .mini-kpi p {
          margin: 0 0 18px;
          color: #9F9FD1;
          font-weight: 800;
        }

        .mini-kpi strong {
          color: #07074E;
          font-size: 30px;
        }

        .mini-kpi:first-child strong {
          color: #27AE60;
        }

        .brand-lower-grid {
          display: grid;
          grid-template-columns: minmax(560px, 2.35fr) minmax(300px, 0.95fr);
          gap: 28px;
          margin-top: 28px;
          align-items: start;
        }

        .active-deals-panel {
          padding: 0;
          overflow: hidden;
        }

        .active-deals-panel .panel-title-row {
          padding: 28px 28px 22px;
          margin: 0;
        }

        .active-deals-panel .panel-title-row button {
          border: 0;
          background: transparent;
          color: #7387FF;
          cursor: pointer;
          font-weight: 800;
        }

        .deals-table {
          width: 100%;
          overflow-x: auto;
        }

        .deals-row {
          min-width: 860px;
          display: grid;
          grid-template-columns: 1.55fr 0.95fr 1.35fr 0.8fr 0.8fr 0.8fr;
          align-items: center;
          gap: 20px;
          padding: 22px 28px;
          border-top: 1px solid #EEF0FF;
          color: #07074E;
          font-weight: 700;
        }

        .deals-head {
          padding-top: 18px;
          padding-bottom: 18px;
          background: #F7F7FF;
          color: #9F9FD1;
          font-size: 13px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .creator-handle {
          color: #7387FF;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .deal-stage {
          width: max-content;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 12px;
          text-transform: uppercase;
        }

        .deal-stage.warning {
          background: #FFF1D8;
          color: #F59E0B;
        }

        .deal-stage.info {
          background: #EEF0FF;
          color: #7387FF;
        }

        .deal-stage.success {
          background: #DDF7E9;
          color: #27AE60;
        }

        .review-btn,
        .view-btn {
          width: max-content;
          border: 0;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 800;
          padding: 10px 18px;
        }

        .review-btn {
          background: #F59E0B;
          color: white;
          box-shadow: 0 8px 18px rgba(245, 158, 11, 0.28);
        }

        .view-btn {
          background: #F0F1FF;
          color: #07074E;
        }

        .approved-action {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #27AE60;
          font-weight: 800;
        }

        .brand-right-rail {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .pending-actions-panel,
        .budget-panel,
        .quick-actions-panel {
          padding: 24px;
        }

        .pending-actions-panel h2,
        .budget-panel h2,
        .quick-actions-panel h2 {
          margin-bottom: 18px;
        }

        .pending-action {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 10px 0;
          border: 0;
          background: transparent;
          color: #07074E;
          cursor: pointer;
          font-weight: 800;
          text-align: left;
        }

        .pending-action span {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 10px;
        }

        .pending-action.warning span {
          color: #F59E0B;
          background: #FFF1D8;
        }

        .pending-action.success span {
          color: #27AE60;
          background: #DDF7E9;
        }

        .pending-action.info span,
        .pending-action.chat span {
          color: #7387FF;
          background: #EEF0FF;
        }

        .budget-panel p {
          margin: -8px 0 24px;
          color: #9F9FD1;
          font-weight: 700;
        }

        .budget-line {
          margin-top: 16px;
        }

        .budget-line div {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          color: #07074E;
          font-weight: 800;
        }

        .budget-line i {
          display: block;
          height: 7px;
          border-radius: 999px;
          background: #F0F1FF;
          overflow: hidden;
        }

        .budget-line b {
          display: block;
          height: 100%;
          border-radius: inherit;
        }

        .quick-action-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .quick-action-grid button {
          min-height: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 1px solid #E5E7FF;
          border-radius: 12px;
          background: #F7F7FF;
          color: #07074E;
          cursor: pointer;
          font-weight: 800;
        }

        .quick-action-grid svg {
          color: #7387FF;
        }

        @media (max-width: 1280px) {
          .brand-metrics-grid,
          .brand-overview-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .performance-panel {
            grid-column: 1 / -1;
          }

          .brand-side-stack {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .brand-lower-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 980px) {
          .header-content {
            flex-wrap: wrap;
          }

          .brand-search {
            order: 3;
            max-width: none;
            flex-basis: 100%;
          }

          .brand-metrics-grid,
          .brand-overview-grid,
          .brand-side-stack,
          .mini-kpi-grid {
            grid-template-columns: 1fr;
          }

          .brand-side-stack {
            display: flex;
          }

          .quick-action-grid {
            grid-template-columns: 1fr;
          }
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: white;
          padding: 24px;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        }

        .stat-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .stat-icon.active {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .stat-icon.bids {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .stat-icon.spent {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }

        .stat-label {
          font-size: 0.875rem;
          color: #718096;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1a202c;
        }

        .quick-actions {
          background: white;
          padding: 32px;
          border-radius: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          margin-bottom: 32px;
        }

        .quick-actions h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 24px;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 24px;
          background: linear-gradient(135deg, #f8f9ff 0%, #e8ecff 100%);
          border: 2px solid #e2e8f0;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 600;
          color: #4a5568;
        }

        .action-btn:hover {
          border-color: #667eea;
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
        }

        .tabs-container {
          background: white;
          padding: 0;
          border-radius: 24px 24px 0 0;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          margin-bottom: -1px;
        }

        .tabs {
          display: flex;
          gap: 8px;
          padding: 16px 24px 0;
          overflow-x: auto;
          border-bottom: 2px solid #e2e8f0;
        }

        .tab {
          padding: 12px 24px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          color: #718096;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
          margin-bottom: -2px;
        }

        .tab:hover {
          color: #667eea;
        }

        .tab.active {
          color: #667eea;
          border-bottom-color: #667eea;
        }

        .tab-content {
          background: white;
          padding: 32px;
          border-radius: 0 0 24px 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          min-height: 400px;
        }

        .section-group {
          margin-bottom: 48px;
        }

        .section-group:last-child {
          margin-bottom: 0;
        }

        .section-group h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 24px;
        }

        .loading,
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #718096;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .empty-state-small {
          text-align: center;
          padding: 30px;
          color: #718096;
        }

        .hint {
          font-size: 0.9rem;
          color: #a0aec0;
          font-style: italic;
        }

        .campaigns-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }

        .campaign-card,
        .campaign-card-detailed {
          background: #f8f9ff;
          padding: 24px;
          border-radius: 16px;
          border: 2px solid #e2e8f0;
          transition: all 0.3s ease;
        }

        .campaign-card:hover,
        .campaign-card-detailed:hover {
          border-color: #667eea;
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
        }

        .campaign-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 12px;
        }

        .campaign-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1a202c;
          flex: 1;
        }

        .campaign-brief,
        .campaign-description {
          color: #4a5568;
          line-height: 1.6;
          margin-bottom: 16px;
        }

        .campaign-stats {
          display: flex;
          gap: 24px;
          margin-bottom: 20px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #718096;
        }

        .stat-value {
          font-weight: 600;
          color: #1a202c;
        }

        .campaign-actions-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .campaign-actions-row button {
          flex: 1;
          min-width: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .pending-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .pending-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          background: #f8f9ff;
          border-radius: 12px;
          border: 2px solid #e2e8f0;
        }

        .pending-info h4 {
          font-size: 1.1rem;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 8px;
        }

        .bids-grid,
        .shipments-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }

        .bid-campaign-card,
        .shipment-card {
          background: #f8f9ff;
          padding: 24px;
          border-radius: 16px;
          border: 2px solid #e2e8f0;
        }

        .bid-campaign-header,
        .shipment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .bid-campaign-header h3,
        .shipment-header h3 {
          font-size: 1.1rem;
          font-weight: 600;
          color: #1a202c;
          flex: 1;
        }

        .bid-count {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .campaign-budget,
        .shipment-info {
          color: #4a5568;
          margin-bottom: 16px;
        }

        .bids-preview {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
          padding: 12px;
          background: white;
          border-radius: 8px;
        }

        .bid-preview-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
        }

        .creator-name {
          color: #667eea;
          font-weight: 600;
        }

        .bid-amount {
          font-weight: 700;
          color: #1a202c;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          padding: 40px;
          border-radius: 24px;
          max-width: 700px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-content h2 {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 32px;
        }

        .campaign-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .objective-input-wrapper {
          display: flex;
          gap: 12px;
        }

        .objective-input-wrapper .input-field {
          flex: 1;
        }

        .objectives-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .objective-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .objective-tag button {
          background: none;
          border: none;
          color: white;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .budget-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.95rem;
          color: #2d3748;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .modal-actions button {
          flex: 1;
        }

        /* Approval Page Styles */
        .approval-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #f8f9ff 0%, #e8ecff 100%);
        }

        .approval-header {
          background: white;
          border-bottom: 2px solid #e2e8f0;
          padding: 20px 8%;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .header-container {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
        }

        .logo-text {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1a202c;
        }

        .header-logout-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          color: #4a5568;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .header-logout-btn:hover {
          border-color: #667eea;
          color: #667eea;
        }

        .approval-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
        }

        .approval-card {
          background: white;
          padding: 60px 48px;
          border-radius: 24px;
          max-width: 800px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .icon-wrapper {
          margin-bottom: 24px;
        }

        .pending-icon {
          color: #667eea;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }

        .approval-card h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 12px;
        }

        .subtitle {
          font-size: 1.125rem;
          color: #718096;
          margin-bottom: 40px;
        }

        .info-box {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
          margin-bottom: 40px;
          padding: 32px;
          background: #f8f9ff;
          border-radius: 16px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
        }

        .info-icon {
          width: 56px;
          height: 56px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.75rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .info-item h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 4px;
        }

        .info-item p {
          font-size: 0.875rem;
          color: #718096;
        }

        .status-message {
          padding: 24px;
          background: #e0e7ff;
          border-radius: 12px;
          margin-bottom: 32px;
          border-left: 4px solid #667eea;
        }

        .status-message p {
          color: #3730a3;
          line-height: 1.6;
          margin: 0;
        }

        .approval-footer {
          background: white;
          border-top: 2px solid #e2e8f0;
          padding: 48px 8% 24px;
          margin-top: auto;
        }

        .footer-container {
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 40px;
          margin-bottom: 32px;
        }

        .footer-section h4 {
          font-size: 1.125rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 16px;
        }

        .footer-section p {
          color: #718096;
          line-height: 1.8;
          margin-bottom: 8px;
        }

        .footer-bottom {
          max-width: 1400px;
          margin: 0 auto;
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #a0aec0;
          font-size: 0.875rem;
        }

        @media (max-width: 768px) {
          .dashboard-page {
            flex-direction: column;
          }

          .business-sidebar {
            width: 100%;
            min-height: auto;
            position: static;
            border-radius: 0;
            padding: 20px;
            gap: 20px;
          }

          .business-sidebar-brand {
            margin-bottom: 20px;
          }

          .business-sidebar-nav {
            flex-direction: row;
            overflow-x: auto;
            padding-bottom: 4px;
          }

          .business-nav-label,
          .business-sidebar-profile {
            display: none;
          }

          .business-nav-item {
            width: auto;
            flex: 0 0 auto;
          }

          .header-content {
            flex-direction: column;
            gap: 20px;
            align-items: flex-start;
          }

          .header-actions {
            width: 100%;
            flex-wrap: wrap;
          }

          .header-actions button {
            flex: 1;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .campaigns-grid {
            grid-template-columns: 1fr;
          }

          .actions-grid {
            grid-template-columns: 1fr 1fr;
          }

          .budget-row {
            grid-template-columns: 1fr;
          }

          .tabs {
            gap: 4px;
            padding: 16px 16px 0;
          }

          .tab {
            padding: 10px 16px;
            font-size: 0.9rem;
          }

          .tab-content {
            padding: 24px 16px;
          }
        }
      `}</style>
    </div>
  );
}
