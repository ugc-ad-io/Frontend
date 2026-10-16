import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, ChevronRight, Search, X } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import useIsPhone from '../lib/useIsPhone';
import '../styles/admin-mobile-platform.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// {amount} -> sample value; unknown placeholders stay as typed (same rule as the backend).
const fill = (text, samples) => (text || '').replace(/\{(\w+)\}/g, (m, k) => (k in samples ? samples[k] : m));
const same = (a, b) => (a || '').trim() === (b || '').trim();

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', cursor: 'pointer', flexWrap: 'wrap' },
  chip: { fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#eef1ff', color: '#4452c4' },
  body: { padding: '4px 18px 18px', borderTop: '1px solid #f1f5f9' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, margin: '14px 0 6px', color: '#334155' },
  hint: { fontSize: 12, color: '#64748b', marginTop: 4 },
  preview: { background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: 12, fontSize: 14, whiteSpace: 'pre-wrap' },
  ph: { fontFamily: 'monospace', fontSize: 12, padding: '2px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' },
  btn: { padding: '9px 20px', fontSize: 14, borderRadius: 10 },
};

const AUDIENCES = ['All', 'Creator', 'Brand', 'Either party', 'Any user'];

function TemplateCard({ ev, samples, onChanged, phone }) {
  const o = ev.override || {};
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState('message');
  // Email fields start as "same as the notification" until the admin writes separate text.
  const [f, setF] = useState({
    title: o.title || ev.title,
    message: o.message || ev.message,
    emailEnabled: o.email_enabled ?? ev.email,
    emailSubject: o.email_subject || o.title || ev.title,
    emailBody: o.email_body || o.message || ev.message,
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const edited = !!ev.override;

  const save = async () => {
    setBusy(true);
    try {
      await axios.put(`${API}/admin/notification-templates/${ev.key}`, {
        title: same(f.title, ev.title) ? '' : f.title,
        message: same(f.message, ev.message) ? '' : f.message,
        email_enabled: f.emailEnabled,
        email_subject: same(f.emailSubject, f.title) ? '' : f.emailSubject,
        email_body: same(f.emailBody, f.message) ? '' : f.emailBody,
      });
      toast.success('Saved - new notifications use this wording');
      onChanged();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await axios.delete(`${API}/admin/notification-templates/${ev.key}`);
      toast.success('Back to the default wording');
      onChanged();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not reset');
    } finally {
      setBusy(false);
    }
  };

  const field = (k, rows) => {
    const common = { value: f[k], onChange: set(k), onFocus: () => setFocus(k) };
    return rows
      ? <textarea className="textarea-field" style={{ minHeight: 0 }} rows={rows} {...common} />
      : <input className="input-field" {...common} />;
  };

  // ===================== Phone (PWA) layout =====================
  // A card in the list; tapping opens a full-screen editor. Same state, save and reset,
  // and the card stays mounted, so closing the editor keeps unsaved text.
  if (phone) {
    const pfield = (k, label, rows) => {
      const common = { id: `nt-${ev.key}-${k}`, value: f[k], onChange: set(k), onFocus: () => setFocus(k) };
      return (
        <div className="am-field">
          <label htmlFor={common.id}>{label}</label>
          {rows ? <textarea rows={rows} {...common} /> : <input type="text" {...common} />}
        </div>
      );
    };
    const focusLabel = { title: 'title', message: 'message', emailSubject: 'email subject', emailBody: 'email body' }[focus];
    return (
      <>
        <button type="button" className="am-card" onClick={() => setOpen(true)} data-testid={`template-${ev.key}`}>
          <span className="am-card-head">
            <span className="am-card-main">
              <span className="am-card-title">{ev.label}</span>
              <span className="am-card-sub">{fill(f.title, samples)}</span>
            </span>
            <ChevronRight size={18} className="am-row-chevron" />
          </span>
          <span className="am-badges">
            <span className="am-badge am-badge--info">To: {ev.to}</span>
            <span className="am-badge am-badge--neutral">Bell</span>
            <span className={`am-badge am-badge--${f.emailEnabled ? 'ok' : 'neutral'}`}>Email {f.emailEnabled ? 'on' : 'off'}</span>
            {edited && <span className="am-badge am-badge--wait">Edited</span>}
          </span>
        </button>

        {open && (
          <div className="am-detail" role="dialog" aria-modal="true" aria-label={ev.label} data-testid="template-editor">
            <header className="am-detail-head">
              <button type="button" className="am-icon-btn" aria-label="Back" onClick={() => setOpen(false)} data-testid="template-back"><ArrowLeft size={22} /></button>
              <h1>{ev.label}</h1>
            </header>
            <div className="am-detail-body">
              <div className="am-badges">
                <span className="am-badge am-badge--info">To: {ev.to}</span>
                {edited && <span className="am-badge am-badge--wait">Edited</span>}
              </div>
              <section className="am-section">
                <h3>Bell notification</h3>
                {pfield('title', 'Notification title')}
                {pfield('message', 'Notification message', 3)}
              </section>

              <section className="am-section">
                <h3>Auto-filled values</h3>
                {ev.vars.length === 0 ? <p className="am-muted">None for this one.</p> : (
                  <>
                    <p className="am-muted">Tap to insert into the {focusLabel} field.</p>
                    <div className="amp-btns">
                      {ev.vars.map((v) => (
                        <button type="button" key={v} className="amp-ph" title={`e.g. ${samples[v] ?? v}`}
                          onClick={() => setF((p) => ({ ...p, [focus]: `${p[focus]}{${v}}` }))}>{`{${v}}`}</button>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section className="am-section">
                <h3>Email</h3>
                <label className="amp-check">
                  <input type="checkbox" checked={f.emailEnabled}
                    onChange={(e) => setF((p) => ({ ...p, emailEnabled: e.target.checked }))} data-testid="template-email-toggle" />
                  Also send this as an email
                </label>
                {f.emailEnabled && (
                  <>
                    {pfield('emailSubject', 'Email subject')}
                    {pfield('emailBody', 'Email body', 5)}
                    <span className="am-field-hint">Starts as a copy of the notification. Change it only if the email should read differently.</span>
                  </>
                )}
              </section>

              <section className="am-section">
                <h3>Preview (sample values)</h3>
                <p className="amp-preview"><strong>{fill(f.title, samples)}</strong>{'\n'}{fill(f.message, samples)}</p>
                {f.emailEnabled && (
                  <p className="amp-preview"><span className="am-muted">Email - subject:</span> <strong>{fill(f.emailSubject, samples)}</strong>{'\n'}{fill(f.emailBody, samples)}</p>
                )}
              </section>
            </div>
            <div className="am-actionbar">
              <div className="am-actionbar-row">
                {edited && (
                  <button type="button" className="am-btn am-btn--secondary" disabled={busy} onClick={reset} data-testid="template-reset">Reset to default</button>
                )}
                <button type="button" className="am-btn am-btn--primary" disabled={busy} onClick={save} data-testid="template-save">
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div style={S.card} data-testid={`template-${ev.key}`}>
      <div style={S.head} onClick={() => setOpen(!open)}>
        <strong style={{ flex: 1, minWidth: 180 }}>{ev.label}</strong>
        <span style={S.chip}>To: {ev.to}</span>
        <span style={{ ...S.chip, background: f.emailEnabled ? '#e8f8ee' : '#f1f5f9', color: f.emailEnabled ? '#15803d' : '#64748b' }}>
          Email {f.emailEnabled ? 'on' : 'off'}
        </span>
        {edited && <span style={{ ...S.chip, background: '#fff4e0', color: '#b45309' }}>Edited</span>}
        <span style={{ color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={S.body}>
          <label style={S.label}>Notification title (bell)</label>
          {field('title')}
          <label style={S.label}>Notification message (bell)</label>
          {field('message', 3)}

          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={S.hint}>Auto-filled values - click to insert:</span>
            {ev.vars.length === 0 && <span style={S.hint}>none for this one</span>}
            {ev.vars.map((v) => (
              <button type="button" key={v} style={S.ph} title={`e.g. ${samples[v] ?? v}`}
                onClick={() => setF((p) => ({ ...p, [focus]: `${p[focus]}{${v}}` }))}>{`{${v}}`}</button>
            ))}
          </div>

          <label style={{ ...S.label, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={f.emailEnabled}
              onChange={(e) => setF((p) => ({ ...p, emailEnabled: e.target.checked }))} />
            Also send this as an email
          </label>
          {f.emailEnabled && (
            <>
              <label style={S.label}>Email subject</label>
              {field('emailSubject')}
              <label style={S.label}>Email body</label>
              {field('emailBody', 4)}
              <div style={S.hint}>Starts as a copy of the notification. Change it only if the email should read differently.</div>
            </>
          )}

          <label style={S.label}>Preview (sample values)</label>
          <div style={S.preview}>
            <strong>{fill(f.title, samples)}</strong>{'\n'}{fill(f.message, samples)}
          </div>
          {f.emailEnabled && (
            <div style={{ ...S.preview, marginTop: 8 }}>
              <span style={S.hint}>Email - subject:</span> <strong>{fill(f.emailSubject, samples)}</strong>{'\n'}{fill(f.emailBody, samples)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn-primary" style={S.btn} disabled={busy} onClick={save}>Save changes</button>
            {edited && (
              <button type="button" style={{ ...S.btn, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                disabled={busy} onClick={reset}>Reset to default</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminNotificationTemplates() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [audience, setAudience] = useState('All');
  const [q, setQ] = useState('');
  const isPhone = useIsPhone();

  const load = useCallback(async () => {
    try {
      const { data: d } = await axios.get(`${API}/admin/notification-templates`);
      // Never trust the shape: a proxy/error page or older backend must not crash the page.
      if (!d || !Array.isArray(d.events)) throw new Error('unexpected response');
      setData(d);
      setFailed(false);
    } catch (e) {
      setFailed(true);
      toast.error(e.response?.data?.detail || 'Could not load notification templates');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data && isPhone) {
    return (
      <AdminLayout>
        <div className="am amp">
          {failed ? (
            <div className="am-empty">
              <p>Could not load the notification templates.</p>
              <button type="button" className="am-btn am-btn--secondary" onClick={load}>Try again</button>
            </div>
          ) : <p className="am-empty">Loading notifications…</p>}
        </div>
      </AdminLayout>
    );
  }
  if (!data) {
    return (
      <AdminLayout>
        {failed
          ? <p>Could not load the notification templates. <button type="button" onClick={load}>Try again</button></p>
          : <p>Loading notifications...</p>}
      </AdminLayout>
    );
  }
  const shown = data.events.filter((ev) =>
    (audience === 'All' || ev.to === audience) &&
    (!q || `${ev.label} ${ev.title} ${ev.message}`.toLowerCase().includes(q.toLowerCase())));

  if (isPhone) {
    return (
      <AdminLayout>
        <div className="am amp" data-testid="templates-phone">
          <p className="am-muted">
            Every automatic message the platform sends, with its default wording. Words in {'{curly brackets}'} are
            filled in automatically. &quot;Reset to default&quot; goes back to the original text.
          </p>
          <label className="am-search">
            <Search size={18} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notifications" aria-label="Search notifications" />
            {q && <button type="button" className="am-search-clear" onClick={() => setQ('')} aria-label="Clear search"><X size={18} /></button>}
          </label>
          <div className="am-chips" role="group" aria-label="Audience">
            {AUDIENCES.map((a) => (
              <button key={a} type="button" className={`am-chip${audience === a ? ' is-active' : ''}`} aria-pressed={audience === a} onClick={() => setAudience(a)}>{a}</button>
            ))}
          </div>
          <div className="am-list">
            {shown.map((ev) => (
              <TemplateCard key={ev.key + (ev.override?.updated_at || '')} ev={ev} samples={data.samples} onChanged={load} phone />
            ))}
          </div>
          {shown.length === 0 && <p className="am-empty">No notifications match.</p>}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
    <div className="fade-in">
      <p style={{ color: '#64748b', maxWidth: 760 }}>
        Every automatic message the platform sends is listed here with its default wording already filled in.
        Edit any of it: the bell notification and the email. Words in {'{curly brackets}'} are filled in
        automatically (names, amounts, campaign titles). &quot;Reset to default&quot; goes back to the original text.
      </p>
      <div style={{ display: 'flex', gap: 10, margin: '16px 0', flexWrap: 'wrap' }}>
        <select className="input-field" style={{ width: 180 }} value={audience} onChange={(e) => setAudience(e.target.value)}>
          {AUDIENCES.map((a) => <option key={a}>{a}</option>)}
        </select>
        <input className="input-field" style={{ flex: 1, minWidth: 220 }} placeholder="Search notifications..."
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {shown.map((ev) => (
        <TemplateCard key={ev.key + (ev.override?.updated_at || '')} ev={ev} samples={data.samples} onChanged={load} />
      ))}
      {shown.length === 0 && <p>No notifications match.</p>}
    </div>
    </AdminLayout>
  );
}
