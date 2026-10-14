import { useEffect } from 'react';
import BriefOverlay from '../components/BriefOverlay';
import PostABrief from './PostABrief';

// Private invitations use the same complete brief and admin review as campaigns.
export default function PlanBrief({ creatorId, onClose, onPublished }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  return (
    <BriefOverlay className="private-brief-overlay" role="dialog" aria-modal="true" aria-label="Private campaign brief">
      <div className="private-brief-content">
        <PostABrief embeddedCreatorId={creatorId} onClose={onClose} onPublished={onPublished} />
      </div>
      <style>{`
        .private-brief-overlay { position: fixed; inset: 0; z-index: 2000; overflow-y: auto; background: var(--bg-primary, #fff); padding: 24px; box-sizing: border-box; }
        .private-brief-content { width: 100%; max-width: 1440px; margin: 0 auto; min-width: 0; }
        .private-brief-content .pab-back-row { display: flex; grid-column: 1 / -1; margin-bottom: 16px; }
        @media (max-width: 640px) { .private-brief-content .brief-builder-page { width: 100%; max-width: 100%; margin: 0; } }
        @media (max-width: 600px) { .private-brief-overlay { padding: 16px 12px; } }
      `}</style>
    </BriefOverlay>
  );
}
