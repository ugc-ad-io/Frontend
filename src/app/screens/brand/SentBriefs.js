import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { API, Avatar, LoadError, Skeletons, assetUrl, firstWord, loadErrorText, money, shortDate } from './workShared';
import './work.css';

// Tone + label for each lifecycle status the backend buckets briefs into (same as the website tab).
const STATUS_META = {
  sent: { label: 'Sent', tone: '' },
  accepted: { label: 'Accepted', tone: 'ap-pill--ok' },
  declined: { label: 'Declined', tone: 'ap-pill--bad' },
  countered: { label: 'Countered', tone: 'ap-pill--warn' },
  expired: { label: 'Expired', tone: 'ap-pill--muted' },
  revoked: { label: 'Withdrawn', tone: 'ap-pill--muted' },
};
const DECLINE_LABELS = {
  not_my_niche: 'Not my niche', budget: 'Budget too low', timeline: 'Timeline too tight', unavailable: 'Unavailable', other: 'Other',
};
const FILTERS = [
  { key: 'all', label: 'All' }, { key: 'sent', label: 'Sent' }, { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' }, { key: 'countered', label: 'Countered' }, { key: 'expired', label: 'Expired' },
];
const bucketsFor = (key) => (key === 'expired' ? ['expired', 'revoked'] : [key]);
const briefAmount = (b) => {
  if (b.amount == null || b.amount === '') return '—';
  const s = String(b.amount);
  return /^[₹\s]*[\d,.\s]+$/.test(s) ? money(s.replace(/[₹,\s]/g, '')) : s;
};

export default function BrandSentBriefsApp() {
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const seq = useRef(0);

  const load = async () => {
    const my = ++seq.current;
    try {
      const res = await axios.get(`${API}/business/briefs?t=${Date.now()}`);
      let list = Array.isArray(res.data) ? res.data : [];
      // Some briefs come back without a creator photo: backfill from the creator directory (best effort).
      if (list.some((b) => !b.creator_photo && b.creator_id)) {
        try {
          const dir = await axios.get(`${API}/business/creator-directory`);
          const items = Array.isArray(dir.data) ? dir.data : (dir.data?.creators || []);
          const photoById = {};
          items.forEach((it) => {
            const id = it.id || it.creator_id;
            const profile = it.profile || {};
            const photo = it.profile_photo || it.profile_picture || profile.profile_photo || profile.profile_picture;
            if (id && photo) photoById[id] = photo;
          });
          list = list.map((b) => ((b.creator_photo || !photoById[b.creator_id]) ? b : { ...b, creator_photo: photoById[b.creator_id] }));
        } catch { /* directory is a best-effort fallback */ }
      }
      if (my !== seq.current) return;
      setBriefs(list);
      setError('');
    } catch (e) {
      if (my === seq.current) setError(loadErrorText(e, 'Failed to load sent briefs'));
    } finally { if (my === seq.current) setLoading(false); }
  };
  useLiveEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const count = (key) => (key === 'all' ? briefs.length : briefs.filter((b) => bucketsFor(key).includes(b.status_bucket)).length);
  const visible = useMemo(
    () => (filter === 'all' ? briefs : briefs.filter((b) => bucketsFor(filter).includes(b.status_bucket))),
    [briefs, filter],
  );
  const retry = () => { setLoading(true); load(); };

  return (
    <AppShell
      back
      title="Sent briefs"
      subtitle="Invites and offers you sent to creators"
      right={<button type="button" className="ap-bar-btn" aria-label="Invite a creator" onClick={() => navigate('/dashboard/business/browse-creator')}><Plus size={22} /></button>}
    >
      <div className="ap-wk">
        <div className="ap-chips ap-wk-chips" role="tablist" aria-label="Brief status">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={`ap-chip${filter === f.key ? ' is-on' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}<span className="ap-wk-cnt">{count(f.key)}</span>
            </button>
          ))}
        </div>

        {error && briefs.length > 0 && (
          <div className="ap-wk-err" role="alert"><span>{error}</span><button type="button" className="ap-btn ap-btn--sm" onClick={retry}>Retry</button></div>
        )}

        {loading ? <Skeletons n={4} h={126} />
          : error && briefs.length === 0 ? <LoadError title="Couldn't load sent briefs" message={error} onRetry={retry} />
          : briefs.length === 0 ? (
            <div className="ap-card ap-empty">
              <h3>No briefs sent yet</h3>
              <p>When you invite a creator or send a custom or counter offer, it will show up here with its status.</p>
              <button type="button" className="ap-btn" onClick={() => navigate('/dashboard/business/browse-creator')}>Browse creators</button>
            </div>
          ) : visible.length === 0 ? (
            <div className="ap-card ap-empty">
              <h3>No {filter} briefs</h3>
              <p>Try a different status.</p>
              <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setFilter('all')}>Show all</button>
            </div>
          ) : (
            <div className="ap-wk-list">
              {visible.map((b) => {
                const meta = STATUS_META[b.status_bucket] || STATUS_META.sent;
                const name = firstWord(b.creator_name);
                const note = b.status_bucket === 'declined' && b.decline_reason
                  ? `Declined — ${DECLINE_LABELS[b.decline_reason] || b.decline_reason}${b.response_note ? `: “${b.response_note}”` : ''}`
                  : (b.response_note || b.note || '');
                const when = shortDate(b.created_at);
                return (
                  <article key={b.id} data-testid={`brief-${b.id}`} className="ap-card ap-wk-sb">
                    <div className="ap-wk-sb-h">
                      <Avatar name={name} src={b.creator_photo ? assetUrl(b.creator_photo) : ''} size={42} />
                      <div className="ap-wk-sb-t">
                        <b>{name}{b.type_label ? <span style={{ fontWeight: 500, color: 'var(--ap-muted)', fontSize: 12 }}> · {b.type_label}</span> : null}</b>
                        <small>{b.campaign_name || b.deliverable_summary || 'Untitled brief'}</small>
                      </div>
                      <span className={`ap-pill ${meta.tone}`}>{meta.label}</span>
                    </div>
                    {note ? <div className="ap-wk-sb-note">{note}</div> : null}
                    <div className="ap-wk-sb-f">
                      <div>
                        <strong>{briefAmount(b)}</strong>
                        <small>{[b.timeline, when ? `Sent ${when}` : ''].filter(Boolean).join(' · ') || ' '}</small>
                      </div>
                      {b.status_bucket === 'accepted' && b.deal_campaign_id ? (
                        <button type="button" className="ap-btn" onClick={() => navigate(`/dashboard/business/campaign/${b.deal_campaign_id}`)}>View deal</button>
                      ) : (
                        <button type="button" className={`ap-btn${b.status_bucket === 'countered' ? '' : ' ap-btn--ghost'}`} onClick={() => navigate(`/messages?conv=${b.creator_id}`)}>
                          {b.status_bucket === 'countered' ? 'Reply in chat' : 'Open chat'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
      </div>
    </AppShell>
  );
}
