import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { useAuth } from '../../../App';
import '../../shell/app-shell.css';
import './pub.css';

// Phone frame for screens that also work logged out (legal, 404, team invite). Signed in it is the normal
// AppShell; signed out it keeps the same top bar but drops the bell, avatar menu and tabs, which need a user.
export default function PubFrame({ title, subtitle, back = false, tabs = false, children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (user) return <AppShell title={title} subtitle={subtitle} back={back} tabs={tabs}>{children}</AppShell>;
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));
  return (
    <div className="ap-shell ap-shell--light">
      <header className="ap-bar">
        {back ? (
          <button type="button" className="ap-bar-btn" aria-label="Back" onClick={goBack}><ChevronLeft size={24} /></button>
        ) : (
          <button type="button" className="ap-bar-logo" aria-label="UGCad home" onClick={() => navigate('/')}>
            <span className="ap-logo-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
          </button>
        )}
        <div className="ap-bar-title">
          {title ? <h1>{title}</h1> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      <main className="ap-body">{children}</main>
    </div>
  );
}
