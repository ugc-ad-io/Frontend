import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Users as UsersIcon, ChevronDown, ChevronUp } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// ---------------------------------------------------------------------------
// Generic detail renderer — surfaces EVERY field the creator/business onboarding
// form submitted (backend returns the full payload under profile.profile). Keeps
// working even as the forms add fields, instead of hand-listing a handful.
// ---------------------------------------------------------------------------

// Internal/preview/blob/duplicate keys + the ones already shown in the card head.
const HIDDEN_KEYS = new Set([
  // Photo fields are surfaced as the avatar, not as raw URL rows.
  'photoPreview', 'profile_picture', 'profile_photo', 'photo_url', 'photoUrl',
  'profilePhoto', 'avatar', 'avatar_url', 'image', 'image_url', 'photo',
  'logo', 'banner', 'intro_video',
  'pfVideoUrl', 'pfVideo', 'pfBrand', 'pfDesc', 'pfLink',
  'id', '_id', 'user_id', 'userId', 'password', '__v', 'token',
  'approval_status', 'role', 'email', 'username', 'nickname', 'profile_completed',
  'terms_agreed', 'receive_briefs',
]);

const prettifyKey = (k) =>
  String(k)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const isEmptyValue = (v) =>
  v === null ||
  v === undefined ||
  v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

const isUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v.trim());

function DetailValue({ value }) {
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (isUrl(value)) {
    return <a href={value.trim()} target="_blank" rel="noreferrer" className="ap-link">{value}</a>;
  }
  if (Array.isArray(value)) {
    const allPrimitive = value.every((v) => v === null || typeof v !== 'object');
    if (allPrimitive) return <span>{value.filter((v) => !isEmptyValue(v)).join(', ')}</span>;
    return (
      <div className="ap-nested">
        {value.map((v, i) => (
          <DetailGroup key={i} title={`#${i + 1}`} obj={v} nested />
        ))}
      </div>
    );
  }
  if (value && typeof value === 'object') return <DetailGroup obj={value} nested />;
  return <span>{String(value)}</span>;
}

function DetailGroup({ title, obj, nested }) {
  const entries = Object.entries(obj || {}).filter(
    ([k, v]) => !HIDDEN_KEYS.has(k) && !isEmptyValue(v)
  );
  if (entries.length === 0) return null;
  return (
    <div className={`ap-group${nested ? ' ap-group--nested' : ''}`}>
      {title && <p className="ap-group-title">{title}</p>}
      {entries.map(([k, v]) => (
        <div className="ap-row" key={k}>
          <span className="ap-k">{prettifyKey(k)}</span>
          <span className="ap-v"><DetailValue value={v} /></span>
        </div>
      ))}
    </div>
  );
}

