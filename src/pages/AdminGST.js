import { useLiveEffect } from '../lib/liveUpdates';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { ReceiptText, Hourglass, CheckCircle2, XCircle, Copy, ChevronRight, ArrowLeft, X, Eye, EyeOff, ExternalLink } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import useIsPhone from '../lib/useIsPhone';
import '../styles/admin-mobile-kyc.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const TABS = [
  { key: 'pending', label: 'Pending', Icon: Hourglass },
  { key: 'verified', label: 'Verified', Icon: CheckCircle2 },
  { key: 'rejected', label: 'Rejected', Icon: XCircle },
  { key: 'all', label: 'All', Icon: ReceiptText },
];

const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');

// The GST portal has no public verification API we can call, so an admin confirms the
// GSTIN belongs to this brand. The number itself is already checksum-validated by the
// backend, so anything reaching this queue is at least structurally real.
const GST_PORTAL = 'https://services.gst.gov.in/services/searchtp';

// ---- phone view helpers ----
const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
// State code (first 2) + last 4 stay visible: "27•••••••••F1ZV".
const maskGstin = (v) => (v ? `${v.slice(0, 2)}${'•'.repeat(Math.max(v.length - 6, 0))}${v.slice(-4)}` : '-');
const STATUS_BADGE = { pending: 'wait', verified: 'ok', rejected: 'bad' };
const statusText = (s) => (s ? s[0].toUpperCase() + s.slice(1) : 'Unknown');

