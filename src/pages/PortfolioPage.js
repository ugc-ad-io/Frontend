import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Bookmark,
  Briefcase,
  FileCheck,
  IndianRupee,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Star,
  Upload,
  User,
  X,
  Zap,
  Plus,
  Clock
} from 'lucide-react';
import { EmptyPanel } from '../components/CreatorComponents';
import DashboardLayout from '../components/DashboardLayout';
import './CreatorDashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function getPortfolioAssetUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const baseUrl = BACKEND_URL || window.location.origin;
  return `${baseUrl.replace(/\/$/, '')}/${String(url).replace(/^\//, '')}`;
}

function isVideoUrl(url) {
  return /\.(mp4|webm|mov)$/i.test(String(url || '').split('?')[0]);
}

function PortfolioMedia({ url, index }) {
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const assetUrl = getPortfolioAssetUrl(url);
  const isVideo = isVideoUrl(url);

  useEffect(() => {
    return () => {
      if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
    };
  }, [fallbackUrl]);

  const loadWithAuth = async () => {
    if (fallbackUrl || failed) return;
    try {
      const response = await axios.get(assetUrl, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      setFallbackUrl(objectUrl);
    } catch (error) {
      console.warn('[Portfolio] Failed to load media:', assetUrl, error?.message);
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <div className="pcd-portfolio-fallback">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
          color: '#6b7280',
          padding: '20px',
          gap: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '36px', opacity: 0.5 }}>🖼️</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Media not available</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.4 }}>
            File may have been removed from the server. Try re-uploading.
          </div>
        </div>
      </div>
    );
  }

  if (isVideo) {
    return <video src={fallbackUrl || assetUrl} controls onError={loadWithAuth} />;
  }

  return <img src={fallbackUrl || assetUrl} alt={`Portfolio item ${index + 1}`} loading="lazy" onError={loadWithAuth} />;
}

// Convert legacy string entries to objects, leave object entries as-is
function normalizePortfolio(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item) return { urls: [], title: '', description: '', project_cost: '', project_duration: '' };
    if (typeof item === 'string') {
      return { urls: [item], title: '', description: '', project_cost: '', project_duration: '' };
    }
    if (typeof item !== 'object') {
      return { urls: [], title: '', description: '', project_cost: '', project_duration: '' };
    }
    // Migrate old single-url items to urls array
    const urls = Array.isArray(item.urls)
      ? item.urls.filter((u) => typeof u === 'string')
      : (typeof item.url === 'string' ? [item.url] : []);
    return {
      urls,
      title: typeof item.title === 'string' ? item.title : '',
      description: typeof item.description === 'string' ? item.description : '',
      project_cost: typeof item.project_cost === 'string' ? item.project_cost : '',
      project_duration: typeof item.project_duration === 'string' ? item.project_duration : ''
    };
  });
}

