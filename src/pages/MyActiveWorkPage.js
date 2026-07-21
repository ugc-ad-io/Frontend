import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Zap, AlertTriangle, Hourglass, CheckCircle2, XCircle, ArrowRight, RefreshCw, Inbox, IndianRupee } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { isSelectedCreator } from '../utils/campaignCreators';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();

// Deal lifecycle stages, rendered as a segmented progress bar on each row.
const STAGES = ['Accepted', 'Shipment', 'Video Submission', 'Review', 'Payout'];
// A distinct colour per stage; the final stage (Payout) is green.
const STAGE_COLORS = ['#3b82f6', '#6366f1', '#6d7bff', '#f59e0b', '#22c55e'];

// Online-only campaigns (app, service, storefront) ship nothing, so a "Shipment"
// stage is dead weight — the creator starts filming the moment they accept. The
// brief records this as requires_shipment/shipment_required at post time.
const dealShips = (c) => (
  c.requires_shipment === true || c.shipment_required === true || c.shipment_option === 'yes'
);
// Stage list + matching colours for this specific deal.
const stagesFor = (c) => {
  if (dealShips(c)) return { labels: STAGES, colors: STAGE_COLORS };
  return { labels: STAGES.filter((s) => s !== 'Shipment'), colors: STAGE_COLORS.filter((_, i) => i !== 1) };
};
function stageIndex(c) {
  const s = c.status;
  const ships = dealShips(c);
  // Without a Shipment segment every later stage shifts one slot left.
  const at = (i) => (ships ? i : Math.max(0, i - 1));
  if (s === 'completed') return at(4);       // Payout
  if (s === 'under_review') return at(3);    // Review
  if (s === 'work_submitted') return at(2);  // Video Submission
  if (s === 'cancelled') return 0;
  // Index 1 is Shipment on a shipping deal, Video Submission on an online one —
  // in both cases it's the stage the creator is waiting on right after accepting.
  return 1;
}

// Has the brand sent this piece of work back for changes?
const needsRevision = (c) => (c.work_submission || {}).status === 'revision_requested';

// A direct booking the creator hasn't turned into active work yet. It's created with
// status "in_progress", so without this it masquerades as an active deal in the list.
//   pending_creator → needs THEIR response (accept / decline / propose a price)
//   price_revision  → they proposed a price, now waiting on the brand
const isBookingRequest = (c) => c.booking_status === 'pending_creator' || c.booking_status === 'price_revision';
const needsCreatorResponse = (c) => c.booking_status === 'pending_creator';

// Reference-style status badge: label + accent colour + icon.
function statusMeta(c) {
  const s = c.status;
  const due = c.due_date ? Math.ceil((new Date(c.due_date) - Date.now()) / 86400000) : null;
  const startFuture = (c.start_date || c.scheduled_at) && new Date(c.start_date || c.scheduled_at) > Date.now();
  // Booking requests come first — a pending one needs the creator to respond, and a
  // price proposal is parked waiting on the brand. Neither is active work yet.
  if (c.booking_status === 'pending_creator') return { label: 'Booking Request', color: '#4452f0', Icon: Inbox };
  if (c.booking_status === 'price_revision') return { label: 'Price Sent — Awaiting Brand', color: '#f59e0b', Icon: Hourglass };
  // A revision request drops the campaign back to in_progress, which used to read
  // as a plain "Active" — the creator had no signal the brand wanted changes.
  if (needsRevision(c)) return { label: 'Revision Requested', color: '#f97316', Icon: RefreshCw };
  if (s === 'completed') return { label: 'Completed', color: '#22c55e', Icon: CheckCircle2 };
  if (s === 'cancelled') return { label: 'Cancelled', color: '#ef4444', Icon: XCircle };
  if (s === 'work_submitted' || s === 'under_review') return { label: 'In Review', color: '#f59e0b', Icon: Hourglass };
  if (due !== null && due < 0) return { label: 'Over Time', color: '#ef4444', Icon: AlertTriangle };
  if (startFuture) return { label: 'Upcoming', color: '#f97316', Icon: Hourglass };
  return { label: 'Active', color: '#16a34a', Icon: Zap };
}

const TABS = [
  // Incoming booking requests awaiting the creator's decision — surfaced from the
  // "New booking request" notification so they aren't buried inside a deal.
  { key: 'requests', label: 'Requests', match: (c) => isBookingRequest(c) },
  // Pending-review deals (work_submitted / under_review) live under Active now.
  // A booking request is technically "in_progress" too, so exclude it — otherwise it
  // shows up here as a green "Active" card before the creator has even accepted it.
  { key: 'active', label: 'Active', match: (c) => !isBookingRequest(c) && ['in_progress', 'active', 'work_submitted', 'under_review'].includes(c.status) },
  { key: 'completed', label: 'Completed', match: (c) => c.status === 'completed' },
  { key: 'cancelled', label: 'Cancelled', match: (c) => c.status === 'cancelled' },
];

