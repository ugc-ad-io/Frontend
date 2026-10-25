import { useEffect } from 'react';
import { ArrowLeft, Check, X, Download, Play } from 'lucide-react';
import briefDeliveryLabel from '../utils/briefDeliveryLabel';
import { creatorsWanted, slotsLeft } from '../utils/campaignCreators';
import { maxCampaignBid } from '../utils/bidBudget';
import { BriefLogo, briefPay, bidCount, inr } from './briefUi';
import '../styles/creator-ui-briefs.css';
import '../styles/creator-ui-apply.css';

// Full brief detail (design board C03). Shared by Find briefs and Saved briefs.
//
// Expects a normalized brief (see normalizeBrief) that still carries the raw
// campaign object on `.campaign` — that's where the structured brief lives.
// `applyPanel` (optional) replaces the default "Apply" card in the right column
// (Find briefs passes the bid form there once the bid gates are passed).

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// Force a real download. The bare `download` attribute is IGNORED cross-origin
// (uploads are served from the backend host, not the app host), so the browser
// would just open the file instead. Fetching it as a blob and clicking an object
// URL makes it download for real; falls back to opening in a tab if CORS blocks.
const downloadFile = async (url, suggestedName) => {
  const name = suggestedName || (url.split('/').pop() || 'download').split('?')[0];
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
};

// Render the newline-separated brief into readable lines.
const renderBrief = (text) => {
  const out = [];
  String(text || '').split('\n').forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    const idx = t.indexOf(':');
    if (idx > 0 && idx <= 28) {
      out.push(<p key={i} className="cui-b-line"><b>{t.slice(0, idx)}:</b> {t.slice(idx + 1).trim()}</p>);
    } else {
      out.push(<p key={i} className="cui-b-line">{t}</p>);
    }
  });
  return out.length ? out : <p className="cui-b-line">No brief details provided.</p>;
};

// The brief form stores the CTA's destination in ONE field (cta_link), but what it
// holds depends on the chosen CTA — a URL for "Visit website"/"Swipe up", a social
// handle for "Follow brand". Mirror PostABrief's CTA_INPUT labels so the creator
// reads the value the same way the brand entered it. ("Use code" has no link; its
// value lives in promo_code, which is already shown.)
const CTA_LINK_LABEL = {
  'Visit website': 'Website link',
  'Swipe up': 'Swipe-up link',
  'Follow brand': 'Brand handle to follow',
};

const fmtDay = (d) => {
  const ms = d ? new Date(d).getTime() : NaN;
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
};

