import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Users as UsersIcon } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminProfiles() {
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingProfiles();
  }, []);

  const fetchPendingProfiles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/pending-profiles`);
      setPendingProfiles(response.data);
    } catch (error) {
      toast.error('Failed to load pending profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveProfile = async (userId) => {
    try {
      await axios.post(`${API}/admin/approve-profile`, {
        item_id: userId,
        action: 'approve'
      });
      toast.success('Profile approved successfully');
      fetchPendingProfiles();
    } catch (error) {
      toast.error('Failed to approve profile');
    }
  };

  const handleRejectProfile = async (userId) => {
    try {
      await axios.post(`${API}/admin/approve-profile`, {
        item_id: userId,
        action: 'reject',
        reason: 'Profile does not meet requirements'
      });
      toast.success('Profile rejected');
      fetchPendingProfiles();
    } catch (error) {
      toast.error('Failed to reject profile');
    }
  };

  return (
    <AdminLayout>
      <div className="ap-container">
        <div className="ap-header">
          <div>
            <h1><UsersIcon size={26} /> Pending Profile Approvals</h1>
            <p>Review and approve newly submitted creator and brand profiles</p>
          </div>
          <div className="ap-stats">
            <div className="ap-stat">
              <span>Pending</span>
              <strong>{pendingProfiles.length}</strong>
            </div>
            <div className="ap-stat">
              <span>Creators</span>
              <strong>{pendingProfiles.filter(p => p.role === 'creator').length}</strong>
            </div>
            <div className="ap-stat">
              <span>Brands</span>
              <strong>{pendingProfiles.filter(p => p.role === 'business').length}</strong>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="ap-empty">Loading profiles...</div>
        ) : pendingProfiles.length === 0 ? (
          <div className="ap-empty">
            <CheckCircle size={64} color="#22c55e" />
            <p>No pending profile approvals</p>
            <span>All caught up — newly submitted profiles will appear here.</span>
          </div>
        ) : (
          <div className="ap-grid">
            {pendingProfiles.map(profile => (
              <article key={profile.id} className="ap-card" data-testid={`profile-${profile.id}`}>
                <div className="ap-card-head">
                  <div>
                    <h3>{profile.username ? `@${profile.username}` : (profile.nickname || '—')}</h3>
                    <span className={`ap-badge ap-badge-${profile.role}`}>{profile.role}</span>
                  </div>
                </div>

                <div className="ap-card-body">
                  <p><strong>Email:</strong> {profile.email}</p>
                  {profile.profile && profile.role === 'creator' && (
                    <>
                      {profile.profile.bio && (
                        <p><strong>Bio:</strong> {profile.profile.bio.substring(0, 120)}{profile.profile.bio.length > 120 ? '...' : ''}</p>
                      )}
                      {profile.profile.tags?.length > 0 && (
                        <p><strong>Tags:</strong> {profile.profile.tags.join(', ')}</p>
                      )}
                      <p><strong>Rate Card:</strong></p>
                      <ul className="ap-rate-list">
                        <li>30s Video: ${profile.profile.rate_card?.video_30s || '-'}</li>
                        <li>60s Video: ${profile.profile.rate_card?.video_60s || '-'}</li>
                        <li>Photo: ${profile.profile.rate_card?.photo_post || '-'}</li>
                      </ul>
                    </>
                  )}
                  {profile.profile && profile.role === 'business' && (
                    <>
                      {profile.profile.business_description && (
                        <p><strong>Description:</strong> {profile.profile.business_description.substring(0, 120)}{profile.profile.business_description.length > 120 ? '...' : ''}</p>
                      )}
                      <p><strong>Industry:</strong> {profile.profile.industry_category || '-'}</p>
                      <p><strong>Product Type:</strong> {profile.profile.product_type || '-'}</p>
                    </>
                  )}
                </div>

                <div className="ap-card-actions">
                  <button
                    className="ap-btn ap-btn-approve"
                    onClick={() => handleApproveProfile(profile.id)}
                    data-testid={`approve-profile-${profile.id}`}
                  >
                    <CheckCircle size={18} /> Approve
                  </button>
                  <button
                    className="ap-btn ap-btn-reject"
                    onClick={() => handleRejectProfile(profile.id)}
                    data-testid={`reject-profile-${profile.id}`}
                  >
                    <XCircle size={18} /> Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .ap-container {
          padding: 32px 40px;
          max-width: 1480px;
          margin: 0 auto;
        }

        .ap-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }

        .ap-header h1 {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 1.75rem;
          font-weight: 700;
          color: #07074e;
          margin: 0 0 6px;
        }

        .ap-header h1 :global(svg) {
          color: #07074e;
        }

        .ap-header p {
          color: #718096;
          margin: 0;
          font-size: 0.95rem;
        }

        .ap-stats {
          display: flex;
          gap: 14px;
        }

        .ap-stat {
          background: white;
          border: 1.5px solid #e8ecff;
          padding: 14px 22px;
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 100px;
        }

        .ap-stat span {
          font-size: 0.75rem;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .ap-stat strong {
          font-size: 1.5rem;
          color: #07074e;
          margin-top: 4px;
        }

        .ap-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 80px 24px;
          background: white;
          border-radius: 16px;
          color: #4a5568;
          text-align: center;
        }

        .ap-empty p {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #1a202c;
        }

        .ap-empty span {
          color: #94a3b8;
          font-size: 0.9rem;
        }

        .ap-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 20px;
        }

        .ap-card {
          background: white;
          border: 1.5px solid #e8ecff;
          border-radius: 16px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: all 0.2s ease;
        }

        .ap-card:hover {
          border-color: #c5c5e0;
          box-shadow: 0 4px 16px rgba(7, 7, 78, 0.08);
        }

        .ap-card-head h3 {
          font-size: 1.1rem;
          font-weight: 700;
          color: #07074e;
          margin: 0 0 6px;
        }

        .ap-badge {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .ap-badge-creator {
          background: #ede9fe;
          color: #6d28d9;
        }

        .ap-badge-business {
          background: #fef3c7;
          color: #92400e;
        }

        .ap-card-body {
          font-size: 0.85rem;
          color: #4a5568;
          line-height: 1.6;
        }

        .ap-card-body p {
          margin: 0 0 6px;
        }

        .ap-card-body strong {
          color: #1a202c;
          font-weight: 600;
        }

        .ap-rate-list {
          margin: 4px 0 0;
          padding-left: 18px;
        }

        .ap-rate-list li {
          margin-bottom: 2px;
        }

        .ap-card-actions {
          display: flex;
          gap: 10px;
          margin-top: auto;
        }

        .ap-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 14px;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ap-btn-approve {
          background: #dcfce7;
          color: #166534;
        }

        .ap-btn-approve:hover {
          background: #bbf7d0;
        }

        .ap-btn-reject {
          background: #fee2e2;
          color: #991b1b;
        }

        .ap-btn-reject:hover {
          background: #fecaca;
        }

        @media (max-width: 720px) {
          .ap-container {
            padding: 20px;
          }

          .ap-header {
            flex-direction: column;
            align-items: stretch;
          }

          .ap-stats {
            flex-wrap: wrap;
          }

          .ap-stat {
            flex: 1 1 calc(33% - 14px);
            min-width: 0;
          }
        }
      `}</style>
    </AdminLayout>
  );
}
