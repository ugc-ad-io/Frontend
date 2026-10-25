import { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate, matchPath } from 'react-router-dom';
import axios from 'axios';
import { Printer, WifiOff, RefreshCw, ReceiptText } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { brandName } from '../../../utils/displayName';
import './wallet.css';
import './invoice.css';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;
const money2 = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const NA = <span className="ap-wl-na">Not available</span>;

// Invoice for one wallet payment (same data as the website's BrandInvoice). The backend has no invoice endpoint, so this renders
// from the wallet transaction (GET /business/wallet) and the brand's own company settings. The invoice number, UGCad GSTIN and
// the CGST/SGST split are not available, so they are labelled, never invented. Screens render outside <Route>: read :id from the path.
export default function BrandInvoice() {
  const { pathname } = useLocation();
  const id = matchPath('/dashboard/business/invoice/:id', pathname)?.params?.id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, tx: null, company: {}, profile: {}, error: '' });
  const loaded = useRef(false);

  const load = useCallback(async () => {
    const [w, c, p] = await Promise.allSettled([
      axios.get(`${API}/business/wallet`),
      axios.get(`${API}/business/settings/company`),
      axios.get(`${API}/business/settings/profile`),
    ]);
    if (w.status !== 'fulfilled') {
      const offline = !w.reason?.response;
      setState((s) => ({ ...s, loading: false, error: offline ? "You're offline. Check your connection and try again." : 'Could not load this payment.' }));
      return;
    }
    loaded.current = true;
    const tx = (w.value.data?.transactions || []).find((t) => String(t.id) === String(id)) || null;
    setState({ loading: false, tx, company: c.value?.data || {}, profile: p.value?.data || {}, error: '' });
  }, [id]);

  // An invoice is a snapshot, but live refresh keeps the status current after a pending payment settles.
  useLiveEffect(() => { load(); }, [load]);

  const { loading, tx, company, profile, error } = state;
  const credit = tx?.direction === 'credit';
  const address = [company.billing_address, company.city, company.state, company.pincode].filter(Boolean).join(', ');

  return (
    <AppShell back="/dashboard/business/wallet" title="Invoice" tabs={false}>
      {loading ? (
        <div className="ap-wl-inv" aria-hidden="true">
          <div className="ap-skel" style={{ height: 150, borderRadius: 20 }} />
          <div className="ap-skel" style={{ height: 96, borderRadius: 20 }} />
          <div className="ap-skel" style={{ height: 150, borderRadius: 20 }} />
        </div>
      ) : error && !tx ? (
        <div className="ap-card ap-empty" role="alert">
          {error.startsWith("You're offline") ? <WifiOff size={34} /> : <ReceiptText size={34} />}
          <h3>Could not load the invoice</h3>
          <p>{error}</p>
          <button type="button" className="ap-btn" onClick={() => { setState((s) => ({ ...s, loading: true })); load(); }}><RefreshCw size={16} /> Retry</button>
        </div>
      ) : !tx ? (
        <div className="ap-card ap-empty">
          <ReceiptText size={34} />
          <h3>Invoice not found</h3>
          <p>We could not find this payment in your wallet history.</p>
          <button type="button" className="ap-btn" onClick={() => navigate('/dashboard/business/wallet')}>Back to wallet</button>
        </div>
      ) : (
        <div className="ap-wl-inv ap-iv">
          <div className="ap-card ap-wl-inv-top">
            <div className="ap-wl-inv-logo"><span>UGC</span>ad.io</div>
            <small>{credit ? 'Total credited' : 'Total paid'}</small>
            <div className="ap-wl-inv-total">{money2(tx.amount)}</div>
            <small>{fmtDate(tx.date) || '-'} · {cap(String(tx.status || 'success').toLowerCase())}</small>
            <div className="ap-wl-inv-meta">
              <span>Invoice no. {NA}</span>
              <span>UGCad GSTIN {NA}</span>
              <span>Txn <code>{tx.id}</code></span>
            </div>
          </div>
          <div className="ap-card">
            <div className="ap-wl-k">{credit ? 'CREDITED TO' : 'BILLED TO'}</div>
            <b>{profile.brand_name || brandName(user)}</b>
            <small className="ap-wl-ds">GSTIN: {company.gst_number || <span className="ap-wl-na">Not added in Settings</span>}</small>
            <small className="ap-wl-ds">{address || <span className="ap-wl-na">Billing address not added</span>}</small>
          </div>
          <div className="ap-card">
            <div className="ap-wl-k">FOR</div>
            <b>{tx.type || 'Payment'}</b>
            {tx.reference ? <small className="ap-wl-ds">{tx.reference}</small> : null}
            <div className="ap-wl-lines">
              <div><span>{tx.type || 'Payment'}</span><b>{money2(tx.amount)}</b></div>
              <div><span>SAC</span>{NA}</div>
              <div><span>CGST / SGST on platform fee</span>{NA}</div>
              <div className="ap-wl-tot"><span>{credit ? 'Total credited' : 'Total paid'}</span><b>{money2(tx.amount)}</b></div>
            </div>
            <p className="ap-wl-note">{credit ? 'Added to' : 'Paid from'} your UGCad wallet{fmtDate(tx.date) ? ` on ${fmtDate(tx.date)}` : ''}. The tax split and invoice number are not available from the wallet yet, so they are left blank rather than estimated.</p>
          </div>
          <button type="button" className="ap-btn ap-btn--block ap-iv-print" onClick={() => window.print()}><Printer size={17} /> Print / save as PDF</button>
        </div>
      )}
    </AppShell>
  );
}
