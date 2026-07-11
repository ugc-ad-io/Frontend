import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Package, MapPin, Check, Clock, Truck, ShieldCheck } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const EMPTY = { full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' };

/**
 * Shipping details for a deal — used by BOTH parties.
 *   Brand   → pickup address (where the courier collects the product)
 *   Creator → delivery address (where the product is sent) — confirmation step
 *
 * Masked shipping is preserved: each side only ever sees THEIR OWN address; the
 * other party is shown as a confirmed/pending status only. Once both are in, the
 * backend flags the shipment `awaiting_dispatch` and notifies ops to print a label.
 *
 * Props: campaignId (the deal/campaign id), onReady?(bothReady)
 */
export default function ShippingDetailsCard({ campaignId, onReady }) {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState(null);   // { my_role, brand_confirmed, creator_confirmed, both_ready, shipment_status, requires_shipment }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!campaignId) return;
    try {
      const { data } = await axios.get(`${API}/shipping/address`, { params: { campaign_id: campaignId } });
      setStatus(data);
      if (data.address) setForm({ ...EMPTY, ...data.address });
      // No address yet → open the form straight away.
      setEditing(!data.address);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isCreator = status?.my_role === 'creator';
  const mine = isCreator ? status?.creator_confirmed : status?.brand_confirmed;
  const theirs = isCreator ? status?.brand_confirmed : status?.creator_confirmed;
  const otherLabel = isCreator ? 'Brand' : 'Creator';

  const valid = ['full_name', 'phone', 'line1', 'city', 'state', 'pincode'].every((k) => String(form[k] || '').trim())
    && /^\d{6}$/.test(String(form.pincode).trim())
    && /^\d{10}$/.test(String(form.phone).replace(/\D/g, '').slice(-10));

  const save = async () => {
    if (!valid) { toast.error('Fill all fields — 10-digit phone and 6-digit pincode.'); return; }
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/shipping/address`, { ...form, campaign_id: campaignId });
      toast.success(data.both_ready
        ? 'Both addresses confirmed — the team will dispatch shortly.'
        : `Saved. Waiting for the ${otherLabel.toLowerCase()} to confirm.`);
      setEditing(false);
      await load();
      if (onReady) onReady(!!data.both_ready);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not save address');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="sdc"><div className="sdc-body"><span className="sdc-muted">Loading shipping details…</span></div></div>;
  if (!status || !status.requires_shipment) return null;   // no physical product on this deal
  // The BRAND submits their pickup address inside the "Ship Product" form, not here.
  // This card is only ever for the creator confirming where the product is sent.
  if (status.my_role !== 'creator') return null;

  const dispatched = ['shipped', 'in_transit', 'delivered', 'received'].includes(status.shipment_status);

  return (
    <div className="sdc">
      <div className="sdc-head">
        <span className="sdc-ic"><Package size={17} /></span>
        <div>
          <h3>{isCreator ? 'Confirm your delivery address' : 'Pickup address'}</h3>
          <p>{isCreator
            ? 'The product will be couriered here. The brand never sees your address.'
            : 'Where the courier collects the product. The creator never sees your address.'}</p>
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
        {!editing && status.address ? (
          <>
            <div className="sdc-addr">
              <MapPin size={15} />
              <div>
                <strong>{status.address.full_name} · {status.address.phone}</strong>
                <span>
                  {[status.address.line1, status.address.line2, status.address.city,
                    `${status.address.state} ${status.address.pincode}`, status.address.country]
                    .filter(Boolean).join(', ')}
                </span>
              </div>
            </div>
            {!dispatched && (
              <button type="button" className="sdc-edit" onClick={() => setEditing(true)}>Edit address</button>
            )}
            {status.both_ready && (
              <p className="sdc-note"><ShieldCheck size={13} /> Both addresses are in. Our team will generate the label and ship — you'll get tracking here.</p>
            )}
            {!theirs && (
              <p className="sdc-note"><Clock size={13} /> Waiting on the {otherLabel.toLowerCase()} to confirm their address.</p>
            )}
          </>
        ) : (
          <div className="sdc-form">
            <label>Full name<input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Name for the courier" /></label>
            <label>Phone<input value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" inputMode="numeric" /></label>
            <label className="sdc-full">Address line 1<input value={form.line1} onChange={(e) => set('line1', e.target.value)} placeholder="House / building, street" /></label>
            <label className="sdc-full">Address line 2 <em>(optional)</em><input value={form.line2} onChange={(e) => set('line2', e.target.value)} placeholder="Area, landmark" /></label>
            <label>City<input value={form.city} onChange={(e) => set('city', e.target.value)} /></label>
            <label>State<input value={form.state} onChange={(e) => set('state', e.target.value)} /></label>
            <label>Pincode<input value={form.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit" inputMode="numeric" /></label>
            <label>Country<input value={form.country} onChange={(e) => set('country', e.target.value)} /></label>
            <div className="sdc-actions">
              {status.address && <button type="button" className="sdc-ghost" onClick={() => { setForm({ ...EMPTY, ...status.address }); setEditing(false); }}>Cancel</button>}
              <button type="button" className="sdc-save" disabled={saving || !valid} onClick={save}>
                {saving ? 'Saving…' : (isCreator ? 'Confirm delivery address' : 'Save pickup address')}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .sdc{border:1px solid #e9ebf4;border-radius:14px;background:#fff;overflow:hidden}
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
        .sdc-addr{display:flex;gap:10px;color:#5b6bff}
        .sdc-addr strong{display:block;color:#15163a;font-size:14px}
        .sdc-addr span{display:block;color:#585c7e;font-size:13.5px;line-height:1.5;margin-top:2px}
        .sdc-edit{margin-top:12px;border:1px solid #d6dbff;background:#fff;color:#4452f0;font-weight:700;font-size:13px;padding:7px 14px;border-radius:9px;cursor:pointer}
        .sdc-edit:hover{background:#eef0ff}
        .sdc-note{display:flex;align-items:center;gap:6px;margin:12px 0 0;font-size:12.5px;color:#9296ba}
        .sdc-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .sdc-full{grid-column:1 / -1}
        .sdc-form label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:#5b6573}
        .sdc-form label em{font-weight:500;color:#9296ba;font-style:normal}
        .sdc-form input{border:1px solid #e6e8f3;border-radius:10px;padding:9px 11px;font-size:14px;font-family:inherit;color:#15163a;outline:none}
        .sdc-form input:focus{border-color:#5b6bff;box-shadow:0 0 0 3px rgba(91,107,255,.14)}
        .sdc-actions{grid-column:1 / -1;display:flex;gap:10px;justify-content:flex-end;margin-top:4px}
        .sdc-save{border:none;background:linear-gradient(100deg,#12124f,#07074e);color:#fff;font-weight:700;font-size:13.5px;padding:10px 18px;border-radius:10px;cursor:pointer}
        .sdc-save:disabled{opacity:.55;cursor:not-allowed}
        .sdc-ghost{border:1px solid #e6e8f3;background:#fff;color:#5b6573;font-weight:600;font-size:13.5px;padding:10px 16px;border-radius:10px;cursor:pointer}
        @media (max-width:560px){.sdc-form{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
