import './Skeleton.css';

// Reusable shimmer skeletons for loading states.
//
//   <Skeleton width={120} height={16} />         → a single shimmer box
//   <SkeletonText lines={3} />                    → stacked text lines
//   <SkeletonTable rows={6} cols={5} />           → a table placeholder
//   <SkeletonCards count={6} />                   → card-grid placeholder

const px = (v) => (typeof v === 'number' ? `${v}px` : v);

export function Skeleton({ width = '100%', height = 14, radius = 6, style, className = '' }) {
  return (
    <span
      className={`sk ${className}`}
      style={{ width: px(width), height: px(height), borderRadius: px(radius), ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, gap = 8, lastWidth = '60%' }) {
  return (
    <span className="sk-text" style={{ gap: px(gap) }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? lastWidth : '100%'} />
      ))}
    </span>
  );
}

// Table placeholder: an optional header row + N body rows × M columns.
export function SkeletonTable({ rows = 6, cols = 5, header = true }) {
  return (
    <div className="sk-table" role="status" aria-label="Loading">
      {header && (
        <div className="sk-tr sk-tr--head">
          {Array.from({ length: cols }).map((_, c) => (
            <div className="sk-td" key={c}><Skeleton height={10} width="55%" /></div>
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, r) => (
        <div className="sk-tr" key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <div className="sk-td" key={c}>
              <Skeleton height={13} width={c === 0 ? '80%' : `${45 + ((r + c) % 4) * 12}%`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Card-grid placeholder (e.g. application cards, dashboards).
export function SkeletonCards({ count = 6, height = 120 }) {
  return (
    <div className="sk-cards" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div className="sk-card" key={i}>
          <div className="sk-card-head">
            <Skeleton width={44} height={44} radius={12} />
            <div className="sk-card-lines">
              <Skeleton height={13} width="70%" />
              <Skeleton height={10} width="45%" />
            </div>
          </div>
          <Skeleton height={height} radius={10} />
          <div className="sk-card-foot">
            <Skeleton height={30} width={90} radius={8} />
            <Skeleton height={30} width={90} radius={8} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