export default function PortfolioPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    urls: [],
    title: '',
    description: '',
    project_cost: '',
    project_duration: ''
  });

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/creator') },
    { name: 'Create a Gig', icon: Upload, action: () => navigate('/create-gig') },
    { name: 'My Active Work', icon: Zap, action: () => navigate('/my-active-work') },
    { name: 'My Bids', icon: Bookmark, action: () => navigate('/my-bids') },
    { name: 'Reviews', icon: Star, action: () => navigate('/reviews') },
    { name: 'Portfolio', icon: User, action: () => {}, active: true },
    { name: 'Browse Briefs', icon: Briefcase, action: () => navigate('/browse-briefs') },
    { name: 'My Deals', icon: FileCheck, action: () => navigate('/my-deals') },
    { name: 'Messages', icon: MessageSquare, action: () => navigate('/messages') },
    { name: 'Payout', icon: IndianRupee, action: () => navigate('/withdrawal') },
    { name: 'Settings', icon: Settings, action: () => navigate('/settings') },
  ];

  // Load portfolio from user once; we don't auto-refresh from /auth/me to avoid races
  useEffect(() => {
    setPortfolio(normalizePortfolio(user?.portfolio));
    setLoading(false);
  }, [user?.portfolio]);

  const resetForm = () => {
    setFormData({ urls: [], title: '', description: '', project_cost: '', project_duration: '' });
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (formData.urls.length + files.length > 10) {
      toast.error('Maximum 10 files per portfolio item');
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} is too large. Maximum 50MB per file.`);
          continue;
        }
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        const response = await axios.post(`${API}/upload/file`, formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        let fileUrl = response.data?.file_url || response.data?.url;
        if (fileUrl && fileUrl.startsWith('/')) {
          fileUrl = `${BACKEND_URL}${fileUrl}`;
        }
        if (fileUrl) uploadedUrls.push(fileUrl);
      }

      if (uploadedUrls.length) {
        setFormData((prev) => ({ ...prev, urls: [...prev.urls, ...uploadedUrls] }));
        toast.success(`${uploadedUrls.length} file(s) uploaded`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Failed to upload file(s)');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveUploadedFile = (urlToRemove) => {
    setFormData((prev) => ({ ...prev, urls: prev.urls.filter((u) => u !== urlToRemove) }));
  };

  const handleSavePortfolioItem = async () => {
    if (!formData.urls.length) {
      toast.error('Please upload at least one image or video');
      return;
    }
    if (!formData.title?.trim()) {
      toast.error('Please enter a title');
      return;
    }

    const newItem = {
      urls: formData.urls,
      title: formData.title.trim(),
      description: (formData.description || '').trim(),
      project_cost: (formData.project_cost || '').trim(),
      project_duration: (formData.project_duration || '').trim()
    };

    setSaving(true);
    try {
      const nextPortfolio = [...portfolio, newItem];
      await axios.patch(`${API}/profile/portfolio`, nextPortfolio);
      setPortfolio(nextPortfolio);
      // Also update user context so other pages see the update
      if (setUser && user) {
        setUser({ ...user, portfolio: nextPortfolio });
      }
      toast.success('Portfolio item added');
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Save portfolio error:', error);
      const detail = error.response?.data?.detail;
      const errMsg = Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
        : (detail || error.message || 'Failed to save portfolio item');
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePortfolioItem = async (itemIndex) => {
    try {
      const nextPortfolio = portfolio.filter((_, idx) => idx !== itemIndex);
      await axios.patch(`${API}/profile/portfolio`, nextPortfolio);
      setPortfolio(nextPortfolio);
      if (setUser && user) {
        setUser({ ...user, portfolio: nextPortfolio });
      }
      toast.success('Portfolio item removed');
    } catch (error) {
      console.error('Remove portfolio error:', error);
      toast.error('Failed to remove portfolio item');
    }
  };

  return (
    <DashboardLayout
      navItems={navItems}
      title="Portfolio"
      description="Showcase your best work"
      topbarExtra={null}
      sidebarExtra={null}
    >
      {loading ? (
        <div className="pcd-empty-panel">Loading...</div>
      ) : (
        <div>
          <div className="pcd-portfolio-head">
            <h2>My Portfolio</h2>
            <button
              type="button"
              className="portfolio-add-btn"
              onClick={() => { resetForm(); setShowModal(true); }}
            >
              <Plus size={16} /> Add Work
            </button>
          </div>

          <div className="portfolio-grid-rich">
            {portfolio.length ? portfolio.map((item, index) => (
              <article key={index} className="portfolio-card">
                <div className="portfolio-card-media">
                  <PortfolioMedia url={item.urls?.[0] || ''} index={index} />
                  {item.urls?.length > 1 && (
                    <div className="portfolio-card-count">+{item.urls.length - 1}</div>
                  )}
                </div>
                <div className="portfolio-card-body">
                  {item.title && <h3 className="portfolio-card-title">{item.title}</h3>}
                  {item.description && <p className="portfolio-card-description">{item.description}</p>}
                  <div className="portfolio-card-meta">
                    {item.project_cost && (
                      <div className="portfolio-card-meta-item">
                        <span className="meta-label">Project Cost</span>
                        <span className="meta-value">{item.project_cost}</span>
                      </div>
                    )}
                    {item.project_duration && (
                      <div className="portfolio-card-meta-item">
                        <Clock size={14} />
                        <span>{item.project_duration}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="portfolio-remove-btn"
                    onClick={() => handleRemovePortfolioItem(index)}
                  >
                    <X size={14} /> Remove
                  </button>
                </div>
              </article>
            )) : <EmptyPanel text="No portfolio items yet. Click 'Add Work' to upload your first piece." />}
          </div>
        </div>
      )}

      {showModal && (
        <div className="portfolio-modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="portfolio-modal" onClick={(e) => e.stopPropagation()}>
            <div className="portfolio-modal-header">
              <h2>Add Portfolio Item</h2>
              <button
                type="button"
                className="portfolio-modal-close"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <div className="portfolio-modal-body">
              <div className="portfolio-form-field">
                <label>Upload Images / Videos * (up to 10)</label>
                <div className="portfolio-multi-upload">
                  {formData.urls.map((url, idx) => (
                    <div key={idx} className="portfolio-multi-preview">
                      {isVideoUrl(url) ? (
                        <video src={url} muted />
                      ) : (
                        <img src={url} alt={`Preview ${idx + 1}`} />
                      )}
                      <button
                        type="button"
                        className="portfolio-preview-remove"
                        onClick={() => handleRemoveUploadedFile(url)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {formData.urls.length < 10 && (
                    <label className="portfolio-upload-tile">
                      <Plus size={20} />
                      <span>{uploading ? 'Uploading...' : 'Add files'}</span>
                      <small>Max 50MB each</small>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="portfolio-form-field">
                <label>Title *</label>
                <input
                  type="text"
                  placeholder="e.g., UGC Video for Tossit Game"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  maxLength={120}
                />
              </div>

              <div className="portfolio-form-field">
                <label>Description</label>
                <textarea
                  placeholder="Describe the project, your role, and what you delivered..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  maxLength={1000}
                />
              </div>

              <div className="portfolio-form-row">
                <div className="portfolio-form-field">
                  <label>Project Cost</label>
                  <input
                    type="text"
                    placeholder="e.g., $200-$400"
                    value={formData.project_cost}
                    onChange={(e) => setFormData((prev) => ({ ...prev, project_cost: e.target.value }))}
                    maxLength={50}
                  />
                </div>

                <div className="portfolio-form-field">
                  <label>Project Duration</label>
                  <input
                    type="text"
                    placeholder="e.g., 1-7 days"
                    value={formData.project_duration}
                    onChange={(e) => setFormData((prev) => ({ ...prev, project_duration: e.target.value }))}
                    maxLength={50}
                  />
                </div>
              </div>
            </div>

            <div className="portfolio-modal-footer">
              <button
                type="button"
                className="portfolio-btn-cancel"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="portfolio-btn-save"
                onClick={handleSavePortfolioItem}
                disabled={saving || uploading || formData.urls.length === 0}
              >
                {saving ? 'Saving...' : 'Add to Portfolio'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .portfolio-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: #07074e;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .portfolio-add-btn:hover { background: #1a1a6b; }

        .portfolio-grid-rich {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }

        .portfolio-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
          transition: box-shadow 0.2s, transform 0.2s;
          display: flex;
          flex-direction: column;
        }
        .portfolio-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }

        .portfolio-card-media {
          width: 100%;
          height: 200px;
          background: #f3f4f6;
          overflow: hidden;
        }
        .portfolio-card-media img,
        .portfolio-card-media video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .portfolio-card-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .portfolio-card-title {
          font-size: var(--fs-h3);
          font-weight: var(--fw-head);
          color: #111827;
          margin: 0;
          line-height: 1.3;
        }

        .portfolio-card-description {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .portfolio-card-meta {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: auto;
          padding-top: 8px;
        }

        .portfolio-card-meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #4b5563;
        }

        .portfolio-card-meta-item .meta-label {
          font-size: 11px;
          color: #9ca3af;
          text-transform: uppercase;
          font-weight: 600;
        }

        .portfolio-card-meta-item .meta-value {
          font-weight: 600;
          color: #111827;
          margin-left: 4px;
        }

        .portfolio-remove-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: transparent;
          color: #ef4444;
          border: 1px solid #fecaca;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          align-self: flex-start;
          margin-top: 8px;
          transition: all 0.2s;
        }
        .portfolio-remove-btn:hover {
          background: #fef2f2;
          border-color: #ef4444;
        }

        .portfolio-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .portfolio-modal {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .portfolio-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .portfolio-modal-header h2 {
          margin: 0;
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
          color: #111827;
        }

        .portfolio-modal-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
          border-radius: 4px;
        }
        .portfolio-modal-close:hover { background: #f3f4f6; }

        .portfolio-modal-body {
          padding: 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .portfolio-form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .portfolio-form-field label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .portfolio-form-field input,
        .portfolio-form-field textarea {
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          color: #111827;
        }
        .portfolio-form-field input:focus,
        .portfolio-form-field textarea:focus {
          outline: none;
          border-color: #07074e;
          box-shadow: 0 0 0 3px rgba(7,7,78,0.1);
        }

        .portfolio-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .portfolio-multi-upload {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 10px;
        }

        .portfolio-multi-preview {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
        }
        .portfolio-multi-preview img,
        .portfolio-multi-preview video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .portfolio-upload-tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          aspect-ratio: 1;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          background: #f9fafb;
          cursor: pointer;
          color: #6b7280;
          transition: all 0.2s;
          text-align: center;
          padding: 8px;
        }
        .portfolio-upload-tile:hover {
          border-color: #07074e;
          background: #f3f4f6;
        }
        .portfolio-upload-tile input { display: none; }
        .portfolio-upload-tile span { font-size: 12px; font-weight: 500; }
        .portfolio-upload-tile small { font-size: 10px; color: #9ca3af; }

        .portfolio-preview-remove {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0,0,0,0.7);
          color: white;
          border: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .portfolio-preview-remove:hover {
          background: #ef4444;
        }

        .portfolio-card-media {
          position: relative;
        }
        .portfolio-card-count {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .portfolio-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .portfolio-btn-cancel,
        .portfolio-btn-save {
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }

        .portfolio-btn-cancel {
          background: white;
          color: #374151;
          border: 1px solid #d1d5db;
        }
        .portfolio-btn-cancel:hover { background: #f3f4f6; }

        .portfolio-btn-save {
          background: #07074e;
          color: white;
        }
        .portfolio-btn-save:hover:not(:disabled) { background: #1a1a6b; }
        .portfolio-btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .portfolio-form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
