import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Check, CheckCircle2, Info, Truck, MessageCircle, WifiOff } from 'lucide-react';
import BottomSheet from '../../shell/BottomSheet';
import { apiErrorMessage } from '../../../utils/apiError';
import { mediaUrl } from '../../../utils/mediaUrl';
import { STAGE_LABELS } from '../../../utils/campaignStage';
import { hireUnfunded, showUnfundedHire, escrowHeldText, WALLET_RECHARGE_PATH } from '../../../utils/hireFunding';
import './campaigns.css';

// Shared pieces for the brand campaign screens (list, detail, compare bids, post): formatters,
// states and the hire / decline / finish-hiring sheets that the detail and bids screens both use.

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
export const API = `${BACKEND_URL}/api`;
export const ROUTES = {
  campaigns: '/dashboard/business/all-campaigns',
  campaign: (id) => `/dashboard/business/campaign/${id}`,
  bids: '/dashboard/business/pending-bids',
  post: '/dashboard/business/post-brief',
  shipments: '/dashboard/business/shipments',
  wallet: '/dashboard/business/wallet',
  creator: (id) => `/dashboard/business/creator/${id}`,
  chat: (id) => `/messages?conv=${id}`,
};

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const assetUrl = mediaUrl;
export const fmtDay = (d) => {
  if (!d) return '';
  const t = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? `${d}T00:00:00` : d);
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
export const fmtDate = (d) => {
  if (!d) return '-';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? '-' : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const isVideoUrl = (u) => /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(String(u || '').split('?')[0]);
export const campaignThumb = (c) => c?.image_url || c?.product_image || (c?.product_images || [])[0] || c?.cover_image || c?.brand_logo_url || c?.logo || '';
// A raw 24-char hex string is a Mongo ObjectId, not a name - never show it.
const isObjectId = (s) => /^[0-9a-f]{24}$/i.test(String(s || ''));
export const bidName = (b) => {
  const n = String(b?.creator_name || b?.creator_nickname || b?.public_creator_id || '').replace(/^@+/, '').trim();
  return isObjectId(n) ? '' : n;
};
export const bidFirstName = (b) => String(bidName(b) || 'Creator').trim().split(/\s+/)[0] || 'Creator';
export const initialOf = (name) => (String(name || 'C').replace(/[^A-Za-z0-9]/g, '').charAt(0) || 'C').toUpperCase();
// Back button target: real history when there is some (in-app navigation), else a sensible parent.
export const backOr = (fallback) => (typeof window !== 'undefined' && window.history.state?.idx > 0 ? true : fallback);

export function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
}

export function OfflineStrip() {
  const on = useOnline();
  if (on) return null;
  return <div className="ap-cp-offline" role="status"><WifiOff size={16} /> You&rsquo;re offline. Showing what was saved; actions need a connection.</div>;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, busy }) {
  const on = useOnline();
  return (
    <div className="ap-empty" role="alert">
      <span className="ap-cp-emptyic ap-cp-emptyic--err"><WifiOff size={30} /></span>
      <h3>{on ? title : 'You’re offline'}</h3>
      <p>{on ? (message || 'Please try again.') : 'Reconnect to the internet, then try again. Nothing was changed.'}</p>
      {onRetry && <button type="button" className="ap-btn" onClick={onRetry} disabled={busy}>{busy ? 'Retrying…' : 'Retry'}</button>}
    </div>
  );
}

export function SkelCards({ n = 3, h = 120 }) {
  return (
    <div className="ap-cp-skels" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="ap-skel" style={{ height: h, borderRadius: 20 }} />)}
    </div>
  );
}

export function Thumb({ src, name, w = 48, h = 60, r = 12 }) {
  const u = src ? assetUrl(src) : '';
  return (
    <span className="ap-cp-thumb" style={{ width: w, height: h, borderRadius: r }}>
      {u ? <img src={u} alt="" /> : <b>{initialOf(name)}</b>}
    </span>
  );
}

export function Avatar({ src, name, size = 36 }) {
  const u = src ? assetUrl(src) : '';
  return (
    <span className="ap-cp-ava" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {u ? <img src={u} alt="" /> : initialOf(name)}
    </span>
  );
}