export default function AdminGST() {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const isPhone = useIsPhone();
  const [detailId, setDetailId] = useState(null); // phone: GST review open for this user_id
  const [reveal, setReveal] = useState(false); // phone: show the full GSTIN on purpose
  const [rejectTarget, setRejectTarget] = useState(null); // phone: reject sheet (desktop uses window.prompt)
  const [rejectReason, setRejectReason] = useState('');

  const load = async (status = tab) => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/gst?status=${status}`);
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not load the GST queue'));
      setRows([]);
    } finally { setLoading(false); }
  };

  useLiveEffect(() => { load(tab); /* eslint-disable-next-line */ }, [tab]);

  // `givenReason` comes from the phone reject sheet; desktop leaves it out and is prompted.
  const review = async (row, action, givenReason) => {
    let reason = '';
    if (action === 'reject') {
      // eslint-disable-next-line no-alert
      reason = (givenReason ?? window.prompt(`Why is ${row.gstin} being rejected?\n\nThe brand sees this, so be specific.`) ?? '').trim();
      if (!reason) return false;
    }
    setBusyId(row.user_id);
    try {
      await axios.post(`${API}/admin/gst/${row.user_id}`, { action, reason });
      toast.success(action === 'approve'
        ? `${row.brand_name} verified - they can now add funds.`
        : `${row.brand_name} rejected.`);
      load(tab);
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Review failed'));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const copy = (v) => {
    navigator.clipboard?.writeText(v);
    toast.success('GSTIN copied');
  };

  if (isPhone) {
    const row = rows.find((r) => r.user_id === detailId);
    const closeDetail = () => { setDetailId(null); setReveal(false); };
    const decide = async (target, action, reason) => {
      if (await review(target, action, reason)) { setRejectTarget(null); setRejectReason(''); closeDetail(); }
    };
    return (
      <AdminLayout>
        <div className="am">
          <div className="am-chips">
            {TABS.map(({ key, label, Icon }) => (
              <button key={key} type="button" className={`am-chip${tab === key ? ' is-active' : ''}`} aria-pressed={tab === key} onClick={() => setTab(key)} data-testid={`gst-tab-${key}`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          <p className="am-muted amk-flat">
            A brand cannot add money to its wallet until its GSTIN is verified. Confirm the GSTIN belongs to the brand on the{' '}
            <a href={GST_PORTAL} target="_blank" rel="noreferrer">GST portal</a>, then approve.
          </p>

          {loading && !rows.length ? (
            <div className="am-empty">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="am-empty">Nothing in the {tab} queue.</div>
          ) : (
            <div className="am-list">
              {rows.map((r) => (
                <button key={r.user_id} type="button" className="am-card" onClick={() => { setDetailId(r.user_id); setReveal(false); }} data-testid={`gst-row-${r.user_id}`}>
                  <div className="am-card-head">
                    <span className="am-avatar" aria-hidden="true">{initials(r.brand_name)}</span>
                    <div className="am-card-main">
                      <span className="am-card-title">{r.brand_name}</span>
                      <span className="am-card-sub">Submitted {fmtDate(r.submitted_at)}</span>
                      <span className="am-badges"><span className={`am-badge am-badge--${STATUS_BADGE[r.status] || 'neutral'}`}>{statusText(r.status)}</span></span>
                    </div>
                    <ChevronRight size={20} className="am-row-chevron amk-chev" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {row && (
            <div className="am-detail" role="dialog" aria-modal="true" aria-labelledby="amg-detail-title" data-testid="gst-detail">
              <header className="am-detail-head">
                <button type="button" className="am-icon-btn" onClick={closeDetail} aria-label="Back to GST queue"><ArrowLeft size={22} /></button>
                <h1 id="amg-detail-title">GST review</h1>
              </header>
              <div className="am-detail-body">
                <div className="am-identity">
                  <span className="am-avatar am-avatar--lg" aria-hidden="true">{initials(row.brand_name)}</span>
                  <div className="am-card-main">
                    <h2>{row.brand_name}</h2>
                    <span className="am-badges"><span className={`am-badge am-badge--${STATUS_BADGE[row.status] || 'neutral'}`}>{statusText(row.status)}</span></span>
                    <span className="am-card-sub">Submitted {fmtDate(row.submitted_at)}</span>
                    {row.email && <span className="am-card-sub">{row.email}</span>}
                  </div>
                </div>

                {row.status === 'rejected' && row.rejection_reason && (
                  <section className="am-section amk-rejected"><h3>Rejection reason</h3><p>{row.rejection_reason}</p></section>
                )}

                <section className="am-section">
                  <div className="amk-sec-head">
                    <h3>GST details</h3>
                    <button type="button" className="am-btn am-btn--link am-btn--sm" aria-pressed={reveal} onClick={() => setReveal((v) => !v)}>
                      {reveal ? <EyeOff size={16} /> : <Eye size={16} />} {reveal ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="am-kv"><span>GSTIN</span><span className="amk-mono">{reveal ? (row.gstin || '-') : maskGstin(row.gstin)}</span></div>
                  <div className="am-kv"><span>Legal name</span><span>{row.legal_name || '-'}</span></div>
                  <div className="am-kv"><span>Submitted</span><span>{fmtDate(row.submitted_at)}</span></div>
                  {row.status !== 'pending' && <div className="am-kv"><span>Reviewed</span><span>{fmtDate(row.reviewed_at)}</span></div>}
                  <button type="button" className="am-btn am-btn--secondary" onClick={() => copy(row.gstin)}><Copy size={16} /> Copy GSTIN</button>
                  <a className="am-btn am-btn--secondary" href={GST_PORTAL} target="_blank" rel="noreferrer">Check on GST portal <ExternalLink size={16} /></a>
                </section>
              </div>

              {row.status === 'pending' && (
                <div className="am-actionbar">
                  <div className="am-actionbar-row">
                    <button type="button" className="am-btn am-btn--danger" disabled={busyId === row.user_id} onClick={() => { setRejectTarget(row); setRejectReason(''); }}>Reject</button>
                    <button type="button" className="am-btn am-btn--primary" disabled={busyId === row.user_id} onClick={() => decide(row, 'approve')}>
                      {busyId === row.user_id ? 'Saving…' : 'Verify GSTIN'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {rejectTarget && (
            <>
              <div className="am-sheet-backdrop" onClick={() => setRejectTarget(null)} />
              <section className="am-sheet" role="dialog" aria-modal="true" aria-labelledby="amg-reject-title">
                <div className="am-sheet-head">
                  <h2 id="amg-reject-title">Reject GSTIN</h2>
                  <button type="button" className="am-icon-btn" onClick={() => setRejectTarget(null)} aria-label="Close"><X size={20} /></button>
                </div>
                <div className="am-sheet-body">
                  <p className="am-muted amk-flat">Why is <strong>{rejectTarget.brand_name}</strong>'s GSTIN being rejected?</p>
                  <div className="am-field">
                    <label htmlFor="amg-reject-reason">Reason for rejection</label>
                    <textarea id="amg-reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} />
                    <span className="am-field-hint">Required. The brand sees this, so be specific.</span>
                  </div>
                </div>
                <div className="am-sheet-foot">
                  <button type="button" className="am-btn am-btn--secondary" onClick={() => setRejectTarget(null)}>Back</button>
                  <button
                    type="button"
                    className="am-btn am-btn--danger"
                    disabled={!rejectReason.trim() || busyId === rejectTarget.user_id}
                    onClick={() => decide(rejectTarget, 'reject', rejectReason)}
                    data-testid="gst-reject-confirm"
                  >
                    {busyId === rejectTarget.user_id ? 'Rejecting…' : 'Reject GSTIN'}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="agst">
        <div className="agst-tabs">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`agst-tab ${tab === key ? 'is-active' : ''}`}
              onClick={() => setTab(key)}
              data-testid={`gst-tab-${key}`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <p className="agst-desc">
          A brand cannot add money to its wallet until its GSTIN is verified. Numbers here have already
          passed format and check-digit validation - confirm the GSTIN belongs to this brand on the{' '}
          <a href={GST_PORTAL} target="_blank" rel="noreferrer">GST portal</a>, then approve.
        </p>

        {loading ? (
          <p className="agst-empty">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="agst-empty">Nothing in the {tab} queue.</p>
        ) : (
          <div className="agst-list">
            {rows.map((row) => (
              <article className="agst-card" key={row.user_id}>
                <div className="agst-main">
                  <div className="agst-brand">
                    <strong>{row.brand_name}</strong>
                    <span>{row.email}</span>
                  </div>

                  <div className="agst-fields">
                    <div>
                      <label>GSTIN</label>
                      <p className="agst-gstin">
                        {row.gstin}
                        <button type="button" onClick={() => copy(row.gstin)} aria-label="Copy GSTIN"><Copy size={13} /></button>
                      </p>
                    </div>
                    <div>
                      <label>Legal name</label>
                      <p>{row.legal_name || '-'}</p>
                    </div>
                    <div>
                      <label>Submitted</label>
                      <p>{fmtDate(row.submitted_at)}</p>
                    </div>
                  </div>

                  {row.status === 'rejected' && row.rejection_reason && (
                    <p className="agst-reason">Rejected: {row.rejection_reason}</p>
                  )}
                </div>

                <div className="agst-side">
                  <span className={`agst-status is-${row.status}`}>{row.status}</span>
                  {row.status === 'pending' ? (
                    <div className="agst-actions">
                      <button
                        className="agst-approve"
                        onClick={() => review(row, 'approve')}
                        disabled={busyId === row.user_id}
                      >
                        <CheckCircle2 size={15} /> Approve
                      </button>
                      <button
                        className="agst-reject"
                        onClick={() => review(row, 'reject')}
                        disabled={busyId === row.user_id}
                      >
                        <XCircle size={15} /> Reject
                      </button>
                    </div>
                  ) : (
                    <p className="agst-reviewed">Reviewed {fmtDate(row.reviewed_at)}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .agst-tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
        .agst-tab { display:inline-flex; align-items:center; gap:7px; padding:9px 15px; border:1px solid #e8ecff; background:#fff; border-radius:999px; font-weight:600; font-size:0.88rem; color:#5b6573; cursor:pointer; }
        .agst-tab:hover { border-color:#d6dbff; background:#f7f8ff; }
        .agst-tab.is-active { background:#07074e; border-color:#07074e; color:#fff; }
        .agst-desc { margin:0 0 20px; font-size:0.85rem; color:#718096; line-height:1.6; max-width:760px; }
        .agst-desc a { color:#5b6bff; font-weight:600; }
        .agst-empty { color:#9296ba; font-size:0.9rem; }
        .agst-list { display:flex; flex-direction:column; gap:12px; }
        .agst-card { display:flex; gap:20px; justify-content:space-between; align-items:flex-start; background:#fff; border:1px solid #ececf1; border-radius:14px; padding:18px 20px; }
        .agst-main { flex:1; min-width:0; }
        .agst-brand strong { display:block; font-size:1rem; color:#07074e; }
        .agst-brand span { font-size:0.82rem; color:#9296ba; }
        .agst-fields { display:flex; gap:28px; flex-wrap:wrap; margin-top:14px; }
        .agst-fields label { display:block; font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:700; color:#9296ba; margin-bottom:3px; }
        .agst-fields p { margin:0; font-size:0.9rem; color:#2d3250; }
        .agst-gstin { display:flex; align-items:center; gap:7px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:0.04em; font-weight:600; }
        .agst-gstin button { border:1px solid #e6e8f3; background:#fff; color:#5b6573; border-radius:6px; width:24px; height:24px; display:grid; place-items:center; cursor:pointer; }
        .agst-gstin button:hover { background:#f4f5fb; }
        .agst-reason { margin:12px 0 0; font-size:0.83rem; color:#b42318; }
        .agst-side { display:flex; flex-direction:column; align-items:flex-end; gap:10px; }
        .agst-status { font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; }
        .agst-status.is-pending { background:#fff4e5; color:#a35b00; }
        .agst-status.is-verified { background:#e8f7ef; color:#0f7a43; }
        .agst-status.is-rejected { background:#fdeaef; color:#b42318; }
        .agst-actions { display:flex; gap:8px; }
        .agst-actions button { display:inline-flex; align-items:center; gap:6px; font-weight:700; font-size:0.82rem; padding:8px 14px; border-radius:9px; cursor:pointer; }
        .agst-actions button:disabled { opacity:0.5; cursor:not-allowed; }
        .agst-approve { border:1px solid #a7e3c4; background:#e8f7ef; color:#0f7a43; }
        .agst-approve:hover:not(:disabled) { background:#d5f0e2; }
        .agst-reject { border:1px solid #f2b8c6; background:#fff5f8; color:#b42318; }
        .agst-reject:hover:not(:disabled) { background:#ffe4ec; }
        .agst-reviewed { margin:0; font-size:0.78rem; color:#9296ba; }
        @media (max-width:720px) { .agst-card { flex-direction:column; } .agst-side { align-items:flex-start; } }
      `}</style>
    </AdminLayout>
  );
}
