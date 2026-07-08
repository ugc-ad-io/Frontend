import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import {
  Briefcase, Search, X, ArrowRight, MessageSquare, FileVideo, StickyNote, AlertTriangle,
  Clock3, Eye, Scale, IndianRupee, RotateCcw, Send, ExternalLink, Truck, Wallet, Users, FileText
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import CreatorProfileModal from '../components/CreatorProfileModal';
import BrandProfileModal from '../components/BrandProfileModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
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

// Who the deal is waiting on, by state. Used for the "Active Party" column.
const ACTIVE_PARTY = {
  'accepted - awaiting shipment': 'Brand',
  'shipped - in transit': 'In transit',
  'delivered - awaiting receipt confirmation': 'Creator',
  'received - content in progress': 'Creator',
  'content submitted - awaiting review': 'Brand',
  'revision requested': 'Creator',
  'approved - payment processing': 'Platform',
  'paid - complete': '—'
};

// Reason codes required alongside free-text justification for any forced transition.
const REASON_CODES = [
  { value: 'sla_breach', label: 'SLA breach' },
  { value: 'fraud_policy', label: 'Fraud / policy violation' },
  { value: 'dispute_resolution', label: 'Dispute resolution' },
  { value: 'support_request', label: 'Support request' },
  { value: 'manual_correction', label: 'Manual correction' },
  { value: 'other', label: 'Other' }
];

const normalizeDash = (v) => String(v || '').replace(/\s*(?:—|–|-)\s*/g, ' - ');
const stateKey = (v) => normalizeDash(v).toLowerCase();
const getId = (d) => d?.deal_id || d?.id;
const getState = (d) => normalizeDash(d?.current_state || d?.campaign_status || d?.campaign?.status || 'Status unavailable');
const getTitle = (d) => d?.campaign?.title || d?.title || 'Untitled campaign';
const getBrand = (d) => d?.brand?.handle || d?.campaign?.brand_handle || d?.campaign?.business_nickname || '—';
const getCreator = (d) => d?.creator?.handle || d?.creator?.nickname || d?.creator_nickname || '—';
const getBrandId = (d) => d?.business_id || d?.brand_id || d?.brand?.id || d?.business?.id;
const getCreatorId = (d) => d?.creator_id || d?.creator?.id || d?.creator?.user_id;
const getValue = (d) => Number(d?.amount ?? d?.deal_value ?? d?.campaign?.budget ?? 0);
const getActiveParty = (d) => d?.active_party || ACTIVE_PARTY[stateKey(getState(d))] || '—';
const getEscrow = (d) => Number(d?.escrow_amount ?? getValue(d));
const getCommissionRate = (d) => Number(d?.commission_rate ?? 0.2);
const getCommission = (d) => Number(d?.commission_amount ?? getEscrow(d) * getCommissionRate(d));
const getCreatorPayout = (d) => Number(d?.creator_payout ?? (getEscrow(d) - getCommission(d)));
const dealDate = (d) => String(d?.created_at || d?.accepted_at || d?.updated_at || '').slice(0, 10);

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : '');

// Known section titles that may appear in a flattened brief. Rendered as headings.
const BRIEF_HEADINGS = new Set([
  'deliverable', 'brief', 'deliverables', 'campaign basics', 'creative requirements',
  'creative restrictions', 'style guidance', 'usage rights', 'timeline & budget', 'review summary'
]);

// Render a brief string with visual hierarchy: section titles become headings and
// "Label: value" lines get a bold label, instead of one flat block of same-weight text.
const renderBrief = (text) => {
  const lines = String(text || '').split(/\r?\n/);
  return lines.map((line, i) => {
    const t = line.trim();
    if (!t) return <div key={i} className="adl-brief-gap" />;
    const bare = t.replace(/:$/, '').trim();
    const m = t.match(/^([A-Za-z][^:]{0,40}):\s*(.+)$/);
    if (BRIEF_HEADINGS.has(bare.toLowerCase()) || (/:$/.test(t) && !m)) {
      return <h4 key={i} className="adl-brief-h">{bare}</h4>;
    }
    if (m) return <p key={i} className="adl-brief-row"><strong>{m[1]}:</strong> {m[2]}</p>;
    return <p key={i} className="adl-brief-row">{t}</p>;
  });
};

const stateTone = (state) => {
  const k = stateKey(state);
  if (k.includes('disputed') || k.includes('damaged')) return 'danger';
  if (k.includes('revision')) return 'warn';
  if (k.includes('paid') || k.includes('complete')) return 'ok';
  if (k.includes('awaiting review') || k.includes('payment processing')) return 'info';
  return 'neutral';
};

// Derive the flag chips for a deal: dispute / damaged / flagged / SLA-breach + any backend flags.
const getFlags = (d) => {
  const f = [];
  const k = stateKey(getState(d));
  if (k.includes('disputed')) f.push({ label: 'Disputed', tone: 'danger' });
  if (k.includes('damaged')) f.push({ label: 'Damaged', tone: 'danger' });
  if (d?.flagged || d?.is_flagged) f.push({ label: 'Flagged', tone: 'warn' });
  const hrs = d?.deadline_countdown_hours;
  if (typeof hrs === 'number' && hrs <= 0) f.push({ label: 'SLA', tone: 'danger' });
  (Array.isArray(d?.flags) ? d.flags : []).forEach((x) => f.push({ label: String(x), tone: 'warn' }));
  return f;
};

