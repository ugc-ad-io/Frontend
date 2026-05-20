import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Briefcase, LogOut, MessageSquare, CheckCircle, Eye, Package, FileCheck, TrendingUp, Users, Search, Wallet, Lock, Activity, LayoutGrid, SquarePen, UserRoundSearch, ClipboardList, Settings, Bell, Package as PackageIcon } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BrandWelcomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await axios.get(`${API}/campaigns`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setCampaigns(response.data || []);
      } catch (error) {
        console.error('Failed to fetch campaigns:', error);
      }
    };
    fetchCampaigns();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const businessTabs = [
    { id: 'overview', label: 'Brand Dashboard', icon: LayoutGrid, path: '/dashboard/business' },
    { id: 'post-brief', label: 'Post a Brief', icon: SquarePen, path: '/dashboard/business/post-brief' },
    { id: 'pending-bids', label: 'Creator Bids', icon: UserRoundSearch, path: '/dashboard/business/pending-bids', badge: campaigns.reduce((sum, c) => sum + (c.bids?.length || 0), 0) || 3, badgeTone: 'orange' },
    { id: 'browse-creator', label: 'Browse Creator', icon: Search, path: '/dashboard/business/browse-creator' },
    { id: 'all-campaigns', label: `All Campaigns (${campaigns.length})`, icon: ClipboardList, path: '/dashboard/business/all-campaigns' },
    { id: 'work-review', label: 'Work Review', icon: FileCheck, path: '/dashboard/business/work-review' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/messages' },
    { id: 'shipments', label: 'Manage Shipment', icon: Package, path: '/dashboard/business/shipments' },
    { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/dashboard/business/wallet' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' }
  ];

  const recommendedCards = [
    {
      title: 'Post a Campaign Brief',
      description: 'Create a new campaign and attract top creators',
      icon: Plus,
      path: '/dashboard/business/post-brief'
    },
    {
      title: 'Browse Top Creators',
      description: 'Discover vetted creators and send private invitations',
      icon: Users,
      path: '/dashboard/business/browse-creator'
    },
    {
      title: 'Your Profile Progress',
      description: `${user?.nickname || user?.full_name || 'Brand'} • Complete your profile`,
      icon: CheckCircle,
      path: '/settings'
    }
  ];

  const dashboardCards = [
    { label: 'All Campaigns', icon: ClipboardList, path: '/dashboard/business/all-campaigns', description: 'Track every brief from draft to delivery' },
    { label: 'Creator Bids', icon: UserRoundSearch, path: '/dashboard/business/pending-bids', description: 'Review creator proposals and select the best fit' },
    { label: 'Work Review', icon: FileCheck, path: '/dashboard/business/work-review', description: 'Review submitted work and approve deliverables' },
    { label: 'Wallet', icon: Wallet, path: '/dashboard/business/wallet', description: 'Track balance and review wallet activity' },
    { label: 'Messages', icon: MessageSquare, path: '/messages', description: 'Communicate with creators directly' },
    { label: 'Manage Shipment', icon: Package, path: '/dashboard/business/shipments', description: 'Manage product shipments for delivery campaigns' }
  ];

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

        <style>{`
          .approval-page {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #1a202c;
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
            margin: 40px 0;
            padding: 20px;
            background: #edf2f7;
            border-radius: 12px;
          }

          .status-message p {
            font-size: 1rem;
            color: #4a5568;
            line-height: 1.6;
            margin: 0;
          }

          .btn-primary {
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
          }

          .approval-footer {
            background: #f7fafc;
            padding: 48px 8%;
            border-top: 2px solid #e2e8f0;
          }

          .footer-container {
            max-width: 1400px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 48px;
            margin-bottom: 32px;
          }

          .footer-section h4 {
            font-size: 1rem;
            font-weight: 700;
            color: #1a202c;
            margin-bottom: 12px;
          }

          .footer-section p {
            font-size: 0.875rem;
            color: #718096;
            margin: 8px 0;
          }

          .footer-bottom {
            text-align: center;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
            color: #718096;
            font-size: 0.875rem;
          }

          @media (max-width: 768px) {
            .approval-card {
              padding: 40px 24px;
            }

            .approval-card h1 {
              font-size: 1.75rem;
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
    <div className="welcome-page">
      <header className="welcome-header">
        <div className="welcome-header-left">
          <div className="brand-logo">
            <div className="logo-icon">U</div>
            <span>UGCad.io</span>
          </div>
        </div>

        <div className="welcome-title-section">
          <h1>Welcome to UGCad, {user?.nickname || user?.full_name || 'Brand'}! 👋</h1>
          <p>Discover how to grow your brand with top-tier creators</p>
        </div>

        <div className="welcome-header-actions">
          <button className="brand-round-action" type="button" aria-label="Notifications">
            <Bell size={18} />
            <i />
          </button>
          <div className="profile-menu-wrapper">
            <button
              className="brand-profile-photo"
              type="button"
              onClick={() => setShowMenuDropdown(!showMenuDropdown)}
              aria-label="Menu"
            >
              {(user?.nickname || user?.full_name || 'P').trim().charAt(0).toUpperCase()}
            </button>

            {showMenuDropdown && (
              <div className="profile-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="dropdown-header">
                  <div className="dropdown-user-info">
                    <strong>{user?.nickname || user?.full_name || 'Business'}</strong>
                    <span>Approved Business</span>
                  </div>
                </div>

                <nav className="dropdown-nav">
                  <span className="dropdown-section-label">Business</span>
                  {businessTabs.map(({ id, label, icon: Icon, path, badge, badgeTone }) => (
                    <button
                      key={id}
                      type="button"
                      className="dropdown-nav-item"
                      onClick={() => {
                        navigate(path);
                        setShowMenuDropdown(false);
                      }}
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                      {badge ? <b className={`dropdown-badge ${badgeTone || ''}`}>{badge}</b> : null}
                    </button>
                  ))}
                </nav>

                <button
                  className="dropdown-logout-btn"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="welcome-main">
        {showMenuDropdown && <div className="modal-backdrop" onClick={() => setShowMenuDropdown(false)} />}

        <div className="welcome-content">
          <section className="recommended-section">
            <h2>Recommended For You</h2>
            <div className="recommended-cards">
              {recommendedCards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <div key={idx} className="recommended-card" onClick={() => navigate(card.path)}>
                    <div className="card-icon">
                      <Icon size={28} />
                    </div>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="explore-section">
            <h2>Explore Your Dashboard</h2>
            <div className="dashboard-grid">
              {dashboardCards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <div key={idx} className="dashboard-card" onClick={() => navigate(card.path)}>
                    <div className="card-header">
                      <Icon size={24} />
                    </div>
                    <h3>{card.label}</h3>
                    <p>{card.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <style>{`
          .welcome-page {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            background: #f8f9ff;
          }

          .welcome-header {
            background: white;
            padding: 20px 48px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 32px;
            position: sticky;
            top: 0;
            z-index: 50;
          }

          .welcome-header-left {
            flex-shrink: 0;
          }

          .brand-logo {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .logo-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.9rem;
          }

          .brand-logo span {
            font-size: 1.1rem;
            font-weight: 700;
            color: #1a202c;
          }

          .welcome-title-section {
            flex: 1;
          }

          .welcome-title-section h1 {
            font-size: 1.75rem;
            font-weight: 700;
            color: #1a202c;
            margin: 0 0 4px 0;
          }

          .welcome-title-section p {
            font-size: 0.95rem;
            color: #718096;
            margin: 0;
          }

          .welcome-header-actions {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-shrink: 0;
          }

          .brand-round-action {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 1px solid #e2e8f0;
            background: white;
            color: #4a5568;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            position: relative;
          }

          .brand-round-action:hover {
            border-color: #667eea;
            color: #667eea;
          }

          .brand-round-action i {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 8px;
            height: 8px;
            background: #ff6b6b;
            border-radius: 50%;
          }

          .profile-menu-wrapper {
            position: relative;
          }

          .brand-profile-photo {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 2px solid #667eea;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            transition: all 0.3s ease;
            flex-shrink: 0;
          }

          .brand-profile-photo:hover {
            transform: scale(1.05);
          }

          .profile-menu-dropdown {
            position: absolute;
            top: 100%;
            right: 0;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
            min-width: 280px;
            margin-top: 12px;
            z-index: 100;
            overflow: hidden;
          }

          .dropdown-header {
            padding: 16px 20px;
            border-bottom: 1px solid #e2e8f0;
          }

          .dropdown-user-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .dropdown-user-info strong {
            font-size: 0.95rem;
            color: #1a202c;
          }

          .dropdown-user-info span {
            font-size: 0.8rem;
            color: #718096;
          }

          .dropdown-nav {
            display: flex;
            flex-direction: column;
            padding: 12px 0;
            max-height: 400px;
            overflow-y: auto;
          }

          .dropdown-section-label {
            padding: 8px 20px;
            font-size: 0.75rem;
            font-weight: 700;
            color: #a0aec0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .dropdown-nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 20px;
            background: none;
            border: none;
            color: #4a5568;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 0.95rem;
            width: 100%;
            text-align: left;
            position: relative;
          }

          .dropdown-nav-item:hover {
            background: #f7fafc;
            color: #667eea;
          }

          .dropdown-nav-item svg {
            flex-shrink: 0;
          }

          .dropdown-badge {
            margin-left: auto;
            background: #ff6b6b;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            min-width: 24px;
            text-align: center;
          }

          .dropdown-badge.orange {
            background: #f59e0b;
          }

          .dropdown-logout-btn {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 20px;
            background: none;
            border: none;
            border-top: 1px solid #e2e8f0;
            color: #dc2626;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 0.95rem;
            width: 100%;
            text-align: left;
          }

          .dropdown-logout-btn:hover {
            background: #fee2e2;
          }

          .modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 40;
          }

          .welcome-main {
            flex: 1;
            padding: 48px;
            overflow-y: auto;
          }

          .recommended-section {
            margin-bottom: 64px;
          }

          .recommended-section h2 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1a202c;
            margin: 0 0 24px 0;
          }

          .recommended-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 24px;
          }

          .recommended-card {
            background: white;
            padding: 32px 24px;
            border-radius: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 1px solid #e2e8f0;
            text-align: center;
          }

          .recommended-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 32px rgba(102, 126, 234, 0.15);
            border-color: #667eea;
          }

          .card-icon {
            width: 64px;
            height: 64px;
            background: #f0f4ff;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #667eea;
            margin: 0 auto 16px;
          }

          .recommended-card h3 {
            font-size: 1.125rem;
            font-weight: 600;
            color: #1a202c;
            margin: 0 0 12px 0;
          }

          .recommended-card p {
            font-size: 0.875rem;
            color: #718096;
            margin: 0;
            line-height: 1.5;
          }

          .explore-section h2 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1a202c;
            margin: 0 0 24px 0;
          }

          .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
          }

          .dashboard-card {
            background: white;
            padding: 24px;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 1px solid #e2e8f0;
          }

          .dashboard-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.12);
            border-color: #667eea;
          }

          .card-header {
            width: 48px;
            height: 48px;
            background: #f0f4ff;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #667eea;
            margin-bottom: 16px;
          }

          .dashboard-card h3 {
            font-size: 1rem;
            font-weight: 600;
            color: #1a202c;
            margin: 0 0 8px 0;
          }

          .dashboard-card p {
            font-size: 0.8rem;
            color: #718096;
            margin: 0;
            line-height: 1.4;
          }

          @media (max-width: 1024px) {
            .welcome-header {
              flex-wrap: wrap;
              gap: 16px;
            }

            .welcome-title-section {
              flex: 1 1 100%;
            }

            .welcome-title-section h1 {
              font-size: 1.5rem;
            }

            .recommended-cards {
              grid-template-columns: 1fr;
            }

            .dashboard-grid {
              grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            }
          }

          @media (max-width: 768px) {
            .welcome-header {
              padding: 16px 24px;
              flex-wrap: wrap;
            }

            .welcome-main {
              padding: 24px;
            }

            .welcome-title-section h1 {
              font-size: 1.25rem;
            }

            .recommended-section h2,
            .explore-section h2 {
              font-size: 1.25rem;
            }

            .profile-menu-dropdown {
              position: fixed;
              left: 0;
              right: 0;
              top: 100%;
              border-radius: 0;
              min-width: unset;
            }
          }
        `}</style>
      </main>
    </div>
  );
}
