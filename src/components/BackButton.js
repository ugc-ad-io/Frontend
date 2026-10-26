import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../styles/back-button.css';

/**
 * The "Back" pill at the top of detail pages (replaces the old "Home / Creators / …" breadcrumb trails).
 * Goes to the page the user came from; opened directly (no history inside the app) it goes to `fallback`.
 */
export default function BackButton({ fallback = '/', label = 'Back', onClick }) {
  const navigate = useNavigate();
  const go = () => {
    if (onClick) { onClick(); return; }
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate(fallback);
  };
  return (
    <div className="ugc-back-row">
      <button type="button" className="ugc-back" aria-label={label} onClick={go}>
        <ArrowLeft size={17} /> {label}
      </button>
    </div>
  );
}
