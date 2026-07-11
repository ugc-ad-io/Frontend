import { X, Send, Wallet, Clock, Star, Target } from 'lucide-react';

// Full campaign-brief detail drawer. Shared by Browse Campaigns and Saved
// Campaigns so both open the same view in place instead of redirecting.
//
// Expects a normalized brief (see normalizeBrief) that still carries the raw
// campaign object on `.campaign` — that's where the structured brief lives.

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();

// Map a niche/tag to a consistent colour class so each category reads distinctly.
const CAT_MAP = [
  [/beauty|skin|makeup|cosmet/i, 'c-beauty'],
  [/tech|gadget|electronic|app|software/i, 'c-tech'],
  [/fashion|apparel|cloth|style|jewel/i, 'c-fashion'],
  [/life ?style|home|decor|interior/i, 'c-lifestyle'],
  [/food|snack|beverage|drink|recipe|cook/i, 'c-food'],
  [/fit|gym|health|wellness|yoga|sport/i, 'c-fitness'],
  [/travel|trip|tour|hotel|destination/i, 'c-travel'],
  [/game|gaming|esport/i, 'c-gaming'],
  [/finance|fintech|bank|invest|money/i, 'c-finance'],
];
const catClass = (tag) => (CAT_MAP.find(([re]) => re.test(String(tag || '')))?.[1]) || 'c-default';

// Render the newline-separated brief into a readable definition list.
const renderBrief = (text) => {
  const lines = String(text || '').split('\n');
  const out = [];
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    const idx = t.indexOf(':');
    if (idx > 0 && idx <= 28) {
      out.push(<p key={i} className="bb-bl"><span className="bb-blab">{t.slice(0, idx)}:</span> {t.slice(idx + 1).trim()}</p>);
    } else {
      out.push(<p key={i} className="bb-bl">{t}</p>);
    }
  });
  return out.length ? out : <p className="bb-bl">No brief details provided.</p>;
};

