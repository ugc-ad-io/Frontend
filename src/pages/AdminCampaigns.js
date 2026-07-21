import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Briefcase, X } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Show the business's real company name — never their @username handle
// (business_nickname / brand_handle are the handle sources, so they're excluded).
const brandName = (c) => String(c?.brand_name || c?.business_name || c?.company_name || '').replace(/^@+/, '').trim() || '—';

export default function AdminCampaigns() {
  const [pendingCampaigns, setPendingCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
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

  const handleApprove = async (id) => {
    try {
      await axios.post(`${API}/admin/approve-campaign`, { item_id: id, action: 'approve' });
      toast.success('Campaign approved successfully');
      fetchPendingCampaigns();
    } catch {
      toast.error('Failed to approve campaign');
    }
  };

  const handleReject = async (id) => {
    try {
      await axios.post(`${API}/admin/approve-campaign`, {
        item_id: id, action: 'reject', reason: 'Campaign does not meet guidelines'
      });
      toast.success('Campaign rejected');
      fetchPendingCampaigns();
    } catch {
      toast.error('Failed to reject campaign');
    }
  };

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
            <span>All caught up — new submissions will appear here.</span>
          </div>
        ) : (
          <div className="ac-grid">
            {pendingCampaigns.map(campaign => (
              <article
                key={campaign.id}
                className="ac-card"
                data-testid={`campaign-${campaign.id}`}
                onClick={() => setSelected(campaign)}
                role="button"
                tabIndex={0}
              >
                <div className="ac-card-head">
                  <h3>{campaign.title}</h3>
                  <span className="ac-badge">{campaign.status.replace('_', ' ')}</span>
                </div>
                <div className="ac-card-body">
                  <p><strong>Business:</strong> {brandName(campaign)}</p>
                  <p><strong>Budget:</strong> ₹{campaign.budget_min} - ₹{campaign.budget_max}</p>
                  <p className="ac-brief"><strong>Brief:</strong> {campaign.brief_text || '—'}</p>
                  {campaign.objectives?.length > 0 && (
                    <p><strong>Objectives:</strong> {campaign.objectives.join(', ')}</p>
                  )}
                  <p><strong>Requires Shipment:</strong> {campaign.requires_shipment ? 'Yes' : 'No'}</p>
                  <span className="ac-view">Click to view full details →</span>
                </div>
                <div className="ac-card-actions">
                  <button className="ac-btn ac-btn-approve" onClick={(e) => { e.stopPropagation(); handleApprove(campaign.id); }} data-testid={`approve-campaign-${campaign.id}`}>
                    <CheckCircle size={18} /> Approve
                  </button>
                  <button className="ac-btn ac-btn-reject" onClick={(e) => { e.stopPropagation(); handleReject(campaign.id); }} data-testid={`reject-campaign-${campaign.id}`}>
                    <XCircle size={18} /> Reject
                  </button>
                </div>
              </article>
            ))}
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
                <div className="ac-row"><label>Deliverables</label><span>{selected.deliverable_items.map((d) => `${d.quantity || 1} × ${d.type || '—'}`).join(', ')}</span></div>
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
              <button className="ac-btn ac-btn-approve" onClick={() => { handleApprove(selected.id); setSelected(null); }}><CheckCircle size={18} /> Approve</button>
              <button className="ac-btn ac-btn-reject" onClick={() => { handleReject(selected.id); setSelected(null); }}><XCircle size={18} /> Reject</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .ac-container { padding: 32px 40px; max-width: 1480px; margin: 0 auto; }
        .ac-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
        .ac-header h1 { display: flex; align-items: center; gap: 12px; font-size: 1.75rem; font-weight: 700; color: #07074e; margin: 0 0 6px; }
        .ac-header h1 :global(svg) { color: #07074e; }
        .ac-header p { color: #718096; margin: 0; font-size: 0.95rem; }
        .ac-stat { background: white; border: 1.5px solid #e8ecff; padding: 14px 22px; border-radius: 14px; display: flex; flex-direction: column; align-items: center; min-width: 110px; }
        .ac-stat span { font-size: 0.75rem; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .ac-stat strong { font-size: 1.5rem; color: #07074e; margin-top: 4px; }
        .ac-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 24px; background: white; border-radius: 16px; color: #4a5568; text-align: center; }
        .ac-empty p { margin: 0; font-size: 1.1rem; font-weight: 600; color: #1a202c; }
        .ac-empty span { color: #94a3b8; font-size: 0.9rem; }
        .ac-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
        .ac-card { background: white; border: 1.5px solid #e8ecff; border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 16px; transition: all 0.2s ease; cursor: pointer; min-width: 0; overflow: hidden; }
        .ac-card:hover { border-color: #c5c5e0; box-shadow: 0 4px 16px rgba(7,7,78,0.08); transform: translateY(-2px); }
        .ac-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .ac-card-head h3 { font-size: 1.05rem; font-weight: 700; color: #07074e; margin: 0; min-width: 0; overflow-wrap: anywhere; }
        .ac-badge { font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: #fef3c7; color: #92400e; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; flex: none; }
        .ac-card-body { font-size: 0.85rem; color: #4a5568; line-height: 1.6; min-width: 0; }
        /* wrap long unbroken strings so text never spills out of the card */
        .ac-card-body p { margin: 0 0 6px; overflow-wrap: anywhere; word-break: break-word; }
        .ac-card-body strong { color: #1a202c; font-weight: 600; }
        .ac-brief { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ac-view { display: inline-block; margin-top: 6px; font-size: 0.78rem; font-weight: 700; color: #5b6bff; }
        .ac-list { margin: 4px 0 6px; padding-left: 18px; }
        .ac-card-actions { display: flex; gap: 10px; margin-top: auto; }

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
        @media (max-width: 720px) {
          .ac-container { padding: 20px; }
          .ac-header { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </AdminLayout>
  );
}
