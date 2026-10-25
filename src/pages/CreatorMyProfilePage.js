import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Star, Film } from 'lucide-react';
import { useAuth } from '../App';
import { useLiveEffect } from '../lib/liveUpdates';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import CreatorPageHead from '../components/CreatorPageHead';
import CreatorProfileModal from '../components/CreatorProfileModal';
import PhotoOrInitial from '../components/PhotoOrInitial';
import { creatorFirstName } from '../utils/displayName';
import '../styles/creator-ui-profile.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));

/**
 * Creator's own profile (route /profile) — the same banner + Videos/Details/Reviews editor
 * (CreatorProfileModal, editable) restyled for the creator UI, plus a "How brands see you" card.
 */
export default function CreatorMyProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [reviews, setReviews] = useState([]);

  // Same two reads the editor makes; only used to preview the card brands see in search.
  useLiveEffect(() => {
    if (!user?.id) return undefined;
    let live = true;
    axios.get(`${API}/profile/${user.id}`).then((r) => { if (live) setMe(r.data); }).catch(() => {});
    axios.get(`${API}/reviews/creator/${user.id}`).then((r) => { if (live) setReviews(Array.isArray(r.data) ? r.data : []); }).catch(() => {});
    return () => { live = false; };
  }, [user?.id]);

  const p = { ...(me || {}), ...(me?.profile || {}) };
  const rc = p.rate_card || {};
  const price = Number(String(rc.raw_payout || rc.expected_payout || p.expectedPayout || '').replace(/[^0-9]/g, ''));
  const days = Number(p.delivery_days || rc.delivery_days || 0);
  const avg = reviews.length ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;
  const name = me ? creatorFirstName(me) : '';
  const photo = assetUrl(me?.profile_photo || me?.profile_picture || user?.profile_photo || user?.profile_picture);
  const portfolio = [...(Array.isArray(p.portfolio_items) ? p.portfolio_items : []), ...(Array.isArray(me?.portfolio) ? me.portfolio : [])];
  const firstClip = portfolio.map((it) => (typeof it === 'string' ? it : (it?.videoUrl || it?.url || (Array.isArray(it?.urls) && it.urls[0]) || ''))).find(Boolean);
  const clip = assetUrl(firstClip);
  const clipIsVideo = /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(String(clip));

  return (
    <CreatorTopNavLayout>
      <div className="cui-p-wrap">
        <CreatorPageHead
          title="My profile"
          subtitle="This is what brands see when they look at you."
          hideSearch
          action={<button type="button" className="cui-btn cui-btn--ghost" onClick={() => navigate('/portfolio')}><Film size={16} /> My portfolio</button>}
        />
        <div className="cui-p-cols">
          <div className="cui-p-left">
            <CreatorProfileModal
              id={user?.id}
              asPage
              editable
              photo={user?.profile_photo || user?.profile_picture}
              onClose={() => navigate('/settings', { replace: true })}
            />
          </div>
          <aside className="cui-p-right">
            <section className="cui-p-card">
              <h2>How brands see you</h2>
              <p className="cui-p-sub">Your card in brand search</p>
              <div className="cui-p-pv">
                <div className="cui-p-pv-card">
                  <div className="cui-p-pv-img">
                    {clip && clipIsVideo ? <video src={`${clip}#t=0.5`} muted playsInline preload="metadata" /> : clip ? <img src={clip} alt="" /> : <span><Film size={26} /></span>}
                    {user?.ugcad_approved && <em>UGCAD.IO Choice</em>}
                    <div className="cui-p-pv-who">
                      <i><PhotoOrInitial src={photo} initial={(name || 'C').charAt(0).toUpperCase()} /></i>
                      <div>
                        <b>{name || 'You'}{me?.kyc_verified ? ' ✓' : ''}</b>
                        <small>{avg ? <><Star size={11} fill="#F5A524" color="#F5A524" /> {avg.toFixed(1)} ({reviews.length})</> : 'No reviews yet'}{days ? ` · ${days}-day delivery` : ''}</small>
                      </div>
                    </div>
                  </div>
                  <div className="cui-p-pv-foot">
                    <span>{price ? <>From <strong>₹{price.toLocaleString('en-IN')}</strong> / video</> : 'Add your rate'}</span>
                    <span className="cui-p-pv-btn">Invite</span>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </CreatorTopNavLayout>
  );
}
