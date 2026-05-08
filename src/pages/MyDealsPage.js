import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Bell, Bookmark, Calendar, CheckCheck, ChevronDown, FileCheck, FileText, FileVideo, Flag, Headphones, Image, IndianRupee, Info, LayoutDashboard, LogOut, MessageSquare, Package, Paperclip, Play, RotateCcw, Search, Settings, ShieldAlert, Star, Upload, User, Zap, Briefcase } from 'lucide-react';
import { getInitial, EmptyPanel } from '../components/CreatorComponents';
import DashboardLayout from '../components/DashboardLayout';
import './CreatorDashboard.css';
import './MyDealsPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function DealCard({ children, className = '' }) {
  return <section className={`deal-card ${className}`}>{children}</section>;
}

function UploadZone({ icon: Icon, label, accept, large, uploaded, onClick, disabled }) {
  return (
    <button type="button" className={`deal-upload ${large ? 'is-large' : ''} ${uploaded ? 'is-uploaded' : ''}`} onClick={onClick} disabled={disabled}>
      <span><Icon size={22} strokeWidth={1.5} /></span>
      <strong>{uploaded ? 'File uploaded successfully' : label}</strong>
      <small>{uploaded ? 'Ready for submission' : accept}</small>
    </button>
  );
}

function ProgressCard({ steps }) {
  return (
    <DealCard className="deal-side-card">
      <h2>Deal Progress</h2>
      <div className="deal-progress">
        {steps.map(([label, timestamp], index) => {
          const done = timestamp && new Date(timestamp) <= new Date();
          const current = !done && !steps.slice(index + 1).some(([, t]) => t);
          return (
            <div key={label} className={`deal-step ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}>
              <span>{done ? <CheckCheck size={16} /> : current ? <i /> : <b />}</span>
              <div>
                <strong>{label}</strong>
                <small>{timestamp ? new Date(timestamp).toLocaleDateString('en-IN') : 'Pending'}</small>
              </div>
              {current && <em>Now</em>}
            </div>
          );
        })}
      </div>
    </DealCard>
  );
}

function PayoutSummary({ amount }) {
  const platformFee = Math.round(amount * 0.1);
  const tax = Math.round(amount * 0.02);
  const net = amount - platformFee - tax;
  const formatMoney = (val) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;
  return (
    <DealCard className="deal-side-card">
      <div className="deal-side-title"><span><IndianRupee size={19} /></span><h2>Payout Summary</h2></div>
      <div className="deal-payout-box">
        <p><span>Total Payout</span><strong>{formatMoney(amount)}</strong></p>
        <p><span>Platform Fee (10%)</span><strong className="danger">- {formatMoney(platformFee)}</strong></p>
        <p><span>Tax Deduction (2%)</span><strong className="danger">- {formatMoney(tax)}</strong></p>
        <p className="net"><span>Net Payout to You</span><strong>{formatMoney(net)}</strong></p>
      </div>
      <div className="deal-estimate"><Calendar size={16} /><div><strong>Estimated Payout</strong><small>After approval</small></div></div>
    </DealCard>
  );
}

function HelpCard() {
  const items = [[Headphones, 'Chat Support', 'Avg. reply in 5 min', true], [Flag, 'Raise an Issue', 'Dispute a deadline or brief'], [ShieldAlert, 'Report Damage', 'Product arrived damaged?']];
  return (
    <DealCard className="deal-side-card">
      <h2>Need Help?</h2>
      <div className="deal-help-list">
        {items.map(([Icon, label, sub, primary]) => (
          <button key={label} type="button" className={primary ? 'is-primary' : ''}>
            <span><Icon size={18} /></span>
            <div><strong>{label}</strong><small>{sub}</small></div>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
    </DealCard>
  );
}

export default function MyDealsPage() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [deals, setDeals] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [briefOpen, setBriefOpen] = useState(false);
  const [deliveryReceived, setDeliveryReceived] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);
  const [captionUrl, setCaptionUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);

  const displayName = user?.nickname || user?.full_name || user?.email || 'Creator';

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/creator') },
    { name: 'My Active Work', icon: Zap, action: () => navigate('/my-active-work') },
    { name: 'My Bids', icon: Bookmark, action: () => navigate('/my-bids') },
    { name: 'Reviews', icon: Star, action: () => navigate('/reviews') },
    { name: 'Portfolio', icon: User, action: () => navigate('/portfolio') },
    { name: 'Browse Briefs', icon: Briefcase, action: () => navigate('/browse-briefs') },
    { name: 'My Deals', icon: FileCheck, action: () => navigate('/my-deals'), active: true },
    { name: 'Messages', icon: MessageSquare, action: () => navigate('/messages') },
    { name: 'Payout', icon: IndianRupee, action: () => navigate('/withdrawal') },
    { name: 'Settings', icon: Settings, action: () => navigate('/settings') }
  ];

  useEffect(() => {
    if (user?.id) fetchDeals();
  }, [user?.id]);

  useEffect(() => {
    if (selectedDeal?.shipment?.received_at) setDeliveryReceived(true);
  }, [selectedDeal]);

  const fetchDeals = async () => {
    try {
      const res = await axios.get(`${API}/deals/my`);
      setDeals(res.data);
      if (res.data.length > 0) setSelectedDeal(res.data[0]);
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
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingFile(null);
    }
  };

  const handleSubmitWork = async () => {
    if (!finalVideoUrl) { toast.error('Final video is required'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/work/submit`, {
        campaign_id: selectedDeal.campaign.id,
        work_files: [finalVideoUrl, captionUrl, thumbnailUrl].filter(Boolean),
        description: 'Final work delivery'
      });
      toast.success('Work submitted successfully!');
      fetchDeals();
      setFinalVideoUrl(null);
      setCaptionUrl(null);
      setThumbnailUrl(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const buildProgressSteps = (campaign, my_bid, shipment, work) => {
    const steps = [['Applied', my_bid?.submitted_at], ['Accepted', campaign?.work_started_at]];
    if (campaign?.requires_shipment) {
      steps.push(['Product Shipped', shipment?.updated_at]);
      steps.push(['Product Received', shipment?.received_at]);
    }
    steps.push(['In Production', work ? null : campaign?.work_started_at]);
    steps.push(['Submitted', work?.submitted_at]);
    steps.push(['Approved', work?.approved_at]);
    return steps.filter(Boolean);
  };

  const getDueDate = (campaign, my_bid) => {
    if (!campaign?.work_started_at || !my_bid?.estimated_delivery_days) return 'TBD';
    const start = new Date(campaign.work_started_at);
    start.setDate(start.getDate() + my_bid.estimated_delivery_days);
    return start.toLocaleDateString('en-IN');
  };

  const getDeadlineInfo = (dueDate, workStartedAt) => {
    if (dueDate === 'TBD') return { hrsLeft: '?', pct: 0 };
    const now = new Date();
    const due = new Date(dueDate);
    const start = new Date(workStartedAt || now);
    const totalMs = due - start;
    const elapsedMs = now - start;
    const remainingMs = due - now;
    const hrsLeft = Math.max(0, Math.floor(remainingMs / 3600000));
    const pct = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
    return { hrsLeft, pct };
  };

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} title="Deal Room" description="Manage your campaign delivery" topbarExtra={null} sidebarExtra={null}>
        <div className="deal-content"><EmptyPanel text="Loading..." /></div>
      </DashboardLayout>
    );
  }

  if (deals.length === 0) {
    return (
      <DashboardLayout navItems={navItems} title="Deal Room" description="Manage your campaign delivery" topbarExtra={null} sidebarExtra={null}>
        <div className="deal-content"><EmptyPanel text="No active deals yet. Browse campaigns and submit bids to get started." /></div>
      </DashboardLayout>
    );
  }

  const deal = selectedDeal;
  const campaign = deal?.campaign || {};
  const my_bid = deal?.my_bid;
  const shipment = deal?.shipment;
  const work = deal?.work_submission;
  const dueDate = getDueDate(campaign, my_bid);
  const { hrsLeft, pct } = getDeadlineInfo(dueDate, campaign.work_started_at);
  const steps = buildProgressSteps(campaign, my_bid, shipment, work);

  const dealsTabBar = deals.length > 1 && (
    <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: '8px' }}>
      {deals.map((d) => (
        <button
          key={d.campaign.id}
          onClick={() => setSelectedDeal(d)}
          style={{
            padding: '8px 16px',
            border: selectedDeal?.campaign.id === d.campaign.id ? '2px solid #7387ff' : '1px solid #ddd',
            borderRadius: '6px',
            background: selectedDeal?.campaign.id === d.campaign.id ? '#f0f4ff' : '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: selectedDeal?.campaign.id === d.campaign.id ? '600' : '400'
          }}
        >
          {d.campaign.title}
        </button>
      ))}
    </div>
  );

  return (
    <DashboardLayout
      navItems={navItems}
      title="Deal Room"
      description="Manage your campaign delivery"
      topbarExtra={null}
      sidebarExtra={null}
    >
      {dealsTabBar}
      <div className="deal-content">
          <div className="deal-main-column">
            <DealCard className="deal-overview">
              <div className="deal-campaign-head">
                <div style={{ width: '80px', height: '80px', borderRadius: '8px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold', color: '#7387ff' }}>{getInitial(campaign.business_nickname || 'B')}</div>
                <div>
                  <p><span>Brand</span><i /> @{campaign.business_nickname?.toLowerCase().replace(/\s+/g, '')}</p>
                  <h2>{campaign.title}</h2>
                  <small>{campaign.objectives?.slice(0, 2).join(', ') || 'Campaign'}</small>
                </div>
                <div className="deal-badges"><span className="deal-status"><i /> {campaign.status?.replace('_', ' ')}</span></div>
              </div>
              <div className="deal-info-grid">
                {[[Calendar, 'Due Date', dueDate], [IndianRupee, 'Net Payout', my_bid ? `Rs.${Math.round(my_bid.amount * 0.88).toLocaleString('en-IN')}` : 'N/A'], [Star, 'Quality Tier', 'UGC']].map(([Icon, label, value]) => (<div key={label}><span><Icon size={18} /></span><p><small>{label}</small><strong>{value}</strong></p></div>))}
              </div>
            </DealCard>

            <DealCard className="deal-brief">
              <button type="button" onClick={() => setBriefOpen((v) => !v)}><span><FileText size={18} /></span><strong>Full Campaign Brief</strong><ChevronDown size={20} className={briefOpen ? 'is-open' : ''} /></button>
              {briefOpen && <div className="deal-brief-body"><p>{campaign.brief_text || 'No brief text provided'}</p></div>}
            </DealCard>

            {campaign.requires_shipment && (
              <DealCard className="deal-work-card">
                <div className="deal-tabs"><button type="button" className="is-active"><Package size={15} /> Receipt Confirmed</button></div>
                <div className="deal-receipt">
                  <div className="deal-toggle-row">
                    <Package size={22} />
                    <div><strong>Delivery Received</strong><small>Confirm you have received the product</small></div>
                    <button type="button" className={deliveryReceived ? 'is-on' : ''} onClick={() => setDeliveryReceived((v) => !v)}><span /> {deliveryReceived ? 'Yes' : 'No'}</button>
                  </div>
                  <div className="deal-date-row">
                    <Calendar size={18} />
                    <span>Date Received</span>
                    <strong>{shipment?.received_at ? new Date(shipment.received_at).toLocaleDateString('en-IN') : 'Pending'}</strong>
                  </div>
                  <label>Upload Invoice / Proof</label>
                  <input type="file" id="invoice-upload" onChange={(e) => handleFileUpload(e.target.files?.[0], () => {}, 'invoice')} style={{ display: 'none' }} />
                  <UploadZone icon={Paperclip} label="Drag & drop or click" accept="PDF - JPG - PNG" large onClick={() => document.getElementById('invoice-upload').click()} disabled={uploadingFile === 'invoice'} />
                </div>
              </DealCard>
            )}

            <DealCard className="deal-delivery-card">
              <div className="deal-section-title">
                <span><Upload size={18} /></span>
                <div><h2>Final Delivery</h2><p>Submit your final campaign assets</p></div>
              </div>
              <label>Final Video</label>
              <input type="file" id="video-upload" accept="video/*" onChange={(e) => handleFileUpload(e.target.files?.[0], setFinalVideoUrl, 'video')} style={{ display: 'none' }} />
              <UploadZone icon={Play} label="Final Video Upload" accept="MP4 - MOV - Max 2GB" large uploaded={!!finalVideoUrl} onClick={() => document.getElementById('video-upload').click()} disabled={uploadingFile === 'video'} />
              <div className="deal-asset-grid">
                <div>
                  <label>Caption File</label>
                  <input type="file" id="caption-upload" onChange={(e) => handleFileUpload(e.target.files?.[0], setCaptionUrl, 'caption')} style={{ display: 'none' }} />
                  <UploadZone icon={FileText} label="Caption / Script" accept=".txt - .docx" uploaded={!!captionUrl} onClick={() => document.getElementById('caption-upload').click()} disabled={uploadingFile === 'caption'} />
                </div>
                <div>
                  <label>Thumbnail</label>
                  <input type="file" id="thumb-upload" accept="image/*" onChange={(e) => handleFileUpload(e.target.files?.[0], setThumbnailUrl, 'thumb')} style={{ display: 'none' }} />
                  <UploadZone icon={Image} label="Thumbnail Image" accept="JPG - PNG" uploaded={!!thumbnailUrl} onClick={() => document.getElementById('thumb-upload').click()} disabled={uploadingFile === 'thumb'} />
                </div>
              </div>
              <button type="button" className="deal-submit" disabled={!finalVideoUrl || submitting} onClick={handleSubmitWork}>
                <Upload size={17} /> {submitting ? 'Submitting...' : 'Submit Final Delivery'}
              </button>
              {!finalVideoUrl && <p className="deal-submit-note"><Info size={14} /> Upload final video to enable submission</p>}
            </DealCard>

            {work?.revisions && work.revisions.length > 0 && (
              <DealCard className="deal-revisions">
                <div className="deal-section-title">
                  <span className="warn"><RotateCcw size={18} /></span>
                  <div><h2>Revision Timeline</h2><p>Feedback from brand</p></div>
                </div>
                <div className="deal-timeline">
                  {work.revisions.map((rev, idx) => (
                    <div key={idx} className="deal-timeline-item">
                      <span className="orange">!</span>
                      <article>
                        <header><strong>Revision Requested</strong><small>{new Date(rev.requested_at).toLocaleDateString('en-IN')}</small></header>
                        <p>{rev.feedback}</p>
                      </article>
                    </div>
                  ))}
                </div>
              </DealCard>
            )}
          </div>

          <aside className="deal-side-column">
            <ProgressCard steps={steps} />
            <PayoutSummary amount={my_bid?.amount || 0} />
            <div className="deal-deadline">
              <div><span><AlertTriangle size={21} /></span><div><strong>Deadline {hrsLeft < 24 ? 'Approaching' : ''}</strong><h2>{hrsLeft} hrs left</h2><p>Due: {dueDate}</p></div></div>
              <i><b style={{ width: `${pct}%` }} /></i>
              <small>{pct}% of time elapsed</small>
            </div>
            <HelpCard />
          </aside>
      </div>
    </DashboardLayout>
  );
}
