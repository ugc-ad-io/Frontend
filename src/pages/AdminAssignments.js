import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { UserPlus, X } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

export default function AdminAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedManager, setSelectedManager] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [assignRes, campRes] = await Promise.all([
        axios.get(`${API}/admin/campaign-assignments`),
        axios.get(`${API}/campaigns`)
      ]);
      setAssignments(assignRes.data);
      setAllCampaigns(campRes.data);
    } catch {
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedCampaign || !selectedManager) {
      toast.error('Please select a manager');
      return;
    }
    try {
      const response = await axios.post(
        `${API}/admin/assign-campaign?campaign_id=${selectedCampaign.id}&manager_id=${selectedManager}`
      );
      toast.success(response.data.message);
      setShowAssignModal(false);
      setSelectedCampaign(null);
      setSelectedManager('');
      fetchAll();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to assign campaign'));
    }
  };

  const unassigned = allCampaigns.filter(c => !c.assigned_manager && c.status === 'active');

  return (
    <AdminLayout>
      <div className="aas-container">
        <div className="aas-header">
          <div>
            <h1><UserPlus size={26} /> Campaign Manager Assignments</h1>
            <p>Auto-assigns 10 campaigns per manager. Manually reassign as needed.</p>
          </div>
          <div className="aas-stats">
            <div className="aas-stat"><span>Managers</span><strong>{assignments.length}</strong></div>
            <div className="aas-stat"><span>Unassigned</span><strong>{unassigned.length}</strong></div>
          </div>
        </div>

        {loading ? (
          <div className="aas-empty">Loading assignments...</div>
        ) : assignments.length === 0 ? (
          <div className="aas-empty">
            <UserPlus size={64} color="#94a3b8" />
            <p>No campaign managers found</p>
            <span>Create campaign manager accounts first.</span>
          </div>
        ) : (
          <div className="aas-grid">
            {assignments.map((a, idx) => (
              <article key={idx} className="aas-card">
                <div className="aas-card-head">
                  <div>
                    <h3>{a.manager_nickname}</h3>
                    <p className="aas-email">{a.manager_email}</p>
                  </div>
                  <span className="aas-count">{a.campaign_count} Campaigns</span>
                </div>
                {a.campaigns?.length > 0 ? (
                  <div className="aas-list">
                    {a.campaigns.map(c => (
                      <div key={c.id} className="aas-item">
                        <div className="aas-item-info">
                          <span className="aas-item-title">{c.title}</span>
                          <span className={`aas-item-status aas-status-${c.status}`}>{c.status}</span>
                        </div>
                        <button
                          className="aas-btn aas-btn-reassign"
                          onClick={() => { setSelectedCampaign(c); setShowAssignModal(true); }}
                        >
                          Reassign
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="aas-no-campaigns">No campaigns assigned yet</p>
                )}
              </article>
            ))}
          </div>
        )}

        <section className="aas-unassigned-section">
          <h3>Unassigned Campaigns</h3>
          {unassigned.length > 0 ? (
            <div className="aas-list">
              {unassigned.map(c => (
                <div key={c.id} className="aas-item">
                  <div className="aas-item-info">
                    <span className="aas-item-title">{c.title}</span>
                    <span className={`aas-item-status aas-status-${c.status}`}>{c.status}</span>
                  </div>
                  <button
                    className="aas-btn aas-btn-assign"
                    onClick={() => { setSelectedCampaign(c); setShowAssignModal(true); }}
                  >
                    Assign
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="aas-no-campaigns">All campaigns are assigned</p>
          )}
        </section>
      </div>

      {showAssignModal && selectedCampaign && (
        <div className="aas-modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="aas-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aas-modal-head">
              <h2>{selectedCampaign.assigned_manager ? 'Reassign' : 'Assign'} Campaign</h2>
              <button onClick={() => setShowAssignModal(false)}><X size={20} /></button>
            </div>
            <div className="aas-modal-body">
              <p><strong>Campaign:</strong> {selectedCampaign.title}</p>
              <label>
                Select Manager:
                <select value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)}>
                  <option value="">-- Choose a manager --</option>
                  {assignments.map(a => (
                    <option key={a.manager_id} value={a.manager_id}>
                      {a.manager_nickname} ({a.campaign_count} campaigns)
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="aas-modal-actions">
              <button className="aas-btn aas-btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button className="aas-btn aas-btn-primary" onClick={handleAssign}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .aas-container { padding: 32px 40px; max-width: 1480px; margin: 0 auto; }
        .aas-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
        .aas-header h1 { display: flex; align-items: center; gap: 12px; font-size: 1.75rem; font-weight: 700; color: #07074e; margin: 0 0 6px; }
        .aas-header h1 :global(svg) { color: #07074e; }
        .aas-header p { color: #718096; margin: 0; font-size: 0.95rem; }
        .aas-stats { display: flex; gap: 12px; flex-wrap: wrap; }
        .aas-stat { background: white; border: 1.5px solid #e8ecff; padding: 12px 18px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; min-width: 100px; }
        .aas-stat span { font-size: 0.72rem; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .aas-stat strong { font-size: 1.3rem; color: #07074e; margin-top: 4px; }
        .aas-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 24px; background: white; border-radius: 16px; color: #4a5568; text-align: center; margin-bottom: 24px; }
        .aas-empty p { margin: 0; font-size: 1.1rem; font-weight: 600; color: #1a202c; }
        .aas-empty span { color: #94a3b8; font-size: 0.9rem; }
        .aas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 20px; margin-bottom: 32px; }
        .aas-card { background: white; border: 1.5px solid #e8ecff; border-radius: 16px; padding: 22px; }
        .aas-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #f1f5f9; }
        .aas-card-head h3 { font-size: 1.05rem; font-weight: 700; color: #07074e; margin: 0; }
        .aas-email { font-size: 0.8rem; color: #718096; margin: 2px 0 0; }
        .aas-count { font-size: 0.7rem; font-weight: 700; padding: 4px 10px; background: #5b6bff; color: white; border-radius: 999px; white-space: nowrap; }
        .aas-list { display: flex; flex-direction: column; gap: 8px; }
        .aas-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; background: #f8f9ff; border-radius: 8px; }
        .aas-item-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
        .aas-item-title { font-size: 0.88rem; font-weight: 600; color: #1a202c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .aas-item-status { font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; align-self: flex-start; text-transform: uppercase; letter-spacing: 0.04em; }
        .aas-status-active { background: #dcfce7; color: #166534; }
        .aas-status-pending_approval { background: #fef3c7; color: #92400e; }
        .aas-status-completed { background: #dbeafe; color: #1e40af; }
        .aas-no-campaigns { color: #94a3b8; font-size: 0.85rem; font-style: italic; margin: 0; }
        .aas-unassigned-section { background: white; border: 1.5px solid #e8ecff; border-radius: 16px; padding: 22px; }
        .aas-unassigned-section h3 { margin: 0 0 16px; color: #07074e; }
        .aas-btn { padding: 6px 14px; border: none; border-radius: 8px; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: all 0.2s ease; white-space: nowrap; }
        .aas-btn-reassign { background: #fef3c7; color: #92400e; }
        .aas-btn-reassign:hover { background: #fde68a; }
        .aas-btn-assign { background: #dcfce7; color: #166534; }
        .aas-btn-assign:hover { background: #bbf7d0; }
        .aas-btn-primary { background: #5b6bff; color: white; padding: 10px 18px; font-size: 0.9rem; }
        .aas-btn-primary:hover { background: #4452f0; }
        .aas-btn-secondary { background: #e2e8f0; color: #4a5568; padding: 10px 18px; font-size: 0.9rem; }
        .aas-btn-secondary:hover { background: #cbd5e0; }
        .aas-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .aas-modal { background: white; border-radius: 16px; max-width: 480px; width: 100%; }
        .aas-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1.5px solid #e8ecff; }
        .aas-modal-head h2 { margin: 0; font-size: 1.25rem; color: #07074e; }
        .aas-modal-head button { background: none; border: none; cursor: pointer; color: #4a5568; }
        .aas-modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
        .aas-modal-body label { display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; font-weight: 600; color: #2d3748; }
        .aas-modal-body select { padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; }
        .aas-modal-body select:focus { outline: none; border-color: #5b6bff; }
        .aas-modal-actions { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1.5px solid #e8ecff; }
        @media (max-width: 720px) {
          .aas-container { padding: 20px; }
          .aas-header { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </AdminLayout>
  );
}