export default function MyActiveWorkPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  // Land on the Requests tab once if there's a booking waiting on the creator — the
  // whole point of the "New booking request" notification is to not miss it. Only
  // fires on the first load that has requests; manual tab switches stick after that.
  const autoTabbed = useRef(false);

  useEffect(() => {
    if (user?.approval_status && user.approval_status !== 'approved') return undefined;
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/campaigns?t=${Date.now()}`);
      setCampaigns(res.data.filter((c) => isSelectedCreator(c, user.id)));
    } catch {
      toast.error('Failed to load active work');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoTabbed.current || loading) return;
    if (campaigns.some(needsCreatorResponse)) {
      autoTabbed.current = true;
      setTab('requests');
    }
  }, [campaigns, loading]);

  const counts = useMemo(() => {
    const o = {};
    TABS.forEach((t) => { o[t.key] = campaigns.filter(t.match).length; });
    return o;
  }, [campaigns]);

  const rows = useMemo(() => {
    const t = TABS.find((x) => x.key === tab);
    return campaigns.filter(t.match);
  }, [campaigns, tab]);

  return (
    <CreatorTopNavLayout notifications={0}>
      <div className="cmk-page-head">
        <h1>My Active Work</h1>
        <p>Manage and track all your ongoing campaigns.</p>
      </div>

      <div className="cmk-tabs-row">
        <div className="cmk-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>
              {t.label} <em>({counts[t.key] || 0})</em>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="cmk-awc-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <article className="cmk-awc" key={i} aria-hidden="true">
              <Skeleton width={46} height={46} radius={12} />
              <div className="cmk-awc-lead" style={{ flex: 1, minWidth: 0 }}>
                <Skeleton width={120} height={12} />
                <Skeleton width="55%" height={16} style={{ marginTop: 8 }} />
                <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
              </div>
              <Skeleton width={140} height={30} radius={8} />
              <Skeleton width={38} height={38} radius="50%" />
            </article>
          ))}
        </div>
      ) : rows.length ? (
        <div className="cmk-awc-grid">
          {rows.map((c) => {
            const meta = statusMeta(c);
            const brand = String(c.brand_name || c.business_name || c.company_name || c.business_nickname || c.brand_handle || '').replace(/^@+/, '').trim() || 'Brand';
            const channel = (Array.isArray(c.objectives) && c.objectives[0]) || c.industry_type || 'UGC Video';
            const shortId = `#${String(c.id).slice(-4).toUpperCase()}`;
            const cur = stageIndex(c);
            const steps = stagesFor(c);
            return (
              <article
                key={c.id}
                className="cmk-awc cmk-rise"
                style={{ '--awc': meta.color }}
                onClick={() => navigate(`/my-deals?campaign=${c.id}`)}
                role="button"
                tabIndex={0}
              >
                <span className="cmk-awc-ava">
                  {c.brand_logo ? <img src={c.brand_logo.startsWith('http') ? c.brand_logo : `${BACKEND_URL}${c.brand_logo}`} alt="" /> : getInitial(brand)}
                </span>

                <div className="cmk-awc-lead">
                  <div className="cmk-awc-top">
                    <span className="cmk-awc-id">{shortId}</span>
                    <span className="cmk-awc-div" />
                    <span className="cmk-awc-badge"><meta.Icon size={14} /> {meta.label}</span>
                  </div>
                  <h3 className="cmk-awc-title">{c.title || 'Campaign'}</h3>
                  <small className="cmk-awc-sub">{brand} · Via {channel}</small>

                  {/* The one place the creator can actually read the brand's notes
                      and re-upload. Without it, "Revision Requested" is a dead end. */}
                  {needsRevision(c) && (
                    <button
                      type="button"
                      className="cmk-awc-revision"
                      onClick={(e) => { e.stopPropagation(); navigate(`/work/submit?campaign=${c.id}`); }}
                      data-testid={`see-revision-${c.id}`}
                    >
                      <RefreshCw size={13} /> See what they asked for
                    </button>
                  )}
                </div>

                {isBookingRequest(c) ? (
                  /* Work hasn't started — the stage stepper would be misleading. Show the
                     payout and a direct "Respond" CTA into the Deal Room booking card. */
                  <div className="cmk-awc-reqcta">
                    <span className="cmk-awc-reqpay">
                      <IndianRupee size={15} />
                      <b>{Number(c.budget_max || c.budget_min || 0).toLocaleString('en-IN')}</b>
                      <em>you'll be paid</em>
                    </span>
                    <button
                      type="button"
                      className="cmk-awc-respond"
                      onClick={(e) => { e.stopPropagation(); navigate(`/my-deals?campaign=${c.id}`); }}
                      data-testid={`respond-booking-${c.id}`}
                    >
                      {needsCreatorResponse(c) ? 'Respond to request' : 'View proposal'}
                    </button>
                  </div>
                ) : (
                  <div className="cmk-awc-steps">
                    {steps.labels.map((label, i) => (
                      <div
                        key={label}
                        className={`awc-step ${i < cur ? 'done' : ''} ${i === cur ? 'current' : ''}`}
                        style={{ '--s': steps.colors[i] }}
                      >
                        <span className="awc-step-lbl">{label}</span>
                        <i className="awc-step-bar" />
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="cmk-awc-go"
                  aria-label={isBookingRequest(c) ? 'Open booking request' : 'Open campaign'}
                  onClick={(e) => { e.stopPropagation(); navigate(`/my-deals?campaign=${c.id}`); }}
                >
                  <ArrowRight size={18} />
                </button>
              </article>
            );
          })}
        </div>
      ) : tab === 'requests' ? (
        <EmptyState title="No booking requests" message="When a brand books you directly, the request lands here to accept, decline, or propose your own price." action={{ label: 'Browse Campaigns', onClick: () => navigate('/browse-briefs') }} />
      ) : (
        <EmptyState title={`No work in “${TABS.find((t) => t.key === tab).label}”`} message="Once a brand selects your bid, your active deals will appear here to manage." action={{ label: 'Browse Campaigns', onClick: () => navigate('/browse-briefs') }} />
      )}
    </CreatorTopNavLayout>
  );
}
