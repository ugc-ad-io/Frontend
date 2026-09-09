import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Briefcase, PauseCircle, PlayCircle, Ban, Trash2, X } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { useAuth } from '../App';
import { can } from '../utils/adminRoles';
import { apiErrorMessage } from '../utils/apiError';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Show the business's real company name — never their @username handle
// (business_nickname / brand_handle are the handle sources, so they're excluded).
const brandName = (c) => String(c?.brand_name || c?.business_name || c?.company_name || '').replace(/^@+/, '').trim() || '—';

// Mirrors MODERATABLE_CAMPAIGN_STATUSES in the backend (server.py). Only a live brief
// can be held or banned; anything already finished is rejected there with a 400, so
// the buttons are not offered for it here either.
const MODERATABLE = ['active', 'in_progress', 'pending_approval', 'work_submitted'];

// What each action does, in the admin's words. `destructive` drives the red styling
// and forces the reason box to be filled before the button enables.
const MOD_ACTIONS = {
  pause: {
    label: 'Hold', verb: 'Hold this campaign',
    blurb: 'Freezes the brief. Creators cannot bid while it is held, and you can lift it again at any time.',
  },
  resume: {
    label: 'Resume', verb: 'Resume this campaign',
    blurb: 'Lifts the hold and restores whatever status the brief had before it was held.',
  },
  ban: {
    label: 'Ban', verb: 'Ban this campaign', destructive: true,
    blurb: 'Terminal - the brief cannot be resumed. Any money already held in escrow stays put so you can release or refund it yourself.',
  },
  delete: {
    label: 'Delete', verb: 'Delete this campaign', destructive: true,
    blurb: 'Permanently removes the brief and its child records. Blocked while escrow is still reserved or held - ban it and settle the money first.',
  },
};

