import { useLiveEffect } from '../lib/liveUpdates';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Briefcase, X, Eye, ArrowLeft, ChevronRight, Tag, Target, Package } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { apiErrorMessage } from '../utils/apiError';
import useIsPhone from '../lib/useIsPhone';
import '../styles/admin-mobile-ops.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Show the business's real company name — never their @username handle
// (business_nickname / brand_handle are the handle sources, so they're excluded).
const brandName = (c) => String(c?.brand_name || c?.business_name || c?.company_name || '').replace(/^@+/, '').trim() || '-';
// The reason sent with every rejection from this queue (there is no free-text box).
const REJECT_REASON = 'Campaign does not meet guidelines';

// Phone: the brief text is "Label: value" lines (see PostABrief buildBriefText).
// Group it into headed sections; unlabeled lines (numbered deliverables) join the
// section above. A label must start with a letter, so "9:16" never becomes one.
const BRIEF_HEAD = /^([A-Za-z][A-Za-z /&()'-]{0,38}):\s*(.*)$/;
const briefSections = (text) => {
  const out = [];
  String(text || '').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const m = line.match(BRIEF_HEAD);
    // `inline`: the value sat on the label line ("Usage rights: a; b"), so its "; " parts are a list.
    if (m) out.push({ h: m[1], lines: m[2] ? [m[2]] : [], inline: !!m[2] });
    else if (out.length) out[out.length - 1].lines.push(line);
    else out.push({ h: 'Brief', lines: [line] });
  });
  return out.filter((s) => s.lines.length);
};
const budgetText = (c) => `₹${c.budget_min} - ₹${c.budget_max}`;
const statusText = (s) => String(s || '').replace(/_/g, ' ');

