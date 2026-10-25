import { useNavigate } from 'react-router-dom';
import '../styles/creator-ui-onboarding.css';

/** Gradient logo bar used by creator profile setup and the approval gates (screens rendered outside the creator shell). `right` is optional content for the far end. */
export default function CreatorOnboardBar({ right }) {
  const navigate = useNavigate();
  return (
    <header className="cui-s-bar">
      <button type="button" className="cui-s-brand" onClick={() => navigate('/')} aria-label="UGCad.io home">
        <span className="cui-s-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
        <span className="cui-s-word"><b>UGC</b>ad.io</span>
        <span className="cui-s-tag">FOR CREATORS</span>
      </button>
      {right && <div className="cui-s-bar-r">{right}</div>}
    </header>
  );
}
