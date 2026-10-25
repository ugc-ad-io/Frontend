import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import NotificationBell from './NotificationBell';
import '../styles/creator-ui.css';

/**
 * Title row used at the top of every creator page (design board C01 header):
 * title + subtitle, a "Search briefs" box, the notification bell and an optional primary action.
 */
export default function CreatorPageHead({ title, subtitle, action, hideSearch = false, children }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const run = (e) => {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/browse-briefs?q=${encodeURIComponent(q)}` : '/browse-briefs');
  };
  return (
    <div className="cui-head">
      <div className="cui-head-t">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {!hideSearch && (
        <form className="cui-search" role="search" onSubmit={run}>
          <Search size={17} />
          <input type="search" aria-label="Search briefs" placeholder="Search briefs" value={term} onChange={(e) => setTerm(e.target.value)} />
        </form>
      )}
      <span className="cui-bell"><NotificationBell /></span>
      {action}
      {children}
    </div>
  );
}
