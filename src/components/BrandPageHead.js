import { createContext, useContext, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { creatorSearchUrl } from '../utils/creatorSearch';
import useAutoSearch, { markSearchFocus, takeSearchFocus } from '../utils/useAutoSearch';
import '../styles/brand-ui-shell.css';

// The shell (BrandTopNavLayout) provides this so it can show a title-less fallback head
// (search + bell) on pages that do not render their own <BrandPageHead />.
export const BrandHeadContext = createContext(null);

// Quick category filters for the creator directory. Shown on the Creators page only.
export const CATEGORIES = ['Beauty', 'Skincare', 'Fashion', 'Fitness', 'Food & Drinks', 'Tech & Gadgets', 'Lifestyle', 'Travel', 'Home', 'Pets', 'Apps'];

/**
 * Title row used at the top of every brand page (mirrors CreatorPageHead):
 * title + subtitle, a "Search creators" box that opens the Creators page, the bell and an optional action.
 * `util` is the shell's own title-less fallback and does not register itself.
 */
export default function BrandPageHead({ title, subtitle, action, hideSearch = false, util = false, children }) {
  const navigate = useNavigate();
  // Plain window.location (like CreatorPageHead): the address bar only seeds the box and its live search.
  const { pathname, search } = window.location;
  const onResults = pathname.includes('browse-creator');
  const urlQ = new URLSearchParams(search).get('q') || '';
  const [term, setTerm] = useState(urlQ);
  useEffect(() => { setTerm(urlQ); }, [urlQ]);
  const inputRef = useRef(null);
  const head = useContext(BrandHeadContext);
  useLayoutEffect(() => {
    if (util || !head) return undefined;
    head.add();
    return head.remove;
  }, [util, head]);
  // The shell fallback is replaced by the page's own head: only a real head takes back typing focus.
  useEffect(() => { if (!util) takeSearchFocus(inputRef.current); }, [util]);
  // Searches as you type: from any other page, open the creator results after a short pause
  // (on the results page itself the box already searches live, see onChange below).
  useAutoSearch(term, urlQ, (v) => {
    if (!v || hideSearch || onResults) return;
    markSearchFocus();
    navigate(creatorSearchUrl('', v));
  });
  return (
    <div className={`bsh-head${util ? ' bsh-head--util' : ''}`}>
      {title ? (
        <div className="bsh-head-t">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      ) : <span className="bsh-head-fill" />}
      {!hideSearch && (
        <form className="bsh-search" role="search" onSubmit={(e) => { e.preventDefault(); navigate(creatorSearchUrl(onResults ? search : '', term)); }}>
          <Search size={17} />
          <input
            ref={inputRef}
            type="search"
            aria-label="Search creators"
            placeholder="Search creators"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              if (onResults) navigate(creatorSearchUrl(search, e.target.value), { replace: true });
            }}
          />
        </form>
      )}
      <span className="bsh-bell"><NotificationBell /></span>
      {action}
      {children}
    </div>
  );
}

/** Horizontally scrolling category chips: only the Creators page renders this. */
export function BrandCategoryChips() {
  const navigate = useNavigate();
  const cur = (new URLSearchParams(window.location.search).get('category') || '').toLowerCase();
  return (
    <nav className="bsh-cats" aria-label="Categories">
      <button type="button" className={!cur ? 'is-on' : ''} onClick={() => navigate('/dashboard/business/browse-creator')}>All</button>
      {CATEGORIES.map((c) => (
        <button key={c} type="button" className={cur === c.toLowerCase() ? 'is-on' : ''} onClick={() => navigate(`/dashboard/business/browse-creator?category=${encodeURIComponent(c)}`)}>{c}</button>
      ))}
    </nav>
  );
}
