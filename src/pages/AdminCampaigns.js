import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Briefcase } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminCampaigns() {
  const [pendingCampaigns, setPendingCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

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
              <article key={campaign.id} className="ac-card" data-testid={`campaign-${campaign.id}`}>
                <div className="ac-card-head">
                  <h3>{campaign.title}</h3>
                  <span className="ac-badge">{campaign.status.replace('_', ' ')}</span>
                </div>
                <div className="ac-card-body">
                  <p><strong>Business:</strong> {campaign.business_nickname}</p>
                  <p><strong>Budget:</strong> ${campaign.budget_min} - ${campaign.budget_max}</p>
                  <p><strong>Brief:</strong> {campaign.brief_text?.substring(0, 150)}{campaign.brief_text?.length > 150 ? '...' : ''}</p>
                  {campaign.objectives?.length > 0 && (
                    <>
                      <p><strong>Objectives:</strong></p>
                      <ul className="ac-list">
                        {campaign.objectives.map((obj, idx) => <li key={idx}>{obj}</li>)}
                      </ul>
                    </>
                  )}
                  <p><strong>Requires Shipment:</strong> {campaign.requires_shipment ? 'Yes' : 'No'}</p>
                </div>
                <div className="ac-card-actions">
                  <button className="ac-btn ac-btn-approve" onClick={() => handleApprove(campaign.id)} data-testid={`approve-campaign-${campaign.id}`}>
                    <CheckCircle size={18} /> Approve
                  </button>
                  <button className="ac-btn ac-btn-reject" onClick={() => handleReject(campaign.id)} data-testid={`reject-campaign-${campaign.id}`}>
                    <XCircle size={18} /> Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
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
        .ac-card { background: white; border: 1.5px solid #e8ecff; border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 16px; transition: all 0.2s ease; }
        .ac-card:hover { border-color: #c5c5e0; box-shadow: 0 4px 16px rgba(7,7,78,0.08); }
        .ac-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .ac-card-head h3 { font-size: 1.05rem; font-weight: 700; color: #07074e; margin: 0; }
        .ac-badge { font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: #fef3c7; color: #92400e; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
        .ac-card-body { font-size: 0.85rem; color: #4a5568; line-height: 1.6; }
        .ac-card-body p { margin: 0 0 6px; }
        .ac-card-body strong { color: #1a202c; font-weight: 600; }
        .ac-list { margin: 4px 0 6px; padding-left: 18px; }
        .ac-card-actions { display: flex; gap: 10px; margin-top: auto; }
        .ac-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; border: none; border-radius: 10px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease; }
        .ac-btn-approve { background: #dcfce7; color: #166534; }
        .ac-btn-approve:hover { background: #bbf7d0; }
        .ac-btn-reject { background: #fee2e2; color: #991b1b; }
        .ac-btn-reject:hover { background: #fecaca; }
        @media (max-width: 720px) {
          .ac-container { padding: 20px; }
          .ac-header { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </AdminLayout>
  );
}