// Pull a usable avatar URL out of whatever the backend returns. Accepts absolute
// http(s) URLs and relative /uploads/... paths (prefixed to the backend); skips
// local blob:/data: refs, which are meaningless once stored server-side.
const PHOTO_KEYS = [
  'profile_picture', 'profile_photo', 'photo_url', 'photoUrl', 'profilePhoto',
  'avatar', 'avatar_url', 'image', 'image_url', 'logo', 'photo', 'photoPreview',
];
function getAvatarUrl(obj) {
  for (const k of PHOTO_KEYS) {
    const v = obj?.[k];
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/uploads')) return `${BACKEND_URL}${s}`;
  }
  return '';
}
function getInitials(name) {
  const parts = String(name || '').trim().replace(/^@/, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function ProfileCard({ profile, onApprove, onReject }) {
  const [open, setOpen] = useState(false);
  // Full submitted payload lives under .profile; merge any extra top-level fields too.
  const details = { ...(profile.profile || {}) };
  Object.entries(profile).forEach(([k, v]) => {
    if (k !== 'profile' && !(k in details)) details[k] = v;
  });
  const fieldCount = Object.entries(details).filter(
    ([k, v]) => !HIDDEN_KEYS.has(k) && !isEmptyValue(v)
  ).length;

  const displayName = profile.username
    ? `@${profile.username}`
    : (profile.nickname || profile.profile?.fullName || profile.profile?.business_name || '—');
  const avatarUrl = getAvatarUrl(details) || getAvatarUrl(profile);

  return (
    <article className="ap-card" data-testid={`profile-${profile.id}`}>
      <div className="ap-card-head">
        <div className={`ap-avatar ap-avatar-${profile.role}`}>
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            : <span className="ap-avatar-fallback">{getInitials(displayName)}</span>}
        </div>
        <div>
          <h3>{displayName}</h3>
          <span className={`ap-badge ap-badge-${profile.role}`}>{profile.role}</span>
        </div>
      </div>

      <div className="ap-card-body">
        <p><strong>Email:</strong> {profile.email || '—'}</p>

        <button
          type="button"
          className="ap-toggle"
          onClick={() => setOpen((o) => !o)}
          data-testid={`toggle-profile-${profile.id}`}
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {open ? 'Hide details' : `View all details (${fieldCount})`}
        </button>

        {open && (
          <div className="ap-details">
            {fieldCount > 0 ? (
              <DetailGroup obj={details} />
            ) : (
              <p className="ap-details-empty">No additional details submitted.</p>
            )}
          </div>
        )}
      </div>

      <div className="ap-card-actions">
        <button
          className="ap-btn ap-btn-approve"
          onClick={() => onApprove(profile.id)}
          data-testid={`approve-profile-${profile.id}`}
        >
          <CheckCircle size={18} /> Approve
        </button>
        <button
          className="ap-btn ap-btn-reject"
          onClick={() => onReject(profile.id)}
          data-testid={`reject-profile-${profile.id}`}
        >
          <XCircle size={18} /> Reject
        </button>
      </div>
    </article>
  );
}

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
              <ProfileCard
                key={profile.id}
                profile={profile}
                onApprove={handleApproveProfile}
                onReject={handleRejectProfile}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
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

        .ap-card-head {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .ap-avatar {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          flex-shrink: 0;
          overflow: hidden;
          display: grid;
          place-items: center;
          background: #e9ecff;
          border: 1.5px solid #e8ecff;
        }

        .ap-avatar-business {
          background: #fef3c7;
        }

        .ap-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ap-avatar-fallback {
          font-size: 1.05rem;
          font-weight: 800;
          color: #6d7bff;
          letter-spacing: 0.02em;
        }

        .ap-avatar-business .ap-avatar-fallback {
          color: #92400e;
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
          background: #e9ecff;
          color: #6d7bff;
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

        .ap-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          padding: 7px 12px;
          background: #f4f4ff;
          border: 1.5px solid #e8ecff;
          border-radius: 9px;
          color: #4f46e5;
          font-weight: 600;
          font-size: 0.82rem;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .ap-toggle:hover {
          background: #ece9ff;
          border-color: #c7c7f0;
        }

        .ap-details {
          margin-top: 14px;
          border-top: 1px dashed #e2e6f5;
          padding-top: 14px;
          max-height: 460px;
          overflow-y: auto;
        }

        /* Details span the full card width regardless of column count. */
        .ap-card:has(.ap-details) {
          grid-column: 1 / -1;
        }

        .ap-details-empty {
          color: #94a3b8;
          font-style: italic;
          margin: 0;
        }

        /* Each field group becomes a responsive 2-up grid of stacked label/value cells. */
        .ap-group {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 10px 18px;
          margin: 0 0 6px;
        }

        .ap-group--nested {
          grid-column: 1 / -1;
          margin: 2px 0 6px;
          padding: 10px 12px;
          background: #f8f9ff;
          border: 1px solid #eef0fb;
          border-radius: 10px;
        }

        .ap-group-title {
          grid-column: 1 / -1;
          margin: 0 0 2px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6d7bff;
        }

        /* Stacked: small caption label on top, value below — no more squished columns. */
        .ap-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 2px 0;
          min-width: 0;
        }

        .ap-k {
          color: #94a3b8;
          font-weight: 600;
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .ap-v {
          color: #1a202c;
          font-size: 0.88rem;
          font-weight: 500;
          line-height: 1.45;
          overflow-wrap: break-word;
        }

        .ap-link {
          color: #4f46e5;
          text-decoration: none;
          overflow-wrap: break-word;
        }

        .ap-link:hover {
          text-decoration: underline;
        }

        .ap-nested {
          display: flex;
          flex-direction: column;
          gap: 6px;
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
          background: #16a34a;
          color: #fff;
        }

        .ap-btn-reject {
          background: #fee2e2;
          color: #991b1b;
        }

        .ap-btn-reject:hover {
          background: #dc2626;
          color: #fff;
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
