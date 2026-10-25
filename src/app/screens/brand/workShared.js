import { useState } from 'react';
import { apiErrorMessage } from '../../../utils/apiError';

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
export const API = `${BACKEND_URL}/api`;

export const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const firstWord = (v, fb = 'Creator') => String(v || fb).replace(/^@+/, '').trim().split(/\s+/)[0] || fb;
export const shortDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
export const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${String(u).startsWith('/') ? '' : '/'}${u}`));

// A failed request is never shown as "nothing here": offline gets its own wording.
export const loadErrorText = (e, fallback) => (e?.response
  ? apiErrorMessage(e, fallback)
  : "You're offline or we can't reach UGCad. Check your connection and try again.");

// Round avatar: the initial always renders, the photo covers it once it loads.
export function Avatar({ name, src, size = 40, className = '', bg }) {
  const [bad, setBad] = useState(false);
  const initial = (String(name || 'C').replace(/^@+/, '').trim().charAt(0) || 'C').toUpperCase();
  return (
    <span className={`ap-wk-ava ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.4), ...(bg ? { background: bg, color: '#fff' } : null) }} aria-hidden="true">
      <span>{initial}</span>
      {src && !bad ? <img src={src} alt="" onError={() => setBad(true)} /> : null}
    </span>
  );
}

// Skeleton rows used while a list loads.
export function Skeletons({ n = 3, h = 120 }) {
  return (
    <div className="ap-wk-list" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="ap-skel" style={{ height: h, borderRadius: 20 }} />)}
    </div>
  );
}

// Error card with Retry (a failed load must not look like an empty list).
export function LoadError({ title, message, onRetry }) {
  return (
    <div className="ap-card ap-empty" role="alert">
      <h3>{title}</h3>
      <p>{message}</p>
      <button type="button" className="ap-btn" onClick={onRetry}>Try again</button>
    </div>
  );
}
