import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Clock, Paperclip, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../App';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import { apiErrorMessage } from '../utils/apiError';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const DTYPE_LABELS = {
  scope_creep: 'Scope creep',
  damaged_product: 'Damaged / wrong product',
  quality: 'Quality of work',
  non_delivery: 'Non-delivery',
  payment: 'Payment issue',
  general: 'General dispute',
};
const STATUS_LABELS = {
  open: 'Under review',
  info_requested: 'Awaiting your response',
  resolved: 'Resolved',
  closed: 'Closed',
  appealed: 'Appealed',
};
const fmtDate = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${String(u).startsWith('/') ? '' : '/'}${u}`));

// Hours left until the 72h response window closes (negative once overdue).
function hoursLeft(dueAt) {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - Date.now();
  return Math.round(ms / 3600000);
}

export default function DisputeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBrand = user?.role === 'business';
  const Layout = isBrand ? BrandTopNavLayout : CreatorTopNavLayout;

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [message, setMessage] = useState('');
  const [evidence, setEvidence] = useState([]); // uploaded file urls
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/disputes/${id}`);
      setDispute(data);
    } catch (e) {
      if (e?.response?.status === 404) setNotFound(true);
      else toast.error(apiErrorMessage(e, 'Could not load this dispute'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await axios.post(`${API}/upload/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (res.data?.file_url) urls.push(res.data.file_url);
      }
      setEvidence((prev) => [...prev, ...urls]);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not upload that file'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const submit = async () => {
    if (!message.trim()) { toast.error('Please type your response before submitting.'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/disputes/${id}/respond`, { message: message.trim(), evidence_urls: evidence });
      toast.success('Response submitted — the platform team will review it.');
      setMessage('');
      setEvidence([]);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not submit your response'));
    } finally {
      setSubmitting(false);
    }
  };

  const awaiting = dispute?.awaiting_my_response;
  const hrs = hoursLeft(dispute?.info_request_due_at);

  return (
    <Layout notifications={0}>
      <div className="dd-wrap">
        <button type="button" className="dd-back" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>

        {loading ? (
          <div className="dd-empty">Loading dispute…</div>
        ) : notFound || !dispute ? (
          <div className="dd-empty">This dispute doesn’t exist or you don’t have access to it.</div>
        ) : (
          <>
            <div className="dd-head">
              <div>
                <h1>Dispute</h1>
                <p>{DTYPE_LABELS[dispute.dispute_type] || 'Dispute'} · Deal {dispute.deal_id || '—'}{dispute.campaign_title ? ` · ${dispute.campaign_title}` : ''}</p>
              </div>
              <span className={`dd-status dd-status--${dispute.status}`}>{STATUS_LABELS[dispute.status] || dispute.status}</span>
            </div>

            {/* The admin's open information request — the whole reason this page exists. */}
            {awaiting && (
              <section className="dd-req">
                <div className="dd-req-head">
                  <span className="dd-req-ic"><ShieldAlert size={18} /></span>
                  <div>
                    <strong>The platform team needs more information</strong>
                    {dispute.info_request_due_at && (
                      <p className={`dd-due ${hrs != null && hrs < 0 ? 'over' : ''}`}>
                        <Clock size={13} /> {hrs != null && hrs < 0
                          ? `Response window closed ${Math.abs(hrs)}h ago — please still reply`
                          : `Please respond within 72 hours (about ${hrs}h left)`}
                      </p>
                    )}
                  </div>
                </div>
                {dispute.info_request_message && (
                  <blockquote className="dd-req-msg">“{dispute.info_request_message}”</blockquote>
                )}

                <label className="dd-label">Your response</label>
                <textarea
                  className="dd-textarea"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Explain your side and add any details the team asked for…"
                />

                <div className="dd-evidence">
                  {evidence.map((u, i) => (
                    <span key={u} className="dd-file">
                      <Paperclip size={13} /> Attachment {i + 1}
                      <button type="button" onClick={() => setEvidence((prev) => prev.filter((x) => x !== u))} aria-label="Remove"><X size={13} /></button>
                    </span>
                  ))}
                  <label className="dd-upload">
                    <Paperclip size={15} /> {uploading ? 'Uploading…' : 'Attach evidence'}
                    <input type="file" multiple accept="image/*,video/*,.pdf" onChange={onPickFiles} hidden disabled={uploading} />
                  </label>
                </div>

                <button type="button" className="dd-submit" onClick={submit} disabled={submitting || uploading}>
                  {submitting ? 'Submitting…' : 'Submit response'}
                </button>
              </section>
            )}

            {!awaiting && dispute.status === 'info_requested' && (
              <section className="dd-note">The platform team has asked the other party for more information. Nothing is needed from you right now.</section>
            )}

            {/* Any responses already submitted. */}
            {Array.isArray(dispute.info_responses) && dispute.info_responses.length > 0 && (
              <section className="dd-card">
                <h3>Responses submitted</h3>
                {dispute.info_responses.map((r) => (
                  <div key={r.id} className="dd-resp">
                    <div className="dd-resp-head"><CheckCircle2 size={14} /> {r.party === dispute.my_party ? 'You' : r.party} · {fmtDate(r.at)}</div>
                    <p>{r.message}</p>
                    {Array.isArray(r.evidence_urls) && r.evidence_urls.length > 0 && (
                      <div className="dd-evidence">
                        {r.evidence_urls.map((u, i) => (
                          <a key={u} className="dd-file" href={assetUrl(u)} target="_blank" rel="noreferrer"><Paperclip size={13} /> Attachment {i + 1}</a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* Read-only context: what the dispute is about. */}
            <section className="dd-card">
              <h3>What this dispute is about</h3>
              {dispute.description && <p className="dd-desc">{dispute.description}</p>}
              <div className="dd-kv"><span>Type</span><strong>{DTYPE_LABELS[dispute.dispute_type] || dispute.dispute_type || '—'}</strong></div>
              {dispute.desired_outcome && <div className="dd-kv"><span>Requested outcome</span><strong>{String(dispute.desired_outcome).replace(/_/g, ' ')}</strong></div>}
              <div className="dd-kv"><span>Raised</span><strong>{fmtDate(dispute.created_at)}</strong></div>
              {Array.isArray(dispute.evidence_urls) && dispute.evidence_urls.length > 0 && (
                <div className="dd-evidence">
                  {dispute.evidence_urls.map((u, i) => (
                    <a key={u} className="dd-file" href={assetUrl(u)} target="_blank" rel="noreferrer"><Paperclip size={13} /> Evidence {i + 1}</a>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <style>{`
        .dd-wrap{max-width:760px;margin:0 auto;padding:8px 4px 40px}
        .dd-back{display:inline-flex;align-items:center;gap:6px;background:none;border:none;color:#5b6bff;font:inherit;font-weight:600;cursor:pointer;margin-bottom:14px}
        .dd-empty{padding:60px 20px;text-align:center;color:#6b7094;font-size:14.5px}
        .dd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}
        .dd-head h1{margin:0 0 4px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:24px;color:#15163a}
        .dd-head p{margin:0;color:#6b7094;font-size:13.5px}
        .dd-status{flex:none;font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px;background:#eef0ff;color:#5b6bff;white-space:nowrap}
        .dd-status--info_requested{background:#fff4e5;color:#b45309}
        .dd-status--resolved,.dd-status--closed{background:#e9f9ef;color:#15803d}
        .dd-req{border:1px solid #ffe0b3;background:#fffaf2;border-radius:16px;padding:20px;margin-bottom:18px}
        .dd-req-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}
        .dd-req-ic{flex:none;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:#ffedd5;color:#b45309}
        .dd-req-head strong{display:block;color:#15163a;font-size:15.5px}
        .dd-due{margin:4px 0 0;display:flex;align-items:center;gap:5px;color:#b45309;font-size:12.5px;font-weight:600}
        .dd-due.over{color:#dc2626}
        .dd-req-msg{margin:0 0 16px;padding:12px 14px;border-left:3px solid #f0b866;background:#fff;border-radius:8px;color:#4a4d6a;font-size:14px;line-height:1.55}
        .dd-label{display:block;font-size:12.5px;font-weight:700;color:#5b6573;margin-bottom:6px}
        .dd-textarea{width:100%;border:1px solid #e6e8f3;border-radius:12px;padding:12px 14px;font:inherit;font-size:14px;color:#15163a;resize:vertical;outline:none;background:#fff}
        .dd-textarea:focus{border-color:#5b6bff;box-shadow:0 0 0 3px rgba(91,107,255,.14)}
        .dd-evidence{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
        .dd-file{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#4a4d6a;background:#f1f3fa;border:1px solid #e6e8f3;border-radius:9px;padding:6px 10px;text-decoration:none}
        .dd-file button{border:none;background:none;cursor:pointer;color:#9296ba;display:grid;place-items:center;padding:0}
        .dd-upload{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#5b6bff;background:#eef0ff;border:1px dashed #b9c0ff;border-radius:9px;padding:7px 12px;cursor:pointer}
        .dd-submit{margin-top:16px;width:100%;border:none;border-radius:12px;padding:13px;background:#12124f;color:#fff;font:inherit;font-weight:700;font-size:14.5px;cursor:pointer}
        .dd-submit:hover:not(:disabled){background:#07074e}
        .dd-submit:disabled{opacity:.55;cursor:not-allowed}
        .dd-note{border:1px solid #dfe3f2;background:#f7f8fc;border-radius:14px;padding:16px 18px;color:#5b6573;font-size:13.5px;margin-bottom:18px}
        .dd-card{border:1px solid #eef0f6;border-radius:16px;padding:18px 20px;margin-bottom:16px;background:#fff}
        .dd-card h3{margin:0 0 12px;font-size:14px;font-weight:800;color:#15163a}
        .dd-desc{margin:0 0 14px;color:#4a4d6a;font-size:14px;line-height:1.6}
        .dd-kv{display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-top:1px solid #f3f4f9;font-size:13.5px}
        .dd-kv:first-of-type{border-top:none}
        .dd-kv span{color:#9296ba}
        .dd-kv strong{color:#15163a;text-transform:capitalize}
        .dd-resp{padding:12px 0;border-top:1px solid #f3f4f9}
        .dd-resp:first-of-type{border-top:none}
        .dd-resp-head{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#15803d;margin-bottom:5px}
        .dd-resp p{margin:0;color:#4a4d6a;font-size:14px;line-height:1.55}
      `}</style>
    </Layout>
  );
}
