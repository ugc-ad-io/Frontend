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
      accept: 'Booking accepted — the brand will send the brief next.',
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
        ? `New price accepted — ${inr(diff)} more was charged from your credits.`
        : (diff < 0 ? `New price accepted — ${inr(-diff)} was refunded to your wallet.` : 'New price accepted.'));
    } else {
      toast.success('Booking cancelled — you have been refunded in full.');
    }
    return res;
  });

  const sendBrief = () => call(async () => {
    const res = await axios.post(`${API}/bookings/${id}/brief`, { brief_text: brief });
    toast.success('Brief sent — the work has started.');
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
            <Row label="Delivery" value={c.delivery_date || '—'} />
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
        <div className="bkc-wait"><Clock size={16} /> Booking confirmed. Waiting for the brand to send the brief — the work starts then.</div>
      )}

      {/* ---------- brand: waiting on the creator ---------- */}
      {role === 'brand' && status === 'pending_creator' && (
        <div className="bkc-wait">
          <Clock size={16} /> {inr(Number(c.amount_paid || 0))} is held in escrow. Waiting for the creator to accept — you're refunded in full if they decline.
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
              <p className="bkc-hint">Pre-filled from what you wrote at checkout — edit it before sending. Contact details are not allowed.</p>
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
        .bkc { background:#fff; border:1.5px solid #e8ecff; border-left:4px solid #4452f0; border-radius:14px; padding:18px 20px; margin-bottom:16px; box-shadow:0 8px 24px -18px rgba(15,23,42,.4); }
        .bkc-head h2 { margin:6px 0 4px; font-size:1.05rem; color:#07074e; }
        .bkc-head p { margin:0; font-size:.85rem; color:#64748b; line-height:1.5; }
        .bkc-tag { display:inline-block; font-size:.68rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#4452f0; background:#eef0ff; border-radius:999px; padding:3px 9px; }
        .bkc-tag.warn { color:#b45309; background:#fff7ed; }
        .bkc-tag.ok { color:#15803d; background:#e6f6ec; }
        .bkc-quote { margin:8px 0 0; font-style:italic; color:#475569; font-size:.85rem; }
        .bkc-facts { margin:14px 0; border:1px solid #eef0f6; border-radius:10px; padding:10px 14px; display:flex; flex-direction:column; gap:6px; }
        .bkc-row { display:flex; justify-content:space-between; font-size:.84rem; color:#64748b; }
        .bkc-row b { color:#07074e; }
        .bkc-row b.big { font-size:1rem; }
        .bkc-form { margin-top:12px; display:flex; flex-direction:column; gap:10px; }
        .bkc-form label { display:flex; flex-direction:column; gap:5px; font-size:.8rem; font-weight:700; color:#2d3748; }
        .bkc-form input, .bkc-form textarea { padding:10px 12px; border:1.5px solid #e2e8f0; border-radius:9px; font-family:inherit; font-size:.9rem; resize:vertical; }
        .bkc-form input:focus, .bkc-form textarea:focus { outline:none; border-color:#4452f0; }
        .bkc-hint { margin:0; font-size:.75rem; color:#94a3b8; }
        .bkc-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; margin-top:12px; }
        .bkc-btn { display:inline-flex; align-items:center; gap:6px; border-radius:9px; padding:9px 16px; font-weight:700; font-size:.85rem; cursor:pointer; border:1.5px solid transparent; }
        .bkc-btn:disabled { opacity:.6; cursor:not-allowed; }
        .bkc-btn.go { background:#16a34a; color:#fff; }
        .bkc-btn.go:hover:not(:disabled) { background:#128a3e; }
        .bkc-btn.primary { background:#4452f0; color:#fff; }
        .bkc-btn.ghost { background:#f1f2f9; color:#4a5568; }
        .bkc-btn.ghost:hover:not(:disabled) { background:#e2e8f0; }
        .bkc-btn.danger { background:#d64545; color:#fff; }
        .bkc-btn.danger-ghost { background:#fff; color:#b91c1c; border-color:#fecaca; }
        .bkc-btn.danger-ghost:hover:not(:disabled) { background:#fef2f2; }
        .bkc-wait { display:flex; align-items:center; gap:9px; font-size:.85rem; color:#475569; line-height:1.5; }
        .bkc-wait b { color:#07074e; }
      `}</style>
    </section>
  );
}
