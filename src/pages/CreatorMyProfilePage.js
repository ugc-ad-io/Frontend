import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import CreatorProfileModal from '../components/CreatorProfileModal';

/**
 * Creator's own profile (route /profile) — rendered with the exact same banner +
 * Videos/Details layout a brand sees, but with an "Edit Profile" action.
 */
export default function CreatorMyProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <CreatorTopNavLayout>
      <CreatorProfileModal
        id={user?.id}
        asPage
        editable
        photo={user?.profile_photo || user?.profile_picture}
        onClose={() => navigate('/dashboard/creator')}
      />
    </CreatorTopNavLayout>
  );
}