/** Six segment stage bar (Brief / Bids / Shipped / Filming / Review / Done). `idx` = current segment. */
export function StageBar({ idx, completed = false, labels = true, label, stages = STAGE_LABELS }) {
  return (
    <div className="ap-cp-stage" role="list" aria-label={label || 'Progress'} style={{ '--n': stages.length }}>
      <div className="ap-cp-stage-bar">
        {stages.map((n, i) => {
          const done = completed || i < idx;
          const now = !completed && i === idx;
          return <span key={n} role="listitem" aria-label={`${n}${done ? ', done' : now ? ', now' : ''}`} className={`ap-cp-seg${done ? ' is-done' : now ? ' is-now' : ''}`} />;
        })}
      </div>
      {labels && (
        <div className="ap-cp-stage-lab" aria-hidden="true">
          {stages.map((n, i) => <span key={n} className={!completed && i === idx ? 'is-now' : ''}>{n}</span>)}
        </div>
      )}
    </div>
  );
}

export const Row = ({ label, value, strong }) => (
  <div className={`ap-cp-kv${strong ? ' is-total' : ''}`}><span>{label}</span><b>{value}</b></div>
);

/** Wallet balance (available_balance) or null while loading / when it can't be read. */
export function useWalletBalance(enabled = true) {
  const [bal, setBal] = useState(null);
  const load = useCallback(() => axios.get(`${API}/business/wallet`).then((r) => setBal(Number(r.data?.available_balance ?? r.data?.balance ?? 0))).catch(() => setBal(null)), []);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  return [bal, load];
}

/**
 * The hire (accept bid) / decline / finish-hiring flows as bottom sheets. Both the compare-bids screen and the
 * campaign detail use it, so the endpoints, guards and toasts exist once.
 *   const act = useBidActions(onChanged);  act.hire(campaign, bid)  act.decline(campaign, bid)  act.finish(campaign)
 *   render {act.node} anywhere inside the screen.
 * onChanged({ kind: 'hire'|'decline'|'finish', ... }) lets the screen reload / mark the bid.
 */
