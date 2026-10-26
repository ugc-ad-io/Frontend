import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { Clock } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import CreatorPageHead from '../components/CreatorPageHead';
import { inr, brandTile } from '../utils/orderUi';
import '../styles/creator-marketplace.css';
import '../styles/creator-ui-orders.css';
import '../styles/creator-ui-mobile-orders.css';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { isSelectedCreator } from '../utils/campaignCreators';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();

// Deal lifecycle stages, rendered as a segmented progress bar on each row.
const STAGES = ['Accepted', 'Shipment', 'Video Submission', 'Review', 'Payout'];

// Online-only campaigns (app, service, storefront) ship nothing, so a "Shipment"
// stage is dead weight — the creator starts filming the moment they accept. The
// brief records this as requires_shipment/shipment_required at post time.
const dealShips = (c) => (
  c.requires_shipment === true || c.shipment_required === true || c.shipment_option === 'yes'
);
// Stage list + matching colours for this specific deal.
const stagesFor = (c) => ({ labels: dealShips(c) ? STAGES : STAGES.filter((x) => x !== 'Shipment') });
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

// Status badge: label + tone (cui-o-pill).
function statusMeta(c) {
  const s = c.status;
  const due = c.due_date ? Math.ceil((new Date(c.due_date) - Date.now()) / 86400000) : null;
  const startFuture = (c.start_date || c.scheduled_at) && new Date(c.start_date || c.scheduled_at) > Date.now();
  // Booking requests come first - a pending one needs the creator to respond, and a
  // price proposal is parked waiting on the brand. Neither is active work yet.
  if (c.booking_status === 'pending_creator') return { label: 'Booking request', tone: 'info' };
  if (c.booking_status === 'price_revision') return { label: 'Price sent - awaiting brand', tone: 'warn' };
  // A revision request drops the campaign back to in_progress, which used to read
  // as a plain "Active" - the creator had no signal the brand wanted changes.
  if (needsRevision(c)) return { label: 'Changes asked', tone: 'warn' };
  if (s === 'completed') return { label: 'Completed', tone: 'ok' };
  if (s === 'cancelled') return { label: 'Cancelled', tone: 'muted' };
  if (s === 'work_submitted' || s === 'under_review') return { label: 'In review', tone: 'info' };
  if (due !== null && due < 0) return { label: 'Over time', tone: 'bad' };
  if (startFuture) return { label: 'Upcoming', tone: 'warn' };
  return { label: 'Active', tone: 'info' };
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
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('active');
  // Land on the Requests tab once if there's a booking waiting on the creator — the
  // whole point of the "New booking request" notification is to not miss it. Only
  // fires on the first load that has requests; manual tab switches stick after that.
  const autoTabbed = useRef(false);

  useLiveEffect(() => {
    if (user?.approval_status && user.approval_status !== 'approved') { setLoading(false); return undefined; }
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/campaigns?t=${Date.now()}`);
      setCampaigns(res.data.filter((c) => isSelectedCreator(c, user.id)));
      setLoadError('');
    } catch (err) {
      // This runs every 10s: keep the last good list on screen and only flag an error banner.
      setLoadError(err?.response ? 'Could not load your active work.' : "You're offline. Check your connection and try again.");
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
      <div className="cui-o-page">
        <CreatorPageHead title="My Active Work" subtitle="Manage and track all your ongoing campaigns." />

        {loadError && campaigns.length > 0 && (
          <div className="cui-o-err" role="alert">{loadError} Showing the last loaded list.</div>
        )}

        <div className="cui-o-card" style={{ paddingBottom: 6 }}>
          <div className="cui-o-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`cui-o-tab ${tab === t.key ? 'is-on' : ''}`} onClick={() => setTab(t.key)}>
                {t.label} <span className="cui-o-count">{counts[t.key] || 0}</span>
              </button>
            ))}
          </div>

          {loadError && !campaigns.length && !loading ? (
            <EmptyState title="Could not load active work" message={loadError} action={{ label: 'Retry', onClick: () => { setLoading(true); fetchData(); } }} />
          ) : loading ? (
            <div aria-hidden="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div className="cui-o-skel" key={i}>
                  <Skeleton width={54} height={54} radius={12} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Skeleton width={110} height={12} />
                    <Skeleton width="55%" height={16} style={{ marginTop: 8 }} />
                  </div>
                  <Skeleton width={80} height={24} radius={999} />
                </div>
              ))}
            </div>
          ) : rows.length ? (
            <>
              <div className="cui-o-thead" aria-hidden="true"><span>ORDER</span><span>DUE</span><span>STATUS</span><span>PRICE</span><span /></div>
              {rows.map((c) => {
                const meta = statusMeta(c);
                const brand = String(c.brand_name || c.business_name || c.company_name || c.business_nickname || c.brand_handle || '').replace(/^@+/, '').trim() || 'Brand';
                const { bg, fg } = brandTile(brand);
                const cur = stageIndex(c);
                const steps = stagesFor(c);
                const dueDays = c.due_date ? Math.ceil((new Date(c.due_date) - Date.now()) / 86400000) : null;
                const open = () => navigate(`/my-deals?campaign=${c.id}`);
                return (
                  <div
                    key={c.id}
                    className="cui-o-row"
                    onClick={open}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } }}
                  >
                    <div className="cui-o-order">
                      <span className="cui-o-tile" style={{ width: 54, height: 54, background: c.brand_logo ? '#fff' : bg, color: fg, fontSize: 22 }}>
                        {c.brand_logo ? <img loading="lazy" src={c.brand_logo.startsWith('http') ? c.brand_logo : `${BACKEND_URL}${c.brand_logo}`} alt="" /> : getInitial(brand)}
                      </span>
                      <div>
                        <div className="cui-o-by">
                          <span className="cui-o-mini" style={{ background: fg }}>{getInitial(brand)}</span>
                          <span>{brand}</span>
                        </div>
                        <div className="cui-o-ttl" title={c.title}>{c.title || 'Campaign'}</div>
                      </div>
                    </div>
                    <div className="cui-o-due">
                      {dueDays !== null && c.status !== 'completed' && c.status !== 'cancelled'
                        ? <span className={`cui-o-pill ${dueDays < 0 ? 'bad' : dueDays <= 2 ? 'warn' : 'muted'}`}><Clock size={12} />{dueDays < 0 ? 'Overdue' : dueDays === 0 ? 'Due today' : `Due in ${dueDays} day${dueDays > 1 ? 's' : ''}`}</span>
                        : <span className="cui-o-dim">-</span>}
                    </div>
                    <div className="cui-o-st"><span className={`cui-o-pill ${meta.tone}`}>{meta.label}</span></div>
                    <div className="cui-o-price" title={isBookingRequest(c) ? "You'll be paid" : undefined}>{inr(c.budget_max || c.budget_min || 0)}</div>
                    <div className="cui-o-next">{isBookingRequest(c) ? (needsCreatorResponse(c) ? 'Respond to the request' : 'Waiting on the brand') : `Stage: ${steps.labels[cur]}`}</div>
                    <div className="cui-o-go">
                      {isBookingRequest(c) ? (
                        <button
                          type="button"
                          className={`cui-o-btn sm ${needsCreatorResponse(c) ? '' : 'soft'}`}
                          onClick={(e) => { e.stopPropagation(); open(); }}
                          data-testid={`respond-booking-${c.id}`}
                        >
                          {needsCreatorResponse(c) ? 'Respond to request' : 'View proposal'}
                        </button>
                      ) : needsRevision(c) ? (
                        /* The one place the creator can actually read the brand's notes
                           and re-upload. Without it, "Revision Requested" is a dead end. */
                        <button
                          type="button"
                          className="cui-o-btn sm soft"
                          onClick={(e) => { e.stopPropagation(); navigate(`/my-deals?campaign=${c.id}&tab=deliverables`); }}
                          data-testid={`see-revision-${c.id}`}
                        >
                          See what they asked for
                        </button>
                      ) : (
                        <button type="button" className="cui-o-btn sm soft" aria-label="Open campaign" onClick={(e) => { e.stopPropagation(); open(); }}>Open</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          ) : tab === 'requests' ? (
            <EmptyState title="No booking requests" message="When a brand books you directly, the request lands here to accept, decline, or propose your own price." action={{ label: 'Browse Campaigns', onClick: () => navigate('/browse-briefs') }} />
          ) : (
            <EmptyState title={`No work in “${TABS.find((t) => t.key === tab).label}”`} message="Once a brand selects your bid, your active deals will appear here to manage." action={{ label: 'Browse Campaigns', onClick: () => navigate('/browse-briefs') }} />
          )}
        </div>
      </div>
    </CreatorTopNavLayout>
  );
}
