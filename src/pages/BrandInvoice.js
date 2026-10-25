import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Printer } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../App';
import { brandName } from '../utils/displayName';
import '../styles/brand-ui.css';
import '../styles/brand-ui-home.css';
import '../styles/brand-ui-invoice.css';
import '../styles/brand-ui-mobile-b.css';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const NA = <span className="bui-iv-na">Not available</span>;

// Invoice for one wallet payment (design board 27). The backend has no brand invoice endpoint, so this
// renders from the wallet transaction (GET /api/business/wallet) and the brand's own company settings.
// Anything we cannot know (invoice number, UGCad GSTIN, the CGST/SGST split) is labelled, never invented.
export default function BrandInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, tx: null, company: {}, profile: {}, error: '' });

  // Plain effect (not live-refreshing): an invoice is a snapshot.
  useEffect(() => {
    let live = true;
    Promise.allSettled([
      axios.get(`${API}/business/wallet`),
      axios.get(`${API}/business/settings/company`),
      axios.get(`${API}/business/settings/profile`),
    ]).then(([w, c, p]) => {
      if (!live) return;
      if (w.status !== 'fulfilled') { setState((s) => ({ ...s, loading: false, error: 'Could not load this payment.' })); return; }
      const tx = (w.value.data?.transactions || []).find((t) => String(t.id) === String(id)) || null;
      setState({ loading: false, tx, company: c.value?.data || {}, profile: p.value?.data || {}, error: '' });
    });
    return () => { live = false; };
  }, [id]);

  const { loading, tx, company, profile, error } = state;
  const credit = tx?.direction === 'credit';
  const billedName = profile.brand_name || brandName(user);
  const address = [company.billing_address, company.city, company.state, company.pincode].filter(Boolean).join(', ');

  return (
    <BrandTopNavLayout>
      <div className="bui-main bui-main--tight">
        <nav className="bui-crumb" aria-label="Breadcrumb"><Link to="/dashboard/business/wallet">Wallet</Link><span>/</span><strong>Invoice</strong></nav>

        {loading ? (
          <p className="bui-sub">Loading invoice…</p>
        ) : !tx ? (
          <EmptyState title={error || 'Invoice not found'} message="We could not find this payment in your wallet history." action={{ label: 'Back to wallet', onClick: () => navigate('/dashboard/business/wallet') }} />
        ) : (
          <>
            <div className="bui-titlerow">
              <div>
                <h1 className="bui-h1">Invoice</h1>
                <p className="bui-sub">One record for every payment. Tax details appear here once UGCad issues the GST invoice.</p>
              </div>
              <button type="button" className="bui-btn" onClick={() => window.print()}><Printer size={16} />Print / save as PDF</button>
            </div>

            <article className="bui-iv">
              <div className="bui-iv-top">
                <div>
                  <div className="bui-iv-logo">UGC<b>ad</b>.io</div>
                  <div className="bui-iv-seller">UGCad.io<br />GSTIN: {NA}</div>
                </div>
                <div className="bui-iv-meta">
                  <div className="bui-iv-title">INVOICE</div>
                  <div><span>Invoice no.</span> {NA}</div>
                  <div><span>Transaction ID</span> <code>{tx.id}</code></div>
                  <div><span>Date</span> {fmtDate(tx.date) || '—'}</div>
                  <div><span>Place of supply</span> {NA}</div>
                </div>
              </div>

              <div className="bui-iv-parties">
                <div>
                  <h3>{credit ? 'Credited to' : 'Billed to'}</h3>
                  <strong>{billedName}</strong><br />
                  GSTIN: {company.gst_number || <span className="bui-iv-na">Not added in Settings</span>}<br />
                  {address || <span className="bui-iv-na">Billing address not added</span>}
                </div>
                <div>
                  <h3>For</h3>
                  <strong>{tx.type || 'Payment'}</strong><br />
                  {tx.reference || '—'}<br />
                  Status: {tx.status || '—'}
                </div>
              </div>

              <table className="bui-iv-table">
                <thead><tr><th>Description</th><th>SAC</th><th className="bui-right">Amount</th></tr></thead>
                <tbody>
                  <tr><td>{tx.type || 'Payment'}{tx.reference ? <span className="bui-iv-na"> ({tx.reference})</span> : null}</td><td>{NA}</td><td className="bui-right">{inr(tx.amount)}</td></tr>
                  <tr className="bui-iv-sub"><td>CGST / SGST on the platform fee</td><td /><td className="bui-right">{NA}</td></tr>
                  <tr className="bui-iv-total"><td>{credit ? 'Total credited' : 'Total paid'}</td><td /><td className="bui-right">{inr(tx.amount)}</td></tr>
                </tbody>
              </table>
              <div className="bui-iv-foot">
                {credit ? 'Added to' : 'Paid from'} your UGCad wallet{fmtDate(tx.date) ? ` on ${fmtDate(tx.date)}` : ''}. The tax split and invoice number are not available from the wallet yet, so they are left blank here rather than estimated.
              </div>
            </article>
          </>
        )}
      </div>
    </BrandTopNavLayout>
  );
}
