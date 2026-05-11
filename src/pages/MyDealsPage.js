import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Archive,
  Bell,
  Bookmark,
  Briefcase,
  CheckCheck,
  ChevronDown,
  Clock,
  FileCheck,
  FileText,
  Flag,
  Headphones,
  Image,
  IndianRupee,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Package,
  Paperclip,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  Smile,
  Upload,
  User,
  Zap
} from 'lucide-react';
import { EmptyPanel, formatMoney, getInitial } from '../components/CreatorComponents';
import DashboardLayout from '../components/DashboardLayout';
import './CreatorDashboard.css';
import './MyDealsPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DEAL_STATES = [
  'Accepted - Awaiting Shipment',
  'Shipped - In Transit',
  'Delivered - Awaiting Receipt Confirmation',
  'Received - Content in Progress',
  'Content Submitted - Awaiting Review',
  'Revision Requested',
  'Approved - Payment Processing',
  'Paid - Complete'
];

const EXCEPTION_STATES = ['Disputed', 'Damaged/Wrong Product Reported'];

const ACTION_CARD_TYPES = {
  'Milestone Update': 'milestone_update',
  'Damage Report': 'damage_report',
  'Escalate to Admin': 'escalate_to_admin',
  'Raise Dispute': 'raise_dispute'
};

function DealCard({ children, className = '' }) {
  return <section className={`deal-card ${className}`}>{children}</section>;
}

function UploadZone({ icon: Icon, label, accept, uploaded, onClick, disabled }) {
  return (
    <button type="button" className={`deal-upload ${uploaded ? 'is-uploaded' : ''}`} onClick={onClick} disabled={disabled}>
      <span><Icon size={22} strokeWidth={1.6} /></span>
      <strong>{uploaded ? 'File uploaded successfully' : label}</strong>
      <small>{uploaded ? 'Ready for submission' : accept}</small>
    </button>
  );
}

function normalizeDash(value) {
  return String(value || '').replace(/\s*(?:\u2014|\u2013|-)\s*/g, ' - ');
}

function stateKey(value) {
  return normalizeDash(value).toLowerCase();
}

function getState(deal) {
  return normalizeDash(deal?.current_state || deal?.campaign_status || deal?.campaign?.status || 'Status unavailable');
}

function getBrandHandle(deal) {
  return deal?.brand?.handle || deal?.campaign?.brand_handle || deal?.campaign?.business_nickname || 'Brand';
}

function getDealTitle(deal) {
  return deal?.campaign?.title || 'Untitled campaign';
}

function getDealDeadline(deal) {
  return deal?.deadline || deal?.next_deadline_at || deal?.state_started_at || null;
}

function getCountdownLabel(deal) {
  const hours = deal?.deadline_countdown_hours;
  if (typeof hours === 'number') return `${Math.max(0, Math.round(hours))} hrs left`;
  return 'Deadline pending';
}