export default function BriefDetailDrawer({ brief, onClose, onBid }) {
  if (!brief) return null;

  const b = brief;
  const c = b.campaign || {};
  const objectives = Array.isArray(c.objectives) ? c.objectives.filter(Boolean) : [];
  const listVal = (v) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : (v || ''));
  const deliverables = Array.isArray(c.deliverable_items) ? c.deliverable_items : [];

  // Full structured brief — grouped sections, empty rows filtered out.
  const detailSections = [
    { h: 'Product', rows: [
      ['Product', c.product_name],
      ['Category', c.product_category || c.category],
      ['Description', c.product_description],
      ['Hook', c.campaign_hook],
      ['Key message', c.key_message],
      ['Target audience', c.target_audience],
    ] },
    { h: 'Deliverables', rows: deliverables.map((d, i) => [
      `Deliverable ${i + 1}`,
      `${d.quantity || 1} x ${d.type || ''}${d.duration ? `; ${d.duration}` : ''}${d.aspect_ratios?.length ? `; ${d.aspect_ratios.join(', ')}` : ''}${d.raw_required ? '; raw files required' : ''}`,
    ]) },
    { h: 'Must include', rows: [
      ['Product visible', c.product_visible ? `${c.product_visible_seconds || ''}s minimum` : ''],
      ['Verbal mention', c.verbal_mention ? (c.verbal_mention_text || 'Yes') : ''],
      ['Required phrases', listVal(c.required_phrases)],
      ['Required shots', listVal(c.required_shots)],
      ['Call to action', c.call_to_action],
      ['Promo code', c.promo_code],
      ['Hashtags', c.hashtags],
      ['Brand tag', c.brand_handle_tag ? 'Yes' : ''],
    ] },
    { h: 'Must avoid', rows: [
      ['Competitors', c.no_competitors ? (c.competitors_text || 'No competitor brands') : ''],
      ['Other products', c.no_other_products ? 'Not allowed' : ''],
      ['Profanity', c.no_profanity ? 'Not allowed' : ''],
      ['Political/religious', c.no_political ? 'Not allowed' : ''],
      ['Filters/effects', c.avoid_filters ? (c.filter_types_text || 'Avoid') : ''],
      ['Other', c.avoid_text],
    ] },
    { h: 'Style guidance', rows: [
      ['Tone', listVal(c.tone_tags)],
      ['Pacing', c.pacing],
      ['Music', c.music_preference],
      ['Reference videos', listVal(c.reference_videos)],
    ] },
    { h: 'Usage rights', rows: [
      ['Platforms', listVal(c.usage_platforms)],
      ['Rights duration', c.rights_duration],
      ['Exclusivity', c.exclusivity],
      ['Whitelisting', c.whitelisting ? 'Yes' : ''],
      ['Modification', c.modification_rights],
    ] },
    { h: 'Timeline', rows: [
      ['Ship by', c.product_shipping_by],
      ['Final delivery', c.due_date || c.deadline],
      ['Revisions included', c.revision_limit],
    ] },
  ].map((s) => ({ ...s, rows: s.rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '') }))
   .filter((s) => s.rows.length);

  return (
    <div className="bb-drawer-overlay" onClick={onClose}>
      <aside className="bb-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="bb-d-head">
          <span className="bb-d-logo">
            {b.logo ? <img src={b.logo.startsWith('http') ? b.logo : `${BACKEND_URL}${b.logo}`} alt="" /> : getInitial(b.brand)}
          </span>
          <div className="bb-d-id">
            <strong>{b.title}</strong>
            <small>{b.brand}</small>
          </div>
          <button type="button" className="bb-drawer-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="bb-d-body">
          <div className="bb-d-stats">
            <div><span className="bb-d-ic"><Wallet size={16} /></span><div><label>Budget</label><strong>{b.budget}</strong></div></div>
            <div><span className="bb-d-ic"><Clock size={16} /></span><div><label>Delivery</label><strong>{b.deliveryLabel}</strong></div></div>
            <div><span className="bb-d-ic"><Star size={16} /></span><div><label>Match</label><strong>{b.matchScore}%</strong></div></div>
          </div>

          {b.tags?.length > 0 && (
            <div className="bb-d-tags">{b.tags.map((t) => <span key={t} className={catClass(t)}>{t}</span>)}</div>
          )}

          {b.description && b.description !== 'Create engaging UGC content for this brand.' && (
            <div className="bb-d-sec">
              <h4>Campaign Brief</h4>
              <div className="bb-d-brief">{renderBrief(b.description)}</div>
            </div>
          )}

          {objectives.length > 0 && (
            <div className="bb-d-sec">
              <h4><Target size={15} /> Objectives</h4>
              <div className="bb-d-chips">{objectives.map((o, i) => <span key={i}>{o}</span>)}</div>
            </div>
          )}

          {detailSections.map((s) => (
            <div className="bb-d-sec" key={s.h}>
              <h4>{s.h}</h4>
              <div className="bb-d-rows">
                {s.rows.map(([label, value]) => (
                  <div className="bb-d-row" key={label}>
                    <span className="bb-d-row-k">{label}</span>
                    <span className="bb-d-row-v">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bb-d-foot">
          <button type="button" className="bb-d-ghost" onClick={onClose}>Close</button>
          <button type="button" className="bb-d-primary" onClick={() => onBid(b)}>
            <Send size={16} /> {b.hasBid ? 'View Your Bid' : 'Submit Your Bid'}
          </button>
        </div>
      </aside>

      <style>{`
        .bb-drawer-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,22,58,.5);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px}
        .bb-drawer{position:relative;width:min(680px,100%);max-height:88vh;height:auto;background:#fff;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;box-shadow:0 30px 70px rgba(15,22,58,.42);animation:bb-pop .24s ease}
        @keyframes bb-pop{from{transform:translateY(14px) scale(.98);opacity:0}to{transform:none;opacity:1}}
        .bb-d-head{display:flex;align-items:center;gap:12px;padding:20px 22px;border-bottom:1px solid #e9ebf4}
        .bb-d-logo{width:44px;height:44px;flex:none;border-radius:12px;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#5b6bff,#23236a);color:#fff;font-weight:800;font-size:17px}
        .bb-d-logo img{width:100%;height:100%;object-fit:cover}
        .bb-d-id{flex:1;min-width:0}
        .bb-d-id strong{display:block;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:17px;color:#15163a;line-height:1.25}
        .bb-d-id small{color:#9296ba;font-size:13px}
        .bb-drawer-close{flex:none;width:34px;height:34px;border-radius:10px;border:none;background:#f1f3fa;color:#15163a;cursor:pointer;display:grid;place-items:center}
        .bb-drawer-close:hover{background:#e7eaf5}
        .bb-d-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:20px 24px;display:flex;flex-direction:column;gap:20px}
        .bb-d-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
        .bb-d-stats>div{display:flex;align-items:center;gap:9px;background:#f6f7fc;border:1px solid #e9ebf4;border-radius:12px;padding:11px 12px}
        .bb-d-ic{flex:none;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#eef0ff;color:#5b6bff}
        .bb-d-stats label{display:block;color:#9296ba;font-size:11px;font-weight:600}
        .bb-d-stats strong{color:#15163a;font-size:14px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif)}
        .bb-d-tags{display:flex;flex-wrap:wrap;gap:7px}
        .bb-d-tags span{font-size:12px;font-weight:700;padding:4px 11px;border-radius:20px;background:#eef0ff;color:#5b6bff;text-transform:capitalize}
        .bb-d-sec h4{margin:0 0 9px;font-size:13px;font-weight:800;color:#5b6bff;text-transform:uppercase;letter-spacing:.4px;display:flex;align-items:center;gap:6px}
        .bb-d-brief{display:flex;flex-direction:column;gap:7px}
        .bb-bl{margin:0;color:#585c7e;font-size:14px;line-height:1.6;overflow-wrap:anywhere}
        .bb-blab{color:#15163a;font-weight:700}
        .bb-d-chips{display:flex;flex-wrap:wrap;gap:7px}
        .bb-d-chips span{background:#f1f3fa;color:#585c7e;font-size:12.5px;font-weight:600;padding:5px 12px;border-radius:20px}
        .bb-d-rows{display:flex;flex-direction:column;gap:8px}
        .bb-d-row{display:grid;grid-template-columns:150px 1fr;gap:14px;font-size:14px;line-height:1.5}
        .bb-d-row-k{color:#9296ba;font-weight:600}
        .bb-d-row-v{color:#15163a;overflow-wrap:anywhere}
        @media (max-width:560px){.bb-d-row{grid-template-columns:120px 1fr;gap:10px}}
        .bb-d-foot{display:flex;gap:10px;padding:16px 22px;border-top:1px solid #e9ebf4}
        .bb-d-ghost,.bb-d-primary{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;border-radius:14px;font-family:inherit;font-weight:700;font-size:14.5px;cursor:pointer;border:1px solid transparent}
        .bb-d-ghost{background:#fff;border-color:#e9ebf4;color:#15163a}
        .bb-d-ghost:hover{border-color:#d3d7f0}
        .bb-d-primary{background:linear-gradient(100deg,#12124f,#07074e);color:#fff;box-shadow:0 12px 26px -12px rgba(7,7,78,.7)}
        .bb-d-primary:hover{transform:translateY(-1px)}
        @media (max-width:520px){.bb-d-stats{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
