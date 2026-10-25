import { useNavigate } from 'react-router-dom';
import { SUPPORT_EMAIL } from './ContactSupportBox';
import '../styles/brand-ui.css';
import '../styles/brand-ui-home.css';
import '../styles/brand-ui-gates.css';
import '../styles/brand-ui-mobile-b.css';

/** Plain logo bar used by the brand sign-up form and the approval gates (rendered outside the app shell). */
export default function BrandGateHeader() {
  const navigate = useNavigate();
  return (
    <header className="bg-head">
      <div className="bg-head-in">
        <button type="button" className="bui-logo" onClick={() => navigate('/')} aria-label="UGCad.io home">
          <span className="bui-logo-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
          <span className="bui-logo-word"><b>UGC</b>ad.io</span>
        </button>
        <span className="bg-help">Need help? <a href={`mailto:${SUPPORT_EMAIL}`}>Contact support</a></span>
      </div>
    </header>
  );
}
