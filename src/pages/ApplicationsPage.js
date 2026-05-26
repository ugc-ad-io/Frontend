import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, CheckCircle, XCircle, Search, Users, Briefcase, Clock, FileText, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import '../styles/ApplicationsPage.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function ApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [applicationType, setApplicationType] = useState('creators');
  const [filterState, setFilterState] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMoreInfoModal, setShowMoreInfoModal] = useState(false);
  const [rejectFormData, setRejectFormData] = useState({ reason_code: '', reason_details: '' });
  const [moreInfoFormData, setMoreInfoFormData] = useState({
    request_type: 'clarification',
    message: '',
    priority: 'medium',
    deadline_days: 7
  });

  useEffect(() => {
    fetchApplications();
  }, [applicationType]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const endpoint = applicationType === 'creators'
        ? `${API}/admin/applications/creators`
        : `${API}/admin/applications/brands`;

      const response = await axios.get(endpoint);
      const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setApplications(data);
      setSelectedApplication(null);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveApplication = async (id, type) => {
    try {
      await axios.post(`${API}/admin/applications/${id}/approve`);
      toast.success('Application approved');
      setApplications(applications.filter(app => app.id !== id));
      setSelectedApplication(null);
    } catch (error) {
      console.error('Error approving application:', error);
      toast.error('Failed to approve application');
    }
  };

  const handleRejectApplication = async (id, type) => {
    if (!rejectFormData.reason_code) {
      toast.error('Please select a rejection reason');
      return;
    }

    try {
      await axios.post(`${API}/admin/applications/${id}/reject`, {
        reason_code: rejectFormData.reason_code,
        reason_details: rejectFormData.reason_details
      });
      toast.success('Application rejected');
      setApplications(applications.filter(app => app.id !== id));
      setSelectedApplication(null);
      setRejectFormData({ reason_code: '', reason_details: '' });
    } catch (error) {
      console.error('Error rejecting application:', error);
      toast.error('Failed to reject application');
    }
  };

  const handleRequestMoreInfo = async (id, type) => {
    if (!moreInfoFormData.message) {
      toast.error('Please enter a message');
      return;
    }

    try {
      await axios.post(`${API}/admin/applications/${id}/request-more-info`, moreInfoFormData);
      toast.success('More info request sent');
      setShowMoreInfoModal(false);
      setMoreInfoFormData({ request_type: 'clarification', message: '', priority: 'medium', deadline_days: 7 });
    } catch (error) {
      console.error('Error requesting more info:', error);
      toast.error('Failed to request more information');
    }
  };

  const filteredApplications = applications.filter(app => {
    if (filterState !== 'all' && app.status !== filterState) return false;
    const appCategory = app.category || app.business_profile?.industry;
    if (filterCategory !== 'all' && appCategory !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (applicationType === 'creators' ? app.nickname : app.business_name) || '';
      const email = (applicationType === 'creators' ? app.email : app.business_email) || '';
      if (!name.toLowerCase().includes(q) && !email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const categories = [...new Set(applications.map(app => app.category || app.business_profile?.industry))].filter(Boolean);

  const stats = useMemo(() => ({
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  }), [applications]);

  const getInitials = (name) => {
    if (!name) return '?';
    const clean = name.replace(/^@/, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  };

  const avatarColor = (name) => {
    const palette = ['#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  };

  if (selectedApplication) {
    return (
      <>
        <div className="detail-view">
          <button className="btn-back" onClick={() => setSelectedApplication(null)}>
            <ChevronLeft size={18} /> Back
          </button>

          {applicationType === 'creators' ? (
            <div className="detail-content">
              <div className="detail-header">
                <div className="detail-title">
                  <h2>{selectedApplication.nickname}</h2>
                  <p>{selectedApplication.email}</p>
                  <span className={`status-badge status-${selectedApplication.status}`}>
                    {selectedApplication.status?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  {selectedApplication.handle_flagged_as_real_name && (
                    <span className="flag-badge">⚠️ Handle flagged as real name</span>
                  )}
                </div>
                <div className="detail-meta">
                  <div className="meta-item">
                    <span className="label">Submitted</span>
                    <span className="value">{new Date(selectedApplication.submitted_date).toLocaleDateString()}</span>
                  </div>
                  <div className="meta-item">
                    <span className="label">SLA Remaining</span>
                    <span className="value">{selectedApplication.sla_remaining_days} days</span>
                  </div>
                  <div className="meta-item">
                    <span className="label">Category</span>
                    <span className="value">{selectedApplication.category}</span>
                  </div>
                </div>
              </div>

              <div className="detail-grid">
                <section className="detail-section">
                  <h3>Profile Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Handle</label>
                      <p>{selectedApplication.nickname}</p>
                    </div>
                    <div className="info-item">
                      <label>Location</label>
                      <p>{selectedApplication.location}</p>
                    </div>
                    <div className="info-item">
                      <label>Languages</label>
                      <p>{selectedApplication.languages?.join(', ')}</p>
                    </div>
                    <div className="info-item">
                      <label>Category</label>
                      <p>{selectedApplication.category}</p>
                    </div>
                    <div className="info-item full-width">
                      <label>Bio</label>
                      <p>{selectedApplication.bio}</p>
                    </div>
                  </div>
                </section>

                <section className="detail-section">
                  <h3>Rate Card</h3>
                  <div className="rate-card-grid">
                    {Object.entries(selectedApplication.rate_card || {}).map(([key, value]) => (
                      <div key={key} className="rate-item">
                        <span className="rate-label">{key.replace(/_/g, ' ').toUpperCase()}</span>
                        <span className="rate-value">₹{Number(value).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="detail-section full-width">
                  <h3>Portfolio Videos</h3>
                  {selectedApplication.portfolio_videos?.length > 0 ? (
                    <div className="portfolio-grid">
                      {selectedApplication.portfolio_videos.map(video => (
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

                <section className="detail-section full-width">
                  <h3>KYC Documents</h3>
                  <div className="kyc-grid">
                    {selectedApplication.kyc_documents ? Object.entries(selectedApplication.kyc_documents).map(([docType, doc]) => (
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

                <section className="detail-section full-width">
                  <h3>Social Media Handles</h3>
                  {selectedApplication.social_handles ? (
                    <div className="social-grid">
                      {Object.entries(selectedApplication.social_handles).map(([platform, data]) => (
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

              <div className="decision-section">
                <h3>Application Decision</h3>
                <div className="decision-buttons">
                  <button
                    className="btn-decision btn-approve"
                    onClick={() => handleApproveApplication(selectedApplication.id, 'creator')}
                    disabled={selectedApplication.status === 'approved'}
                  >
                    ✓ Approve
                  </button>
                  <button
                    className="btn-decision btn-more-info"
                    onClick={() => setShowMoreInfoModal(true)}
                    disabled={selectedApplication.status === 'approved' || selectedApplication.status === 'rejected'}
                  >
                    ✎ Request More Info
                  </button>
                  <button
                    className="btn-decision btn-reject"
                    onClick={() => document.querySelector('.reject-form')?.classList.toggle('show')}
                    disabled={selectedApplication.status === 'approved' || selectedApplication.status === 'rejected'}
                  >
                    ✕ Reject
                  </button>
                </div>

                <div className="reject-form">
                  <div className="form-group">
                    <label>Rejection Reason</label>
                    <select
                      value={rejectFormData.reason_code}
                      onChange={(e) => setRejectFormData({...rejectFormData, reason_code: e.target.value})}
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
                      value={rejectFormData.reason_details}
                      onChange={(e) => setRejectFormData({...rejectFormData, reason_details: e.target.value})}
                      placeholder="Provide details for rejection..."
                    />
                  </div>
                  <div className="form-actions">
                    <button
                      className="btn-confirm btn-reject"
                      onClick={() => handleRejectApplication(selectedApplication.id, 'creator')}
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
          ) : (
            <div className="detail-content">
              <div className="detail-header">
                <div className="detail-title">
                  <h2>{selectedApplication.business_name}</h2>
                  <p>{selectedApplication.business_email}</p>
                  <span className={`status-badge status-${selectedApplication.status}`}>
                    {selectedApplication.status?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  {selectedApplication.flags?.free_email_domain && (
                    <span className="flag-badge">⚠️ Free email domain</span>
                  )}
                  {selectedApplication.flags?.restricted_category && (
                    <span className="flag-badge">⚠️ Restricted category</span>
                  )}
                </div>
                <div className="detail-meta">
                  <div className="meta-item">
                    <span className="label">Submitted</span>
                    <span className="value">{new Date(selectedApplication.submitted_date).toLocaleDateString()}</span>
                  </div>
                  <div className="meta-item">
                    <span className="label">SLA Remaining</span>
                    <span className="value">{selectedApplication.sla_remaining_days} days</span>
                  </div>
                  <div className="meta-item">
                    <span className="label">GST Status</span>
                    <span className={`gst-badge ${selectedApplication.gst_details?.verification_status}`}>
                      {selectedApplication.gst_details?.verification_status?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-grid">
                <section className="detail-section">
                  <h3>Business Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Business Name</label>
                      <p>{selectedApplication.business_name}</p>
                    </div>
                    <div className="info-item">
                      <label>Business Email</label>
                      <p>{selectedApplication.business_email}</p>
                    </div>
                    <div className="info-item">
                      <label>Industry</label>
                      <p>{selectedApplication.business_profile?.industry}</p>
                    </div>
                    <div className="info-item">
                      <label>Product Type</label>
                      <p>{selectedApplication.business_profile?.product_type}</p>
                    </div>
                    <div className="info-item full-width">
                      <label>Description</label>
                      <p>{selectedApplication.business_profile?.description}</p>
                    </div>
                  </div>
                </section>

                <section className="detail-section">
                  <h3>GST Verification</h3>
                  <div className="gst-info">
                    <div className="gst-item">
                      <label>GST Number</label>
                      <p>{selectedApplication.gst_details?.gst_number}</p>
                    </div>
                    <div className="gst-item">
                      <label>Status</label>
                      <span className={`gst-badge ${selectedApplication.gst_details?.verification_status}`}>
                        {selectedApplication.gst_details?.verification_status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="gst-item">
                      <label>Business Type</label>
                      <p>{selectedApplication.gst_details?.business_type}</p>
                    </div>
                    {selectedApplication.gst_details?.verified_at && (
                      <div className="gst-item">
                        <label>Verified Date</label>
                        <p>{new Date(selectedApplication.gst_details.verified_at).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </section>

                {selectedApplication.business_profile?.website && (
                  <section className="detail-section full-width">
                    <h3>Website</h3>
                    <div className="website-preview">
                      <a href={selectedApplication.business_profile.website} target="_blank" rel="noopener noreferrer">
                        {selectedApplication.business_profile.website}
                      </a>
                    </div>
                  </section>
                )}

                <section className="detail-section full-width">
                  <h3>Social Media Links</h3>
                  {selectedApplication.social_media ? (
                    <div className="social-grid">
                      {Object.entries(selectedApplication.social_media).map(([platform, url]) => (
                        url ? (
                          <div key={platform} className="social-card">
                            <h4>{platform.toUpperCase()}</h4>
                            <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                          </div>
                        ) : null
                      ))}
                    </div>
                  ) : (
                    <p className="empty-message">No social media links provided</p>
                  )}
                </section>
              </div>

              <div className="decision-section">
                <h3>Application Decision</h3>
                <div className="decision-buttons">
                  <button
                    className="btn-decision btn-approve"
                    onClick={() => handleApproveApplication(selectedApplication.id, 'brand')}
                    disabled={selectedApplication.status === 'approved'}
                  >
                    ✓ Approve
                  </button>
                  <button
                    className="btn-decision btn-more-info"
                    onClick={() => setShowMoreInfoModal(true)}
                    disabled={selectedApplication.status === 'approved' || selectedApplication.status === 'rejected'}
                  >
                    ✎ Request More Info
                  </button>
                  <button
                    className="btn-decision btn-reject"
                    onClick={() => document.querySelector('.reject-form')?.classList.toggle('show')}
                    disabled={selectedApplication.status === 'approved' || selectedApplication.status === 'rejected'}
                  >
                    ✕ Reject
                  </button>
                </div>

                <div className="reject-form">
                  <div className="form-group">
                    <label>Rejection Reason</label>
                    <select
                      value={rejectFormData.reason_code}
                      onChange={(e) => setRejectFormData({...rejectFormData, reason_code: e.target.value})}
                    >
                      <option value="">Select a reason...</option>
                      <option value="invalid_gst">Invalid GST</option>
                      <option value="restricted_category">Restricted Category</option>
                      <option value="fraud_detected">Fraud Detected</option>
                      <option value="low_trust">Low Trust Indicators</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Details</label>
                    <textarea
                      value={rejectFormData.reason_details}
                      onChange={(e) => setRejectFormData({...rejectFormData, reason_details: e.target.value})}
                      placeholder="Provide details for rejection..."
                    />
                  </div>
                  <div className="form-actions">
                    <button
                      className="btn-confirm btn-reject"
                      onClick={() => handleRejectApplication(selectedApplication.id, 'brand')}
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
          )}

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
                    onClick={() => handleRequestMoreInfo(selectedApplication.id, applicationType === 'creators' ? 'creator' : 'brand')}
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
      </>
    );
  }

  return (
    <div className="apps-page">
      <div className="apps-stats">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><FileText size={20} /></div>
          <div className="stat-body">
            <span className="stat-label">Total</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-amber"><Clock size={20} /></div>
          <div className="stat-body">
            <span className="stat-label">Pending</span>
            <span className="stat-value">{stats.pending}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><CheckCircle size={20} /></div>
          <div className="stat-body">
            <span className="stat-label">Approved</span>
            <span className="stat-value">{stats.approved}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-red"><XCircle size={20} /></div>
          <div className="stat-body">
            <span className="stat-label">Rejected</span>
            <span className="stat-value">{stats.rejected}</span>
          </div>
        </div>
      </div>

      <div className="apps-toolbar">
        <div className="apps-tabs">
          <button
            className={`apps-tab ${applicationType === 'creators' ? 'active' : ''}`}
            onClick={() => setApplicationType('creators')}
          >
            <Users size={16} />
            Creators
          </button>
          <button
            className={`apps-tab ${applicationType === 'brands' ? 'active' : ''}`}
            onClick={() => setApplicationType('brands')}
          >
            <Briefcase size={16} />
            Brands
          </button>
        </div>

        <div className="apps-controls">
          <div className="apps-search">
            <Search size={16} />
            <input
              type="text"
              placeholder={`Search ${applicationType === 'creators' ? 'creators' : 'brands'}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select className="apps-select" value={filterState} onChange={(e) => setFilterState(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {categories.length > 0 && (
            <select className="apps-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="apps-skeleton-list">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="apps-skeleton-row" />
          ))}
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="apps-empty">
          <CheckCircle size={56} />
          <h3>No applications found</h3>
          <p>Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="apps-list">
          {filteredApplications.map(app => {
            const name = applicationType === 'creators' ? app.nickname : app.business_name;
            const email = applicationType === 'creators' ? app.email : app.business_email;
            const category = applicationType === 'creators' ? app.category : app.business_profile?.industry;
            return (
              <div key={app.id} className="apps-row" onClick={() => setSelectedApplication(app)}>
                <div className="apps-row-identity">
                  <div className="apps-avatar" style={{ background: avatarColor(name || '') }}>
                    {getInitials(name)}
                  </div>
                  <div className="apps-name-block">
                    <h4>{name}</h4>
                    <span className={`apps-status apps-status-${app.status}`}>
                      {app.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="apps-row-meta">
                  <div className="apps-meta">
                    <span className="apps-meta-label">Email</span>
                    <span className="apps-meta-value" title={email}>{email}</span>
                  </div>
                  <div className="apps-meta">
                    <span className="apps-meta-label">Category</span>
                    <span className="apps-meta-value">{category || '—'}</span>
                  </div>
                  <div className="apps-meta">
                    <span className="apps-meta-label">Submitted</span>
                    <span className="apps-meta-value">{new Date(app.submitted_date).toLocaleDateString()}</span>
                  </div>
                  <div className="apps-meta">
                    <span className="apps-meta-label">SLA</span>
                    <span className={`apps-meta-value ${app.sla_remaining_days <= 1 ? 'apps-sla-urgent' : ''}`}>
                      {app.sla_remaining_days != null ? `${app.sla_remaining_days}d left` : '—'}
                    </span>
                  </div>
                </div>

                <button className="apps-row-action" onClick={(e) => { e.stopPropagation(); setSelectedApplication(app); }}>
                  View <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ApplicationsPage;