export function useBidActions(onChanged) {
  const navigate = useNavigate();
  const [ask, setAsk] = useState(null);       // { kind, campaign, bid }
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);     // hire success { who, data, campaign, bid }
  const lock = useRef(false);                 // one request at a time: hiring moves money
  const open = ask?.kind === 'hire';
  const [wallet, reloadWallet] = useWalletBalance(open);

  const close = () => { if (!busy) setAsk(null); };

  const confirmHire = async () => {
    if (lock.current || !ask) return;
    const { campaign, bid } = ask;
    if (!bid?.creator_id) { toast.error('Could not identify the creator for this bid.'); return; }
    lock.current = true; setBusy(true);
    try {
      const { data } = await axios.post(`${API}/campaigns/${campaign.id}/select-creator?creator_id=${encodeURIComponent(bid.creator_id)}`);
      const who = bidFirstName(bid);
      if (hireUnfunded(data)) showUnfundedHire(toast, data, who, navigate);
      else toast.success(`${who} selected! ${escrowHeldText(data)}`);
      setAsk(null);
      setDone({ who, data, campaign, bid });
      reloadWallet();
      onChanged?.({ kind: 'hire', campaign, bid, data });
    } catch (e) {
      if (e?.response?.status === 402) toast.error(e.response.data?.detail || 'Not enough credits to select this creator.');
      else toast.error(apiErrorMessage(e, 'Failed to accept bid'));
    } finally { lock.current = false; setBusy(false); }
  };

  const confirmDecline = async () => {
    if (lock.current || !ask) return;
    const { campaign, bid } = ask;
    const id = bid.id ?? bid.creator_id;
    lock.current = true; setBusy(true);
    try {
      await axios.post(`${API}/campaigns/${campaign.id}/bids/${encodeURIComponent(id)}/decline`);
      toast.success('Bid declined - the creator has been notified.');
      setAsk(null);
      onChanged?.({ kind: 'decline', campaign, bid, bidId: id });
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not decline this bid'));
    } finally { lock.current = false; setBusy(false); }
  };

  const confirmFinish = async () => {
    if (lock.current || !ask) return;
    const { campaign } = ask;
    lock.current = true; setBusy(true);
    try {
      const { data } = await axios.post(`${API}/campaigns/${campaign.id}/finish-hiring`);
      const back = Number(data?.refunded || 0);
      const n = data?.creators_hired;
      toast.success(back > 0
        ? `Hiring closed${n ? ` with ${n} creator${n === 1 ? '' : 's'}` : ''} - ${inr(back)} refunded to your wallet.`
        : `Hiring closed${n ? ` with ${n} creator${n === 1 ? '' : 's'}` : ''}. Unused budget refunded to your wallet.`);
      setAsk(null);
      onChanged?.({ kind: 'finish', campaign, data });
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not close hiring'));
    } finally { lock.current = false; setBusy(false); }
  };

  const amount = Number(ask?.bid?.amount || 0);
  const fee = Math.round(amount * 0.2);
  const held = amount + fee;
  const who = ask?.bid ? bidFirstName(ask.bid) : '';
  const short = wallet != null && wallet < held;

  const hiredN = ask?.campaign ? (Array.isArray(ask.campaign.selected_creators) && ask.campaign.selected_creators.length ? ask.campaign.selected_creators.length : (ask.campaign.selected_creator ? 1 : 0)) : 0;
  const wanted = Math.max(1, Number(ask?.campaign?.creators_wanted) || 1);

  const node = (
    <>
      <BottomSheet
        open={ask?.kind === 'hire'}
        onClose={close}
        title={`Hire ${who}?`}
        subtitle={ask?.campaign?.title}
        footer={(
          <>
            <button type="button" className="ap-btn ap-cp-soft ap-cp-lg" style={{ flex: 1 }} onClick={close} disabled={busy}>Cancel</button>
            <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={confirmHire} disabled={busy}>{busy ? 'Hiring…' : 'Confirm & hire'}</button>
          </>
        )}
      >
        <div className="ap-cp-kvs">
          <Row label="Bid" value={inr(amount)} />
          <Row label="Platform fee 20%" value={inr(fee)} />
          <Row label="Held in escrow now" value={inr(held)} strong />
        </div>
        <div className="ap-cp-note"><Info size={18} /><span>The money moves from your wallet into escrow and is released to the creator only after you approve the video.{wallet != null && !short ? ` Your wallet after this: ${inr(wallet - held)}.` : ''}</span></div>
        {short && (
          <div className="ap-cp-note ap-cp-note--warn"><Info size={18} /><span>Your wallet has {inr(wallet)}, {inr(held - wallet)} short. You can still hire, but add funds so the escrow is funded and work can start. <button type="button" className="ap-link" onClick={() => navigate(WALLET_RECHARGE_PATH)}>Add funds</button></span></div>
        )}
      </BottomSheet>

      <BottomSheet
        open={ask?.kind === 'decline'}
        onClose={close}
        title={`Decline ${who}’s bid?`}
        footer={(
          <>
            <button type="button" className="ap-btn ap-cp-soft ap-cp-lg" style={{ flex: 1 }} onClick={close} disabled={busy}>Cancel</button>
            <button type="button" className="ap-btn ap-btn--danger ap-cp-lg" style={{ flex: 1 }} onClick={confirmDecline} disabled={busy}>{busy ? 'Declining…' : 'Decline bid'}</button>
          </>
        )}
      >
        <p className="ap-cp-p">{who} will be told their bid wasn&rsquo;t picked. Nothing leaves your wallet.</p>
      </BottomSheet>

      <BottomSheet
        open={ask?.kind === 'finish'}
        onClose={close}
        title="Finish hiring now?"
        subtitle={'You can’t reopen these slots later.'}
        footer={(
          <>
            <button type="button" className="ap-btn ap-cp-soft ap-cp-lg" style={{ flex: 1 }} onClick={close} disabled={busy}>Cancel</button>
            <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={confirmFinish} disabled={busy}>{busy ? 'Closing…' : 'Finish & refund'}</button>
          </>
        )}
      >
        <div className="ap-cp-kvs">
          <Row label="Creators hired" value={`${hiredN} of ${wanted}`} />
          <Row label="Unfilled slots" value={Math.max(0, wanted - hiredN)} />
        </div>
        <div className="ap-cp-note"><Info size={18} /><span>The budget reserved for the unfilled slots is refunded to your wallet. Open bids will be closed.</span></div>
      </BottomSheet>

      <HireSuccessSheet done={done} onClose={() => setDone(null)} />
    </>
  );

  return {
    node,
    hire: (campaign, bid) => setAsk({ kind: 'hire', campaign, bid }),
    decline: (campaign, bid) => setAsk({ kind: 'decline', campaign, bid }),
    finish: (campaign) => setAsk({ kind: 'finish', campaign }),
  };
}

