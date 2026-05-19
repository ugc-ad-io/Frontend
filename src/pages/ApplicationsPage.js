import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import './ApplicationsPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ApplicationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [creatorApplications, setCreatorApplications] = useState([]);
  const [brandApplications, setBrandApplications] = useState([]);
  const [applicationViewType, setApplicationViewType] = useState('creator');
  const [applicationFilters, setApplicationFilters] = useState({
    state: '',
    category: '',
    startDate: '',
    endDate: ''
  });
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showApplicationDetail, setShowApplicationDetail] = useState(false);
  const [applicationDetailLoading, setApplicationDetailLoading] = useState(false);
  const [showMoreInfoModal, setShowMoreInfoModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [moreInfoFormData, setMoreInfoFormData] = useState({
    request_type: 'clarification',
    message: '',
    required_fields: [],
    deadline_days: 3,
    priority: 'medium'
  });
  const [rejectFormData, setRejectFormData] = useState({
    reason_code: '',
    reason_details: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchApplications();
  }, [user, navigate]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const creatorRes = await axios.get(`${API}/admin/applications/creators`);
      const brandRes = await axios.get(`${API}/admin/applications/brands`);
      setCreatorApplications(creatorRes.data.data || creatorRes.data);
      setBrandApplications(brandRes.data.data || brandRes.data);
    } catch (error) {
      console.error('Failed to load applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const fetchApplicationDetail = async (applicationId, type) => {
    try {
      setApplicationDetailLoading(true);
      const endpoint = type === 'creator'
        ? `/admin/applications/creators/${applicationId}`
        : `/admin/applications/brands/${applicationId}`;
      const response = await axios.get(`${API}${endpoint}`);
      setSelectedApplication({...response.data, type});
    } catch (error) {
      console.error('Failed to load application detail:', error);
      toast.error('Failed to load application details');
    } finally {
      setApplicationDetailLoading(false);
    }
  };

  const handleApproveApplication = async (applicationId, type) => {
    try {
      const endpoint = type === 'creator'
        ? `/admin/applications/creators/${applicationId}/approve`
        : `/admin/applications/brands/${applicationId}/approve`;
      await axios.post(`${API}${endpoint}`, {
        notes: 'Approved by admin'
      });
      toast.success('Application approved successfully');
      setShowApplicationDetail(false);
      fetchApplications();
    } catch (error) {
      console.error('Failed to approve application:', error);
      toast.error(error.response?.data?.detail || 'Failed to approve application');
    }
  };

  const handleRejectApplication = async (applicationId, type) => {
    try {
      if (!rejectFormData.reason_code) {
        toast.error('Please select a rejection reason');
        return;
      }
      const endpoint = type === 'creator'
        ? `/admin/applications/creators/${applicationId}/reject`
        : `/admin/applications/brands/${applicationId}/reject`;
      await axios.post(`${API}${endpoint}`, {
        reason_code: rejectFormData.reason_code,
        reason_details: rejectFormData.reason_details
      });
      toast.success('Application rejected successfully');
      setShowApplicationDetail(false);
      setRejectFormData({reason_code: '', reason_details: ''});
      fetchApplications();
    } catch (error) {
      console.error('Failed to reject application:', error);
      toast.error(error.response?.data?.detail || 'Failed to reject application');
    }
  };

  const handleRequestMoreInfo = async (applicationId, type) => {
    try {
      if (!moreInfoFormData.message) {
        toast.error('Please enter a message');
        return;
      }
      const endpoint = type === 'creator'
        ? `/admin/applications/creators/${applicationId}/request-more-info`
        : `/admin/applications/brands/${applicationId}/request-more-info`;
      await axios.post(`${API}${endpoint}`, moreInfoFormData);
      toast.success('More info request sent to applicant');
      setShowMoreInfoModal(false);
      setMoreInfoFormData({request_type: 'clarification', message: '', required_fields: [], deadline_days: 3, priority: 'medium'});
      fetchApplicationDetail(applicationId, type);
    } catch (error) {
      console.error('Failed to send more info request:', error);
      toast.error(error.response?.data?.detail || 'Failed to send request');
    }
  };

  return (
    <div className="applications-page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/dashboard/admin/overview')}>
          <ArrowLeft size={20} /> Back to Dashboard
        </button>
        <h1>Applications</h1>
      </div>

      {!showApplicationDetail ? (
        <>
          <div className="applications-header">
            <div className="application-tabs">
              <button
                className={`app-tab-btn ${applicationViewType === 'creator' ? 'active' : ''}`}
                onClick={() => setApplicationViewType('creator')}
              >
                Creator Applications ({creatorApplications.length})
              </button>
              <button
                className={`app-tab-btn ${applicationViewType === 'brand' ? 'active' : ''}`}
                onClick={() => setApplicationViewType('brand')}
              >
                Brand Applications ({brandApplications.length})
              </button>
            </div>
          </div>

          <div className="applications-filters">
            <div className="filter-group">
              <label>State</label>
              <select value={applicationFilters.state} onChange={(e) => setApplicationFilters({...applicationFilters, state: e.target.value})}>
                <option value="">All States</option>
                <option value="pending">Pending</option>
                <option value="more_info">More Info Requested</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Category</label>
              <select value={applicationFilters.category} onChange={(e) => setApplicationFilters({...applicationFilters, category: e.target.value})}>
                <option value="">All Categories</option>
                <option value="tech">Technology</option>
                <option value="fashion">Fashion</option>
                <option value="lifestyle">Lifestyle</option>
                <option value="food">Food & Beverage</option>
                <option value="beauty">Beauty</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Submitted Date Range</label>
              <div className="date-range">
                <input
                  type="date"
                  value={applicationFilters.startDate}
                  onChange={(e) => setApplicationFilters({...applicationFilters, startDate: e.target.value})}
                />
                <span>to</span>
                <input
                  type="date"
                  value={applicationFilters.endDate}
                  onChange={(e) => setApplicationFilters({...applicationFilters, endDate: e.target.value})}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading applications...</div>
          ) : (
            <div className="applications-list">
              <table className="applications-table">
                <thead>
                  <tr>
                    <th>{applicationViewType === 'creator' ? 'Handle' : 'Brand Name'}</th>
                    <th>Submitted Date</th>
                    <th>Category</th>
                    <th>{applicationViewType === 'creator' ? 'Languages' : 'Email'}</th>
                    <th>{applicationViewType === 'creator' ? 'Location' : 'GST Status'}</th>
                    <th>SLA Remaining</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(applicationViewType === 'creator' ? creatorApplications : brandApplications)
                    .filter(app => !applicationFilters.state || app.status === applicationFilters.state)
                    .filter(app => !applicationFilters.category || app.category === applicationFilters.category)
                    .sort((a, b) => new Date(a.submitted_date) - new Date(b.submitted_date))
                    .map(app => (
                      <tr key={app.id}>
                        <td className="app-handle">{applicationViewType === 'creator' ? app.nickname : app.business_name}</td>
                        <td>{new Date(app.submitted_date).toLocaleDateString()}</td>
                        <td>{app.category}</td>
                        <td>{applicationViewType === 'creator' ? (app.languages?.join(', ') || 'N/A') : app.email}</td>
                        <td>{applicationViewType === 'creator' ? app.location : app.gst_status || 'Pending'}</td>
                        <td className="sla-remaining">{Math.max(0, 7 - Math.floor((Date.now() - new Date(app.submitted_date)) / (1000 * 60 * 60 * 24)))} days</td>
                        <td>
                          <span className={`status-badge status-${app.status}`}>
                            {app.status?.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-view-detail"
                            onClick={() => {
                              setShowApplicationDetail(true);
                              fetchApplicationDetail(app.id, applicationViewType);
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {((applicationViewType === 'creator' ? creatorApplications : brandApplications).length === 0) && (
                <div className="empty-table">
                  <p>No applications found</p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="application-detail-view">
          <button className="btn-back" onClick={() => setShowApplicationDetail(false)}>← Back to List</button>

          {applicationDetailLoading ? (
            <div className="loading">Loading application details...</div>
          ) : selectedApplication?.type === 'creator' ? (
            // Creator detail view - will import the detail component here
            <CreatorApplicationDetail
              app={selectedApplication}
              onApprove={() => handleApproveApplication(selectedApplication?.id, 'creator')}
              onReject={() => handleRejectApplication(selectedApplication?.id, 'creator')}
              onMoreInfo={() => setShowMoreInfoModal(true)}
              moreInfoForm={moreInfoFormData}
              rejectForm={rejectFormData}
              setRejectForm={setRejectFormData}
            />
          ) : (
            // Brand detail view
            <BrandApplicationDetail
              app={selectedApplication}
              onApprove={() => handleApproveApplication(selectedApplication?.id, 'brand')}
              onReject={() => handleRejectApplication(selectedApplication?.id, 'brand')}
              onMoreInfo={() => setShowMoreInfoModal(true)}
              moreInfoForm={moreInfoFormData}
              rejectForm={rejectFormData}
              setRejectForm={setRejectFormData}
            />
          )}
        </div>
      )}

      {/* More Info Modal */}
      {showMoreInfoModal && (
        <div className="modal-overlay" onClick={() => setShowMoreInfoModal(false)}>
          <div className="modal-content more-info-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Request More Information</h3>
            <div className="form-group">
              <label>Request Type</label>
              <select
                value={moreInfoFormData.request_type}
                onChange={(e) => setMoreInfoFormData({...moreInfoFormData, request_type: e.target.value})}
              >
                <option value="clarification">Clarification</option>
                <option value="document">Document</option>
                <option value="verification">Verification</option>
              </select>
            </div>
            <div className="form-group">
              <label>Message</label>
              <textarea
                value={moreInfoFormData.message}
                onChange={(e) => setMoreInfoFormData({...moreInfoFormData, message: e.target.value})}
                placeholder="Enter your request message..."
                rows="4"
              />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select
                value={moreInfoFormData.priority}
                onChange={(e) => setMoreInfoFormData({...moreInfoFormData, priority: e.target.value})}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="form-group">
              <label>Response Deadline (Days)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={moreInfoFormData.deadline_days}
                onChange={(e) => setMoreInfoFormData({...moreInfoFormData, deadline_days: parseInt(e.target.value)})}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-confirm"
                onClick={() => handleRequestMoreInfo(selectedApplication?.id, selectedApplication?.type)}
              >
                Send Request
              </button>
              <button
                className="btn-cancel"
                onClick={() => setShowMoreInfoModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Creator Application Detail Component
function CreatorApplicationDetail({ app, onApprove, onReject, onMoreInfo, rejectForm, setRejectForm }) {
  return (
    <div className="detail-content">
      <div className="detail-header">
        <div className="detail-title">
          <h2>{app?.nickname}</h2>
          <p>{app?.email}</p>
          <span className={`status-badge status-${app?.status}`}>
            {app?.status?.replace(/_/g, ' ').toUpperCase()}
          </span>
          {app?.handle_flagged_as_real_name && (
            <span className="flag-badge">⚠️ Handle flagged as real name</span>
          )}
        </div>
        <div className="detail-meta">
          <div className="meta-item">
            <span className="label">Submitted</span>
            <span className="value">{new Date(app?.submitted_date).toLocaleDateString()}</span>
          </div>
          <div className="meta-item">
            <span className="label">SLA Remaining</span>
            <span className="value">{app?.sla_remaining_days} days</span>
          </div>
          <div className="meta-item">
            <span className="label">Category</span>
            <span className="value">{app?.category}</span>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        {/* Profile Info */}
        <section className="detail-section">
          <h3>Profile Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Handle</label>
              <p>{app?.nickname}</p>
            </div>
            <div className="info-item">
              <label>Location</label>
              <p>{app?.location}</p>
            </div>
            <div className="info-item">
              <label>Languages</label>
              <p>{app?.languages?.join(', ')}</p>
            </div>
            <div className="info-item">
              <label>Category</label>
              <p>{app?.category}</p>
            </div>
            <div className="info-item full-width">
              <label>Bio</label>
              <p>{app?.bio}</p>
            </div>
          </div>
        </section>

        {/* Rate Card */}
        <section className="detail-section">
          <h3>Rate Card</h3>
          <div className="rate-card-grid">
            {Object.entries(app?.rate_card || {}).map(([key, value]) => (
              <div key={key} className="rate-item">
                <span className="rate-label">{key.replace(/_/g, ' ').toUpperCase()}</span>
                <span className="rate-value">₹{Number(value).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Portfolio Videos */}
        <section className="detail-section full-width">
          <h3>Portfolio Videos</h3>
          {app?.portfolio_videos?.length > 0 ? (
            <div className="portfolio-grid">
              {app.portfolio_videos.map(video => (
                <div key={video.id} className="video-card">
                  <div className="video-thumbnail">
                    <img src={video.thumbnail} alt={video.title} />
                    <a href={video.url} target="_blank" rel="noopener noreferrer" className="play-button">▶</a>
                  </div>
                  <p className="video-title">{video.title}</p>
                  {video.duration && <p className="video-duration">{Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-message">No portfolio videos provided</p>
          )}
        </section>

        {/* KYC Documents */}
        <section className="detail-section full-width">
          <h3>KYC Documents</h3>
          <div className="kyc-grid">
            {app?.kyc_documents ? Object.entries(app.kyc_documents).map(([docType, doc]) => (
              <div key={docType} className="kyc-card">
                <div className="kyc-header">
                  <h4>{docType.replace(/_/g, ' ').toUpperCase()}</h4>
                  <span className={`verify-badge ${doc.verified ? 'verified' : 'pending'}`}>
                    {doc.verified ? '✓ Verified' : '⏳ Pending'}
                  </span>
                </div>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="doc-link">
                    View Document
                  </a>
                )}
                {doc.number && <p className="doc-info"><strong>ID:</strong> {doc.number}</p>}
                {doc.verified_at && <p className="doc-info"><strong>Verified:</strong> {new Date(doc.verified_at).toLocaleDateString()}</p>}
              </div>
            )) : null}
          </div>
        </section>

        {/* Social Handles */}
        <section className="detail-section full-width">
          <h3>Social Media Handles</h3>
          {app?.social_handles ? (
            <div className="social-grid">
              {Object.entries(app.social_handles).map(([platform, data]) => (
                data.handle || data.profile_url ? (
                  <div key={platform} className="social-card">
                    <h4>{platform.toUpperCase()}</h4>
                    {data.profile_url ? (
                      <a href={data.profile_url} target="_blank" rel="noopener noreferrer">{data.handle || data.profile_url}</a>
                    ) : (
                      <p>{data.handle}</p>
                    )}
                    {data.followers && <p className="followers">{Number(data.followers).toLocaleString()} followers</p>}
                    {data.verified && <span className="verified-badge">✓ Verified</span>}
                  </div>
                ) : null
              ))}
            </div>
          ) : (
            <p className="empty-message">No social handles provided</p>
          )}
        </section>
      </div>

      {/* Decision Section */}
      <div className="decision-section">
        <h3>Application Decision</h3>
        <div className="decision-buttons">
          <button
            className="btn-decision btn-approve"
            onClick={onApprove}
            disabled={app?.status === 'approved'}
          >
            ✓ Approve
          </button>
          <button
            className="btn-decision btn-more-info"
            onClick={onMoreInfo}
            disabled={app?.status === 'approved' || app?.status === 'rejected'}
          >
            ✎ Request More Info
          </button>
          <button
            className="btn-decision btn-reject"
            onClick={() => document.querySelector('.reject-form')?.classList.toggle('show')}
            disabled={app?.status === 'approved' || app?.status === 'rejected'}
          >
            ✕ Reject
          </button>
        </div>

        {/* Reject Form */}
        <div className="reject-form">
          <div className="form-group">
            <label>Rejection Reason</label>
            <select
              value={rejectForm.reason_code}
              onChange={(e) => setRejectForm({...rejectForm, reason_code: e.target.value})}
            >
              <option value="">Select a reason...</option>
              <option value="invalid_documents">Invalid Documents</option>
              <option value="incomplete_kyc">Incomplete KYC</option>
              <option value="restricted_category">Restricted Category</option>
              <option value="fraud_detected">Fraud Detected</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Details</label>
            <textarea
              value={rejectForm.reason_details}
              onChange={(e) => setRejectForm({...rejectForm, reason_details: e.target.value})}
              placeholder="Provide details for rejection..."
            />
          </div>
          <div className="form-actions">
            <button
              className="btn-confirm btn-reject"
              onClick={onReject}
            >
              Confirm Rejection
            </button>
            <button
              className="btn-cancel"
              onClick={() => document.querySelector('.reject-form')?.classList.remove('show')}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Brand Application Detail Component
function BrandApplicationDetail({ app, onApprove, onReject, onMoreInfo, rejectForm, setRejectForm }) {
  return (
    <div className="detail-content">
      <div className="detail-header">
        <div className="detail-title">
          <h2>{app?.business_name}</h2>
          <p>{app?.business_email}</p>
          <span className={`status-badge status-${app?.status}`}>
            {app?.status?.replace(/_/g, ' ').toUpperCase()}
          </span>
          {app?.flags?.free_email_domain && <span className="flag-badge">⚠️ Free email domain</span>}
          {app?.flags?.restricted_category && <span className="flag-badge">⚠️ Restricted category</span>}
        </div>
        <div className="detail-meta">
          <div className="meta-item">
            <span className="label">Submitted</span>
            <span className="value">{new Date(app?.submitted_date).toLocaleDateString()}</span>
          </div>
          <div className="meta-item">
            <span className="label">SLA Remaining</span>
            <span className="value">{app?.sla_remaining_days} days</span>
          </div>
          <div className="meta-item">
            <span className="label">GST Status</span>
            <span className={`gst-badge ${app?.gst_details?.verification_status}`}>
              {app?.gst_details?.verification_status?.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        {/* Business Info */}
        <section className="detail-section">
          <h3>Business Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Business Name</label>
              <p>{app?.business_name}</p>
            </div>
            <div className="info-item">
              <label>Business Email</label>
              <p>{app?.business_email}</p>
            </div>
            <div className="info-item">
              <label>Industry</label>
              <p>{app?.business_profile?.industry}</p>
            </div>
            <div className="info-item">
              <label>Product Type</label>
              <p>{app?.business_profile?.product_type}</p>
            </div>
            <div className="info-item full-width">
              <label>Description</label>
              <p>{app?.business_profile?.description}</p>
            </div>
          </div>
        </section>

        {/* GST */}
        <section className="detail-section">
          <h3>GST Verification</h3>
          <div className="gst-info">
            <div className="gst-item">
              <label>GST Number</label>
              <p>{app?.gst_details?.gst_number}</p>
            </div>
            <div className="gst-item">
              <label>Status</label>
              <span className={`gst-badge ${app?.gst_details?.verification_status}`}>
                {app?.gst_details?.verification_status?.toUpperCase()}
              </span>
            </div>
          </div>
        </section>

        {/* Social Media */}
        <section className="detail-section full-width">
          <h3>Social Media</h3>
          {app?.social_media ? (
            <div className="social-grid">
              {Object.entries(app.social_media).map(([platform, url]) => (
                url ? (
                  <div key={platform} className="social-card">
                    <h4>{platform.toUpperCase()}</h4>
                    <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                  </div>
                ) : null
              ))}
            </div>
          ) : (
            <p className="empty-message">No social media links</p>
          )}
        </section>
      </div>

      {/* Decision Section */}
      <div className="decision-section">
        <h3>Application Decision</h3>
        <div className="decision-buttons">
          <button
            className="btn-decision btn-approve"
            onClick={onApprove}
            disabled={app?.status === 'approved'}
          >
            ✓ Approve
          </button>
          <button
            className="btn-decision btn-more-info"
            onClick={onMoreInfo}
            disabled={app?.status === 'approved' || app?.status === 'rejected'}
          >
            ✎ Request More Info
          </button>
          <button
            className="btn-decision btn-reject"
            onClick={() => document.querySelector('.reject-form')?.classList.toggle('show')}
            disabled={app?.status === 'approved' || app?.status === 'rejected'}
          >
            ✕ Reject
          </button>
        </div>

        {/* Reject Form */}
        <div className="reject-form">
          <div className="form-group">
            <label>Rejection Reason</label>
            <select
              value={rejectForm.reason_code}
              onChange={(e) => setRejectForm({...rejectForm, reason_code: e.target.value})}
            >
              <option value="">Select a reason...</option>
              <option value="invalid_gst">Invalid GST</option>
              <option value="restricted_category">Restricted Category</option>
              <option value="fraud_detected">Fraud Detected</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Details</label>
            <textarea
              value={rejectForm.reason_details}
              onChange={(e) => setRejectForm({...rejectForm, reason_details: e.target.value})}
              placeholder="Provide details for rejection..."
            />
          </div>
          <div className="form-actions">
            <button
              className="btn-confirm btn-reject"
              onClick={onReject}
            >
              Confirm Rejection
            </button>
            <button
              className="btn-cancel"
              onClick={() => document.querySelector('.reject-form')?.classList.remove('show')}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
