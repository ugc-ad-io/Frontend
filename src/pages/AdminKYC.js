import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { BadgeCheck, ExternalLink, Hourglass, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const docUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${String(u).startsWith('/') ? '' : '/'}${u}`));

const TABS = [
  { key: 'pending', label: 'Pending', Icon: Hourglass },
  { key: 'verified', label: 'Verified', Icon: CheckCircle2 },
  { key: 'rejected', label: 'Rejected', Icon: XCircle },
  { key: 'all', label: 'All', Icon: BadgeCheck },
];

export default function AdminKYC() {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

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

  useEffect(() => { load(tab); /* eslint-disable-next-line */ }, [tab]);

  const review = async (row, action, reason = '') => {
    if (action === 'reject' && !reason.trim()) return;
    setBusyId(row.id);
    try {
      await axios.post(`${API}/admin/kyc/${row.id}/review`, { action, reason });
      toast.success(action === 'approve' ? 'KYC verified — the creator can now withdraw.' : 'KYC rejected.');
      if (action === 'reject') {
        setRejectTarget(null);
        setRejectionReason('');
      }
      load(tab);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save the decision'));
    } finally { setBusyId(null); }
  };

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
                      <strong>{k.full_legal_name || k.name_on_pan || row.full_name || row.name || row.email || '—'}</strong>
                    </div>
                    <div className="akyc-preview">
                      <span><label>Aadhaar</label><b className="mono">{k.aadhaar_number || '—'}</b></span>
                      <span><label>PAN</label><b className="mono">{k.pan_number || '—'}</b></span>
                      <span><label>UPI ID</label><b>{row.upi_id || '—'}</b></span>
                      <span><label>DOB</label><b>{k.date_of_birth || '—'}</b></span>
                      <span><label>Gender</label><b>{(k.gender || '—').replace(/_/g, ' ')}</b></span>
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
                        <div><label>Address</label><span>{k.address ? [k.address.line, k.address.city, k.address.state, k.address.pincode].filter(Boolean).join(', ') : '—'}</span></div>
                        <div><label>Submitted</label><span>{k.submitted_at ? new Date(k.submitted_at).toLocaleString() : '—'}</span></div>
                      </div>
                      <div className="akyc-docs">
                        {[
                          ['PAN card', k.pan_doc_url],
                          ['Aadhaar front', k.aadhaar_front_url],
                          ['Aadhaar back', k.aadhaar_back_url],
                        ].map(([label, url]) => (
                          <a key={label} className={`akyc-doc ${url ? '' : 'is-missing'}`} href={url ? docUrl(url) : undefined} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} /> {label}{url ? '' : ' — missing'}
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
              <button type="button" className="akyc-modal-cancel" onClick={() => setRejectTarget(null)}>Cancel</button>
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
        .akyc-summary{min-height:88px;display:grid;grid-template-columns:220px minmax(600px,1fr) auto auto 36px;align-items:center;gap:14px}
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
        .akyc-details{display:grid;grid-template-columns:minmax(360px,520px) 220px 1fr;align-items:center;gap:24px;padding:12px 0;border-top:1px solid #eef2f9}
        .akyc-fields{display:contents}
        .akyc-fields label{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#98a1ad;margin-bottom:3px}
        .akyc-fields span{font-size:13.5px;color:#1a202c;font-weight:600}
        .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em}
        .akyc-docs{display:flex;justify-self:end;gap:8px;flex-wrap:nowrap;margin:0}
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
        @media(max-width:900px){
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
