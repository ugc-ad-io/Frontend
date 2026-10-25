import { useState } from 'react';
import { useParams } from 'react-router-dom';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import BrandCreatorProfile from '../components/BrandCreatorProfile';
import ChatPopup from '../components/ChatPopup';
import PlanBrief from './PlanBrief';

/**
 * Full-page creator profile (route /dashboard/business/creator/:id).
 * Renders BrandCreatorProfile (design board 08): same /profile data as the old modal, read-only.
 */
export default function CreatorProfilePage() {
  const { id } = useParams();
  const [chatWith, setChatWith] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);

  return (
    <BrandTopNavLayout>
      <BrandCreatorProfile
        id={id}
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