// "Priya is on it" - what happens next (design board M9 "Hire success"). Only facts the response / campaign carry.
function HireSuccessSheet({ done, onClose }) {
  const navigate = useNavigate();
  if (!done) return <BottomSheet open={false} />;
  const { who, data, campaign, bid } = done;
  const unfunded = hireUnfunded(data);
  const ships = Boolean(campaign?.requires_shipment || campaign?.shipment_option === 'yes');
  const shipBy = fmtDay(campaign?.product_shipping_by || campaign?.ship_by);
  const days = Number(bid?.estimated_delivery_days || 0);
  const held = Number(data?.amount_charged) || Number(data?.amount) || 0;
  const left = Number(data?.slots_left ?? 0);
  const steps = ['Hired', ...(ships ? ['Ship'] : []), 'Film', 'Review', 'Done'];
  return (
    <BottomSheet
      open
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="ap-btn ap-btn--ghost ap-cp-lg" style={{ flex: 1 }} onClick={() => { onClose(); navigate(ROUTES.chat(bid.creator_id)); }}>Message {who}</button>
          {unfunded
            ? <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={() => { onClose(); navigate(WALLET_RECHARGE_PATH); }}>Add funds</button>
            : <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={() => { onClose(); if (ships) navigate(ROUTES.shipments); else navigate(ROUTES.campaign(campaign.id)); }}>{ships ? 'Ship the product' : 'Open campaign'}</button>}
        </>
      )}
    >
      <div className="ap-cp-win">
        <span className="ap-cp-win-ic"><Check size={30} strokeWidth={3} /></span>
        <h2>{who} is on it</h2>
        <p>
          {unfunded
            ? `${who} is hired, but your wallet is short. Add funds to fund the escrow so work can start.`
            : `${held ? `${inr(held)} is held safely.` : 'Payment is held safely in escrow.'} You only pay ${who} when you approve the video.`}
          {left > 0 ? ` ${left} slot${left === 1 ? '' : 's'} still open.` : ''}
        </p>
      </div>
      <div className="ap-card ap-cp-next">
        <b>What happens next</b>
        <div className="ap-cp-stage-bar ap-cp-stage-bar--n" style={{ gridTemplateColumns: `repeat(${steps.length},1fr)` }}>
          {steps.map((s, i) => <span key={s} className={`ap-cp-seg${i === 0 ? ' is-done' : ''}`} />)}
        </div>
        <div className="ap-cp-stage-lab" style={{ gridTemplateColumns: `repeat(${steps.length},1fr)` }}>
          {steps.map((s, i) => <span key={s} className={i === 0 ? 'is-now' : ''}>{s}</span>)}
        </div>
        <ul className="ap-cp-bul">
          {ships && <li><Truck size={14} /><span>{shipBy ? <>Ship the product by <strong>{shipBy}</strong></> : 'Ship the product to the creator'}</span></li>}
          <li><CheckCircle2 size={14} /><span>{days ? `${who} films within ${days} day${days === 1 ? '' : 's'}${ships ? ' of getting it' : ''}` : `${who} films once everything is ready`}</span></li>
          <li><MessageCircle size={14} /><span>You review, ask for changes or approve</span></li>
        </ul>
      </div>
    </BottomSheet>
  );
}

export const noop = () => {};
