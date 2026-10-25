import { Bookmark } from 'lucide-react';
import { timeAgo } from '../utils/normalizeBrief';
import { Skeleton } from './Skeleton';
import { BriefLogo, briefFacts, briefPay, bidCount, dueLabel } from './briefUi';
import '../styles/creator-ui-briefs.css';

/**
 * One brief card (design board C02). Used by Find briefs and Saved briefs.
 * `brief` is a normalized brief (see utils/normalizeBrief).
 */
export default function BriefCard({ brief: b, saved, onOpen, onToggleSave, busy = false, cta }) {
  const facts = briefFacts(b);
  const n = bidCount(b);
  const due = dueLabel(b);
  const meta = ['Bid your price', n != null ? `${n} ${n === 1 ? 'bid' : 'bids'}` : '', due].filter(Boolean);
  const label = cta || (b.hasBid ? 'Applied' : 'Apply');
  const open = () => onOpen(b);
  return (
    <article
      className={`cui-b-card${busy ? ' is-busy' : ''}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } }}
    >
      <div className="cui-b-card-top">
        <BriefLogo name={b.brand} src={b.logo} />
        <div className="cui-b-card-brand">
          <strong>{b.brand}</strong>
          {b.industryType ? <span>{b.industryType}</span> : null}
        </div>
        <button
          type="button"
          className={`cui-b-save${saved ? ' is-on' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleSave(b); }}
          aria-label={saved ? 'Remove from saved' : 'Save brief'}
          aria-pressed={saved}
        >
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="cui-b-card-body">
        {b.createdAt ? <div className="cui-b-posted">Posted {timeAgo(b.createdAt)}</div> : null}
        <h3>{b.title}</h3>
        {b.description ? <p>{b.description}</p> : null}
      </div>
      {facts.length > 0 && (
        <div className="cui-b-facts">
          {facts.map(([k, v]) => (
            <div key={k}><small>{k}</small><b title={v}>{v}</b></div>
          ))}
        </div>
      )}
      <div className="cui-b-card-foot">
        <div className="cui-b-price">
          <b>{briefPay(b)}</b>
          <span>{meta.join(' · ')}</span>
        </div>
        <button
          type="button"
          className={`cui-b-pill-btn${b.hasBid ? ' is-soft' : ''}`}
          onClick={(e) => { e.stopPropagation(); open(); }}
        >
          {label}
        </button>
      </div>
    </article>
  );
}

export function BriefCardSkeleton() {
  return (
    <article className="cui-b-card" aria-hidden="true">
      <div className="cui-b-card-top">
        <Skeleton width={36} height={36} radius={9} />
        <div className="cui-b-card-brand"><Skeleton width="45%" height={12} /></div>
      </div>
      <div className="cui-b-card-body">
        <Skeleton width="70%" height={12} />
        <Skeleton width="85%" height={18} style={{ marginTop: 8 }} />
        <Skeleton width="100%" height={12} style={{ marginTop: 10 }} />
      </div>
      <div className="cui-b-card-foot">
        <Skeleton width={110} height={22} />
        <Skeleton width={84} height={40} radius={999} />
      </div>
    </article>
  );
}
