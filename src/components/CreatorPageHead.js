import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAutoSearch, { markSearchFocus, takeSearchFocus } from '../utils/useAutoSearch';
import { Search } from 'lucide-react';
import NotificationBell from './NotificationBell';
import '../styles/creator-ui.css';

/**
 * Title row used at the top of every creator page (design board C01 header):
 * title + subtitle, a "Search briefs" box, the notification bell and an optional primary action.
 */
export default function CreatorPageHead({ title, subtitle, action, hideSearch = false, children }) {
  const navigate = useNavigate();
  // Only the starting text comes from the address bar, so plain window.location is enough here.
  const urlQ = window.location.pathname === '/browse-briefs' ? new URLSearchParams(window.location.search).get('q') || '' : '';
  const [term, setTerm] = useState(urlQ);
  const inputRef = useRef(null);
  useEffect(() => { takeSearchFocus(inputRef.current); }, []);
  // Searches as you type: after a short pause, open Find briefs with the results.
  useAutoSearch(term, urlQ, (v) => {
    if (!v || hideSearch) return;
    markSearchFocus();
    navigate(`/browse-briefs?q=${encodeURIComponent(v)}`);
  });
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
          <input ref={inputRef} type="search" aria-label="Search briefs" placeholder="Search briefs" value={term} onChange={(e) => setTerm(e.target.value)} />
        </form>
      )}
      <span className="cui-bell"><NotificationBell /></span>
      {action}
      {children}
    </div>
  );
}
