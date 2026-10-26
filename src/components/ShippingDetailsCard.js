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
            <label className="sdc-full"><span>Address line 2 <em>(optional)</em></span><input value={form.line2} onChange={(e) => set('line2', e.target.value)} placeholder="Area, landmark" /></label>
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
        .sdc{border-radius:20px;background:#fff;overflow:hidden;min-width:0;box-shadow:inset 0 0 0 1px #e2e2f0;color:#07074e;font-family:'Inter',system-ui,sans-serif}
        .sdc-head{display:flex;gap:12px;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #edeef6}
        .sdc-ic{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#eef0ff;color:#4e60e6}
        .sdc-head h3{margin:0;font-family:'Readex Pro','Plus Jakarta Sans',sans-serif;font-weight:500;font-size:17px;color:#07074e}
        .sdc-head p{margin:3px 0 0;font-size:13.5px;color:#6e6e96}
        .sdc-status{display:flex;gap:8px;flex-wrap:wrap;padding:12px 20px;background:#f6f6fd;border-bottom:1px solid #edeef6}
        .sdc-chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;height:26px;padding:0 10px;border-radius:999px}
        .sdc-chip.ok{background:#e4f5ec;color:#13774f}
        .sdc-chip.wait{background:#fff2dc;color:#8a4b00}
        .sdc-chip.ready{background:#e6e8ff;color:#2a3ab8}
        .sdc-body{padding:18px 20px}
        .sdc-muted{color:#6e6e96;font-size:14px}
        .sdc-lead{display:flex;align-items:center;gap:7px;margin:0 0 12px;font-size:13.5px;color:#5a5a8c}
        .sdc-choices{display:flex;flex-direction:column;gap:10px}
        .sdc-choice{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;box-shadow:inset 0 0 0 1px #e2e2f0;border-radius:16px;padding:14px 16px}
        .sdc-choice .sdc-addr{flex:1 1 220px;min-width:0}
        .sdc-src{font-style:normal;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#6e6e96}
        .sdc-addr{display:flex;gap:10px;color:#4e60e6}
        .sdc-addr strong{display:block;color:#07074e;font-size:14.5px;font-weight:600}
        .sdc-addr span{display:block;color:#5a5a8c;font-size:14px;line-height:1.5;margin-top:2px;overflow-wrap:anywhere}
        .sdc-addr em{display:block}
        .sdc-edit{margin-top:12px;align-self:flex-start;border:1px solid #c9cbea;background:#fff;color:#07074e;font-family:inherit;font-weight:700;font-size:13.5px;height:40px;padding:0 18px;border-radius:999px;cursor:pointer}
        .sdc-edit:hover{background:#f3f3ff}
        .sdc-note{display:flex;align-items:center;gap:6px;margin:12px 0 0;font-size:13px;color:#6e6e96}
        .sdc-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .sdc-full{grid-column:1 / -1}
        .sdc-form label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#07074e;min-width:0}
        .sdc-form label em{font-weight:500;color:#6e6e96;font-style:normal}
        .sdc-form input{border:1.5px solid transparent;background:#f6f6fd;border-radius:16px;padding:11px 14px;font-size:14px;font-weight:400;font-family:inherit;color:#07074e;outline:none;min-width:0;width:100%;box-sizing:border-box}
        .sdc-form input:focus{background:#fff;border-color:#7387ff;box-shadow:0 0 0 3px rgba(115,135,255,.2)}
        .sdc-actions{grid-column:1 / -1;display:flex;gap:10px;justify-content:flex-end;margin-top:4px}
        .sdc-save{border:none;background:#07074e;color:#fff;font-family:inherit;font-weight:700;font-size:14px;height:44px;padding:0 22px;border-radius:999px;cursor:pointer;white-space:nowrap}
        .sdc-save:hover:not(:disabled){background:#12124f}
        .sdc-save:disabled{opacity:.55;cursor:not-allowed}
        .sdc-ghost{border:1px solid #c9cbea;background:#fff;color:#07074e;font-family:inherit;font-weight:700;font-size:14px;height:44px;padding:0 20px;border-radius:999px;cursor:pointer}
        .sdc-ghost:hover{background:#f3f3ff}
        @media (max-width:560px){.sdc-form{grid-template-columns:minmax(0,1fr)}.sdc-actions{flex-wrap:wrap}.sdc-actions button{flex:1 1 140px}.sdc-form input{font-size:16px;min-height:46px}.sdc-edit{height:44px}.sdc-head,.sdc-body,.sdc-status{padding-left:16px;padding-right:16px}}
        `}</style>
    </div>
  );
});

export default ShippingDetailsCard;
