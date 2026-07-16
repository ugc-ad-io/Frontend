import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { BadgeCheck, ExternalLink, Hourglass, CheckCircle2, XCircle } from 'lucide-react';
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

  const review = async (row, action) => {
    let reason = '';
    if (action === 'reject') {
      // The creator only learns what to fix from this, so it is required.
      reason = window.prompt(`Why is ${row.nickname || row.email}'s KYC being rejected?\n\nThey will see this message.`) || '';
      if (!reason.trim()) return;
    }
    setBusyId(row.id);
    try {
      await axios.post(`${API}/admin/kyc/${row.id}/review`, { action, reason });
      toast.success(action === 'approve' ? 'KYC verified — the creator can now withdraw.' : 'KYC rejected.');
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
              return (
                <article key={row.id} className="akyc-card" data-testid={`kyc-row-${row.id}`}>
                  <div className="akyc-who">
                    <strong>{row.nickname || (row.username ? `@${row.username}` : row.email)}</strong>
                    <small>{row.email}</small>
                    <span className={`akyc-badge ${k.status}`}>{k.status}</span>
                  </div>

                  <div className="akyc-fields">
                    <div><label>Legal name</label><span>{k.full_legal_name || k.name_on_pan || '—'}</span></div>
                    <div><label>DOB</label><span>{k.date_of_birth || '—'}</span></div>
                    <div><label>Gender</label><span>{(k.gender || '—').replace(/_/g, ' ')}</span></div>
                    <div><label>PAN</label><span className="mono">{k.pan_number || '—'}</span></div>
                    <div><label>Aadhaar</label><span className="mono">{k.aadhaar_number || '—'}</span></div>
                    <div><label>Address</label><span>{k.address ? [k.address.line, k.address.city, k.address.state, k.address.pincode].filter(Boolean).join(', ') : '—'}</span></div>
                    <div><label>Payout</label><span>
                      {row.upi_id
                        ? `UPI · ${row.upi_id}`
                        : row.bank_details?.account_number
                          ? `Bank · ${row.bank_details.account_number} (${row.bank_details.ifsc_code})`
                          : (k.payout_method || '—')}
                    </span></div>
                    <div><label>Submitted</label><span>{k.submitted_at ? new Date(k.submitted_at).toLocaleString() : '—'}</span></div>
                  </div>

                  <div className="akyc-docs">
                    {[
                      ['PAN card', k.pan_doc_url],
                      ['Selfie with ID', k.selfie_url],
                      ['Aadhaar front', k.aadhaar_front_url],
                      ['Aadhaar back', k.aadhaar_back_url],
                    ].map(([label, url]) => (
                      <a
                        key={label}
                        className={`akyc-doc ${url ? '' : 'is-missing'}`}
                        href={url ? docUrl(url) : undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={14} /> {label}{url ? '' : ' — missing'}
                      </a>
                    ))}
                  </div>

                  {k.status === 'rejected' && k.rejection_reason && (
                    <p className="akyc-reason"><strong>Rejected:</strong> {k.rejection_reason}</p>
                  )}

                  {k.status === 'pending' && (
                    <div className="akyc-actions">
                      <button type="button" className="akyc-approve" disabled={busyId === row.id} onClick={() => review(row, 'approve')}>
                        Verify
                      </button>
                      <button type="button" className="akyc-reject" disabled={busyId === row.id} onClick={() => review(row, 'reject')}>
                        Reject
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .akyc-tabs{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}
        .akyc-tabs button{display:inline-flex;align-items:center;gap:7px;border:1.5px solid #e8ecff;background:#fff;color:#5b6573;font:inherit;font-size:13px;font-weight:600;padding:8px 14px;border-radius:10px;cursor:pointer}
        .akyc-tabs button:hover{border-color:#cdd2f3}
        .akyc-tabs button.is-active{background:#07074e;border-color:#07074e;color:#fff}
        .akyc-empty{background:#fff;border:1.5px solid #eef2f9;border-radius:14px;padding:40px;text-align:center;color:#8a90a6}
        .akyc-list{display:flex;flex-direction:column;gap:12px}
        .akyc-card{background:#fff;border:1.5px solid #eef2f9;border-radius:14px;padding:18px 20px}
        .akyc-who{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
        .akyc-who strong{color:#07074e;font-size:15px}
        .akyc-who small{color:#98a1ad;font-size:12.5px}
        .akyc-badge{margin-left:auto;text-transform:capitalize;font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:999px}
        .akyc-badge.pending{background:#fff8ed;color:#b45309}
        .akyc-badge.verified{background:#ecfdf3;color:#067647}
        .akyc-badge.rejected{background:#fef3f2;color:#b42318}
        .akyc-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;padding:14px 0;border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9}
        .akyc-fields label{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#98a1ad;margin-bottom:3px}
        .akyc-fields span{font-size:13.5px;color:#1a202c;font-weight:600}
        .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em}
        .akyc-docs{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
        .akyc-doc{display:inline-flex;align-items:center;gap:6px;border:1px solid #d6dbff;background:#f8f9ff;color:#4452f0;border-radius:9px;padding:7px 12px;font-size:12.5px;font-weight:600;text-decoration:none}
        .akyc-doc:hover{background:#eef0ff}
        .akyc-doc.is-missing{border-color:#fecdca;background:#fef3f2;color:#b42318;pointer-events:none}
        .akyc-reason{margin:14px 0 0;padding:10px 12px;border-radius:10px;background:#fef3f2;color:#b42318;font-size:13px}
        .akyc-actions{display:flex;gap:8px;margin-top:16px}
        .akyc-approve{border:0;background:#07074e;color:#fff;font:inherit;font-weight:700;font-size:13px;padding:9px 18px;border-radius:9px;cursor:pointer}
        .akyc-approve:hover{background:#14146b}
        .akyc-reject{border:1px solid #fecdca;background:#fff;color:#b42318;font:inherit;font-weight:700;font-size:13px;padding:9px 18px;border-radius:9px;cursor:pointer}
        .akyc-reject:hover{background:#fef3f2}
        .akyc-approve:disabled,.akyc-reject:disabled{opacity:.5;cursor:not-allowed}
      `}</style>
    </AdminLayout>
  );
}
