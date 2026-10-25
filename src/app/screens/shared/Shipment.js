import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Package, Truck, AlertTriangle, ClipboardList, WifiOff, RefreshCw, Info, Paperclip, X, Play, Check } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { ownsCampaign } from '../../../utils/brandWorkspace';
import { isSelectedCreator } from '../../../utils/campaignCreators';
import { uploadMedia, MAX_UPLOAD_MB } from '../../../utils/upload';
import { apiErrorMessage } from '../../../utils/apiError';
import './shipment.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const OFFLINE = "You're offline. Check your connection and try again.";
const MOVING = ['requested', 'awaiting_pickup', 'label_generated', 'shipped', 'in_transit', 'delivered', 'received'];

// Uploaded files come back as a relative "/uploads/..." path; absolute URLs (legacy/cloud) are used as-is.
const mediaUrl = (u) => (!u ? '' : /^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${u.startsWith('/') ? '' : '/'}${u}`);

// Resolve a 6-digit Indian PIN to { city, state } via India Post so the pickup City/State always match the Pincode.
const lookupPincode = async (pin) => {
  try {
    const json = await (await fetch(`https://api.postalpincode.in/pincode/${pin}`)).json();
    const office = json?.[0]?.PostOffice?.[0];
    return office ? { city: office.District || '', state: office.State || '' } : null;
  } catch { return null; }
};
const EMPTY_SHIP = { description: '', weight: '', length: '', width: '', height: '', full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

function nextStepsFor({ isCreator, isBusiness, status }) {
  if (isCreator) {
    return status === 'received'
      ? ['Create the content exactly as described in the brief.', 'Submit your work for review from "My Active Work".', 'Wait for the brand to approve it - your payment is released on approval.']
      : ['Watch for the package to arrive at your address.', 'Record an unboxing video as you open it (you may need it if anything is wrong).', 'Tap "Mark as Received" once it arrives - report any damage or wrong item there.', 'Then create your content and submit it from "My Active Work".'];
  }
  if (isBusiness) {
    if (status === 'received') return ['The creator has received the product.', 'Wait for them to submit the content, then review it.', 'Approve the work to release payment, or request changes.'];
    if (status === 'requested') return ['Your shipment request has been submitted.', 'Our team is preparing your pre-paid shipping label.', 'Tracking will appear here once the package is dispatched.'];
    return ['The product is on its way to the creator.', 'Wait for the creator to confirm receipt.', 'Tracking updates will appear here as the courier scans the package.'];
  }
  return null;
}

export default function Shipment() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaign');
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBrandRole = user?.role === 'business';

  const [campaign, setCampaign] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shipOpen, setShipOpen] = useState(false);
  const [recvOpen, setRecvOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  const fetchShipment = async () => {
    try {
      setShipment((await axios.get(`${API}/shipment/${campaignId}`)).data);
    } catch { /* no shipment yet: the page shows its "no shipment" state */ }
  };
  const fetchAll = async () => {
    try {
      const [c] = await Promise.all([axios.get(`${API}/campaigns/${campaignId}`), fetchShipment()]);
      setCampaign(c.data);
      setError('');
    } catch (e) {
      setError(e?.response ? (e.response.status === 404 ? '' : apiErrorMessage(e, 'Failed to load campaign')) : OFFLINE);
    } finally {
      setLoading(false);
    }
  };
  useLiveEffect(() => {
    // Opened without ?campaign=: show "not found" instead of a skeleton forever.
    if (campaignId) fetchAll(); else setLoading(false);
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = window.history.length > 1 ? true : (isBrandRole ? '/dashboard/business/shipments' : '/my-active-work');
  const retry = () => { setLoading(true); fetchAll(); };

  if (loading || !campaign) {
    return (
      <AppShell back={back} title="Shipment" tabs={false}>
        {loading ? (
          <div className="ap-sm-col" aria-hidden="true">
            <div className="ap-skel" style={{ height: 84, borderRadius: 20 }} />
            <div className="ap-skel" style={{ height: 160, borderRadius: 20 }} />
            <div className="ap-skel" style={{ height: 120, borderRadius: 20 }} />
          </div>
        ) : (
          <div className="ap-card ap-empty" role="alert">
            {error === OFFLINE ? <WifiOff size={34} /> : <Package size={34} />}
            <h3>{error ? 'Could not load this shipment' : 'Campaign not found'}</h3>
            <p>{error || 'We could not find the campaign for this shipment.'}</p>
            {campaignId && <button type="button" className="ap-btn" onClick={retry}><RefreshCw size={16} /> Retry</button>}
          </div>
        )}
      </AppShell>
    );
  }

  const isBusiness = isBrandRole && ownsCampaign(user, campaign);
  const isCreator = user?.role === 'creator' && isSelectedCreator(campaign, user.id);
  const status = String(shipment?.status || '').toLowerCase();
  // A shipment only counts as real once a label/tracking exists or it is actually moving; a stale empty record still needs shipping.
  const hasReal = !!shipment && (!!shipment.requested || !!shipment.tracking_number || !!shipment.label_url || MOVING.includes(status));
  const awaitingLabel = status === 'requested' && !shipment?.label_url && !shipment?.tracking_number;
  const steps = nextStepsFor({ isCreator, isBusiness, status });
  const checklist = shipment?.shipment_checklist || {};

  return (
    <AppShell back={back} title="Shipment" subtitle={campaign.title} tabs={false}>
      {!hasReal ? (
        <div className="ap-card ap-empty">
          <Package size={40} />
          <h3>{isBusiness ? 'Ready to ship' : 'No shipment yet'}</h3>
          <p>{isBusiness ? 'Submit your product and pickup details and our team will prepare the shipping label.' : 'No shipment details available yet. This updates by itself once the brand ships the product.'}</p>
          {isBusiness && <button type="button" className="ap-btn" data-testid="ship-product-btn" onClick={() => setShipOpen(true)}><Package size={18} /> Ship product</button>}
        </div>
      ) : (
        <>
          <section className="ap-card ap-sm-status">
            <span className="ap-sm-ic"><Truck size={24} /></span>
            <div>
              <small>Status</small>
              <b>{awaitingLabel ? 'Awaiting label' : String(shipment.status || '').replace(/_/g, ' ').replace(/^./, (m) => m.toUpperCase())}</b>
            </div>
          </section>

          {awaitingLabel && (
            <div className="ap-sm-note">
              <ClipboardList size={20} />
              <div><strong>Shipment requested</strong><p>Our team is preparing your pre-paid label. Tracking will appear here once the package is dispatched.</p></div>
            </div>
          )}

          <section className="ap-card ap-sm-kv">
            <h3>Tracking</h3>
            <dl>
              <div><dt>Tracking number</dt><dd>{shipment.tracking_number || '-'}</dd></div>
              {shipment.courier_name && <div><dt>Courier</dt><dd>{shipment.courier_name}</dd></div>}
              {shipment.expected_delivery && <div><dt>Expected delivery</dt><dd>{new Date(shipment.expected_delivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>}
              {shipment.label_url && isBusiness && <div><dt>Shipping label</dt><dd><a href={mediaUrl(shipment.label_url)} target="_blank" rel="noopener noreferrer">Download &amp; print</a></dd></div>}
              {shipment.courier_slip && <div><dt>Courier slip</dt><dd><a href={mediaUrl(shipment.courier_slip)} target="_blank" rel="noopener noreferrer">View document</a></dd></div>}
            </dl>
          </section>

          <section className="ap-card ap-sm-kv">
            <h3>Shipment checklist</h3>
            <ul className="ap-sm-check">
              {[['sealed', 'Package sealed'], ['correct_item', 'Correct item'], ['working', 'Working condition']].map(([k, label]) => (
                <li key={k} className={checklist[k] ? 'is-on' : ''}><i>{checklist[k] && <Check size={12} strokeWidth={3} />}</i>{label}</li>
              ))}
            </ul>
          </section>

          {shipment.unboxing_video && (
            <section className="ap-card ap-sm-row">
              <div><h3>Unboxing video</h3><small>Recorded by the creator on arrival</small></div>
              <button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => setVideoUrl(mediaUrl(shipment.unboxing_video))}><Play size={14} /> Watch</button>
            </section>
          )}

          {shipment.dispute && (
            <div className="ap-sm-note ap-sm-note--bad" role="alert">
              <AlertTriangle size={22} />
              <div><strong>Dispute reported</strong><p>{shipment.dispute.reason}</p></div>
            </div>
          )}

          {steps && (
            <section className="ap-card ap-sm-kv" data-testid="next-steps">
              <h3>What to do next</h3>
              <ol className="ap-sm-steps">{steps.map((s, i) => <li key={i}><i>{i + 1}</i><span>{s}</span></li>)}</ol>
            </section>
          )}

          {isCreator && ['shipped', 'in_transit', 'delivered'].includes(status) && (
            <button type="button" className="ap-btn ap-btn--block" style={{ height: 50 }} data-testid="mark-received-btn" onClick={() => setRecvOpen(true)}>Mark as received</button>
          )}
        </>
      )}

      {shipOpen && <ShipSheet campaignId={campaignId} onClose={() => setShipOpen(false)} onDone={() => { setShipOpen(false); fetchShipment(); }} />}
      {recvOpen && <ReceiveSheet campaignId={campaignId} onClose={() => setRecvOpen(false)} onDone={() => { setRecvOpen(false); fetchShipment(); }} />}

      <BottomSheet open={!!videoUrl} onClose={() => setVideoUrl('')} title="Unboxing video">
        {videoUrl && <video src={videoUrl} controls autoPlay playsInline className="ap-sm-video" />}
      </BottomSheet>
    </AppShell>
  );
}

/* Brand: product details + pickup address -> pre-paid label (POST /deals/:campaign/request-shipment). */
function ShipSheet({ campaignId, onClose, onDone }) {
  const [form, setForm] = useState(EMPTY_SHIP);
  const [fromAccount, setFromAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Pre-fill the pickup address from the brand's account (Settings > Company); editable.
  useEffect(() => {
    let alive = true;
    axios.get(`${API}/shipping/account-address`).then(({ data }) => {
      const a = data?.address;
      if (!alive || !a) return;
      setForm((f) => (f.line1 || f.pincode ? f : { ...f, full_name: a.full_name || '', phone: a.phone || '', line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', pincode: a.pincode || '' }));
      setFromAccount(true);
    }).catch(() => { /* no saved address: the brand types it */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const pin = String(form.pincode || '').replace(/\D/g, '');
    if (pin.length !== 6) return undefined;
    let cancelled = false;
    lookupPincode(pin).then((info) => {
      if (cancelled || !info) return;
      setForm((f) => ({ ...f, city: info.city || f.city, state: info.state || f.state }));
    });
    return () => { cancelled = true; };
  }, [form.pincode]);

  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await axios.post(`${API}/deals/${campaignId}/request-shipment`, {
        description: form.description,
        weight: Number(form.weight),
        dimensions: {
          length: form.length ? Number(form.length) : null,
          width: form.width ? Number(form.width) : null,
          height: form.height ? Number(form.height) : null,
        },
        pickup_address: {
          full_name: form.full_name, phone: form.phone, line1: form.line1, line2: form.line2,
          city: form.city, state: form.state, pincode: form.pincode, country: 'India',
        },
      });
      toast.success('Shipment requested - our team will prepare your label shortly.');
      onDone();
    } catch (err) {
      toast.error(err?.response ? apiErrorMessage(err, 'Failed to generate shipping label') : OFFLINE);
    } finally { lock.current = false; setBusy(false); }
  };

  return (
    <BottomSheet
      open
      tall
      onClose={busy ? undefined : onClose}
      title="Ship product"
      footer={(
        <>
          <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1, height: 50 }} disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" form="ap-sm-ship" className="ap-btn" style={{ flex: 1.4, height: 50 }} disabled={busy} data-testid="submit-ship-btn">{busy ? 'Submitting…' : 'Submit request'}</button>
        </>
      )}
    >
      <form id="ap-sm-ship" className="ap-sm-form" onSubmit={submit}>
        <div className="ap-sm-info"><Info size={16} /><span>Enter the product details and your pickup address. Our team will prepare a pre-paid label and dispatch it to the creator. The creator’s delivery address is handled securely - you don’t need it.</span></div>
        <label className="ap-label">Product description
          <input className="ap-input" required placeholder="e.g. Skincare gift box" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <label className="ap-label">Weight (kg)
          <input className="ap-input" type="number" inputMode="decimal" step="0.01" min="0" required placeholder="0.5" value={form.weight} onChange={(e) => set('weight', e.target.value)} />
        </label>
        <div className="ap-label">Dimensions L×W×H (cm)
          <div className="ap-sm-three">
            {[['length', 'L'], ['width', 'W'], ['height', 'H']].map(([k, ph]) => (
              <input key={k} className="ap-input" type="number" inputMode="decimal" min="0" aria-label={`${k} in cm`} placeholder={ph} value={form[k]} onChange={(e) => set(k, e.target.value)} />
            ))}
          </div>
        </div>
        <div className="ap-sm-div">Pickup address</div>
        {fromAccount && <p className="ap-sm-hint">Filled in from your account (Settings, Company). Change anything if the pickup is from a different place.</p>}
        <label className="ap-label">Full name
          <input className="ap-input" required autoComplete="name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
        </label>
        <label className="ap-label">Phone
          <input className="ap-input" type="tel" inputMode="numeric" maxLength={15} required autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/[^0-9]/g, ''))} />
        </label>
        <label className="ap-label">Address line 1
          <input className="ap-input" required autoComplete="address-line1" value={form.line1} onChange={(e) => set('line1', e.target.value)} />
        </label>
        <label className="ap-label">Address line 2 (optional)
          <input className="ap-input" autoComplete="address-line2" value={form.line2} onChange={(e) => set('line2', e.target.value)} />
        </label>
        <label className="ap-label">Pincode
          <input className="ap-input" inputMode="numeric" maxLength={6} required autoComplete="postal-code" value={form.pincode} onChange={(e) => set('pincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} />
        </label>
        <div className="ap-sm-two">
          <label className="ap-label">City
            <input className="ap-input" required value={form.city} onChange={(e) => set('city', e.target.value)} />
          </label>
          <label className="ap-label">State
            <input className="ap-input" required value={form.state} onChange={(e) => set('state', e.target.value)} />
          </label>
        </div>
      </form>
    </BottomSheet>
  );
}

/* Creator: unboxing video (required) + optional damage report (POST /shipment/receive). */
function ReceiveSheet({ campaignId, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [damaged, setDamaged] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    if (!file) { toast.error('Please attach your unboxing video.'); return; }
    lock.current = true;
    setBusy(true);
    try {
      // uploadMedia sends a big phone video straight to S3 and enforces the size cap itself.
      const unboxing = (await uploadMedia(file, API)).file_url;
      await axios.post(`${API}/shipment/receive`, {
        campaign_id: campaignId,
        unboxing_video: unboxing,
        items_damaged: damaged,
        dispute_reason: damaged ? reason : undefined,
      });
      toast.success('Shipment marked as received!');
      onDone();
    } catch (err) {
      toast.error(err?.isAxiosError && !err.response ? OFFLINE : apiErrorMessage(err, 'Failed to mark as received'));
    } finally { lock.current = false; setBusy(false); }
  };

  return (
    <BottomSheet
      open
      onClose={busy ? undefined : onClose}
      title="Mark shipment as received"
      footer={(
        <>
          <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1, height: 50 }} disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" form="ap-sm-recv" className="ap-btn" style={{ flex: 1.4, height: 50 }} disabled={busy} data-testid="submit-receive-btn">{busy ? 'Uploading…' : 'Confirm receipt'}</button>
        </>
      )}
    >
      <form id="ap-sm-recv" className="ap-sm-form" onSubmit={submit}>
        <div className="ap-label">Unboxing video (up to {MAX_UPLOAD_MB} MB)
          {file ? (
            <span className="ap-sm-file"><Paperclip size={15} /><span>{file.name}</span><button type="button" aria-label="Remove video" disabled={busy} onClick={() => setFile(null)}><X size={16} /></button></span>
          ) : (
            <label className="ap-sm-pick"><Paperclip size={16} /> Choose video
              <input type="file" hidden accept="video/*" data-testid="unboxing-file-input" onChange={(e) => { setFile(e.target.files?.[0] || null); e.target.value = ''; }} />
            </label>
          )}
        </div>
        <label className="ap-sm-opt">
          <input type="checkbox" checked={damaged} onChange={(e) => setDamaged(e.target.checked)} data-testid="damaged-checkbox" />
          <span>Report damaged or wrong items</span>
        </label>
        {damaged && (
          <label className="ap-label">Describe the issue
            <textarea className="ap-input" rows={3} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe what's wrong with the shipment..." data-testid="dispute-input" />
          </label>
        )}
      </form>
    </BottomSheet>
  );
}
