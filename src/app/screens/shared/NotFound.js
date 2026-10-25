import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useAuth, homeForUser } from '../../../App';
import PubFrame from './pubKit';

// Where "Home" goes: the phone app's own landing screen for each role (the website uses the dashboards).
const homeFor = (user) => {
  if (!user) return '/';
  if (user.role === 'business') return '/brand-home';
  if (user.role === 'creator') return '/dashboard/creator';
  return homeForUser(user);
};

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(homeFor(user), { replace: true }));
  return (
    <PubFrame tabs title="Page not found">
      <div className="ap-pub-center">
        <div className="ap-card ap-pub-card" role="alert">
          <span className="ap-pub-ic"><Compass size={30} /></span>
          <span className="ap-pub-code">404</span>
          <h2>This page isn’t here</h2>
          <p>The link may be old or mistyped, or the page has moved.</p>
          <div className="ap-pub-actions">
            <button type="button" className="ap-btn ap-btn--ghost" onClick={back}>Go back</button>
            <button type="button" className="ap-btn" onClick={() => navigate(homeFor(user), { replace: true })}>{user ? 'Home' : 'Go to home'}</button>
          </div>
        </div>
      </div>
    </PubFrame>
  );
}
