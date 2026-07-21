import { useRef } from 'react';
import PostABrief from '../pages/PostABrief';

/**
 * Modal wrapper around the full 8-section brief builder (PostABrief), targeted at ONE
 * creator. Replaces the old instant-pay PlanBrief checkout: on publish, PostABrief's
 * embeddedCreatorId path sends a PRIVATE INVITATION (72h to accept/decline/counter,
 * ₹500 listing fee charged only on accept) instead of charging the full amount upfront.
 *
 * Backdrop click saves the in-progress brief as a draft first (PostABrief exposes
 * saveDraftNow via ref), so an accidental click never discards the work.
 */
export default function CreatorInviteModal({ creatorId, onClose, onPublished }) {
  const ref = useRef(null);
  const close = async () => {
    await ref.current?.saveDraftNow?.();
    onClose();
  };
  return (
    <div className="cmk-brief-overlay" onClick={close}>
      <div className="cmk-brief-modal" onClick={(e) => e.stopPropagation()}>
        <PostABrief ref={ref} embeddedCreatorId={creatorId} onClose={close} onPublished={onPublished} />
      </div>
    </div>
  );
}
