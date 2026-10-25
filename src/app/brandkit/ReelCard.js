import { useState, useEffect } from 'react';
import { Heart, VideoOff, Play, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { toggleSavedCreator, useSavedCreatorIds } from '../../utils/savedCreators';
import PhotoOrInitial from '../../components/PhotoOrInitial';
import {
  assetUrl, inr, nameOf, initialOf, budgetOf, deliveryDaysOf, creatorVideoUrl, videoPoster, previewVideoUrl,
  browserCompatibleVideoUrl, isVideo, REEL_BADGE, reelBadgeKey,
} from './kit';
import './reel.css';

/**
 * 9:16 creator card (design boards M0 Home / Creators / Saved / No results).
 *   onView(c)            tap the name bar (opens preview or profile)
 *   onPlay({src,name})   tap the video (full-size player)
 *   onInvite(c)          Invite button (the website sends it to the creator profile, where "Send a brief" lives)
 */
export default function ReelCard({ c, onView, onPlay, onInvite }) {
  const name = nameOf(c);
  const saved = useSavedCreatorIds().has(String(c.id));
  const original = creatorVideoUrl(c);
  const [clipFailed, setClipFailed] = useState(false);
  const [dead, setDead] = useState(false);
  useEffect(() => { setClipFailed(false); setDead(false); }, [original]);
  const media = clipFailed ? browserCompatibleVideoUrl(original) : previewVideoUrl(original);
  const hasVideo = !dead && !!(media && isVideo(media));
  const poster = videoPoster(original);
  const badge = reelBadgeKey(c);
  const rating = Number(c.avg_rating || c.rating || 0);
  const reviews = Number(c.review_count || 0);
  const price = budgetOf(c);
  const days = deliveryDaysOf(c);

  const toggle = async (e) => {
    e.stopPropagation();
    const now = await toggleSavedCreator({ id: c.id });
    toast.success(now ? 'Saved to your creators' : 'Removed from saved');
  };

  return (
    <article className="ap-rc">
      <div className="ap-rc-media">
        {hasVideo ? (
          <button type="button" className="ap-rc-play" aria-label={`Play ${name}'s video`} onClick={() => onPlay?.({ src: browserCompatibleVideoUrl(original), name })}>
            <video
              src={`${media}#t=0.5`}
              poster={poster || undefined}
              muted
              playsInline
              preload={poster ? 'none' : 'metadata'}
              onError={() => (clipFailed ? setDead(true) : setClipFailed(true))}
            />
            <span className="ap-rc-playic" aria-hidden="true"><Play size={14} fill="currentColor" /></span>
          </button>
        ) : (
          <button type="button" className="ap-rc-novid" onClick={() => onView?.(c)} aria-label={`${name}: no video yet`}>
            <VideoOff size={22} /><span>No video yet</span>
          </button>
        )}
        <span className={`ap-rc-badge ap-rc-badge--${badge}`}>{REEL_BADGE[badge]}</span>
        <button type="button" className={`ap-rc-save${saved ? ' is-on' : ''}`} aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`} aria-pressed={saved} onClick={toggle}>
          <span><Heart size={14} fill={saved ? 'currentColor' : 'none'} /></span>
        </button>
        <button type="button" className="ap-rc-who" onClick={() => onView?.(c)}>
          <span className="ap-rc-ava"><PhotoOrInitial src={assetUrl(c.profile_photo)} initial={initialOf(c)} /></span>
          <span className="ap-rc-nm">
            <b>{name}{c.kyc_verified && <BadgeCheck size={12} color="#4E60E6" aria-label="Identity verified" />}</b>
            <small>
              {rating > 0 && reviews > 0 ? `★ ${rating.toFixed(1)}` : 'New on UGCad'}
              {days ? ` · ${days}d` : ''}
            </small>
          </span>
        </button>
      </div>
      <div className="ap-rc-foot">
        <span className="ap-rc-price">{price ? inr(price) : 'On request'}{price ? <small> /video</small> : null}</span>
        <button type="button" className="ap-rc-invite" onClick={() => onInvite?.(c)} aria-label={`Invite ${name}`}>Invite</button>
      </div>
    </article>
  );
}
