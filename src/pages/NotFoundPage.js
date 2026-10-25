import { Link } from 'react-router-dom';
import { useAuth, homeForUser } from '../App';
import '../styles/web1-misc.css';

// Catch-all for unknown URLs (replaces the inline NotFound in App.js).
export default function NotFoundPage() {
  const { user } = useAuth();
  const home = user ? homeForUser(user) : '/';
  return (
    <div className="w1 nf" role="main">
      <div className="nf-card">
        <span className="nf-code" aria-hidden="true">404</span>
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist or has moved.</p>
        <Link to={home} className="w1-btn">{user ? 'Go to my dashboard' : 'Go to home'}</Link>
      </div>
    </div>
  );
}
