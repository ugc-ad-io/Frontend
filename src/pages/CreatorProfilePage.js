import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import CreatorProfileModal from '../components/CreatorProfileModal';
import ChatPopup from '../components/ChatPopup';
import PlanBrief from './PlanBrief';

/**
 * Full-page creator profile (route /dashboard/business/creator/:id).
 * Reuses CreatorProfileModal in `asPage` mode — same data + sections, no overlay.
 */
export default function CreatorProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chatWith, setChatWith] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);

  return (
    <BrandTopNavLayout>
      <CreatorProfileModal
        id={id}
        asPage
        // Opened straight from a link (new tab, notification) there is nothing to go back to: land on Browse Creators.
        onClose={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/dashboard/business/browse-creator', { replace: true }))}
        onMessage={() => setChatWith({ id })}
        onBegin={() => setBriefOpen(true)}
      />

      {briefOpen && (
        <PlanBrief
          creatorId={id}
          onClose={() => setBriefOpen(false)}
          onPublished={() => setBriefOpen(false)}
        />
      )}

      {chatWith && <ChatPopup user={chatWith} onClose={() => setChatWith(null)} />}
    </BrandTopNavLayout>
  );
}
