import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Star,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Check,
  ArrowLeft,
  MessageCircle,
  MapPin,
  Globe,
  Calendar,
  Volume2,
  Play
} from 'lucide-react';
import './GigDetailsPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function GigDetailsPage() {
  const { gigId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [gig, setGig] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [activePortfolioIdx, setActivePortfolioIdx] = useState(0);
  const [activePortfolioMediaIdx, setActivePortfolioMediaIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState('basic');
  const [numberOfSeconds, setNumberOfSeconds] = useState(15);

  useEffect(() => {
    fetchGig();
  }, [gigId]);

  const fetchGig = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/gigs/${gigId}`);
      setGig(res.data);
      if (res.data?.creator_id) {
        fetchReviews(res.data.creator_id);
        fetchCreatorPortfolio(res.data.creator_id);
      }
    } catch (error) {
      toast.error('Failed to load gig details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (creatorId) => {
    try {
      const res = await axios.get(`${API}/reviews/creator/${creatorId}`);
      setReviews(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      setReviews([]);
    }
  };

  const absolutizeUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
    const base = (BACKEND_URL || '').replace(/\/$/, '');
    return `${base}/${url.replace(/^\//, '')}`;
  };

  const fetchCreatorPortfolio = async (creatorId) => {
    try {
      console.log('[Portfolio] Fetching for creator:', creatorId);
      const res = await axios.get(`${API}/profile/${creatorId}`);
      console.log('[Portfolio] res.data.portfolio:', res.data?.portfolio);
      console.log('[Portfolio] res.data.profile?.portfolio:', res.data?.profile?.portfolio);

      // Portfolio can be on user root or inside profile sub-object — check both
      const rawItems = Array.isArray(res.data?.portfolio) && res.data.portfolio.length
        ? res.data.portfolio
        : (Array.isArray(res.data?.profile?.portfolio) ? res.data.profile.portfolio : []);

      console.log('[Portfolio] Raw items found:', rawItems.length, rawItems);

      const normalized = rawItems.map((item) => {
        if (!item) return null;
        if (typeof item === 'string') {
          return { urls: [absolutizeUrl(item)], title: '', description: '', project_cost: '', project_duration: '', created_at: '' };
        }
        const rawUrls = Array.isArray(item.urls) ? item.urls : (item.url ? [item.url] : []);
        const urls = rawUrls.map(absolutizeUrl).filter(Boolean);
        return {
          urls,
          title: item.title || '',
          description: item.description || '',
          project_cost: item.project_cost || '',
          project_duration: item.project_duration || '',
          created_at: item.created_at || ''
        };
      }).filter((item) => item && item.urls.length > 0);

      console.log('[Portfolio] Normalized:', normalized);
      setPortfolio(normalized);
    } catch (error) {
      console.error('[Portfolio] Failed to fetch creator portfolio:', error?.response?.status, error?.response?.data, error);
      setPortfolio([]);
    }
  };

  const handleContactCreator = async () => {
    if (!gig?.creator_id) {
      toast.error('Creator information not available');
      return;
    }

    try {
      const res = await axios.get(`${API}/business/wallet`);
      const balance = Number(res.data?.available_balance || 0);
      const minBalance = Number(res.data?.minimum_chat_balance || 5000);
      const chatUnlocked = res.data?.chat_unlocked ?? balance >= minBalance;

      if (!chatUnlocked) {
        toast.error(
          `Recharge your wallet to chat. Minimum ₹${minBalance.toLocaleString()} balance required (current: ₹${balance.toLocaleString()}).`,
          { duration: 5000 }
        );
        return;
      }

      navigate(`/dashboard/business/messages?creator=${gig.creator_id}`);
    } catch (error) {
      console.error('Wallet check failed:', error);
      toast.error('Unable to verify wallet balance. Please try again.');
    }
  };

  const handleContinue = () => {
    toast.success('Proceeding to order placement');
  };

  const handleNextMedia = () => {
    if (gig?.attachments?.length > 0) {
      setActiveMediaIndex((prev) => (prev + 1) % gig.attachments.length);
    }
  };

  const handlePrevMedia = () => {
    if (gig?.attachments?.length > 0) {
      setActiveMediaIndex((prev) => (prev - 1 + gig.attachments.length) % gig.attachments.length);
    }
  };

  const isVideo = (url) => /\.(mp4|webm|mov)$/i.test(url || '');

  const packages = {
    basic: {
      name: 'Basic',
      title: `${numberOfSeconds}s selfie-style video -raw footage`,
      price: gig?.price || gig?.budget || 1009,
      description: gig?.description?.substring(0, 100) || 'Natural talking-head video. Perfect for authentic product reviews, app, services.',
      delivery: gig?.deliveryTime || gig?.delivery_days || 1,
      revisions: 1,
      features: ['1 video', 'B-Roll included', 'Graphics included', 'Subtitles/captions included', '3 months usage rights']
    },
    standard: {
      name: 'Standard',
      title: `${numberOfSeconds * 2}s premium UGC video`,
      price: Math.round((gig?.price || gig?.budget || 1009) * 2.5),
      description: 'Premium quality with enhanced features',
      delivery: (gig?.deliveryTime || gig?.delivery_days || 1) + 2,
      revisions: 2,
      features: ['2 videos', 'B-Roll included', 'Graphics included', 'Subtitles/captions included', '6 months usage rights', 'Priority support']
    },
    premium: {
      name: 'Premium',
      title: `${numberOfSeconds * 3}s premium UGC package`,
      price: Math.round((gig?.price || gig?.budget || 1009) * 4),
      description: 'Complete UGC package with all features',
      delivery: (gig?.deliveryTime || gig?.delivery_days || 1) + 4,
      revisions: 5,
      features: ['5 videos', 'B-Roll included', 'Graphics included', 'Subtitles/captions included', '12 months usage rights', 'Priority support', 'Source files included']
    }
  };

  const currentPackage = packages[selectedPackage];

  if (loading) {
    return (
      <div className="gdp-loading">
        <div className="gdp-spinner"></div>
        <p>Loading gig details...</p>
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="gdp-error">
        <h2>Gig not found</h2>
        <button onClick={() => navigate(-1)} className="gdp-back-btn">
          <ArrowLeft size={18} /> Go Back
        </button>
      </div>
    );
  }

  const attachments = gig.attachments || [];
  const currentAttachment = attachments[activeMediaIndex];

  return (
    <div className="gdp-container">
      <div className="gdp-back-bar">
        <button onClick={() => navigate(-1)} className="gdp-back-link">
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      <div className="gdp-content">
        <div className="gdp-main">
          <h1 className="gdp-title">{gig.title}</h1>

          <div className="gdp-creator-row">
            <div className="gdp-creator-avatar">
              {(gig.public_creator_id || gig.creator_id)?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div className="gdp-creator-info">
              <div className="gdp-creator-name">{gig.public_creator_id || gig.creator_id || 'Creator'}</div>
              <div className="gdp-creator-meta">
                <span className="gdp-level">{gig.creator_total_reviews >= 10 ? 'Level 2' : gig.creator_total_reviews >= 3 ? 'Level 1' : 'New Creator'}</span>
                {gig.creator_total_reviews > 0 ? (
                  <span className="gdp-rating">
                    <Star size={14} fill="#fbbf24" stroke="#fbbf24" /> {gig.creator_avg_rating?.toFixed(1)}
                    <span className="gdp-review-count">({gig.creator_total_reviews} review{gig.creator_total_reviews !== 1 ? 's' : ''})</span>
                  </span>
                ) : (
                  <span className="gdp-rating gdp-no-reviews">No reviews yet</span>
                )}
              </div>
            </div>
            <div className="gdp-creator-actions">
              <button className="gdp-icon-btn"><Heart size={18} /> <span>20</span></button>
              <button className="gdp-icon-btn"><Share2 size={18} /></button>
            </div>
          </div>

          <div className="gdp-media-section">
            {attachments.length > 0 ? (
              <>
                <div className="gdp-media-main">
                  {isVideo(currentAttachment) ? (
                    <video src={currentAttachment} controls className="gdp-media-content" />
                  ) : (
                    <img
                      src={currentAttachment}
                      alt="Gig media"
                      className="gdp-media-content"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22400%22%3E%3Crect fill=%22%23e0e0e0%22 width=%22600%22 height=%22400%22/%3E%3Ctext x=%22300%22 y=%22200%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2218%22%3EImage Preview%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  )}
                  {attachments.length > 1 && (
                    <>
                      <button className="gdp-media-nav gdp-media-prev" onClick={handlePrevMedia}>
                        <ChevronLeft size={24} />
                      </button>
                      <button className="gdp-media-nav gdp-media-next" onClick={handleNextMedia}>
                        <ChevronRight size={24} />
                      </button>
                    </>
                  )}
                </div>
                {attachments.length > 1 && (
                  <div className="gdp-media-thumbs">
                    {attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className={`gdp-thumb ${activeMediaIndex === idx ? 'is-active' : ''}`}
                        onClick={() => setActiveMediaIndex(idx)}
                      >
                        {isVideo(att) ? (
                          <div className="gdp-thumb-video">
                            <Play size={24} />
                          </div>
                        ) : (
                          <img
                            src={att}
                            alt={`Thumb ${idx + 1}`}
                            onError={(e) => {
                              e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23e0e0e0%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E';
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="gdp-media-empty">No media available</div>
            )}
          </div>

          <div className="gdp-about-section">
            <h2 className="gdp-section-title">About this gig</h2>
            <p className="gdp-description">{gig.description}</p>
          </div>

          <div className="gdp-creator-details">
            <div className="gdp-detail-grid">
              {gig.creator_name && (
                <div className="gdp-detail-item">
                  <div className="gdp-detail-label">Creator</div>
                  <div className="gdp-detail-value">{gig.gender || 'Not specified'}</div>
                </div>
              )}
              {gig.nativeLanguage && (
                <div className="gdp-detail-item">
                  <div className="gdp-detail-label">Native language</div>
                  <div className="gdp-detail-value">{gig.nativeLanguage}</div>
                </div>
              )}
              {gig.accent && (
                <div className="gdp-detail-item">
                  <div className="gdp-detail-label">Accent</div>
                  <div className="gdp-detail-value">{gig.accent}</div>
                </div>
              )}
              {gig.ageRange && (
                <div className="gdp-detail-item">
                  <div className="gdp-detail-label">Age range</div>
                  <div className="gdp-detail-value">{gig.ageRange}</div>
                </div>
              )}
              {gig.videoStyles?.length > 0 && (
                <div className="gdp-detail-item">
                  <div className="gdp-detail-label">Video styles</div>
                  <div className="gdp-detail-value">{gig.videoStyles.join(', ')}</div>
                </div>
              )}
              {gig.filmingStyle?.length > 0 && (
                <div className="gdp-detail-item">
                  <div className="gdp-detail-label">Filming style</div>
                  <div className="gdp-detail-value">
                    {Array.isArray(gig.filmingStyle) ? gig.filmingStyle.join(', ') : gig.filmingStyle}
                  </div>
                </div>
              )}
              {gig.platforms?.length > 0 && (
                <div className="gdp-detail-item">
                  <div className="gdp-detail-label">Platforms</div>
                  <div className="gdp-detail-value">{gig.platforms.join(', ')}</div>
                </div>
              )}
              {(Array.isArray(gig.niche) ? gig.niche.length > 0 : gig.niche) && (
                <div className="gdp-detail-item">
                  <div className="gdp-detail-label">Niche</div>
                  <div className="gdp-detail-value">
                    {Array.isArray(gig.niche) ? gig.niche.join(', ') : gig.niche}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="gdp-creator-profile">
            <h2 className="gdp-section-title">Get to know {gig.public_creator_id || gig.creator_id || 'creator'}</h2>

            <div className="gdp-profile-header">
              <div className="gdp-profile-avatar">
                {(gig.public_creator_id || gig.creator_id)?.charAt(0).toUpperCase() || 'C'}
              </div>
              <div className="gdp-profile-info">
                <div className="gdp-profile-name-row">
                  <h3>{gig.public_creator_id || gig.creator_id || 'Creator'}</h3>
                  <span className="gdp-online-status">● Online</span>
                </div>
                <p className="gdp-profile-tagline">
                  UGC Creator, Digital Marketer, Talking head, Podcast
                </p>
                <div className="gdp-profile-rating">
                  {gig.creator_total_reviews > 0 ? (
                    <>
                      <Star size={14} fill="#fbbf24" stroke="#fbbf24" /> {gig.creator_avg_rating?.toFixed(1)}
                      <span className="gdp-review-count">({gig.creator_total_reviews})</span>
                    </>
                  ) : (
                    <span className="gdp-no-reviews">No reviews yet</span>
                  )}
                  <span className="gdp-level">{gig.creator_total_reviews >= 10 ? 'Level 2' : gig.creator_total_reviews >= 3 ? 'Level 1' : 'New Creator'}</span>
                </div>
                <button className="gdp-contact-btn-secondary" onClick={handleContactCreator}>
                  Contact me
                </button>
              </div>
            </div>

            <div className="gdp-profile-stats">
              <div className="gdp-profile-stat">
                <div className="gdp-stat-label">From</div>
                <div className="gdp-stat-value">{gig.city || 'India'}</div>
              </div>
              <div className="gdp-profile-stat">
                <div className="gdp-stat-label">Member since</div>
                <div className="gdp-stat-value">2024</div>
              </div>
              <div className="gdp-profile-stat">
                <div className="gdp-stat-label">Avg. response time</div>
                <div className="gdp-stat-value">1 hour</div>
              </div>
              <div className="gdp-profile-stat">
                <div className="gdp-stat-label">Last delivery</div>
                <div className="gdp-stat-value">about 16 hours</div>
              </div>
              <div className="gdp-profile-stat">
                <div className="gdp-stat-label">Languages</div>
                <div className="gdp-stat-value">{gig.nativeLanguage || 'English'}</div>
              </div>
            </div>

            <div className="gdp-profile-bio">
              <p>
                Hey! 👋 {gig.public_creator_id || gig.creator_id || 'Creator'} here, your expert UGC Creator, creative strategist, and Digital
                Marketer. With years of experience in ecommerce, I specialize in setting up a real
                testing strategy ads and creating high-performing, authentic stories, short-form
                videos that convert.
              </p>
            </div>
          </div>

          {portfolio.length > 0 && (() => {
            const activeItem = portfolio[activePortfolioIdx] || portfolio[0];
            const activeMedia = activeItem?.urls?.[activePortfolioMediaIdx] || activeItem?.urls?.[0] || '';
            const formatMonthYear = (iso) => {
              if (!iso) return '';
              try {
                const d = new Date(iso);
                return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
              } catch { return ''; }
            };
            const isVid = isVideo(activeMedia);
            return (
              <div className="gdp-portfolio-section">
                <h2 className="gdp-section-title">My Portfolio</h2>

                <div className="gdp-portfolio-card">
                  <div className="gdp-portfolio-card-media">
                    {isVid ? (
                      <video
                        src={activeMedia}
                        controls
                        className="gdp-portfolio-media"
                        onError={(e) => { console.error('[Portfolio] Video failed to load:', activeMedia); }}
                      />
                    ) : (
                      <img
                        src={activeMedia}
                        alt={activeItem?.title || 'Portfolio'}
                        className="gdp-portfolio-media"
                        onLoad={() => console.log('[Portfolio] Image loaded:', activeMedia)}
                        onError={(e) => {
                          console.error('[Portfolio] Image failed to load:', activeMedia);
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-size=%2218%22 fill=%22%23999%22%3EImage unavailable%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    )}
                    {activeItem?.urls?.length > 1 && (
                      <div className="gdp-portfolio-count-badge">📷 {activeItem.urls.length}</div>
                    )}
                  </div>

                  <div className="gdp-portfolio-card-info">
                    {activeItem?.created_at && (
                      <div className="gdp-portfolio-from">From: {formatMonthYear(activeItem.created_at)}</div>
                    )}
                    {activeItem?.title && <h3 className="gdp-portfolio-title">{activeItem.title}</h3>}
                    {activeItem?.description && (
                      <p className="gdp-portfolio-desc">{activeItem.description}</p>
                    )}

                    {(activeItem?.project_cost || activeItem?.project_duration) && (
                      <div className="gdp-portfolio-meta">
                        {activeItem?.project_cost && (
                          <div className="gdp-portfolio-meta-item">
                            <span className="gdp-portfolio-meta-label">Project cost</span>
                            <span className="gdp-portfolio-meta-value">{activeItem.project_cost}</span>
                          </div>
                        )}
                        {activeItem?.project_duration && (
                          <div className="gdp-portfolio-meta-item">
                            <span className="gdp-portfolio-meta-label">Project duration</span>
                            <span className="gdp-portfolio-meta-value">{activeItem.project_duration}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {portfolio.length > 1 && (
                  <div className="gdp-portfolio-thumbs">
                    {portfolio.slice(0, 5).map((item, idx) => {
                      const thumbUrl = item?.urls?.[0] || '';
                      const thumbIsVid = isVideo(thumbUrl);
                      return (
                        <div
                          key={idx}
                          className={`gdp-portfolio-thumb ${idx === activePortfolioIdx ? 'is-active' : ''}`}
                          onClick={() => { setActivePortfolioIdx(idx); setActivePortfolioMediaIdx(0); }}
                        >
                          {thumbIsVid ? (
                            <video src={thumbUrl} muted />
                          ) : (
                            <img src={thumbUrl} alt={item?.title || `Project ${idx + 1}`}
                              onError={(e) => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22120%22 height=%22120%22/%3E%3C/svg%3E'; }}
                            />
                          )}
                        </div>
                      );
                    })}
                    {portfolio.length > 5 && (
                      <div className="gdp-portfolio-more">
                        <strong>+{portfolio.length - 5}</strong>
                        <span>Projects</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="gdp-reviews-section">
            <h2 className="gdp-section-title">
              Reviews {reviews.length > 0 && `(${reviews.length})`}
            </h2>

            {reviews.length === 0 ? (
              <div className="gdp-reviews-empty">
                <Star size={32} stroke="#d1d5db" />
                <p>No reviews yet. Be the first to work with this creator!</p>
              </div>
            ) : (
              <>
                <div className="gdp-reviews-summary">
                  <div className="gdp-reviews-avg">
                    <span className="gdp-reviews-score">{gig.creator_avg_rating?.toFixed(1) || '0.0'}</span>
                    <div className="gdp-reviews-stars">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={16}
                          fill={s <= Math.round(gig.creator_avg_rating || 0) ? '#fbbf24' : 'none'}
                          stroke={s <= Math.round(gig.creator_avg_rating || 0) ? '#fbbf24' : '#d1d5db'}
                        />
                      ))}
                    </div>
                    <span className="gdp-reviews-count">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="gdp-reviews-list">
                  {reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="gdp-review-item">
                      <div className="gdp-review-header">
                        <div className="gdp-review-avatar">
                          {(review.reviewer_name || review.reviewer_id || 'B')?.charAt(0).toUpperCase()}
                        </div>
                        <div className="gdp-review-info">
                          <div className="gdp-review-author">{review.reviewer_name || 'Brand'}</div>
                          <div className="gdp-review-stars">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={12}
                                fill={s <= (review.rating || 0) ? '#fbbf24' : 'none'}
                                stroke={s <= (review.rating || 0) ? '#fbbf24' : '#d1d5db'}
                              />
                            ))}
                            <span className="gdp-review-date">
                              {review.created_at ? new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="gdp-review-text">{review.review || review.comment || 'No comment provided.'}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="gdp-sidebar">
          <div className="gdp-package-card">
            <div className="gdp-package-tabs">
              {Object.keys(packages).map((key) => (
                <button
                  key={key}
                  className={`gdp-package-tab ${selectedPackage === key ? 'is-active' : ''}`}
                  onClick={() => setSelectedPackage(key)}
                >
                  {packages[key].name}
                </button>
              ))}
            </div>

            <div className="gdp-package-body">
              <h3 className="gdp-package-title">{currentPackage.title}</h3>
              <div className="gdp-package-price">₹{currentPackage.price.toLocaleString()}</div>
              <p className="gdp-package-desc">{currentPackage.description}</p>

              <div className="gdp-package-meta">
                <div className="gdp-package-meta-item">
                  <Clock size={16} />
                  <span>{currentPackage.delivery}-day delivery</span>
                </div>
                <div className="gdp-package-meta-item">
                  <RefreshCw size={16} />
                  <span>{currentPackage.revisions} Revision{currentPackage.revisions > 1 ? 's' : ''}</span>
                </div>
              </div>

              <ul className="gdp-package-features">
                {currentPackage.features.map((feature, idx) => (
                  <li key={idx}>
                    <Check size={16} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="gdp-seconds-input">
                <label>Number of seconds</label>
                <input
                  type="number"
                  value={numberOfSeconds}
                  onChange={(e) => setNumberOfSeconds(parseInt(e.target.value) || 15)}
                  min="15"
                  step="15"
                />
              </div>

              <button className="gdp-continue-btn" onClick={handleContinue}>
                Continue <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <button className="gdp-contact-btn" onClick={handleContactCreator}>
            Contact me
          </button>
        </aside>
      </div>
    </div>
  );
}