export default function BriefDetailDrawer({ brief, onClose, onBid, applyPanel }) {
  // Esc closes; the page behind stops scrolling while the detail is open.
  const isOpen = Boolean(brief);
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [isOpen, onClose]);

  if (!brief) return null;

  const b = brief;
  const c = b.campaign || {};
  const objectives = Array.isArray(c.objectives) ? c.objectives.filter(Boolean) : [];
  const listVal = (v) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : (v || ''));
  const deliverables = Array.isArray(c.deliverable_items) ? c.deliverable_items : [];

  // Full structured brief — grouped sections, empty rows filtered out.
  const groups = [
    { h: 'Product', rows: [
      ['Product', c.product_name],
      ['Product type', [c.product_type, c.product_type_detail].filter(Boolean).join(' - ')],
      ['Category', c.product_category || c.category],
      ['Description', c.product_description],
      ['Hook', c.campaign_hook],
      ['Key message', c.key_message],
      ['Target audience', c.target_audience],
      ['Video language', c.language],
    ] },
    { h: 'Deliverables', rows: deliverables.map((d, i) => [
      `Deliverable ${i + 1}`,
      `${d.quantity || 1} x ${d.type || ''}${d.duration ? `; ${d.duration}` : ''}${d.aspect_ratios?.length ? `; ${d.aspect_ratios.join(', ')}` : ''}; deliver ${briefDeliveryLabel(d)}`,
    ]) },
    { h: 'Script', rows: [
      ['Script provider', c.script_provider === 'ugc' ? 'UGC.ad' : c.script_provider === 'brand' ? 'Brand' : ''],
      ['Script', c.script_text || (c.script_provider === 'ugc' ? 'UGC.ad is preparing the script - check back before you start.' : '')],
    ] },
    { h: 'Creator targeting', rows: [
      ['Creator level', c.creator_level],
      ['Quality tier', c.content_quality_tier],
      ['Gender preference', c.gender_preference],
      ['Location', c.city_filter || 'Any location'],
    ] },
    { h: 'Style guidance', rows: [
      ['Tone', listVal(c.tone_tags)],
      ['Pacing', c.pacing],
      ['Music', c.music_preference],
      // Reference videos render as playable media below, not as a text row.
    ] },
    { h: 'Usage rights', rows: [
      ['Platforms', listVal(c.usage_platforms)],
      ['Rights duration', c.rights_duration],
      ['Exclusivity', c.exclusivity],
      ['Whitelisting', c.whitelisting ? 'Yes' : ''],
      ['Modification', c.modification_rights],
    ] },
  ];
  const mustInclude = [
    ['Product visible', c.product_visible ? `${c.product_visible_seconds || ''}s minimum` : ''],
    ['Verbal mention', c.verbal_mention ? (c.verbal_mention_text || 'Yes') : ''],
    ['Required phrases', listVal(c.required_phrases)],
    ['Required shots', listVal(c.required_shots)],
    ['Call to action', c.call_to_action],
    // The CTA destination itself — without this the creator was told to add a CTA
    // but never given the URL/handle to point it at. Blank rows self-filter below.
    [CTA_LINK_LABEL[c.call_to_action] || 'CTA link', c.cta_link],
    ['Promo code', c.promo_code],
    ['Hashtags', c.hashtags],
    ['Brand tag', c.brand_handle_tag ? 'Yes' : ''],
  ];
  const mustAvoid = [
    ['Competitors', c.no_competitors ? (c.competitors_text || 'No competitor brands') : ''],
    ['Other products', c.no_other_products ? 'Not allowed' : ''],
    ['Profanity', c.no_profanity ? 'Not allowed' : ''],
    ['Political/religious', c.no_political ? 'Not allowed' : ''],
    ['Filters/effects', c.avoid_filters ? (c.filter_types_text || 'Avoid') : ''],
    ['Other', c.avoid_text],
  ];
  const filled = (rows) => rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');
  const sections = groups.map((s) => ({ ...s, rows: filled(s.rows) })).filter((s) => s.rows.length);
  const include = filled(mustInclude);
  const avoid = filled(mustAvoid);

  // Real dates the brief states, in order. (No invented "apply by" date.)
  const dates = [
    ['Product ships by', c.product_shipping_by],
    ['First draft', c.draft_delivery_by],
    ['Final delivery', c.final_delivery_by || c.due_date || c.deadline],
  ].map(([k, v]) => [k, fmtDay(v)]).filter(([, v]) => v);

  // Mood board references the brand uploaded. Legacy campaigns stored bare file
  // names (never real uploads), so keep only entries that are actual URLs.
  const moodImages = (Array.isArray(c.mood_images) ? c.mood_images : [])
    .filter((u) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('/')))
    .map((u) => (u.startsWith('http') ? u : `${BACKEND_URL}${u}`));

  // Reference videos: a brand can upload a clip (served from /uploads → playable
  // inline) or paste an external link (YouTube/Drive → shown as a link out).
  const refVideos = (Array.isArray(c.reference_videos) ? c.reference_videos : [])
    .filter((u) => typeof u === 'string' && u.trim())
    .map((u) => {
      const raw = u.trim();
      const hosted = /\/uploads?\//i.test(raw);
      return { hosted, url: raw.startsWith('http') || !hosted ? raw : `${BACKEND_URL}${raw}` };
    });

  const needed = creatorsWanted(c);
  const open = slotsLeft(c);
  const deliv = deliverables.length ? b.deliverables : '';
  const length = deliverables.map((d) => d?.duration).find(Boolean) || '';
  const lang = Array.isArray(c.language) ? c.language.join(' / ') : c.language;
  const n = bidCount(b);
  const maximum = maxCampaignBid(b);
  const pay = briefPay(b);
  const cta = b.hasBid ? 'View your bid' : 'Apply now';

  return (
    <div className="cui-b-detail" role="dialog" aria-modal="true" aria-label={b.title}>
      <div className="cui-b-dtop">
        <button type="button" className="cui-b-back" onClick={onClose} aria-label="Back to briefs">
          <ArrowLeft size={20} /><span>Find briefs</span>
        </button>
        <span className="cui-b-crumb" aria-hidden="true">›</span>
        <span className="cui-b-dtitle">{b.title}</span>
      </div>

      <div className="cui-b-dgrid">
        <div className="cui-b-dmain">
          <section className="cui-b-dcard cui-b-dhead">
            <div className="cui-b-dbrand">
              <BriefLogo name={b.brand} src={b.logo} className="cui-b-logo cui-b-logo--lg" />
              <div><strong>{b.brand}</strong>{b.industryType ? <small>{b.industryType}</small> : null}</div>
              {c.requires_shipment ? <span className="cui-b-flag">Product shipped</span> : null}
            </div>
            <h2>{b.title}</h2>
            {b.description && b.description !== 'Create engaging UGC content for this brand.' ? <p className="cui-b-lead">{b.description}</p> : null}
            <div className="cui-b-dstats">
              <div><small>Pay per video</small><b>{pay}</b></div>
              {(deliv || length) && <div><small>Make</small><b>{[deliv, length].filter(Boolean).join(' · ')}</b></div>}
              {lang ? <div><small>Language</small><b>{lang}</b></div> : null}
              <div><small>Creators</small><b>{open < needed ? `${open} of ${needed} open` : `${needed} needed`}</b></div>
            </div>
            {objectives.length > 0 && <div className="cui-b-tags">{objectives.map((o, i) => <span key={i}>{o}</span>)}</div>}
          </section>

          {dates.length > 0 && (
            <section className="cui-b-dcard">
              <h3>Dates</h3>
              <ol className="cui-b-dates">
                {dates.map(([k, v], i) => (
                  <li key={k}><span className={`cui-b-dot${i === 0 ? ' is-first' : ''}`} /><small>{k}</small><b>{v}</b></li>
                ))}
              </ol>
              {c.revision_limit ? <p className="cui-b-foot-note">Revisions included: {c.revision_limit}</p> : null}
            </section>
          )}

          {(include.length > 0 || avoid.length > 0) && (
            <div className="cui-b-two">
              {include.length > 0 && (
                <section className="cui-b-dcard">
                  <h3>What the brand wants</h3>
                  <ul className="cui-b-list">
                    {include.map(([k, v]) => (
                      <li key={k}><span className="cui-b-ic"><Check size={12} strokeWidth={3} /></span><span><b>{k}:</b> {String(v)}</span></li>
                    ))}
                  </ul>
                </section>
              )}
              {avoid.length > 0 && (
                <section className="cui-b-dcard">
                  <h3>Please don’t</h3>
                  <ul className="cui-b-list is-bad">
                    {avoid.map(([k, v]) => (
                      <li key={k}><span className="cui-b-ic"><X size={12} strokeWidth={3} /></span><span><b>{k}:</b> {String(v)}</span></li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {(moodImages.length > 0 || refVideos.length > 0) && (
            <section className="cui-b-dcard">
              <h3>Example videos <small>shared by the brand</small></h3>
              {refVideos.length > 0 && (
                <div className="cui-b-media">
                  {refVideos.map(({ hosted, url }, i) => (
                    hosted ? (
                      <div className="cui-b-vid" key={`${url}-${i}`}>
                        <video src={url} controls preload="metadata" playsInline />
                        <button type="button" className="cui-b-dl" aria-label="Download video" title="Download video" onClick={() => downloadFile(url, `reference-${i + 1}.mp4`)}><Download size={14} /></button>
                      </div>
                    ) : (
                      // External links (YouTube/Drive) can't be embedded or downloaded — open them out.
                      <a key={`${url}-${i}`} href={url} target="_blank" rel="noreferrer" className="cui-b-reflink"><Play size={14} /> {url}</a>
                    )
                  ))}
                </div>
              )}
              {moodImages.length > 0 && (
                <>
                  {refVideos.length > 0 && <h4>Mood board</h4>}
                  <div className="cui-b-media is-mood">
                    {moodImages.map((src, i) => (
                      <div className="cui-b-mood" key={`${src}-${i}`}>
                        <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Mood board ${i + 1}`} /></a>
                        <button type="button" className="cui-b-dl" aria-label="Download image" title="Download image" onClick={() => downloadFile(src, `moodboard-${i + 1}.jpg`)}><Download size={14} /></button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {sections.map((s) => (
            <section className="cui-b-dcard" key={s.h}>
              <h3>{s.h}</h3>
              <div className="cui-b-rows">
                {s.rows.map(([label, value]) => (
                  <div className="cui-b-drow" key={label}>
                    <span>{label}</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {sections.length === 0 && !include.length && !avoid.length && b.description ? (
            <section className="cui-b-dcard"><h3>Brief</h3><div>{renderBrief(b.description)}</div></section>
          ) : null}
        </div>

        <aside className="cui-b-dside">
          {applyPanel || (
            <div className="cui-b-apply cui-b-apply--intro">
              <h2>{b.hasBid ? 'You applied to this brief' : 'Apply to this brief'}</h2>
              <p className="cui-b-sub">{n != null ? `${n} ${n === 1 ? 'creator' : 'creators'} applied` : 'Send your price and a short pitch'}</p>
              <div className="cui-b-payrow"><span>Pay per video</span><b>{pay}</b></div>
              {maximum ? <p className="cui-b-hint">Set your own price when you apply — up to {inr(maximum)} per video.</p> : null}
              <button type="button" className="cui-b-cta" onClick={() => onBid(b)}>{cta}</button>
            </div>
          )}
        </aside>
      </div>

      {!applyPanel && (
        <div className="cui-b-dbar">
          <div><small>Pay per video</small><b>{pay}</b></div>
          <button type="button" className="cui-b-cta" onClick={() => onBid(b)}>{cta}</button>
        </div>
      )}
    </div>
  );
}
