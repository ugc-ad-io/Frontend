import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Briefcase, LogOut, MessageSquare, CheckCircle, Eye, Package, FileCheck, TrendingUp, Users, Search, Wallet, Lock, Activity, LayoutGrid, SquarePen, UserRoundSearch, ClipboardList, Settings, Bell, Package as PackageIcon, Heart, Mail, Video, Star, Gift, Zap, PlayCircle, Share2, Smile, TrendingUpIcon, Book, Camera, ArrowRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const iconMap = {
  'video': Video,
  'star': Star,
  'gift': Gift,
  'message-circle': MessageSquare,
  'play-circle': PlayCircle,
  'share-2': Share2,
  'heart': Heart,
  'trending-up': TrendingUp,
  'book': Book,
  'camera': Camera,
  'zap': Zap,
  'trending-up-icon': TrendingUpIcon,
  'all': Star,
  'ugc-videos': Video,
  'product-reviews': Star,
  'unboxing': Gift,
  'testimonials': MessageSquare,
  'demo-videos': PlayCircle,
  'social-content': Share2,
  'lifestyle': Heart,
  'comparison': TrendingUp,
  'tutorials': Book,
  'behind-scenes': Camera,
};

const getIconComponent = (iconName, categoryId) => {
  if (!iconName && !categoryId) return Star;
  // First try the icon name
  let icon = iconMap[iconName?.toLowerCase()];
  // If not found, try the category ID
  if (!icon && categoryId) {
    icon = iconMap[categoryId.toLowerCase()];
  }
  return icon || Star;
};

// ── Motion variants (reused across the page) ─────────────────────────────
const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};
const cardStagger = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, delay: 0.15 + i * 0.06 },
  }),
};

