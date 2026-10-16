import { useLiveEffect } from '../lib/liveUpdates';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { BadgeCheck, ExternalLink, Hourglass, CheckCircle2, XCircle, ChevronDown, ChevronRight, ArrowLeft, X, Eye, EyeOff, FileText } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import useIsPhone from '../lib/useIsPhone';
import '../styles/admin-mobile-kyc.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const docUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${String(u).startsWith('/') ? '' : '/'}${u}`));

const TABS = [
  { key: 'pending', label: 'Pending', Icon: Hourglass },
  { key: 'verified', label: 'Verified', Icon: CheckCircle2 },
  { key: 'rejected', label: 'Rejected', Icon: XCircle },
  { key: 'all', label: 'All', Icon: BadgeCheck },
];

// ---- phone view helpers ----
const kycName = (row) => {
  const k = row.kyc || {};
  return k.full_legal_name || k.name_on_pan || row.full_name || row.name || row.email || '-';
};
const initials = (name) => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const last4 = (v) => String(v || '').replace(/\s/g, '').slice(-4);
const maskAadhaar = (v) => (v ? `•••• •••• ${last4(v)}` : '-');
const maskPan = (v) => (v ? `••••••${last4(v)}` : '-');
const STATUS_BADGE = { pending: 'wait', verified: 'ok', rejected: 'bad' };
const statusText = (s) => (s ? s[0].toUpperCase() + s.slice(1) : 'Unknown');
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const kycDocs = (k) => [
  ['PAN card', k.pan_doc_url],
  ['Aadhaar front', k.aadhaar_front_url],
  ['Aadhaar back', k.aadhaar_back_url],
  ...(k.selfie_url ? [['Selfie', k.selfie_url]] : []),
];