export default function AdminAllCampaigns() {
  const { user } = useAuth();
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  // The campaign+action awaiting confirmation, e.g. { campaign, action: 'ban' }.
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  // Hold/resume/ban need review_applications; delete needs ban_users AND the founder
  // role (the backend enforces both - see admin_delete_campaign). Gating here keeps an
  // ops user from clicking a button that can only ever come back as a 403.
  const canModerate = can(user, 'review_applications', 'edit');
  const canDelete = can(user, 'ban_users', 'edit');

  // Which buttons make sense for this campaign's current state.
  const actionsFor = (c) => {
    const st = c.status;
    const acts = [];
    if (canModerate) {
      if (st === 'paused') acts.push('resume', 'ban');
      else if (st !== 'banned' && MODERATABLE.includes(st)) acts.push('pause', 'ban');
    }
    if (canDelete) acts.push('delete');
    return acts;
  };

  const runAction = async () => {
    if (!pending) return;
    const { campaign, action } = pending;
    const id = campaign.id;
    setBusy(true);
    try {
      let res;
      if (action === 'delete') {
        res = await axios.delete(`${API}/admin/campaigns/${id}`);
      } else {
        res = await axios.post(`${API}/admin/campaigns/${id}/${action}`, { reason: reason.trim() });
      }
      // Ban leaves held escrow alone on purpose, and says so in the response. Surface
      // that rather than letting an admin assume the money settled itself.
      if (res.data?.escrow_needs_manual_release) {
        toast.warning('Campaign banned — escrow still held', {
          description: `The ${res.data.escrow_status || 'held'} escrow was NOT refunded. Release or refund it from Financials.`,
          duration: 10000,
        });
      } else {
        toast.success(res.data?.message || (action === 'delete' ? 'Campaign deleted' : 'Done'));
      }
      setPending(null);
      setReason('');
      fetchAllCampaigns();
    } catch (e) {
      // The backend returns a specific 400 when escrow blocks a delete. apiErrorMessage
      // pulls `detail` out, so the admin reads the real reason, not a generic failure.
      toast.error(apiErrorMessage(e, 'Could not complete that action'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    fetchAllCampaigns();
  }, []);

  const fetchAllCampaigns = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/campaigns`);
      setAllCampaigns(response.data);
    } catch {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter
    ? allCampaigns.filter(c =>
        c.title?.toLowerCase().includes(filter.toLowerCase()) ||
        brandName(c).toLowerCase().includes(filter.toLowerCase()) ||
        c.status?.toLowerCase().includes(filter.toLowerCase())
      )
    : allCampaigns;

  const statusCounts = {
    active: allCampaigns.filter(c => c.status === 'active').length,
    pending: allCampaigns.filter(c => c.status === 'pending_approval').length,
    completed: allCampaigns.filter(c => c.status === 'completed').length,
  };

  return (
    <AdminLayout>
      <div className="aac-container">
        <div className="aac-header">
          <div>
            <h1><Briefcase size={26} /> All Campaigns</h1>
            <p>View every campaign on the platform — across all statuses</p>
          </div>
          <div className="aac-stats">
            <div className="aac-stat"><span>Total</span><strong>{allCampaigns.length}</strong></div>
            <div className="aac-stat"><span>Active</span><strong>{statusCounts.active}</strong></div>
            <div className="aac-stat"><span>Pending</span><strong>{statusCounts.pending}</strong></div>
            <div className="aac-stat"><span>Completed</span><strong>{statusCounts.completed}</strong></div>
          </div>
        </div>

        <input
          type="text"
          className="aac-search"
          placeholder="Search by title, business, or status..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        {loading ? (
          <div className="aac-empty">Loading campaigns...</div>
        ) : filtered.length === 0 ? (
          <div className="aac-empty">
            <Briefcase size={64} color="#94a3b8" />
            <p>{filter ? `No campaigns match "${filter}"` : 'No campaigns found'}</p>
          </div>
        ) : (
          <div className="aac-grid">
            {filtered.map(c => (
              <article key={c.id} className="aac-card" data-testid={`allcampaign-${c.id}`}>
                <div className="aac-card-head">
                  <h3>{c.title}</h3>
                  <span className={`aac-badge aac-badge-${c.status}`}>{c.status?.replace('_', ' ')}</span>
                </div>
                <div className="aac-card-body">
                  <p><strong>Business:</strong> {brandName(c)}</p>
                  <p><strong>Budget:</strong> ₹{c.budget_min} - ₹{c.budget_max}</p>
                  <p><strong>Brief:</strong> {c.brief_text?.substring(0, 150)}{c.brief_text?.length > 150 ? '...' : ''}</p>
                  <p><strong>Created:</strong> {new Date(c.created_at).toLocaleDateString()}</p>
                  {c.status === 'paused' && c.pause_reason && (
                    <p className="aac-reason"><strong>On hold:</strong> {c.pause_reason}</p>
                  )}
                  {c.status === 'banned' && c.ban_reason && (
                    <p className="aac-reason"><strong>Banned:</strong> {c.ban_reason}</p>
                  )}
                </div>
                {actionsFor(c).length > 0 && (
                  <div className="aac-card-actions">
                    {actionsFor(c).map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={`aac-act${MOD_ACTIONS[a].destructive ? ' is-danger' : ''}`}
                        onClick={() => { setPending({ campaign: c, action: a }); setReason(''); }}
                        data-testid={`campaign-${a}-${c.id}`}
                      >
                        {a === 'pause' && <PauseCircle size={14} />}
                        {a === 'resume' && <PlayCircle size={14} />}
                        {a === 'ban' && <Ban size={14} />}
                        {a === 'delete' && <Trash2 size={14} />}
                        {MOD_ACTIONS[a].label}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {pending && (
        <div className="aac-modal-backdrop" onClick={() => !busy && setPending(null)}>
          <div className="aac-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aac-modal-head">
              <h3>{MOD_ACTIONS[pending.action].verb}</h3>
              <button type="button" onClick={() => setPending(null)} disabled={busy} aria-label="Close"><X size={18} /></button>
            </div>
            <p className="aac-modal-name">{pending.campaign.title} · {brandName(pending.campaign)}</p>
            <p className="aac-modal-blurb">{MOD_ACTIONS[pending.action].blurb}</p>
            {pending.action !== 'delete' && (
              <label className="aac-modal-label">
                Reason {MOD_ACTIONS[pending.action].destructive ? '(required)' : '(optional)'}
                <textarea
                  className="aac-modal-input"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="This is written to the audit log and sent to the brand."
                />
              </label>
            )}
            <div className="aac-modal-actions">
              <button type="button" className="aac-modal-cancel" onClick={() => setPending(null)} disabled={busy}>Cancel</button>
              <button
                type="button"
                className={`aac-modal-go${MOD_ACTIONS[pending.action].destructive ? ' is-danger' : ''}`}
                onClick={runAction}
                /* A destructive action must carry a reason. Delete has no reason box -
                   it is logged with the campaign snapshot instead - so it is exempt. */
                disabled={busy || (MOD_ACTIONS[pending.action].destructive && pending.action !== 'delete' && !reason.trim())}
                data-testid="confirm-moderation"
              >
                {busy ? 'Working…' : MOD_ACTIONS[pending.action].label}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .aac-container { padding: 32px 40px; max-width: 1480px; margin: 0 auto; }
        .aac-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
        .aac-header h1 { display: flex; align-items: center; gap: 12px; font-size: 1.75rem; font-weight: 700; color: #07074e; margin: 0 0 6px; }
        .aac-header h1 :global(svg) { color: #07074e; }
        .aac-header p { color: #718096; margin: 0; font-size: 0.95rem; }
        .aac-stats { display: flex; gap: 12px; flex-wrap: wrap; }
        .aac-stat { background: white; border: 1.5px solid #e8ecff; padding: 12px 18px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; min-width: 90px; }
        .aac-stat span { font-size: 0.72rem; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .aac-stat strong { font-size: 1.3rem; color: #07074e; margin-top: 4px; }
        .aac-search { width: 100%; padding: 12px 18px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-size: 0.95rem; margin-bottom: 24px; }
        .aac-search:focus { outline: none; border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,0.16); }
        .aac-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 24px; background: white; border-radius: 16px; color: #4a5568; text-align: center; }
        .aac-empty p { margin: 0; font-size: 1.05rem; font-weight: 600; color: #1a202c; }
        .aac-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
        .aac-card { background: white; border: 1.5px solid #e8ecff; border-radius: 14px; padding: 20px; transition: all 0.2s ease; }
        .aac-card:hover { border-color: #c5c5e0; box-shadow: 0 4px 16px rgba(7,7,78,0.08); }
        .aac-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
        .aac-card-head h3 { font-size: 1.02rem; font-weight: 700; color: #07074e; margin: 0; }
        .aac-badge { font-size: 0.68rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; background: #f1f5f9; color: #475569; }
        .aac-badge-active { background: #dcfce7; color: #166534; }
        .aac-badge-pending_approval { background: #fef3c7; color: #92400e; }
        .aac-badge-completed { background: #dbeafe; color: #1e40af; }
        .aac-badge-rejected { background: #fee2e2; color: #991b1b; }
        /* The two states the moderation endpoints introduce. Amber reads as "frozen,
           reversible"; slate-black as "terminal", so the two are never confused at a
           glance with the green/red of active and rejected. */
        .aac-badge-paused { background: #fef3c7; color: #92400e; }
        .aac-badge-banned { background: #1f2937; color: #f9fafb; }
        .aac-reason { margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 0.8rem; }
        .aac-card-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #eef1f8; }
        .aac-act { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 9px;
          border: 1.5px solid #d6dbff; background: #fff; color: #4452f0; font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
        .aac-act:hover { background: #eef0ff; }
        .aac-act.is-danger { border-color: #fecaca; color: #b91c1c; }
        .aac-act.is-danger:hover { background: #fef2f2; }

        .aac-modal-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(7,7,78,0.42);
          display: flex; align-items: center; justify-content: center; padding: 20px; }
        .aac-modal { width: 100%; max-width: 460px; background: #fff; border-radius: 16px; padding: 22px;
          box-shadow: 0 24px 60px rgba(7,7,78,0.28); }
        .aac-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .aac-modal-head h3 { margin: 0; font-size: 1.05rem; color: #07074e; }
        .aac-modal-head button { border: 0; background: none; cursor: pointer; color: #64748b; padding: 0; }
        .aac-modal-name { margin: 6px 0 0; font-size: 0.86rem; font-weight: 600; color: #1a202c; }
        .aac-modal-blurb { margin: 10px 0 14px; font-size: 0.84rem; line-height: 1.55; color: #4a5568; }
        .aac-modal-label { display: block; font-size: 0.76rem; font-weight: 700; letter-spacing: 0.04em;
          text-transform: uppercase; color: #718096; }
        .aac-modal-input { width: 100%; margin-top: 6px; padding: 10px 12px; border: 1.5px solid #e2e8f0;
          border-radius: 10px; font: inherit; font-size: 0.88rem; resize: vertical; }
        .aac-modal-input:focus { outline: none; border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,0.16); }
        .aac-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
        .aac-modal-cancel { padding: 9px 16px; border-radius: 10px; border: 1.5px solid #e2e8f0; background: #fff;
          font: inherit; font-weight: 600; font-size: 0.86rem; cursor: pointer; }
        .aac-modal-go { padding: 9px 18px; border-radius: 10px; border: 0; background: #07074e; color: #fff;
          font: inherit; font-weight: 700; font-size: 0.86rem; cursor: pointer; }
        .aac-modal-go.is-danger { background: #b91c1c; }
        .aac-modal-go:disabled, .aac-modal-cancel:disabled { opacity: 0.55; cursor: not-allowed; }
        .aac-card-body { font-size: 0.85rem; color: #4a5568; line-height: 1.6; }
        .aac-card-body p { margin: 0 0 6px; }
        .aac-card-body strong { color: #1a202c; font-weight: 600; }
        @media (max-width: 720px) {
          .aac-container { padding: 20px; }
          .aac-header { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </AdminLayout>
  );
}