function formatDateTime(dateValue) {
  if (!dateValue) return 'Not scheduled';
  return new Date(dateValue).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatDate(dateValue) {
  if (!dateValue) return 'Not available';
  return new Date(dateValue).toLocaleDateString('en-IN');
}

function getEscrowAmount(deal) {
  return Number(deal?.escrow?.held_amount ?? deal?.escrow?.amount ?? deal?.my_bid?.amount ?? 0);
}

function getDealId(deal) {
  return deal?.deal_id || deal?.campaign?.deal_id || deal?.campaign?.id || 'Deal ID unavailable';
}

function getRequiredAssets(deal) {
  return deal?.content_submission?.required_assets || {};
}

export default function MyDealsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deals, setDeals] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [briefOpen, setBriefOpen] = useState(false);
  const [rightTab, setRightTab] = useState('chat');
  const [message, setMessage] = useState('');
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);
  const [captionUrl, setCaptionUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [rawFootageUrl, setRawFootageUrl] = useState(null);
  const [unboxingVideoUrl, setUnboxingVideoUrl] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/creator') },
    { name: 'My Active Work', icon: Zap, action: () => navigate('/my-active-work') },
    { name: 'My Bids', icon: Bookmark, action: () => navigate('/my-bids') },
    { name: 'Reviews', icon: Bell, action: () => navigate('/reviews') },
    { name: 'Portfolio', icon: User, action: () => navigate('/portfolio') },
    { name: 'Brief Inbox', icon: Briefcase, action: () => navigate('/browse-briefs') },
    { name: 'My Deals', icon: FileCheck, action: () => navigate('/my-deals'), active: true },
    { name: 'Messages', icon: MessageSquare, action: () => navigate('/messages') },
    { name: 'Payout', icon: IndianRupee, action: () => navigate('/withdrawal') },
    { name: 'Settings', icon: ShieldAlert, action: () => navigate('/settings') }
  ];

  useEffect(() => {
    if (user?.id) fetchDeals();
  }, [user?.id]);

  const fetchDeals = async () => {
    try {
      const res = await axios.get(`${API}/deals/my`);
      const list = res.data || [];
      setDeals(list);
      setSelectedDeal((current) => {
        if (!list.length) return null;
        return list.find((item) => getDealId(item) === getDealId(current)) || list[0];
      });
    } catch (error) {
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file, setUrlFn, fileType) => {
    if (!file) return;
    setUploadingFile(fileType);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/upload/file`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUrlFn(res.data.file_url);
      toast.success('File uploaded');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploadingFile(null);
    }
  };

  const handleSubmitReceipt = async () => {
    if (!selectedDeal?.deal_id) return;
    try {
      await axios.post(`${API}/deals/${selectedDeal.deal_id}/receipt`, {
        received_at: new Date().toISOString(),
        unboxing_video_url: unboxingVideoUrl,
        items_damaged: false,
        damage_report: null
      });
      toast.success('Receipt submitted');
      fetchDeals();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Receipt submission failed');
    }
  };

  const handleSubmitContent = async () => {
    if (!selectedDeal?.deal_id) return;
    if (!finalVideoUrl) {
      toast.error('Final video is required');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/deals/${selectedDeal.deal_id}/content`, {
        video_url: finalVideoUrl,
        caption_url: captionUrl,
        thumbnail_url: thumbnailUrl,
        raw_footage_url: rawFootageUrl,
        creator_note: 'Submitted from creator deal room'
      });
      toast.success('Content submitted for brand review');
      setFinalVideoUrl(null);
      setCaptionUrl(null);
      setThumbnailUrl(null);
      setRawFootageUrl(null);
      fetchDeals();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedDeal?.deal_id || !message.trim()) return;
    try {
      await axios.post(`${API}/deals/${selectedDeal.deal_id}/chat`, {
        message: message.trim(),
        attachment_urls: []
      });
      setMessage('');
      fetchDeals();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Message failed');
    }
  };

  const handleCreateActionCard = async (label) => {
    if (!selectedDeal?.deal_id) return;
    try {
      await axios.post(`${API}/deals/${selectedDeal.deal_id}/action-card`, {
        type: ACTION_CARD_TYPES[label],
        message: label,
        attachment_urls: []
      });
      toast.success(`${label} created`);
      fetchDeals();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    }
  };

  const selectedState = getState(selectedDeal);
  const activeDeals = deals.filter((item) => !['paid - complete', 'disputed'].includes(stateKey(item.current_state)));
  const awaitingAction = deals.filter((item) => item.active_party === 'creator');
  const pastDeals = deals.filter((item) => stateKey(item.current_state) === 'paid - complete');
  const disputedDeals = deals.filter((item) => EXCEPTION_STATES.some((state) => stateKey(state) === stateKey(item.current_state)));
  const escrowAmount = getEscrowAmount(selectedDeal);
  const activity = useMemo(() => selectedDeal?.activity_feed || [], [selectedDeal]);

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} title="Deal Room" description="Creator-side delivery workspace" topbarExtra={null} sidebarExtra={null}>
        <div className="deal-page"><EmptyPanel text="Loading..." /></div>
      </DashboardLayout>
    );
  }

  if (!deals.length) {
    return (
      <DashboardLayout navItems={navItems} title="Deal Room" description="Creator-side delivery workspace" topbarExtra={null} sidebarExtra={null}>
        <div className="deal-page"><EmptyPanel text="No active deals yet. Browse briefs and submit bids to get started." /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={navItems} title="Deal Room" description="Creator-side delivery workspace" topbarExtra={null} sidebarExtra={null}>
      <div className="deal-page">
        <StatusHeader
          deal={selectedDeal}
          currentState={selectedState}
          escrowAmount={escrowAmount}
          onSubmit={handleSubmitContent}
          canSubmit={Boolean(finalVideoUrl) && Boolean(selectedDeal?.can_submit_content) && !submitting}
          submitting={submitting}
        />

        <div className="deal-room-grid">
          <DealNavigation
            groups={[
              ['Active Deals', activeDeals],
              ['Awaiting My Action', awaitingAction],
              ['Past Deals', pastDeals],
              ['Disputed Deals', disputedDeals]
            ]}
            selectedDeal={selectedDeal}
            onSelect={setSelectedDeal}
          />

          <main className="deal-workspace">
            <DealCard className="deal-brief-card">
              <button type="button" className="deal-brief-toggle" onClick={() => setBriefOpen((value) => !value)}>
                <span><FileText size={18} /></span>
                <strong>Full Campaign Brief</strong>
                <em>Usage rights highlighted</em>
                <ChevronDown size={18} className={briefOpen ? 'is-open' : ''} />
              </button>
              {briefOpen && (
                <div className="deal-brief-body">
                  {(selectedDeal?.brief_sections || []).map((section) => (
                    <article key={section.title} className={section.title === 'Usage Rights' ? 'is-rights' : ''}>
                      <h3>{section.title}</h3>
                      <p>{section.content || 'Not specified'}</p>
                    </article>
                  ))}
                  <button type="button" className="deal-link-btn" onClick={() => navigate(`/campaign/${selectedDeal?.campaign?.id}`)}>View full brief in new tab</button>
                </div>
              )}
            </DealCard>

            <ShippingBlock
              deal={selectedDeal}
              unboxingVideoUrl={unboxingVideoUrl}
              onUpload={(file) => handleFileUpload(file, setUnboxingVideoUrl, 'unboxing')}
              onSubmitReceipt={handleSubmitReceipt}
              uploading={uploadingFile === 'unboxing'}
            />

            <ContentSubmission
              deal={selectedDeal}
              finalVideoUrl={finalVideoUrl}
              captionUrl={captionUrl}
              thumbnailUrl={thumbnailUrl}
              rawFootageUrl={rawFootageUrl}
              onUpload={handleFileUpload}
              setFinalVideoUrl={setFinalVideoUrl}
              setCaptionUrl={setCaptionUrl}
              setThumbnailUrl={setThumbnailUrl}
              setRawFootageUrl={setRawFootageUrl}
              uploadingFile={uploadingFile}
              onSubmit={handleSubmitContent}
              submitting={submitting}
            />

            <RevisionTracker deal={selectedDeal} />

            <DealCard className="deal-activity">
              <div className="deal-section-title">
                <span><Clock size={18} /></span>
                <div><h2>Activity Feed</h2><p>Chronological deal state transitions</p></div>
              </div>
              <div className="deal-timeline">
                {activity.length ? activity.map((event) => (
                  <div key={event.id} className="deal-timeline-item">
                    <span className="blue"><CheckCheck size={16} /></span>
                    <article>
                      <header><strong>{event.actor_name || event.actor_type}</strong><small>{formatDateTime(event.timestamp)}</small></header>
                      <p>{event.message}</p>
                    </article>
                  </div>
                )) : <EmptyPanel text="No activity yet." />}
              </div>
            </DealCard>
          </main>

          <RightPanel
            tab={rightTab}
            setTab={setRightTab}
            deal={selectedDeal}
            currentState={selectedState}
            message={message}
            setMessage={setMessage}
            onSendMessage={handleSendMessage}
            onActionCard={handleCreateActionCard}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatusHeader({ deal, currentState, escrowAmount, onSubmit, canSubmit, submitting }) {
  const deadline = getDealDeadline(deal);
  return (
    <section className="deal-status-header">
      <div className="deal-brand-logo">
        {deal?.brand?.logo_url ? <img src={`${BACKEND_URL}${deal.brand.logo_url}`} alt={deal.brand.name || 'Brand'} /> : getInitial(deal?.brand?.name || 'B')}
      </div>
      <div className="deal-status-copy">
        <p>{getBrandHandle(deal)}</p>
        <h2>{getDealTitle(deal)}</h2>
        <span>{getDealId(deal)}</span>
      </div>
      <div className="deal-header-pill is-state"><small>Current State</small><strong>{currentState}</strong></div>
      <div className="deal-header-pill"><small>Active Party</small><strong>{deal?.active_party || 'Not assigned'}</strong></div>
      <div className="deal-header-pill is-urgent"><small>Deadline</small><strong>{getCountdownLabel(deal)}</strong></div>
      <div className="deal-header-pill"><small>Escrow</small><strong>{formatMoney(escrowAmount)} held</strong></div>
      <button type="button" className="deal-primary-action" disabled={!canSubmit} onClick={onSubmit}>
        <Upload size={17} /> {submitting ? 'Submitting...' : deal?.primary_next_action || 'Submit Content'}
      </button>
      <div className="deal-more">
        <button type="button" aria-label="More deal actions"><MoreHorizontal size={18} /></button>
        <div>
          <button type="button">Raise Dispute</button>
          <button type="button">Get Help</button>
          <button type="button"><Archive size={14} /> Archive if completed</button>
        </div>
      </div>
      <div className="deal-header-pill"><small>Due</small><strong>{formatDateTime(deadline)}</strong></div>
    </section>
  );
}

function DealNavigation({ groups, selectedDeal, onSelect }) {
  return (
    <aside className="deal-nav-panel">
      {groups.map(([label, groupDeals]) => (
        <section key={label}>
          <h3>{label} <span>{groupDeals.length}</span></h3>
          {groupDeals.length ? groupDeals.map((deal) => (
            <button
              key={`${label}-${getDealId(deal)}`}
              type="button"
              className={getDealId(selectedDeal) === getDealId(deal) ? 'is-active' : ''}
              onClick={() => onSelect(deal)}
            >
              <strong>{getDealTitle(deal)}</strong>
              <small>{getBrandHandle(deal)} - {getState(deal)}</small>
              <em>{deal.primary_next_action || 'No action pending'} - {getCountdownLabel(deal)}</em>
              {deal.unread_count ? <b>{deal.unread_count}</b> : null}
            </button>
          )) : <p>No deals</p>}
        </section>
      ))}
    </aside>
  );
}

function ShippingBlock({ deal, unboxingVideoUrl, onUpload, onSubmitReceipt, uploading }) {
  const shipment = deal?.shipment || {};
  const receipt = deal?.receipt || {};
  return (
    <DealCard className="deal-shipping-card">
      <div className="deal-section-title">
        <span><Package size={18} /></span>
        <div><h2>Shipping / Receipt</h2><p>Confirm package condition before producing content</p></div>
      </div>
      <div className="deal-receipt-grid">
        <p><small>Tracking ID</small>{shipment.courier_tracking_url ? <a href={shipment.courier_tracking_url} target="_blank" rel="noreferrer">{shipment.tracking_id || 'Tracking link'}</a> : <strong>{shipment.tracking_id || 'Not available'}</strong>}</p>
        <p><small>Courier Status</small><strong>{shipment.courier_status || 'Not available'}</strong></p>
        <p><small>Expected Delivery</small><strong>{formatDate(shipment.expected_delivery_at)}</strong></p>
        <p><small>Date Received</small><strong>{formatDate(receipt.received_at)}</strong></p>
      </div>
      <button type="button" className="deal-secondary-action" disabled={!deal?.can_mark_received} onClick={onSubmitReceipt}>Mark Received</button>
      <label>Upload Unboxing Video</label>
      <p className="deal-helper-text">Upload a short unboxing video showing package condition, opening, and product received.</p>
      <input type="file" id="unboxing-upload" accept="video/mp4,video/quicktime" onChange={(event) => onUpload(event.target.files?.[0])} />
      <UploadZone icon={Paperclip} label="Upload Unboxing Video" accept="MP4/MOV - Max 150MB - Max 2 minutes" uploaded={Boolean(unboxingVideoUrl || receipt.unboxing_video_url)} onClick={() => document.getElementById('unboxing-upload').click()} disabled={uploading} />
    </DealCard>
  );
}

function ContentSubmission({
  deal,
  finalVideoUrl,
  captionUrl,
  thumbnailUrl,
  rawFootageUrl,
  onUpload,
  setFinalVideoUrl,
  setCaptionUrl,
  setThumbnailUrl,
  setRawFootageUrl,
  uploadingFile,
  onSubmit,
  submitting
}) {
  const content = deal?.content_submission || {};
  const required = getRequiredAssets(deal);
  const versions = content.versions || [];
  const needsCaption = Boolean(required.caption_script);
  const needsThumbnail = Boolean(required.thumbnail);
  const needsRaw = Boolean(required.raw_footage);

  return (
    <DealCard className="deal-delivery-card">
      <div className="deal-section-title">
        <span><Upload size={18} /></span>
        <div><h2>Content Submission</h2><p>{content.watermark_required_until_approval ? 'Watermarked preview until brand approval' : 'Brand approval rules loaded'}</p></div>
      </div>
      {content.watermark_required_until_approval && <div className="deal-watermark">Watermarked preview until brand approval</div>}
      <UploadZone icon={Play} label="Final Video Upload" accept="MP4 - MOV" uploaded={Boolean(finalVideoUrl)} onClick={() => document.getElementById('video-file-real').click()} disabled={uploadingFile === 'video'} />
      <input type="file" id="video-file-real" accept="video/*" onChange={(event) => onUpload(event.target.files?.[0], setFinalVideoUrl, 'video')} hidden />
      <div className="deal-asset-grid">
        {needsCaption && (
          <div>
            <label>Caption / Script Upload</label>
            <UploadZone icon={FileText} label="Caption / Script" accept=".txt - .docx" uploaded={Boolean(captionUrl)} onClick={() => document.getElementById('caption-file-real').click()} disabled={uploadingFile === 'caption'} />
            <input type="file" id="caption-file-real" onChange={(event) => onUpload(event.target.files?.[0], setCaptionUrl, 'caption')} hidden />
          </div>
        )}
        {needsThumbnail && (
          <div>
            <label>Thumbnail Upload</label>
            <UploadZone icon={Image} label="Thumbnail" accept="JPG - PNG" uploaded={Boolean(thumbnailUrl)} onClick={() => document.getElementById('thumb-file-real').click()} disabled={uploadingFile === 'thumb'} />
            <input type="file" id="thumb-file-real" accept="image/*" onChange={(event) => onUpload(event.target.files?.[0], setThumbnailUrl, 'thumb')} hidden />
          </div>
        )}
        {needsRaw && (
          <div>
            <label>Raw Footage Upload</label>
            <UploadZone icon={Paperclip} label="Raw Footage" accept="MP4 - MOV" uploaded={Boolean(rawFootageUrl)} onClick={() => document.getElementById('raw-file-real').click()} disabled={uploadingFile === 'raw'} />
            <input type="file" id="raw-file-real" accept="video/*" onChange={(event) => onUpload(event.target.files?.[0], setRawFootageUrl, 'raw')} hidden />
          </div>
        )}
      </div>
      <div className="deal-version-row">
        {versions.length ? versions.map((version) => (
          <article key={version.version}>
            <strong>v{version.version}</strong>
            <small>{formatDateTime(version.submitted_at)}</small>
            <span>{version.status}</span>
          </article>
        )) : <article><strong>v1</strong><small>No upload yet</small><span>Awaiting submission</span></article>}
      </div>
      <button type="button" className="deal-submit" disabled={!finalVideoUrl || !deal?.can_submit_content || submitting} onClick={onSubmit}>
        <Upload size={17} /> {submitting ? 'Submitting...' : 'Submit Final Delivery'}
      </button>
    </DealCard>
  );
}

function RevisionTracker({ deal }) {
  const revision = deal?.revision_tracker || {};
  return (
    <DealCard className="deal-revisions">
      <div className="deal-section-title">
        <span className="warn"><RotateCcw size={18} /></span>
        <div><h2>Revision Tracker</h2><p>Revision {revision.revision_count_used || 0} of {revision.revision_limit || 0} used</p></div>
      </div>
      <div className="deal-revision-box">
        <p><small>Brand Feedback</small><strong>{revision.latest_feedback || 'No revision requested yet.'}</strong></p>
        <p><small>Requested Changes</small><strong>{revision.requested_changes?.length ? revision.requested_changes.join(', ') : 'No requested changes.'}</strong></p>
        <p><small>New Deadline</small><strong>{formatDateTime(revision.new_deadline_at)}</strong></p>
      </div>
      <div className="deal-revision-actions">
        <button type="button">Accept and revise</button>
        <button type="button">Flag scope creep</button>
        <button type="button">Partially accept and dispute remaining items</button>
      </div>
    </DealCard>
  );
}

function RightPanel({ tab, setTab, deal, currentState, message, setMessage, onSendMessage, onActionCard }) {
  const chat = deal?.chat_summary || {};
  const messages = chat.messages || [];
  const escrow = deal?.escrow || {};
  const deductions = escrow.deductions || [];
  return (
    <aside className="deal-right-panel">
      <div className="deal-right-tabs">
        {['chat', 'progress', 'payout'].map((name) => (
          <button key={name} type="button" className={tab === name ? 'is-active' : ''} onClick={() => setTab(name)}>{name}</button>
        ))}
      </div>
      {tab === 'chat' && (
        <div className="deal-chat">
          <div className="deal-pinned"><AlertTriangle size={16} /><strong>{currentState}</strong><span>{deal?.primary_next_action || 'No action pending'} - {getCountdownLabel(deal)}</span></div>
          <div className="deal-action-card">
            <h3>Pending Action</h3>
            <p>{deal?.primary_next_action || 'No action pending'}</p>
            <button type="button" onClick={() => onActionCard('Milestone Update')}>+ Action Card</button>
          </div>
          <div className="deal-message-list">
            {messages.length ? messages.map((item) => (
              <p key={item.id} className={item.sender_type === 'creator' ? 'creator' : item.sender_type === 'system' ? 'system' : 'brand'}>
                {item.sender_name}: {item.message}
              </p>
            )) : <p className="system">No messages yet.</p>}
          </div>
          <div className="deal-action-menu">
            {Object.keys(ACTION_CARD_TYPES).map((item) => <button key={item} type="button" onClick={() => onActionCard(item)}>{item}</button>)}
          </div>
          <div className="deal-chat-input">
            <button type="button"><Smile size={17} /></button>
            <button type="button"><Paperclip size={17} /></button>
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message this deal thread" />
            <button type="button" onClick={onSendMessage}><Send size={17} /></button>
          </div>
        </div>
      )}
      {tab === 'progress' && (
        <div className="deal-progress-tab">
          {[...DEAL_STATES, ...EXCEPTION_STATES].map((state) => {
            const currentIndex = DEAL_STATES.findIndex((item) => stateKey(item) === stateKey(currentState));
            const itemIndex = DEAL_STATES.findIndex((item) => stateKey(item) === stateKey(state));
            const isCurrent = stateKey(state) === stateKey(currentState);
            const isDone = itemIndex !== -1 && currentIndex !== -1 && itemIndex < currentIndex;
            return (
              <div key={state} className={isCurrent ? 'is-current' : isDone ? 'is-done' : ''}>
                <span>{isCurrent ? <Clock size={15} /> : <CheckCheck size={15} />}</span>
                <strong>{state}</strong>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'payout' && (
        <div className="deal-payout-tab">
          <p><span>Escrow Held</span><strong>{formatMoney(escrow.held_amount || 0)}</strong></p>
          <p><span>Net Payable</span><strong>{formatMoney(escrow.net_payable || 0)}</strong></p>
          <p><span>Deductions</span><strong>{deductions.length ? deductions.map((item) => `${item.label}: ${formatMoney(item.amount)}`).join(', ') : 'No deductions'}</strong></p>
          <p><span>Estimated Payout</span><strong>{formatDateTime(escrow.estimated_payout_at)}</strong></p>
          <em>Disputed deals remain on hold until resolved.</em>
        </div>
      )}
      <div className="deal-deadline">
        <div><span><AlertTriangle size={21} /></span><div><strong>Deadline Alert</strong><h2>{getCountdownLabel(deal)}</h2><p>Due: {formatDateTime(getDealDeadline(deal))}</p><p>Active party: {deal?.active_party || 'Not assigned'}</p><p>Required action: {deal?.primary_next_action || 'No action pending'}</p></div></div>
      </div>
      <div className="deal-help-list">
        {[
          [Headphones, 'Escalate to Admin'],
          [Flag, 'Raise Dispute'],
          [ShieldAlert, 'Report Damaged / Wrong Product']
        ].map(([Icon, label]) => (
          <button key={label} type="button" onClick={() => onActionCard(label === 'Report Damaged / Wrong Product' ? 'Damage Report' : label)}>
            <span><Icon size={18} /></span>
            <div><strong>{label}</strong><small>Deal support action</small></div>
          </button>
        ))}
      </div>
    </aside>
  );
}
