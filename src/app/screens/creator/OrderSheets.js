// Bottom sheets + the booking panel used by the creator Order room (design boards CMobilePopups2 / CMobileStates2).
import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertTriangle, Check, Clock, FileText, Film, Image as ImageIcon, IndianRupee, MapPin, Paperclip,
  Play, Send, ShieldCheck, Truck, X,
} from 'lucide-react';
import { apiErrorMessage } from '../../../utils/apiError';
import { MAX_UPLOAD_MB } from '../../../utils/upload';
import { inr } from '../../../utils/orderUi';
import BottomSheet from '../../shell/BottomSheet';
import {
  API, getRequiredAssets, uploadStage, canSubmitUploadedAssets, missingAssets,
} from './orderLogic';

const Busy = ({ pct }) => (
  <div className="ap-or-bar2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
);

// One labelled upload row: native file picker through a <label>, progress bar while it uploads.
function Slot({ icon: Icon, title, hint, accept, name, done, pct, disabled, onPick, onClear, testId }) {
  const uploading = pct != null;
  return (
    <div className={`ap-or-slot${done ? ' is-done' : ''}`}>
      <span className="ico">{done ? <Check size={20} /> : <Icon size={20} />}</span>
      <div className="ap-grow" style={{ flex: 1, minWidth: 0 }}>
        <div className="t">{title}</div>
        <div className="s">{uploading ? (pct >= 100 ? 'Processing…' : `Uploading ${pct}%`) : done ? (name || 'Uploaded') : hint}</div>
        {uploading && <Busy pct={pct} />}
      </div>
      {done && !uploading ? (
        <button type="button" className="ap-bar-btn" aria-label={`Remove ${title}`} onClick={onClear}><X size={18} /></button>
      ) : (
        <label className="ap-or-btn ap-or-btn--soft" style={uploading || disabled ? { opacity: 0.55, pointerEvents: 'none' } : undefined}>
          {done ? 'Replace' : 'Choose'}
          <input
            type="file"
            hidden
            accept={accept}
            data-testid={testId}
            disabled={disabled || uploading}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPick(f); }}
          />
        </label>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Upload + send the delivery (website: ContentSubmission card + handleSubmitContent)
// ---------------------------------------------------------------------------------------------
export function DeliverSheet({ open, onClose, deal, brandName, uploads, names, uploading, onPick, onClear, onSubmit, submitting, revision, net }) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (!open) setConfirm(false); }, [open]);
  const required = getRequiredAssets(deal);
  const stage = uploadStage(deal);
  const content = deal?.content_submission || {};
  const unlocked = Boolean(deal?.can_submit_content);
  const rawOnly = Boolean(required.raw_only) && !stage;
  const canSubmit = canSubmitUploadedAssets(deal, uploads);
  const stageDue = stage === 'raw' ? deal?.edit_flow?.raw_due : stage === 'edited' ? deal?.edit_flow?.edited_due : null;
  const videoTitle = stage === 'raw' || rawOnly ? 'Raw video' : stage === 'edited' ? 'Edited video' : 'Your video';
  const sendLabel = stage === 'raw' || rawOnly ? 'Submit raw video' : stage === 'edited' ? 'Submit edited video' : revision ? 'Submit revision' : 'Submit delivery';
  const pctFor = (k) => (uploading && uploading.key === k ? uploading.percent ?? 0 : null);
  const anyUploading = Boolean(uploading);
  const missing = missingAssets(deal, uploads);

  const slots = [
    { key: 'finalVideoUrl', icon: Film, title: videoTitle, hint: `MP4 or MOV · up to ${MAX_UPLOAD_MB} MB`, accept: 'video/*', test: 'pick-video' },
  ];
  if (required.caption_script) slots.push({ key: 'captionUrl', icon: FileText, title: 'Caption / script', hint: '.txt · .docx', accept: undefined, test: 'pick-caption' });
  if (required.thumbnail) slots.push({ key: 'thumbnailUrl', icon: ImageIcon, title: 'Thumbnail', hint: 'JPG · PNG', accept: 'image/*', test: 'pick-thumb' });
  if (required.raw_footage && !stage) slots.push({ key: 'rawFootageUrl', icon: Paperclip, title: 'Raw footage', hint: `MP4 or MOV · up to ${MAX_UPLOAD_MB} MB`, accept: 'video/*', test: 'pick-raw' });

  const send = async () => {
    const ok = await onSubmit();
    if (ok) onClose();
  };

  const footer = confirm ? (
    <>
      <button type="button" className="ap-or-btn ap-or-btn--ghost ap-or-btn--lg" disabled={submitting} onClick={() => setConfirm(false)}>Back</button>
      <button type="button" className="ap-or-btn ap-or-btn--lg" style={{ flex: 1 }} disabled={submitting || !canSubmit} onClick={send}>
        <Send size={17} />{submitting ? 'Sending…' : `Send to ${brandName}`}
      </button>
    </>
  ) : (
    <button type="button" className="ap-or-btn ap-or-btn--lg ap-or-btn--block" disabled={!canSubmit || anyUploading} onClick={() => setConfirm(true)}>
      {anyUploading ? 'Uploading…' : revision ? 'Review & send new version' : 'Review & send'}
    </button>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      tall
      title={confirm ? 'Ready to send?' : revision ? 'Upload new version' : 'Your delivery'}
      subtitle={confirm ? `${deal?.campaign?.title || 'Order'} · ${brandName}` : (content.watermark_required_until_approval ? `Watermarked until ${brandName} approves` : undefined)}
      footer={footer}
    >
      {!confirm && (
        <>
          {!unlocked && <div className="ap-or-sheet-note ap-or-sheet-note--warn">Content upload unlocks when it is your turn to submit.</div>}
          {stage && unlocked && (
            <div className="ap-or-sheet-note">
              {stage === 'raw'
                ? `Step 1 of 2: upload the RAW video${stageDue ? ` by ${new Date(stageDue).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}. ${deal?.edit_flow?.mode === 'ugc' ? 'Once the brand approves it you are paid and UGC.ad edits it.' : 'Once the brand approves it you will upload the edited video.'}`
                : 'Step 2 of 2: the brand approved your raw video. Upload the EDITED video.'}
            </div>
          )}
          {rawOnly && unlocked && <div className="ap-or-sheet-note">The brand asked for the raw video only. Upload it once and submit. Nothing else is needed.</div>}
          {slots.map((s) => (
            <Slot
              key={s.key}
              icon={s.icon}
              title={s.title}
              hint={s.hint}
              accept={s.accept}
              testId={s.test}
              name={names[s.key]}
              done={Boolean(uploads[s.key])}
              pct={pctFor(s.key)}
              disabled={!unlocked || (anyUploading && uploading.key !== s.key)}
              onPick={(f) => onPick(s.key, f)}
              onClear={() => onClear(s.key)}
            />
          ))}
          {unlocked && missing.length > 0 && !anyUploading && <div className="ap-or-sheet-note">Still needed: {missing.join(', ')}.</div>}
          {content.watermark_required_until_approval && <div className="ap-or-sheet-note">We add a UGCad watermark until {brandName} approves, so your work is safe.</div>}
        </>
      )}
      {confirm && (
        <>
          {slots.filter((s) => uploads[s.key]).map((s) => (
            <div className="ap-or-slot is-done" key={s.key}>
              <span className="ico"><Check size={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}><div className="t">{s.title}</div><div className="s">{names[s.key] || 'Uploaded'}</div></div>
            </div>
          ))}
          <div className="ap-or-flow">
            <div><b>{brandName} reviews</b>approves or asks for changes</div>
            <span>→</span>
            <div><b>Approved</b>or automatically if no reply</div>
            <span>→</span>
            <div><b>You get {inr(net)}</b>to your wallet</div>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------------------------
// "Product arrived?" (website: ShippingBlock receipt + damage report)
// ---------------------------------------------------------------------------------------------
export function ReceiptSheet({ open, initial = 'ok', onClose, deal, brandName, videoUrl, videoName, uploadPct, onPick, onClear, onConfirm, onReport, busy }) {
  const [choice, setChoice] = useState('ok');
  const [text, setText] = useState('');
  useEffect(() => { if (open) { setChoice(initial); setText(''); } }, [open, initial]);
  const hasVideo = Boolean(videoUrl);
  const canMark = Boolean(deal?.can_mark_received);
  const uploading = uploadPct != null;
  const hint = !canMark
    ? 'You can mark the product received only after the brand ships it. This updates by itself.'
    : !hasVideo ? 'Upload a short unboxing video to confirm.' : '';

  const footer = choice === 'ok' ? (
    <button type="button" className="ap-or-btn ap-or-btn--lg ap-or-btn--block" disabled={!canMark || !hasVideo || busy || uploading} onClick={onConfirm}>
      {busy ? 'Confirming…' : 'Confirm - start filming'}
    </button>
  ) : (
    <button type="button" className="ap-or-btn ap-or-btn--lg ap-or-btn--block ap-or-btn--danger" disabled={busy} onClick={() => onReport(text.trim())}>
      {busy ? 'Sending…' : 'Report this problem'}
    </button>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title="Product arrived?" subtitle={`${deal?.campaign?.title || 'Order'} · ${brandName}`} footer={footer}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" className={`ap-or-opt${choice === 'ok' ? ' is-on' : ''}`} onClick={() => setChoice('ok')}>
          <span className="ico"><Check size={18} /></span><span><b>Yes, all good</b><small>It arrived and looks right</small></span>
        </button>
        <button type="button" className={`ap-or-opt${choice === 'bad' ? ' is-on' : ''}`} onClick={() => setChoice('bad')}>
          <span className="ico bad"><AlertTriangle size={18} /></span><span><b>Something is wrong</b><small>Damaged, missing or wrong item</small></span>
        </button>
      </div>
      {choice === 'ok' ? (
        <div style={{ marginTop: 14 }}>
          <Slot icon={Paperclip} title="Unboxing video" hint={`Show the package, opening and product · MP4/MOV · max ${MAX_UPLOAD_MB} MB`} accept="video/mp4,video/quicktime" name={videoName} done={hasVideo} pct={uploadPct} disabled={busy} onPick={onPick} onClear={onClear} testId="pick-unboxing" />
          {hint && <div className="ap-or-sheet-note">{hint}</div>}
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <label className="ap-label">
            What is wrong? (optional)
            <textarea className="ap-input" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Damaged, wrong size, missing items…" />
          </label>
          <div className="ap-or-sheet-note ap-or-sheet-note--warn" style={{ marginTop: 10 }}>Your work on this order pauses until UGCad reviews it. Payment stays held. You can add photos or video as evidence afterwards.</div>
        </div>
      )}
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Delivery address (website: ShippingDetailsCard). GET/POST /shipping/address
// ---------------------------------------------------------------------------------------------
const EMPTY_ADDR = { full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' };
const REQUIRED_ADDR = ['full_name', 'phone', 'line1', 'city', 'state', 'pincode'];
const addrValid = (a) => REQUIRED_ADDR.every((k) => String(a?.[k] || '').trim())
  && /^\d{6}$/.test(String(a.pincode).trim())
  && /^\d{10}$/.test(String(a.phone).replace(/\D/g, '').slice(-10));
const sameAddr = (a, b) => ['line1', 'city', 'pincode'].every((k) => String(a?.[k] || '').trim().toLowerCase() === String(b?.[k] || '').trim().toLowerCase());
const oneLine = (a) => [a.line1, a.line2, a.city, `${a.state} ${a.pincode}`, a.country].filter(Boolean).join(', ');

function AddressBody({ campaignId, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_ADDR);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!campaignId) { setLoading(false); return; }
    try {
      const { data } = await axios.get(`${API}/shipping/address`, { params: { campaign_id: campaignId } });
      setStatus(data);
      setLoadError('');
      setForm({ ...EMPTY_ADDR, ...(data.address || data.account_address || {}) });
      setEditing(false);
    } catch (e) {
      setStatus(null);
      setLoadError(apiErrorMessage(e, "Couldn't load your shipping details."));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);
  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async (addr = form) => {
    if (!addrValid(addr)) { toast.error('Fill all fields - 10-digit phone and 6-digit pincode.'); return; }
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/shipping/address`, { ...EMPTY_ADDR, ...addr, campaign_id: campaignId });
      toast.success(data.both_ready ? 'Both addresses confirmed - the team will dispatch shortly.' : 'Saved. Waiting for the brand to confirm.');
      onSaved?.(!!data.both_ready);
      onClose();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save address'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="ap-skel" style={{ height: 160 }} aria-label="Loading shipping details" />;
  if (loadError) {
    return (
      <div className="ap-empty" style={{ padding: '16px 0' }}>
        <p>{loadError}</p>
        <button type="button" className="ap-btn" onClick={() => { setLoading(true); load(); }}>Try again</button>
      </div>
    );
  }
  if (!status || !status.requires_shipment) return <p className="ap-or-sheet-note">No product needs to be shipped for this order.</p>;
  if (status.my_role !== 'creator') return null;

  const mine = status.creator_confirmed;
  const saved = status.address;
  const account = status.account_address;
  const accountComplete = Boolean(account) && (status.account_missing || []).length === 0;
  const dispatched = ['shipped', 'in_transit', 'delivered', 'received'].includes(status.shipment_status);
  const options = [];
  if (saved && addrValid(saved)) options.push({ key: 'saved', title: 'Your last delivery address', addr: saved });
  if (accountComplete && addrValid(account) && !(saved && sameAddr(saved, account))) options.push({ key: 'account', title: 'Address from your account', addr: account });
  const showForm = editing || (!mine && options.length === 0);
  const showChoices = !mine && !showForm && options.length > 0;

  return (
    <>
      <p className="ap-or-sheet-note">The product will be couriered here. The brand never sees your address.</p>
      <div className="ap-or-pill-row" style={{ marginBottom: 12 }}>
        <span className={`ap-pill ${mine ? 'ap-pill--ok' : 'ap-pill--warn'}`}>{mine ? <Check size={12} /> : <Clock size={12} />} You {mine ? 'confirmed' : 'pending'}</span>
        <span className={`ap-pill ${status.brand_confirmed ? 'ap-pill--ok' : 'ap-pill--warn'}`}>{status.brand_confirmed ? <Check size={12} /> : <Clock size={12} />} Brand {status.brand_confirmed ? 'confirmed' : 'pending'}</span>
        {status.both_ready && <span className="ap-pill"><Truck size={12} /> {dispatched ? 'Dispatched' : 'Ready to dispatch'}</span>}
      </div>

      {showChoices && (
        <>
          <p className="ap-or-sheet-note">We already have an address for you. Pick one, or enter a new one.</p>
          {options.map((o) => (
            <div key={o.key} className="ap-or-addr">
              <MapPin size={16} color="#5b6bff" style={{ flex: 'none', marginTop: 2 }} />
              <div>
                <em>{o.title}</em>
                <strong>{o.addr.full_name} · {o.addr.phone}</strong>
                <span>{oneLine(o.addr)}</span>
                <button type="button" className="ap-or-btn" style={{ marginTop: 10, height: 40 }} disabled={saving} onClick={() => save(o.addr)}>{saving ? 'Saving…' : 'Deliver here'}</button>
              </div>
            </div>
          ))}
          <button type="button" className="ap-or-btn ap-or-btn--ghost ap-or-btn--block" onClick={() => { setForm({ ...EMPTY_ADDR }); setEditing(true); }}>Enter a new address</button>
        </>
      )}

      {mine && !showForm && saved && (
        <>
          <div className="ap-or-addr">
            <MapPin size={16} color="#5b6bff" style={{ flex: 'none', marginTop: 2 }} />
            <div><strong>{saved.full_name} · {saved.phone}</strong><span>{oneLine(saved)}</span></div>
          </div>
          {!dispatched && <button type="button" className="ap-or-btn ap-or-btn--ghost ap-or-btn--block" onClick={() => { setForm({ ...EMPTY_ADDR, ...saved }); setEditing(true); }}>Edit address</button>}
          {status.both_ready && <p className="ap-or-sheet-note"><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> Both addresses are in. The team ships it and you will get tracking here.</p>}
          {!status.brand_confirmed && <p className="ap-or-sheet-note"><Clock size={13} style={{ verticalAlign: -2 }} /> Waiting on the brand to confirm their address.</p>}
        </>
      )}
      {mine && !showForm && !saved && <p className="ap-or-sheet-note">Your delivery address is confirmed for this order.</p>}

      {showForm && (
        <div className="ap-or-form">
          {account && !sameAddr(form, account) && (
            <button type="button" className="ap-or-btn ap-or-btn--ghost full" onClick={() => setForm({ ...EMPTY_ADDR, ...account })}>Use the address from my account</button>
          )}
          <label>Full name<input className="ap-input" autoComplete="name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Recipient name" /></label>
          <label>Phone<input className="ap-input" autoComplete="tel" inputMode="numeric" value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" /></label>
          <label className="full">Address line 1<input className="ap-input" autoComplete="address-line1" value={form.line1} onChange={(e) => set('line1', e.target.value)} placeholder="House / building, street" /></label>
          <label className="full"><span>Address line 2 <em>(optional)</em></span><input className="ap-input" autoComplete="address-line2" value={form.line2} onChange={(e) => set('line2', e.target.value)} placeholder="Area, landmark" /></label>
          <label>City<input className="ap-input" autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} /></label>
          <label>State<input className="ap-input" autoComplete="address-level1" value={form.state} onChange={(e) => set('state', e.target.value)} /></label>
          <label>Pincode<input className="ap-input" autoComplete="postal-code" inputMode="numeric" value={form.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit" /></label>
          <label>Country<input className="ap-input" value={form.country} onChange={(e) => set('country', e.target.value)} /></label>
          <div className="full" style={{ display: 'flex', gap: 10 }}>
            {(saved || options.length > 0) && <button type="button" className="ap-or-btn ap-or-btn--ghost ap-or-btn--lg" onClick={() => { setForm({ ...EMPTY_ADDR, ...(saved || account || {}) }); setEditing(false); }}>Cancel</button>}
            <button type="button" className="ap-or-btn ap-or-btn--lg" style={{ flex: 1 }} disabled={saving || !addrValid(form)} onClick={() => save(form)}>{saving ? 'Saving…' : 'Confirm delivery address'}</button>
          </div>
        </div>
      )}
    </>
  );
}

export function AddressSheet({ open, onClose, campaignId, onSaved }) {
  return (
    <BottomSheet open={open} onClose={onClose} tall title="Delivery address" subtitle="Where should the brand send your product?">
      <AddressBody campaignId={campaignId} onClose={onClose} onSaved={onSaved} />
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------------------------
// "See changes on video": plays the submitted cut, change notes jump to their timestamp
// ---------------------------------------------------------------------------------------------
export function ChangesVideoSheet({ open, onClose, info }) {
  const ref = useRef(null);
  const [dur, setDur] = useState(0);
  const jump = (s) => {
    const v = ref.current;
    if (!v || s == null) return;
    v.currentTime = s;
    v.play?.().catch(() => {});
  };
  const pins = info.changes.filter((c) => c.seconds != null && dur > 0 && c.seconds <= dur);
  return (
    <BottomSheet open={open} onClose={onClose} title="Requested changes" subtitle="Tap a change to jump to that moment">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={ref} className="ap-or-vid" src={info.url} controls playsInline preload="metadata" onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)} />
      {pins.length > 0 && (
        <div className="ap-or-vtl" aria-hidden="true">
          {pins.map((c) => <i key={c.id} style={{ left: `${(c.seconds / dur) * 100}%` }}>{c.id + 1}</i>)}
        </div>
      )}
      <div style={{ marginTop: pins.length ? 0 : 12 }}>
        {info.changes.length ? info.changes.map((c) => (
          <button key={c.id} type="button" className="ap-or-jump" disabled={c.seconds == null} onClick={() => jump(c.seconds)}>
            <span className="ap-or-chg" style={{ padding: 0, border: 0 }}><span className="n">{c.id + 1}</span></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--ap-muted)' }}>{c.timestamp ? `At ${c.timestamp}` : 'General note'}</span>
              <span style={{ display: 'block', fontSize: 13.5, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{c.text}</span>
            </span>
            {c.seconds != null && <Play size={16} style={{ flex: 'none', alignSelf: 'center', color: 'var(--ap-link)' }} />}
          </button>
        )) : <p className="ap-or-sheet-note">No requested changes yet.</p>}
      </div>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------------------------
// "Raise a problem". Backend rule: a creator can escalate to admin only after flagging a revision
// disagreement or reporting a damaged product, otherwise they talk to the brand first.
// ---------------------------------------------------------------------------------------------
const REASONS = ['Brand asks for things not in the brief', 'Brand stopped replying', 'Payment did not arrive', 'Something else'];
export function ProblemSheet({ open, onClose, deal, brandName, canEscalate, onSubmit, onChat, busy }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [text, setText] = useState('');
  useEffect(() => { if (open) { setReason(REASONS[0]); setText(''); } }, [open]);
  const dealRef = deal?.deal_id || deal?.campaign?.id || '';
  const send = async () => {
    const ok = await onSubmit(`${reason}${text.trim() ? `: ${text.trim()}` : ''}`);
    if (ok) onClose();
  };
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Ask UGCad to step in"
      subtitle={`Order ${dealRef} · we reply within 24 hours`}
      footer={canEscalate ? (
        <button type="button" className="ap-or-btn ap-or-btn--lg ap-or-btn--block" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send to UGCad'}</button>
      ) : null}
    >
      {canEscalate ? (
        <>
          <div className="ap-or-chips">
            {REASONS.map((r) => <button key={r} type="button" className={`ap-chip${reason === r ? ' is-on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}
          </div>
          <label className="ap-label">
            Tell us what happened (optional)
            <textarea className="ap-input" rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="They now want 2 extra reels for the same price." />
          </label>
          <p className="ap-or-sheet-note" style={{ marginTop: 10 }}>Your payment stays held safely while we look. Chats here count as proof.</p>
        </>
      ) : (
        <>
          <p className="ap-or-sheet-note">Please raise your concern with {brandName} first. Most things get sorted in chat. If you cannot agree, flag the revision or report a product problem here, and then you can ask UGCad to step in.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" className="ap-or-btn ap-or-btn--lg ap-or-btn--block" onClick={onChat}>Message {brandName}</button>
            <a className="ap-or-btn ap-or-btn--lg ap-or-btn--ghost ap-or-btn--block" href="mailto:support@ugcad.io" style={{ textDecoration: 'none' }}>Email UGCad support</a>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Direct-booking gate (website: components/BookingCard.js, creator half). POST /bookings/:id/respond
// ---------------------------------------------------------------------------------------------
export function BookingPanel({ deal, onDone }) {
  const c = deal?.campaign || {};
  const status = c.booking_status;
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null); // 'decline' | 'revise'
  const [note, setNote] = useState('');
  const [price, setPrice] = useState('');
  if (!status || status === 'declined') return null;
  if (status === 'accepted' && c.brief_sent) return null;

  const id = c.id;
  const subtotal = Number(c.budget_max || c.budget_min || 0);
  const videos = Number(c.video_count || 1);
  const proposed = Number(c.proposed_amount || 0);

  const respond = async (action, body = {}) => {
    if (busy) return;
    setBusy(true);
    try {
      await axios.post(`${API}/bookings/${id}/respond`, { action, ...body });
      toast.success({
        accept: 'Booking accepted - the brand will send the brief next.',
        decline: 'Booking declined. The brand has been refunded.',
        revise: 'Your price was sent to the brand.',
      }[action]);
      setMode(null);
      onDone?.();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  if (status === 'price_revision') {
    return <div className="ap-or-err" style={{ background: '#fff', color: 'var(--ap-ink)', boxShadow: 'var(--ap-card-shadow)' }}><Clock size={18} /><span>You proposed <b>{inr(proposed)}</b>. Waiting for the brand to accept or cancel.</span></div>;
  }
  if (status === 'accepted') {
    return <div className="ap-or-err" style={{ background: '#fff', color: 'var(--ap-ink)', boxShadow: 'var(--ap-card-shadow)' }}><Clock size={18} /><span>Booking confirmed. Waiting for the brand to send the brief. The work starts then.</span></div>;
  }
  if (status !== 'pending_creator') return null;

  return (
    <section className="ap-or-c" style={{ boxShadow: 'inset 4px 0 0 #4452f0, var(--ap-card-shadow)' }}>
      <span className="ap-pill">Booking request</span>
      <h2 className="ap-or-h" style={{ margin: '8px 0 4px', fontSize: 18 }}>{c.brand_name || 'A brand'} wants to book you</h2>
      <p className="ap-or-note" style={{ marginTop: 0 }}>The payment is already held in escrow. Accept to lock it in, or tell them your price.</p>
      <div className="ap-or-kv">
        <div><span>Videos</span><span>{videos}</span></div>
        <div><span>Delivery</span><span>{c.delivery_date || '-'}</span></div>
        <div className="tot"><span>You will be paid</span><span>{inr(subtotal)}</span></div>
      </div>
      <div className="ap-or-stack">
        <button type="button" className="ap-or-btn ap-or-btn--ok ap-or-btn--lg" disabled={busy} onClick={() => respond('accept')}><Check size={17} />{busy && !mode ? 'Accepting…' : 'Accept booking'}</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="ap-or-btn ap-or-btn--ghost" style={{ flex: 1 }} disabled={busy} onClick={() => { setNote(''); setPrice(String(subtotal || '')); setMode('revise'); }}><IndianRupee size={15} />Propose price</button>
          <button type="button" className="ap-or-btn ap-or-btn--ghost" style={{ flex: 1, color: '#b91c1c' }} disabled={busy} onClick={() => { setNote(''); setMode('decline'); }}><X size={15} />Decline</button>
        </div>
      </div>

      <BottomSheet
        open={mode === 'decline'}
        onClose={() => setMode(null)}
        title="Decline this booking?"
        subtitle="The brand is refunded in full."
        footer={(
          <>
            <button type="button" className="ap-or-btn ap-or-btn--ghost ap-or-btn--lg" disabled={busy} onClick={() => setMode(null)}>Back</button>
            <button type="button" className="ap-or-btn ap-or-btn--danger ap-or-btn--lg" style={{ flex: 1 }} disabled={busy} onClick={() => respond('decline', { message: note })}>{busy ? 'Declining…' : 'Confirm decline'}</button>
          </>
        )}
      >
        <label className="ap-label">Reason (optional)<textarea className="ap-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Let the brand know why…" /></label>
      </BottomSheet>

      <BottomSheet
        open={mode === 'revise'}
        onClose={() => setMode(null)}
        title="Propose another price"
        subtitle="The brand pays the difference if it is higher, or is refunded if lower. They can still cancel."
        footer={(
          <>
            <button type="button" className="ap-or-btn ap-or-btn--ghost ap-or-btn--lg" disabled={busy} onClick={() => setMode(null)}>Back</button>
            <button type="button" className="ap-or-btn ap-or-btn--lg" style={{ flex: 1 }} disabled={busy || !(Number(price) > 0)} onClick={() => respond('revise', { amount: Number(price), message: note })}>{busy ? 'Sending…' : `Propose ${inr(price || 0)}`}</button>
          </>
        )}
      >
        <label className="ap-label" style={{ marginBottom: 12 }}>Your price for this booking
          <input className="ap-input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} placeholder={String(subtotal)} />
        </label>
        <label className="ap-label">Message (optional)<textarea className="ap-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this price?" /></label>
      </BottomSheet>
    </section>
  );
}
