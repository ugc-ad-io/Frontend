import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Download, BarChart3, IndianRupee, FileSpreadsheet, ScrollText, CalendarRange, CheckCircle, XCircle, X } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { useAuth } from '../App';
import { can } from '../utils/adminRoles';
import useIsPhone from '../lib/useIsPhone';
import '../styles/admin-mobile-finance.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const PERIODS = [
  { value: 'daily', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

// Every export the backend actually serves, with the capability that gates it.
// `usesPeriod` items get the selected period appended.
const GROUPS = [
  {
    title: 'Platform activity',
    icon: BarChart3,
    hint: 'Headline numbers - signups, applications, campaigns, deals and escrow held.',
    items: [
      { kind: 'digest', label: 'Platform digest', url: '/admin/reports/digest', cap: 'generate_reports', usesPeriod: true },
    ],
  },
  {
    title: 'Financial',
    icon: IndianRupee,
    hint: 'Money movement - payouts, profit & loss, and the wallet/escrow reconciliation.',
    items: [
      { kind: 'withdrawals', label: 'Withdrawals', url: '/admin/withdrawals/export', cap: 'view_financials' },
      { kind: 'pnl', label: 'Profit & loss', url: '/admin/financials/pnl/export', cap: 'view_financials', usesPeriod: true },
      { kind: 'reconciliation', label: 'Reconciliation', url: '/admin/financials/reconciliation/export', cap: 'view_financials' },
    ],
  },
  {
    title: 'Tax',
    icon: FileSpreadsheet,
    hint: 'Statutory exports for filing.',
    items: [
      { kind: 'tds_form16a', label: 'TDS (Form 16A)', url: '/admin/financials/tds/export', cap: 'export_tax' },
      { kind: 'gst_invoices', label: 'GST invoices', url: '/admin/financials/gst/export', cap: 'export_tax' },
    ],
  },
];

export default function AdminReports() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('month');
  const [busy, setBusy] = useState('');
  const isPhone = useIsPhone();
  const [periodSheet, setPeriodSheet] = useState(false); // phone: period sheet open
  const [periodDraft, setPeriodDraft] = useState('month'); // phone: period picked in the sheet, applied on Apply
  const [results, setResults] = useState({}); // phone: last export outcome per kind ('ok' | 'fail')

  const exportCsv = async (item) => {
    setBusy(item.kind);
    try {
      const params = item.usesPeriod ? { period } : {};
      const res = await axios.get(`${API}${item.url}`, { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const stamp = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${item.kind}_${stamp}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${item.label} exported`);
      return true;
    } catch (error) {
      toast.error(apiErrorMessage(error, `${item.label} export failed`));
      return false;
    } finally {
      setBusy('');
    }
  };

  // Only show exports this admin actually holds the capability for.
  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => can(user, i.cap)) }))
    .filter((g) => g.items.length > 0);

  if (isPhone) {
    const periodLabel = PERIODS.find((p) => p.value === period)?.label;
    const runExport = async (item) => {
      const ok = await exportCsv(item);
      setResults((r) => ({ ...r, [item.kind]: ok ? 'ok' : 'fail' }));
    };
    return (
      <AdminLayout>
        <div className="am">
          <div className="am-toolbar">
            <p className="am-muted amf-flat amf-grow">Period for dated exports: <strong>{periodLabel}</strong></p>
            <button type="button" className="am-filter-btn" onClick={() => { setPeriodDraft(period); setPeriodSheet(true); }} aria-label={`Report period, ${periodLabel}`} data-testid="rep-period-btn">
              <CalendarRange size={20} />
              {period !== 'month' && <span className="am-dot">1</span>}
            </button>
          </div>

          {groups.length === 0 ? (
            <div className="am-empty">You don’t have access to any exports.</div>
          ) : groups.map((g) => (
            <section className="am-section" key={g.title}>
              <h3 className="amf-icon-title"><g.icon size={16} /> {g.title}</h3>
              <p className="am-muted">{g.hint}</p>
              {g.items.map((item) => (
                <div key={item.kind} className="amf-export">
                  <button type="button" className="am-btn am-btn--secondary" onClick={() => runExport(item)} disabled={busy === item.kind} data-testid={`rep-export-${item.kind}`}>
                    <Download size={18} />
                    {busy === item.kind ? 'Exporting…' : item.label}
                    {item.usesPeriod && <em>· {periodLabel}</em>}
                  </button>
                  {busy !== item.kind && results[item.kind] === 'ok' && <span className="amf-hint amf-ok"><CheckCircle size={14} /> Downloaded</span>}
                  {busy !== item.kind && results[item.kind] === 'fail' && <span className="amf-hint amf-bad"><XCircle size={14} /> Export failed - tap to retry</span>}
                </div>
              ))}
            </section>
          ))}

          <p className="am-muted amf-flat">For a record of what admins did, see the Audit Log.</p>

          {periodSheet && (
            <>
              <div className="am-sheet-backdrop" onClick={() => setPeriodSheet(false)} />
              <section className="am-sheet" role="dialog" aria-modal="true" aria-label="Report period" data-testid="rep-period-sheet">
                <header className="am-sheet-head">
                  <h2>Report period</h2>
                  <button type="button" className="am-icon-btn" onClick={() => setPeriodSheet(false)} aria-label="Close"><X size={20} /></button>
                </header>
                <div className="am-sheet-body">
                  <div className="am-field">
                    <label htmlFor="amf-rep-period">Period</label>
                    <select id="amf-rep-period" value={periodDraft} onChange={(e) => setPeriodDraft(e.target.value)}>
                      {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <span className="am-field-hint">Applies to the platform digest and profit &amp; loss exports.</span>
                  </div>
                </div>
                <footer className="am-sheet-foot">
                  <button type="button" className="am-btn am-btn--secondary" onClick={() => setPeriodDraft('month')}>Reset</button>
                  <button type="button" className="am-btn am-btn--primary" onClick={() => { setPeriod(periodDraft); setPeriodSheet(false); }}>Apply</button>
                </footer>
              </section>
            </>
          )}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="rep-head-bar">
        <div>
          <h2>Reports</h2>
          <p>Download platform and financial data. For a record of what admins did, see the <ScrollText size={13} /> Audit Log.</p>
        </div>
        <label className="rep-period">
          <span>Period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
      </div>

      {groups.length === 0 ? (
        <section className="rep-panel">
          <div className="rep-empty">You don’t have access to any exports.</div>
        </section>
      ) : groups.map((g) => (
        <section className="rep-panel" key={g.title}>
          <h3><g.icon size={16} /> {g.title}</h3>
          <p className="rep-hint">{g.hint}</p>
          <div className="rep-exports">
            {g.items.map((item) => (
              <button key={item.kind} onClick={() => exportCsv(item)} disabled={busy === item.kind}>
                <Download size={15} />
                {busy === item.kind ? 'Exporting…' : item.label}
                {item.usesPeriod && <em>· {PERIODS.find((p) => p.value === period)?.label}</em>}
              </button>
            ))}
          </div>
        </section>
      ))}

      <style>{`
        .rep-head-bar { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
        .rep-head-bar h2 { margin:0 0 4px; font-size:20px; color:#07074e; }
        .rep-head-bar p { margin:0; font-size:13px; color:#8a8a93; display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
        .rep-period { display:flex; align-items:center; gap:8px; font-size:13px; color:#6b6b80; }
        .rep-period select { padding:8px 10px; border:1px solid #e2e4f0; border-radius:8px; font-size:13px; }
        .rep-period select:focus { outline:none; border-color:#5b6bff; box-shadow:0 0 0 3px rgba(91,107,255,0.16); }
        .rep-panel { background:#fff; border:1px solid #ececf1; border-radius:14px; padding:18px; margin-bottom:18px; }
        .rep-panel h3 { margin:0 0 4px; font-size:15px; color:#07074e; display:flex; align-items:center; gap:8px; }
        .rep-hint { margin:0 0 14px; font-size:12.5px; color:#9a9ab0; }
        .rep-exports { display:flex; gap:10px; flex-wrap:wrap; }
        .rep-exports button { display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border:1px solid transparent; border-radius:9px; background:linear-gradient(100deg,#12124f,#07074e); color:#fff; font-weight:600; cursor:pointer; font-size:13px; box-shadow:0 12px 26px -12px rgba(7,7,78,.7); }
        .rep-exports button:hover:not(:disabled) { transform:translateY(-1px); }
        .rep-exports button:disabled { opacity:.6; cursor:default; }
        .rep-exports button em { font-style:normal; opacity:.7; font-weight:500; }
        .rep-empty { padding:24px; text-align:center; color:#9a9ab0; }
      `}</style>
    </AdminLayout>
  );
}
