import { useCallback, useRef, useState } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Paperclip, X, Info, WifiOff, RefreshCw, Gavel, Clock } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { uploadMedia } from '../../../utils/upload';
import { apiErrorMessage } from '../../../utils/apiError';
import './dispute.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const OFFLINE = "You're offline. Check your connection and try again.";

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
const STEPS = ['Opened', 'Both reply', 'UGCad decides', 'Resolved'];

// Hours left until the 72h response window closes (negative once overdue).
const hoursLeft = (dueAt) => (dueAt ? Math.round((new Date(dueAt).getTime() - Date.now()) / 3600000) : null);

const chipFor = (d, awaiting) => {
  if (awaiting) return ['ap-pill--warn', 'Your reply needed'];
  if (d.status === 'info_requested') return ['ap-pill--muted', 'Waiting on the other side'];
  if (['resolved', 'closed'].includes(d.status)) return ['ap-pill--ok', STATUS_LABELS[d.status]];
  return ['', STATUS_LABELS[d.status] || d.status];
};

export default function Dispute() {
  const { pathname } = useLocation();
  // Screens render outside <Route>, so useParams() is empty: read the id from the path.
  const id = matchPath('/disputes/:id', pathname)?.params?.id;
  const { user } = useAuth();
  const isBrand = user?.role === 'business';

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [evidence, setEvidence] = useState([]); // uploaded file urls
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/disputes/${id}`);
      setDispute(data);
      setLoadError('');
    } catch (e) {
      if (e?.response?.status === 404) setNotFound(true);
      else setLoadError(e?.response ? apiErrorMessage(e, 'Could not load this dispute') : OFFLINE);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useLiveEffect(() => { load(); }, [load]);

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
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
    }
  };

  const submit = async () => {
    if (lock.current) return;
    if (!message.trim()) { toast.error('Please type your response before submitting.'); return; }
    lock.current = true;
    setSubmitting(true);
    try {
      await axios.post(`${API}/disputes/${id}/respond`, { message: message.trim(), evidence_urls: evidence });
      toast.success('Response submitted - the platform team will review it.');
      setMessage('');
      setEvidence([]);
      await load();
    } catch (e) {
      toast.error(e?.response ? apiErrorMessage(e, 'Could not submit your response') : OFFLINE);
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };

  const awaiting = dispute?.awaiting_my_response;
  const hrs = hoursLeft(dispute?.info_request_due_at);
  const overdue = hrs != null && hrs < 0;
  // Progress derived from the real status: info_requested = both sides replying, open/appealed = the team is deciding, resolved/closed = done.
  const stage = !dispute ? 1 : ({ info_requested: 1, open: 2, appealed: 2, resolved: 3, closed: 3 }[dispute.status] ?? 1);
  const stepState = (i) => (stage === 3 || i <= stage - 1 ? 'done' : i === stage ? 'now' : 'todo');
  const chip = dispute ? chipFor(dispute, awaiting) : null;
  const backTo = window.history.length > 1 ? true : (isBrand ? '/dashboard/business/all-campaigns' : '/my-deals');

  return (
    <AppShell back={backTo} title="Dispute" subtitle={dispute?.campaign_title || undefined} tabs={false}>
      {loading ? (
        <div aria-hidden="true" className="ap-ds-col">
          <div className="ap-skel" style={{ height: 120, borderRadius: 20 }} />
          <div className="ap-skel" style={{ height: 76, borderRadius: 20 }} />
          <div className="ap-skel" style={{ height: 180, borderRadius: 20 }} />
        </div>
      ) : loadError && !dispute ? (
        <div className="ap-card ap-empty" role="alert">
          {loadError === OFFLINE ? <WifiOff size={34} /> : <Gavel size={34} />}
          <h3>Could not load this dispute</h3>
          <p>{loadError}</p>
          <button type="button" className="ap-btn" onClick={() => { setLoading(true); load(); }}><RefreshCw size={16} /> Retry</button>
        </div>
      ) : notFound || !dispute ? (
        <div className="ap-card ap-empty">
          <Gavel size={34} />
          <h3>Dispute not found</h3>
          <p>This dispute doesn’t exist or you don’t have access to it.</p>
        </div>
      ) : (
        <>
          <section className="ap-card ap-ds-head">
            <div className="ap-ds-meta">
              <span className={`ap-pill ${chip[0]}`}>{chip[1]}</span>
              <small>{DTYPE_LABELS[dispute.dispute_type] || 'Dispute'} · opened {fmtDay(dispute.created_at)}{dispute.deal_id ? ` · Deal ${dispute.deal_id}` : ''}</small>
            </div>
            <h2>{dispute.campaign_title || 'Dispute'}</h2>
            <ol className="ap-ds-steps" aria-label="Dispute progress">
              {STEPS.map((label, i) => (
                <li key={label} className={`is-${stepState(i)}`}><i aria-hidden="true" /><span>{label}</span></li>
              ))}
            </ol>
          </section>

          {awaiting && (
            <>
              <section className="ap-ds-ask">
                <div className="ap-ds-eyebrow">UGCad needs your side of the story</div>
                {dispute.info_request_due_at && (
                  <div className={`ap-ds-due${overdue ? ' is-over' : ''}`}>
                    <Clock size={15} />
                    {overdue ? `Response window closed ${Math.abs(hrs)}h ago - please still reply` : `Please respond within 72 hours (about ${hrs}h left)`}
                  </div>
                )}
                {dispute.info_request_message && (
                  <p className="ap-ds-ask-msg"><b>UGCad support</b>“{dispute.info_request_message}”</p>
                )}
                {dispute.info_request_due_at && <small>Reply by {fmtDate(dispute.info_request_due_at)}</small>}
              </section>

              <section className="ap-card ap-ds-form">
                <h3>Tell us what happened</h3>
                <label className="ap-label" htmlFor="ap-ds-response">
                  Your response
                  <textarea id="ap-ds-response" className="ap-input" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Explain your side and add any details the team asked for…" />
                </label>
                <h3>Add proof <small>optional</small></h3>
                <div className="ap-ds-files">
                  {evidence.map((u, i) => (
                    <span key={u} className="ap-ds-file">
                      <Paperclip size={14} /> Attachment {i + 1}
                      <button type="button" onClick={() => setEvidence((prev) => prev.filter((x) => x !== u))} aria-label={`Remove attachment ${i + 1}`}><X size={14} /></button>
                    </span>
                  ))}
                  <label className={`ap-ds-upload${uploading ? ' is-busy' : ''}`}>
                    <Paperclip size={16} /> {uploading ? 'Uploading…' : 'Add photo, video or PDF'}
                    <input type="file" multiple accept="image/*,video/*,.pdf" onChange={onPickFiles} hidden disabled={uploading} />
                  </label>
                </div>
                <button type="button" className="ap-btn ap-btn--block" style={{ height: 50 }} onClick={submit} disabled={submitting || uploading}>
                  {submitting ? 'Submitting…' : 'Submit response'}
                </button>
                <small className="ap-ds-hint">Your reply goes to the UGCad team.</small>
              </section>
            </>
          )}

          {!awaiting && dispute.status === 'info_requested' && (
            <div className="ap-ds-note"><Info size={18} /><span>The platform team has asked the other party for more information. Nothing is needed from you right now.</span></div>
          )}

          <section className="ap-card ap-ds-about">
            <h3>What this dispute is about</h3>
            {dispute.description && <p className="ap-ds-desc">{dispute.description}</p>}
            <dl>
              <div><dt>Type</dt><dd>{DTYPE_LABELS[dispute.dispute_type] || dispute.dispute_type || '-'}</dd></div>
              {dispute.desired_outcome && <div><dt>Requested outcome</dt><dd style={{ textTransform: 'capitalize' }}>{String(dispute.desired_outcome).replace(/_/g, ' ')}</dd></div>}
              <div><dt>Raised</dt><dd>{fmtDate(dispute.created_at)}</dd></div>
            </dl>
            {Array.isArray(dispute.evidence_urls) && dispute.evidence_urls.length > 0 && (
              <div className="ap-ds-files">
                {dispute.evidence_urls.map((u, i) => (
                  <a key={u} className="ap-ds-file" href={assetUrl(u)} target="_blank" rel="noreferrer"><Paperclip size={14} /> Evidence {i + 1}</a>
                ))}
              </div>
            )}
          </section>

          {Array.isArray(dispute.info_responses) && dispute.info_responses.length > 0 && (
            <section className="ap-card ap-ds-tl">
              <h3>What happened so far</h3>
              {dispute.info_responses.map((r) => {
                const mine = r.party === dispute.my_party;
                const who = mine ? 'You' : r.party;
                return (
                  <div key={r.id} className={`ap-ds-tl-i${mine ? ' is-me' : ''}`}>
                    <b aria-hidden="true">{String(who || '?').charAt(0).toUpperCase()}</b>
                    <div>
                      <div className="ap-ds-who">{who}<small>{fmtDate(r.at)}</small></div>
                      <p>{r.message}</p>
                      {Array.isArray(r.evidence_urls) && r.evidence_urls.length > 0 && (
                        <div className="ap-ds-files">
                          {r.evidence_urls.map((u, i) => (
                            <a key={u} className="ap-ds-file" href={assetUrl(u)} target="_blank" rel="noreferrer"><Paperclip size={14} /> Attachment {i + 1}</a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          <div className="ap-ds-note"><Info size={18} /><span><strong>What happens next:</strong> once both sides reply, UGCad reviews everything and decides.</span></div>
        </>
      )}
    </AppShell>
  );
}
