import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, MessageSquare, Star, Building2, Globe, MapPin, Layers, Briefcase } from 'lucide-react';
import { brandName } from '../utils/displayName';
import { CONTENT_CATEGORIES } from '../constants/contentCategories';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));

const relTime = (ts) => {
  if (!ts) return '';
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d < 1) return 'today';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
};

// Turn a stored content-category slug ('try_on') into its human label ('Try-On / Haul').
const categoryLabel = (slug) => {
  if (!slug) return '';
  const hit = CONTENT_CATEGORIES.find((c) => c.value === slug);
  return hit ? hit.label : String(slug).replace(/_/g, ' ');
};

function Stars({ n = 0, size = 14 }) {
  return (
    <span className="bpc-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= Math.round(n) ? '#f5b301' : 'none'} color={i <= Math.round(n) ? '#f5b301' : '#cfd2e6'} />
      ))}
    </span>
  );
}

/**
 * Brand profile a CREATOR opens from the Messages view. Mirrors the creator
 * profile card's look (banner + avatar + stats + highlights + tabs) but shows
 * brand-relevant fields — brand name, RATING, category, industry, website.
 * Contact person / phone / email are intentionally NOT shown (anti-off-platform).
 */
export default function BrandProfileCard({ id, fallbackName, onClose, onMessage }) {
  const [data, setData] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('details');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    axios.get(`${API}/profile/${id}`)
      .then((r) => { if (alive) setData(r.data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    // Review list is a bonus — if the endpoint isn't live yet the aggregate rating
    // (from the profile doc) still renders, so swallow any error to an empty list.
    axios.get(`${API}/reviews/business/${id}`)
      .then((r) => { if (alive) setReviews(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (alive) setReviews([]); });
    return () => { alive = false; };
  }, [id]);

  const p = { ...(data || {}), ...(data?.profile || {}) };
  const name = (brandName(data) !== 'Brand' ? brandName(data) : (fallbackName || 'Brand')).replace(/^@/, '');
  const publicId = data?.public_business_id || String(id || '').slice(0, 12);
  const logo = assetUrl(p.logo || data?.profile_photo || p.profile_photo || '');
  const banner = assetUrl(p.banner || data?.banner || '');
  const website = p.website || p.website_url || '';
  const websiteHref = website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : '';
  const industry = p.industry_category || p.industry || '';
  const category = categoryLabel(p.category) || industry || 'General';
  const city = p.city || p.location || '';
  const country = p.country || '';
  const locationTxt = [city, country].filter(Boolean).join(', ');

  // Rating: prefer the review list we just fetched; fall back to the aggregate the
  // backend stamps on the brand doc when a creator reviews them.
  const listCount = reviews.length;
  const listAvg = listCount ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / listCount : 0;
  const reviewCount = listCount || Number(data?.total_reviews || 0);
  const avgRating = listCount ? listAvg : Number(data?.average_rating || 0);
  const ratingTxt = reviewCount ? avgRating.toFixed(1) : 'New';

  const rows = [
    { Icon: Building2, label: 'Brand Name', value: name },
    { Icon: Layers, label: 'Category', value: category },
    industry ? { Icon: Briefcase, label: 'Industry', value: industry } : null,
    locationTxt ? { Icon: MapPin, label: 'Location', value: locationTxt } : null,
  ].filter(Boolean);

  return (
    <div className="bpc-ov" onClick={onClose}>
      <div className="bpc" onClick={(e) => e.stopPropagation()}>
        <div
          className="bpc-banner"
          style={banner ? { backgroundImage: `url(${banner}), linear-gradient(120deg,#5b6bff,#23236a 55%,#4452f0)` } : undefined}
        >
          <button type="button" className="bpc-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="bpc-phead">
          <div className="bpc-avatar-wrap">
            <span className="bpc-avatar-lg">
              {logo ? <img src={logo} alt="" /> : (name.charAt(0) || 'B').toUpperCase()}
            </span>
          </div>

          <div className="bpc-actions">
            {onMessage && <button type="button" className="bpc-msg" onClick={onMessage}><MessageSquare size={16} /> Send Message</button>}
          </div>

          <h2 className="bpc-name">{name}</h2>
          <div className="bpc-id">
            ID: {publicId}{locationTxt ? ` · ${locationTxt}` : ''}
          </div>

          <div className="bpc-stats">
            <span className="bpc-stat-rating">
              <Star size={15} fill="#f5b301" color="#f5b301" />
              <strong>{ratingTxt}</strong> rating
            </span>
            <span><strong>{reviewCount}</strong> review{reviewCount === 1 ? '' : 's'}</span>
            <span className="bpc-badge">Brand</span>
          </div>

          <div className="bpc-highlights">
            <div className="bpc-hl"><label>Category</label><strong>{category}</strong></div>
            <div className="bpc-hl"><label>Rating</label><strong>{reviewCount ? `${avgRating.toFixed(1)} / 5` : 'Not rated yet'}</strong></div>
            <div className="bpc-hl">
              <label>Website</label>
              {websiteHref
                ? <a className="bpc-hl-link" href={websiteHref} target="_blank" rel="noreferrer"><Globe size={13} /> Visit</a>
                : <strong>—</strong>}
            </div>
          </div>
        </div>

        <div className="bpc-tabs">
          <button type="button" className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}>Details</button>
          <button type="button" className={tab === 'reviews' ? 'on' : ''} onClick={() => setTab('reviews')}>
            Reviews{reviewCount > 0 ? ` (${reviewCount})` : ''}
          </button>
        </div>

        <div className="bpc-body">
          {loading ? (
            <div className="bpc-empty">Loading brand profile…</div>
          ) : tab === 'details' ? (
            <section className="bpc-sec">
              <div className="bpc-grid">
                {rows.map(({ Icon, label, value }) => (
                  <div key={label} className="bpc-f">
                    <label><Icon size={13} /> {label}</label>
                    <span>{value}</span>
                  </div>
                ))}
                <div className="bpc-f wide">
                  <label><Globe size={13} /> Website</label>
                  {websiteHref
                    ? <a className="bpc-link" href={websiteHref} target="_blank" rel="noreferrer">{website}</a>
                    : <span>—</span>}
                </div>
              </div>
            </section>
          ) : (
            <section className="bpc-sec">
              {reviewCount === 0 ? (
                <div className="bpc-rev-empty">
                  <Star size={26} color="#cfd2e6" />
                  <strong>No reviews yet</strong>
                  <span>Reviews from creators appear here once a deal is completed.</span>
                </div>
              ) : (
                <div className="bpc-reviews">
                  <div className="bpc-rev-head">
                    <h3>{reviewCount} Review{reviewCount > 1 ? 's' : ''}</h3>
                    <div className="bpc-rev-overall"><Stars n={avgRating} size={16} /> <b>{avgRating.toFixed(1)}</b></div>
                  </div>
                  {listCount > 0 && (
                    <div className="bpc-rev-list">
                      {reviews.map((rv, i) => {
                        const text = rv.review || rv.review_text || rv.comment || '';
                        return (
                          <div className="bpc-rev-card" key={rv.id || i}>
                            <div className="bpc-rev-who">
                              <span className="bpc-rev-ava">C</span>
                              <div>
                                <strong>Creator</strong>
                                <div className="bpc-rev-meta">
                                  <Stars n={rv.rating} size={13} /> <b>{(rv.rating || 0).toFixed(0)}</b>
                                  <span>· {relTime(rv.created_at)}</span>
                                </div>
                              </div>
                            </div>
                            {text && <p className="bpc-rev-text">{text}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <style>{`
        .bpc-ov{position:fixed;inset:0;background:rgba(15,22,58,.5);backdrop-filter:blur(3px);z-index:1400;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto}
        .bpc{position:relative;width:min(720px,100%);background:#fff;border-radius:22px;box-shadow:0 30px 70px rgba(15,22,58,.4);overflow:hidden}
        .bpc-banner{position:relative;height:170px;background:linear-gradient(120deg,#5b6bff,#23236a 55%,#4452f0);background-size:cover;background-position:center}
        .bpc-x{position:absolute;top:16px;right:16px;width:38px;height:38px;border-radius:50%;border:none;background:rgba(255,255,255,.92);color:#15163a;cursor:pointer;display:grid;place-items:center;z-index:2;box-shadow:0 4px 14px rgba(15,22,58,.25)}
        .bpc-phead{position:relative;padding:0 28px 20px}
        .bpc-avatar-wrap{position:relative;width:108px;height:108px;margin-top:-54px}
        .bpc-avatar-lg{box-sizing:border-box;display:grid;place-items:center;width:108px;height:108px;border-radius:24px;border:4px solid #fff;overflow:hidden;background:linear-gradient(135deg,#5b6bff,#23236a);color:#fff;font-weight:800;font-size:38px;box-shadow:0 8px 22px -8px rgba(15,22,58,.4)}
        .bpc-avatar-lg img{width:100%;height:100%;object-fit:cover}
        .bpc-actions{position:absolute;right:28px;top:122px;display:flex;align-items:center;gap:10px}
        .bpc-msg{display:inline-flex;align-items:center;gap:8px;background:#15163a;color:#fff;border:none;border-radius:30px;padding:11px 20px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit}
        .bpc-msg:hover{filter:brightness(1.12)}
        .bpc-name{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:25px;font-weight:800;color:#15163a;margin:12px 0 2px}
        .bpc-id{color:#9296ba;font-size:13px;font-weight:600}
        .bpc-stats{display:flex;flex-wrap:wrap;align-items:center;gap:8px 26px;margin-top:16px}
        .bpc-stats span{color:#9296ba;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:5px}
        .bpc-stats strong{color:#15163a;font-size:17px;font-weight:800}
        .bpc-stat-rating strong{margin:0 2px}
        .bpc-badge{padding:3px 12px;border-radius:20px;background:#eef0ff;color:#5b6bff;font-size:12px!important;font-weight:700!important}
        .bpc-highlights{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px;padding:16px;border:1px solid #ebedfb;border-radius:16px;background:linear-gradient(140deg,#fbfbff,#f4f5ff)}
        .bpc-hl{min-width:0}
        .bpc-hl label{display:block;color:#9296ba;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
        .bpc-hl strong{display:block;color:#07074e;font-size:16px;font-weight:800;margin-top:3px;text-transform:capitalize;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .bpc-hl-link{display:inline-flex;align-items:center;gap:5px;margin-top:5px;color:#4452f0;font-size:14px;font-weight:800;text-decoration:none}
        .bpc-hl-link:hover{text-decoration:underline}
        @media (max-width:520px){.bpc-highlights{grid-template-columns:1fr 1fr}}
        .bpc-tabs{display:flex;gap:26px;border-bottom:1px solid #eef0f6;margin-top:20px;padding:0 28px;background:#fff}
        .bpc-tabs button{background:none;border:none;padding:14px 2px;font-size:15px;font-weight:700;color:#9296ba;cursor:pointer;font-family:inherit;border-bottom:2.5px solid transparent;margin-bottom:-1px}
        .bpc-tabs button.on{color:#15163a;border-bottom-color:#5b6bff}
        .bpc-body{padding:22px 28px 26px}
        .bpc-sec{padding-top:2px}
        .bpc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
        .bpc-f{display:flex;flex-direction:column;gap:5px;min-width:0}
        .bpc-f.wide{grid-column:1/-1}
        .bpc-f label{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#9296ba;text-transform:uppercase;letter-spacing:.3px}
        .bpc-f span{font-size:14.5px;color:#15163a;font-weight:600;overflow-wrap:anywhere;text-transform:capitalize}
        .bpc-link{font-size:14.5px;color:#4452f0;font-weight:600;overflow-wrap:anywhere;text-decoration:none}
        .bpc-link:hover{text-decoration:underline}
        .bpc-empty{text-align:center;color:#9296ba;padding:30px 0;font-size:14px}
        .bpc-stars{display:inline-flex;gap:2px;vertical-align:middle}
        .bpc-reviews{display:flex;flex-direction:column;gap:16px}
        .bpc-rev-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .bpc-rev-head h3{margin:0;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:19px;font-weight:800;color:#15163a}
        .bpc-rev-overall{display:inline-flex;align-items:center;gap:8px}
        .bpc-rev-overall b{font-size:16px;color:#15163a}
        .bpc-rev-list{display:flex;flex-direction:column;gap:12px;border-top:1px solid #eef0f6;padding-top:16px}
        .bpc-rev-card{border:1px solid #eef0f6;border-radius:14px;padding:14px 16px;background:#fff}
        .bpc-rev-who{display:flex;align-items:center;gap:10px}
        .bpc-rev-ava{width:38px;height:38px;border-radius:50%;flex:none;display:grid;place-items:center;background:linear-gradient(135deg,#5b6bff,#23236a);color:#fff;font-weight:800;font-size:15px}
        .bpc-rev-who strong{font-size:14.5px;color:#15163a}
        .bpc-rev-meta{display:flex;align-items:center;gap:6px;margin-top:4px;color:#9296ba;font-size:12.5px}
        .bpc-rev-meta b{color:#15163a;font-size:13px}
        .bpc-rev-text{margin:10px 0 0;color:#3a3d63;font-size:14px;line-height:1.6}
        .bpc-rev-empty{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:34px 20px;border:1px dashed #e6e8f3;border-radius:16px;background:#fafbff}
        .bpc-rev-empty strong{color:#15163a;font-size:15px;font-weight:800}
        .bpc-rev-empty span{color:#9296ba;font-size:13px;max-width:320px}
        @media(max-width:640px){.bpc-actions{position:static;margin-top:12px}.bpc-msg{flex:1}}
      `}</style>
    </div>
  );
}
