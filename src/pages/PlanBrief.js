import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import PostABrief from './PostABrief';

// Private invitations use the same complete brief and admin review as campaigns.
export default function PlanBrief({ creatorId, onClose, onPublished }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Private campaign brief" style={{ position: 'fixed', inset: 0, zIndex: 1000, overflowY: 'auto', background: 'var(--bg-primary, #fff)' }}>
      <PostABrief embeddedCreatorId={creatorId} onClose={onClose} onPublished={onPublished} />
    </div>, document.body,
  );
}