// Full-screen document view for phones: image inline (with retry if it fails to
// load), PDFs via the browser's own viewer, and always an "open in new tab".
function DocViewer({ label, url, onClose }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = docUrl(url);
  const isPdf = /\.pdf($|[?#])/i.test(url);
  return (
    <div className="amk-viewer" role="dialog" aria-modal="true" aria-labelledby="amk-viewer-title" data-testid="kyc-doc-viewer">
      <header className="am-detail-head">
        <button type="button" className="am-icon-btn" onClick={onClose} aria-label="Close document"><X size={22} /></button>
        <h1 id="amk-viewer-title">{label}</h1>
        <a className="am-icon-btn" href={src} target="_blank" rel="noreferrer" aria-label="Open in new tab"><ExternalLink size={20} /></a>
      </header>
      <div className="amk-viewer-body">
        {isPdf ? (
          <div className="am-empty amk-viewer-msg">
            <p>This document is a PDF.</p>
            <a className="am-btn am-btn--primary" href={src} target="_blank" rel="noreferrer">Open PDF <ExternalLink size={16} /></a>
          </div>
        ) : failed ? (
          <div className="am-empty amk-viewer-msg">
            <p>This document could not be loaded.</p>
            <button type="button" className="am-btn am-btn--secondary" onClick={() => { setFailed(false); setAttempt((a) => a + 1); }}>Retry</button>
          </div>
        ) : (
          <img key={attempt} src={src} alt={label} onError={() => setFailed(true)} />
        )}
      </div>
    </div>
  );
}

export default function AdminKYC() {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const isPhone = useIsPhone();
  const [detailId, setDetailId] = useState(null); // phone: KYC review open for this row
  const [reveal, setReveal] = useState(false); // phone: show full Aadhaar / PAN on purpose
  const [viewDoc, setViewDoc] = useState(null); // phone: [label, url] in the full-screen viewer

  const load = async (status = tab) => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/kyc?status=${status}`);
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not load the KYC queue'));
      setRows([]);
    } finally { setLoading(false); }
  };

  useLiveEffect(() => { load(tab); /* eslint-disable-next-line */ }, [tab]);

  const review = async (row, action, reason = '') => {
    if (action === 'reject' && !reason.trim()) return false;
    setBusyId(row.id);
    try {
      await axios.post(`${API}/admin/kyc/${row.id}/review`, { action, reason });
      toast.success(action === 'approve' ? 'KYC verified - the creator can now withdraw.' : 'KYC rejected.');
      if (action === 'reject') {
        setRejectTarget(null);
        setRejectionReason('');
      }
      load(tab);
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save the decision'));
      return false;
    } finally { setBusyId(null); }
  };

  if (isPhone) {
    const row = rows.find((r) => r.id === detailId);
    const k = row?.kyc || {};
    const closeDetail = () => { setDetailId(null); setReveal(false); };
    const decide = async (target, action, reason) => {
      if (await review(target, action, reason)) closeDetail();
    };
    const addr = k.address ? [k.address.line, k.address.city, k.address.state, k.address.pincode].filter(Boolean).join(', ') : '';
    const bank = row?.bank_details;
    return (
      <AdminLayout>
        <div className="am">
          <div className="am-chips">
            {TABS.map((t) => (
              <button key={t.key} type="button" className={`am-chip${tab === t.key ? ' is-active' : ''}`} aria-pressed={tab === t.key} onClick={() => setTab(t.key)} data-testid={`kyc-tab-${t.key}`}>
                <t.Icon size={15} /> {t.label}
              </button>
            ))}
          </div>

          {loading && !rows.length ? (
            <div className="am-empty">Loading…</div>
          ) : !rows.length ? (
            <div className="am-empty">Nothing in “{TABS.find((t) => t.key === tab).label}”.</div>
          ) : (
            <div className="am-list">
              {rows.map((r) => (
                <button key={r.id} type="button" className="am-card" onClick={() => { setDetailId(r.id); setReveal(false); }} data-testid={`kyc-row-${r.id}`}>
                  <div className="am-card-head">
                    <span className="am-avatar" aria-hidden="true">{initials(kycName(r))}</span>
                    <div className="am-card-main">
                      <span className="am-card-title">{kycName(r)}</span>
                      <span className="am-card-sub">Submitted {fmtDay(r.kyc?.submitted_at)}</span>
                      <span className="am-badges"><span className={`am-badge am-badge--${STATUS_BADGE[r.kyc?.status] || 'neutral'}`}>{statusText(r.kyc?.status)}</span></span>
                    </div>
                    <ChevronRight size={20} className="am-row-chevron amk-chev" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {row && (
            <div className="am-detail" role="dialog" aria-modal="true" aria-labelledby="amk-detail-title" data-testid="kyc-detail">
              <header className="am-detail-head">
                <button type="button" className="am-icon-btn" onClick={closeDetail} aria-label="Back to KYC queue"><ArrowLeft size={22} /></button>
                <h1 id="amk-detail-title">KYC review</h1>
              </header>
              <div className="am-detail-body">
                <div className="am-identity">
                  <span className="am-avatar am-avatar--lg" aria-hidden="true">{initials(kycName(row))}</span>
                  <div className="am-card-main">
                    <h2>{kycName(row)}</h2>
                    <span className="am-badges"><span className={`am-badge am-badge--${STATUS_BADGE[k.status] || 'neutral'}`}>{statusText(k.status)}</span></span>
                    <span className="am-card-sub">Submitted {k.submitted_at ? new Date(k.submitted_at).toLocaleString() : '-'}</span>
                    {row.email && <span className="am-card-sub">{row.email}</span>}
                  </div>
                </div>

                {k.status === 'rejected' && k.rejection_reason && (
                  <section className="am-section amk-rejected"><h3>Rejection reason</h3><p>{k.rejection_reason}</p></section>
                )}

                <section className="am-section">
                  <div className="amk-sec-head">
                    <h3>Identity information</h3>
                    <button type="button" className="am-btn am-btn--link am-btn--sm" aria-pressed={reveal} onClick={() => setReveal((v) => !v)}>
                      {reveal ? <EyeOff size={16} /> : <Eye size={16} />} {reveal ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="am-kv"><span>Aadhaar</span><span className="amk-mono">{reveal ? (k.aadhaar_number || '-') : maskAadhaar(k.aadhaar_number)}</span></div>
                  <div className="am-kv"><span>PAN</span><span className="amk-mono">{reveal ? (k.pan_number || '-') : maskPan(k.pan_number)}</span></div>
                  {k.name_on_pan && <div className="am-kv"><span>Name on PAN</span><span>{k.name_on_pan}</span></div>}
                  <div className="am-kv"><span>Date of birth</span><span>{k.date_of_birth || '-'}</span></div>
                  <div className="am-kv"><span>Gender</span><span>{(k.gender || '-').replace(/_/g, ' ')}</span></div>
                  <div className="am-kv"><span>UPI ID</span><span>{row.upi_id || '-'}</span></div>
                  {bank?.account_number && (
                    <div className="am-kv"><span>Bank account</span><span className="amk-mono">••••{last4(bank.account_number)}{bank.ifsc_code ? ` · ${bank.ifsc_code}` : ''}</span></div>
                  )}
                </section>

                <section className="am-section">
                  <h3>Documents</h3>
                  {kycDocs(k).map(([label, url]) => (
                    <div key={label} className="am-doc">
                      <span className="amk-doc-icon"><FileText size={20} /></span>
                      <div className="am-doc-main">
                        {label}
                      </div>
                      {url ? (
                        <button type="button" className="am-btn am-btn--link am-btn--sm" onClick={() => setViewDoc([label, url])}>View</button>
                      ) : (
                        <span className="am-badge am-badge--bad">Missing</span>
                      )}
                    </div>
                  ))}
                </section>

                <details className="am-section amk-collapse">
                  <summary>Address details <ChevronDown size={18} /></summary>
                  <p>{addr || '-'}</p>
                </details>
              </div>

              {k.status === 'pending' && (
                <div className="am-actionbar">
                  <div className="am-actionbar-row">
                    <button type="button" className="am-btn am-btn--danger" disabled={busyId === row.id} onClick={() => { setRejectTarget(row); setRejectionReason(''); }}>Reject</button>
                    <button type="button" className="am-btn am-btn--primary" disabled={busyId === row.id} onClick={() => decide(row, 'approve')}>
                      {busyId === row.id ? 'Saving…' : 'Verify identity'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {viewDoc && <DocViewer label={viewDoc[0]} url={viewDoc[1]} onClose={() => setViewDoc(null)} />}

          {rejectTarget && (
            <>
              <div className="am-sheet-backdrop" onClick={() => setRejectTarget(null)} />
              <section className="am-sheet" role="dialog" aria-modal="true" aria-labelledby="amk-reject-title">
                <div className="am-sheet-head">
                  <h2 id="amk-reject-title">Reject KYC submission</h2>
                  <button type="button" className="am-icon-btn" onClick={() => setRejectTarget(null)} aria-label="Close"><X size={20} /></button>
                </div>
                <div className="am-sheet-body">
                  <p className="am-muted amk-flat">Tell <strong>{kycName(rejectTarget)}</strong> what they need to correct before resubmitting.</p>
                  <div className="am-field">
                    <label htmlFor="amk-rejection-reason">Reason for rejection</label>
                    <textarea
                      id="amk-rejection-reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Example: The Aadhaar image is unclear. Please upload a readable photo showing all four corners."
                      rows={4}
                    />
                    <span className="am-field-hint">Required. This message will be shown to the creator.</span>
                  </div>
                </div>
                <div className="am-sheet-foot">
                  <button type="button" className="am-btn am-btn--secondary" onClick={() => setRejectTarget(null)}>Back</button>
                  <button
                    type="button"
                    className="am-btn am-btn--danger"
                    disabled={!rejectionReason.trim() || busyId === rejectTarget.id}
                    onClick={() => decide(rejectTarget, 'reject', rejectionReason)}
                    data-testid="kyc-reject-confirm"
                  >
                    {busyId === rejectTarget.id ? 'Rejecting…' : 'Reject KYC'}
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
      <div className="akyc">
        <div className="akyc-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={tab === t.key ? 'is-active' : ''}
              onClick={() => setTab(t.key)}
              data-testid={`kyc-tab-${t.key}`}
            >
              <t.Icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="akyc-empty">Loading…</div>
        ) : !rows.length ? (
          <div className="akyc-empty">Nothing in “{TABS.find((t) => t.key === tab).label}”.</div>
        ) : (
          <div className="akyc-list">
            {rows.map((row) => {
              const k = row.kyc || {};
              const isExpanded = expandedId === row.id;
              return (
                <article key={row.id} className={`akyc-card${isExpanded ? ' is-expanded' : ''}`} data-testid={`kyc-row-${row.id}`}>
                  <div className="akyc-summary">
                    <div className="akyc-who">
                      <strong>{k.full_legal_name || k.name_on_pan || row.full_name || row.name || row.email || '-'}</strong>
                    </div>
                    <div className="akyc-preview">
                      <span><label>Aadhaar</label><b className="mono">{k.aadhaar_number || '-'}</b></span>
                      <span><label>PAN</label><b className="mono">{k.pan_number || '-'}</b></span>
                      <span><label>UPI ID</label><b>{row.upi_id || '-'}</b></span>
                      <span><label>DOB</label><b>{k.date_of_birth || '-'}</b></span>
                      <span><label>Gender</label><b>{(k.gender || '-').replace(/_/g, ' ')}</b></span>
                    </div>
                    <span className={`akyc-badge ${k.status}`}>{k.status}</span>
                    {k.status === 'pending' && (
                      <div className="akyc-actions">
                        <button type="button" className="akyc-approve" disabled={busyId === row.id} onClick={() => review(row, 'approve')}>Verify</button>
                        <button type="button" className="akyc-reject" disabled={busyId === row.id} onClick={() => { setRejectTarget(row); setRejectionReason(''); }}>Reject</button>
                      </div>
                    )}
                    <button
                      type="button"
                      className="akyc-expand"
                      aria-label={isExpanded ? 'Hide KYC details' : 'Show all KYC details'}
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    >
                      <ChevronDown size={20} />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="akyc-details">
                      <div className="akyc-fields">
                        <div><label>Address</label><span>{k.address ? [k.address.line, k.address.city, k.address.state, k.address.pincode].filter(Boolean).join(', ') : '-'}</span></div>
                        <div><label>Submitted</label><span>{k.submitted_at ? new Date(k.submitted_at).toLocaleString() : '-'}</span></div>
                      </div>
                      <div className="akyc-docs">
                        {[
                          ['PAN card', k.pan_doc_url],
                          ['Aadhaar front', k.aadhaar_front_url],
                          ['Aadhaar back', k.aadhaar_back_url],
                        ].map(([label, url]) => (
                          <a key={label} className={`akyc-doc ${url ? '' : 'is-missing'}`} href={url ? docUrl(url) : undefined} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} /> {label}{url ? '' : ' - missing'}
                          </a>
                        ))}
                      </div>
                      {k.status === 'rejected' && k.rejection_reason && (
                        <p className="akyc-reason"><strong>Rejected:</strong> {k.rejection_reason}</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {rejectTarget && (
        <div className="akyc-modal-backdrop" role="presentation" onMouseDown={() => setRejectTarget(null)}>
          <section className="akyc-reject-card" role="dialog" aria-modal="true" aria-labelledby="akyc-reject-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="akyc-reject-icon"><XCircle size={22} /></div>
            <div>
              <p className="akyc-reject-eyebrow">KYC decision</p>
              <h2 id="akyc-reject-title">Reject KYC submission</h2>
              <p>
                Tell <strong>{rejectTarget.kyc?.full_legal_name || rejectTarget.kyc?.name_on_pan || rejectTarget.full_name || rejectTarget.name || 'this creator'}</strong> what they need to correct before resubmitting.
              </p>
            </div>
            <label htmlFor="akyc-rejection-reason">Reason for rejection</label>
            <textarea
              id="akyc-rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Example: The Aadhaar image is unclear. Please upload a readable photo showing all four corners."
              rows={4}
              autoFocus
            />
            <small>This message will be shown to the creator.</small>
            <div className="akyc-reject-card-actions">
              <button type="button" className="akyc-modal-cancel" onClick={() => setRejectTarget(null)}>← Back</button>
              <button
                type="button"
                className="akyc-modal-confirm"
                disabled={!rejectionReason.trim() || busyId === rejectTarget.id}
                onClick={() => review(rejectTarget, 'reject', rejectionReason)}
              >
                Reject KYC
              </button>
            </div>
          </section>
        </div>
      )}

      <style>{`
        .akyc-tabs{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}
        .akyc-tabs button{display:inline-flex;align-items:center;gap:7px;border:1.5px solid #e8ecff;background:#fff;color:#5b6573;font:inherit;font-size:13px;font-weight:600;padding:8px 14px;border-radius:10px;cursor:pointer}
        .akyc-tabs button:hover{border-color:#cdd2f3}
        .akyc-tabs button.is-active{background:#07074e;border-color:#07074e;color:#fff}
        .akyc-empty{background:#fff;border:1.5px solid #eef2f9;border-radius:14px;padding:40px;text-align:center;color:#8a90a6}
        .akyc-list{display:flex;flex-direction:column;gap:6px}
        .akyc-card{background:#fff;border:1.5px solid #eef2f9;border-radius:12px;padding:0 16px}
        .akyc{width:100%;min-width:0}
        .akyc-card{width:100%;min-width:0;box-sizing:border-box}
        .akyc-summary{min-height:88px;display:grid;grid-template-columns:minmax(130px,220px) minmax(0,1fr) auto auto 36px;align-items:center;gap:14px}
        .akyc-who{display:flex;align-items:center;gap:10px;min-width:0}
        .akyc-who strong{color:#07074e;font-size:17px}
        .akyc-who small{color:#98a1ad;font-size:12.5px;overflow:hidden;text-overflow:ellipsis}
        .akyc-preview{display:grid;grid-template-columns:1.25fr 1fr 1.35fr 1fr .8fr;align-items:center;gap:16px;color:#111827;font-size:14.5px}
        .akyc-preview span{min-width:0}
        .akyc-preview b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
        .akyc-preview label{display:block;margin-bottom:4px;color:#98a1ad;font-size:11px;font-weight:700;text-transform:uppercase}
        .akyc-badge{text-transform:capitalize;font-size:13px;font-weight:700;padding:5px 12px;border-radius:999px}
        .akyc-badge.pending{background:#fff8ed;color:#b45309}
        .akyc-badge.verified{background:#ecfdf3;color:#067647}
        .akyc-badge.rejected{background:#fef3f2;color:#b42318}
        .akyc-expand{width:36px;height:36px;display:grid;place-items:center;border:0;background:transparent;color:#667085;border-radius:7px;cursor:pointer}
        .akyc-expand:hover{background:#f4f5ff;color:#07074e}
        .akyc-expand svg{transition:transform .2s ease}
        .akyc-expand[aria-expanded="true"] svg{transform:rotate(180deg)}
        .akyc-details{display:grid;grid-template-columns:minmax(0,1fr) minmax(120px,220px) minmax(0,1fr);align-items:center;gap:24px;padding:12px 0;border-top:1px solid #eef2f9}
        .akyc-fields{display:contents}
        .akyc-fields label{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#98a1ad;margin-bottom:3px}
        .akyc-fields span{font-size:13.5px;color:#1a202c;font-weight:600}
        .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em}
        .akyc-docs{display:flex;justify-self:end;gap:8px;flex-wrap:wrap;margin:0}
        .akyc-doc{display:inline-flex;align-items:center;gap:6px;border:1px solid #d6dbff;background:#f8f9ff;color:#4452f0;border-radius:9px;padding:7px 12px;font-size:12.5px;font-weight:600;text-decoration:none}
        .akyc-doc:hover{background:#eef0ff}
        .akyc-doc.is-missing{border-color:#fecdca;background:#fef3f2;color:#b42318;pointer-events:none}
        .akyc-reason{grid-column:1/-1;margin:0;padding:10px 12px;border-radius:10px;background:#fef3f2;color:#b42318;font-size:13px}
        .akyc-actions{display:flex;gap:6px}
        .akyc-approve{border:0;background:#07074e;color:#fff;font:inherit;font-weight:700;font-size:14px;padding:10px 16px;border-radius:9px;cursor:pointer}
        .akyc-approve:hover{background:#14146b}
        .akyc-reject{border:1px solid #fecdca;background:#fff;color:#b42318;font:inherit;font-weight:700;font-size:14px;padding:10px 16px;border-radius:9px;cursor:pointer}
        .akyc-reject:hover{background:#fef3f2}
        .akyc-approve:disabled,.akyc-reject:disabled{opacity:.5;cursor:not-allowed}
        .akyc-modal-backdrop{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;padding:20px;background:rgba(7,7,35,.55);backdrop-filter:blur(3px)}
        .akyc-reject-card{width:min(500px,100%);display:grid;grid-template-columns:42px 1fr;gap:16px 14px;padding:24px;border:1px solid #eceef6;border-radius:14px;background:#fff;box-shadow:0 24px 70px rgba(7,7,35,.24)}
        .akyc-reject-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:10px;background:#fef3f2;color:#b42318}
        .akyc-reject-eyebrow{margin:0 0 3px;color:#b42318;font-size:11px;font-weight:800;text-transform:uppercase}
        .akyc-reject-card h2{margin:0 0 6px;color:#07074e;font-size:20px}
        .akyc-reject-card p{margin:0;color:#667085;font-size:13px;line-height:1.5}
        .akyc-reject-card label,.akyc-reject-card textarea,.akyc-reject-card small,.akyc-reject-card-actions{grid-column:1/-1}
        .akyc-reject-card label{margin-bottom:-9px;color:#344054;font-size:12px;font-weight:700}
        .akyc-reject-card textarea{width:100%;resize:vertical;border:1.5px solid #dfe3ee;border-radius:10px;padding:12px 14px;color:#101828;font:inherit;font-size:13.5px;line-height:1.5;outline:none}
        .akyc-reject-card textarea:focus{border-color:#6d7bff;box-shadow:0 0 0 3px rgba(109,123,255,.12)}
        .akyc-reject-card small{margin-top:-10px;color:#98a2b3;font-size:11.5px}
        .akyc-reject-card-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}
        .akyc-modal-cancel,.akyc-modal-confirm{padding:9px 15px;border-radius:9px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
        .akyc-modal-cancel{border:1px solid #dfe3ee;background:#fff;color:#344054}
        .akyc-modal-confirm{border:1px solid #b42318;background:#b42318;color:#fff}
        .akyc-modal-confirm:disabled{opacity:.45;cursor:not-allowed}
        @media(max-width:1200px){
          .akyc-summary{grid-template-columns:minmax(0,1fr) auto auto 36px;gap:8px}
          .akyc-preview{display:none}
          .akyc-who{flex-direction:column;align-items:flex-start;gap:2px}
          .akyc-details{grid-template-columns:1fr}
          .akyc-fields{display:grid;grid-template-columns:1fr}
          .akyc-docs{justify-self:start;flex-wrap:wrap}
        }
      `}</style>
    </AdminLayout>
  );
}