export default function AdminCampaigns() {
  const [pendingCampaigns, setPendingCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  // Draft of the script an admin is writing for a "UGC.ad writes it" brief —
  // separate from `selected.script_text` so typing doesn't need a round-trip.
  const [scriptDraft, setScriptDraft] = useState('');
  const openModal = (campaign) => { setSelected(campaign); setScriptDraft(campaign.script_text || ''); };
  const isPhone = useIsPhone();
  const [busy, setBusy] = useState(false);            // phone: a decision is in flight
  const [rejectOpen, setRejectOpen] = useState(false); // phone: reject confirmation sheet

  useLiveEffect(() => {
    fetchPendingCampaigns();
  }, []);

  const fetchPendingCampaigns = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/pending-campaigns`);
      setPendingCampaigns(response.data);
    } catch (error) {
      toast.error('Failed to load pending campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id, scriptText) => {
    try {
      const body = { item_id: id, action: 'approve' };
      if (scriptText !== undefined) body.script_text = scriptText;
      await axios.post(`${API}/admin/approve-campaign`, body);
      toast.success('Campaign approved successfully');
      fetchPendingCampaigns();
      return true;
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to approve campaign'));
      return false;
    }
  };

  const handleReject = async (id) => {
    try {
      await axios.post(`${API}/admin/approve-campaign`, {
        item_id: id, action: 'reject', reason: REJECT_REASON
      });
      toast.success('Campaign rejected');
      fetchPendingCampaigns();
      return true;
    } catch {
      toast.error('Failed to reject campaign');
      return false;
    }
  };

  // ===================== Phone (PWA) layout =====================
  if (isPhone) {
    const ugcScript = selected?.script_provider === 'ugc';
    const closeDetail = () => { if (!busy) { setRejectOpen(false); setSelected(null); } };
    // Close the brief only once the decision saved, so a failure keeps the admin's place.
    const decide = async (run) => {
      setBusy(true);
      const ok = await run();
      setBusy(false);
      if (ok) { setRejectOpen(false); setSelected(null); }
    };
    const needsScript = (c) => c.script_provider === 'ugc' && !c.script_text;
    // Brief-text sections already shown from a structured field above are skipped.
    const shown = new Set(['script']);
    if (selected?.product_name) shown.add('product');
    if (selected?.product_description) shown.add('product description');
    if (selected?.campaign_hook) shown.add('hook');
    if (selected?.key_message) shown.add('key message');
    if (selected?.objectives?.length) shown.add('objectives');
    const sections = selected ? briefSections(selected.brief_text).filter((s) => !shown.has(s.h.toLowerCase())) : [];
    const deliverables = Array.isArray(selected?.deliverable_items) ? selected.deliverable_items : [];

    return (
      <AdminLayout>
        <div className="am" data-testid="briefs-phone">
          {!loading && <p className="am-muted">{pendingCampaigns.length} {pendingCampaigns.length === 1 ? 'brief' : 'briefs'} awaiting approval</p>}

          {loading && !pendingCampaigns.length ? (
            <div className="am-empty">Loading briefs…</div>
          ) : !pendingCampaigns.length ? (
            <div className="am-empty">No pending campaign approvals. New submissions will appear here.</div>
          ) : (
            <div className="am-list">
              {pendingCampaigns.map((c, i) => (
                <button key={c.id || c._id || `campaign-${i}`} type="button" className="am-card" onClick={() => openModal(c)} data-testid={`brief-card-${c.id}`}>
                  <span className="am-card-head">
                    <span className="am-thumb amo-thumb" aria-hidden="true"><Briefcase size={24} /></span>
                    <span className="am-card-main">
                      <span className="am-card-title">{c.title}</span>
                      <span className="am-card-sub">{brandName(c)}</span>
                      <span className="am-badges">
                        <span className="am-badge am-badge--wait">{statusText(c.status)}</span>
                        {needsScript(c) && <span className="am-badge am-badge--bad">Needs script</span>}
                      </span>
                    </span>
                  </span>
                  <span className="amo-meta">
                    <span><Tag size={15} /> {c.product_category || c.category || 'No category'}</span>
                    <span><Target size={15} /> {c.objectives?.join(', ') || 'No objective'}</span>
                    <span><Package size={15} /> Shipment {c.requires_shipment ? 'required' : 'not required'}</span>
                  </span>
                  <span className="am-card-foot">
                    <span className="amo-stack">
                      <span className="am-amount-label">Budget</span>
                      <span className="am-amount">{budgetText(c)}</span>
                    </span>
                    <span className="amo-go">Review <ChevronRight size={18} /></span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="am-detail" role="dialog" aria-modal="true" aria-labelledby="amo-brief-title" data-testid="brief-detail">
              <header className="am-detail-head">
                <button type="button" className="am-icon-btn" onClick={closeDetail} aria-label="Back to briefs"><ArrowLeft size={22} /></button>
                <h1 id="amo-brief-title">Brief review</h1>
              </header>

              <div className="am-detail-body">
                <div className="amo-identity">
                  <h2>{selected.title}</h2>
                  <span className="am-card-sub">{brandName(selected)}</span>
                  <span className="am-badges"><span className="am-badge am-badge--wait">{statusText(selected.status)}</span></span>
                </div>

                <section className="am-section">
                  <h3>At a glance</h3>
                  <div className="am-kv"><span>Business</span><span>{brandName(selected)}</span></div>
                  <div className="am-kv"><span>Budget</span><span>{budgetText(selected)}</span></div>
                  {(selected.product_category || selected.category) && <div className="am-kv"><span>Category</span><span>{selected.product_category || selected.category}</span></div>}
                  {selected.objectives?.length > 0 && <div className="am-kv"><span>Objectives</span><span>{selected.objectives.join(', ')}</span></div>}
                  {Array.isArray(selected.usage_platforms) && selected.usage_platforms.length > 0 && (
                    <div className="am-kv"><span>Platforms</span><span>{selected.usage_platforms.join(', ')}</span></div>
                  )}
                  <div className="am-kv"><span>Requires shipment</span><span>{selected.requires_shipment ? 'Yes' : 'No'}</span></div>
                </section>

                {(selected.product_name || selected.product_description) && (
                  <section className="am-section">
                    <h3>Product</h3>
                    {selected.product_name && <p><strong>{selected.product_name}</strong></p>}
                    {selected.product_description && <p>{selected.product_description}</p>}
                  </section>
                )}
                {selected.campaign_hook && <section className="am-section"><h3>Hook</h3><p>{selected.campaign_hook}</p></section>}
                {selected.key_message && <section className="am-section"><h3>Key message</h3><p>{selected.key_message}</p></section>}
                {deliverables.length > 0 && (
                  <section className="am-section">
                    <h3>Deliverables</h3>
                    <ul className="amo-list">
                      {deliverables.map((d, i) => (
                        <li key={i}>{d.quantity || 1} × {d.type || '-'}{d.edited_required ? ` (edited by ${d.edited_by === 'ugc' ? 'UGC.ad' : 'creator'})` : ''}</li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="am-section">
                  <h3>Script</h3>
                  {ugcScript ? (
                    <div className="am-field">
                      <label htmlFor="amo-script">Write the script for the creator (required)</label>
                      <textarea id="amo-script" rows={8} value={scriptDraft} onChange={(e) => setScriptDraft(e.target.value)} placeholder="Write the script for the creator..." />
                      <span className="am-field-hint">This brief can't be approved until a script is added.</span>
                    </div>
                  ) : (
                    <p className="amo-pre">{selected.script_text || 'None entered'}</p>
                  )}
                </section>

                {sections.map((s, i) => {
                  const parts = s.inline && s.lines.length === 1 && s.lines[0].includes('; ') ? s.lines[0].split('; ') : null;
                  return (
                    <section key={`${s.h}-${i}`} className="am-section">
                      <h3>{s.h}</h3>
                      {parts ? (
                        <ul className="amo-list">{parts.map((p, j) => <li key={j}>{p}</li>)}</ul>
                      ) : s.lines.map((l, j) => <p key={j}>{l}</p>)}
                    </section>
                  );
                })}
              </div>

              <div className="am-actionbar">
                {ugcScript && !scriptDraft.trim() && <p className="amo-hint">Add the script above to approve.</p>}
                <div className="am-actionbar-row">
                  <button type="button" className="am-btn am-btn--danger" disabled={busy} onClick={() => setRejectOpen(true)}>
                    <XCircle size={18} /> Reject
                  </button>
                  <button
                    type="button"
                    className="am-btn am-btn--primary"
                    disabled={busy || (ugcScript && !scriptDraft.trim())}
                    onClick={() => decide(() => handleApprove(selected.id, ugcScript ? scriptDraft.trim() : undefined))}
                    data-testid="brief-approve"
                  >
                    <CheckCircle size={18} /> {busy && !rejectOpen ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {selected && rejectOpen && (
            <>
              <div className="am-sheet-backdrop" onClick={() => !busy && setRejectOpen(false)} />
              <section className="am-sheet" role="dialog" aria-modal="true" aria-labelledby="amo-reject-title">
                <div className="am-sheet-head">
                  <h2 id="amo-reject-title">Reject this brief?</h2>
                  <button type="button" className="am-icon-btn" onClick={() => setRejectOpen(false)} disabled={busy} aria-label="Close"><X size={20} /></button>
                </div>
                <div className="am-sheet-body">
                  <p className="am-muted">
                    <strong>{selected.title}</strong> from {brandName(selected)} will be rejected with the reason “{REJECT_REASON}”.
                  </p>
                </div>
                <div className="am-sheet-foot">
                  <button type="button" className="am-btn am-btn--secondary" onClick={() => setRejectOpen(false)} disabled={busy}>Cancel</button>
                  <button type="button" className="am-btn am-btn--danger" disabled={busy} onClick={() => decide(() => handleReject(selected.id))} data-testid="brief-reject-confirm">
                    {busy ? 'Rejecting…' : 'Reject brief'}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="ac-container">
        <div className="ac-header">
          <div>
            <h1><Briefcase size={26} /> Pending Campaign Approvals</h1>
            <p>Review and approve new brand campaigns before they go live</p>
          </div>
          <div className="ac-stat">
            <span>Pending</span>
            <strong>{pendingCampaigns.length}</strong>
          </div>
        </div>

        {loading ? (
          <div className="ac-empty">Loading campaigns...</div>
        ) : pendingCampaigns.length === 0 ? (
          <div className="ac-empty">
            <CheckCircle size={64} color="#22c55e" />
            <p>No pending campaign approvals</p>
            <span>All caught up - new submissions will appear here.</span>
          </div>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Budget</th>
                  <th>Category</th>
                  <th>Objective</th>
                  <th>Shipment</th>
                  <th>Status</th>
                  <th className="ac-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingCampaigns.map((campaign, i) => (
                  <tr
                    key={campaign.id || campaign._id || `campaign-${i}`}
                    data-testid={`campaign-${campaign.id}`}
                    onClick={() => openModal(campaign)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') openModal(campaign); }}
                  >
                    <td className="ac-td-title" data-label="Campaign">
                      <strong>{campaign.title}</strong>
                      <small>{brandName(campaign)}</small>
                      {campaign.script_provider === 'ugc' && !campaign.script_text && (
                        <em className="ac-needs-script">Needs script - open to add</em>
                      )}
                    </td>
                    <td data-label="Budget">₹{campaign.budget_min} - ₹{campaign.budget_max}</td>
                    <td data-label="Category">{campaign.product_category || campaign.category || '-'}</td>
                    <td data-label="Objective">{campaign.objectives?.join(', ') || '-'}</td>
                    <td data-label="Shipment">{campaign.requires_shipment ? 'Required' : 'Not required'}</td>
                    <td data-label="Status"><span className="ac-badge">{String(campaign.status || '').replace('_', ' ')}</span></td>
                    <td className="ac-td-actions">
                      <button type="button" className="ac-btn-view" title="View full brief" aria-label="View full brief" onClick={(e) => { e.stopPropagation(); openModal(campaign); }}>
                        <Eye size={18} />
                      </button>
                      <button
                        className="ac-btn ac-btn-approve"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (campaign.script_provider === 'ugc' && !campaign.script_text) { openModal(campaign); return; }
                          handleApprove(campaign.id);
                        }}
                        data-testid={`approve-campaign-${campaign.id}`}
                      >
                        <CheckCircle size={18} /> Approve
                      </button>
                      <button className="ac-btn ac-btn-reject" onClick={(e) => { e.stopPropagation(); handleReject(campaign.id); }} data-testid={`reject-campaign-${campaign.id}`}>
                        <XCircle size={18} /> Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="ac-overlay" onClick={() => setSelected(null)}>
          <div className="ac-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ac-modal-x" aria-label="Close" onClick={() => setSelected(null)}><X size={20} /></button>
            <div className="ac-modal-head">
              <h2>{selected.title}</h2>
              <span className="ac-badge">{String(selected.status || '').replace('_', ' ')}</span>
            </div>
            <div className="ac-modal-body">
              <div className="ac-row"><label>Business</label><span>{brandName(selected)}</span></div>
              <div className="ac-row"><label>Budget</label><span>₹{selected.budget_min} - ₹{selected.budget_max}</span></div>
              {selected.product_category && <div className="ac-row"><label>Category</label><span>{selected.product_category}</span></div>}
              {selected.product_name && <div className="ac-row"><label>Product</label><span>{selected.product_name}</span></div>}
              {selected.product_description && <div className="ac-row"><label>Product description</label><span>{selected.product_description}</span></div>}
              {selected.campaign_hook && <div className="ac-row"><label>Hook</label><span>{selected.campaign_hook}</span></div>}
              {selected.key_message && <div className="ac-row"><label>Key message</label><span>{selected.key_message}</span></div>}
              {selected.objectives?.length > 0 && <div className="ac-row"><label>Objectives</label><span>{selected.objectives.join(', ')}</span></div>}
              {Array.isArray(selected.deliverable_items) && selected.deliverable_items.length > 0 && (
                <div className="ac-row"><label>Deliverables</label><span>{selected.deliverable_items.map((d) => `${d.quantity || 1} × ${d.type || '-'}${d.edited_required ? ` (edited by ${d.edited_by === 'ugc' ? 'UGC.ad' : 'creator'})` : ''}`).join(', ')}</span></div>
              )}
              {selected.script_provider === 'ugc' ? (
                <div className="ac-row">
                  <label>Script *</label>
                  <div>
                    <textarea
                      className="ac-script-input"
                      rows={6}
                      value={scriptDraft}
                      onChange={(e) => setScriptDraft(e.target.value)}
                      placeholder="Write the script for the creator..."
                    />
                    <small className="ac-script-hint">Required - this brief can't be approved until a script is added.</small>
                  </div>
                </div>
              ) : (
                <div className="ac-row"><label>Script</label><span>{selected.script_text || 'None entered'}</span></div>
              )}
              {Array.isArray(selected.usage_platforms) && selected.usage_platforms.length > 0 && (
                <div className="ac-row"><label>Platforms</label><span>{selected.usage_platforms.join(', ')}</span></div>
              )}
              <div className="ac-row"><label>Requires shipment</label><span>{selected.requires_shipment ? 'Yes' : 'No'}</span></div>
              {selected.brief_text && (
                <div className="ac-row"><label>Full brief</label>
                  <span className="ac-brieffull">
                    {String(selected.brief_text).split('\n').map((line, i) => {
                      const idx = line.indexOf(':');
                      if (idx > 0 && idx <= 40) {
                        return <span key={i} className="ac-bl ac-bl-h"><b>{line.slice(0, idx + 1)}</b><span className="ac-blv">{line.slice(idx + 1).trim()}</span></span>;
                      }
                      return <span key={i} className="ac-bl">{line || ' '}</span>;
                    })}
                  </span>
                </div>
              )}
            </div>
            <div className="ac-modal-actions">
              <button
                className="ac-btn ac-btn-approve"
                disabled={selected.script_provider === 'ugc' && !scriptDraft.trim()}
                onClick={() => { handleApprove(selected.id, selected.script_provider === 'ugc' ? scriptDraft.trim() : undefined); setSelected(null); }}
              >
                <CheckCircle size={18} /> Approve
              </button>
              <button className="ac-btn ac-btn-reject" onClick={() => { handleReject(selected.id); setSelected(null); }}><XCircle size={18} /> Reject</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .ac-container { padding: 20px 24px 32px; max-width: 1540px; margin: 0 auto; }
        .ac-header { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-bottom: 16px; flex-wrap: wrap; padding: 15px 18px; background: #fff; border: 1px solid #e8ecff; border-radius: 13px; }
        .ac-header h1 { display: flex; align-items: center; gap: 9px; font-size: 1.2rem; font-weight: 700; color: #07074e; margin: 0 0 3px; }
        .ac-header h1 :global(svg) { color: #07074e; }
        .ac-header p { color: #718096; margin: 0; font-size: 0.8rem; }
        .ac-stat { background: #f6f7ff; border: 1px solid #dfe3ff; padding: 7px 10px 7px 12px; border-radius: 9px; display: flex; flex-direction: row; align-items: center; gap: 10px; min-width: 0; }
        .ac-stat span { font-size: 0.68rem; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
        .ac-stat strong { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 50%; background: #07074e; font-size: 0.78rem; color: #fff; margin: 0; }
        .ac-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 24px; background: white; border-radius: 16px; color: #4a5568; text-align: center; }
        .ac-empty p { margin: 0; font-size: 1.1rem; font-weight: 600; color: #1a202c; }
        .ac-empty span { color: #94a3b8; font-size: 0.9rem; }
        .ac-table-wrap { width: 100%; min-width: 0; background: #fff; border: 1px solid #e8ecff; border-radius: 13px; overflow: hidden; }
        .ac-table { width: 100%; border-collapse: collapse; table-layout: auto; }
        .ac-table th { text-align: left; padding: 11px 14px; font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #9296ba; background: #fafbff; border-bottom: 1px solid #e8ecff; white-space: nowrap; }
        .ac-table td { padding: 13px 14px; font-size: 0.82rem; color: #1a202c; border-bottom: 1px solid #f0f2fb; vertical-align: middle; overflow-wrap: anywhere; }
        .ac-table tbody tr { cursor: pointer; border-left: 4px solid #f59e0b; }
        .ac-table tbody tr:hover { background: #f8f9ff; }
        .ac-table tbody tr:last-child td { border-bottom: 0; }
        .ac-td-title strong { display: block; font-size: 0.95rem; font-weight: 700; color: #07074e; }
        .ac-td-title small { display: block; margin-top: 3px; color: #718096; font-size: 0.75rem; }
        .ac-needs-script { display: inline-block; margin-top: 6px; font-style: normal; font-size: 0.7rem; font-weight: 700; color: #92400e; background: #fef3c7; padding: 2px 8px; border-radius: 6px; }
        .ac-th-actions { text-align: right; }
        .ac-td-actions { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
        .ac-td-actions .ac-btn { flex: 0 0 auto; padding: 9px 13px; }
        .ac-badge { font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: #fef3c7; color: #92400e; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
        .ac-script-input { width: 100%; border: 1px solid #dfe3f3; border-radius: 10px; padding: 10px 12px; font-family: inherit; font-size: 0.9rem; color: #1a202c; resize: vertical; }
        .ac-script-input:focus { outline: none; border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,.14); }
        .ac-script-hint { display: block; margin-top: 6px; color: #92400e; font-size: 0.75rem; }
        .ac-btn-approve:disabled { opacity: .5; cursor: not-allowed; }
        .ac-btn-approve:disabled:hover { background: #dcfce7; color: #166534; }
        .ac-view { grid-column: 1 / -1; width: max-content; display: inline-flex; padding: 0; margin-top: 2px; border: 0; background: transparent; font-family: inherit; font-size: 0.72rem; font-weight: 700; color: #5b6bff; cursor: pointer; }
        .ac-view:hover { color: #07074e; }
        .ac-list { margin: 4px 0 6px; padding-left: 18px; }
        .ac-btn-view { flex: none; width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid #dfe3f3; border-radius: 10px; background: #fff; color: #07074e; cursor: pointer; }
        .ac-btn-view:hover { border-color: #5b6bff; background: #f3f4ff; }

        /* full-detail modal */
        .ac-overlay { position: fixed; inset: 0; z-index: 1300; background: rgba(7,7,78,0.5); backdrop-filter: blur(3px); display: flex; align-items: stretch; justify-content: flex-end; }
        .ac-modal { position: relative; width: min(560px, 100%); height: 100vh; overflow-y: auto; background: #fff; border-radius: 18px 0 0 18px; box-shadow: -20px 0 60px rgba(7,7,78,0.3); padding: 26px 28px; animation: ac-slide .24s cubic-bezier(.2,.7,.2,1); }
        @keyframes ac-slide { from { transform: translateX(30px); opacity: .6; } to { transform: none; opacity: 1; } }
        .ac-modal-x { position: absolute; top: 16px; right: 16px; width: 34px; height: 34px; border: none; background: #f1f3fa; color: #07074e; border-radius: 10px; display: grid; place-items: center; cursor: pointer; }
        .ac-modal-x:hover { background: #e7eaf5; }
        .ac-modal-head { display: flex; align-items: center; gap: 12px; padding-right: 40px; margin-bottom: 18px; }
        .ac-modal-head h2 { margin: 0; font-size: 1.3rem; font-weight: 800; color: #07074e; overflow-wrap: anywhere; }
        .ac-modal-body { display: flex; flex-direction: column; gap: 12px; }
        .ac-row { display: grid; grid-template-columns: 150px 1fr; gap: 12px; align-items: start; }
        .ac-row label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #9296ba; padding-top: 2px; }
        .ac-row span { font-size: 0.9rem; color: #1a202c; overflow-wrap: anywhere; word-break: break-word; }
        .ac-brieffull { display: flex; flex-direction: column; gap: 2px; line-height: 1.5; }
        .ac-bl { overflow-wrap: anywhere; word-break: break-word; color: #4a5568; }
        /* labeled lines: heading on its own line, value below, gap before next */
        .ac-bl-h { display: block; margin-bottom: 12px; }
        .ac-bl-h b { display: block; color: #07074e; font-weight: 700; margin-bottom: 3px; }
        .ac-blv { display: block; color: #4a5568; }
        .ac-modal-actions { display: flex; gap: 10px; margin-top: 22px; }
        @media (max-width: 560px) { .ac-row { grid-template-columns: 1fr; gap: 2px; } }
        .ac-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; border: none; border-radius: 10px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease; }
        .ac-btn-approve { background: #dcfce7; color: #166534; }
        .ac-btn-approve:hover { background: #16a34a; color: #fff; }
        .ac-btn-reject { background: #fee2e2; color: #991b1b; }
        .ac-btn-reject:hover { background: #dc2626; color: #fff; }
        .ac-container { min-width: 0; max-width: 100%; box-sizing: border-box; }
        @media (max-width: 860px) {
          .ac-container { padding: 14px 12px 28px; }
          .ac-header { flex-direction: column; align-items: stretch; }
          /* Table -> one full-width block per brief; each cell carries its own label. */
          .ac-table-wrap { border-left: 0; border-right: 0; border-radius: 0; background: transparent; }
          .ac-table, .ac-table tbody, .ac-table tr, .ac-table td { display: block; width: 100%; box-sizing: border-box; }
          .ac-table thead { display: none; }
          .ac-table tbody tr { background: #fff; border-left: 4px solid #f59e0b; border-bottom: 1px solid #e8ecff; padding: 12px 14px; }
          .ac-table td { border: 0; padding: 5px 0; display: flex; justify-content: space-between; gap: 14px; text-align: right; }
          .ac-table td::before { content: attr(data-label); flex: none; font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #9296ba; text-align: left; padding-top: 2px; }
          .ac-table td.ac-td-title { display: block; text-align: left; padding-bottom: 8px; }
          .ac-table td.ac-td-title::before { content: none; }
          .ac-table td.ac-td-actions { display: flex; flex-wrap: wrap; justify-content: stretch; padding-top: 10px; }
          .ac-table td.ac-td-actions::before { content: none; }
          .ac-td-actions .ac-btn { flex: 1 1 110px; }
        }
      `}</style>
    </AdminLayout>
  );
}
