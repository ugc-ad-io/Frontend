// Booking request card — the gate between "brand paid" and "work started".
//
// A direct booking (PlanBrief checkout) charges the brand up front and parks the
// money in escrow, but the creator is NOT committed yet. Until they answer, this
// card is the only thing either side can act on:
//
//   pending_creator  → creator: Accept / Decline / Propose a different price
//   price_revision   → brand:   Accept the new price (pays/refunds the difference) or Cancel
//   accepted         → brand:   Send the brief (this is what actually starts the work)
//
// Rendered on both sides — `role` decides which half of the flow you see.
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Check, X, IndianRupee, FileText, Clock, Send } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function BookingCard({ deal, role, onDone }) {
  const c = deal?.campaign || {};
  const status = c.booking_status;

  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null);      // 'decline' | 'revise' | 'brief' | null
  const [note, setNote] = useState('');
  const [price, setPrice] = useState('');
  const [brief, setBrief] = useState('');

  // Only direct bookings have a booking_status. Bid-won campaigns skip all of this.
  if (!status || status === 'declined') return null;
  if (status === 'accepted' && c.brief_sent) return null;

  const id = c.id;
  const subtotal = Number(c.budget_max || c.budget_min || 0);
  const videos = Number(c.video_count || 1);
  const proposed = Number(c.proposed_amount || 0);

  const call = async (fn) => {
    setBusy(true);
    try {
      await fn();
      if (onDone) onDone();
    } catch (e) {
      // 402 on a price bump: tell them the gap, don't bury it.
      const d = e?.response?.data;
      if (e?.response?.status === 402 && d?.shortfall) {
        toast.error(`${d.detail} Add ${inr(d.shortfall)} to your wallet first.`);
      } else {
        toast.error(apiErrorMessage(e, 'Something went wrong'));
      }
    } finally {
      setBusy(false);
    }
  };

  const respond = (action, body = {}) => call(async () => {
    const res = await axios.post(`${API}/bookings/${id}/respond`, { action, ...body });
    const msg = {
      accept: 'Booking accepted - the brand will send the brief next.',
      decline: 'Booking declined. The brand has been refunded.',
      revise: 'Your price was sent to the brand.',
    }[action];
    toast.success(msg);
    return res;
  });

  const decidePrice = (action) => call(async () => {
    const res = await axios.post(`${API}/bookings/${id}/price`, { action });
    if (action === 'accept') {
      const diff = Number(res.data?.difference_charged || 0);
      toast.success(diff > 0
        ? `New price accepted - ${inr(diff)} more was charged from your credits.`
        : (diff < 0 ? `New price accepted - ${inr(-diff)} was refunded to your wallet.` : 'New price accepted.'));
    } else {
      toast.success('Booking cancelled - you have been refunded in full.');
    }
    return res;
  });

  const sendBrief = () => call(async () => {
    const res = await axios.post(`${API}/bookings/${id}/brief`, { brief_text: brief });
    toast.success('Brief sent - the work has started.');
    return res;
  });

  const Row = ({ label, value, strong }) => (
    <div className="bkc-row"><span>{label}</span><b className={strong ? 'big' : ''}>{value}</b></div>
  );

  return (
    <section className="bkc">
      {/* ---------- creator: a request is waiting for them ---------- */}
      {role === 'creator' && status === 'pending_creator' && (
        <>
          <header className="bkc-head">
            <span className="bkc-tag">Booking request</span>
            <h2>{c.brand_name || 'A brand'} wants to book you</h2>
            <p>The payment is already held in escrow. Accept to lock it in, or tell them your price.</p>
          </header>
          <div className="bkc-facts">
            <Row label="Videos" value={videos} />
            <Row label="Delivery" value={c.delivery_date || '-'} />
            <Row label="You'll be paid" value={inr(subtotal)} strong />
          </div>

          {mode === 'decline' && (
            <div className="bkc-form">
              <label>Reason (optional)<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Let the brand know why…" /></label>
              <div className="bkc-actions">
                <button className="bkc-btn ghost" onClick={() => setMode(null)} disabled={busy}>Back</button>
                <button className="bkc-btn danger" onClick={() => respond('decline', { message: note })} disabled={busy}>
                  {busy ? 'Declining…' : 'Confirm decline'}
                </button>
              </div>
            </div>
          )}

          {mode === 'revise' && (
            <div className="bkc-form">
              <label>Your price for this booking
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={String(subtotal)} autoFocus />
              </label>
              <label>Message (optional)<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this price?" /></label>
              <p className="bkc-hint">The brand pays the difference if it's higher, or gets a refund if it's lower. They can still cancel.</p>
              <div className="bkc-actions">
                <button className="bkc-btn ghost" onClick={() => setMode(null)} disabled={busy}>Back</button>
                <button className="bkc-btn primary" onClick={() => respond('revise', { amount: Number(price), message: note })} disabled={busy || !(Number(price) > 0)}>
                  {busy ? 'Sending…' : `Propose ${inr(price || 0)}`}
                </button>
              </div>
            </div>
          )}

          {!mode && (
            <div className="bkc-actions">
              <button className="bkc-btn danger-ghost" onClick={() => { setNote(''); setMode('decline'); }} disabled={busy}><X size={15} /> Decline</button>
              <button className="bkc-btn ghost" onClick={() => { setNote(''); setPrice(String(subtotal)); setMode('revise'); }} disabled={busy}><IndianRupee size={15} /> Propose another price</button>
              <button className="bkc-btn go" onClick={() => respond('accept')} disabled={busy}><Check size={15} /> {busy ? 'Accepting…' : 'Accept booking'}</button>
            </div>
          )}
        </>
      )}

      {/* ---------- creator: waiting on the brand ---------- */}
      {role === 'creator' && status === 'price_revision' && (
        <div className="bkc-wait"><Clock size={16} /> You proposed <b>{inr(proposed)}</b>. Waiting for the brand to accept or cancel.</div>
      )}
      {role === 'creator' && status === 'accepted' && !c.brief_sent && (
        <div className="bkc-wait"><Clock size={16} /> Booking confirmed. Waiting for the brand to send the brief - the work starts then.</div>
      )}

      {/* ---------- brand: waiting on the creator ---------- */}
      {role === 'brand' && status === 'pending_creator' && (
        <div className="bkc-wait">
          <Clock size={16} /> {inr(Number(c.amount_paid || 0))} is held in escrow. Waiting for the creator to accept - you're refunded in full if they decline.
        </div>
      )}

      {/* ---------- brand: the creator wants a different price ---------- */}
      {role === 'brand' && status === 'price_revision' && (
        <>
          <header className="bkc-head">
            <span className="bkc-tag warn">Price proposal</span>
            <h2>The creator proposed a new price</h2>
            {c.proposed_message && <p className="bkc-quote">“{c.proposed_message}”</p>}
          </header>
          <div className="bkc-facts">
            <Row label="You booked at" value={inr(subtotal)} />
            <Row label="They're asking" value={inr(proposed)} strong />
            <Row
              label={proposed >= subtotal ? 'Extra to pay (incl. fee)' : 'To be refunded'}
              value={inr(Math.abs(Math.round((proposed - subtotal) * (1 + Number(c.fee_percent || 20) / 100))))}
            />
          </div>
          <div className="bkc-actions">
            <button className="bkc-btn danger-ghost" onClick={() => decidePrice('reject')} disabled={busy}><X size={15} /> Cancel &amp; refund</button>
            <button className="bkc-btn go" onClick={() => decidePrice('accept')} disabled={busy}><Check size={15} /> {busy ? 'Working…' : 'Accept new price'}</button>
          </div>
        </>
      )}

      {/* ---------- brand: accepted, now send the brief ---------- */}
      {role === 'brand' && status === 'accepted' && !c.brief_sent && (
        <>
          <header className="bkc-head">
            <span className="bkc-tag ok">Accepted</span>
            <h2>Send your brief to start the work</h2>
            <p>The creator accepted and is waiting. They can&apos;t start until the brief arrives.</p>
          </header>
          {mode !== 'brief' ? (
            <div className="bkc-actions">
              <button className="bkc-btn go" onClick={() => { setBrief(c.brief_draft?.brief_text || ''); setMode('brief'); }}>
                <FileText size={15} /> Write the brief
              </button>
            </div>
          ) : (
            <div className="bkc-form">
              <label>The brief
                <textarea rows={8} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What should the creator make?" autoFocus />
              </label>
              <p className="bkc-hint">Pre-filled from what you wrote at checkout - edit it before sending. Contact details are not allowed.</p>
              <div className="bkc-actions">
                <button className="bkc-btn ghost" onClick={() => setMode(null)} disabled={busy}>Back</button>
                <button className="bkc-btn go" onClick={sendBrief} disabled={busy || !brief.trim()}>
                  <Send size={15} /> {busy ? 'Sending…' : 'Send brief & start work'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .bkc { background:#fff; border-radius:20px; padding:20px 22px; margin-bottom:16px; box-shadow:0 1px 2px rgba(7,7,78,.05),0 10px 26px -18px rgba(7,7,78,.28); color:#07074e; font-family:'Inter',system-ui,sans-serif; }
        .bkc-head h2 { margin:8px 0 4px; font-family:'Readex Pro','Plus Jakarta Sans',sans-serif; font-weight:500; font-size:18px; letter-spacing:-.01em; color:#07074e; }
        .bkc-head p { margin:0; font-size:14px; color:#6e6e96; line-height:1.5; }
        .bkc-tag { display:inline-flex; align-items:center; height:24px; font-size:11.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#2a3ab8; background:#e6e8ff; border-radius:6px; padding:0 10px; }
        .bkc-tag.warn { color:#8a4b00; background:#fff2dc; }
        .bkc-tag.ok { color:#13774f; background:#e4f5ec; }
        .bkc-quote { margin:8px 0 0; color:#5a5a8c; font-size:14px; }
        .bkc-facts { margin:14px 0; border-radius:16px; background:#f6f6fd; padding:12px 16px; display:flex; flex-direction:column; gap:8px; }
        .bkc-row { display:flex; justify-content:space-between; font-size:14px; color:#6e6e96; }
        .bkc-row b { color:#07074e; font-weight:600; }
        .bkc-row b.big { font-size:16px; font-weight:700; }
        .bkc-form { margin-top:12px; display:flex; flex-direction:column; gap:10px; }
        .bkc-form label { display:flex; flex-direction:column; gap:6px; font-size:13px; font-weight:700; color:#07074e; }
        .bkc-form input, .bkc-form textarea { padding:11px 14px; border:1.5px solid transparent; background:#f6f6fd; border-radius:16px; font-family:inherit; font-size:14px; color:#07074e; resize:vertical; font-weight:400; }
        .bkc-form input:focus, .bkc-form textarea:focus { outline:none; background:#fff; border-color:#7387ff; box-shadow:0 0 0 3px rgba(115,135,255,.2); }
        .bkc-hint { margin:0; font-size:12.5px; color:#6e6e96; }
        .bkc-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; margin-top:12px; }
        .bkc-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; height:44px; border-radius:999px; padding:0 20px; font-family:inherit; font-weight:700; font-size:14px; cursor:pointer; border:1px solid transparent; }
        .bkc-btn:disabled { opacity:.55; cursor:not-allowed; }
        .bkc-btn.go, .bkc-btn.primary { background:#07074e; color:#fff; }
        .bkc-btn.go:hover:not(:disabled), .bkc-btn.primary:hover:not(:disabled) { background:#12124f; }
        .bkc-btn.ghost { background:#fff; color:#07074e; border-color:#c9cbea; }
        .bkc-btn.ghost:hover:not(:disabled) { background:#f3f3ff; }
        .bkc-btn.danger { background:#e5484d; color:#fff; }
        .bkc-btn.danger-ghost { background:#fff; color:#b42318; border-color:#f3c1c1; }
        .bkc-btn.danger-ghost:hover:not(:disabled) { background:#fde8e8; }
        .bkc-wait { display:flex; align-items:center; gap:10px; font-size:14px; color:#5a5a8c; line-height:1.5; }
        .bkc-wait b { color:#07074e; }
        .bkc-wait svg { flex:none; color:#4e60e6; }
        .bkc-row { gap:12px; }
        .bkc-row b { text-align:right; overflow-wrap:anywhere; }
        @media (max-width:768px) {
          .bkc { padding:16px 14px; }
          .bkc-actions { justify-content:stretch; }
          .bkc-btn { flex:1 1 150px; }
          .bkc-form input, .bkc-form textarea { font-size:16px; }
        }
        `}</style>
    </section>
  );
}