export default function BrandWelcomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [contentCategories, setContentCategories] = useState([]);
  const [approvedGigs, setApprovedGigs] = useState([]);
  const [gigsLoading, setGigsLoading] = useState(true);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Sliding tab indicator state (top-bar categories)
  const tabRefs = useRef({});
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = tabRefs.current[activeCategory];
    if (el) {
      setTabIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeCategory, contentCategories]);

  const topBarCategories = [
    { id: 'all', label: 'All' },
    { id: 'fashion', label: 'Fashion & Apparel' },
    { id: 'beauty', label: 'Beauty & Cosmetics' },
    { id: 'tech', label: 'Technology & Gadgets' },
    { id: 'food', label: 'Food & Beverage' },
    { id: 'fitness', label: 'Health & Fitness' },
    { id: 'home', label: 'Home & Lifestyle' },
    { id: 'travel', label: 'Travel & Tourism' },
    { id: 'entertainment', label: 'Entertainment' }
  ];

  const defaultContentCategories = [
    { id: 'all', label: 'All', icon: 'star' },
    { id: 'ugc-videos', label: 'UGC Videos', icon: 'video' },
    { id: 'product-reviews', label: 'Product Reviews', icon: 'star' },
    { id: 'unboxing', label: 'Unboxing Videos', icon: 'gift' },
    { id: 'testimonials', label: 'Testimonials', icon: 'message-circle' },
    { id: 'demo-videos', label: 'Demo Videos', icon: 'play-circle' },
    { id: 'social-content', label: 'Social Media Content', icon: 'share-2' },
    { id: 'lifestyle', label: 'Lifestyle Content', icon: 'heart' },
    { id: 'comparison', label: 'Product Comparison', icon: 'trending-up' },
    { id: 'tutorials', label: 'Tutorials & Tips', icon: 'book' },
    { id: 'behind-scenes', label: 'Behind the Scenes', icon: 'camera' }
  ];

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await axios.get(`${API}/campaigns`);
        setCampaigns(response.data || []);
      } catch (error) {
        console.error('Failed to fetch campaigns:', error);
      }
    };
    fetchCampaigns();
  }, []);

  useEffect(() => {
    const fetchApprovedGigs = async () => {
      setGigsLoading(true);
      try {
        const response = await axios.get(`${API}/gigs?status=approved`);
        const gigs = response.data?.data || response.data || [];
        setApprovedGigs(gigs);
      } catch (error) {
        console.error('Failed to fetch approved gigs:', error);
      } finally {
        setGigsLoading(false);
      }
    };
    fetchApprovedGigs();
  }, []);

  useEffect(() => {
    const fetchContentCategories = async () => {
      try {
        const response = await axios.get(`${API}/categories`);
        if (response.data && response.data.length > 0) {
          const formattedCategories = response.data.map(cat => ({
            id: cat.id || cat.name?.toLowerCase().replace(/\s+/g, '-') || cat,
            label: cat.label || cat.name || cat,
            icon: cat.icon || 'star'
          }));
          setContentCategories([{ id: 'all', label: 'All', icon: 'star' }, ...formattedCategories]);
        } else {
          setContentCategories(defaultContentCategories);
        }
      } catch (error) {
        console.error('Failed to fetch content categories:', error);
        setContentCategories(defaultContentCategories);
      }
    };
    fetchContentCategories();
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
    { id: 'browse-gigs', label: 'Browse Approved Gigs', icon: Video, path: '/browse-approved-gigs' },
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
      path: '/dashboard/business/post-brief',
      accent: '#7c3aed',
      accentSoft: 'rgba(124, 58, 237, 0.12)',
      accentBorder: 'rgba(124, 58, 237, 0.22)',
    },
    {
      title: 'Browse Top Creators',
      description: 'Discover vetted creators and send private invitations',
      icon: Users,
      path: '/dashboard/business/browse-creator',
      accent: '#0ea5e9',
      accentSoft: 'rgba(14, 165, 233, 0.12)',
      accentBorder: 'rgba(14, 165, 233, 0.22)',
    },
    {
      title: 'Your Profile Progress',
      description: `${user?.nickname || user?.full_name || 'Brand'} • Complete your profile`,
      icon: CheckCircle,
      path: '/settings',
      accent: '#10b981',
      accentSoft: 'rgba(16, 185, 129, 0.12)',
      accentBorder: 'rgba(16, 185, 129, 0.22)',
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
            background: linear-gradient(135deg, #07074E 0%, #07074E 100%);
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
            background: linear-gradient(135deg, #07074E 0%, #07074E 100%);
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
            border-color: #07074E;
            color: #07074E;
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
            color: #07074E;
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
            background: linear-gradient(135deg, #07074E 0%, #07074E 100%);
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
            box-shadow: 0 8px 20px rgba(7, 7, 78, 0.4);
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

        <div className="header-search-bar">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search creators, campaigns, deals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="welcome-header-actions">
          <button className="header-icon-btn" type="button" aria-label="Wishlist">
            <Heart size={20} />
          </button>
          <button className="header-icon-btn" type="button" aria-label="Messages">
            <Mail size={20} />
          </button>
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

      <nav className="categories-bar">
        {topBarCategories.map((category) => (
          <button
            key={category.id}
            ref={(el) => { tabRefs.current[category.id] = el; }}
            className={`category-btn ${activeCategory === category.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
        <motion.span
          className="category-btn-indicator"
          aria-hidden="true"
          animate={{ left: tabIndicator.left, width: tabIndicator.width }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      </nav>

      <main className="welcome-main">
        {showMenuDropdown && <div className="modal-backdrop" onClick={() => setShowMenuDropdown(false)} />}

        <div className="welcome-content">
          <motion.div
            className="welcome-banner"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="welcome-banner-orb welcome-banner-orb--1" aria-hidden="true" />
            <div className="welcome-banner-orb welcome-banner-orb--2" aria-hidden="true" />
            <div className="welcome-banner-content">
              <span className="welcome-banner-eyebrow">✨ Brand Dashboard</span>
              <h1>Welcome to UGCad, {user?.nickname || user?.full_name || 'Brand'}! 👋</h1>
              <p>Discover how to grow your brand with top-tier creators</p>
            </div>
          </motion.div>

          <motion.section
            className="recommended-section"
            custom={1}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="recommended-cards">
              {recommendedCards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={idx}
                    className="recommended-card"
                    onClick={() => navigate(card.path)}
                    custom={idx}
                    variants={cardStagger}
                    initial="hidden"
                    animate="visible"
                    whileHover={{ y: -4 }}
                    style={{
                      '--accent': card.accent,
                      '--accent-soft': card.accentSoft,
                      '--accent-border': card.accentBorder,
                    }}
                  >
                    <div className="recommended-card-badge">RECOMMENDED FOR YOU</div>
                    <div className="recommended-card-inner">
                      <div className="recommended-card-icon">
                        <Icon size={24} />
                      </div>
                      <div className="recommended-card-content">
                        <h3>{card.title}</h3>
                        <p>{card.description}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          <motion.section
            className="explore-section"
            custom={2}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="explore-section-header">
              <span className="section-eyebrow">DISCOVER</span>
              <h2>Explore Popular Categories</h2>
              <p className="section-subtitle">Browse creators by content type — find the right fit for your campaign</p>
            </div>
            <div className="explore-container">
              <div className="categories-sidebar">
                {contentCategories.length > 0 && contentCategories.map((category) => {
                  const Icon = getIconComponent(category.icon, category.id);
                  return (
                    <button
                      key={category.id}
                      className={`category-sidebar-item ${activeCategory === category.id ? 'active' : ''}`}
                      onClick={() => setActiveCategory(category.id)}
                    >
                      <div className="category-item-icon">
                        <Icon size={20} />
                      </div>
                      <span>{category.label || category.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="categories-content">
                {gigsLoading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="gig-card-welcome gig-card-skeleton" style={{ pointerEvents: 'none', animationDelay: `${i * 0.1}s` }}>
                        <div className="skel skel-img" />
                        <div className="skel skel-line" style={{ width: '60%', marginTop: '12px' }} />
                        <div className="skel skel-line" style={{ width: '90%', marginTop: '8px', height: '12px' }} />
                      </div>
                    ))}
                    <style>{`
                      @keyframes gigSkeleton {
                        0%   { background-position: 200% 0; }
                        100% { background-position: -200% 0; }
                      }
                      .skel {
                        background: linear-gradient(115deg, #e9eaf3 0%, #fafbff 50%, #e9eaf3 100%);
                        background-size: 200% 100%;
                        animation: gigSkeleton 1.6s ease-in-out infinite;
                        border-radius: 6px;
                      }
                      .skel-img {
                        width: 100%;
                        aspectRatio: 4/3;
                        height: 240px;
                        border-radius: 0;
                      }
                      .skel-line {
                        height: 14px;
                        margin-left: 16px;
                        margin-right: 16px;
                      }
                    `}</style>
                  </>
                ) : approvedGigs.length > 0 ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeCategory}
                      style={{ display: 'contents' }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      {approvedGigs.slice(0, 6).map((gig, idx) => (
                        <motion.div
                          key={gig.id}
                          className="gig-card-welcome"
                          onClick={() => navigate(`/gig/${gig.id}`)}
                          custom={idx}
                          variants={cardStagger}
                          initial="hidden"
                          animate="visible"
                          whileHover={{ y: -4 }}
                        >
                          {gig.attachments && gig.attachments.length > 0 && (
                            <div className="gig-media-preview">
                              <img
                                src={gig.attachments[0]}
                                alt="Gig preview"
                                className="gig-preview-image"
                                onError={(e) => {e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E';}}
                              />
                              <button
                                className="gig-wishlist-btn"
                                onClick={(e) => { e.stopPropagation(); }}
                                aria-label="Add to wishlist"
                              >
                                <Heart size={16} />
                              </button>
                              {gig.attachments.length > 1 && (
                                <div className="attachment-more">+{gig.attachments.length - 1}</div>
                              )}
                              <div className="gig-creator-overlay">
                                <div className="creator-avatar creator-avatar--overlay">
                                  {(gig.public_creator_id || gig.creator_id)?.charAt(0).toUpperCase() || 'C'}
                                </div>
                                <span className="creator-name-overlay">
                                  {gig.public_creator_id || gig.creator_id || 'Creator'}
                                </span>
                              </div>
                            </div>
                          )}

                          <h3 className="gig-title">{gig.title}</h3>

                          <div className="gig-footer">
                            <div className="gig-budget">
                              <span className="budget-amount">${gig.budget || '0'}</span>
                            </div>
                            <button className="gig-cta-button">
                              <span>View Gig</span>
                              <ArrowRight size={12} className="gig-cta-arrow" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <>
                    {dashboardCards.map((card, idx) => {
                      const Icon = card.icon;
                      return (
                        <motion.div
                          key={idx}
                          className="dashboard-card"
                          onClick={() => navigate(card.path)}
                          custom={idx}
                          variants={cardStagger}
                          initial="hidden"
                          animate="visible"
                          whileHover={{ y: -4 }}
                        >
                          <div className="card-header">
                            <Icon size={24} />
                          </div>
                          <h3>{card.label}</h3>
                          <p>{card.description}</p>
                        </motion.div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </motion.section>
        </div>

        <style>{`
          .welcome-page {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            background: #f8f9ff;
          }

          .categories-bar {
            background: white;
            border-bottom: 1px solid #e2e8f0;
            padding: 0 48px;
            display: flex;
            gap: 32px;
            overflow-x: auto;
            overflow-y: hidden;
            scroll-behavior: smooth;
            position: sticky;
            top: 72px;
            z-index: 40;
            -webkit-overflow-scrolling: touch;
          }

          .categories-bar::-webkit-scrollbar {
            height: 4px;
          }

          .categories-bar::-webkit-scrollbar-track {
            background: #f0f4ff;
          }

          .categories-bar::-webkit-scrollbar-thumb {
            background: #cbd5e0;
            border-radius: 2px;
          }

          .categories-bar::-webkit-scrollbar-thumb:hover {
            background: #a0aec0;
          }

          .categories-bar { position: sticky; }
          .category-btn {
            position: relative;
            padding: 16px 0;
            background: none;
            border: none;
            color: #718096;
            font-size: 0.95rem;
            font-weight: 500;
            cursor: pointer;
            white-space: nowrap;
            transition: color 0.2s ease;
          }

          .category-btn:hover {
            color: #1a202c;
          }

          .category-btn.active {
            color: #07074E;
          }

          .category-btn-indicator {
            position: absolute;
            bottom: 0;
            height: 2px;
            background: linear-gradient(90deg, #07074E, #07074E);
            border-radius: 2px;
            pointer-events: none;
          }

          .welcome-header {
            background: white;
            padding: 16px 48px;
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
            background: linear-gradient(135deg, #07074E 0%, #07074E 100%);
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

          .header-search-bar {
            display: flex;
            align-items: center;
            gap: 12px;
            flex: 1;
            max-width: 600px;
            padding: 10px 16px;
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            color: #718096;
            transition: all 0.3s ease;
          }

          .header-search-bar:hover,
          .header-search-bar:focus-within {
            background: white;
            border-color: #07074E;
            box-shadow: 0 0 0 4px rgba(7, 7, 78, 0.15), 0 2px 8px rgba(7, 7, 78, 0.1);
          }

          .header-search-bar input {
            flex: 1;
            background: none;
            border: none;
            outline: none;
            font-size: 0.95rem;
            color: #1a202c;
          }

          .header-search-bar input::placeholder {
            color: #a0aec0;
          }

          .header-icons {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-shrink: 0;
          }

          .header-icon-btn {
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
          }

          .header-icon-btn:hover {
            border-color: #07074E;
            color: #07074E;
            background: #f7fafc;
          }

          .welcome-header-spacer {
            display: none;
          }

          .welcome-banner {
            position: relative;
            overflow: hidden;
            margin-bottom: 48px;
            padding: 32px 36px;
            border-radius: 20px;
            background: linear-gradient(135deg, #07074E 0%, #07074E 100%);
            color: #fff;
            box-shadow: 0 20px 50px rgba(7, 7, 78, 0.25);
          }
          .welcome-banner-content {
            position: relative;
            z-index: 1;
          }
          .welcome-banner-orb {
            position: absolute;
            border-radius: 50%;
            filter: blur(60px);
            opacity: 0.25;
            pointer-events: none;
          }
          .welcome-banner-orb--1 {
            width: 240px;
            height: 240px;
            background: #ffffff;
            top: -100px;
            right: -60px;
          }
          .welcome-banner-orb--2 {
            width: 200px;
            height: 200px;
            background: #fbbf24;
            bottom: -100px;
            left: 30%;
            opacity: 0.18;
          }
          .welcome-banner-eyebrow {
            display: inline-block;
            background: rgba(255, 255, 255, 0.18);
            padding: 5px 14px;
            border-radius: 100px;
            font-size: 0.72rem;
            letter-spacing: 0.12em;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 14px;
            backdrop-filter: blur(8px);
          }

          .welcome-banner h1 {
            font-size: 2.2rem;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: -0.02em;
            margin: 0 0 8px 0;
          }

          .welcome-banner p {
            font-size: 1.05rem;
            color: rgba(255, 255, 255, 0.88);
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
            border-color: #07074E;
            color: #07074E;
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
            border: 2px solid #07074E;
            background: linear-gradient(135deg, #07074E 0%, #07074E 100%);
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
            color: #07074E;
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
            margin-bottom: 48px;
          }


          .recommended-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
          }

          .recommended-card {
            position: relative;
            background: white;
            padding: 18px 24px;
            border-radius: 14px;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 1px solid var(--accent-border, #e2e8f0);
            display: flex;
            flex-direction: column;
            gap: 12px;
            overflow: hidden;
          }
          .recommended-card::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(120deg, transparent 0%, var(--accent-soft, rgba(7, 7, 78, 0.08)) 50%, transparent 100%);
            transform: translateX(-100%);
            pointer-events: none;
            transition: transform 0.7s ease;
          }
          .recommended-card:hover::after {
            transform: translateX(100%);
          }

          .recommended-card:hover {
            box-shadow: 0 10px 28px var(--accent-soft, rgba(7, 7, 78, 0.12));
            border-color: var(--accent, #07074E);
            background: #fefeff;
          }

          .recommended-card-badge {
            display: inline-block;
            font-size: 0.62rem;
            font-weight: 700;
            color: var(--accent, #a0aec0);
            background: var(--accent-soft, transparent);
            text-transform: uppercase;
            letter-spacing: 0.12em;
            line-height: 1;
            padding: 4px 10px;
            border-radius: 100px;
            margin-bottom: 4px;
            align-self: flex-start;
          }

          .recommended-card-inner {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .recommended-card-icon {
            width: 46px;
            height: 46px;
            min-width: 46px;
            background: var(--accent-soft, #f0f4ff);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--accent, #07074E);
            transition: transform 0.3s ease;
          }
          .recommended-card:hover .recommended-card-icon {
            transform: scale(1.08) rotate(-3deg);
          }

          .recommended-card-content {
            flex: 1;
          }

          .recommended-card h3 {
            font-size: 1rem;
            font-weight: 600;
            color: #1a202c;
            margin: 0 0 4px 0;
          }

          .recommended-card p {
            font-size: 0.8rem;
            color: #718096;
            margin: 0;
            line-height: 1.4;
          }

          .explore-section-header {
            margin: 0 0 28px;
          }
          .section-eyebrow {
            display: inline-block;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.15em;
            color: #07074E;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          .explore-section h2 {
            font-size: 1.65rem;
            font-weight: 700;
            color: #1a202c;
            letter-spacing: -0.02em;
            margin: 0 0 6px 0;
          }
          .section-subtitle {
            color: #718096;
            font-size: 0.95rem;
            margin: 0;
          }

          .explore-container {
            display: flex;
            gap: 24px;
          }

          .categories-sidebar {
            width: 220px;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
            max-height: 640px;
            overflow-y: auto;
          }

          .categories-sidebar::-webkit-scrollbar {
            width: 6px;
          }

          .categories-sidebar::-webkit-scrollbar-track {
            background: #f0f4ff;
            border-radius: 3px;
          }

          .categories-sidebar::-webkit-scrollbar-thumb {
            background: #cbd5e0;
            border-radius: 3px;
          }

          .categories-sidebar::-webkit-scrollbar-thumb:hover {
            background: #a0aec0;
          }

          .category-sidebar-item {
            position: relative;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            min-height: 52px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            cursor: pointer;
            transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease, transform 0.25s ease;
            color: #4a5568;
            font-size: 0.9rem;
            font-weight: 500;
            text-align: left;
            overflow: hidden;
            line-height: 1.3;
          }
          .category-sidebar-item > span {
            flex: 1;
            min-width: 0;
          }
          .category-sidebar-item::before {
            content: '';
            position: absolute;
            left: 0;
            top: 10%;
            bottom: 10%;
            width: 0;
            background: linear-gradient(180deg, #07074E, #07074E);
            border-radius: 0 2px 2px 0;
            transition: width 0.25s ease;
          }

          .category-sidebar-item:hover {
            background: #f7fafc;
            border-color: #cbd5e0;
            transform: translateX(2px);
          }
          .category-sidebar-item:hover::before {
            width: 3px;
          }

          .category-sidebar-item.active {
            background: #f0f4ff;
            border-color: #07074E;
            color: #07074E;
          }
          .category-sidebar-item.active::before {
            width: 4px;
          }

          .category-item-icon {
            width: 32px;
            height: 32px;
            min-width: 32px;
            border-radius: 8px;
            background: linear-gradient(135deg, rgba(7, 7, 78, 0.06), rgba(7, 7, 78, 0.1));
            display: flex;
            align-items: center;
            justify-content: center;
            color: #07074E;
            transition: background 0.25s ease, color 0.25s ease, transform 0.25s ease;
          }
          .category-sidebar-item.active .category-item-icon {
            background: linear-gradient(135deg, #07074E, #07074E);
            color: #ffffff;
          }
          .category-sidebar-item:hover .category-item-icon {
            transform: scale(1.05);
          }

          .category-item-icon svg {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
          }

          .categories-content {
            flex: 1;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            grid-auto-rows: min-content;
            align-items: start;
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
            box-shadow: 0 8px 24px rgba(7, 7, 78, 0.12);
            border-color: #07074E;
          }

          .card-header {
            width: 48px;
            height: 48px;
            background: #f0f4ff;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #07074E;
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
            .categories-bar {
              padding: 0 32px;
              gap: 24px;
              top: 68px;
            }

            .welcome-header {
              flex-wrap: wrap;
              gap: 16px;
            }

            .header-search-bar {
              max-width: 100%;
              flex: 1 1 100%;
              order: 3;
            }

            .welcome-banner h1 {
              font-size: 1.75rem;
            }

            .recommended-cards {
              grid-template-columns: repeat(2, 1fr);
            }

            .explore-container {
              flex-direction: column;
            }

            .categories-sidebar {
              width: 100%;
              max-height: 120px;
              flex-direction: row;
              overflow-x: auto;
              overflow-y: hidden;
            }

            .category-sidebar-item {
              flex-shrink: 0;
            }

            .categories-content {
              grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            }
          }

          @media (max-width: 768px) {
            .categories-bar {
              padding: 0 16px;
              gap: 20px;
              top: 64px;
            }

            .category-btn {
              font-size: 0.9rem;
              padding: 12px 0;
            }

            .welcome-header {
              padding: 12px 16px;
              gap: 12px;
              flex-wrap: wrap;
            }

            .header-search-bar {
              max-width: 100%;
              flex: 1 1 100%;
              order: 3;
              padding: 8px 12px;
            }

            .header-search-bar input {
              font-size: 0.9rem;
            }

            .header-icons {
              gap: 12px;
            }

            .header-icon-btn {
              width: 36px;
              height: 36px;
            }

            .welcome-main {
              padding: 20px 16px;
            }

            .welcome-banner {
              margin-bottom: 24px;
            }

            .welcome-banner h1 {
              font-size: 1.5rem;
            }

            .recommended-cards {
              grid-template-columns: 1fr;
              gap: 12px;
            }

            .recommended-card {
              padding: 14px 20px;
            }

            .recommended-card-badge {
              font-size: 0.6rem;
            }

            .recommended-card-icon {
              width: 40px;
              height: 40px;
              min-width: 40px;
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

          /* Gig Cards Styles */
          .gigs-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            grid-auto-rows: min-content;
            align-items: start;
            gap: 24px;
          }

          .gig-card-welcome {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            gap: 0;
          }

          .gig-media-preview {
            position: relative;
            width: 100%;
            height: 240px;
            background: #f0f0f0;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
          }

          .gig-preview-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
          }
          .gig-card-welcome:hover .gig-preview-image {
            transform: scale(1.06);
          }

          .gig-creator-overlay {
            position: absolute;
            left: 10px;
            bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: calc(100% - 20px);
          }
          .creator-avatar.creator-avatar--overlay {
            width: 16px;
            height: 16px;
            font-size: 9px;
            border: 1px solid rgba(255, 255, 255, 0.7);
          }
          .creator-name-overlay {
            color: #000;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .attachment-more {
            position: absolute;
            bottom: 8px;
            right: 8px;
            width: 26px;
            height: 26px;
            background: rgba(0,0,0,0.6);
            color: white;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 600;
          }

          .gig-price-chip {
            position: absolute;
            top: 10px;
            left: 10px;
            background: #ffffff;
            color: #07074e;
            font-weight: 700;
            font-size: 13px;
            padding: 5px 12px;
            border-radius: 100px;
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
            z-index: 2;
          }

          .gig-wishlist-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.92);
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #4a5568;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            backdrop-filter: blur(6px);
            transition: transform 0.2s ease, color 0.2s ease, background 0.2s ease;
            z-index: 2;
          }
          .gig-wishlist-btn:hover {
            color: #ef4444;
            background: #ffffff;
            transform: scale(1.1);
          }
          .gig-wishlist-btn:active {
            transform: scale(0.95);
          }
          .gig-wishlist-btn.active {
            color: #ef4444;
          }
          .gig-wishlist-btn.active svg {
            fill: currentColor;
          }

          .gig-footer--simple {
            padding: 8px 16px 12px;
          }
          .gig-cta-button--wide {
            width: 100%;
          }

          .gig-card-welcome:hover {
            border-color: #4a90e2;
            box-shadow: 0 4px 12px rgba(74, 144, 226, 0.15);
            transform: translateY(-4px);
          }

          .gig-creator-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 16px 8px 16px;
            border-bottom: 1px solid #f0f0f0;
          }

          .creator-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #07074E 0%, #07074E 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 16px;
            flex-shrink: 0;
          }

          .creator-info {
            flex: 1;
          }

          .creator-name {
            font-size: 13px;
            font-weight: 600;
            color: #07074e;
            margin: 0 0 4px 0;
            line-height: 1.2;
          }

          .gig-creator-badge {
            display: inline-block;
            padding: 3px 8px;
            border: 1px solid currentColor;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .gig-creator-rating {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #07074e;
          }

          .gig-creator-rating .rating-value {
            font-weight: 600;
          }

          .gig-creator-rating .rating-count {
            color: #6b7280;
            font-weight: 400;
          }

          .gig-creator-rating .rating-new {
            display: inline-block;
            background: #e0f2fe;
            color: #0369a1;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 500;
          }

          .gig-heart-icon {
            color: #ddd;
            flex-shrink: 0;
            transition: color 0.2s;
          }

          .gig-card-welcome:hover .gig-heart-icon {
            color: #e74c3c;
          }

          .gig-card-welcome .gig-title {
            font-size: 13px;
            font-weight: 600;
            color: #07074e;
            margin: 0 0 2px 0;
            padding: 0 16px;
            line-height: 1.2;
            min-height: 0;
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .gig-card-welcome .gig-description {
            font-size: 11px;
            color: #666;
            margin: 0;
            padding: 0 16px;
            line-height: 1.35;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .gig-details-grid {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            padding: 8px 16px;
          }

          .gig-detail-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #999;
            background: #f5f5f5;
            padding: 4px 8px;
            border-radius: 4px;
          }

          .gig-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 6px 16px 8px;
            margin-top: 4px;
          }

          .gig-budget {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
            color: #07074e;
          }

          .budget-amount {
            font-size: 14px;
          }

          .gig-cta-button {
            flex: 1;
            padding: 6px 10px;
            background: linear-gradient(135deg, #5a9ee5 0%, #4a90e2 100%);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.25s ease;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }
          .gig-cta-arrow {
            transition: transform 0.25s ease;
          }
          .gig-cta-button:hover {
            background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(74, 144, 226, 0.35);
          }
          .gig-cta-button:hover .gig-cta-arrow {
            transform: translateX(3px);
          }

          .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #999;
            font-size: 16px;
          }
        `}</style>
      </main>
    </div>
  );
}
