import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import '../styles/brand-ui-saved.css';

/**
 * Empty state for Browse Creators when a search/filter finds nobody (design board 30).
 * `categories` are real category labels from the loaded directory (links to ?category=);
 * `children` are the "similar" creator cards the caller renders (ReelCard lives in BrandCreators).
 */
export default function BrandNoResults({ query, categories = [], children }) {
  const q = (query || '').trim();
  return (
    <>
      {q && (
        <div className="bui-nr-bar" role="status">
          <SearchX size={18} aria-hidden="true" />
          <span>{q}</span>
          <em>0 creators</em>
        </div>
      )}
      <section className="bui-nr-hero">
        <span className="bui-nr-ico" aria-hidden="true"><SearchX size={44} strokeWidth={1.8} /></span>
        <div>
          <h2 className="bui-nr-h">{q ? `No creators for “${q}” yet` : 'No creators found'}</h2>
          <p className="bui-nr-p">
            {q
              ? 'Try a broader search, or post a campaign and let the right creators find you.'
              : 'No creators match your current filters. Clear them, or post a campaign and let the right creators find you.'}
          </p>
          {categories.length > 0 && (
            <div className="bui-nr-chips">
              {categories.map((c) => (
                <Link key={c} className="bui-nr-chip" to={{ search: `?category=${encodeURIComponent(c)}` }}>{c}</Link>
              ))}
            </div>
          )}
        </div>
        <div className="bui-nr-side">
          <strong>Post a campaign instead</strong>
          <span>Creators who match get notified and send you bids, even if they are not in search yet.</span>
          <Link className="bui-btn" to="/dashboard/business/post-brief">Post a campaign</Link>
        </div>
      </section>
      {children && (
        <div>
          <h2 className="bui-h2">Creators you might like</h2>
          <p className="bui-h2-sub">Popular on UGCad right now</p>
          <div className="bui-reel-grid bui-reel-grid--similar">{children}</div>
        </div>
      )}
    </>
  );
}
