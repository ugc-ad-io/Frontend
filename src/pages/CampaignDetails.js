import { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { ArrowLeft, User, IndianRupee, Calendar, MessageSquare, Package, Target, CheckCircle, Star } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Creators get the marketplace top-nav shell (consistent with Browse Briefs / My Bids);
// brands keep the bare page they had.
function CreatorShell({ isCreator, children }) {
  return isCreator ? <CreatorTopNavLayout>{children}</CreatorTopNavLayout> : <>{children}</>;
}

// The brief is stored as plain text ("Label: value" per line). Render it so the
// label reads as a dark sub-heading and the value as muted body text.
function renderBrief(text) {
  if (!text) return <p className="brief-line">No brief details provided.</p>;
  return String(text).split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="brief-gap" />;
    const idx = line.indexOf(':');
    if (idx > 0 && idx <= 28) {
      return (
        <p key={i} className="brief-line">
          <strong>{line.slice(0, idx)}:</strong> {line.slice(idx + 1).trim()}
        </p>
      );
    }
    return <p key={i} className="brief-line">{line}</p>;
  });
}

export default function CampaignDetails({ embedId, onClose }) {
  const params = useParams();
  const id = embedId || params.id;
  const navigate = useNavigate();
  const goBack = () => (onClose ? onClose() : navigate(-1));
  const { user } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [proposal, setProposal] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [showCreatorModal, setShowCreatorModal] = useState(false);
  const [creatorDetails, setCreatorDetails] = useState(null);
  const [loadingCreator, setLoadingCreator] = useState(false);
  const [shortlist, setShortlist] = useState(null);
  const [shortlistBusy, setShortlistBusy] = useState(false);
  const [inviteTarget, setInviteTarget] = useState(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteBrief, setInviteBrief] = useState('');

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  // Brands on the "Request Matches" path get an ops-curated shortlist (PRD 5.4).
  useEffect(() => {
    if (!campaign || !user) return;
    const owner = user.role === 'business' && campaign.business_id === user.id;
    if (owner && campaign.match_status) fetchShortlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, campaign?.match_status, user?.id]);

  const fetchShortlist = async () => {
    try {
      const res = await axios.get(`${API}/campaigns/${id}/shortlist`);
      setShortlist(res.data);
    } catch (error) {
      // Non-fatal: the shortlist panel just stays hidden.
    }
  };

  const handleInvite = async () => {
    if (!inviteTarget) return;
    setShortlistBusy(true);
    try {
      await axios.post(`${API}/campaigns/${id}/shortlist/${inviteTarget.creator_id}/invite`, {
        message: inviteMessage,
        brief: inviteBrief,
      });
      toast.success('Invitation sent — opening chat with the creator…');
      const creatorId = inviteTarget.creator_id;
      setInviteTarget(null);
      setInviteMessage('');
      setInviteBrief('');
      await fetchCampaign();
      await fetchShortlist();
      await new Promise(resolve => setTimeout(resolve, 1200));
      // Open the full Messages UI (renders the private_invitation action card);
      // /chat/:id is a basic view that does not render action cards.
      navigate(`/messages?conv=${creatorId}`);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to send invitation'));
    } finally {
      setShortlistBusy(false);
    }
  };

  const handleRequestNewShortlist = async () => {
    setShortlistBusy(true);
    try {
      await axios.post(`${API}/campaigns/${id}/shortlist/request-new`);
      toast.success('New shortlist requested — our team will curate fresh matches');
      await fetchCampaign();
      await fetchShortlist();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to request a new shortlist'));
    } finally {
      setShortlistBusy(false);
    }
  };

  const shortlistMediaUrl = (path) => {
    if (!path) return '';
    return path.startsWith('http') ? path : `${BACKEND_URL}${path}`;
  };

  const fetchCampaign = async () => {
    try {
      // Add cache-busting parameter to ensure fresh data
      const response = await axios.get(`${API}/campaigns/${id}?t=${Date.now()}`);
      setCampaign(response.data);
    } catch (error) {
      toast.error('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCreator = async (creatorId) => {
    try {
      const response = await axios.post(`${API}/campaigns/${id}/select-creator?creator_id=${creatorId}`);
      toast.success(`🎉 ${response.data.creator_nickname} selected! Payment of ₹${response.data.amount} held in escrow. Opening chat...`);
      
      // Wait a moment for the toast to be visible
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Redirect to chat with the creator
      navigate(`/chat/${creatorId}`);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to select creator'));
    }
  };

  const handleChat = (userId) => {
    navigate(`/chat/${userId}`);
  };

  const handleViewCreatorProfile = async (creatorId) => {
    setLoadingCreator(true);
    setShowCreatorModal(true);
    try {
      // Fetch creator profile
      const profileRes = await axios.get(`${API}/profile/${creatorId}`);
      
      // Fetch creator reviews
      const reviewsRes = await axios.get(`${API}/reviews/creator/${creatorId}`);
      
      // Fetch past collaborations with this creator
      const campaignsRes = await axios.get(`${API}/campaigns`);
      const pastCollaborations = campaignsRes.data.filter(
        c => c.business_id === user.id && 
        c.selected_creator === creatorId && 
        c.status === 'completed'
      );
      
      // Fetch queued orders with this creator
      const queuedOrders = campaignsRes.data.filter(
        c => c.business_id === user.id && 
        c.selected_creator === creatorId && 
        (c.status === 'in_progress' || c.status === 'active')
      );
      
      setCreatorDetails({
        profile: profileRes.data,
        reviews: reviewsRes.data,
        pastCollaborations,
        queuedOrders,
        avgRating: reviewsRes.data.length > 0 
          ? (reviewsRes.data.reduce((sum, r) => sum + r.rating, 0) / reviewsRes.data.length).toFixed(1)
          : 0
      });
    } catch (error) {
      toast.error('Failed to load creator details');
      setShowCreatorModal(false);
    } finally {
      setLoadingCreator(false);
    }
  };

  const handleSubmitBid = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/campaigns/${id}/bid`, {
        campaign_id: id,
        amount: parseFloat(bidAmount),
        proposal,
        estimated_delivery_days: parseInt(deliveryDays)
      });
      toast.success('Bid submitted successfully!');
      setShowBidModal(false);
      setBidAmount('');
      setProposal('');
      setDeliveryDays('');
      // Small delay to ensure DB write completes, then refresh campaign data
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetchCampaign();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to submit bid'));
    }
  };

  const hasUserBid = campaign?.bids?.some(bid => bid.creator_id === user?.id);
  const userBid = campaign?.bids?.find(bid => bid.creator_id === user?.id);

  if (loading) {
    return <div className="loading-page">Loading campaign...</div>;
  }

  if (!campaign) {
    return <div className="error-page">Campaign not found</div>;
  }

  const isBusiness = user?.role === 'business' && campaign.business_id === user.id;

  // When embedded in a modal, skip the CreatorShell chrome (the brand page already
  // provides the nav around the modal).
  const Wrap = embedId ? Fragment : CreatorShell;
  const wrapProps = embedId ? {} : { isCreator: user?.role === 'creator' };

  return (
    <Wrap {...wrapProps}>
    <div className="campaign-details-page">
      <style>{`
        /* Marketplace restyle — only applies under the creator top-nav shell (.cmk-app) */
        .cmk-app .campaign-details-page{min-height:auto;background:transparent;padding:0;display:block}
        .cmk-app .page-header{max-width:none;margin:0 0 18px}
        .cmk-app .back-btn{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid #e9ebf4;
          border-radius:12px;padding:10px 16px;color:#15163a;font-weight:700;cursor:pointer;font-family:inherit}
        .cmk-app .back-btn:hover{border-color:#cdd2f3}
        .cmk-app .campaign-container{max-width:900px;margin:0 auto;display:grid;grid-template-columns:1fr;gap:20px}
        .cmk-app .page-header{max-width:900px;margin:0 auto 18px}
        .cmk-app .campaign-info-card{background:#fff;border:1px solid #e9ebf4;border-radius:22px;
          box-shadow:0 18px 40px -18px rgba(28,30,80,.18);padding:30px}
        .cmk-app .campaign-title-section{display:flex;align-items:center;justify-content:space-between;gap:16px}
        .cmk-app .campaign-title-section h1{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);
          font-size:32px;font-weight:800;letter-spacing:-.5px;color:#15163a;margin:0}
        .cmk-app .badge{display:inline-flex;align-items:center;font-size:12.5px;font-weight:700;padding:6px 14px;
          border-radius:20px;background:#eef0ff;color:#5b6bff;text-transform:capitalize}
        .cmk-app .bid-submitted-banner,.cmk-app .creator-bid-banner{background:linear-gradient(135deg,#eef0ff,#f4f0ff);
          border:1px solid #e0e3ff;border-radius:18px;padding:22px;margin:20px 0}
        .cmk-app .bid-submitted-header h3,.cmk-app .creator-bid-banner h3{color:#4452f0}
        .cmk-app .detail-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0}
        .cmk-app .detail-label{color:#585c7e;font-weight:600}
        .cmk-app .detail-value{color:#15163a;font-weight:800}
        .cmk-app .status-badge{background:linear-gradient(100deg,#5b6bff,#4452f0);color:#fff;font-weight:700;
          padding:7px 16px;border-radius:12px;font-size:13px}
        .cmk-app .bid-submitted-proposal{background:#fff;border:1px solid #e9ebf4;border-radius:14px;padding:16px;margin-top:14px}
        .cmk-app .proposal-text{color:#585c7e;margin:6px 0 0}
        .cmk-app .btn-bid-now{background:linear-gradient(100deg,#5b6bff,#4452f0);color:#fff;border:none;border-radius:14px;
          padding:13px 24px;font-weight:700;cursor:pointer;box-shadow:0 12px 26px -12px rgba(68,82,240,.6);font-family:inherit}
        .cmk-app .campaign-meta{display:flex;flex-wrap:wrap;gap:22px;padding:18px 0;border-top:1px solid #eef0f6;
          border-bottom:1px solid #eef0f6;margin:20px 0}
        .cmk-app .meta-item{display:flex;align-items:center;gap:8px;color:#585c7e;font-weight:600}
        .cmk-app .meta-item svg{color:#5b6bff}
        .cmk-app .campaign-section{margin:22px 0}
        .cmk-app .campaign-section h3{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:20px;
          font-weight:700;color:#15163a;margin:0 0 12px}
        .cmk-app .brief-text{color:#585c7e;font-size:15px;line-height:1.7}
        .cmk-app .brief-line{margin:0 0 7px;color:#585c7e;font-size:14.5px;line-height:1.6}
        .cmk-app .brief-line strong{color:#15163a;font-weight:700}
        .cmk-app .brief-gap{height:12px}
        .cmk-app .objectives-grid{display:flex;flex-wrap:wrap;gap:10px}
        .cmk-app .objective-item{background:#eef0ff;color:#5b6bff;font-weight:600;font-size:13.5px;padding:8px 15px;border-radius:20px}
        .cmk-app .shipment-notice{background:#fff7ed;border:1px solid #ffe0bd;border-radius:14px;padding:16px;color:#9a5b14}

        .shortlist-section { border: 1px solid #ececf1; border-radius: 16px; padding: 20px 22px; margin: 18px 0; background: #fff; }
        .shortlist-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .shortlist-head h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 18px; }
        .shortlist-request-count { font-size: 12px; color: #8a8a93; background: #f3f3f6; padding: 3px 10px; border-radius: 999px; }
        .shortlist-intro { color: #555; font-size: 13px; margin: 0 0 14px; }
        .shortlist-state { background: #f8f8fb; border: 1px dashed #d9d9e2; border-radius: 12px; padding: 18px; color: #555; }
        .shortlist-state-done { display: flex; align-items: center; gap: 10px; color: #1f8a4c; background: #eefaf1; border-color: #bfe6cd; }
        .shortlist-state-done p, .shortlist-state p { margin: 0; }
        .shortlist-hint { display: block; margin-top: 8px; font-size: 12px; color: #8a8a93; }
        .shortlist-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
        .shortlist-card { border: 1px solid #ececf1; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 10px; transition: box-shadow .15s; }
        .shortlist-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,.06); }
        .shortlist-card.is-dismissed { opacity: .5; }
        .shortlist-card.is-invited { border-color: #bfe6cd; background: #f6fcf8; }
        .shortlist-card-head { display: flex; align-items: center; gap: 10px; }
        .shortlist-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .shortlist-avatar-fallback { display: flex; align-items: center; justify-content: center; background: #6d5efc; color: #fff; font-weight: 600; }
        .shortlist-name { font-weight: 600; font-size: 14px; }
        .shortlist-cat { font-size: 12px; color: #8a8a93; }
        .shortlist-badge { margin-left: auto; font-size: 11px; color: #1f8a4c; background: #eefaf1; padding: 2px 8px; border-radius: 999px; }
        .shortlist-meta { display: flex; flex-wrap: wrap; gap: 6px; }
        .shortlist-meta span { font-size: 11px; color: #555; background: #f3f3f6; padding: 3px 8px; border-radius: 6px; }
        .shortlist-note { font-size: 12px; font-style: italic; color: #6b6b76; margin: 0; }
        .shortlist-card-actions { display: flex; gap: 8px; margin-top: auto; }
        .shortlist-card-actions .btn-action-small { display: inline-flex; align-items: center; gap: 5px; padding: 7px 10px; border: 1px solid #ddd; border-radius: 8px; background: #fff; cursor: pointer; font-size: 13px; }
        .shortlist-card-actions .btn-select-small { flex: 1; padding: 7px 10px; border: none; border-radius: 8px; background: #6d5efc; color: #fff; cursor: pointer; font-weight: 600; font-size: 13px; }
        .shortlist-card-actions .btn-select-small:disabled { background: #c5c5cf; cursor: not-allowed; }
        .shortlist-request-new { margin-top: 16px; background: none; border: none; color: #6d5efc; cursor: pointer; font-size: 13px; font-weight: 600; padding: 0; }
        .shortlist-request-new:disabled { color: #b3b3bd; cursor: not-allowed; }
      `}</style>
      {!embedId && (
        <div className="page-header">
          <button className="back-btn" onClick={goBack} data-testid="back-btn">
            <ArrowLeft size={20} /> Back
          </button>
        </div>
      )}

      <div className="campaign-container fade-in">
        <div className="campaign-main">
          <div className="campaign-info-card">
            <div className="campaign-title-section">
              <h1>{campaign.title}</h1>
              <span className={`badge badge-${campaign.status}`}>{campaign.status.replace('_', ' ')}</span>
            </div>

            {user?.role === 'creator' && campaign.status === 'active' && !hasUserBid && (
              <div className="creator-bid-banner">
                <div className="banner-content">
                  <h3>Interested in this campaign?</h3>
                  <p>Submit your bid and proposal to work with this brand</p>
                </div>
                <button className="btn-bid-now" onClick={() => setShowBidModal(true)} data-testid="submit-bid-btn">
                  Submit Your Bid
                </button>
              </div>
            )}

            {user?.role === 'creator' && hasUserBid && (
              <div className="bid-submitted-banner">
                <div className="bid-submitted-content">
                  <div className="bid-submitted-header">
                    <CheckCircle size={24} />
                    <h3>Bid Already Submitted</h3>
                  </div>
                  <div className="bid-submitted-details">
                    <div className="detail-row">
                      <span className="detail-label">Your Bid Amount:</span>
                      <span className="detail-value">₹{userBid?.amount}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Estimated Delivery:</span>
                      <span className="detail-value">{userBid?.estimated_delivery_days} days</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Status:</span>
                      <span className="status-badge">Pending Review</span>
                    </div>
                  </div>
                  {userBid?.proposal && (
                    <div className="bid-submitted-proposal">
                      <p className="detail-label">Your Proposal:</p>
                      <p className="proposal-text">{userBid.proposal}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="campaign-meta">
              <div className="meta-item">
                <User size={20} />
                <span>Posted by {campaign.business_nickname}</span>
              </div>
              <div className="meta-item">
                <IndianRupee size={20} />
                <span>{Number(campaign.budget_min) === Number(campaign.budget_max)
                  ? `Budget: ₹${Number(campaign.budget_max).toLocaleString('en-IN')} (fixed)`
                  : `Budget: ₹${Number(campaign.budget_min).toLocaleString('en-IN')} - ₹${Number(campaign.budget_max).toLocaleString('en-IN')}`}</span>
              </div>
              {campaign.requires_shipment && (
                <div className="meta-item">
                  <Package size={20} />
                  <span>Product shipment included</span>
                </div>
              )}
            </div>

            <div className="campaign-section">
              <h3>Campaign Brief</h3>
              <div className="brief-text">{renderBrief(campaign.brief_text)}</div>
            </div>

            <div className="campaign-section">
              <h3>Objectives</h3>
              <div className="objectives-grid">
                {campaign.objectives.map((obj, idx) => (
                  <div key={idx} className="objective-item" data-testid={`objective-${idx}`}>
                    {obj}
                  </div>
                ))}
              </div>
            </div>

            {campaign.requires_shipment && (
              <div className="campaign-section">
                <div className="shipment-notice">
                  <strong>Product Shipment Required</strong>
                  <p>This campaign requires the creator to receive physical products</p>
                </div>
              </div>
            )}

            {/* Curated Shortlist (Request Matches path) */}
            {isBusiness && campaign.match_status && (
              <div className="campaign-section shortlist-section">
                <div className="shortlist-head">
                  <h3><Star size={18} /> Curated Shortlist</h3>
                  {shortlist?.shortlist_request_count > 0 && (
                    <span className="shortlist-request-count">Request #{shortlist.shortlist_request_count}</span>
                  )}
                </div>

                {campaign.match_status === 'fulfilled' ? (
                  <div className="shortlist-state shortlist-state-done">
                    <CheckCircle size={20} />
                    <p>You've invited a creator from this shortlist. Track the conversation in your chats.</p>
                  </div>
                ) : !shortlist || !shortlist.candidates || shortlist.candidates.length === 0 ? (
                  <div className="shortlist-state">
                    <p>Our team is curating creator matches for this brief. You'll be notified as soon as your shortlist is ready.</p>
                    {shortlist?.shortlist_request_count > 0 && (
                      <span className="shortlist-hint">New shortlist requested — sit tight while we find fresh matches.</span>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="shortlist-intro">Pick one creator to invite. Inviting sends a private offer and closes the rest of this shortlist.</p>
                    <div className="shortlist-grid">
                      {shortlist.candidates.map((cand) => {
                        const c = cand.creator || {};
                        const dismissed = cand.status === 'dismissed';
                        const invited = cand.status === 'invited';
                        return (
                          <div key={cand.creator_id} className={`shortlist-card ${dismissed ? 'is-dismissed' : ''} ${invited ? 'is-invited' : ''}`}>
                            <div className="shortlist-card-head">
                              {c.profile_photo ? (
                                <img src={shortlistMediaUrl(c.profile_photo)} alt="" className="shortlist-avatar" />
                              ) : (
                                <div className="shortlist-avatar shortlist-avatar-fallback">{(c.public_creator_id || 'C').slice(0, 1).toUpperCase()}</div>
                              )}
                              <div>
                                <div className="shortlist-name">{c.public_creator_id || 'Creator'}</div>
                                <div className="shortlist-cat">{c.primary_category || 'UGC Creator'}</div>
                              </div>
                              {invited && <span className="shortlist-badge">Invited</span>}
                            </div>
                            <div className="shortlist-meta">
                              {c.city_tier && <span>{c.city_tier}</span>}
                              {Array.isArray(c.languages) && c.languages.length > 0 && <span>{c.languages.slice(0, 3).join(', ')}</span>}
                              {typeof c.deliverables_completed === 'number' && <span>{c.deliverables_completed} deliverables</span>}
                              {c.content_style && <span>{c.content_style}</span>}
                            </div>
                            {cand.ops_note && <p className="shortlist-note">“{cand.ops_note}”</p>}
                            <div className="shortlist-card-actions">
                              <button
                                className="btn-action-small"
                                onClick={() => handleViewCreatorProfile(cand.creator_id)}
                                title="View profile"
                              >
                                <User size={16} /> Profile
                              </button>
                              <button
                                className="btn-select-small"
                                disabled={shortlistBusy || dismissed || campaign.match_status === 'fulfilled'}
                                onClick={() => { setInviteTarget(cand); setInviteMessage(''); setInviteBrief(''); }}
                              >
                                Invite
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      className="shortlist-request-new"
                      disabled={shortlistBusy}
                      onClick={handleRequestNewShortlist}
                    >
                      Not the right fit? Request a new shortlist
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Bids Section - Moved to main content area */}
            {isBusiness && campaign.bids && campaign.bids.length > 0 && (
            <div className="campaign-section">
              <div className="bids-divider"></div>
              <div className="bids-card">
                <div className="bids-header">
                  <h3>Bids Received ({campaign.bids.length})</h3>
                  <span className="bids-hint">Showing all bids • Scroll to view more</span>
                </div>
              <div className="bids-list-compact">
                {campaign.bids.map((bid, idx) => (
                  <div 
                    key={bid.id} 
                    className={`bid-row ${campaign.selected_creator === bid.creator_id ? 'selected' : ''}`}
                    data-testid={`bid-${idx}`}
                  >
                    <div className="bid-row-main">
                      <div className="bid-row-left">
                        <div className="bid-number">#{idx + 1}</div>
                        <div className="bid-info">
                          <div className="bid-creator-name">{bid.creator_nickname}</div>
                          <div className="bid-meta-inline">
                            <span className="bid-amount-inline">₹{bid.amount}</span>
                            <span className="bid-separator">•</span>
                            <span className="bid-delivery"><Calendar size={14} /> {bid.estimated_delivery_days} days</span>
                          </div>
                        </div>
                      </div>
                      <div className="bid-row-actions">
                        {campaign.selected_creator === bid.creator_id ? (
                          <span className="selected-badge-inline">✓ Selected</span>
                        ) : (
                          <>
                            <button
                              className="btn-action-small"
                              onClick={() => handleViewCreatorProfile(bid.creator_id)}
                              data-testid={`view-profile-${idx}`}
                              title="View Full Profile"
                            >
                              <User size={16} />
                            </button>
                            <button
                              className="btn-action-small btn-chat"
                              onClick={() => handleChat(bid.creator_id)}
                              data-testid={`chat-creator-${idx}`}
                              title="Chat with Creator"
                            >
                              <MessageSquare size={16} />
                            </button>
                            <button
                              className="btn-select-small"
                              onClick={() => handleSelectCreator(bid.creator_id)}
                              data-testid={`select-creator-${idx}`}
                            >
                              Select
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {bid.proposal && (
                      <div className="bid-row-proposal">
                        <span className="proposal-label">Proposal:</span> {bid.proposal}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </div>
            </div>
            )}

            {isBusiness && (!campaign.bids || campaign.bids.length === 0) && (
              <div className="campaign-section">
                <div className="no-bids">
                  <p>No bids received yet</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="campaign-sidebar">
          {/* Sidebar content - bids moved to main area */}
        </div>
      </div>

      {inviteTarget && (
        <div className="modal-overlay" onClick={() => !shortlistBusy && setInviteTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Invite Creator</h2>
              <button className="modal-close" onClick={() => setInviteTarget(null)}>×</button>
            </div>
            <div className="bid-form">
              <p style={{ marginTop: 0, color: '#555' }}>
                Send a private invitation to <strong>{inviteTarget.creator?.public_creator_id || 'this creator'}</strong> for
                <strong> {campaign.title}</strong>. The other shortlisted creators will be released.
              </p>
              <div className="form-group">
                <label htmlFor="inviteMessage">Message to creator (optional)</label>
                <textarea
                  id="inviteMessage"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Add a personal note about why they're a great fit…"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label htmlFor="inviteBrief">Describe the brief (optional)</label>
                <textarea
                  id="inviteBrief"
                  value={inviteBrief}
                  onChange={(e) => setInviteBrief(e.target.value)}
                  placeholder="Share the brief details for this creator — deliverables, key talking points, do's & don'ts…"
                  rows="4"
                  data-testid="invite-brief"
                />
                <small>Private to this creator. Shared with them when they accept the invitation.</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setInviteTarget(null)} disabled={shortlistBusy}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={handleInvite} disabled={shortlistBusy}>
                  {shortlistBusy ? 'Sending…' : 'Send Invitation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBidModal && (
        <div className="modal-overlay" onClick={() => setShowBidModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit Your Bid</h2>
              <button className="modal-close" onClick={() => setShowBidModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmitBid} className="bid-form">
              <div className="form-group">
                <label htmlFor="bidAmount">Bid Amount (₹)</label>
                <input
                  id="bidAmount"
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Enter your bid amount"
                  min={campaign.budget_min}
                  max={campaign.budget_max}
                  required
                  data-testid="bid-amount-input"
                />
                <small>{Number(campaign.budget_min) === Number(campaign.budget_max)
                  ? `Fixed budget: ₹${Number(campaign.budget_max).toLocaleString('en-IN')}`
                  : `Budget range: ₹${Number(campaign.budget_min).toLocaleString('en-IN')} - ₹${Number(campaign.budget_max).toLocaleString('en-IN')}`}</small>
              </div>
              <div className="form-group">
                <label htmlFor="deliveryDays">Estimated Delivery (days)</label>
                <input
                  id="deliveryDays"
                  type="number"
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(e.target.value)}
                  placeholder="How many days to complete?"
                  min="1"
                  required
                  data-testid="delivery-days-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="proposal">Your Proposal</label>
                <textarea
                  id="proposal"
                  value={proposal}
                  onChange={(e) => setProposal(e.target.value)}
                  placeholder="Describe your approach, experience, and why you're the right fit for this campaign..."
                  rows="6"
                  required
                  data-testid="proposal-textarea"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowBidModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" data-testid="submit-bid-modal-btn">
                  Submit Bid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreatorModal && (
        <div className="modal-overlay" onClick={() => setShowCreatorModal(false)}>
          <div className="modal-content creator-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Creator Profile</h2>
              <button className="modal-close" onClick={() => setShowCreatorModal(false)}>×</button>
            </div>
            {loadingCreator ? (
              <div className="loading-content">
                <p>Loading creator details...</p>
              </div>
            ) : creatorDetails && (
              <div className="creator-details">
                {/* Profile Header */}
                <div className="creator-header">
                  <div className="creator-info">
                    <h3>{creatorDetails.profile.nickname}</h3>
                    <p className="creator-bio">{creatorDetails.profile.bio}</p>
                    {creatorDetails.profile.tags && creatorDetails.profile.tags.length > 0 && (
                      <div className="creator-tags">
                        {creatorDetails.profile.tags.map((tag, idx) => (
                          <span key={idx} className="tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="creator-stats">
                    <div className="stat-item">
                      <span className="stat-label">Avg Rating</span>
                      <span className="stat-value">{creatorDetails.avgRating || 'N/A'} ⭐</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Total Reviews</span>
                      <span className="stat-value">{creatorDetails.reviews.length}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Completed Projects</span>
                      <span className="stat-value">{creatorDetails.pastCollaborations.length}</span>
                    </div>
                  </div>
                </div>

                {/* Intro Video */}
                {creatorDetails.profile.intro_video && (
                  <div className="section">
                    <h4>Intro Video</h4>
                    <video src={`${BACKEND_URL}${creatorDetails.profile.intro_video}`} controls className="intro-video" />
                  </div>
                )}

                {/* Portfolio */}
                {creatorDetails.profile.portfolio && creatorDetails.profile.portfolio.length > 0 && (
                  <div className="section">
                    <h4>Portfolio ({creatorDetails.profile.portfolio.length} items)</h4>
                    <div className="portfolio-grid-modal">
                      {creatorDetails.profile.portfolio.slice(0, 6).map((url, idx) => {
                        const isVideo = url.match(/\.(mp4|mov|webm|avi)$/i);
                        return (
                          <div key={idx} className="portfolio-item-modal">
                            {isVideo ? (
                              <video src={`${BACKEND_URL}${url}`} controls />
                            ) : (
                              <img src={`${BACKEND_URL}${url}`} alt={`Portfolio ${idx + 1}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Queued Orders */}
                {creatorDetails.queuedOrders.length > 0 && (
                  <div className="section">
                    <h4>Current Active Orders ({creatorDetails.queuedOrders.length})</h4>
                    <div className="orders-list">
                      {creatorDetails.queuedOrders.map((order, idx) => (
                        <div key={idx} className="order-item">
                          <span className="order-title">{order.title}</span>
                          <span className={`order-status status-${order.status}`}>{order.status.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Past Collaborations */}
                {creatorDetails.pastCollaborations.length > 0 && (
                  <div className="section">
                    <h4>Past Collaborations with You ({creatorDetails.pastCollaborations.length})</h4>
                    <div className="collaborations-list">
                      {creatorDetails.pastCollaborations.map((collab, idx) => (
                        <div key={idx} className="collaboration-item">
                          <span className="collab-title">{collab.title}</span>
                          <span className="collab-date">{new Date(collab.created_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviews */}
                {creatorDetails.reviews.length > 0 && (
                  <div className="section">
                    <h4>Reviews ({creatorDetails.reviews.length})</h4>
                    <div className="reviews-list-modal">
                      {creatorDetails.reviews.slice(0, 5).map((review, idx) => (
                        <div key={idx} className="review-item-modal">
                          <div className="review-header-modal">
                            <div className="stars-modal">
                              {[...Array(5)].map((_, i) => (
                                <span key={i}>{i < review.rating ? '⭐' : '☆'}</span>
                              ))}
                            </div>
                            <span className="review-date-modal">{new Date(review.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="review-text-modal">{review.review}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Links */}
                {creatorDetails.profile.social_links && (
                  <div className="section">
                    <h4>Social Media</h4>
                    <div className="social-links">
                      {creatorDetails.profile.social_links.instagram && (
                        <a href={creatorDetails.profile.social_links.instagram} target="_blank" rel="noopener noreferrer" className="social-link">
                          Instagram
                        </a>
                      )}
                      {creatorDetails.profile.social_links.youtube && (
                        <a href={creatorDetails.profile.social_links.youtube} target="_blank" rel="noopener noreferrer" className="social-link">
                          YouTube
                        </a>
                      )}
                      {creatorDetails.profile.social_links.tiktok && (
                        <a href={creatorDetails.profile.social_links.tiktok} target="_blank" rel="noopener noreferrer" className="social-link">
                          TikTok
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Rate Card */}
                {creatorDetails.profile.rate_card && (
                  <div className="section">
                    <h4>Rate Card</h4>
                    <div className="rate-card">
                      {creatorDetails.profile.rate_card.video_30s && (
                        <div className="rate-item">
                          <span>30s Video:</span>
                          <span>₹{creatorDetails.profile.rate_card.video_30s}</span>
                        </div>
                      )}
                      {creatorDetails.profile.rate_card.video_60s && (
                        <div className="rate-item">
                          <span>60s Video:</span>
                          <span>₹{creatorDetails.profile.rate_card.video_60s}</span>
                        </div>
                      )}
                      {creatorDetails.profile.rate_card.photo_post && (
                        <div className="rate-item">
                          <span>Photo Post:</span>
                          <span>₹{creatorDetails.profile.rate_card.photo_post}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .campaign-details-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
          padding: 40px 5%;
          display: flex;
          flex-direction: column;
        }

        .loading-page,
        .error-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          color: #718096;
        }

        .page-header {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto 24px;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          color: #4a5568;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .back-btn:hover {
          border-color: #667eea;
          color: #667eea;
          transform: translateX(-4px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }

        .campaign-container {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 32px;
        }

        .campaign-main {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .campaign-info-card {
          background: white;
          padding: 32px;
          border-radius: 24px;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.12);
          border: 1px solid rgba(102, 126, 234, 0.1);
        }

        .bids-divider {
          height: 2px;
          background: linear-gradient(to right, #e2e8f0, #cbd5e0, #e2e8f0);
          margin: 32px 0;
        }

        .bids-card {
          background: white;
          padding: 32px;
          border-radius: 24px;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.12);
          border: 1px solid rgba(102, 126, 234, 0.1);
        }

        .campaign-title-section {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 24px;
          gap: 16px;
        }

        .campaign-title-section h1 {
          font-size: 2rem;
          font-weight: 700;
          color: #1a202c;
          flex: 1;
        }

        .campaign-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 2px solid #e2e8f0;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #4a5568;
          font-weight: 500;
        }

        .campaign-section {
          margin-bottom: 32px;
        }

        .campaign-section:last-child {
          margin-bottom: 0;
        }

        .campaign-section h3 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 16px;
        }

        .brief-text {
          color: #4a5568;
          line-height: 1.8;
          white-space: pre-wrap;
          font-size: 1rem !important;
          font-weight: 600 !important;
        }

        .objectives-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }

        .objective-item {
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.05) 100%);
          border-radius: 12px;
          border: 2px solid rgba(102, 126, 234, 0.15);
          color: #4a5568;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .objective-item:hover {
          border-color: #667eea;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.08) 100%);
        }

        .shipment-notice {
          padding: 20px;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.06) 100%);
          border-radius: 12px;
          border: 2px solid rgba(102, 126, 234, 0.25);
        }

        .shipment-notice strong {
          display: block;
          margin-bottom: 8px;
          color: #5568d3;
          font-size: 1.05rem;
        }

        .shipment-notice p {
          color: #4a5568;
          margin: 0;
        }

        .bids-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 2px solid #e2e8f0;
        }

        .bids-header h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a202c;
          margin: 0;
        }

        .bids-hint {
          font-size: 0.875rem;
          color: #718096;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #f8f9ff;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .bids-hint::before {
          content: '↕';
          font-size: 1.1rem;
          color: #667eea;
          font-weight: 700;
        }

        .bids-list-compact {
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-height: 500px;
          overflow-y: auto;
          border-radius: 12px;
          background: #e2e8f0;
          border: 2px solid #e2e8f0;
          position: relative;
          scroll-behavior: smooth;
        }

        /* Scroll shadow indicators */
        .bids-list-compact::before,
        .bids-list-compact::after {
          content: '';
          position: sticky;
          display: block;
          height: 20px;
          margin: 0 -2px;
          pointer-events: none;
          z-index: 1;
        }

        .bids-list-compact::before {
          top: 0;
          background: linear-gradient(to bottom, 
            rgba(255,255,255,0.9) 0%, 
            rgba(255,255,255,0) 100%);
        }

        .bids-list-compact::after {
          bottom: 0;
          background: linear-gradient(to top, 
            rgba(255,255,255,0.9) 0%, 
            rgba(255,255,255,0) 100%);
        }

        .bids-list-compact::-webkit-scrollbar {
          width: 10px;
        }

        .bids-list-compact::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 5px;
          border: 1px solid #e2e8f0;
        }

        .bids-list-compact::-webkit-scrollbar-thumb {
          background: #7387FF;
          border-radius: 5px;
          border: 2px solid #f1f5f9;
        }

        .bids-list-compact::-webkit-scrollbar-thumb:hover {
          background: #7387FF;
        }

        /* Firefox scrollbar */
        .bids-list-compact {
          scrollbar-width: thin;
          scrollbar-color: #667eea #f1f5f9;
        }

        .bid-row {
          background: white;
          padding: 16px 20px;
          transition: all 0.2s ease;
        }

        .bid-row:hover {
          background: #f8f9ff;
        }

        .bid-row.selected {
          background: #e6f2ff;
          border-left: 4px solid #667eea;
        }

        .bid-row-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .bid-row-left {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 0;
        }

        .bid-number {
          width: 32px;
          height: 32px;
          background: #f8f9ff;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #667eea;
          font-size: 0.875rem;
          flex-shrink: 0;
        }

        .bid-info {
          flex: 1;
          min-width: 0;
        }

        .bid-creator-name {
          font-weight: 600;
          color: #1a202c;
          font-size: 1rem;
          margin-bottom: 4px;
        }

        .bid-meta-inline {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.875rem;
          color: #718096;
        }

        .bid-amount-inline {
          font-weight: 700;
          color: #667eea;
          font-size: 1rem;
        }

        .bid-separator {
          color: #cbd5e0;
        }

        .bid-delivery {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .bid-row-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .btn-action-small {
          width: 36px;
          height: 36px;
          border: 2px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #4a5568;
        }

        .btn-action-small:hover {
          border-color: #667eea;
          background: #f8f9ff;
          color: #667eea;
        }

        .btn-action-small.btn-chat:hover {
          border-color: #48bb78;
          color: #48bb78;
        }

        .btn-select-small {
          padding: 8px 16px;
          background: #7387FF;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.875rem;
        }

        .btn-select-small:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .selected-badge-inline {
          padding: 6px 16px;
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .bid-row-proposal {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          color: #4a5568;
          line-height: 1.6;
          font-size: 0.9rem;
        }

        .proposal-label {
          font-weight: 600;
          color: #2d3748;
        }

        .no-bids {
          background: #f8f9ff;
          padding: 48px 32px;
          border-radius: 16px;
          text-align: center;
          color: #718096;
          border: 2px dashed #cbd5e0;
        }

        .creator-bid-banner {
          background: #7387FF;
          color: white;
          padding: 24px;
          border-radius: 16px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .banner-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .banner-content p {
          opacity: 0.9;
          margin: 0;
        }

        .btn-bid-now {
          background: white;
          color: #667eea;
          padding: 12px 24px;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
        }

        .btn-bid-now:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .bid-submitted-banner {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.12) 100%);
          border: 2px solid rgba(102, 126, 234, 0.3);
          color: #2d3748;
          padding: 24px;
          border-radius: 16px;
          margin-bottom: 24px;
        }

        .bid-submitted-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .bid-submitted-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .bid-submitted-header h3 {
          font-size: 1.25rem;
          font-weight: 700;
          background: #7387FF;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }

        .bid-submitted-header svg {
          color: #667eea;
        }

        .bid-submitted-details {
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: white;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .detail-label {
          font-weight: 600;
          color: #4a5568;
          font-size: 0.95rem;
        }

        .detail-value {
          font-weight: 700;
          background: #7387FF;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-size: 1rem;
        }

        .status-badge {
          background: #7387FF !important;
          color: white !important;
          padding: 8px 16px !important;
          border-radius: 8px !important;
          font-weight: 600 !important;
          font-size: 0.875rem !important;
          display: inline-block !important;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }

        .bid-submitted-proposal {
          background: white;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .bid-submitted-proposal .detail-label {
          display: block;
          margin-bottom: 8px;
          color: #4a5568;
        }

        .proposal-text {
          color: #2d3748;
          line-height: 1.6;
          margin: 0;
          font-size: 0.95rem;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          overflow-y: auto;
        }

        .modal-content {
          background: white;
          border-radius: 20px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 40px rgba(102, 126, 234, 0.2);
          border: 1px solid rgba(102, 126, 234, 0.1);
          margin: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 32px;
          border-bottom: 2px solid #e2e8f0;
        }

        .modal-header h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a202c;
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 2rem;
          color: #718096;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .modal-close:hover {
          background: #f7fafc;
          color: #2d3748;
        }

        .creator-modal {
          max-width: 800px;
          max-height: 90vh;
          margin: auto;
        }

        .creator-details {
          padding: 24px 32px;
        }

        .creator-header {
          display: flex;
          justify-content: space-between;
          gap: 32px;
          padding-bottom: 24px;
          border-bottom: 2px solid #e2e8f0;
          margin-bottom: 24px;
        }

        .creator-info {
          flex: 1;
        }

        .creator-info h3 {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1a202c;
          margin: 0 0 12px 0;
        }

        .creator-bio {
          color: #4a5568;
          line-height: 1.6;
          margin-bottom: 12px;
        }

        .creator-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tag {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.06) 100%);
          color: #5568d3;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 500;
          border: 1px solid rgba(102, 126, 234, 0.2);
        }

        .creator-stats {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 20px;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.05) 100%);
          border-radius: 12px;
          min-width: 150px;
          border: 1px solid rgba(102, 126, 234, 0.15);
        }

        .stat-label {
          font-size: 0.875rem;
          color: #718096;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          background: #7387FF;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .section {
          margin-bottom: 32px;
        }

        .section h4 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 16px;
        }

        .intro-video {
          width: 100%;
          max-height: 400px;
          border-radius: 12px;
        }

        .portfolio-grid-modal {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .portfolio-item-modal {
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          background: #f8f9ff;
          border: 2px solid rgba(102, 126, 234, 0.1);
          transition: all 0.3s ease;
        }

        .portfolio-item-modal:hover {
          border-color: rgba(102, 126, 234, 0.3);
          transform: translateY(-4px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
        }

        .portfolio-item-modal img,
        .portfolio-item-modal video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .orders-list,
        .collaborations-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .order-item,
        .collaboration-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.04) 100%);
          border-radius: 8px;
          border: 1px solid rgba(102, 126, 234, 0.1);
        }

        .order-title,
        .collab-title {
          font-weight: 600;
          color: #1a202c;
        }

        .order-status {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .status-active {
          background: #d4edda;
          color: #155724;
        }

        .status-in_progress {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.15) 100%);
          color: #5568d3;
          font-weight: 600;
          border: 1px solid rgba(102, 126, 234, 0.3);
        }

        .collab-date {
          color: #718096;
          font-size: 0.875rem;
        }

        .reviews-list-modal {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .review-item-modal {
          padding: 16px;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.04) 100%);
          border-radius: 12px;
          border: 1px solid rgba(102, 126, 234, 0.1);
        }

        .review-header-modal {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .stars-modal {
          font-size: 1.25rem;
        }

        .review-date-modal {
          color: #718096;
          font-size: 0.875rem;
        }

        .review-text-modal {
          color: #4a5568;
          line-height: 1.6;
          margin: 0;
        }

        .social-links {
          display: flex;
          gap: 12px;
        }

        .social-link {
          padding: 8px 16px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .social-link:hover {
          background: #5568d3;
          transform: translateY(-2px);
        }

        .rate-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rate-item {
          display: flex;
          justify-content: space-between;
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.04) 100%);
          border-radius: 8px;
          font-weight: 600;
          border: 1px solid rgba(102, 126, 234, 0.1);
        }

        .loading-content {
          padding: 48px 32px;
          text-align: center;
          color: #718096;
        }

        .btn-view-profile {
          padding: 10px 20px;
          background: #f8f9ff;
          color: #667eea;
          border: 2px solid #667eea;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
        }

        .btn-view-profile:hover {
          background: #667eea;
          color: white;
          transform: translateY(-2px);
        }

        .bid-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .bid-form {
          padding: 32px;
        }

        .form-group {
          margin-bottom: 24px;
        }

        .form-group label {
          display: block;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 8px;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 1rem;
          transition: border-color 0.3s ease;
          box-sizing: border-box;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group small {
          display: block;
          color: #718096;
          font-size: 0.875rem;
          margin-top: 4px;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 120px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 32px;
        }

        .btn-primary,
        .btn-secondary {
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          border: 2px solid transparent;
        }

        .btn-primary {
          background: #7387FF;
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: white;
          color: #4a5568;
          border-color: #e2e8f0;
        }

        .btn-secondary:hover {
          border-color: #cbd5e0;
          background: #f7fafc;
        }

        @media (max-width: 1024px) {
          .campaign-container {
            grid-template-columns: 1fr;
            max-width: 100%;
          }

          .campaign-sidebar {
            order: 2;
          }
        }

        @media (max-width: 640px) {
          .campaign-details-page {
            padding: 20px 4%;
          }

          .campaign-container {
            max-width: 100%;
          }

          .campaign-info-card,
          .bids-card {
            padding: 24px 20px;
          }

          .campaign-title-section h1 {
            font-size: 1.5rem;
          }

          .objectives-grid {
            grid-template-columns: 1fr;
          }

          .creator-bid-banner {
            flex-direction: column;
            text-align: center;
            gap: 16px;
          }

          .modal-content {
            margin: 10px;
            max-width: none;
          }

          .modal-header,
          .bid-form {
            padding: 20px;
          }

          .modal-actions {
            flex-direction: column;
          }

          .btn-primary,
          .btn-secondary {
            width: 100%;
          }
        }
      `}</style>
    </div>
    </Wrap>
  );
}