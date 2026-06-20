import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { BarChart, IndianRupee, Users, Briefcase, TrendingUp, Download } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/analytics`);
      setAnalytics(response.data);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExportWithdrawals = async () => {
    try {
      const response = await axios.get(`${API}/admin/withdrawals/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `withdrawals_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV exported successfully');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  const a = analytics || {};

  return (
    <AdminLayout>
      <div className="aan-container">
        <div className="aan-header">
          <div>
            <h1><BarChart size={26} /> Platform Analytics</h1>
            <p>Revenue, growth, and performance metrics across the platform</p>
          </div>
          <button className="aan-btn-export" onClick={handleExportWithdrawals}>
            <Download size={18} /> Export Withdrawals CSV
          </button>
        </div>

        {loading ? (
          <div className="aan-empty">Loading analytics...</div>
        ) : !analytics ? (
          <div className="aan-empty">
            <BarChart size={64} color="#94a3b8" />
            <p>No analytics data available</p>
          </div>
        ) : (
          <>
            <div className="aan-headline-grid">
              <div className="aan-headline-card">
                <h4>Total Creators</h4>
                <p className="aan-big">{a.total_creators || 0}</p>
                <span className="aan-change positive">+{a.new_creators || 0} this month</span>
              </div>
              <div className="aan-headline-card">
                <h4>Total Businesses</h4>
                <p className="aan-big">{a.total_businesses || 0}</p>
                <span className="aan-change positive">+{a.new_businesses || 0} this month</span>
              </div>
              <div className="aan-headline-card">
                <h4>Creator Earnings</h4>
                <p className="aan-big">${(a.total_creator_earnings || a.creator_earnings || 0).toLocaleString()}</p>
                <span className="aan-info">Total paid to creators</span>
              </div>
              <div className="aan-headline-card aan-highlight">
                <h4>Platform Commission</h4>
                <p className="aan-big">${(a.platform_commission || 0).toLocaleString()}</p>
                <span className="aan-info">20% of {(a.total_creator_earnings || a.creator_earnings || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="aan-section-grid">
              <section className="aan-section">
                <div className="aan-section-head">
                  <IndianRupee size={20} />
                  <h3>Revenue Metrics</h3>
                </div>
                <div className="aan-rows">
                  <div className="aan-row"><span>Total Revenue</span><strong>${(a.total_revenue || 0).toLocaleString()}</strong></div>
                  <div className="aan-row"><span>Platform Commission</span><strong>${(a.platform_commission || 0).toLocaleString()}</strong></div>
                  <div className="aan-row"><span>Creator Earnings</span><strong>${(a.creator_earnings || a.total_creator_earnings || 0).toLocaleString()}</strong></div>
                </div>
              </section>

              <section className="aan-section">
                <div className="aan-section-head">
                  <Users size={20} />
                  <h3>User Growth</h3>
                </div>
                <div className="aan-rows">
                  <div className="aan-row"><span>Total Users</span><strong>{a.total_users || 0}</strong></div>
                  <div className="aan-row"><span>New Creators (30d)</span><strong>{a.new_creators || 0}</strong></div>
                  <div className="aan-row"><span>New Businesses (30d)</span><strong>{a.new_businesses || 0}</strong></div>
                </div>
              </section>

              <section className="aan-section">
                <div className="aan-section-head">
                  <Briefcase size={20} />
                  <h3>Campaign Metrics</h3>
                </div>
                <div className="aan-rows">
                  <div className="aan-row"><span>Total Campaigns</span><strong>{a.total_campaigns || 0}</strong></div>
                  <div className="aan-row"><span>Active Campaigns</span><strong>{a.active_campaigns || 0}</strong></div>
                  <div className="aan-row"><span>Completed Campaigns</span><strong>{a.completed_campaigns || 0}</strong></div>
                </div>
              </section>

              <section className="aan-section">
                <div className="aan-section-head">
                  <TrendingUp size={20} />
                  <h3>Performance</h3>
                </div>
                <div className="aan-rows">
                  <div className="aan-row"><span>Avg Campaign Value</span><strong>${a.avg_campaign_value?.toFixed(0) || '0'}</strong></div>
                  <div className="aan-row"><span>Success Rate</span><strong>{a.success_rate?.toFixed(1) || '0'}%</strong></div>
                  <div className="aan-row"><span>Monthly Growth</span><strong>{a.monthly_growth?.toFixed(1) || '0'}%</strong></div>
                </div>
              </section>
            </div>
          </>
        )}
      </div>

      <style>{`
        .aan-container { padding: 32px 40px; max-width: 1480px; margin: 0 auto; }
        .aan-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
        .aan-header h1 { display: flex; align-items: center; gap: 12px; font-size: 1.75rem; font-weight: 700; color: #07074e; margin: 0 0 6px; }
        .aan-header h1 :global(svg) { color: #07074e; }
        .aan-header p { color: #718096; margin: 0; font-size: 0.95rem; }
        .aan-btn-export { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: #07074e; color: white; border: none; border-radius: 10px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease; }
        .aan-btn-export:hover { background: #1e1e7e; }
        .aan-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 24px; background: white; border-radius: 16px; color: #4a5568; text-align: center; }
        .aan-empty p { margin: 0; font-size: 1.1rem; font-weight: 600; color: #1a202c; }

        .aan-headline-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 28px; }
        .aan-headline-card { background: white; border: 1.5px solid #e8ecff; border-radius: 14px; padding: 20px; }
        .aan-headline-card.aan-highlight { background: linear-gradient(135deg, #07074e 0%, #1e1e7e 100%); border-color: #07074e; color: white; }
        .aan-headline-card h4 { margin: 0 0 8px; font-size: 0.85rem; color: #718096; font-weight: 600; }
        .aan-headline-card.aan-highlight h4 { color: rgba(255,255,255,0.85); }
        .aan-big { margin: 0 0 6px; font-size: 1.8rem; font-weight: 700; color: #07074e; line-height: 1; }
        .aan-headline-card.aan-highlight .aan-big { color: white; }
        .aan-change { font-size: 0.78rem; color: #166534; font-weight: 600; }
        .aan-change.positive { color: #166534; }
        .aan-info { font-size: 0.78rem; color: #94a3b8; }
        .aan-headline-card.aan-highlight .aan-info { color: rgba(255,255,255,0.75); }

        .aan-section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
        .aan-section { background: white; border: 1.5px solid #e8ecff; border-radius: 14px; padding: 22px; }
        .aan-section-head { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid #f1f5f9; margin-bottom: 14px; }
        .aan-section-head h3 { margin: 0; font-size: 1rem; color: #07074e; font-weight: 700; }
        .aan-section-head :global(svg) { color: #07074e; }
        .aan-rows { display: flex; flex-direction: column; gap: 10px; }
        .aan-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f8f9ff; border-radius: 8px; }
        .aan-row span { color: #4a5568; font-size: 0.88rem; }
        .aan-row strong { color: #07074e; font-size: 1rem; font-weight: 700; }

        @media (max-width: 1100px) {
          .aan-headline-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .aan-section-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .aan-headline-grid { grid-template-columns: 1fr; }
          .aan-container { padding: 20px; }
          .aan-header { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </AdminLayout>
  );
}
