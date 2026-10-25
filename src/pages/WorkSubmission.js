import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { uploadMedia } from '../utils/upload';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { ArrowLeft, Upload, FileVideo, Image as ImageIcon, RefreshCw } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

/**
 * One labelled upload zone. Extracted because a brief that asks for an edited cut
 * needs TWO of these (edited + raw) and duplicating the markup three times is how
 * the two zones would drift apart.
 */
function UploadZone({ id, title, hint, files, onUpload, onRemove, testIdPrefix, btnTestId }) {
  return (
    <div className="upload-section">
      <h3><Upload size={20} /> {title}</h3>
      <p className="hint">{hint}</p>

      <input
        id={id}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={onUpload}
        style={{ display: 'none' }}
        data-testid={`${testIdPrefix}-input`}
      />
      <button
        type="button"
        className="upload-btn"
        onClick={() => document.getElementById(id).click()}
        data-testid={btnTestId || `${testIdPrefix}-btn`}
      >
        <FileVideo size={24} />
        Click to Upload Files
      </button>

      {files.length > 0 && (
        <div className="files-list">
          <h4>Uploaded Files:</h4>
          {files.map((file, idx) => (
            <div key={idx} className="file-item" data-testid={`${testIdPrefix}-${idx}`}>
              <div className="file-info">
                <ImageIcon size={20} />
                <span>{file.split('/').pop()}</span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="remove-btn"
                data-testid={`remove-${testIdPrefix}-${idx}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// This quick form only knows "upload files + note". The backend (POST /work/submit) also runs a
// raw -> edited stage flow and rejects a brief that needs a caption/script or thumbnail with
// "Missing required assets" - the Deal Room handles those, so send the creator there instead.
export const needsDealRoom = (c) => {
  if (!c) return false;
  const rules = c.content_requirements || c.shipment_checklist || {};
  return (c.deliverable_items || []).some((d) => d && d.edited_required)
    || !!(rules.caption_script || rules.caption || c.caption_required || rules.thumbnail || c.thumbnail_required);
};

export default function WorkSubmission() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaign');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  // Only used when the brief asks for an edited cut (see needsEdited below). Kept
  // separate from `files` so a brief that does NOT ask for one submits exactly as it
  // always did, through the single generic zone.
  const [editedFiles, setEditedFiles] = useState([]);
  const [rawFiles, setRawFiles] = useState([]);
  // Blocks double taps while a request (upload or submit) is running.
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Does this brief ask for a finished cut on top of the raw footage? Any ONE
  // deliverable row asking for it is enough - the creator then owes both and gets the
  // second upload slot. Read off `campaign` defensively: this runs before the fetch
  // resolves, and an older brief saved before the field existed simply reads false, so
  // nothing about its submission changes.
  const needsEdited = (campaign?.deliverable_items || []).some((d) => d && d.edited_required);
  const dealRoom = needsDealRoom(campaign);
  useEffect(() => {
    if (dealRoom) navigate(`/my-deals?campaign=${encodeURIComponent(campaignId)}&tab=deliverables`, { replace: true });
  }, [dealRoom, campaignId, navigate]);

  useLiveEffect(() => {
    if (campaignId) {
      fetchCampaign();
    } else {
      // No ?campaign= in the link: show "not found" instead of loading forever.
      setLoading(false);
    }
  }, [campaignId]);

  const fetchCampaign = async () => {
    try {
      const response = await axios.get(`${API}/campaigns/${campaignId}`);
      setCampaign(response.data);
    } catch (error) {
      toast.error('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  // Curried so each zone gets its own setter while sharing one upload path - the
  // 400MB cap and the error handling must not diverge between zones.
  const uploadInto = (setter) => async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(selectedFiles.map(async (file) => {
        // uploadMedia refuses a video over 400 MB with a readable message and sends
        // anything big straight to S3 instead of through the size-limited server.
        const data = await uploadMedia(file, API);
        return data.file_url;
      }));

      setter((prev) => [...prev, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} file(s) uploaded successfully!`);
    } catch (error) {
      toast.error(error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
    e.target.value = '';
  };

  const removeFrom = (setter) => (index) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || uploading) return;

    // Edited cut first: the backend treats work_files[0] as the primary video (it is
    // what gets watermarked and what the brand's review screen plays), so the finished
    // cut has to lead - never the raw footage.
    const allFiles = needsEdited ? [...editedFiles, ...rawFiles] : files;

    if (needsEdited) {
      if (editedFiles.length === 0) {
        toast.error('This brief needs an edited file. Upload the finished cut.');
        return;
      }
      if (rawFiles.length === 0) {
        toast.error('Upload the raw footage as well.');
        return;
      }
    } else if (allFiles.length === 0) {
      toast.error('Please upload at least one file');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/work/submit`, {
        campaign_id: campaignId,
        work_files: allFiles,
        edited_files: needsEdited ? editedFiles : [],
        raw_files: needsEdited ? rawFiles : [],
        description
      });
      toast.success('Work submitted successfully!');
      // Wait a moment for backend to update, then navigate
      setTimeout(() => {
        navigate('/my-active-work');
      }, 1000);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to submit work'));
      setSubmitting(false);
    }
  };

  if (loading || dealRoom) return <div className="loading-page">Loading...</div>;
  if (!campaign) return (
    <div className="error-page" style={{ flexDirection: 'column', gap: 12, padding: 16, textAlign: 'center' }}>
      <span>Campaign not found</span>
      <button type="button" className="back-btn" onClick={() => navigate('/my-active-work')}>Back to Active Work</button>
      <style>{`.error-page{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;color:#6e6e96}.back-btn{display:flex;align-items:center;gap:8px;padding:0 24px;min-height:44px;background:#fff;border:0;box-shadow:inset 0 0 0 1px #e2e2f0;border-radius:12px;color:#07074e;font-weight:600;cursor:pointer}`}</style>
    </div>
  );

  // What the brand asked for. The creator had no way to see this — the feedback
  // was written to the campaign's work_submission and never rendered anywhere on
  // their side, so "revision requested" told them to redo the work without ever
  // saying what was wrong.
  const ws = campaign.work_submission || {};
  const revisionRequested = ws.status === 'revision_requested';
  const requestedChanges = Array.isArray(ws.requested_changes) ? ws.requested_changes.filter(Boolean) : [];

  return (
    <div className="work-submission-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/my-active-work'))} data-testid="back-btn">
          <ArrowLeft size={20} /> Back
        </button>
      </div>

      <div className="submission-container fade-in">
        <div className="submission-header">
          <h1>{revisionRequested ? 'Submit Your Revision' : 'Submit Your Work'}</h1>
          <p>Campaign: {campaign.title}</p>
        </div>

        {revisionRequested && (
          <section className="revision-callout" data-testid="revision-request">
            <div className="revision-callout-head">
              <RefreshCw size={18} />
              <h3>The brand asked for changes</h3>
            </div>

            {requestedChanges.length > 0 && (
              <ul className="revision-callout-list">
                {requestedChanges.map((change, i) => <li key={i}>{change}</li>)}
              </ul>
            )}

            {ws.feedback ? (
              <div className="revision-callout-note">
                <label>Their feedback</label>
                <p>{ws.feedback}</p>
              </div>
            ) : (
              !requestedChanges.length && (
                <p className="revision-callout-empty">
                  The brand didn’t leave any notes. Message them if you’re unsure what to change.
                </p>
              )
            )}

            <p className="revision-callout-foot">Upload the updated files below and submit again.</p>
          </section>
        )}

        <form onSubmit={handleSubmit} className="submission-form">
          {needsEdited ? (
            <>
              <UploadZone
                id="edited-upload"
                title="Edited file"
                hint="The finished cut, ready to publish. This brief asks for one."
                files={editedFiles}
                onUpload={uploadInto(setEditedFiles)}
                onRemove={removeFrom(setEditedFiles)}
                testIdPrefix="edited-file"
              />
              <UploadZone
                id="raw-upload"
                title="Raw file"
                hint="The unedited source footage the cut was made from."
                files={rawFiles}
                onUpload={uploadInto(setRawFiles)}
                onRemove={removeFrom(setRawFiles)}
                testIdPrefix="raw-file"
              />
            </>
          ) : (
            <UploadZone
              id="file-upload"
              title="Upload Files"
              hint="Videos, images, or any deliverables"
              files={files}
              onUpload={uploadInto(setFiles)}
              onRemove={removeFrom(setFiles)}
              testIdPrefix="file"
              /* Preserved verbatim: this zone is the unchanged single-upload path and
                 something outside this file may still select on it. */
              btnTestId="upload-file-btn"
            />
          )}

          <div className="form-group">
            <label htmlFor="description">Work Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="textarea-field"
              placeholder="Describe your work, highlight key features, mention any special considerations..."
              required
              data-testid="description-input"
            />
          </div>

          <button type="submit" className="btn-primary" data-testid="submit-work-btn" disabled={submitting || uploading}>
            {submitting ? 'Submitting...' : uploading ? 'Uploading files...' : revisionRequested ? 'Submit Revision for Review' : 'Submit Work for Review'}
          </button>
        </form>
      </div>

      <style>{`
        .work-submission-page{--ink:#07074e;--muted:#6e6e96;--line:#e2e2f0;min-height:100vh;min-height:100dvh;background:#f3f3ff;color:var(--ink);font-family:'Inter',system-ui,sans-serif;padding:32px 24px;padding-bottom:max(32px,env(safe-area-inset-bottom));box-sizing:border-box;overflow-x:hidden}
        .loading-page,.error-page{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:var(--muted)}
        .page-header{max-width:760px;margin:0 auto 16px}
        .back-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;background:#fff;border:0;box-shadow:inset 0 0 0 1px var(--line);border-radius:12px;color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
        .back-btn:hover{background:#eef0ff}
        .submission-container{max-width:760px;margin:0 auto;background:#fff;padding:28px;border-radius:16px;box-shadow:inset 0 0 0 1px #e4e5f3}
        .submission-header{margin-bottom:24px}
        .submission-header h1{margin:0 0 4px;font-family:'Readex Pro','Plus Jakarta Sans',sans-serif;font-weight:500;font-size:1.6rem;letter-spacing:-.02em;color:var(--ink)}
        .submission-header p{margin:0;color:var(--muted);font-size:.98rem;overflow-wrap:anywhere}
        .submission-form{display:flex;flex-direction:column;gap:24px}
        .upload-section{display:flex;flex-direction:column;gap:10px}
        .upload-section h3{display:flex;align-items:center;gap:8px;margin:0;font-family:'Readex Pro','Plus Jakarta Sans',sans-serif;font-weight:500;font-size:1.1rem;color:var(--ink)}
        .hint{margin:0;font-size:.875rem;color:var(--muted)}
        .upload-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:36px 20px;background:#fafaff;border:0;box-shadow:inset 0 0 0 2px #c9ceff;border-radius:14px;color:var(--ink);font:inherit;font-weight:700;cursor:pointer}
        .upload-btn:hover{background:#f1f2ff}
        .files-list{padding:14px;background:#f6f6fd;border-radius:14px}
        .files-list h4{margin:0 0 10px;font-size:.95rem;font-weight:700;color:var(--ink)}
        .file-item{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 8px 8px 12px;background:#fff;border-radius:10px;margin-bottom:8px}
        .file-info{display:flex;align-items:center;gap:12px;color:var(--ink);min-width:0}
        .file-info span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .upload-btn:disabled,.btn-primary:disabled{opacity:.5;cursor:not-allowed}
        .remove-btn{flex:none;width:44px;height:44px;background:#ffe9ea;color:#b4232a;border:0;border-radius:10px;font-size:1.4rem;cursor:pointer}
        .remove-btn:hover{background:#ffd9db}
        .form-group{display:flex;flex-direction:column;gap:8px}
        .form-group label{font-weight:700;color:var(--ink);font-size:.95rem}
        .textarea-field{width:100%;box-sizing:border-box;min-height:120px;padding:14px 16px;border:0;border-radius:14px;background:#f6f6fd;font:inherit;color:var(--ink);resize:vertical;outline:0}
        .textarea-field:focus{box-shadow:inset 0 0 0 2px #c9ceff}
        .btn-primary{min-height:48px;padding:0 24px;border:0;border-radius:999px;background:var(--ink);color:#fff;font:inherit;font-weight:700;cursor:pointer}
        .btn-primary:hover:not(:disabled){background:#12124f}
        .revision-callout{max-width:760px;margin:0 auto 20px;padding:20px 22px;border-radius:16px;background:#fff8e8;border:1px solid #fbe3b4}
        .revision-callout-head{display:flex;align-items:center;gap:9px;color:#8a4b00;margin-bottom:12px}
        .revision-callout-head h3{margin:0;font-size:1.02rem;color:#8a4b00}
        .revision-callout-list{margin:0 0 14px;padding-left:20px;color:#6b3d05;line-height:1.75;font-size:.95rem}
        .revision-callout-note label{display:block;margin-bottom:5px;font-size:.74rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8a4b00}
        .revision-callout-note p{margin:0;color:#5b3304;line-height:1.6;white-space:pre-wrap}
        .revision-callout-empty{margin:0;color:#8a4b00;font-size:.92rem}
        .revision-callout-foot{margin:14px 0 0;color:#8a4b00;font-size:.86rem}
        @media (max-width:640px){
          .work-submission-page{padding:16px;padding-bottom:max(24px,env(safe-area-inset-bottom))}
          .submission-container{padding:20px 16px}
          .submission-header h1{font-size:1.4rem;overflow-wrap:anywhere}
          .revision-callout{padding:16px}
          .upload-btn{padding:28px 16px}
          .btn-primary{width:100%}
        }
        @media (max-width:768px){.submission-form textarea,.submission-form input{font-size:16px}}
      `}</style>
    </div>
  );
}