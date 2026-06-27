import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronRight, Check, FileText, Send, Truck, MessageSquare, User, CheckCircle, Download,
  Play, Clock, Calendar, FileVideo, CheckCircle2, Hourglass, RefreshCw, MoreHorizontal,
} from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import ChatPopup from '../components/ChatPopup';
import CreatorProfileModal from '../components/CreatorProfileModal';
import PageModal from '../components/PageModal';
import CampaignDetails from './CampaignDetails';
import ShipmentTracking from './ShipmentTracking';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const inr = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${String(u).startsWith('/') ? '' : '/'}${u}`));
const isVideo = (u) => /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(String(u || '').split('?')[0]);
const fmtDur = (s) => { if (!s || !isFinite(s)) return ''; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; };
const fileExt = (f) => (f ? (String(f).split('?')[0].split('.').pop() || '').toUpperCase() : '');
const WS_STATUS = {
  approved: { cls: 'ok', label: 'Approved', icon: CheckCircle2 },
  pending_review: { cls: 'pending', label: 'Pending Review', icon: Hourglass },
  revision_requested: { cls: 'warn', label: 'Revision', icon: RefreshCw },
};
const DEAL_ORDER = ['Accepted - Awaiting Shipment', 'Shipped - In Transit', 'Delivered - Awaiting Receipt Confirmation', 'Received - Content in Progress', 'Content Submitted - Awaiting Review', 'Approved - Payment Processing', 'Paid - Complete'];
// Some profile fields (e.g. followers) are objects — never render those directly.
const safeText = (v, fb = '—') => {
  if (v == null || v === '') return fb;
  if (typeof v === 'object') return fb;
  return String(v);
};

// The brief is stored as newline-separated "Label: value" lines. Render it as a
// readable definition list so labels (sub-headings) stand apart from the values
// instead of collapsing into one grey wall of text.
function renderBrief(text) {
  if (!text) return [<p key="none" className="bcd-bl">No description provided.</p>];
  const out = [];
  let skip = false; // inside the "Deliverables" block — shown in its own card, so drop it here
  String(text).split('\n').forEach((line, i) => {
    const t = line.trim();
    if (!t) return; // spacing handled via CSS margins, not blank rows
    if (/^\d+\.\s/.test(t)) { if (!skip) out.push(<p key={i} className="bcd-bl bcd-bl-item">{t}</p>); return; }
    const idx = t.indexOf(':');
    if (idx > 0 && idx <= 28) {
      const label = t.slice(0, idx);
      const val = t.slice(idx + 1).trim();
      if (!val) {
        if (/^deliverables$/i.test(label)) { skip = true; return; }
        skip = false;
        out.push(<p key={i} className="bcd-bsub">{label}</p>);
        return;
      }
      skip = false;
      out.push(<p key={i} className="bcd-bl"><span className="bcd-blab">{label}:</span> {val}</p>);
      return;
    }
    skip = false;
    out.push(<p key={i} className="bcd-bl">{t}</p>);
  });
  return out;
}

// Pull the numbered deliverable lines out of the brief's "Deliverables:" block so
// they can live in the dedicated Deliverables card instead of the About section.
function extractDeliverables(text) {
  if (!text) return [];
  const items = [];
  let inBlock = false;
  String(text).split('\n').forEach((line) => {
    const t = line.trim();
    if (!t) return;
    const idx = t.indexOf(':');
    const label = idx > 0 && idx <= 28 ? t.slice(0, idx) : '';
    const val = idx > 0 ? t.slice(idx + 1).trim() : '';
    if (label && !val) { inBlock = /^deliverables$/i.test(label); return; }
    if (inBlock && /^\d+\.\s/.test(t)) { items.push(t.replace(/^\d+\.\s*/, '')); return; }
    if (label) inBlock = false; // a new labelled line ends the block
  });
  return items;
}

export default function BrandCampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [deal, setDeal] = useState(null);
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [chatOpen, setChatOpen] = useState(false);
  const [profOpen, setProfOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [wsDur, setWsDur] = useState('');
  const [wsMenu, setWsMenu] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cRes = await axios.get(`${API}/campaigns/${id}`);
        if (active) setCampaign(cRes.data);
        const dRes = await axios.get(`${API}/deals/my`).catch(() => ({ data: [] }));
        const d = (dRes.data || []).find((x) => String(x.campaign?.id) === String(id));
        if (active) setDeal(d || null);
        const creatorId = cRes.data?.selected_creator;
        if (creatorId) {
          const pRes = await axios.get(`${API}/profile/${creatorId}`).catch(() => null);
          if (active && pRes) setCreator({ id: creatorId, ...pRes.data });
        }
      } catch { /* ignore */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id]);

  const steps = useMemo(() => {
    const idx = deal ? DEAL_ORDER.indexOf(deal.current_state) : -1;
    const ship = deal?.shipment || {};
    const rec = deal?.receipt || {};
    const defs = [
      { label: 'Brief Sent', date: campaign?.createdAt || campaign?.created_at, done: true },
      { label: 'Product Shipped', date: ship.shipped_at, done: idx >= 1 },
      { label: 'Product Received', date: rec.received_at, done: idx >= 3 },
      { label: 'Content Submitted', date: campaign?.work_submission?.submitted_at, done: idx >= 4 },
      { label: 'Under Review', date: null, done: idx >= 5 },
      { label: 'Completed', date: deal?.escrow?.released_at, done: idx >= 6 },
    ];
    const firstTodo = defs.findIndex((s) => !s.done);
    return defs.map((s, i) => ({ ...s, current: i === firstTodo }));
  }, [deal, campaign]);

  if (loading) return <BrandTopNavLayout><div className="cmk-empty">Loading…</div></BrandTopNavLayout>;
  if (!campaign) return <BrandTopNavLayout><div className="cmk-empty">Campaign not found.</div></BrandTopNavLayout>;

  const refresh = async () => {
    try { const r = await axios.get(`${API}/campaigns/${id}`); setCampaign(r.data); } catch { /* ignore */ }
  };
  const approveWork = async () => {
    try { await axios.post(`${API}/work/${id}/approve`); toast.success('Approved — payment released to the creator'); refresh(); }
    catch { toast.error('Failed to approve'); }
  };
  const requestRevision = async () => {
    const fb = window.prompt('What changes would you like? (revision feedback)');
    if (fb === null) return;
    try { await axios.post(`${API}/work/${id}/request-revision?feedback=${encodeURIComponent(fb)}`); toast.success('Revision requested'); refresh(); }
    catch { toast.error('Failed to request revision'); }
  };
  const downloadWork = async () => {
    try {
      const res = await axios.get(`${API}/work/${id}/download`, { responseType: 'blob' });
      const u = window.URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = u; a.download = `${campaign.title || 'deliverable'}.mp4`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(u);
    } catch { toast.error('Download unlocks after approval'); }
  };

  const spent = campaign.escrow_amount || campaign.budget_min || 0;
  const total = campaign.budget_max || campaign.budget_min || 0;
  const handle = creator ? (creator.nickname || (creator.username ? `@${creator.username}` : '') || creator.public_creator_id || 'Creator') : null;
  const cp = creator?.profile || {};
  const ship = deal?.shipment || {};
  const rec = deal?.receipt || {};
  const shipped = !!(ship.shipped_at || ['shipped', 'in_transit', 'delivered'].includes(ship.courier_status));
  const delivered = !!(rec.received_at || ship.delivered_at || ship.courier_status === 'delivered');
  const unboxingUrl = assetUrl(rec.unboxing_video_url || ship.unboxing_video || '');
  const campaignDeliver = String(campaign.deliverables || '').split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
  const briefDeliver = extractDeliverables(campaign.brief_text);
  const deliverList = campaignDeliver.length ? campaignDeliver : briefDeliver;

  const ws = campaign.work_submission;
  const wsStatus = ws ? (ws.status || (campaign.status === 'completed' ? 'approved' : 'pending_review')) : null;
  const wsFiles = ws?.work_files || [];
  const wsFirst = wsFiles[0];
  const wsMedia = assetUrl(wsFirst);
  const openWork = () => { const f = wsFiles.find((x) => isVideo(x)) || wsFirst; if (f) window.open(assetUrl(f), '_blank'); };

  return (
    <BrandTopNavLayout>
      <div className="bcd">
        <div className="bcd-bc">
          <button onClick={() => navigate('/dashboard/business/all-campaigns')}><ArrowLeft size={16} /> Campaigns</button>
          <ChevronRight size={15} color="#9296ba" />
          <strong>{campaign.title}</strong>
        </div>

        <div className="bcd-top">
          <div className="bcd-title-wrap">
            <span className={`bcd-badge ${campaign.status === 'completed' ? 'done' : 'live'}`}>{campaign.status === 'completed' ? 'Completed' : 'Live'}</span>
            <h1>{campaign.title}</h1>
            <span className="bcd-sub">Campaign ID: CMP-{String(campaign.id || campaign._id || '').slice(-6).toUpperCase()} · Launched on {fmtDate(campaign.createdAt || campaign.created_at)}</span>
          </div>
          <div className="bcd-budget">
            <label>Total Budget</label>
            <strong>{inr(spent)} <small>/ {inr(total)}</small></strong>
          </div>
          <div className="bcd-actions">
            <button className="cmk-btn-ghost-sm" onClick={() => setDetailsOpen(true)}>View Details</button>
            <button className="cmk-btn-primary-sm" onClick={() => navigate('/dashboard/business/post-brief')}><Send size={15} /> Share Brief</button>
          </div>
        </div>

        <div className="bcd-tabs">
          {[['overview', 'Overview'], ['work', `Work Review${campaign.work_submission ? ' (1)' : ''}`]].map(([k, l]) => (
            <button key={k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'work' ? (
          ws ? (
            <div className="bwr-list">
              {(() => {
                const st = WS_STATUS[wsStatus] || WS_STATUS.pending_review;
                const StIcon = st.icon;
                const creatorLabel = handle ? (handle.startsWith('@') ? handle : `@${handle}`) : '@creator';
                const photo = creator?.profile_photo ? (creator.profile_photo.startsWith('http') ? creator.profile_photo : `${BACKEND_URL}${creator.profile_photo}`) : '';
                return (
                  <article className="bwr-card">
                    <div className="bwr-thumb" onClick={openWork}>
                      {wsMedia ? (isVideo(wsMedia)
                        ? <video src={`${wsMedia}#t=0.5`} muted playsInline preload="metadata" onLoadedMetadata={(e) => setWsDur(fmtDur(e.target.duration))} />
                        : <img src={wsMedia} alt="" />)
                        : <div className="bwr-thumb-fb"><FileText size={26} /></div>}
                      <span className="bwr-play"><Play size={20} fill="currentColor" /></span>
                      {wsDur && <span className="bwr-dur">{wsDur}</span>}
                    </div>

                    <div className="bwr-body">
                      <h3 className="bwr-title">{campaign.title}</h3>
                      <div className="bwr-by">
                        <span className="bwr-by-ava">{photo ? <img src={photo} alt="" /> : '@'}</span>
                        by <b>{creatorLabel}</b>
                        <i className="bwr-by-dot" />
                        <Calendar size={14} /> Submitted on {fmtDate(ws.submitted_at)}
                      </div>

                      <div className="bwr-cbox">
                        <span className="bwr-cbox-ic"><FileText size={18} /></span>
                        <div><label>Campaign</label><strong>{campaign.title}</strong></div>
                      </div>

                      <div className="bwr-meta">
                        <div className="bwr-meta-item"><Clock size={16} /><div><label>Duration</label><span>{wsDur || '—'}</span></div></div>
                        <div className="bwr-meta-item"><FileVideo size={16} /><div><label>File Type</label><span>{fileExt(wsFirst) || '—'}</span></div></div>
                        <div className="bwr-meta-item"><Calendar size={16} /><div><label>Submitted</label><span>{fmtDate(ws.submitted_at)}</span></div></div>
                      </div>
                    </div>

                    <div className="bwr-side">
                      <div className="bwr-side-top">
                        <span className={`bwr-pill ${st.cls}`}><StIcon size={14} /> {st.label}</span>
                        <div className="bwr-more-wrap">
                          <button type="button" className="bwr-more" aria-label="More actions" onClick={() => setWsMenu((v) => !v)}>
                            <MoreHorizontal size={18} />
                          </button>
                          {wsMenu && (
                            <>
                              <div className="bwr-menu-backdrop" onClick={() => setWsMenu(false)} />
                              <div className="bwr-menu">
                                <button type="button" onClick={() => { setWsMenu(false); openWork(); }}><Play size={15} /> Open file</button>
                                {wsStatus !== 'approved' && <button type="button" onClick={() => { setWsMenu(false); requestRevision(); }}><RefreshCw size={15} /> Request revision</button>}
                                {wsStatus === 'pending_review' && <button type="button" onClick={() => { setWsMenu(false); approveWork(); }}><CheckCircle2 size={15} /> Approve</button>}
                                <button type="button" onClick={() => { setWsMenu(false); if (creator) setChatOpen(true); }}><MessageSquare size={15} /> Message creator</button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {wsStatus === 'approved' && (
                        <button type="button" className="bwr-btn primary" onClick={downloadWork}><Download size={16} /> Download</button>
                      )}
                      {wsStatus === 'pending_review' && (<>
                        <button type="button" className="bwr-btn approve" onClick={approveWork}><CheckCircle2 size={16} /> Approve</button>
                        <button type="button" className="bwr-btn" onClick={requestRevision}><RefreshCw size={16} /> Request Revision</button>
                      </>)}
                      {wsStatus === 'revision_requested' && (
                        <button type="button" className="bwr-btn" disabled><RefreshCw size={16} /> Awaiting resubmit</button>
                      )}
                      <button type="button" className="bwr-btn" onClick={() => { if (creator) setChatOpen(true); }}><MessageSquare size={16} /> Message Creator</button>
                    </div>
                  </article>
                );
              })()}
            </div>
          ) : (
            <div className="cmk-empty">No content has been submitted for review yet.</div>
          )
        ) : (
        <>
        <div className="bcd-grid">
          {/* Campaign Progress */}
          <div className="bcd-card">
            <h3>Campaign Progress</h3>
            {steps.map((s, i) => (
              <div key={i} className={`bcd-step ${s.done ? 'done' : ''} ${s.current ? 'current' : ''} ${!s.done && !s.current ? 'todo' : ''}`}>
                <span className="bcd-step-dot">{s.done ? <Check size={12} /> : null}</span>
                <div className="bcd-step-info"><strong>{s.label}</strong><small>{s.date ? fmtDate(s.date) : (s.current ? 'In progress' : '—')}</small></div>
              </div>
            ))}
          </div>

          {/* Shipment */}
          <div className="bcd-card">
            <h3>Shipment Status</h3>
            {campaign.requires_shipment || ship.required ? (
              <>
                <span className={`bcd-pill ${delivered ? 'ok' : shipped ? 'info' : 'warn'}`}>{delivered ? 'Delivered' : shipped ? 'In Transit' : 'Pending'}</span>
                <p className="bcd-ship-on">{delivered ? 'Delivered to creator on' : 'Awaiting delivery'}</p>
                {delivered && <div className="bcd-ship-date">{fmtDate(rec.received_at || ship.delivered_at)}</div>}
                <div className="bcd-kv"><label>Tracking ID</label><strong>{ship.tracking_id || '—'}</strong></div>
                <div className="bcd-kv"><label>Courier</label><strong>{ship.courier || '—'}</strong></div>

                {unboxingUrl && (
                  <button type="button" className="bcd-cta" onClick={() => window.open(unboxingUrl, '_blank')}>
                    <Play size={15} /> View Unboxing Video
                  </button>
                )}

                <button className="bcd-cta bcd-cta-ship" onClick={() => setShipmentOpen(true)}><Truck size={15} /> View Shipment</button>
              </>
            ) : <p className="bcd-muted">No physical product for this campaign.</p>}
          </div>

          {/* Creator */}
          <div className="bcd-card">
            <h3>Creator</h3>
            {creator ? (
              <>
                <div className="bcd-creator">
                  <span className="bcd-cre-ava">{creator.profile_photo ? <img src={creator.profile_photo.startsWith('http') ? creator.profile_photo : `${BACKEND_URL}${creator.profile_photo}`} alt="" /> : (handle || 'C').replace('@', '').charAt(0).toUpperCase()}</span>
                  <div><strong>{handle}</strong><small>{(cp.category || 'UGC Creator').replace(/_/g, ' ')}</small></div>
                </div>
                <div className="bcd-kv"><label>Content Type</label><strong>{safeText(cp.content_type, 'Reels')}</strong></div>
                <div className="bcd-kv"><label>Platform</label><strong>{safeText(cp.platform, 'Instagram')}</strong></div>
                <div className="bcd-kv"><label>Followers</label><strong>{safeText(cp.followers, '—')}</strong></div>
                <button className="bcd-cta" onClick={() => setProfOpen(true)}><User size={15} /> View Creator Profile</button>
                <button className="bcd-cta primary" onClick={() => setChatOpen(true)}><MessageSquare size={15} /> Chat with Creator</button>
              </>
            ) : <p className="bcd-muted">No creator selected yet.</p>}
          </div>
        </div>

        <div className="bcd-grid2">
          <div className="bcd-card bcd-about-card">
            <h3>About Campaign</h3>
            {(() => {
              const rows = renderBrief(campaign.brief_text);
              const LIMIT = 5;
              const shown = aboutOpen ? rows : rows.slice(0, LIMIT);
              return (
                <>
                  <div className="bcd-about">{shown}</div>
                  {rows.length > LIMIT && (
                    <button type="button" className="bcd-more" onClick={() => setAboutOpen((v) => !v)}>
                      {aboutOpen ? 'Show less' : `Show more details (+${rows.length - LIMIT})`}
                      <ChevronRight size={15} className={aboutOpen ? 'bcd-more-up' : 'bcd-more-down'} />
                    </button>
                  )}
                </>
              );
            })()}
          </div>
          <div className="bcd-card">
            <h3>Deliverables</h3>
            {(deliverList.length ? deliverList : ['1 UGC video as described in the brief']).map((d, i) => (
              <div key={i} className="bcd-deliver"><CheckCircle size={16} /> {d}</div>
            ))}
          </div>
        </div>
        </>
        )}
      </div>

      {chatOpen && creator && <ChatPopup user={{ id: creator.id, name: (handle || '').replace('@', ''), photo: creator.profile_photo }} onClose={() => setChatOpen(false)} />}
      {profOpen && creator && <CreatorProfileModal id={creator.id} fallbackName={handle} photo={creator.profile_photo} onClose={() => setProfOpen(false)} onMessage={() => { setProfOpen(false); setChatOpen(true); }} />}
      {detailsOpen && <PageModal bare maxWidth={900} onClose={() => setDetailsOpen(false)}><CampaignDetails embedId={id} onClose={() => setDetailsOpen(false)} /></PageModal>}
      {shipmentOpen && <PageModal onClose={() => setShipmentOpen(false)} maxWidth={920}><ShipmentTracking embedCampaignId={id} onClose={() => setShipmentOpen(false)} /></PageModal>}

      <style>{`
        .bcd-bc{display:flex;align-items:center;gap:8px;margin-bottom:16px}
        .bcd-bc button{display:inline-flex;align-items:center;gap:6px;color:#5b6bff;font-weight:600;background:none;border:none;cursor:pointer;font-family:inherit;font-size:14px}
        .bcd-bc strong{color:#15163a;font-weight:700;font-size:14px}
        .bcd-top{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;flex-wrap:wrap;padding-bottom:18px;border-bottom:1px solid #eef0f6}
        .bcd-title-wrap{display:flex;flex-direction:column;gap:6px;flex:1;min-width:240px}
        .bcd-badge{align-self:flex-start;font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;text-transform:uppercase}
        .bcd-badge.live{background:#dcfce7;color:#15a35b}.bcd-badge.done{background:#dcfce7;color:#15a35b}
        .bcd-title-wrap h1{margin:0;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:26px;font-weight:800;color:#15163a}
        .bcd-sub{color:#9296ba;font-size:13px}
        .bcd-budget{display:flex;flex-direction:column;gap:5px;min-width:230px}
        .bcd-budget label{color:#9296ba;font-size:12px;font-weight:600}
        .bcd-budget strong{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:18px;color:#15163a}
        .bcd-budget strong small{color:#9296ba;font-weight:600;font-size:13px}
        .bcd-budget-bar{height:7px;border-radius:6px;background:#e7e9f7;overflow:hidden}
        .bcd-budget-bar i{display:block;height:100%;background:linear-gradient(90deg,#5b6bff,#8b5cf6)}
        .bcd-pct{color:#585c7e;font-weight:700;font-size:13px;align-self:flex-end}
        .bcd-actions{display:flex;align-items:center;gap:10px}
        .bcd-tabs{display:flex;gap:26px;border-bottom:1px solid #eef0f6;margin:18px 0 22px;flex-wrap:wrap}
        .bcd-tabs button{background:none;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;color:#585c7e;padding:0 0 14px;position:relative;white-space:nowrap}
        .bcd-tabs button.is-active{color:#5b6bff}
        .bcd-tabs button.is-active::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:3px;border-radius:3px 3px 0 0;background:linear-gradient(90deg,#5b6bff,#8b5cf6)}
        .bcd-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:stretch}
        .bcd-grid2{display:grid;grid-template-columns:1.3fr 1fr;gap:20px;margin-top:20px;align-items:start}
        .bcd-card{background:#fff;border:1px solid #eef0f6;border-radius:18px;padding:20px;box-shadow:0 10px 30px -12px rgba(28,30,80,.10)}
        .bcd-card h3{margin:0 0 16px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:16px;font-weight:700;color:#15163a}
        .bcd-step{display:flex;gap:12px;position:relative;padding-bottom:18px}
        .bcd-step:last-child{padding-bottom:0}
        .bcd-step::before{content:"";position:absolute;left:10px;top:22px;bottom:0;width:2px;background:#e7e9f7}
        .bcd-step:last-child::before{display:none}
        .bcd-step.done::before{background:#15a35b}
        .bcd-step-dot{width:22px;height:22px;border-radius:50%;border:2px solid #dfe2f0;background:#fff;flex:none;display:grid;place-items:center;z-index:2;color:#fff}
        .bcd-step.done .bcd-step-dot{background:#15a35b;border-color:#15a35b}
        .bcd-step.current .bcd-step-dot{border-color:#5b6bff;box-shadow:0 0 0 3px rgba(91,107,255,.2)}
        .bcd-step-info strong{display:block;font-size:14px;color:#15163a}
        .bcd-step-info small{color:#9296ba;font-size:12.5px}
        .bcd-step.todo .bcd-step-info strong{color:#9296ba}
        .bcd-pill{display:inline-block;font-size:11.5px;font-weight:800;padding:5px 12px;border-radius:20px;text-transform:uppercase}
        .bcd-pill.ok{background:#dcfce7;color:#15a35b}.bcd-pill.info{background:#e0e7ff;color:#4452f0}.bcd-pill.warn{background:#fdf2e0;color:#d98314}
        .bcd-ship-on{color:#585c7e;font-size:13px;margin:12px 0 2px}
        .bcd-ship-date{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:20px;font-weight:800;color:#15163a;margin-bottom:8px}
        .bcd-kv{display:flex;flex-direction:column;gap:2px;margin-top:12px}
        .bcd-kv label{color:#9296ba;font-size:12px;font-weight:600}
        .bcd-kv strong{color:#15163a;font-size:15px}
        .bcd-cta{width:100%;margin-top:14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #e9ebf4;background:#fff;color:#5b6bff;border-radius:12px;padding:10px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit}
        .bcd-cta:hover{border-color:#cdd2f3}
        .bcd-cta.primary{background:#eef0ff;border-color:#dfe2ff}
        .bcd-cta-ship{margin-top:10px}
        .bcd-creator{display:flex;align-items:center;gap:12px;margin-bottom:6px}
        .bcd-cre-ava{width:48px;height:48px;border-radius:50%;flex:none;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#5b6bff,#8b5cf6);color:#fff;font-weight:800;font-size:18px}
        .bcd-cre-ava img{width:100%;height:100%;object-fit:cover}
        .bcd-creator strong{display:block;font-size:15.5px;color:#15163a}
        .bcd-creator small{color:#9296ba;font-size:13px;text-transform:capitalize}
        .bcd-about-card h3{color:#5b6bff}
        .bcd-about{margin:0}
        .bcd-bl{color:#585c7e;font-size:14px;line-height:1.65;margin:0 0 7px}
        .bcd-blab{color:#15163a;font-weight:700}
        .bcd-bsub{color:#5b6bff;font-weight:800;font-size:12.5px;text-transform:uppercase;letter-spacing:.5px;margin:16px 0 7px}
        .bcd-bl-item{padding-left:14px;position:relative}
        .bcd-bl-item::before{content:"";position:absolute;left:2px;top:9px;width:5px;height:5px;border-radius:50%;background:#cdd2f3}
        .bcd-bgap{height:4px}
        .bcd-more{display:inline-flex;align-items:center;gap:5px;margin-top:12px;padding:8px 16px;border-radius:30px;border:1px solid #dfe2ff;background:#eef0ff;color:#5b6bff;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;transition:.18s}
        .bcd-more:hover{background:#e2e5ff}
        .bcd-more-down{transform:rotate(90deg)}
        .bcd-more-up{transform:rotate(-90deg)}
        .bcd-deliver{display:flex;align-items:flex-start;gap:9px;color:#585c7e;font-size:14px;line-height:1.5;padding:7px 0}
        .bcd-deliver svg{color:#15a35b;flex:none;margin-top:2px}
        .bcd-muted{color:#9296ba;font-size:14px;margin:0}
        @media (max-width:980px){.bcd-grid{grid-template-columns:1fr}.bcd-grid2{grid-template-columns:1fr}}
      `}</style>
    </BrandTopNavLayout>
  );
}
