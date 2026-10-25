import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { downloadDeliverable } from '../utils/downloadDeliverable';
import { ArrowLeft, CheckCircle, MessageCircle, Star, Download, Lock, Paperclip } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import '../styles/brand-ui.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const PAGE_CSS = `
        .work-review-page {
          color: #07074e;
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
          min-height: 100dvh;
          background: #f3f3ff;
          padding: 32px clamp(16px, 3vw, 32px) 48px;
          box-sizing: border-box;
        }
        /* inside the brand shell the shell supplies the page background */
        .work-review-page.in-shell .page-header,
        .work-review-page.in-shell .review-container { margin-left: 0; margin-right: 0; max-width: 1100px; }
        .work-review-page.in-shell {
          min-height: 0;
          background: transparent;
          padding: 4px 0 24px;
        }
        .work-review-page.is-embed {
          min-height: 0;
          background: transparent;
          padding: 0;
        }

        .work-review-page .loading-page,
        .work-review-page .error-page,
        .loading-page,
        .error-page {
          min-height: 50vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: #6e6e96;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .error-page { color: #07074e; }

        .work-review-page .page-header {
          max-width: 1000px;
          margin: 0 auto 14px;
        }

        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 12px 0 6px;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: #4e60e6;
          font: inherit;
          font-size: 14.5px;
          font-weight: 600;
          cursor: pointer;
        }
        .back-btn:hover { background: #eef0ff; }

        .review-container {
          max-width: 1000px;
          margin: 0 auto;
          background: #fff;
          padding: 28px;
          border-radius: 20px;
          box-shadow: 0 1px 2px rgba(7, 7, 78, .05), 0 10px 26px -18px rgba(7, 7, 78, .28);
        }
        .work-review-page.is-embed .review-container { box-shadow: inset 0 0 0 1px #e2e2f0; }

        .review-header {
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid #edeef6;
        }

        .review-header h1 {
          font-family: 'Readex Pro', 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(26px, 3vw, 32px);
          font-weight: 500;
          letter-spacing: -.03em;
          color: #07074e;
          margin: 0;
          line-height: 1.15;
        }

        .review-header p {
          color: #5a5a8c;
          font-size: 15px;
          margin: 6px 0 0;
        }

        .review-header .creator-info {
          color: #07074e;
          font-weight: 600;
        }

        .work-section {
          margin-bottom: 24px;
        }

        .work-section h3 {
          font-family: 'Readex Pro', 'Plus Jakarta Sans', sans-serif;
          font-size: 17px;
          font-weight: 500;
          color: #07074e;
          margin: 0 0 12px;
        }

        .work-description {
          color: #07074e;
          font-size: 14.5px;
          line-height: 1.65;
          padding: 16px 18px;
          background: #f6f6fd;
          border-radius: 16px;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .files-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
          gap: 16px;
        }

        .file-preview {
          padding: 14px;
          background: #f6f6fd;
          border-radius: 16px;
          text-align: center;
        }

        .file-icon {
          display: grid;
          place-items: center;
          height: 96px;
          margin-bottom: 12px;
          border-radius: 12px;
          background: #fff;
          color: #9f9fd1;
        }

        .file-media {
          width: 100%;
          max-height: 260px;
          object-fit: contain;
          border-radius: 12px;
          margin-bottom: 12px;
          background: #07074e;
          display: block;
        }

        .file-media-wrap {
          position: relative;
          margin-bottom: 12px;
        }

        .file-media-wrap .file-media {
          margin-bottom: 0;
        }

        /* Corner watermark - the UGCad.io logo. */
        .file-watermark {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-repeat: no-repeat;
          background-position: top 10px right 12px;
          background-size: 46px auto;
          background-image: url("/ugcad-logo_-_Edited-removebg-preview.png");
        }

        .watermark-note {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fff2dc;
          color: #8a4b00;
          font-size: 13.5px;
          font-weight: 500;
          padding: 10px 14px;
          border-radius: 12px;
          margin: 0 0 14px;
        }
        .watermark-note svg { flex: none; }

        .file-name {
          color: #5a5a8c;
          font-size: 13px;
          margin: 0 0 12px;
          word-break: break-all;
        }

        .view-link {
          display: inline-flex;
          align-items: center;
          height: 36px;
          padding: 0 16px;
          background: #fff;
          color: #07074e;
          border: 1px solid #c9cbea;
          border-radius: 999px;
          text-decoration: none;
          font-weight: 600;
          font-size: 13.5px;
        }

        .view-link:hover {
          background: #f3f3ff;
        }

        .action-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 28px;
          padding-top: 24px;
          border-top: 1px solid #edeef6;
        }

        .approved-panel {
          margin-top: 28px;
          padding-top: 24px;
          border-top: 1px solid #edeef6;
          display: grid;
          gap: 14px;
        }

        .approved-note {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #e4f5ec;
          color: #13774f;
          font-weight: 600;
          font-size: 14.5px;
          padding: 12px 16px;
          border-radius: 12px;
          margin: 0;
        }
        .approved-note svg { flex: none; }

        .btn-download,
        .btn-approve,
        .btn-revision {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 48px;
          padding: 0 20px;
          border-radius: 999px;
          font: inherit;
          font-weight: 700;
          font-size: 14.5px;
          cursor: pointer;
          border: 1px solid transparent;
        }
        .btn-download,
        .btn-approve { background: #07074e; color: #fff; }
        .btn-download:hover,
        .btn-approve:hover { background: #12124f; }
        .btn-revision { background: #fff; color: #07074e; border-color: #c9cbea; }
        .btn-revision:hover { background: #f3f3ff; }

        /* Dialogs: same shell as the review / revision dialogs elsewhere. */
        .work-review-page .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(7, 7, 78, .45);
          -webkit-backdrop-filter: blur(3px);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1200;
          padding: max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom));
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .work-review-page .modal-content {
          background: #fff;
          padding: 26px 24px 22px;
          border-radius: 20px;
          box-shadow: 0 40px 80px -30px rgba(7, 7, 78, .6);
          max-width: 480px;
          width: 100%;
          box-sizing: border-box;
          max-height: calc(100dvh - 48px);
          overflow-y: auto;
          color: #07074e;
        }

        .work-review-page .modal-content h2 {
          font-family: 'Readex Pro', 'Plus Jakarta Sans', sans-serif;
          font-size: 20px;
          font-weight: 500;
          color: #07074e;
          margin: 0 0 16px;
        }

        .work-review-page .form-group { display: flex; flex-direction: column; gap: 8px; margin: 0; }
        .work-review-page .form-group label { font-size: 13px; font-weight: 700; color: #07074e; }
        .work-review-page .textarea-field {
          width: 100%;
          box-sizing: border-box;
          min-height: 110px;
          padding: 12px 14px;
          font: inherit;
          font-size: 14px;
          color: #07074e;
          background: #f6f6fd;
          border: 1.5px solid transparent;
          border-radius: 16px;
          outline: none;
          resize: vertical;
        }
        .work-review-page .textarea-field:focus { background: #fff; border-color: #7387ff; box-shadow: 0 0 0 3px rgba(115, 135, 255, .2); }

        .review-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .star-rating {
          display: flex;
          gap: 6px;
          justify-content: center;
        }

        .star {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          line-height: 0;
          color: #c7cbe0;
        }

        .star.active {
          color: #f5b301;
        }
        .star.active svg { fill: #f5b301; }

        .work-review-page .modal-actions {
          display: flex;
          gap: 10px;
          margin-top: 16px;
        }

        .work-review-page .modal-actions button {
          flex: 1;
          height: 48px;
          padding: 0 20px;
          border-radius: 999px;
          font: inherit;
          font-weight: 700;
          font-size: 14.5px;
          cursor: pointer;
          box-shadow: none;
          transform: none;
        }
        .work-review-page .modal-actions .btn-primary { background: #07074e; color: #fff; border: 1px solid transparent; }
        .work-review-page .modal-actions .btn-primary:hover { background: #12124f; }
        .work-review-page .modal-actions .btn-secondary { background: #fff; color: #07074e; border: 1px solid #c9cbea; }
        .work-review-page .modal-actions .btn-secondary:hover { background: #f3f3ff; color: #07074e; }

        @media (max-width: 768px) {
          .review-container {
            padding: 22px 18px;
          }

          .action-buttons {
            grid-template-columns: 1fr;
          }

          /* 16px stops the iOS focus-zoom on the revision / review textareas. */
          .work-review-page textarea,
          .work-review-page input {
            font-size: 16px;
          }
          .back-btn,
          .view-link {
            min-height: 44px;
            box-sizing: border-box;
          }
        }

        @media (max-width: 480px) {
          .work-review-page:not(.in-shell):not(.is-embed) {
            padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px));
          }
          .review-container {
            padding: 18px 14px;
          }
          .work-description {
            padding: 14px;
          }
          .work-review-page .modal-overlay { padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom)); }
          .work-review-page .modal-content {
            padding: 22px 16px 18px;
            max-height: calc(100dvh - 24px);
          }
          .work-review-page .modal-actions {
            flex-direction: column-reverse;
          }
        }
`;

export default function WorkReview({ embedId, onClose }) {
  const params = useParams();
  const workId = embedId || params.id;
  const navigate = useNavigate();
  const goBack = () => (onClose ? onClose() : navigate(-1));
  const { user } = useAuth();
  // Opened as its own page (not embedded in the dashboard modal): sit inside the brand shell.
  const wrap = (node) => (onClose ? node : <BrandTopNavLayout>{node}</BrandTopNavLayout>);
  const [work, setWork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [revisionFeedback, setRevisionFeedback] = useState('');

  useLiveEffect(() => {
    const fetchWork = async () => {
      try {
        const response = await axios.get(`${API}/work/${workId}`);
        setWork(response.data);
      } catch (error) {
        console.error('Failed to fetch work:', error);
        toast.error('Failed to load work submission');
      } finally {
        setLoading(false);
      }
    };

    if (workId) {
      fetchWork();
    }
  }, [workId]);

  const handleApprove = async () => {
    try {
      const res = await axios.post(`${API}/work/${workId}/approve`);
      toast.success(res.data?.message || 'Content approved. The creator has been paid.');
      // Stay on the page in an "approved" state so the brand can download the clean file.
      setWork((prev) => prev ? { ...prev, status: 'approved', watermark_protected: false, can_download: true } : prev);
      if (res.data?.payout_status === 'released' && work?.stage !== 'raw') setShowReviewModal(true);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to approve work'));
    }
  };

  const handleDownload = async () => {
    try {
      await downloadDeliverable(API, workId, work?.campaign_title);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Download failed'));
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionFeedback.trim()) {
      toast.error('Please provide feedback for revision');
      return;
    }

    try {
      const { data } = await axios.post(`${API}/work/${workId}/request-revision`, { feedback: revisionFeedback });
      // Say so when money actually moved - a bare "Revision requested" hid the wallet debit.
      toast.success(data?.paid
        ? `Revision requested - ₹${data.fee_charged} charged. Wallet balance: ₹${Math.round(data.new_balance)}.`
        : 'Revision requested');
      setShowRevisionModal(false);
      goBack();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to request revision'));
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/reviews`, {
        campaign_id: work.campaign_id,
        creator_id: work.creator_id,
        rating,
        review
      });
      toast.success('Review submitted!');
      setShowReviewModal(false);
      goBack();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to submit review'));
    }
  };

  if (loading) return wrap(<div className="loading-page"><style>{PAGE_CSS}</style>Loading...</div>);
  if (!work) return wrap(
    <div className="error-page" style={{ flexDirection: 'column', gap: 16, padding: 16, textAlign: 'center' }}>
      <style>{PAGE_CSS}</style>
      <span>Couldn't load this submission. It may have been removed, or the connection dropped.</span>
      <button type="button" className="back-btn" onClick={goBack}><ArrowLeft size={18} /> Back</button>
    </div>
  );

  return wrap(
    <div className={`work-review-page ${onClose ? 'is-embed' : 'in-shell'}`}>
      <div className="page-header">
        <button className="back-btn" onClick={goBack} data-testid="back-btn">
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      <div className="review-container fade-in">
        <div className="review-header">
          <h1>Review Submitted Work</h1>
          <p>Campaign: {work.campaign_title}</p>
          <p className="creator-info">By {String(work.creator_name || work.creator_nickname || 'Creator').replace(/^@+/, '').trim().split(/\s+/)[0]}</p>
        </div>

        <div className="work-section">
          <h3>Work Description</h3>
          <p className="work-description">{work.description}</p>
        </div>

        <div className="work-section">
          <h3>Submitted Files</h3>
          {work.watermark_protected && (
            <p className="watermark-note"><Lock size={15} /> Watermarked preview - the clean original is released to you after you approve.</p>
          )}
          <div className="files-grid">
            {(work.work_files || []).length === 0 && (
              <p className="work-description">No files were attached to this submission.</p>
            )}
            {(work.work_files || []).map((file, idx) => {
              const url = String(file).startsWith('http') ? file : `${BACKEND_URL}${file}`;
              const ext = String(file).toLowerCase().split('?')[0].split('.').pop();
              const isVideo = ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'].includes(ext);
              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
              return (
                <div key={idx} className="file-preview" data-testid={`file-${idx}`}>
                  {isVideo || isImage ? (
                    <div className="file-media-wrap">
                      {isVideo ? (
                        <video src={url} controls controlsList={work.watermark_protected ? 'nodownload' : undefined} className="file-media" />
                      ) : (
                        <img src={url} alt={`Submission ${idx + 1}`} className="file-media" />
                      )}
                      {work.watermark_protected && (
                        <span className="file-watermark" aria-hidden="true" />
                      )}
                    </div>
                  ) : (
                    <div className="file-icon"><Paperclip size={32} /></div>
                  )}
                  <p className="file-name">{decodeURIComponent(String(file).split('/').pop() || `File ${idx + 1}`)}</p>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="view-link">
                    Open in new tab
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {(work.status === 'approved' || work.can_download) ? (
          <div className="approved-panel">
            <p className="approved-note"><CheckCircle size={18} /> Approved - payment released. The clean, watermark-free file is now yours to download.</p>
            <button className="btn-download" onClick={handleDownload} data-testid="download-btn">
              <Download size={18} /> Download Video
            </button>
          </div>
        ) : (
          <div className="action-buttons">
            <button
              className="btn-approve"
              onClick={handleApprove}
              data-testid="approve-btn"
            >
              <CheckCircle size={18} /> Approve & Release Payment
            </button>
            <button
              className="btn-revision"
              onClick={() => setShowRevisionModal(true)}
              data-testid="revision-btn"
            >
              <MessageCircle size={18} /> Request Revision
            </button>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Leave a Review</h2>
            <form onSubmit={handleSubmitReview} className="review-form">
              <div className="form-group">
                <label>Rating</label>
                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`star ${star <= rating ? 'active' : ''}`}
                      data-testid={`star-${star}`}
                    >
                      <Star size={30} fill={star <= rating ? '#f5b301' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="review">Your Review</label>
                <textarea
                  id="review"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  className="textarea-field"
                  placeholder="Share your experience working with this creator..."
                  required
                  data-testid="review-input"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowReviewModal(false)}>
                  Skip
                </button>
                <button type="submit" className="btn-primary" data-testid="submit-review-btn">
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {showRevisionModal && (
        <div className="modal-overlay" onClick={() => setShowRevisionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Request Revision</h2>
            <div className="form-group">
              <label htmlFor="feedback">Revision Feedback</label>
              <textarea
                id="feedback"
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                className="textarea-field"
                placeholder="Explain what changes you'd like to see..."
                data-testid="feedback-input"
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowRevisionModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleRequestRevision} data-testid="submit-revision-btn">
                Send Revision Request
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{PAGE_CSS}</style>
    </div>
  );
}