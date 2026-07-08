import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Building2, User, Mail, Phone, Globe } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));

// Read-only brand/business profile for the admin deal room. Mirrors the fields a
// brand sees on their own Profile Settings page, fetched by id via an ops endpoint.
export default function BrandProfileModal({ id, fallbackName, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    if (!id) { setLoading(false); setError('No brand id was provided for this deal.'); return; }
    setLoading(true);
    setError('');
    axios.get(`${API}/admin/business/${id}/profile`)
      .then((r) => { if (alive) setData(r.data); })
      .catch((e) => {
        if (!alive) return;
        console.error('BrandProfileModal load failed:', e?.response?.status, e?.response?.data || e?.message);
        setError(
          e?.response?.status === 404
            ? "Brand profile endpoint not found (404). The backend may need a restart to load the new route."
            : (e?.response?.data?.detail || 'Could not load this brand profile.')
        );
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const brandName = data?.brand_name || fallbackName || 'Brand';
  const logo = assetUrl(data?.logo_url);
  const website = data?.website_url || '';
  const websiteHref = website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : '';

  const rows = [
    { icon: Building2, label: 'Brand Name', value: data?.brand_name },
    { icon: User, label: 'Contact Person', value: data?.contact_person },
    { icon: Mail, label: 'Work Email', value: data?.work_email },
    { icon: Phone, label: 'Phone Number', value: data?.phone_number },
  ];

  return (
    <div className="bpm-overlay" onClick={onClose}>
      <div className="bpm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bpm-head">
          <div className="bpm-head-l">
            <div className="bpm-logo">
              {logo ? <img src={logo} alt="" /> : <Building2 size={22} />}
            </div>
            <div>
              <strong>{brandName}</strong>
              <small>Brand profile{data?.username ? ` · @${String(data.username).replace(/^@/, '')}` : ''}</small>
            </div>
          </div>
          <button type="button" className="bpm-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="bpm-body">
          {loading ? (
            <p className="bpm-empty">Loading brand profile…</p>
          ) : error ? (
            <p className="bpm-error">{error}</p>
          ) : (
            <div className="bpm-grid">
              {rows.map(({ icon: Icon, label, value }) => (
                <div key={label} className="bpm-field">
                  <span className="bpm-label"><Icon size={13} /> {label}</span>
                  <span className="bpm-value">{value || '—'}</span>
                </div>
              ))}
              <div className="bpm-field bpm-field-wide">
                <span className="bpm-label"><Globe size={13} /> Website URL</span>
                {websiteHref ? (
                  <a className="bpm-value bpm-link" href={websiteHref} target="_blank" rel="noreferrer">{website}</a>
                ) : (
                  <span className="bpm-value">—</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .bpm-overlay { position: fixed; inset: 0; background: rgba(15, 18, 40, 0.5); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .bpm-modal { background: #fff; width: 100%; max-width: 560px; border-radius: 16px; box-shadow: 0 24px 60px rgba(7, 7, 78, 0.25); overflow: hidden; }
        .bpm-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 20px; border-bottom: 1px solid #eef0f5; }
        .bpm-head-l { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .bpm-logo { width: 48px; height: 48px; border-radius: 12px; background: #eef0ff; color: #5b6bff; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
        .bpm-logo img { width: 100%; height: 100%; object-fit: cover; }
        .bpm-head-l strong { display: block; color: #111827; font-size: 1.05rem; }
        .bpm-head-l small { color: #98a1ad; font-size: 0.78rem; }
        .bpm-x { border: none; background: #f3f4f8; color: #5b6573; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .bpm-x:hover { background: #e8eaf1; }
        .bpm-body { padding: 20px; }
        .bpm-empty { color: #98a1ad; font-size: 0.88rem; text-align: center; margin: 20px 0; }
        .bpm-error { color: #b42318; background: #fff5f4; border: 1px solid #f3aaa3; border-radius: 10px; font-size: 0.86rem; text-align: center; margin: 8px 0; padding: 14px 16px; line-height: 1.5; }
        .bpm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .bpm-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .bpm-field-wide { grid-column: 1 / -1; }
        .bpm-label { display: flex; align-items: center; gap: 5px; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: #98a1ad; font-weight: 600; }
        .bpm-value { font-size: 0.9rem; color: #111827; word-break: break-word; padding: 10px 12px; background: #f7f8fc; border: 1px solid #eef0f5; border-radius: 10px; }
        .bpm-link { color: #5b6bff; text-decoration: none; }
        .bpm-link:hover { text-decoration: underline; }
        @media (max-width: 520px) { .bpm-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
