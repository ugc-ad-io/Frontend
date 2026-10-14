import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Package, MapPin, Check, Clock, Truck, ShieldCheck, UserRound } from 'lucide-react';
import { apiErrorMessage } from '../utils/apiError';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const EMPTY = { full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' };
const REQUIRED = ['full_name', 'phone', 'line1', 'city', 'state', 'pincode'];

const isValid = (a) => REQUIRED.every((k) => String(a?.[k] || '').trim())
  && /^\d{6}$/.test(String(a.pincode).trim())
  && /^\d{10}$/.test(String(a.phone).replace(/\D/g, '').slice(-10));

const sameAddress = (a, b) => ['line1', 'city', 'pincode'].every(
  (k) => String(a?.[k] || '').trim().toLowerCase() === String(b?.[k] || '').trim().toLowerCase());

const oneLine = (a) => [a.line1, a.line2, a.city, `${a.state} ${a.pincode}`, a.country].filter(Boolean).join(', ');

/**
 * Shipping details for a deal — the creator's delivery-address confirmation.
 *
 * The creator never has to retype what is already on their account: the card offers the
 * address saved on the account (KYC / signup) and their last delivery address as one-tap
 * choices, or "enter a new address". Masked shipping is preserved: the brand only ever
 * sees a confirmed/pending status; the address stays with the UGC.ad ops team.
 *
 * Props: campaignId (the deal/campaign id), onReady?(bothReady)
 *
 * Exposes an imperative `open()` (via ref) so the deal room's "Confirm Delivery Address"
 * button scrolls here and focuses the form when it is showing.
 */
const ShippingDetailsCard = forwardRef(function ShippingDetailsCard({ campaignId, onReady }, ref) {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState(null);   // { my_role, brand_confirmed, creator_confirmed, both_ready, shipment_status, requires_shipment, address, account_address, account_missing }
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);   // true = the manual form is open
  const rootRef = useRef(null);
  const firstFieldRef = useRef(null);

  useImperativeHandle(ref, () => ({
    open() {
      setTimeout(() => {
        rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstFieldRef.current?.focus();
      }, 60);
    },
  }));

  const load = useCallback(async () => {
    if (!campaignId) { setLoading(false); return; }
    try {
      const { data } = await axios.get(`${API}/shipping/address`, { params: { campaign_id: campaignId } });
      setStatus(data);
      setLoadError('');
      // Whatever we already know seeds the form: last address first, else the account's
      // (possibly incomplete — the creator fills only the gaps).
      setForm({ ...EMPTY, ...(data.address || data.account_address || {}) });
      setEditing(false);
    } catch (e) {
      // Never swallow this: say what went wrong and offer a retry.
      setStatus(null);
      setLoadError(apiErrorMessage(e, "Couldn't load your shipping details."));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useLiveEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isCreator = status?.my_role === 'creator';
  const mine = isCreator ? status?.creator_confirmed : status?.brand_confirmed;
  const theirs = isCreator ? status?.brand_confirmed : status?.creator_confirmed;
  const otherLabel = isCreator ? 'Brand' : 'Creator';

  const save = async (addr = form) => {
    if (!isValid(addr)) { toast.error('Fill all fields - 10-digit phone and 6-digit pincode.'); return; }
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/shipping/address`, { ...EMPTY, ...addr, campaign_id: campaignId });
      toast.success(data.both_ready
        ? 'Both addresses confirmed - the team will dispatch shortly.'
        : `Saved. Waiting for the ${otherLabel.toLowerCase()} to confirm.`);
      setEditing(false);
      await load();
      if (onReady) onReady(!!data.both_ready);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save address'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="sdc"><div className="sdc-body"><span className="sdc-muted">Loading shipping details…</span></div></div>;
  if (loadError) {
    return (
      <div className="sdc" ref={rootRef}>
        <div className="sdc-body">
          <span className="sdc-muted">{loadError}</span>
          <button type="button" className="sdc-ghost" onClick={() => { setLoading(true); load(); }}>Try again</button>
        </div>
      </div>
    );
  }
  if (!status || !status.requires_shipment) return null;   // no physical product on this deal
  // The BRAND submits their pickup address inside the "Ship Product" form, not here.
  if (status.my_role !== 'creator') return null;

  const dispatched = ['shipped', 'in_transit', 'delivered', 'received'].includes(status.shipment_status);
  const saved = status.address;                      // last confirmed delivery address
  const account = status.account_address;            // address on the account (KYC / signup)
  const accountComplete = Boolean(account) && (status.account_missing || []).length === 0;

  // One-tap choices while this deal's address is still unconfirmed.
  const options = [];
  if (saved && isValid(saved)) options.push({ key: 'saved', title: 'Your last delivery address', addr: saved });
  if (accountComplete && isValid(account) && !(saved && sameAddress(saved, account))) {
    options.push({ key: 'account', title: 'Address from your account', addr: account });
  }
  const showForm = editing || (!mine && options.length === 0);
  const showChoices = !mine && !showForm && options.length > 0;
  const prefilledFromAccount = Boolean(account) && !saved && !accountComplete;

  return (
    <div className="sdc" ref={rootRef}>
      <div className="sdc-head">
        <span className="sdc-ic"><Package size={17} /></span>
        <div>
          <h3>Confirm your delivery address</h3>
          <p>The product will be couriered here. The brand never sees your address.</p>
        </div>
      </div>

      {/* Both-sides confirmation status */}
      <div className="sdc-status">
        <span className={`sdc-chip ${mine ? 'ok' : 'wait'}`}>
          {mine ? <Check size={13} /> : <Clock size={13} />} You {mine ? 'confirmed' : 'pending'}
        </span>
        <span className={`sdc-chip ${theirs ? 'ok' : 'wait'}`}>
          {theirs ? <Check size={13} /> : <Clock size={13} />} {otherLabel} {theirs ? 'confirmed' : 'pending'}
        </span>
        {status.both_ready && (
          <span className="sdc-chip ready"><Truck size={13} /> {dispatched ? 'Dispatched' : 'Ready to dispatch'}</span>
        )}
      </div>

      <div className="sdc-body">
        {showChoices && (
          <div className="sdc-choices">
            <p className="sdc-lead"><UserRound size={14} /> We already have an address for you - pick one, or enter a new one.</p>
            {options.map((o) => (
              <div key={o.key} className="sdc-choice">
                <div className="sdc-addr">
                  <MapPin size={15} />
                  <div>
                    <em className="sdc-src">{o.title}</em>
                    <strong>{o.addr.full_name} · {o.addr.phone}</strong>
                    <span>{oneLine(o.addr)}</span>
                  </div>
                </div>
                <button type="button" className="sdc-save" disabled={saving} onClick={() => save(o.addr)}>
                  {saving ? 'Saving…' : 'Deliver here'}
                </button>
              </div>
            ))}
            <button type="button" className="sdc-edit" onClick={() => { setForm({ ...EMPTY }); setEditing(true); }}>
              Enter a new address
            </button>
          </div>
        )}

        {mine && !showForm && saved && (
          <>
            <div className="sdc-addr">
              <MapPin size={15} />
              <div>
                <strong>{saved.full_name} · {saved.phone}</strong>
                <span>{oneLine(saved)}</span>
              </div>
            </div>
            {!dispatched && (
              <button type="button" className="sdc-edit" onClick={() => { setForm({ ...EMPTY, ...saved }); setEditing(true); }}>Edit address</button>
            )}
            {status.both_ready && (
              <p className="sdc-note"><ShieldCheck size={13} /> Both addresses are in. Our team will generate the label and ship - you'll get tracking here.</p>
            )}
            {!theirs && (
              <p className="sdc-note"><Clock size={13} /> Waiting on the {otherLabel.toLowerCase()} to confirm their address.</p>
            )}
          </>
        )}

        {mine && !showForm && !saved && (
          <p className="sdc-note"><Check size={13} /> Your delivery address is confirmed for this deal.</p>
        )}

        {showForm && (
          <div className="sdc-form">
            {prefilledFromAccount && (
              <p className="sdc-lead sdc-full"><UserRound size={14} /> Pre-filled from your account - just add what's missing.</p>
            )}
            {account && !prefilledFromAccount && !sameAddress(form, account) && (
              <button type="button" className="sdc-ghost sdc-full" onClick={() => setForm({ ...EMPTY, ...account })}>
                Use the address from my account
              </button>
            )}
            <label>Full name<input ref={firstFieldRef} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Name for the courier" /></label>
            <label>Phone<input value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" inputMode="numeric" /></label>
            <label className="sdc-full">Address line 1<input value={form.line1} onChange={(e) => set('line1', e.target.value)} placeholder="House / building, street" /></label>
            <label className="sdc-full">Address line 2 <em>(optional)</em><input value={form.line2} onChange={(e) => set('line2', e.target.value)} placeholder="Area, landmark" /></label>
            <label>City<input value={form.city} onChange={(e) => set('city', e.target.value)} /></label>
            <label>State<input value={form.state} onChange={(e) => set('state', e.target.value)} /></label>
            <label>Pincode<input value={form.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit" inputMode="numeric" /></label>
            <label>Country<input value={form.country} onChange={(e) => set('country', e.target.value)} /></label>
            <div className="sdc-actions">
              {(saved || options.length > 0) && <button type="button" className="sdc-ghost" onClick={() => { setForm({ ...EMPTY, ...(saved || account || {}) }); setEditing(false); }}>Cancel</button>}
              <button type="button" className="sdc-save" disabled={saving || !isValid(form)} onClick={() => save(form)}>
                {saving ? 'Saving…' : 'Confirm delivery address'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .sdc{border:1px solid #e9ebf4;border-radius:14px;background:#fff;overflow:hidden;min-width:0}
        .sdc-head{display:flex;gap:12px;align-items:flex-start;padding:16px 18px;border-bottom:1px solid #f1f3fa}
        .sdc-ic{flex:none;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:#eef0ff;color:#5b6bff}
        .sdc-head h3{margin:0;font-size:15px;color:#15163a}
        .sdc-head p{margin:3px 0 0;font-size:12.5px;color:#9296ba}
        .sdc-status{display:flex;gap:8px;flex-wrap:wrap;padding:12px 18px;background:#fafbff;border-bottom:1px solid #f1f3fa}
        .sdc-chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px}
        .sdc-chip.ok{background:#e8f7ef;color:#0f7a43}
        .sdc-chip.wait{background:#fff4e5;color:#a35b00}
        .sdc-chip.ready{background:#eef0ff;color:#3730a3}
        .sdc-body{padding:16px 18px}
        .sdc-muted{color:#9296ba;font-size:13.5px}
        .sdc-lead{display:flex;align-items:center;gap:7px;margin:0 0 12px;font-size:13px;color:#585c7e}
        .sdc-choices{display:flex;flex-direction:column;gap:10px}
        .sdc-choice{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;border:1px solid #e6e8f3;border-radius:12px;padding:12px 14px}
        .sdc-choice .sdc-addr{flex:1 1 220px;min-width:0}
        .sdc-src{font-style:normal;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#9296ba}
        .sdc-addr{display:flex;gap:10px;color:#5b6bff}
        .sdc-addr strong{display:block;color:#15163a;font-size:14px}
        .sdc-addr span{display:block;color:#585c7e;font-size:13.5px;line-height:1.5;margin-top:2px;overflow-wrap:anywhere}
        .sdc-addr em{display:block}
        .sdc-edit{margin-top:12px;align-self:flex-start;border:1px solid #d6dbff;background:#fff;color:#4452f0;font-weight:700;font-size:13px;padding:7px 14px;border-radius:9px;cursor:pointer}
        .sdc-edit:hover{background:#eef0ff}
        .sdc-note{display:flex;align-items:center;gap:6px;margin:12px 0 0;font-size:12.5px;color:#9296ba}
        .sdc-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .sdc-full{grid-column:1 / -1}
        .sdc-form label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:#5b6573;min-width:0}
        .sdc-form label em{font-weight:500;color:#9296ba;font-style:normal}
        .sdc-form input{border:1px solid #e6e8f3;border-radius:10px;padding:9px 11px;font-size:14px;font-family:inherit;color:#15163a;outline:none;min-width:0;width:100%;box-sizing:border-box}
        .sdc-form input:focus{border-color:#5b6bff;box-shadow:0 0 0 3px rgba(91,107,255,.14)}
        .sdc-actions{grid-column:1 / -1;display:flex;gap:10px;justify-content:flex-end;margin-top:4px}
        .sdc-save{border:none;background:linear-gradient(100deg,#12124f,#07074e);color:#fff;font-weight:700;font-size:13.5px;padding:10px 18px;border-radius:10px;cursor:pointer;white-space:nowrap}
        .sdc-save:disabled{opacity:.55;cursor:not-allowed}
        .sdc-ghost{border:1px solid #e6e8f3;background:#fff;color:#5b6573;font-weight:600;font-size:13.5px;padding:10px 16px;border-radius:10px;cursor:pointer}
        @media (max-width:560px){.sdc-form{grid-template-columns:minmax(0,1fr)}}
      `}</style>
    </div>
  );
});

export default ShippingDetailsCard;