export default function AdminDeals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selected, setSelected] = useState(null);
  const [profileView, setProfileView] = useState(null); // { type: 'brand'|'creator', id, name }
  const [noteDraft, setNoteDraft] = useState('');
  const [targetState, setTargetState] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [transitionReason, setTransitionReason] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [contactParty, setContactParty] = useState('both');
  const [contactMessage, setContactMessage] = useState('');
  const [working, setWorking] = useState(false);
  const [disputeDeal, setDisputeDeal] = useState(null);   // deal a dispute is being raised on
  const [disputeReason, setDisputeReason] = useState('');
  const [confirmBox, setConfirmBox] = useState(null);     // { title, message, confirmLabel, tone, icon, run }
  // When opened via "Intervene in chat", jump straight to the chat instead of
  // landing on the brief/description at the top of the drawer.
  const [focusChat, setFocusChat] = useState(false);
  const chatSectionRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => { fetchDeals(); }, []);

  // After the drawer opens for a chat intervention, scroll to the chat section
  // and focus the compose box.
  useEffect(() => {
    if (!selected || !focusChat) return;
    const t = setTimeout(() => {
      chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      chatInputRef.current?.focus();
      setFocusChat(false);
    }, 150);
    return () => clearTimeout(t);
  }, [selected, focusChat]);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/deals`);
      setDeals(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch {
      // endpoint may not exist yet — show an empty queue rather than crashing
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  const openDeal = async (deal, opts = {}) => {
    setSelected(deal);
    setNoteDraft(''); setTargetState(''); setReasonCode(''); setTransitionReason('');
    setChatDraft(''); setContactParty('both'); setContactMessage('');
    setFocusChat(!!opts.focusChat); // "Intervene in chat" jumps straight to the chat
    try {
      const res = await axios.get(`${API}/admin/deals/${getId(deal)}`);
      if (res.data) setSelected({ ...deal, ...res.data });
    } catch {
      /* fall back to the row data we already have */
    }
  };

  const handleForceTransition = async () => {
    if (!targetState) { toast.error('Pick a target state'); return; }
    if (!reasonCode) { toast.error('Select a reason code'); return; }
    if (!transitionReason.trim()) { toast.error('A written justification is required to force a transition'); return; }
    setWorking(true);
    try {
      await axios.post(`${API}/admin/deals/${getId(selected)}/force-transition`, {
        to_state: targetState,
        reason_code: reasonCode,
        reason: transitionReason.trim(),
        notify_parties: true
      });
      toast.success(`Deal moved to "${targetState}" · both parties notified`);
      setTransitionReason(''); setTargetState(''); setReasonCode('');
      fetchDeals();
      setSelected((s) => (s ? { ...s, current_state: targetState } : s));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to force transition'));
    } finally {
      setWorking(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteDraft.trim()) return;
    setWorking(true);
    try {
      await axios.post(`${API}/admin/deals/${getId(selected)}/notes`, { note: noteDraft.trim() });
      toast.success('Note added');
      const note = { note: noteDraft.trim(), created_at: new Date().toISOString(), author: 'You' };
      setSelected((s) => ({ ...s, admin_notes: [...(s?.admin_notes || []), note] }));
      setNoteDraft('');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to add note'));
    } finally {
      setWorking(false);
    }
  };

  // Run the pending confirm-box action, then close the card.
  const runConfirm = async () => {
    if (!confirmBox) return;
    const action = confirmBox.run;
    setConfirmBox(null);
    await action();
  };

  // ---- Elevated-privilege actions (logged + both parties notified) ----
  const releasePayment = (deal) => {
    setConfirmBox({
      title: 'Release payment',
      message: `Release escrow (${money(getEscrow(deal))}) to ${getCreator(deal)} now? This pays the creator immediately.`,
      confirmLabel: 'Release payment',
      tone: 'primary',
      icon: 'wallet',
      run: async () => {
        setWorking(true);
        try {
          await axios.post(`${API}/admin/deals/${getId(deal)}/release-payment`, {});
          toast.success('Payment released to creator');
          fetchDeals();
          setSelected((s) => (s && getId(s) === getId(deal) ? { ...s, current_state: 'Paid - Complete' } : s));
        } catch (e) {
          toast.error(apiErrorMessage(e, 'Failed to release payment'));
        } finally {
          setWorking(false);
        }
      },
    });
  };

  const refundBrand = (deal) => {
    setConfirmBox({
      title: 'Refund brand',
      message: `Refund the full escrow (${money(getEscrow(deal))}) to ${getBrand(deal)}? The deal will be closed.`,
      confirmLabel: 'Refund brand',
      tone: 'danger',
      icon: 'refund',
      run: async () => {
        setWorking(true);
        try {
          await axios.post(`${API}/admin/deals/${getId(deal)}/refund`, { amount: getEscrow(deal), reason: 'admin_refund' });
          toast.success('Escrow refunded to brand');
          fetchDeals();
        } catch (e) {
          toast.error(apiErrorMessage(e, 'Failed to refund'));
        } finally {
          setWorking(false);
        }
      },
    });
  };

  const raiseDispute = (deal) => {
    setDisputeReason('');
    setDisputeDeal(deal);
  };

  const submitDispute = async () => {
    if (!disputeReason.trim()) { toast.error('A reason is required'); return; }
    setWorking(true);
    try {
      await axios.post(`${API}/admin/deals/${getId(disputeDeal)}/raise-dispute`, { reason: disputeReason.trim() });
      toast.success('Dispute opened on behalf of the parties');
      setDisputeDeal(null);
      setDisputeReason('');
      fetchDeals();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to raise dispute'));
    } finally {
      setWorking(false);
    }
  };

  const handleIntervene = async () => {
    if (!chatDraft.trim()) return;
    setWorking(true);
    try {
      await axios.post(`${API}/admin/deals/${getId(selected)}/message`, { message: chatDraft.trim() });
      toast.success('Message posted to the deal room');
      const msg = { sender_nickname: 'Admin', message: chatDraft.trim(), timestamp: new Date().toISOString(), admin: true };
      setSelected((s) => ({ ...s, chat: [...(s?.chat || s?.messages || []), msg] }));
      setChatDraft('');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to send message'));
    } finally {
      setWorking(false);
    }
  };

  const handleContact = async () => {
    if (!contactMessage.trim()) return;
    setWorking(true);
    try {
      await axios.post(`${API}/admin/deals/${getId(selected)}/notify`, { party: contactParty, message: contactMessage.trim() });
      toast.success(`Notification sent to ${contactParty === 'both' ? 'both parties' : contactParty}`);
      setContactMessage('');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to send notification'));
    } finally {
      setWorking(false);
    }
  };

  const brandOptions = useMemo(
    () => Array.from(new Set(deals.map(getBrand).filter((b) => b && b !== '—'))).sort(),
    [deals]
  );
  const creatorOptions = useMemo(
    () => Array.from(new Set(deals.map(getCreator).filter((c) => c && c !== '—'))).sort(),
    [deals]
  );

  const matchesFlag = (d) => {
    if (flagFilter === 'all') return true;
    const k = stateKey(getState(d));
    const hrs = d?.deadline_countdown_hours;
    if (flagFilter === 'flagged') return getFlags(d).length > 0;
    if (flagFilter === 'disputed') return k.includes('disputed');
    if (flagFilter === 'damaged') return k.includes('damaged');
    if (flagFilter === 'sla') return typeof hrs === 'number' && hrs <= 0;
    return true;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((d) => {
      if (statusFilter !== 'all' && stateKey(getState(d)) !== stateKey(statusFilter)) return false;
      if (brandFilter !== 'all' && getBrand(d) !== brandFilter) return false;
      if (creatorFilter !== 'all' && getCreator(d) !== creatorFilter) return false;
      if (!matchesFlag(d)) return false;
      const dd = dealDate(d);
      if (dateFrom && dd && dd < dateFrom) return false;
      if (dateTo && dd && dd > dateTo) return false;
      if (!q) return true;
      return [getTitle(d), getBrand(d), getCreator(d), getId(d)].join(' ').toLowerCase().includes(q);
    });
  }, [deals, query, statusFilter, brandFilter, creatorFilter, flagFilter, dateFrom, dateTo]);

  const filtersActive = statusFilter !== 'all' || brandFilter !== 'all' || creatorFilter !== 'all' || flagFilter !== 'all' || dateFrom || dateTo || query;
  const clearFilters = () => {
    setQuery(''); setStatusFilter('all'); setBrandFilter('all'); setCreatorFilter('all');
    setFlagFilter('all'); setDateFrom(''); setDateTo('');
  };

  const counts = useMemo(() => ({
    total: deals.length,
    active: deals.filter((d) => !['paid - complete'].includes(stateKey(getState(d))) && !EXCEPTION_STATES.some((s) => stateKey(s) === stateKey(getState(d)))).length,
    review: deals.filter((d) => stateKey(getState(d)).includes('awaiting review')).length,
    dispute: deals.filter((d) => EXCEPTION_STATES.some((s) => stateKey(s) === stateKey(getState(d)))).length,
    complete: deals.filter((d) => stateKey(getState(d)).includes('paid') || stateKey(getState(d)).includes('complete')).length
  }), [deals]);

  const chat = selected?.chat || selected?.messages || [];
  const submissions = selected?.content_submission?.versions || selected?.content_versions || [];
  const notes = selected?.admin_notes || [];
  const timeline = selected?.transitions || selected?.timeline || selected?.state_history || [];
  const shipment = selected?.shipment || selected?.shipping;
  const brief = selected?.brief || selected?.campaign || {};
  const payoutSchedule = selected?.payout_schedule || (selected
    ? [{ label: 'On approval', amount: getCreatorPayout(selected), status: stateKey(getState(selected)).includes('paid') ? 'paid' : 'pending' }]
    : []);
  const brandId = selected ? getBrandId(selected) : null;
  const creatorId = selected ? getCreatorId(selected) : null;

  return (
    <AdminLayout>
      <div className="adl">
        <div className="adl-stats">
          {[
            ['Total deals', counts.total],
            ['Active', counts.active],
            ['Awaiting review', counts.review],
            ['In dispute', counts.dispute],
            ['Completed', counts.complete]
          ].map(([label, value]) => (
            <div key={label} className="adl-stat">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div className="adl-toolbar">
          <label className="adl-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by campaign, brand, creator or deal ID"
              data-testid="deals-search"
            />
          </label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="deals-status-filter">
            <option value="all">All states</option>
            {[...DEAL_STATES, ...EXCEPTION_STATES].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} data-testid="deals-brand-filter">
            <option value="all">All brands</option>
            {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={creatorFilter} onChange={(e) => setCreatorFilter(e.target.value)} data-testid="deals-creator-filter">
            <option value="all">All creators</option>
            {creatorOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={flagFilter} onChange={(e) => setFlagFilter(e.target.value)} data-testid="deals-flag-filter">
            <option value="all">All flags</option>
            <option value="flagged">Flagged</option>
            <option value="disputed">Disputed</option>
            <option value="damaged">Damaged</option>
            <option value="sla">SLA breached</option>
          </select>
          <label className="adl-date">From <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="deals-date-from" /></label>
          <label className="adl-date">To <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="deals-date-to" /></label>
          {filtersActive ? <button className="adl-clear" onClick={clearFilters}>Clear</button> : null}
        </div>

        <div className="adl-table-wrap">
          {loading ? (
            <div className="adl-empty">Loading deals…</div>
          ) : filtered.length === 0 ? (
            <div className="adl-empty">
              <Briefcase size={56} />
              <p>{deals.length === 0 ? 'No deals to show yet' : 'No deals match your filters'}</p>
              <span>{deals.length === 0 ? 'Active deals across the platform will appear here.' : 'Try clearing the search or filters.'}</span>
            </div>
          ) : (
            <table className="adl-table">
              <thead>
                <tr>
                  <th>Deal ID</th><th>Brand</th><th>Creator</th><th>Campaign</th><th>State</th>
                  <th>Active Party</th><th>Deadline</th><th>Escrow</th><th>Flags</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const hrs = d?.deadline_countdown_hours;
                  const slaTone = typeof hrs === 'number' ? (hrs <= 0 ? 'danger' : hrs <= 12 ? 'warn' : 'ok') : 'muted';
                  const flags = getFlags(d);
                  return (
                    <tr key={getId(d)} data-testid={`deal-row-${getId(d)}`}>
                      <td><span className="adl-id">#{String(getId(d) || '').toString().slice(0, 8)}</span></td>
                      <td>{getBrand(d)}</td>
                      <td>{getCreator(d)}</td>
                      <td className="adl-strong">{getTitle(d)}</td>
                      <td><span className={`adl-badge ${stateTone(getState(d))}`}>{getState(d)}</span></td>
                      <td className="adl-party-cell">{getActiveParty(d)}</td>
                      <td><span className={`adl-sla ${slaTone}`}>{typeof hrs === 'number' ? `${Math.max(0, Math.round(hrs))}h` : '—'}</span></td>
                      <td className="adl-strong">{money(getEscrow(d))}</td>
                      <td>
                        {flags.length === 0 ? <span className="adl-muted-inline">—</span> : (
                          <span className="adl-flags">{flags.map((f, i) => <span key={i} className={`adl-flag ${f.tone}`}>{f.label}</span>)}</span>
                        )}
                      </td>
                      <td>
                        <div className="adl-actions">
                          <button className="adl-qa" title="View deal" onClick={() => openDeal(d)} data-testid={`view-deal-${getId(d)}`}><Eye size={15} /></button>
                          <button className="adl-qa" title="Intervene in chat" onClick={() => openDeal(d, { focusChat: true })} data-testid={`chat-deal-${getId(d)}`}><MessageSquare size={15} /></button>
                          <button className="adl-qa danger" title="Raise dispute on behalf" disabled={working} onClick={() => raiseDispute(d)} data-testid={`dispute-deal-${getId(d)}`}><Scale size={15} /></button>
                          <button className="adl-qa ok" title="Release payment" disabled={working} onClick={() => releasePayment(d)} data-testid={`release-deal-${getId(d)}`}><IndianRupee size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <>
          <div className="adl-scrim" onClick={() => setSelected(null)} />
          <aside className="adl-drawer" data-testid="deal-drawer">
            <header className="adl-drawer-head">
              <div>
                <h2>{getTitle(selected)}</h2>
                <p>{getBrand(selected)} ↔ {getCreator(selected)} · Deal #{String(getId(selected) || '').slice(0, 8)}</p>
                <div className="adl-facts">
                  <span><b>State:</b> {getState(selected)}</span>
                  <span><b>Active:</b> {getActiveParty(selected)}</span>
                  <span><b>Escrow:</b> {money(getEscrow(selected))}</span>
                </div>
              </div>
              <button className="adl-icon" onClick={() => setSelected(null)} aria-label="Close"><X size={18} /></button>
            </header>

            <div className="adl-drawer-body">
              <section className="adl-block">
                <h3><FileText size={15} /> Brief summary</h3>
                <p className="adl-brief-title">{brief.title || getTitle(selected)}</p>
                <div className="adl-brief-text">
                  {(() => {
                    const text = brief.brief_text || brief.description || selected?.brief_text || selected?.description;
                    return text ? renderBrief(text) : <p className="adl-brief-row">No brief text provided.</p>;
                  })()}
                </div>
                <div className="adl-brief-meta">
                  {(brief.per_video_budget != null || brief.budget_max != null) && <span>Budget: <b>{money(brief.per_video_budget ?? brief.budget_max)}</b></span>}
                  {(brief.deliverables_count ?? brief.num_videos) != null && <span>Deliverables: <b>{brief.deliverables_count ?? brief.num_videos}</b></span>}
                  {brief.platform && <span>Platform: <b>{brief.platform}</b></span>}
                </div>
              </section>

              <section className="adl-block">
                <h3><Users size={15} /> Parties</h3>
                <div className="adl-parties">
                  {brandId ? (
                    <button type="button" className="adl-party" onClick={() => setProfileView({ type: 'brand', id: brandId, name: getBrand(selected) })}>
                      <span>Brand</span><strong>{getBrand(selected)}</strong><ExternalLink size={13} />
                    </button>
                  ) : (
                    <div className="adl-party adl-party-static"><span>Brand</span><strong>{getBrand(selected)}</strong></div>
                  )}
                  {creatorId ? (
                    <button type="button" className="adl-party" onClick={() => setProfileView({ type: 'creator', id: creatorId, name: getCreator(selected) })}>
                      <span>Creator</span><strong>{getCreator(selected)}</strong><ExternalLink size={13} />
                    </button>
                  ) : (
                    <div className="adl-party adl-party-static"><span>Creator</span><strong>{getCreator(selected)}</strong></div>
                  )}
                </div>
              </section>

              <section className="adl-block">
                <h3>State machine</h3>
                <ol className="adl-steps">
                  {DEAL_STATES.map((s) => {
                    const cur = DEAL_STATES.findIndex((x) => stateKey(x) === stateKey(getState(selected)));
                    const idx = DEAL_STATES.findIndex((x) => stateKey(x) === stateKey(s));
                    const cls = idx < cur ? 'done' : idx === cur ? 'current' : '';
                    return <li key={s} className={cls}><span /> {s}</li>;
                  })}
                </ol>
                {EXCEPTION_STATES.some((s) => stateKey(s) === stateKey(getState(selected))) && (
                  <p className="adl-exception"><AlertTriangle size={14} /> Currently in exception state: {getState(selected)}</p>
                )}
                <h4 className="adl-sub">Transition history</h4>
                {timeline.length === 0 ? (
                  <p className="adl-muted">No recorded transitions.</p>
                ) : (
                  <ul className="adl-timeline">
                    {timeline.map((t, i) => (
                      <li key={i}>
                        <span className="adl-tl-time">{fmtDateTime(t.timestamp || t.created_at || t.at)}</span>
                        <b>{normalizeDash(t.to_state || t.state || t.event || t.event_type || '—')}</b>
                        {(t.reason || t.note) && <em> {t.reason || t.note}</em>}
                        <small>by {t.actor_name || t.actor || t.actor_type || 'system'}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="adl-block">
                <h3><Wallet size={15} /> Financial breakdown</h3>
                <div className="adl-fin">
                  <div><span>Escrow held</span><strong>{money(getEscrow(selected))}</strong></div>
                  <div><span>Platform commission ({Math.round(getCommissionRate(selected) * 100)}%)</span><strong>{money(getCommission(selected))}</strong></div>
                  <div><span>Creator payout</span><strong>{money(getCreatorPayout(selected))}</strong></div>
                </div>
                <h4 className="adl-sub">Payout schedule</h4>
                {payoutSchedule.length === 0 ? (
                  <p className="adl-muted">No payout milestones.</p>
                ) : (
                  <ul className="adl-sched">
                    {payoutSchedule.map((p, i) => (
                      <li key={i}>
                        <span>{p.label || `Milestone ${i + 1}`}{p.date ? ` · ${fmtDate(p.date)}` : ''}</span>
                        <b>{money(p.amount)}</b>
                        <em className={`adl-pill ${p.status === 'paid' ? 'ok' : 'neutral'}`}>{p.status || 'pending'}</em>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="adl-block">
                <h3><Truck size={15} /> Shipping &amp; tracking</h3>
                {shipment ? (
                  <div className="adl-ship">
                    <div><span>Tracking #</span><strong>{shipment.tracking_number || '—'}</strong></div>
                    <div><span>Courier</span><strong>{shipment.courier_name || shipment.courier || '—'}</strong></div>
                    <div><span>Status</span><strong>{shipment.courier_status || shipment.status || '—'}</strong></div>
                    <div><span>Shipped</span><strong>{fmtDate(shipment.shipped_at)}</strong></div>
                    <div><span>Delivered</span><strong>{fmtDate(shipment.delivered_at)}</strong></div>
                    <div><span>Received</span><strong>{fmtDate(shipment.received_at)}</strong></div>
                    {shipment.address && <div className="adl-ship-addr"><span>Ship to</span><strong>{shipment.address}</strong></div>}
                  </div>
                ) : <p className="adl-muted">No shipment recorded for this deal.</p>}
              </section>

              <section className="adl-block">
                <h3><FileVideo size={15} /> Content submissions <em>{submissions.length}</em></h3>
                {submissions.length === 0 ? (
                  <p className="adl-muted">No content submitted yet.</p>
                ) : (
                  <ul className="adl-subs">
                    {submissions.map((v, i) => (
                      <li key={i}>
                        <span>v{v.version || i + 1} · {v.status || 'submitted'}</span>
                        {v.video_url && <a href={v.video_url} target="_blank" rel="noreferrer">Open video</a>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="adl-block" ref={chatSectionRef}>
                <h3><MessageSquare size={15} /> Chat transcript</h3>
                {chat.length === 0 ? (
                  <p className="adl-muted">No messages in this deal room.</p>
                ) : (
                  <div className="adl-chat">
                    {chat.map((m, i) => (
                      <div key={i} className={`adl-msg ${m.admin ? 'admin' : ''}`}>
                        <div className="adl-msg-head">
                          <strong>{m.sender_nickname || m.sender || m.from || 'User'}</strong>
                          <span><Clock3 size={11} /> {m.timestamp ? new Date(m.timestamp).toLocaleString() : ''}</span>
                        </div>
                        <p>{m.message || m.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="adl-chat-compose">
                  <textarea
                    ref={chatInputRef}
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    placeholder="Intervene — post an admin message in the deal room…"
                    rows={2}
                    data-testid="intervene-draft"
                  />
                  <button className="adl-secondary" disabled={working || !chatDraft.trim()} onClick={handleIntervene} data-testid="intervene-send">
                    <Send size={14} /> Send to deal room
                  </button>
                </div>
              </section>

              <section className="adl-block">
                <h3>Force transition</h3>
                <p className="adl-hint">Overrides the normal flow. Requires a reason code + justification; logged as an elevated-privilege action and both parties are notified.</p>
                <select value={targetState} onChange={(e) => setTargetState(e.target.value)} data-testid="force-target">
                  <option value="">Select target state…</option>
                  {[...DEAL_STATES, ...EXCEPTION_STATES].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} data-testid="force-reason-code">
                  <option value="">Select reason code…</option>
                  {REASON_CODES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <textarea
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  placeholder="Written justification (required)…"
                  rows={3}
                  data-testid="force-reason"
                />
                <button className="adl-primary" disabled={working} onClick={handleForceTransition} data-testid="force-submit">
                  <ArrowRight size={16} /> Apply transition
                </button>
              </section>

              <section className="adl-block">
                <h3>Admin actions</h3>
                <p className="adl-hint">Elevated-privilege actions. Logged to the audit trail; both parties are notified.</p>
                <div className="adl-action-row">
                  <button className="adl-primary" disabled={working} onClick={() => releasePayment(selected)} data-testid="drawer-release"><IndianRupee size={15} /> Release payment</button>
                  <button className="adl-danger" disabled={working} onClick={() => refundBrand(selected)} data-testid="drawer-refund"><RotateCcw size={15} /> Refund brand</button>
                  <button className="adl-warn-btn" disabled={working} onClick={() => raiseDispute(selected)} data-testid="drawer-dispute"><Scale size={15} /> Raise dispute</button>
                </div>
                <h4 className="adl-sub">Contact parties</h4>
                <select value={contactParty} onChange={(e) => setContactParty(e.target.value)} data-testid="contact-party">
                  <option value="both">Both parties</option>
                  <option value="brand">Brand only</option>
                  <option value="creator">Creator only</option>
                </select>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Message to the selected party…"
                  rows={2}
                  data-testid="contact-message"
                />
                <button className="adl-secondary" disabled={working || !contactMessage.trim()} onClick={handleContact} data-testid="contact-send">
                  <Send size={14} /> Send notification
                </button>
              </section>

              <section className="adl-block">
                <h3><StickyNote size={15} /> Admin notes</h3>
                {notes.length > 0 && (
                  <ul className="adl-notes">
                    {notes.map((n, i) => (
                      <li key={i}>
                        <p>{n.note || n.text}</p>
                        <small>{n.author || 'Admin'} · {n.created_at ? new Date(n.created_at).toLocaleString() : ''}</small>
                      </li>
                    ))}
                  </ul>
                )}
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Add an internal note…"
                  rows={2}
                  data-testid="note-draft"
                />
                <button className="adl-secondary" disabled={working || !noteDraft.trim()} onClick={handleSaveNote} data-testid="note-save">
                  Save note
                </button>
              </section>
            </div>
          </aside>
        </>
      )}

      {disputeDeal && (
        <div className="adl-scrim" onClick={() => !working && setDisputeDeal(null)}>
          <div className="adl-dispute" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} data-testid="dispute-modal">
            <header className="adl-dispute-head">
              <div className="adl-dispute-title"><span className="adl-dispute-ic"><Scale size={18} /></span> Raise a dispute</div>
              <button className="adl-icon" onClick={() => setDisputeDeal(null)} disabled={working} aria-label="Close"><X size={18} /></button>
            </header>
            <p className="adl-dispute-sub">
              Opening a dispute on behalf of both parties for <strong>{getBrand(disputeDeal)}</strong> ↔ <strong>{getCreator(disputeDeal)}</strong>. Describe the issue below.
            </p>
            <textarea
              className="adl-dispute-input"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Describe the issue (e.g. product not delivered, content not as briefed)…"
              rows={4}
              autoFocus
              data-testid="dispute-reason"
            />
            <div className="adl-dispute-actions">
              <button className="adl-secondary" onClick={() => setDisputeDeal(null)} disabled={working}>Cancel</button>
              <button className="adl-warn-btn" onClick={submitDispute} disabled={working || !disputeReason.trim()} data-testid="dispute-submit">
                <Scale size={15} /> {working ? 'Opening…' : 'Open dispute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBox && (
        <div className="adl-scrim" onClick={() => !working && setConfirmBox(null)}>
          <div className={`adl-dispute adl-confirm--${confirmBox.tone}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} data-testid="confirm-modal">
            <header className="adl-dispute-head">
              <div className="adl-dispute-title">
                <span className={`adl-dispute-ic adl-ic--${confirmBox.tone}`}>
                  {confirmBox.icon === 'refund' ? <RotateCcw size={18} /> : <Wallet size={18} />}
                </span> {confirmBox.title}
              </div>
              <button className="adl-icon" onClick={() => setConfirmBox(null)} disabled={working} aria-label="Close"><X size={18} /></button>
            </header>
            <p className="adl-dispute-sub">{confirmBox.message}</p>
            <div className="adl-dispute-actions">
              <button className="adl-secondary" onClick={() => setConfirmBox(null)} disabled={working}>Cancel</button>
              <button className={confirmBox.tone === 'danger' ? 'adl-danger' : 'adl-primary'} onClick={runConfirm} disabled={working} data-testid="confirm-submit">
                {working ? 'Working…' : confirmBox.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .adl { padding: 24px 28px; max-width: 1480px; margin: 0 auto; }
        .adl-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
        .adl-stat { background: #fff; border: 1px solid #e6e8ec; border-radius: 12px; padding: 14px 16px; }
        .adl-stat span { display: block; font-size: 0.72rem; color: #98a1ad; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
        .adl-stat strong { font-size: 1.6rem; color: #07074e; }
        .adl-toolbar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: stretch; }
        .adl-search { flex: 1; min-width: 220px; display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e6e8ec; border-radius: 10px; padding: 0 12px; color: #98a1ad; }
        .adl-search input { flex: 1; border: 0; outline: 0; padding: 11px 0; font-size: 0.9rem; color: #111827; background: transparent; }
        .adl-toolbar select { border: 1px solid #e6e8ec; border-radius: 10px; padding: 0 12px; font-size: 0.84rem; color: #111827; background: #fff; cursor: pointer; }
        .adl-date { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #5b6573; background: #fff; border: 1px solid #e6e8ec; border-radius: 10px; padding: 0 10px; }
        .adl-date input { border: 0; outline: 0; padding: 9px 0; font-size: 0.8rem; color: #111827; background: transparent; }
        .adl-clear { border: 1px solid #e6e8ec; background: #fff; border-radius: 10px; padding: 0 14px; font-size: 0.82rem; color: #5b6573; cursor: pointer; }
        .adl-clear:hover { background: #f9fafb; }
        .adl-table-wrap { background: #fff; border: 1px solid #e6e8ec; border-radius: 14px; overflow-x: auto; }
        .adl-table { width: 100%; border-collapse: collapse; }
        .adl-table th, .adl-table td { padding: 13px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 0.86rem; white-space: nowrap; }
        .adl-table th { background: #f9fafb; font-size: 0.7rem; font-weight: 700; color: #5b6573; text-transform: uppercase; letter-spacing: 0.04em; }
        .adl-table tbody tr:last-child td { border-bottom: 0; }
        .adl-table tbody tr:hover { background: #f9fafb; }
        .adl-strong { font-weight: 600; color: #111827; }
        .adl-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; color: #5b6bff; font-weight: 700; }
        .adl-party-cell { color: #5b6573; }
        .adl-muted-inline { color: #cbd2dc; }
        .adl-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 600; }
        .adl-badge.ok { background: #ecfdf3; color: #067647; }
        .adl-badge.warn { background: #fffaeb; color: #b54708; }
        .adl-badge.danger { background: #fef3f2; color: #b42318; }
        .adl-badge.info { background: #eff8ff; color: #175cd3; }
        .adl-badge.neutral { background: #f2f4f7; color: #475467; }
        .adl-flags { display: flex; flex-wrap: wrap; gap: 4px; }
        .adl-flag { padding: 2px 8px; border-radius: 999px; font-size: 0.66rem; font-weight: 700; }
        .adl-flag.danger { background: #fef3f2; color: #b42318; }
        .adl-flag.warn { background: #fffaeb; color: #b54708; }
        .adl-sla { font-weight: 700; font-size: 0.82rem; }
        .adl-sla.ok { color: #067647; } .adl-sla.warn { color: #b54708; } .adl-sla.danger { color: #b42318; } .adl-sla.muted { color: #98a1ad; }
        .adl-actions { display: flex; gap: 4px; }
        .adl-qa { border: 1px solid #e6e8ec; background: #fff; border-radius: 8px; padding: 6px; cursor: pointer; color: #5b6573; display: inline-flex; }
        .adl-qa:hover:not(:disabled) { background: #f4f5ff; color: #5b6bff; border-color: #5b6bff; }
        .adl-qa.danger:hover:not(:disabled) { color: #b42318; border-color: #f3aaa3; background: #fff5f4; }
        .adl-qa.ok:hover:not(:disabled) { color: #067647; border-color: #9fe0bb; background: #f3fdf7; }
        .adl-qa:disabled { opacity: 0.5; cursor: not-allowed; }
        .adl-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 70px 24px; color: #5b6573; text-align: center; }
        .adl-empty svg { color: #d4d8df; }
        .adl-empty p { margin: 0; font-weight: 600; color: #111827; }
        .adl-empty span { font-size: 0.85rem; color: #98a1ad; }

        .adl-scrim { position: fixed; inset: 0; background: rgba(16,24,40,0.4); z-index: 40; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .adl-dispute { width: 460px; max-width: 100%; background: #fff; border-radius: 16px; box-shadow: 0 24px 60px rgba(16,24,40,0.28); z-index: 60; padding: 22px; display: flex; flex-direction: column; gap: 14px; animation: adlPop 140ms ease-out; }
        @keyframes adlPop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
        .adl-dispute-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .adl-dispute-title { display: flex; align-items: center; gap: 10px; font-size: 1.05rem; font-weight: 700; color: #07074e; }
        .adl-dispute-ic { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: #fffaf0; color: #b54708; border: 1px solid #fdd9a8; }
        .adl-ic--primary { background: #eef0ff; color: #3730a3; border-color: #d6dbff; }
        .adl-ic--danger { background: #fff5f4; color: #b42318; border-color: #f3aaa3; }
        .adl-dispute-sub { margin: 0; font-size: 0.86rem; line-height: 1.5; color: #5b6573; }
        .adl-dispute-sub strong { color: #111827; }
        .adl-dispute-input { width: 100%; border: 1px solid #e6e8ec; border-radius: 10px; padding: 11px 12px; font-size: 0.9rem; color: #111827; font-family: inherit; resize: vertical; outline: 0; }
        .adl-dispute-input:focus { border-color: #b54708; box-shadow: 0 0 0 3px rgba(181,71,8,0.12); }
        .adl-dispute-actions { display: flex; justify-content: flex-end; gap: 10px; }
        .adl-drawer { position: fixed; top: 0; right: 0; height: 100vh; width: 540px; max-width: 94vw; background: #f6f7f9; box-shadow: -12px 0 40px rgba(16,24,40,0.18); z-index: 50; display: flex; flex-direction: column; }
        .adl-drawer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px; background: #fff; border-bottom: 1px solid #e6e8ec; }
        .adl-drawer-head h2 { margin: 0 0 4px; font-size: 1.05rem; font-weight: 700; color: #07074e; }
        .adl-drawer-head p { margin: 0; font-size: 0.8rem; color: #5b6573; }
        .adl-facts { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; }
        .adl-facts span { font-size: 0.74rem; color: #5b6573; }
        .adl-facts b { color: #111827; }
        .adl-icon { border: 1px solid #e6e8ec; background: #fff; border-radius: 8px; padding: 6px; cursor: pointer; color: #5b6573; }
        .adl-icon:hover { background: #f9fafb; }
        .adl-drawer-body { flex: 1; overflow-y: auto; padding: 18px 22px; display: flex; flex-direction: column; gap: 16px; }
        .adl-block { background: #fff; border: 1px solid #e6e8ec; border-radius: 12px; padding: 16px; }
        .adl-block h3 { display: flex; align-items: center; gap: 7px; margin: 0 0 10px; font-size: 0.9rem; font-weight: 700; color: #111827; }
        .adl-block h3 em { margin-left: auto; font-style: normal; font-size: 0.75rem; font-weight: 600; color: #98a1ad; }
        .adl-sub { margin: 14px 0 8px; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: #98a1ad; font-weight: 700; }
        .adl-hint, .adl-muted { font-size: 0.82rem; color: #98a1ad; margin: 0 0 10px; }
        .adl-muted { margin: 0; }
        .adl-block select, .adl-block textarea { width: 100%; border: 1px solid #e6e8ec; border-radius: 8px; padding: 9px 12px; font-size: 0.85rem; color: #111827; margin-bottom: 10px; font-family: inherit; box-sizing: border-box; }
        .adl-block select:focus, .adl-block textarea:focus { outline: none; border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,0.16); }
        .adl-primary, .adl-secondary, .adl-danger, .adl-warn-btn { display: inline-flex; align-items: center; gap: 7px; border-radius: 8px; font-weight: 600; font-size: 0.85rem; padding: 9px 14px; cursor: pointer; border: 1px solid transparent; }
        .adl-primary { background: linear-gradient(100deg,#12124f,#07074e); color: #fff; box-shadow: 0 12px 26px -12px rgba(7,7,78,.7); }
        .adl-primary:hover:not(:disabled) { transform: translateY(-1px); }
        .adl-primary:disabled, .adl-secondary:disabled, .adl-danger:disabled, .adl-warn-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
        .adl-secondary { background: #fff; border-color: #e6e8ec; color: #111827; }
        .adl-secondary:hover:not(:disabled) { background: #f9fafb; }
        .adl-danger { background: #fff5f4; border-color: #f3aaa3; color: #b42318; }
        .adl-danger:hover:not(:disabled) { background: #fee4e2; }
        .adl-warn-btn { background: #fffaf0; border-color: #fdd9a8; color: #b54708; }
        .adl-warn-btn:hover:not(:disabled) { background: #fef0d8; }
        .adl-action-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
        .adl-steps { list-style: none; margin: 0; padding: 0; }
        .adl-steps li { display: flex; align-items: center; gap: 10px; padding: 5px 0; font-size: 0.83rem; color: #98a1ad; }
        .adl-steps li span { width: 12px; height: 12px; border-radius: 50%; border: 2px solid #d4d8df; flex: 0 0 auto; }
        .adl-steps li.done { color: #5b6573; } .adl-steps li.done span { background: #5b6bff; border-color: #5b6bff; }
        .adl-steps li.current { color: #07074e; font-weight: 700; } .adl-steps li.current span { border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,0.18); }
        .adl-exception { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; font-size: 0.8rem; color: #b42318; font-weight: 600; }
        .adl-timeline { list-style: none; margin: 0; padding: 0; }
        .adl-timeline li { padding: 8px 0 8px 14px; border-left: 2px solid #e6e8ec; position: relative; }
        .adl-timeline li:before { content: ''; position: absolute; left: -5px; top: 12px; width: 8px; height: 8px; border-radius: 50%; background: #5b6bff; }
        .adl-tl-time { font-size: 0.72rem; color: #98a1ad; }
        .adl-timeline b { display: block; font-size: 0.83rem; color: #111827; }
        .adl-timeline em { font-style: normal; color: #5b6573; font-size: 0.8rem; }
        .adl-timeline small { display: block; font-size: 0.72rem; color: #98a1ad; margin-top: 2px; }
        .adl-fin { display: grid; gap: 8px; }
        .adl-fin > div { display: flex; justify-content: space-between; font-size: 0.84rem; color: #5b6573; }
        .adl-fin strong { color: #111827; }
        .adl-sched { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .adl-sched li { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: #5b6573; }
        .adl-sched li b { margin-left: auto; color: #111827; }
        .adl-pill { padding: 2px 8px; border-radius: 999px; font-size: 0.66rem; font-weight: 700; text-transform: capitalize; }
        .adl-pill.ok { background: #ecfdf3; color: #067647; }
        .adl-pill.neutral { background: #f2f4f7; color: #475467; }
        .adl-ship { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
        .adl-ship > div { display: flex; flex-direction: column; }
        .adl-ship span { font-size: 0.7rem; color: #98a1ad; text-transform: uppercase; letter-spacing: 0.03em; }
        .adl-ship strong { font-size: 0.85rem; color: #111827; }
        .adl-ship-addr { grid-column: 1 / -1; }
        .adl-brief-title { margin: 0 0 10px; font-weight: 700; color: #111827; font-size: 0.95rem; }
        .adl-brief-text { margin: 0 0 10px; font-size: 0.83rem; color: #5b6573; }
        .adl-brief-text .adl-brief-h { margin: 12px 0 4px; font-size: 0.8rem; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.03em; }
        .adl-brief-text .adl-brief-h:first-child { margin-top: 0; }
        .adl-brief-text .adl-brief-row { margin: 0 0 4px; line-height: 1.5; color: #5b6573; }
        .adl-brief-text .adl-brief-row strong { color: #111827; font-weight: 600; }
        .adl-brief-text .adl-brief-gap { height: 8px; }
        .adl-brief-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.8rem; color: #5b6573; }
        .adl-brief-meta b { color: #111827; }
        .adl-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .adl-party { display: flex; flex-direction: column; gap: 2px; border: 1px solid #e6e8ec; border-radius: 10px; padding: 10px 12px; text-decoration: none; position: relative; background: #fff; text-align: left; font: inherit; width: 100%; cursor: pointer; }
        button.adl-party:hover { cursor: pointer; }
        .adl-party:hover { border-color: #5b6bff; background: #f4f5ff; }
        .adl-party-static:hover { border-color: #e6e8ec; background: #fff; }
        .adl-party span { font-size: 0.7rem; color: #98a1ad; text-transform: uppercase; }
        .adl-party strong { color: #111827; font-size: 0.86rem; }
        .adl-party > svg { position: absolute; top: 10px; right: 10px; color: #98a1ad; }
        .adl-subs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .adl-subs li { display: flex; justify-content: space-between; gap: 10px; font-size: 0.82rem; color: #5b6573; }
        .adl-subs a { color: #5b6bff; font-weight: 600; text-decoration: none; }
        .adl-chat { display: flex; flex-direction: column; gap: 10px; max-height: 240px; overflow-y: auto; }
        .adl-msg { background: #f9fafb; border: 1px solid #f1f5f9; border-radius: 8px; padding: 9px 11px; }
        .adl-msg.admin { background: #f4f5ff; border-color: #e0e3ff; }
        .adl-msg-head { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
        .adl-msg-head strong { font-size: 0.78rem; color: #111827; }
        .adl-msg-head span { display: inline-flex; align-items: center; gap: 3px; font-size: 0.7rem; color: #98a1ad; }
        .adl-msg p { margin: 0; font-size: 0.82rem; color: #5b6573; }
        .adl-chat-compose { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
        .adl-chat-compose textarea { margin-bottom: 0; }
        .adl-notes { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .adl-notes li { background: #fffaeb; border: 1px solid #fef0c7; border-radius: 8px; padding: 9px 11px; }
        .adl-notes p { margin: 0 0 3px; font-size: 0.82rem; color: #111827; }
        .adl-notes small { font-size: 0.7rem; color: #b54708; }
        @media (max-width: 720px) { .adl { padding: 18px; } .adl-ship, .adl-parties { grid-template-columns: 1fr; } }
      `}</style>

      {profileView && profileView.type === 'brand' && (
        <BrandProfileModal
          id={profileView.id}
          fallbackName={profileView.name}
          onClose={() => setProfileView(null)}
        />
      )}
      {profileView && profileView.type === 'creator' && (
        <CreatorProfileModal
          id={profileView.id}
          fallbackName={profileView.name}
          onClose={() => setProfileView(null)}
        />
      )}
    </AdminLayout>
  );
}
