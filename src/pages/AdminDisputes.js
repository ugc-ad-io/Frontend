import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { AlertTriangle, Clock, Scale, X, FileText, MessageSquare, Package, Image as ImageIcon, History, Paperclip, Save, UserCheck, ShieldCheck, Gavel } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { useAuth } from '../App';
import { DISPUTE_CAP, ROLE_LABELS, normalizeRole } from '../utils/adminRoles';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const RULING_OPTIONS = [
  { value: 'favor_creator', label: 'Favor Creator', hint: 'Release escrow to the creator' },
  { value: 'favor_brand', label: 'Favor Brand', hint: 'Refund escrow to the brand' },
  { value: 'split', label: 'Split', hint: 'Divide escrow between both parties' },
  { value: 'no_fault', label: 'No Fault', hint: 'Platform absorbs; creator still paid' },
];

const STATUS_FILTERS = ['', 'open', 'info_requested', 'appealed', 'resolved', 'closed'];
const SEVERITY_FILTERS = ['', 'low', 'normal', 'high', 'critical'];
const TYPE_FILTERS = ['', 'general', 'damaged_product', 'not_received', 'quality', 'payment'];
// spec 11.8 — rulings settling more than this require a second admin's peer review
const PEER_REVIEW_THRESHOLD = 50000;

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const shortId = (v) => (v ? String(v).slice(0, 8) : '—');

function ageLabel(createdAt) {
  if (!createdAt) return '—';
  const ms = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(ms)) return '—';
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function slaClass(d) {
  if (['resolved', 'closed'].includes(d.status)) return 'sla-done';
  if (d.sla_breached) return 'sla-red';
  if (typeof d.sla_hours_remaining === 'number' && d.sla_hours_remaining <= 4) return 'sla-orange';
  return 'sla-green';
}

const mediaUrl = (u) => (!u ? '' : String(u).startsWith('http') ? u : `${BACKEND_URL}${u}`);

