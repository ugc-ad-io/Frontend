import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Briefcase } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

export default function AdminAllCampaigns() {
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

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
        c.business_nickname?.toLowerCase().includes(filter.toLowerCase()) ||
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
                  <p><strong>Business:</strong> {c.business_nickname || '—'}</p>
                  <p><strong>Budget:</strong> ₹{c.budget_min} - ₹{c.budget_max}</p>
                  <p><strong>Brief:</strong> {c.brief_text?.substring(0, 150)}{c.brief_text?.length > 150 ? '...' : ''}</p>
                  <p><strong>Created:</strong> {new Date(c.created_at).toLocaleDateString()}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

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
