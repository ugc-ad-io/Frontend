import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { ownsCampaign } from '../utils/brandWorkspace';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { firstName, displayName } from '../utils/displayName';
import { hireUnfunded, showUnfundedHire, escrowHeldText } from '../utils/hireFunding';
import { ArrowLeft, User, IndianRupee, Calendar, MessageSquare, Package, CheckCircle, Star } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import '../styles/creator-marketplace.css';
import '../styles/web1-campaign.css';
import { maxCampaignBid, bidOverBudgetMessage } from '../utils/bidBudget';
import { selectedCreators, isSelectedCreator, creatorsWanted, slotsLeft, needsEditSplit, bidSplitLabel } from '../utils/campaignCreators';
import SplitBidFields, { EMPTY_SPLIT, splitPayload } from '../components/SplitBidFields';
import { useBidGate, BidFeeNotice } from '../components/BidGate';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Each role gets its own top-nav shell; admins (and a logged-out edge case) keep the bare page.
function RoleShell({ role, children }) {
  if (role === 'creator') return <CreatorTopNavLayout>{children}</CreatorTopNavLayout>;
  if (role === 'business') return <BrandTopNavLayout>{children}</BrandTopNavLayout>;
  return <>{children}</>;
}

// The brief is stored as plain text ("Label: value" per line). Render it so the
// label reads as a dark sub-heading and the value as muted body text.
function renderBrief(text) {
  if (!text) return <p className="brief-line">No brief details provided.</p>;
  return String(text).split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="brief-gap" />;
    const idx = line.indexOf(':');
    if (idx > 0 && idx <= 28) {
      const label = line.slice(0, idx).trim();
      // Budget visibility is a brand-only setting — never surface it to creators.
      if (/^budget visibility$/i.test(label)) return null;
      return (
        <p key={i} className="brief-line">
          <strong>{label}:</strong> {line.slice(idx + 1).trim()}
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
  const bidGate = useBidGate(user);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [split, setSplit] = useState(EMPTY_SPLIT);
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

  useLiveEffect(() => {
    fetchCampaign();
  }, [id]);

  // Brands on the "Request Matches" path get an ops-curated shortlist (PRD 5.4).
  useLiveEffect(() => {
    if (!campaign || !user) return;
    const owner = user.role === 'business' && ownsCampaign(user, campaign);
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
      toast.success('Invitation sent - opening chat with the creator…');
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
      toast.success('New shortlist requested - our team will curate fresh matches');
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

  const handleFinishHiring = async () => {
    const hired = selectedCreators(campaign).length;
    if (!window.confirm(`Stop hiring with ${hired} creator(s)? The budget for the ${slotsLeft(campaign)} unfilled slot(s) is refunded to your wallet.`)) return;
    try {
      await axios.post(`${API}/campaigns/${id}/finish-hiring`);
      toast.success('Hiring closed. Unused budget refunded to your wallet.');
      await fetchCampaign();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to finish hiring'));
    }
  };

  // Selecting a creator SPENDS the brand's credits — the bid amount plus the
  // platform fee is debited and held in escrow until the content is approved.
  const handleSelectCreator = async (creatorId) => {
    try {
      const response = await axios.post(`${API}/campaigns/${id}/select-creator?creator_id=${creatorId}`);
      const who = firstName({ nickname: response.data.creator_nickname }, 'Creator');
      const heldText = escrowHeldText(response.data);
      const unfunded = hireUnfunded(response.data);
      // A multi-creator brief with slots still open: stay so the brand can keep hiring.
      if (slotsLeft(campaign) > 1) {
        if (unfunded) showUnfundedHire(toast, response.data, who, navigate);
        else toast.success(`${who} hired - ${heldText} You can hire ${slotsLeft(campaign) - 1} more.`);
        await fetchCampaign();
        return;
      }
      // A short wallet still hires; prompt to fund and stay here instead of opening chat.
      if (unfunded) {
        showUnfundedHire(toast, response.data, who, navigate);
        await fetchCampaign();
        return;
      }
      toast.success(`${who} selected! ${heldText} Opening chat...`);

      // Wait a moment for the toast to be visible
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Redirect to chat with the creator
      navigate(`/chat/${creatorId}`);
    } catch (error) {
      // Short balance is a fixable problem, not a generic failure — say by how much.
      if (error?.response?.status === 402) {
        toast.error(error.response.data?.detail || 'Not enough credits to select this creator.');
        return;
      }
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
        c => ownsCampaign(user, c) && 
        isSelectedCreator(c, creatorId) && 
        c.status === 'completed'
      );
      
      // Fetch queued orders with this creator
      const queuedOrders = campaignsRes.data.filter(
        c => ownsCampaign(user, c) && 
        isSelectedCreator(c, creatorId) && 
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
    const maximum = maxCampaignBid(campaign);
    if (maximum && Number(bidAmount) > maximum) {
      toast.error(bidOverBudgetMessage(maximum));
      return;
    }
    try {
      await axios.post(`${API}/campaigns/${id}/bid`, {
        campaign_id: id,
        amount: parseFloat(bidAmount),
        ...(needsEditSplit(campaign) ? splitPayload(split) : {}),
        proposal,
        estimated_delivery_days: parseInt(deliveryDays)
      });
      toast.success('Bid submitted successfully!');
      setShowBidModal(false);
      setBidAmount('');
      setSplit(EMPTY_SPLIT);
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
  // Reflect the real bid outcome instead of always saying "Pending Review".
  const bidSelected = userBid?.status === 'selected'
    || String(campaign?.selected_creator) === String(user?.id)
    || (Array.isArray(campaign?.selected_creators) && campaign.selected_creators.map(String).includes(String(user?.id)));
  const bidStatus = userBid?.status === 'declined'
    ? { label: 'Not Selected', cls: 'declined' }
    : bidSelected
      ? { label: 'Accepted', cls: 'accepted' }
      : { label: 'Pending Review', cls: 'pending' };

  // When embedded in a drawer / modal the host page already provides the nav; otherwise each role gets its own shell.
  const shellRole = embedId ? null : user?.role;
  const Wrap = shellRole === 'creator' || shellRole === 'business' ? RoleShell : Fragment;
  const wrapProps = Wrap === RoleShell ? { role: shellRole } : {};
  const pageCls = `campaign-details-page wcd${embedId ? ' wcd--embed' : shellRole === 'business' ? ' bui-main bui-main--detail' : shellRole === 'creator' ? '' : ' wcd--bare'}`;

  if (loading || !campaign) {
    return (
      <Wrap {...wrapProps}>
        <div className={pageCls}>
          <div className="campaign-container">
            <div className={`wcd-state ${loading ? 'loading-page' : 'error-page'}`}>{loading ? 'Loading campaign...' : 'Campaign not found'}</div>
          </div>
        </div>
      </Wrap>
    );
  }

  const isBusiness = user?.role === 'business' && ownsCampaign(user, campaign);

  return (
    <Wrap {...wrapProps}>
    <div className={pageCls}>
      {!embedId && (
        <div className="page-header">
          <button className="back-btn" onClick={goBack} data-testid="back-btn">
            <ArrowLeft size={18} /> Back
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
                <button className="btn-bid-now" onClick={async () => {
                  // Incomplete profile → pop-up listing what's missing; else the fee pop-up, then the form.
                  if (!(await bidGate.ensureProfile())) return;
                  bidGate.showFee(() => setShowBidModal(true));
                }} data-testid="submit-bid-btn">
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
                    <span className={`badge bid-mobile-campaign-status badge-${campaign.status}`}>{campaign.status.replace('_', ' ')}</span>
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
                      <span className={`status-badge status-${bidStatus.cls}`}>{bidStatus.label}</span>
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
                <span>Posted by {String(campaign.brand_name || campaign.business_name || campaign.company_name || campaign.business_nickname || campaign.brand_handle || 'Brand').replace(/^@+/, '').trim() || 'Brand'}</span>
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

            {(campaign.script_text || campaign.script_provider === 'ugc') && (
              <div className="campaign-section">
                <h3>Script</h3>
                <div className="brief-text">
                  {campaign.script_text
                    ? <p className="brief-line">{campaign.script_text}</p>
                    : <p className="brief-line">UGC.ad is preparing the script - check back before you start.</p>}
                </div>
              </div>
            )}

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
                      <span className="shortlist-hint">New shortlist requested - sit tight while we find fresh matches.</span>
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
                  <span className="bids-hint">
                    Hired {selectedCreators(campaign).length} of {creatorsWanted(campaign)} creator{creatorsWanted(campaign) === 1 ? '' : 's'}
                    {selectedCreators(campaign).length > 0 && slotsLeft(campaign) > 0 && campaign.status === 'active' && (
                      <> • <button type="button" className="btn-action-small" onClick={handleFinishHiring}>Finish hiring with {selectedCreators(campaign).length}</button></>
                    )}
                  </span>
                </div>
              <div className="bids-list-compact">
                {campaign.bids.map((bid, idx) => (
                  <div 
                    key={bid.id} 
                    className={`bid-row ${isSelectedCreator(campaign, bid.creator_id) ? 'selected' : ''}`}
                    data-testid={`bid-${idx}`}
                  >
                    <div className="bid-row-main">
                      <div className="bid-row-left">
                        <div className="bid-number">#{idx + 1}</div>
                        <div className="bid-info">
                          <div className="bid-creator-name">{String(bid.creator_name || bid.creator_nickname || 'Creator').replace(/^@+/, '').trim().split(/\s+/)[0]}</div>
                          <div className="bid-meta-inline">
                            <span className="bid-amount-inline">₹{bid.amount}</span>
                            {bidSplitLabel(bid) && <small> ({bidSplitLabel(bid)})</small>}
                            <span className="bid-separator">•</span>
                            <span className="bid-delivery"><Calendar size={14} /> {bid.estimated_delivery_days} days</span>
                          </div>
                        </div>
                      </div>
                      <div className="bid-row-actions">
                        {isSelectedCreator(campaign, bid.creator_id) ? (
                          <span className="selected-badge-inline">Selected</span>
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
                            {slotsLeft(campaign) > 0 && campaign.status === 'active' && (
                              <button
                                className="btn-select-small"
                                onClick={() => handleSelectCreator(bid.creator_id)}
                                data-testid={`select-creator-${idx}`}
                              >
                                Select
                              </button>
                            )}
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
              <p>
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
                  placeholder="Share the brief details for this creator - deliverables, key talking points, do's & don'ts…"
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
                {needsEditSplit(campaign) ? (
                  <SplitBidFields value={split} max={maxCampaignBid(campaign)} onChange={(v, total) => { setSplit(v); setBidAmount(String(total)); }} />
                ) : (
                <>
                <label htmlFor="bidAmount">Bid Amount (₹)</label>
                <input
                  id="bidAmount"
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Enter your bid amount"
                  min="1"
                  max={maxCampaignBid(campaign) || undefined}
                  required
                  data-testid="bid-amount-input"
                />
                </>
                )}
                <small>{Number(campaign.budget_min) === Number(campaign.budget_max)
                  ? `Fixed budget: ₹${Number(campaign.budget_max).toLocaleString('en-IN')}`
                  : `Budget range: ₹${Number(campaign.budget_min).toLocaleString('en-IN')} - ₹${Number(campaign.budget_max).toLocaleString('en-IN')}`}</small>
                <BidFeeNotice amount={bidAmount} percent={bidGate.percent} />
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
                  rows="4"
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
                    <h3>{displayName(creatorDetails.profile, 'Creator')}</h3>
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
                      <span className="stat-value">{creatorDetails.avgRating || 'N/A'}{creatorDetails.avgRating ? <Star size={14} aria-hidden="true" /> : null}</span>
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
                                <Star key={i} size={14} className={i < review.rating ? '' : 'is-off'} aria-hidden="true" />
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

      {bidGate.ui}
    </div>
    </Wrap>
  );
}
