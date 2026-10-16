import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import {
  ScrollText, Download, Search, ShieldAlert, Lock, ChevronRight,
  ChevronDown, Mail, RefreshCw, SlidersHorizontal, X, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../App';
import AdminLayout from '../components/AdminLayout';
import useIsPhone from '../lib/useIsPhone';
import '../styles/admin-mobile-oversight.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// PRD 11.15 — sensitive actions trigger a founder email digest and are flagged.
const SENSITIVE_ACTIONS = [
  'wallet.adjust', 'dispute.ruling', 'user.banned', 'user.suspended',
  'settings.update', 'withdrawal.approved', 'withdrawal.rejected', 'deal.force_transition',
];

const ACTION_OPTIONS = [
  ['', 'All actions'],
  ['wallet.adjust', 'Wallet adjustment'],
  ['dispute.ruling', 'Dispute ruling'],
  ['deal.force_transition', 'Force transition'],
  ['note_added', 'Deal note'],
  ['settings.update', 'Settings update'],
  ['shipping.label_uploaded', 'Label upload'],
  ['shipping.shipped', 'Marked shipped'],
  ['withdrawal.approved', 'Withdrawal approved'],
  ['withdrawal.rejected', 'Withdrawal rejected'],
  ['user.banned', 'User banned'],
  ['user.suspended', 'User suspended'],
];

const MODULE_OPTIONS = [
  ['', 'All modules'], ['applications', 'Applications'], ['deals', 'Deals'],
  ['disputes', 'Disputes'], ['users', 'Users'], ['financials', 'Financials'],
  ['shipping', 'Shipping'], ['settings', 'Settings'], ['chat', 'Chat'],
];

const isSensitive = (l) => l.sensitive || SENSITIVE_ACTIONS.includes(l.action);
const fmtTime = (t) => (t ? new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const stringify = (v) => {
  if (v == null) return '-';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
};

function DiffBlock({ before, after }) {
  const hasBefore = before != null;
  const hasAfter = after != null;
  if (!hasBefore && !hasAfter) {
    return <p className="aud-nodiff">No before/after snapshot recorded for this action.</p>;
  }
  return (
    <div className="aud-diff">
      <div className="aud-diff-col">
        <span className="aud-diff-label aud-before">Before</span>
        <pre>{stringify(before)}</pre>
      </div>
      <div className="aud-diff-col">
        <span className="aud-diff-label aud-after">After</span>
        <pre>{stringify(after)}</pre>
      </div>
    </div>
  );
}

export default function AdminAuditLog() {
  const { user } = useAuth();
  const isFounder = user?.role === 'admin';
  const isPhone = useIsPhone();
  const [filterDraft, setFilterDraft] = useState(null); // phone filter sheet; null = closed

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [sensitiveOnly, setSensitiveOnly] = useState(false); // show only sensitive actions
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (action) params.action = action;
      if (moduleFilter) params.module = moduleFilter;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await axios.get(`${API}/admin/audit-logs`, { params });
      setLogs(res.data.logs || []);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to load audit log'));
    } finally {
      setLoading(false);
    }
  }, [action, moduleFilter, from, to]);

  useLiveEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    // Sensitive-only narrows the set first, then the free-text search runs on top.
    let rows = sensitiveOnly ? logs.filter(isSensitive) : logs;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((l) =>
        [l.action, l.module, l.admin_nickname, l.reason, l.target_type, l.target_id, l.ip]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q)));
    }
    return rows;
  }, [logs, search, sensitiveOnly]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: logs.length,
      sensitive: logs.filter(isSensitive).length,
      today: logs.filter((l) => l.created_at && new Date(l.created_at).toDateString() === today).length,
    };
  }, [logs]);

  const exportCsv = async () => {
    try {
      const params = {};
      if (action) params.action = action;
      if (moduleFilter) params.module = moduleFilter;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await axios.get(`${API}/admin/audit-logs/export`, { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-log_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Audit log exported');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Export failed'));
    }
  };

  // ===================== Phone (PWA) layout =====================
  if (isPhone) {
    const filterCount = [action, moduleFilter, sensitiveOnly, from, to].filter(Boolean).length;
    const openFilters = () => setFilterDraft({ action, module: moduleFilter, sensitive: sensitiveOnly, from, to });
    const applyFilters = () => {
      setAction(filterDraft.action); setModuleFilter(filterDraft.module); setSensitiveOnly(filterDraft.sensitive);
      setFrom(filterDraft.from); setTo(filterDraft.to);
      setFilterDraft(null);
    };
    const draft = (key) => (e) => setFilterDraft((f) => ({ ...f, [key]: e.target.value }));
    const adminName = (l) => String(l.admin_name || l.admin_nickname || 'Admin').replace(/^@+/, '');
    const target = (l, full) => (l.target_type ? `${l.target_type}:${full ? (l.target_id || '') : String(l.target_id || '').slice(0, 8)}` : '-');
    const open = expanded ? logs.find((l) => l.id === expanded) : null;

    return (
      <AdminLayout>
        <div className="am amo" data-testid="audit-phone">
          <p className="am-muted amo-flat amo-note">
            <Lock size={14} /> Immutable (append-only), retained 7 years. Every admin action is recorded with actor, target, before/after values, reason and IP.
          </p>
          {!isFounder && (
            <p className="amo-scope">
              <ShieldAlert size={16} /> You can view your own actions and peers' routine actions. Sensitive actions by other admins are founder-only.
            </p>
          )}

          <div className="am-toolbar">
            <label className="am-search">
              <Search size={18} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search admin, target, reason, IP" aria-label="Search audit log" data-testid="audit-search" />
              {search && <button type="button" className="am-search-clear" onClick={() => setSearch('')} aria-label="Clear search"><X size={18} /></button>}
            </label>
            <button type="button" className="am-filter-btn" onClick={openFilters} aria-label={filterCount ? `Filters, ${filterCount} active` : 'Filters'} data-testid="audit-filter-btn">
              <SlidersHorizontal size={20} />
              {filterCount > 0 && <span className="am-dot">{filterCount}</span>}
            </button>
          </div>

          <div className="am-tiles am-tiles--3">
            <div className="am-tile"><span className="am-tile-top">Loaded</span><span className="am-tile-value">{stats.total}</span></div>
            <button type="button" className="am-tile am-tile--wait" aria-pressed={sensitiveOnly} onClick={() => setSensitiveOnly((v) => !v)} title="Show sensitive actions only">
              <span className="am-tile-top"><Mail size={16} /> Sensitive{sensitiveOnly ? ' ✓' : ''}</span>
              <span className="am-tile-value">{stats.sensitive}</span>
            </button>
            <div className="am-tile"><span className="am-tile-top">Today</span><span className="am-tile-value">{stats.today}</span></div>
          </div>

          <div className="am-section-head">
            <h2 className="am-section-title">{visible.length} event{visible.length !== 1 ? 's' : ''}</h2>
            <span className="amo-head-actions">
              <button type="button" className="am-icon-btn" onClick={load} aria-label="Refresh"><RefreshCw size={20} /></button>
              <button type="button" className="am-btn am-btn--secondary am-btn--sm" onClick={exportCsv}><Download size={16} /> Export CSV</button>
            </span>
          </div>

          {loading ? (
            <div className="am-empty">Loading audit trail…</div>
          ) : visible.length === 0 ? (
            <div className="am-empty">No matching admin actions logged.</div>
          ) : (
            <div className="am-list">
              {visible.map((l) => (
                <button key={l.id} type="button" className={`am-card${isSensitive(l) ? ' amo-sensitive' : ''}`} onClick={() => setExpanded(l.id)} data-testid={`audit-row-${l.id}`}>
                  <span className="am-card-main">
                    <span className="am-card-title amo-mono">{l.action}</span>
                    <span className="am-card-sub">{adminName(l)}{l.admin_role ? ` · ${l.admin_role}` : ''}</span>
                  </span>
                  <span className="am-meta">
                    <span>Target: {target(l)}{l.module ? ` · ${l.module}` : ''}</span>
                    {l.reason && <span className="amo-clamp">Reason: {l.reason}</span>}
                  </span>
                  <span className="am-card-foot">
                    <span className="am-muted">{fmtTime(l.created_at)}</span>
                    {isSensitive(l) ? <span className="am-badge am-badge--wait"><Mail size={12} /> Sensitive</span> : <ChevronRight size={20} className="am-row-chevron" />}
                  </span>
                </button>
              ))}
            </div>
          )}

          {open && (
            <div className="am-detail" role="dialog" aria-modal="true" aria-label="Audit event" data-testid="audit-detail">
              <header className="am-detail-head">
                <button type="button" className="am-icon-btn" onClick={() => setExpanded(null)} aria-label="Back to audit log" data-testid="audit-detail-back"><ArrowLeft size={22} /></button>
                <h1>Audit event</h1>
              </header>
              <div className="am-detail-body">
                <section className="am-section">
                  <h3 className="amo-mono">{open.action}</h3>
                  {isSensitive(open) && <p className="amo-scope"><Mail size={16} /> Founder notified via email digest</p>}
                  <div className="am-kv"><span>When</span><span>{fmtTime(open.created_at)}</span></div>
                  <div className="am-kv"><span>Admin</span><span>{adminName(open)}</span></div>
                  {open.admin_role && <div className="am-kv"><span>Role</span><span>{open.admin_role}</span></div>}
                  <div className="am-kv"><span>Module</span><span>{open.module || '-'}</span></div>
                  <div className="am-kv"><span>Target</span><span className="amo-mono">{target(open, true)}</span></div>
                  <div className="am-kv"><span>Reason</span><span>{open.reason || '-'}</span></div>
                  <div className="am-kv"><span>IP</span><span className="amo-mono">{open.ip || '-'}</span></div>
                </section>
                <section className="am-section">
                  <h3>Record</h3>
                  <div className="am-kv"><span>Event ID</span><span className="amo-mono">{open.id}</span></div>
                  <div className="am-kv"><span>Full timestamp</span><span className="amo-mono">{open.created_at}</span></div>
                  <div className="am-kv"><span>Admin ID</span><span className="amo-mono">{open.admin_id}</span></div>
                  {open.user_agent && <div className="am-kv"><span>User agent</span><span className="amo-mono">{open.user_agent}</span></div>}
                </section>
                <section className="am-section">
                  <h3>Before / after</h3>
                  {open.before == null && open.after == null ? (
                    <p className="am-muted">No before/after snapshot recorded for this action.</p>
                  ) : (
                    <>
                      <span className="am-badge am-badge--bad amo-self-start">Before</span>
                      <pre className="amo-pre">{stringify(open.before)}</pre>
                      <span className="am-badge am-badge--ok amo-self-start">After</span>
                      <pre className="amo-pre">{stringify(open.after)}</pre>
                    </>
                  )}
                </section>
              </div>
            </div>
          )}

          {filterDraft && (
            <>
              <div className="am-sheet-backdrop" onClick={() => setFilterDraft(null)} />
              <section className="am-sheet" role="dialog" aria-modal="true" aria-label="Filters" data-testid="audit-filters">
                <header className="am-sheet-head">
                  <h2>Filters</h2>
                  <button type="button" className="am-icon-btn" onClick={() => setFilterDraft(null)} aria-label="Close"><X size={20} /></button>
                </header>
                <div className="am-sheet-body">
                  <div className="am-field">
                    <label htmlFor="amo-f-action">Action</label>
                    <select id="amo-f-action" value={filterDraft.action} onChange={draft('action')}>
                      {ACTION_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="am-field">
                    <label htmlFor="amo-f-module">Module</label>
                    <select id="amo-f-module" value={filterDraft.module} onChange={draft('module')}>
                      {MODULE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <label className="amo-check">
                    <input type="checkbox" checked={filterDraft.sensitive} onChange={(e) => setFilterDraft((f) => ({ ...f, sensitive: e.target.checked }))} />
                    Sensitive actions only
                  </label>
                  <div className="am-field">
                    <label htmlFor="amo-f-from">From date</label>
                    <input id="amo-f-from" type="date" value={filterDraft.from} max={filterDraft.to || undefined} onChange={draft('from')} />
                  </div>
                  <div className="am-field">
                    <label htmlFor="amo-f-to">To date</label>
                    <input id="amo-f-to" type="date" value={filterDraft.to} min={filterDraft.from || undefined} onChange={draft('to')} />
                  </div>
                </div>
                <footer className="am-sheet-foot">
                  <button type="button" className="am-btn am-btn--secondary" onClick={() => setFilterDraft({ action: '', module: '', sensitive: false, from: '', to: '' })}>Reset</button>
                  <button type="button" className="am-btn am-btn--primary" onClick={applyFilters} data-testid="audit-filters-apply">Apply</button>
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
      {/* Compliance banner — immutability + retention (PRD 11.15) */}
      <div className="aud-notice">
        <Lock size={15} />
        <span>
          This log is <strong>immutable (append-only)</strong> and retained for <strong>7 years</strong> for
          legal compliance. Every admin action is recorded with actor, target, before/after values, reason and IP.
        </span>
      </div>

      {/* Role-scope banner for non-founders (PRD 11.15 log review) */}
      {!isFounder && (
        <div className="aud-scope">
          <ShieldAlert size={15} />
          You can view <strong>your own actions</strong> and peers' <strong>routine</strong> actions. Sensitive
          actions by other admins are founder-only.
        </div>
      )}

      <div className="aud-stats">
        <div className="aud-stat"><span className="aud-stat-num">{stats.total}</span><span className="aud-stat-label">Events loaded</span></div>
        <button
          type="button"
          className={`aud-stat aud-stat-warn aud-stat-btn ${sensitiveOnly ? 'on' : ''}`}
          onClick={() => setSensitiveOnly((v) => !v)}
          title="Click to filter to sensitive actions only"
          aria-pressed={sensitiveOnly}
        >
          <span className="aud-stat-num">{stats.sensitive}</span><span className="aud-stat-label">Sensitive actions</span>
        </button>
        <div className="aud-stat"><span className="aud-stat-num">{stats.today}</span><span className="aud-stat-label">Today</span></div>
      </div>

      <section className="aud-panel">
        <div className="aud-toolbar">
          <div className="aud-srch">
            <Search size={15} />
            <input
              placeholder="Search admin, target, reason, IP…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTION_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
            {MODULE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button
            type="button"
            className={`aud-btn-ghost aud-sens-toggle ${sensitiveOnly ? 'on' : ''}`}
            onClick={() => setSensitiveOnly((v) => !v)}
            title="Show only sensitive actions"
            aria-pressed={sensitiveOnly}
          >
            <Mail size={14} /> Sensitive only
          </button>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} title="From date" />
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} title="To date" />
          <button className="aud-btn-ghost" onClick={load} title="Refresh"><RefreshCw size={15} /></button>
          <button className="aud-btn" onClick={exportCsv}><Download size={15} /> Export CSV</button>
        </div>

        <div className="aud-head-row">
          <h3><ScrollText size={16} /> Audit Log <span className="aud-count">{visible.length}</span></h3>
        </div>

        {loading ? (
          <p className="aud-loading">Loading audit trail…</p>
        ) : (
          <div className="aud-table">
            <div className="aud-row aud-thead">
              <span />
              <span>When</span><span>Admin</span><span>Action</span>
              <span>Module</span><span>Target</span><span>Reason</span><span>IP</span>
            </div>
            {visible.map((l) => {
              const open = expanded === l.id;
              const sensitive = isSensitive(l);
              return (
                <div className={`aud-group ${open ? 'open' : ''}`} key={l.id}>
                  <button
                    type="button"
                    className={`aud-row aud-data ${sensitive ? 'sensitive' : ''}`}
                    onClick={() => setExpanded(open ? null : l.id)}
                  >
                    <span className="aud-caret">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                    <span className="aud-when">{fmtTime(l.created_at)}</span>
                    <span className="aud-admin">
                      {String(l.admin_name || l.admin_nickname || 'Admin').replace(/^@+/, '')}
                      {l.admin_role && <em className="aud-role">{l.admin_role}</em>}
                    </span>
                    <span className="aud-action">
                      {l.action}
                      {sensitive && <span className="aud-tag" title="Sensitive - founder notified via email digest"><Mail size={10} /></span>}
                    </span>
                    <span className="aud-module">{l.module || '-'}</span>
                    <span className="aud-target">{l.target_type ? `${l.target_type}:${String(l.target_id || '').slice(0, 8)}` : '-'}</span>
                    <span className="aud-reason" title={l.reason}>{l.reason || '-'}</span>
                    <span className="aud-ip">{l.ip || '-'}</span>
                  </button>
                  {open && (
                    <div className="aud-detail">
                      <div className="aud-meta">
                        <div><span>Event ID</span><code>{l.id}</code></div>
                        <div><span>Full timestamp</span><code>{l.created_at}</code></div>
                        <div><span>Admin ID</span><code>{l.admin_id}</code></div>
                        {l.user_agent && <div className="aud-ua"><span>User agent</span><code>{l.user_agent}</code></div>}
                        {sensitive && (
                          <div className="aud-notified"><Mail size={13} /> Founder notified via email digest</div>
                        )}
                      </div>
                      <DiffBlock before={l.before} after={l.after} />
                    </div>
                  )}
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className="aud-empty">No matching admin actions logged.</div>
            )}
          </div>
        )}
      </section>

      <style>{`
        .aud-notice { display:flex; align-items:flex-start; gap:10px; background:#f5f6ff; border:1px solid #dfe2ff; color:#3a3a66; padding:12px 16px; border-radius:12px; margin-bottom:14px; font-size:13px; line-height:1.5; }
        .aud-notice svg { flex-shrink:0; margin-top:2px; color:#5b6bff; }
        .aud-scope { display:flex; align-items:center; gap:9px; background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; padding:10px 14px; border-radius:11px; margin-bottom:14px; font-size:13px; }
        .aud-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:16px; }
        .aud-stat { background:#fff; border:1px solid #ececf1; border-radius:14px; padding:16px 18px; display:flex; flex-direction:column; gap:4px; }
        .aud-stat-warn { border-color:#fde0c4; background:#fffaf4; }
        .aud-stat-num { font-size:26px; font-weight:800; color:#07074e; line-height:1; font-family:var(--font-head,inherit); }
        .aud-stat-warn .aud-stat-num { color:#c2410c; }
        .aud-stat-label { font-size:12px; color:#8a8a93; text-transform:uppercase; letter-spacing:.04em; }

        .aud-panel { background:#fff; border:1px solid #ececf1; border-radius:14px; padding:18px; }
        .aud-toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:14px; }
        .aud-srch { display:flex; align-items:center; gap:8px; flex:1; min-width:220px; border:1px solid #e2e4f0; border-radius:9px; padding:0 10px; background:#fafaff; }
        .aud-srch svg { color:#9a9ab0; }
        .aud-srch input { border:none; outline:none; background:transparent; padding:9px 0; flex:1; font-size:13px; }
        .aud-toolbar select, .aud-toolbar input[type="date"] { padding:8px 10px; border:1px solid #e2e4f0; border-radius:9px; font-size:13px; color:#4b4b66; background:#fff; }
        /* Focus ring on the search WRAPPER only - not the inner input as well,
           otherwise both glow and you get a double outline. */
        .aud-toolbar select:focus, .aud-toolbar input[type="date"]:focus, .aud-srch:focus-within { outline:none; border-color:#5b6bff; box-shadow:0 0 0 3px rgba(91,107,255,0.16); }
        .aud-srch input:focus { outline:none; box-shadow:none; border:none; }
        .aud-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 16px; border:1px solid transparent; border-radius:9px; background:linear-gradient(100deg,#12124f,#07074e); color:#fff; font-weight:600; cursor:pointer; font-size:13px; box-shadow:0 12px 26px -12px rgba(7,7,78,.7); }
        .aud-btn:hover { transform:translateY(-1px); }
        .aud-btn-ghost { display:inline-flex; align-items:center; justify-content:center; padding:9px 11px; border:1px solid #e2e4f0; border-radius:9px; background:#fff; color:#5b6bff; cursor:pointer; }
        /* Sensitive-only filter: toolbar toggle + the clickable "Sensitive actions" stat */
        .aud-sens-toggle { gap:6px; font:inherit; font-size:13px; font-weight:600; color:#b45309; }
        .aud-sens-toggle:hover { background:#fffaf4; border-color:#fde0c4; }
        .aud-sens-toggle.on { background:#fff7ed; border-color:#f59e0b; color:#b45309; box-shadow:0 0 0 3px rgba(245,158,11,0.16); }
        .aud-stat-btn { font:inherit; text-align:left; cursor:pointer; transition:box-shadow .15s, border-color .15s; }
        .aud-stat-btn:hover { border-color:#f59e0b; }
        .aud-stat-btn.on { border-color:#f59e0b; box-shadow:0 0 0 3px rgba(245,158,11,0.18); }
        .aud-btn-ghost:hover { background:#f5f6ff; }

        .aud-head-row h3 { margin:0 0 8px; font-size:15px; color:#07074e; display:flex; align-items:center; gap:8px; }
        .aud-count { background:#eef0ff; color:#5b6bff; border-radius:999px; padding:1px 9px; font-size:12px; }
        .aud-loading { color:#8a8a93; padding:20px 4px; }

        .aud-table { display:flex; flex-direction:column; font-size:12.5px; }
        .aud-row { display:grid; grid-template-columns:28px 1.3fr 1.1fr 1.3fr .9fr 1.1fr 1.5fr .9fr; gap:8px; align-items:center; }
        .aud-thead { font-weight:700; color:#8a8a93; font-size:11px; text-transform:uppercase; letter-spacing:.03em; padding:6px 8px; border-bottom:1px solid #ececf1; }
        .aud-data { width:100%; text-align:left; background:none; border:none; border-bottom:1px solid #f2f2f6; padding:10px 8px; cursor:pointer; font:inherit; color:#3a3a55; }
        .aud-data:hover { background:#fafaff; }
        .aud-data.sensitive { box-shadow:inset 3px 0 0 #f59e0b; }
        .aud-caret { color:#b4b4c4; display:flex; }
        .aud-when { color:#4b4b66; }
        .aud-admin { font-weight:600; color:#07074e; display:flex; flex-direction:column; }
        .aud-role { font-style:normal; font-size:10px; color:#9a9ab0; text-transform:uppercase; letter-spacing:.03em; }
        .aud-action { font-family:monospace; color:#5b6bff; display:flex; align-items:center; gap:6px; }
        .aud-tag { display:inline-flex; align-items:center; background:#fef3c7; color:#b45309; border-radius:5px; padding:2px 4px; }
        .aud-module { color:#6b6b80; text-transform:capitalize; }
        .aud-target { font-family:monospace; color:#6b6b80; }
        .aud-reason { color:#6b6b80; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .aud-ip { color:#9a9ab0; font-family:monospace; }

        .aud-detail { background:#fafaff; border-bottom:1px solid #f2f2f6; padding:14px 16px 16px 36px; }
        .aud-meta { display:flex; flex-wrap:wrap; gap:18px; margin-bottom:12px; }
        .aud-meta > div { display:flex; flex-direction:column; gap:3px; }
        .aud-meta span { font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:#9a9ab0; }
        .aud-meta code { font-size:12px; color:#3a3a55; word-break:break-all; }
        .aud-ua { flex-basis:100%; }
        .aud-notified { flex-basis:100%; display:flex; align-items:center; gap:7px; color:#b45309; background:#fffaf4; border:1px solid #fde0c4; border-radius:8px; padding:7px 11px; font-size:12px; font-weight:600; }
        .aud-diff { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .aud-diff-col { display:flex; flex-direction:column; gap:6px; }
        .aud-diff-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; width:max-content; padding:2px 8px; border-radius:6px; }
        .aud-before { background:#fef2f2; color:#b91c1c; }
        .aud-after { background:#f0fdf4; color:#15803d; }
        .aud-diff pre { margin:0; background:#fff; border:1px solid #ececf1; border-radius:8px; padding:10px; font-size:11.5px; overflow:auto; max-height:240px; white-space:pre-wrap; word-break:break-word; }
        .aud-nodiff { color:#9a9ab0; font-size:12.5px; margin:0; }
        .aud-empty { padding:28px; text-align:center; color:#9a9ab0; }

        @media (max-width:900px) {
          .aud-stats { grid-template-columns:1fr; }
          .aud-row { grid-template-columns:24px 1.2fr 1fr 1.2fr; }
          .aud-row > :nth-child(n+5) { display:none; }
          .aud-thead > :nth-child(n+5) { display:none; }
          .aud-diff { grid-template-columns:1fr; }
        }
      `}</style>
    </AdminLayout>
  );
}
