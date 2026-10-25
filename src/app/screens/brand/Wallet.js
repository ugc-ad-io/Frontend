import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Gift, Download, Lock, CheckCircle2, Printer, WifiOff, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { apiErrorMessage } from '../../../utils/apiError';
import { payWithRazorpay, isPaymentCancelled } from '../../../utils/razorpay';
import { downloadWalletStatement } from '../../../utils/walletStatement';
import { brandName } from '../../../utils/displayName';
import './wallet.css';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;
const PRESETS = [10000, 25000, 50000];

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const money2 = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
};
const sum = (list) => list.reduce((s, t) => s + Number(t.amount || 0), 0);
const lc = (v) => String(v || '').toLowerCase();

export function normalizeWallet(data = {}) {
  return {
    available_balance: Number(data.available_balance || 0),
    minimum_chat_balance: Number(data.minimum_chat_balance || 2500),
    chat_unlocked: Boolean(data.chat_unlocked),
    bonus_tiers: Array.isArray(data.bonus_tiers) ? data.bonus_tiers : [],
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
  };
}

const pillFor = (status) => {
  const s = lc(status || 'success');
  if (['success', 'released', 'completed', 'paid'].includes(s)) return 'ap-pill--ok';
  if (['held', 'pending', 'processing'].includes(s)) return 'ap-pill--warn';
  if (['failed', 'rejected', 'cancelled'].includes(s)) return 'ap-pill--bad';
  return 'ap-pill--muted';
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

export default function BrandWallet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [data, setData] = useState(normalizeWallet());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadedRef = useRef(false);
  const [filter, setFilter] = useState('all');
  const [shown, setShown] = useState(8);
  const [detail, setDetail] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [addOpen, setAddOpen] = useState(() => params.get('view') === 'recharge');
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const payingRef = useRef(false);
  const historyRef = useRef(null);

  const load = async () => {
    if (!loadedRef.current) setLoading(true);
    try {
      const res = await axios.get(`${API}/business/wallet`);
      setData(normalizeWallet(res.data || {}));
      loadedRef.current = true;
      setError('');
    } catch (e) {
      setError(e?.response ? apiErrorMessage(e, 'Could not load your wallet.') : "You're offline. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };
  useLiveEffect(() => { load(); }, []);

  const tx = data.transactions;
  const now = new Date();
  const thisMonth = (t) => { const d = new Date(t.date); return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); };
  const held = sum(tx.filter((t) => t.direction === 'debit' && lc(t.status) === 'held'));
  const spent = sum(tx.filter((t) => t.direction === 'debit' && thisMonth(t) && ['released', 'success'].includes(lc(t.status))));
  const added = sum(tx.filter((t) => t.direction === 'credit' && thisMonth(t) && ['released', 'success'].includes(lc(t.status || 'success'))));
  const bonus = sum(tx.filter((t) => t.direction === 'credit' && /bonus/i.test(String(t.type))));
  const lastRecharge = tx.find((t) => t.direction === 'credit' && /recharge/i.test(String(t.type)) && !/bonus/i.test(String(t.type)));
  const counts = { all: tx.length, credits: tx.filter((t) => t.direction === 'credit').length, debits: tx.filter((t) => t.direction === 'debit').length };
  const list = tx.filter((t) => (filter === 'credits' ? t.direction === 'credit' : filter === 'debits' ? t.direction === 'debit' : true));

  const min = data.minimum_chat_balance || 2500;
  const typed = Number(amount || 0);
  const bonusPct = data.bonus_tiers.reduce((best, tier) => (typed >= Number(tier.amount) ? Math.max(best, Number(tier.bonus_percent || 0)) : best), 0);
  const youGet = typed + Math.round((typed * bonusPct) / 100);
  const tiers = (data.bonus_tiers.length ? data.bonus_tiers : PRESETS.map((a) => ({ amount: a, bonus_percent: 0 }))).slice(0, 3);

  const recharge = async () => {
    const amt = Number(amount);
    if (payingRef.current) return;
    if (!amt || amt < min) { toast.error(`Minimum recharge amount is ${money(min)}`); return; }
    payingRef.current = true;
    setPaying(true);
    try {
      const { data: order } = await axios.post(`${API}/business/wallet/recharge`, { amount: amt, gateway: 'razorpay' });
      const result = await payWithRazorpay(order, {
        name: user?.nickname || user?.full_name,
        email: user?.email,
        contact: user?.phone,
        description: `Wallet recharge - ${money(order.amount)}`,
      });
      toast.success(result?.message || 'Payment successful - wallet credited.');
      setAmount('');
      setAddOpen(false);
      await load();
    } catch (e) {
      if (isPaymentCancelled(e)) toast.message('Payment cancelled.');
      else toast.error(apiErrorMessage(e, 'Wallet recharge failed'));
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  const goHistory = () => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const openCampaign = (t) => /^[0-9a-f-]{8,}$/i.test(String(t.reference || ''));

  return (
    <AppShell tone="dark" bare back title="Wallet" className="ap-wl-shell">
      <section className="ap-hero ap-wl-hero">
        <div className="ap-wl-lbl">Available balance</div>
        {loading ? <div className="ap-skel ap-wl-bal-sk" /> : <div className="ap-wl-bal">{money(data.available_balance)}</div>}
        {!loading && !error && (
          <div className="ap-wl-chat">
            {data.chat_unlocked ? <><CheckCircle2 size={14} /> Platform chat unlocked</> : <><Lock size={14} /> {money(min)} minimum to unlock platform chat</>}
          </div>
        )}
        <button type="button" className="ap-wl-add" onClick={() => setAddOpen(true)}><Plus size={18} /> Add funds</button>
      </section>

      <div className="ap-wl-pad">
        {error && (
          <div className="ap-card ap-wl-err" role="alert">
            {error.startsWith("You're offline") ? <WifiOff size={22} /> : null}
            <p>{loadedRef.current ? `${error} Showing the last balance we loaded.` : `${error} Your balance is safe.`}</p>
            <button type="button" className="ap-btn ap-btn--sm" onClick={() => { setLoading(true); load(); }}><RefreshCw size={15} /> Retry</button>
          </div>
        )}

        <div className="ap-card ap-wl-grid">
          <button type="button" className="ap-wl-tile" onClick={() => setAddOpen(true)}>
            <span className="ap-wl-ic"><Plus size={24} /></span><b>Add<br />funds</b>
          </button>
          <button type="button" className="ap-wl-tile" onClick={goHistory}>
            <span className="ap-wl-ic"><Lock size={22} /></span><b>In escrow<br />{money(held)}</b>
          </button>
          <button type="button" className="ap-wl-tile" onClick={goHistory}>
            <span className="ap-wl-ic ap-wl-ic--rose"><Gift size={22} /></span><b>Bonus<br />{money(bonus)}</b>
          </button>
          {!window.ReactNativeWebView && (
            <button type="button" className="ap-wl-tile" disabled={!tx.length} onClick={() => downloadWalletStatement(list.length ? list : tx)}>
              <span className="ap-wl-ic"><Download size={22} /></span><b>Statement<br />(CSV)</b>
            </button>
          )}
        </div>

        <div className="ap-sec-h"><h2>This month</h2></div>
        <div className="ap-card ap-wl-month">
          <div><small>↓ Added</small><b className="ap-wl-in">{money(added)}</b></div>
          <div><small>↑ Spent</small><b>{money(spent)}</b></div>
        </div>
        <p className="ap-wl-last">{lastRecharge ? `Last added ${money(lastRecharge.amount)} on ${fmtDate(lastRecharge.date)}` : 'No recharges yet'}</p>

        <div className="ap-sec-h" ref={historyRef} id="wallet-history"><h2>Transactions</h2></div>
        <div className="ap-chips" role="tablist" aria-label="Filter transactions">
          {['all', 'credits', 'debits'].map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} className={`ap-chip${filter === f ? ' is-on' : ''}`} onClick={() => { setFilter(f); setShown(8); }}>
              {cap(f)} <span className="ap-wl-cnt">{counts[f]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="ap-card" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="ap-skel ap-wl-row-sk" />)}
          </div>
        ) : error && !tx.length ? null : list.length === 0 ? (
          <div className="ap-card ap-empty">
            <h3>{tx.length ? 'Nothing in this view' : 'No transactions yet'}</h3>
            <p>{tx.length ? 'Try another filter.' : 'Add funds to hire creators in a tap. Every top-up and payment shows up here.'}</p>
            {!tx.length && <button type="button" className="ap-btn" onClick={() => setAddOpen(true)}>Add funds</button>}
          </div>
        ) : (
          <div className="ap-card ap-wl-list">
            {list.slice(0, shown).map((t) => (
              <button key={t.id} type="button" className="ap-row ap-wl-trow" onClick={() => setDetail(t)}>
                <span className="ap-wl-ic ap-wl-ic--sm">{t.direction === 'debit' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</span>
                <span className="ap-row-t">
                  <b>{t.type}{t.reference ? ` · ${t.reference}` : ''}</b>
                  <small>{fmtDate(t.date)} <span className={`ap-pill ${pillFor(t.status)}`}>{cap(lc(t.status || 'success'))}</span></small>
                </span>
                <span className={`ap-wl-amt ${t.direction === 'debit' ? '' : 'ap-wl-in'}`}>{t.direction === 'debit' ? '−' : '+'}{money(t.amount)}</span>
              </button>
            ))}
            {list.length > shown && (
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--block ap-wl-more" onClick={() => setShown((n) => n + 20)}>
                Show more ({list.length - shown} older)
              </button>
            )}
          </div>
        )}
      </div>

      <BottomSheet
        open={addOpen}
        onClose={() => !paying && setAddOpen(false)}
        title="Add funds"
        subtitle="Secured by Razorpay · instant credit after payment"
        footer={(
          <button type="button" className="ap-btn ap-btn--block" onClick={recharge} disabled={paying}>
            {paying ? 'Creating order…' : typed > 0 ? `Pay ${money(typed)}` : 'Add funds'}
          </button>
        )}
      >
        <div className="ap-wl-tiers">
          {tiers.map((tier) => (
            <button key={tier.amount} type="button" className={`ap-wl-tier${Number(amount) === Number(tier.amount) ? ' is-on' : ''}`} onClick={() => setAmount(String(tier.amount))}>
              <b>{tier.label || money(tier.amount)}</b>
              <small>{tier.bonus_percent ? `+${tier.bonus_percent}% bonus` : ' '}</small>
            </button>
          ))}
        </div>
        <label className="ap-label ap-wl-field" htmlFor="ap-wl-amount">
          Amount
          <span className="ap-wl-amt-in"><span>₹</span>
            <input id="ap-wl-amount" type="number" inputMode="numeric" min={min} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" />
          </span>
        </label>
        {typed > 0 && <div className="ap-wl-youget"><span>You’ll get in your wallet</span><b>{money(youGet)}</b></div>}
        <p className="ap-wl-note">Minimum {money(min)}. Bigger top-ups earn a bonus.</p>
      </BottomSheet>

      <BottomSheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.type || 'Transaction'}
        footer={detail ? (
          <>
            <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={() => { setInvoice(detail); setDetail(null); }}>View invoice</button>
            {openCampaign(detail) && (
              <button type="button" className="ap-btn" style={{ flex: 1 }} onClick={() => { const r = detail.reference; setDetail(null); navigate(`/dashboard/business/campaign/${r}`); }}>View campaign</button>
            )}
          </>
        ) : null}
      >
        {detail && (
          <>
            <div className="ap-wl-dtop">
              <span className={`ap-wl-dam ${detail.direction === 'debit' ? '' : 'ap-wl-in'}`}>{detail.direction === 'debit' ? '−' : '+'}{money(detail.amount)}</span>
              <span className={`ap-pill ${pillFor(detail.status)}`}>{cap(lc(detail.status || 'success'))}</span>
            </div>
            <dl className="ap-wl-dl">
              <div><dt>Direction</dt><dd>{detail.direction === 'debit' ? 'Debit (out)' : 'Credit (in)'}</dd></div>
              <div><dt>Date</dt><dd>{fmtDate(detail.date)}</dd></div>
              {detail.reference ? <div><dt>Campaign / ref</dt><dd>{detail.reference}</dd></div> : null}
              <div><dt>Transaction ID</dt><dd className="ap-wl-mono">{detail.id}</dd></div>
            </dl>
            {detail.direction === 'credit' && /recharge/i.test(String(detail.type)) && (
              <p className="ap-wl-note">A payment receipt for this recharge was emailed to your account email when the payment succeeded.</p>
            )}
          </>
        )}
      </BottomSheet>

      <InvoiceSheet tx={invoice} user={user} onClose={() => setInvoice(null)} />
    </AppShell>
  );
}

// Invoice for one wallet payment (same data as the website's BrandInvoice): the wallet transaction plus the brand's
// own company settings. The backend has no invoice number / UGCad GSTIN / tax split, so those are labelled, never invented.
function InvoiceSheet({ tx, user, onClose }) {
  const [info, setInfo] = useState({ company: {}, profile: {}, loading: false });
  const txId = tx?.id;
  useEffect(() => {
    if (!txId) return undefined;
    let live = true;
    setInfo({ company: {}, profile: {}, loading: true });
    Promise.allSettled([axios.get(`${API}/business/settings/company`), axios.get(`${API}/business/settings/profile`)])
      .then(([c, p]) => { if (live) setInfo({ company: c.value?.data || {}, profile: p.value?.data || {}, loading: false }); });
    return () => { live = false; };
  }, [txId]);
  const { company, profile } = info;
  const credit = tx?.direction === 'credit';
  const address = [company.billing_address, company.city, company.state, company.pincode].filter(Boolean).join(', ');
  const NA = <span className="ap-wl-na">Not available</span>;
  return (
    <BottomSheet
      open={!!tx}
      onClose={onClose}
      tall
      title="Invoice"
      footer={<button type="button" className="ap-btn ap-btn--block" onClick={() => window.print()}><Printer size={17} /> Print / save as PDF</button>}
    >
      {tx && (
        <div className="ap-wl-inv">
          <div className="ap-card ap-wl-inv-top">
            <div className="ap-wl-inv-logo"><span>UGC</span>ad.io</div>
            <small>{credit ? 'Total credited' : 'Total paid'}</small>
            <div className="ap-wl-inv-total">{money2(tx.amount)}</div>
            <small>{fmtDate(tx.date)} · {cap(lc(tx.status || 'success'))}</small>
            <div className="ap-wl-inv-meta"><span>Invoice no. {NA}</span><span>Txn <code>{tx.id}</code></span></div>
          </div>
          <div className="ap-card">
            <div className="ap-wl-k">{credit ? 'CREDITED TO' : 'BILLED TO'}</div>
            <b>{profile.brand_name || brandName(user)}</b>
            <small className="ap-wl-ds">GSTIN: {company.gst_number || <span className="ap-wl-na">Not added in Settings</span>}</small>
            <small className="ap-wl-ds">{address || <span className="ap-wl-na">Billing address not added</span>}</small>
            {info.loading ? <div className="ap-skel" style={{ height: 12, marginTop: 8, width: '60%' }} /> : null}
          </div>
          <div className="ap-card">
            <div className="ap-wl-k">FOR</div>
            <b>{tx.type || 'Payment'}</b>
            {tx.reference ? <small className="ap-wl-ds">{tx.reference}</small> : null}
            <div className="ap-wl-lines">
              <div><span>{tx.type || 'Payment'}</span><b>{money2(tx.amount)}</b></div>
              <div><span>CGST / SGST on platform fee</span>{NA}</div>
              <div className="ap-wl-tot"><span>{credit ? 'Total credited' : 'Total paid'}</span><b>{money2(tx.amount)}</b></div>
            </div>
            <p className="ap-wl-note">{credit ? 'Added to' : 'Paid from'} your UGCad wallet on {fmtDate(tx.date)}. The tax split and invoice number are not available from the wallet yet, so they are left blank rather than estimated.</p>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