export default function AdminDisputes() {
  const { user: me } = useAuth();
  // Per-role dispute resolution ceiling (PRD 11): Ops Regular ₹25K, Ops Senior ₹1L, Founder ∞.
  const myRole = normalizeRole(me?.admin_role);
  const myDisputeCap = DISPUTE_CAP[myRole];

  const [disputes, setDisputes] = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null); // full detail
  const [detailLoading, setDetailLoading] = useState(false);
  const [evidenceTab, setEvidenceTab] = useState('brief');
  const [busy, setBusy] = useState(false);

  const [ruling, setRuling] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [creatorAmount, setCreatorAmount] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [extensionDays, setExtensionDays] = useState('');
  const [infoParty, setInfoParty] = useState('creator');
  const [infoMessage, setInfoMessage] = useState('');

  // spec 11.8 additions ------------------------------------------------------
  const [view, setView] = useState('disputes'); // 'disputes' | 'appeals'
  const [appeals, setAppeals] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [noteToCreator, setNoteToCreator] = useState('');
  const [noteToBrand, setNoteToBrand] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [penaltyParty, setPenaltyParty] = useState('creator');
  const [savingDraft, setSavingDraft] = useState(false);
  const [peerReviewState, setPeerReviewState] = useState(null); // null | 'requested' | 'approved'

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const res = await axios.get(`${API}/admin/disputes`, { params });
      setDisputes(res.data?.disputes || []);
      setOpenCount(res.data?.open_count || 0);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to load disputes'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const openDispute = async (id) => {
    setDetailLoading(true);
    setEvidenceTab('brief');
    setRuling(''); setRefundAmount(''); setCreatorAmount(''); setReasoning(''); setExtensionDays('');
    setInfoParty('creator'); setInfoMessage('');
    setNoteToCreator(''); setNoteToBrand(''); setPenaltyAmount(''); setPenaltyParty('creator');
    setPeerReviewState(null);
    try {
      const res = await axios.get(`${API}/admin/disputes/${id}`);
      setSelected(res.data);
      setPeerReviewState(res.data?.dispute?.peer_review_status || null);
      // spec 11.8 — restore a previously saved ruling draft so admins can resume
      const draft = res.data?.ruling_draft;
      if (draft) {
        setRuling(draft.ruling || '');
        setRefundAmount(draft.refund_amount ? String(draft.refund_amount) : '');
        setCreatorAmount(draft.creator_amount ? String(draft.creator_amount) : '');
        setReasoning(draft.reasoning || '');
        setExtensionDays(draft.extension_days ? String(draft.extension_days) : '');
        setNoteToCreator(draft.note_to_creator || '');
        setNoteToBrand(draft.note_to_brand || '');
        setPenaltyAmount(draft.penalty_amount ? String(draft.penalty_amount) : '');
        setPenaltyParty(draft.penalty_party || 'creator');
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to load dispute'));
    } finally {
      setDetailLoading(false);
    }
  };

  const submitRuling = async () => {
    if (!ruling) return toast.error('Select a ruling outcome');
    if (!reasoning.trim()) return toast.error('Reasoning is required (logged + sent to both parties)');
    setBusy(true);
    try {
      await axios.post(`${API}/admin/disputes/${selected.dispute.id}/rule`, {
        ruling,
        refund_amount: Number(refundAmount || 0),
        creator_amount: Number(creatorAmount || 0),
        reasoning,
        extension_days: Number(extensionDays || 0),
        note_to_creator: noteToCreator,
        note_to_brand: noteToBrand,
        penalty_amount: Number(penaltyAmount || 0),
        penalty_party: penaltyParty,
      });
      toast.success('Ruling recorded and funds settled');
      setSelected(null);
      fetchDisputes();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to record ruling'));
    } finally {
      setBusy(false);
    }
  };

  const requestInfo = async () => {
    if (!infoMessage.trim()) return toast.error('Add a message describing what you need');
    setBusy(true);
    try {
      await axios.post(`${API}/admin/disputes/${selected.dispute.id}/request-info`, {
        party: infoParty,
        message: infoMessage,
      });
      toast.success(`Info requested from ${infoParty} (72h window)`);
      setSelected(null);
      fetchDisputes();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to request info'));
    } finally {
      setBusy(false);
    }
  };

  // spec 11.8 — save the ruling builder so an admin can resume a complex dispute later
  const saveDraft = async () => {
    if (!selected?.dispute?.id) return;
    setSavingDraft(true);
    try {
      await axios.post(`${API}/admin/disputes/${selected.dispute.id}/ruling-draft`, {
        ruling, refund_amount: Number(refundAmount || 0), creator_amount: Number(creatorAmount || 0),
        reasoning, extension_days: Number(extensionDays || 0),
        note_to_creator: noteToCreator, note_to_brand: noteToBrand,
        penalty_amount: Number(penaltyAmount || 0), penalty_party: penaltyParty,
      });
      toast.success('Draft saved — you can resume later');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to save draft'));
    } finally {
      setSavingDraft(false);
    }
  };

  // spec 11.8 — peer review (mandatory for settlements above ₹50K)
  const requestPeerReview = async () => {
    if (!selected?.dispute?.id) return;
    setBusy(true);
    try {
      await axios.post(`${API}/admin/disputes/${selected.dispute.id}/request-review`, {
        ruling, refund_amount: Number(refundAmount || 0), creator_amount: Number(creatorAmount || 0), reasoning,
      });
      setPeerReviewState('requested');
      toast.success('Sent to another admin for peer review');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to request peer review'));
    } finally {
      setBusy(false);
    }
  };

  const assignToMe = async (id) => {
    try {
      await axios.post(`${API}/admin/disputes/${id}/assign`, {});
      toast.success('Assigned to you');
      view === 'appeals' ? fetchAppeals() : fetchDisputes();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to assign'));
    }
  };

  // spec 11.8 — appeals live in their own queue (senior/founder review)
  const fetchAppeals = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/disputes/appeals`);
      setAppeals(res.data?.appeals || res.data?.disputes || []);
    } catch {
      setAppeals([]);
    }
  }, []);

  useEffect(() => { if (view === 'appeals') fetchAppeals(); }, [view, fetchAppeals]);

  // spec 11.8 — default sort oldest-open-first, plus the severity/type/assigned filters
  const visibleDisputes = useMemo(() => {
    const open = (s) => !['resolved', 'closed'].includes(s);
    return [...disputes]
      .filter((x) => !severityFilter || (x.severity || 'normal') === severityFilter)
      .filter((x) => !typeFilter || x.dispute_type === typeFilter)
      .filter((x) => !assignedFilter || (x.assigned_to_name || x.assigned_to || 'Unassigned') === assignedFilter)
      .sort((a, b) => {
        if (open(a.status) !== open(b.status)) return open(a.status) ? -1 : 1;
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      });
  }, [disputes, severityFilter, typeFilter, assignedFilter]);

  const assignedOptions = useMemo(
    () => Array.from(new Set(disputes.map((x) => x.assigned_to_name || x.assigned_to).filter(Boolean))),
    [disputes]
  );

  const d = selected?.dispute;
  const resolved = d && ['resolved', 'closed'].includes(d.status);
  // spec 11.8 — settlements over the threshold cannot be finalised without peer review
  const settlementTotal = Number(refundAmount || 0) + Number(creatorAmount || 0);
  const needsPeerReview = settlementTotal > PEER_REVIEW_THRESHOLD;
  const peerReviewBlocked = needsPeerReview && peerReviewState !== 'approved';
  // PRD 11 — block ruling when the settlement exceeds this admin's role limit.
  const overRoleCap = Number.isFinite(myDisputeCap) && settlementTotal > myDisputeCap;

  return (
    <AdminLayout>
      <div className="disp-wrap">
        <div className="disp-toolbar">
          <div className="disp-counts">
            <div className="disp-viewtabs">
              <button type="button" className={view === 'disputes' ? 'active' : ''} onClick={() => setView('disputes')}>Open Disputes</button>
              <button type="button" className={view === 'appeals' ? 'active' : ''} onClick={() => setView('appeals')}>Appeals{appeals.length ? ` (${appeals.length})` : ''}</button>
            </div>
            {view === 'disputes' && (
              <>
                <span className="disp-open-pill"><AlertTriangle size={15} /> {openCount} open</span>
                <span className="disp-total">{visibleDisputes.length} shown</span>
                <span className="disp-cap-pill" title="Your role's dispute resolution limit (PRD 11)">
                  <Scale size={13} /> {ROLE_LABELS[myRole]} · limit {Number.isFinite(myDisputeCap) ? money(myDisputeCap) : 'none'}
                </span>
              </>
            )}
          </div>
          {view === 'disputes' && (
            <div className="disp-filters">
              <label>Severity</label>
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                {SEVERITY_FILTERS.map((s) => <option key={s || 'all'} value={s}>{s || 'All'}</option>)}
              </select>
              <label>Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                {TYPE_FILTERS.map((s) => <option key={s || 'all'} value={s}>{s ? s.replace(/_/g, ' ') : 'All'}</option>)}
              </select>
              <label>Assigned</label>
              <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}>
                <option value="">All</option>
                {assignedOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <label>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                {STATUS_FILTERS.map((s) => <option key={s || 'all'} value={s}>{s ? s.replace('_', ' ') : 'All'}</option>)}
              </select>
              <button type="button" onClick={fetchDisputes}>Refresh</button>
            </div>
          )}
        </div>

        {view === 'disputes' && (loading ? (
          <div className="disp-empty">Loading disputes…</div>
        ) : visibleDisputes.length === 0 ? (
          <div className="disp-empty"><Scale size={40} /><p>No disputes match this filter.</p></div>
        ) : (
          <div className="disp-table">
            <div className="disp-row disp-head">
              <span>Dispute</span><span>Parties</span><span>Type</span><span>Severity</span><span>Age</span><span>SLA</span><span>Assigned</span><span>Status</span>
            </div>
            {visibleDisputes.map((dis) => (
              <button type="button" key={dis.id} className="disp-row" onClick={() => openDispute(dis.id)} data-testid={`dispute-${dis.id}`}>
                <span className="disp-id">#{shortId(dis.id)}</span>
                <span>{shortId(dis.business_id)} ↔ {shortId(dis.creator_id)}</span>
                <span>{(dis.dispute_type || '—').replace(/_/g, ' ')}</span>
                <span className={`disp-sev sev-${dis.severity || 'normal'}`}>{dis.severity || 'normal'}</span>
                <span>{ageLabel(dis.created_at)}</span>
                <span className={`disp-sla ${slaClass(dis)}`}>
                  {['resolved', 'closed'].includes(dis.status) ? '—' : dis.sla_breached ? 'BREACHED' : typeof dis.sla_hours_remaining === 'number' ? `${dis.sla_hours_remaining}h` : '—'}
                </span>
                <span className="disp-assigned">
                  {dis.assigned_to_name || dis.assigned_to
                    ? (dis.assigned_to_name || dis.assigned_to)
                    : <em role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); assignToMe(dis.id); }}>Assign me</em>}
                </span>
                <span className={`disp-status st-${dis.status}`}>{(dis.status || '').replace('_', ' ')}</span>
              </button>
            ))}
          </div>
        ))}

        {view === 'appeals' && (
          <div className="disp-appeals">
            <div className="disp-appeals-note">
              <ShieldCheck size={15} /> Appeals require senior-admin or founder review. The second ruling is final — no further appeals on-platform.
            </div>
            {appeals.length === 0 ? (
              <div className="disp-empty"><Gavel size={40} /><p>No appeals in the queue.</p></div>
            ) : (
              <div className="disp-table">
                <div className="disp-row disp-head">
                  <span>Dispute</span><span>Parties</span><span>Type</span><span>Severity</span><span>Age</span><span>SLA</span><span>Assigned</span><span>Status</span>
                </div>
                {appeals.map((dis) => (
                  <button type="button" key={dis.id} className="disp-row" onClick={() => openDispute(dis.id)} data-testid={`appeal-${dis.id}`}>
                    <span className="disp-id">#{shortId(dis.id)}</span>
                    <span>{shortId(dis.business_id)} ↔ {shortId(dis.creator_id)}</span>
                    <span>{(dis.dispute_type || '—').replace(/_/g, ' ')}</span>
                    <span className={`disp-sev sev-${dis.severity || 'normal'}`}>{dis.severity || 'normal'}</span>
                    <span>{ageLabel(dis.created_at)}</span>
                    <span className={`disp-sla ${slaClass(dis)}`}>
                      {['resolved', 'closed'].includes(dis.status) ? '—' : dis.sla_breached ? 'BREACHED' : typeof dis.sla_hours_remaining === 'number' ? `${dis.sla_hours_remaining}h` : '—'}
                    </span>
                    <span className="disp-assigned">{dis.assigned_to_name || dis.assigned_to || 'Unassigned'}</span>
                    <span className={`disp-status st-${dis.status}`}>{(dis.status || 'appealed').replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {(selected || detailLoading) && (
        <div className="disp-overlay" onClick={() => !busy && setSelected(null)}>
          <div className="disp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="disp-modal-head">
              <h2><Scale size={18} /> Dispute #{shortId(d?.id)} <span className={`disp-status st-${d?.status}`}>{(d?.status || '').replace('_', ' ')}</span></h2>
              <button type="button" className="disp-close" onClick={() => setSelected(null)}><X size={20} /></button>
            </div>

            {detailLoading || !selected ? (
              <div className="disp-empty">Loading evidence…</div>
            ) : (
              <div className="disp-split">
                {/* LEFT: evidence */}
                <div className="disp-evidence">
                  <div className="disp-evidence-tabs">
                    {[['brief', FileText, 'Brief'], ['timeline', History, 'Timeline'], ['chat', MessageSquare, 'Chat'], ['content', ImageIcon, 'Content'], ['shipping', Package, 'Shipping'], ['evidence', Paperclip, 'Evidence Uploads'], ['prior', AlertTriangle, 'Prior']].map(([k, Icon, label]) => (
                      <button type="button" key={k} className={evidenceTab === k ? 'active' : ''} onClick={() => setEvidenceTab(k)}>
                        <Icon size={14} /> {label}
                      </button>
                    ))}
                  </div>
                  <div className="disp-evidence-body">
                    {evidenceTab === 'brief' && (
                      <div>
                        <p className="disp-claim"><strong>Reason:</strong> {d.reason || d.description || d.dispute_type || '—'}</p>
                        <h4>{selected.brief?.title || 'Campaign'}</h4>
                        <p className="disp-brief-text">{selected.brief?.brief_text || 'No brief text.'}</p>
                        <p className="disp-meta">Held in escrow: <strong>{money(selected.brief?.per_video_budget || selected.brief?.budget_max)}</strong></p>
                      </div>
                    )}
                    {evidenceTab === 'timeline' && (
                      <ul className="disp-timeline">
                        {(selected.timeline || []).map((t, i) => (
                          <li key={i}><span>{(t.timestamp || '').slice(0, 16).replace('T', ' ')}</span> <b>{t.actor_name || t.actor_type}</b> — {t.message || t.event_type}</li>
                        ))}
                        {(!selected.timeline || !selected.timeline.length) && <li>No timeline events.</li>}
                      </ul>
                    )}
                    {evidenceTab === 'chat' && (
                      <div className="disp-chat">
                        {(selected.chat_history || []).map((m, i) => (
                          <div key={i} className="disp-chat-msg"><b>{shortId(m.sender_id)}</b>: {m.content || m.message || '[attachment]'}</div>
                        ))}
                        {(!selected.chat_history || !selected.chat_history.length) && <p>No chat history.</p>}
                      </div>
                    )}
                    {evidenceTab === 'content' && (
                      <div className="disp-content-grid">
                        {(selected.content_versions || []).map((c, i) => {
                          const url = mediaUrl(c.video_url || (c.work_files || [])[0]);
                          return (
                            <div key={i} className="disp-content-tile">
                              <strong>v{c.version}</strong> <em>{c.status}</em>
                              {url ? <video src={url} controls /> : <span>No preview</span>}
                            </div>
                          );
                        })}
                        {(!selected.content_versions || !selected.content_versions.length) && <p>No content submitted.</p>}
                      </div>
                    )}
                    {evidenceTab === 'shipping' && (
                      <div className="disp-ship">
                        {selected.shipment ? (
                          <>
                            <p>Tracking: <strong>{selected.shipment.tracking_number || '—'}</strong></p>
                            <p>Courier: <strong>{selected.shipment.courier_name || '—'}</strong></p>
                            <p>Status: <strong>{selected.shipment.courier_status || selected.shipment.status || '—'}</strong></p>
                            <p>Received: <strong>{(selected.shipment.received_at || '—').toString().slice(0, 10)}</strong></p>
                          </>
                        ) : <p>No shipment on this deal.</p>}
                      </div>
                    )}
                    {evidenceTab === 'evidence' && (
                      <div className="disp-uploads">
                        {(selected.evidence_uploads || []).map((u, i) => {
                          const url = mediaUrl(u.url || u.file_url || u);
                          const label = u.label || u.name || u.party || `Upload ${i + 1}`;
                          const isImg = /\.(png|jpe?g|gif|webp)$/i.test(url);
                          const isVid = /\.(mp4|mov|webm)$/i.test(url);
                          return (
                            <div key={i} className="disp-upload-tile">
                              <div className="disp-upload-head"><Paperclip size={13} /> {label}{u.uploaded_by ? ` · ${u.uploaded_by}` : ''}</div>
                              {isImg ? <img src={url} alt={label} /> : isVid ? <video src={url} controls /> : <a href={url} target="_blank" rel="noreferrer">Open file</a>}
                            </div>
                          );
                        })}
                        {(!selected.evidence_uploads || !selected.evidence_uploads.length) && <p>No evidence files uploaded by either party.</p>}
                      </div>
                    )}
                    {evidenceTab === 'prior' && (
                      <ul className="disp-prior">
                        {(selected.prior_disputes || []).map((p) => (
                          <li key={p.id}>#{shortId(p.id)} · {(p.dispute_type || '').replace(/_/g, ' ')} · <em>{p.status}</em> · {p.ruling || 'unruled'}</li>
                        ))}
                        {(!selected.prior_disputes || !selected.prior_disputes.length) && <li>No prior disputes for these parties.</li>}
                      </ul>
                    )}
                  </div>
                </div>

                {/* RIGHT: ruling builder */}
                <div className="disp-ruling">
                  {resolved ? (
                    <div className="disp-resolved">
                      <h3>Resolved</h3>
                      <p>Ruling: <strong>{(d.ruling || '').replace(/_/g, ' ')}</strong></p>
                      <p>Refund to brand: <strong>{money(d.refund_amount)}</strong></p>
                      <p>Released to creator: <strong>{money(d.creator_amount)}</strong></p>
                      <p className="disp-reasoning">{d.reasoning}</p>
                    </div>
                  ) : (
                    <>
                      <h3>Ruling Builder</h3>
                      <label>Outcome</label>
                      <div className="disp-ruling-options">
                        {RULING_OPTIONS.map((o) => (
                          <button type="button" key={o.value} className={ruling === o.value ? 'active' : ''} onClick={() => setRuling(o.value)} title={o.hint}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                      <div className="disp-amount-row">
                        <div>
                          <label>Refund to brand (₹)</label>
                          <input type="number" min="0" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="0" />
                        </div>
                        <div>
                          <label>Release to creator (₹)</label>
                          <input type="number" min="0" value={creatorAmount} onChange={(e) => setCreatorAmount(e.target.value)} placeholder="0" />
                        </div>
                      </div>
                      <small className="disp-hint">Leave at 0 to use the default split for the selected outcome.</small>
                      <label>Extension (days, optional)</label>
                      <input type="number" min="0" value={extensionDays} onChange={(e) => setExtensionDays(e.target.value)} placeholder="0" />
                      <div className="disp-amount-row">
                        <div>
                          <label>Penalty (₹, optional)</label>
                          <input type="number" min="0" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} placeholder="0" />
                        </div>
                        <div>
                          <label>Penalty applied to</label>
                          <div className="disp-info-party">
                            {['creator', 'brand'].map((p) => (
                              <button type="button" key={p} className={penaltyParty === p ? 'active' : ''} onClick={() => setPenaltyParty(p)}>{p}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <label>Reasoning (logged to the audit trail)</label>
                      <textarea rows="3" value={reasoning} onChange={(e) => setReasoning(e.target.value)} placeholder="Explain the decision…" />
                      <label>Note to creator</label>
                      <textarea rows="2" value={noteToCreator} onChange={(e) => setNoteToCreator(e.target.value)} placeholder="Message sent to the creator…" />
                      <label>Note to brand</label>
                      <textarea rows="2" value={noteToBrand} onChange={(e) => setNoteToBrand(e.target.value)} placeholder="Message sent to the brand…" />

                      {overRoleCap && (
                        <div className="disp-peer warn">
                          <ShieldCheck size={15} />
                          This settlement ({money(settlementTotal)}) exceeds your {ROLE_LABELS[myRole]} limit of {money(myDisputeCap)}. Escalate to a senior admin or founder to settle.
                        </div>
                      )}

                      {needsPeerReview && (
                        <div className={`disp-peer ${peerReviewState === 'approved' ? 'ok' : 'warn'}`}>
                          <ShieldCheck size={15} />
                          {peerReviewState === 'approved'
                            ? 'Peer review approved — you may finalise this ruling.'
                            : peerReviewState === 'requested'
                              ? `Settlement over ${money(PEER_REVIEW_THRESHOLD)} — awaiting a second admin's review.`
                              : `Settlement over ${money(PEER_REVIEW_THRESHOLD)} requires peer review before it can be finalised.`}
                        </div>
                      )}

                      <div className="disp-rule-actions">
                        <button type="button" className="disp-draft-btn" disabled={savingDraft || busy} onClick={saveDraft}>
                          <Save size={14} /> {savingDraft ? 'Saving…' : 'Save draft'}
                        </button>
                        {needsPeerReview && peerReviewState !== 'approved' && (
                          <button type="button" className="disp-peer-btn" disabled={busy || peerReviewState === 'requested'} onClick={requestPeerReview}>
                            <UserCheck size={14} /> {peerReviewState === 'requested' ? 'Review requested' : 'Request peer review'}
                          </button>
                        )}
                      </div>
                      <button type="button" className="disp-rule-btn" disabled={busy || peerReviewBlocked || overRoleCap} onClick={submitRuling} title={overRoleCap ? `Above your ${ROLE_LABELS[myRole]} limit of ${money(myDisputeCap)}` : peerReviewBlocked ? 'Peer review required for settlements over ₹50K' : undefined}>
                        {busy ? 'Settling…' : overRoleCap ? `Over your ${money(myDisputeCap)} limit — escalate` : peerReviewBlocked ? 'Peer review required to settle' : 'Record Ruling & Settle Funds'}
                      </button>

                      <div className="disp-divider" />
                      <h3><Clock size={15} /> Request More Info</h3>
                      <div className="disp-info-party">
                        {['creator', 'brand'].map((p) => (
                          <button type="button" key={p} className={infoParty === p ? 'active' : ''} onClick={() => setInfoParty(p)}>{p}</button>
                        ))}
                      </div>
                      <textarea rows="2" value={infoMessage} onChange={(e) => setInfoMessage(e.target.value)} placeholder="What do you need from them? (72h window, SLA pauses)" />
                      <button type="button" className="disp-info-btn" disabled={busy} onClick={requestInfo}>Request Info</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .disp-wrap { padding: 4px 0; }
        .disp-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
        .disp-counts { display: flex; align-items: center; gap: 12px; }
        .disp-open-pill { display: inline-flex; align-items: center; gap: 6px; background: #fff1f0; color: #b42318; border: 1px solid #fecaca; padding: 5px 12px; border-radius: 999px; font-weight: 600; font-size: 13px; }
        .disp-total { color: #8a8a93; font-size: 13px; }
        .disp-cap-pill { display: inline-flex; align-items: center; gap: 5px; background: #eef0ff; color: #4452f0; border: 1px solid #d6dbff; padding: 5px 11px; border-radius: 999px; font-weight: 600; font-size: 12px; }
        .disp-filters { display: flex; align-items: center; gap: 8px; }
        .disp-filters label { font-size: 13px; color: #6b6b80; }
        .disp-filters select, .disp-filters button { padding: 7px 10px; border: 1px solid #e2e4f0; border-radius: 8px; background: #fff; font-size: 13px; cursor: pointer; }
        .disp-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px; color: #8a8a93; }
        .disp-table { border: 1px solid #ececf1; border-radius: 12px; overflow: hidden; background: #fff; }
        .disp-row { display: grid; grid-template-columns: 1fr 1.3fr 1.1fr 0.8fr 0.7fr 0.9fr 1fr 1fr; gap: 8px; align-items: center; padding: 12px 14px; width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid #f2f2f6; cursor: pointer; font-size: 13px; }
        .disp-row:hover:not(.disp-head) { background: #fafafe; }
        .disp-head { background: #f7f7fb; font-weight: 700; color: #6b6b80; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; cursor: default; }
        .disp-id { font-weight: 700; color: #5a4ff3; }
        .disp-sev { text-transform: capitalize; font-weight: 600; }
        .sev-high, .sev-critical { color: #b42318; }
        .sev-normal, .sev-low { color: #6b6b80; }
        .disp-sla { font-weight: 700; }
        .sla-red { color: #b42318; }
        .sla-orange { color: #c2410c; }
        .sla-green { color: #1f8a4c; }
        .sla-done { color: #9a9ab0; }
        .disp-status { text-transform: capitalize; font-weight: 600; font-size: 12px; }
        .st-open { color: #c2410c; }
        .st-resolved, .st-closed { color: #1f8a4c; }
        .st-info_requested { color: #5a4ff3; }
        .st-appealed { color: #b42318; }

        .disp-overlay { position: fixed; inset: 0; background: rgba(17,17,40,.55); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 24px; }
        .disp-modal { background: #fff; border-radius: 16px; width: min(1080px, 100%); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
        .disp-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #ececf1; }
        .disp-modal-head h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 17px; }
        .disp-close { background: none; border: none; cursor: pointer; color: #8a8a93; }
        .disp-split { display: grid; grid-template-columns: 1.3fr 1fr; gap: 0; min-height: 0; overflow: hidden; }
        .disp-evidence { border-right: 1px solid #ececf1; display: flex; flex-direction: column; min-height: 0; }
        .disp-evidence-tabs { display: flex; gap: 4px; padding: 10px; border-bottom: 1px solid #f2f2f6; flex-wrap: wrap; }
        .disp-evidence-tabs button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border: 1px solid #e2e4f0; border-radius: 8px; background: #fff; cursor: pointer; font-size: 12px; }
        .disp-evidence-tabs button.active { background: #5a4ff3; color: #fff; border-color: #5a4ff3; }
        .disp-evidence-body { padding: 16px 18px; overflow-y: auto; }
        .disp-claim { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; padding: 8px 12px; border-radius: 8px; }
        .disp-brief-text { white-space: pre-wrap; color: #4b4b66; font-size: 13px; }
        .disp-meta { font-size: 13px; }
        .disp-timeline { list-style: none; margin: 0; padding: 0; font-size: 12.5px; }
        .disp-timeline li { padding: 6px 0; border-bottom: 1px solid #f4f4f8; }
        .disp-timeline span { color: #9a9ab0; margin-right: 6px; }
        .disp-chat-msg { padding: 6px 0; font-size: 12.5px; border-bottom: 1px solid #f4f4f8; }
        .disp-content-grid { display: grid; gap: 12px; }
        .disp-content-tile video { width: 100%; max-height: 200px; border-radius: 8px; background: #000; margin-top: 6px; }
        .disp-prior { list-style: none; margin: 0; padding: 0; font-size: 12.5px; }
        .disp-prior li { padding: 6px 0; border-bottom: 1px solid #f4f4f8; }
        .disp-ruling { padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .disp-ruling h3 { margin: 0 0 4px; font-size: 15px; display: flex; align-items: center; gap: 6px; }
        .disp-ruling label { font-size: 12px; color: #6b6b80; font-weight: 600; margin-top: 6px; }
        .disp-ruling input, .disp-ruling textarea { width: 100%; padding: 8px 10px; border: 1px solid #e2e4f0; border-radius: 8px; font-size: 13px; line-height: 1.4; box-sizing: border-box; font-family: inherit; flex-shrink: 0; }
        .disp-ruling textarea { min-height: 56px; resize: vertical; }
        .disp-ruling-options, .disp-info-party { display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0; }
        .disp-ruling-options button, .disp-info-party button { flex: 1; min-width: 90px; padding: 8px; border: 1px solid #e2e4f0; border-radius: 8px; background: #fff; cursor: pointer; font-size: 12.5px; text-transform: capitalize; }
        .disp-ruling-options button.active, .disp-info-party button.active { background: #eef0ff; border-color: #5a4ff3; color: #5a4ff3; font-weight: 700; }
        .disp-amount-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; flex-shrink: 0; }
        .disp-hint { color: #9a9ab0; font-size: 11px; }
        .disp-rule-btn { margin-top: 10px; padding: 11px; border: none; border-radius: 9px; background: #16a34a; color: #fff; font-weight: 700; cursor: pointer; flex-shrink: 0; }
        .disp-rule-btn:disabled { background: #c5c5cf; cursor: not-allowed; }
        .disp-info-btn { padding: 9px; border: 1px solid #5a4ff3; border-radius: 9px; background: #fff; color: #5a4ff3; font-weight: 600; cursor: pointer; flex-shrink: 0; }
        .disp-divider { height: 1px; background: #ececf1; margin: 14px 0 4px; }
        .disp-resolved { background: #effaf3; border: 1px solid #bfe6cd; border-radius: 10px; padding: 14px; }
        .disp-reasoning { white-space: pre-wrap; color: #4b4b66; font-size: 13px; margin-top: 8px; }
        /* spec 11.8 additions */
        .disp-viewtabs { display: inline-flex; gap: 4px; padding: 3px; background: #f2f2f6; border-radius: 999px; }
        .disp-viewtabs button { border: none; background: none; padding: 6px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: #6b6b80; cursor: pointer; }
        .disp-viewtabs button.active { background: #fff; color: #5a4ff3; box-shadow: 0 1px 2px rgba(17,17,40,.08); }
        .disp-assigned { font-size: 12.5px; color: #4b4b66; }
        .disp-assigned em { font-style: normal; color: #5a4ff3; font-weight: 600; cursor: pointer; }
        .disp-assigned em:hover { text-decoration: underline; }
        .disp-appeals-note { display: flex; align-items: center; gap: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #b42318; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; }
        .disp-uploads { display: grid; gap: 12px; }
        .disp-upload-tile { border: 1px solid #ececf1; border-radius: 10px; padding: 10px; }
        .disp-upload-head { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #6b6b80; font-weight: 600; margin-bottom: 8px; }
        .disp-upload-tile img, .disp-upload-tile video { width: 100%; max-height: 220px; object-fit: contain; border-radius: 8px; background: #000; }
        .disp-upload-tile a { color: #5a4ff3; font-size: 13px; font-weight: 600; }
        .disp-peer { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 9px; font-size: 12.5px; font-weight: 600; margin-top: 6px; }
        .disp-peer.warn { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; }
        .disp-peer.ok { background: #effaf3; border: 1px solid #bfe6cd; color: #1f8a4c; }
        .disp-rule-actions { display: flex; gap: 8px; margin-top: 8px; }
        .disp-draft-btn, .disp-peer-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px; border-radius: 9px; font-weight: 600; font-size: 12.5px; cursor: pointer; }
        .disp-draft-btn { border: 1px solid #e2e4f0; background: #fff; color: #4b4b66; }
        .disp-peer-btn { border: 1px solid #5a4ff3; background: #eef0ff; color: #5a4ff3; }
        .disp-draft-btn:disabled, .disp-peer-btn:disabled { opacity: .55; cursor: not-allowed; }
        @media (max-width: 860px) { .disp-split { grid-template-columns: 1fr; } .disp-evidence { border-right: none; border-bottom: 1px solid #ececf1; } }
      `}</style>
    </AdminLayout>
  );
}
