import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { uploadMedia } from '../utils/upload';
import { toast } from 'sonner';
import { Paperclip, X, Info } from 'lucide-react';
import { useAuth } from '../App';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import { apiErrorMessage } from '../utils/apiError';
import '../styles/brand-ui.css';
import '../styles/brand-ui-dispute.css';
import '../styles/brand-ui-mobile-b.css';
import BackButton from '../components/BackButton';

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
const fmtDate = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-');
const fmtDay = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-');
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
  const [loadError, setLoadError] = useState('');

  const [message, setMessage] = useState('');
  const [evidence, setEvidence] = useState([]); // uploaded file urls
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/disputes/${id}`);
      setDispute(data);
      setLoadError('');
    } catch (e) {
      if (e?.response?.status === 404) setNotFound(true);
      else setLoadError(e?.response ? apiErrorMessage(e, 'Could not load this dispute') : "You're offline. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useLiveEffect(() => { load(); }, [load]);

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const data = await uploadMedia(file, API);
        if (data?.file_url) urls.push(data.file_url);
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
      toast.success('Response submitted - the platform team will review it.');
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
  const overdue = hrs != null && hrs < 0;
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/my-deals'));

  // Progress bar is derived from the real status: info_requested = both sides replying,
  // open/appealed = the team is deciding, resolved/closed = done.
  const stage = !dispute ? 1 : ({ info_requested: 1, open: 2, appealed: 2, resolved: 3, closed: 3 }[dispute.status] ?? 1);
  const STEPS = ['Dispute opened', 'Both sides reply', 'UGCad decides', 'Resolved'];
  const stepState = (i) => (stage === 3 || i <= stage - 1 ? 'done' : i === stage ? 'now' : 'todo');

  const chip = !dispute ? null
    : awaiting ? ['dd-chip--warn', 'Your reply needed']
    : dispute.status === 'info_requested' ? ['dd-chip--muted', 'Waiting on the other side']
    : ['resolved', 'closed'].includes(dispute.status) ? ['dd-chip--ok', STATUS_LABELS[dispute.status]]
    : ['', STATUS_LABELS[dispute.status] || dispute.status];

  return (
    <Layout notifications={0}>
      <div className="bui-main bui-main--tight dd-wrap">
        <BackButton onClick={goBack} />

        {loading ? (
          <div className="dd-empty">Loading dispute…</div>
        ) : loadError && !dispute ? (
          <div className="dd-empty">
            <p>{loadError}</p>
            <button type="button" className="dd-submit" onClick={() => { setLoading(true); load(); }}>Retry</button>
          </div>
        ) : notFound || !dispute ? (
          <div className="dd-empty">This dispute doesn’t exist or you don’t have access to it.</div>
        ) : (
          <>
            <div className="dd-head">
              <div>
                <div className="dd-meta">
                  <span className={`dd-chip ${chip[0]}`}>{chip[1]}</span>
                  <small>{DTYPE_LABELS[dispute.dispute_type] || 'Dispute'} · opened {fmtDay(dispute.created_at)}{dispute.deal_id ? ` · Deal ${dispute.deal_id}` : ''}</small>
                </div>
                <h1 className="dd-h1">{dispute.campaign_title || 'Dispute'}</h1>
              </div>
            </div>

            <section className="dd-card" aria-label="Dispute progress">
              <div className="dd-steps" role="list">
                {STEPS.map((label, i) => (
                  <div key={label} role="listitem" className={`dd-step is-${stepState(i)}`}><i aria-hidden="true" /><span>{label}</span></div>
                ))}
              </div>
            </section>

            <div className="dd-grid">
              <div className="dd-col">
                {/* The admin's open information request — the whole reason this page exists. */}
                {awaiting && (
                  <>
                    <section className="dd-hero">
                      <div className="dd-hero-top">
                        <div>
                          <div className="dd-hero-eyebrow">UGCad needs your side of the story</div>
                          {dispute.info_request_due_at && (
                            <div className={`dd-hero-title${overdue ? ' over' : ''}`}>
                              {overdue
                                ? `Response window closed ${Math.abs(hrs)}h ago - please still reply`
                                : `Please respond within 72 hours (about ${hrs}h left)`}
                            </div>
                          )}
                        </div>
                        {dispute.info_request_due_at && <span className="dd-hero-pill">by {fmtDate(dispute.info_request_due_at)}</span>}
                      </div>
                      {dispute.info_request_message && (
                        <div className="dd-hero-msg">
                          <b>U</b>
                          <div><strong>UGCad support</strong><br />“{dispute.info_request_message}”</div>
                        </div>
                      )}
                    </section>

                    <section className="dd-card">
                      <h2>Tell us what happened</h2>
                      <label className="dd-label" htmlFor="dd-response">Your response</label>
                      <textarea
                        id="dd-response"
                        className="dd-textarea"
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Explain your side and add any details the team asked for…"
                      />
                      <h2>Add proof <small>optional</small></h2>
                      <div className="dd-evidence">
                        {evidence.map((u, i) => (
                          <span key={u} className="dd-file">
                            <Paperclip size={14} /> Attachment {i + 1}
                            <button type="button" onClick={() => setEvidence((prev) => prev.filter((x) => x !== u))} aria-label="Remove"><X size={14} /></button>
                          </span>
                        ))}
                        <label className="dd-upload">
                          <Paperclip size={15} /> {uploading ? 'Uploading…' : 'Add photo, video or PDF'}
                          <input type="file" multiple accept="image/*,video/*,.pdf" onChange={onPickFiles} hidden disabled={uploading} />
                        </label>
                      </div>
                      <div className="dd-foot">
                        <small>Your reply goes to the UGCad team.</small>
                        <button type="button" className="dd-submit" onClick={submit} disabled={submitting || uploading}>
                          {submitting ? 'Submitting…' : 'Submit response'}
                        </button>
                      </div>
                    </section>
                  </>
                )}

                {!awaiting && dispute.status === 'info_requested' && (
                  <section className="dd-note">The platform team has asked the other party for more information. Nothing is needed from you right now.</section>
                )}

                {/* Any responses already submitted. */}
                {Array.isArray(dispute.info_responses) && dispute.info_responses.length > 0 && (
                  <section className="dd-card">
                    <h2>What happened so far</h2>
                    <div className="dd-tl">
                      {dispute.info_responses.map((r) => {
                        const mine = r.party === dispute.my_party;
                        const who = mine ? 'You' : r.party;
                        return (
                          <div key={r.id} className={`dd-tl-item${mine ? ' me' : ''}`}>
                            <b>{String(who || '?').charAt(0).toUpperCase()}</b>
                            <div>
                              <div className="dd-tl-who">{who}<small>· {fmtDate(r.at)}</small></div>
                              <p>{r.message}</p>
                              {Array.isArray(r.evidence_urls) && r.evidence_urls.length > 0 && (
                                <div className="dd-evidence">
                                  {r.evidence_urls.map((u, i) => (
                                    <a key={u} className="dd-file" href={assetUrl(u)} target="_blank" rel="noreferrer"><Paperclip size={14} /> Attachment {i + 1}</a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

              <aside className="dd-col">
                {/* Read-only context: what the dispute is about. */}
                <section className="dd-card">
                  <h2>What this dispute is about</h2>
                  {dispute.description && <p className="dd-desc">{dispute.description}</p>}
                  <div>
                    <div className="dd-kv"><span>Type</span><strong>{DTYPE_LABELS[dispute.dispute_type] || dispute.dispute_type || '-'}</strong></div>
                    {dispute.desired_outcome && <div className="dd-kv"><span>Requested outcome</span><strong>{String(dispute.desired_outcome).replace(/_/g, ' ')}</strong></div>}
                    <div className="dd-kv"><span>Raised</span><strong>{fmtDate(dispute.created_at)}</strong></div>
                  </div>
                  {Array.isArray(dispute.evidence_urls) && dispute.evidence_urls.length > 0 && (
                    <div className="dd-evidence">
                      {dispute.evidence_urls.map((u, i) => (
                        <a key={u} className="dd-file" href={assetUrl(u)} target="_blank" rel="noreferrer"><Paperclip size={14} /> Evidence {i + 1}</a>
                      ))}
                    </div>
                  )}
                </section>
                <div className="dd-next">
                  <Info size={18} />
                  <span><strong>What happens next:</strong> once both sides reply, UGCad reviews everything and decides.</span>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
