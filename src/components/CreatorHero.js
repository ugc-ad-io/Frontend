import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowUpRight, Star, Check, Sparkles } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const getInitial = (name) => (name || 'U').trim().charAt(0).toUpperCase();

// Default showcase reels — used until (and unless) an admin curates the list via
// Admin → Home Showcase. Admin entries replace these at runtime.
// "-sm" (compressed, ~250-950KB) variants only — this hero autoplays 1-2 of these at
// once and re-fetches a fresh one every CLIP_SECONDS, so the raw uncompressed "-uhd"
// originals (1.8-5.6MB each) here made the dashboard refetch/decode several MB of
// video every 4s, which was the dashboard's main source of lag.
const DEFAULT_REELS = [
  { src: '/17811912-uhd_2160_3840_24fps-sm.mp4', name: '@priya.moves',   category: 'Fashion',   earned: 420000, deals: 128, rating: 4.9, level: 'Elite' },
  { src: '/7690504-hd_1080_1920_30fps-sm.mp4',    name: '@rohan.creator', category: 'Fitness',   earned: 360000, deals: 112, rating: 4.8, level: 'L2' },
  { src: '/6944288-uhd_2160_3840_24fps-sm.mp4', name: '@arjun.fit',    category: 'Lifestyle', earned: 310000, deals: 98,  rating: 5.0, level: 'L2' },
];

// Rs. 21,900 for smaller amounts, Rs. 4.2L once we cross a lakh.
const fmtMoney = (n) => {
  const v = Number(n) || 0;
  if (v >= 100000) return `Rs. ${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`;
  return `Rs. ${v.toLocaleString('en-IN')}`;
};

const CAT_CLASS = (c) => ({
  fashion: 'c-fashion', fitness: 'c-fitness', beauty: 'c-beauty', tech: 'c-tech',
  food: 'c-food', lifestyle: 'c-lifestyle', travel: 'c-travel',
}[String(c || '').toLowerCase()] || 'c-default');

/**
 * Creator dashboard hero — a personalised header for the signed-in creator:
 * their name, category, rating and earnings on the left, with an auto-playing
 * showcase reel and floating cards (earnings + active deal) on the right.
 */
const CLIP_SECONDS = 4; // only show a short 4s snippet of each reel before moving on

export default function CreatorHero({
  name = 'Creator', photo, category = '', rating = 0,
  totalEarned = 0, nextPayout = 0, completedDeals = 0, level,
  activeDeals = 0, newBriefs = 0, activeDeal = null, profilePct = null,
}) {
  const navigate = useNavigate();
  // Admin-curated showcase (falls back to DEFAULT_REELS). Maps the stored shape
  // (video_url) onto the reel shape (src) the player expects.
  // Start EMPTY (a neutral placeholder), not with the hardcoded defaults — that's
  // what made the dummy reel flash for ~1s before the admin data loaded. Fill it
  // once the fetch resolves: admin's cards if any, else the defaults.
  const [reels, setReels] = useState([]);
  useEffect(() => {
    let alive = true;
    axios.get(`${API}/home/top-earners`)
      .then((r) => {
        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        // Resolve a relative backend path (e.g. "/uploads/x.mp4") to an absolute
        // URL so the reel actually loads instead of showing the orange fallback.
        const resolveSrc = (u) => {
          const s = String(u || '').trim();
          if (!s) return '';
          return /^https?:\/\//i.test(s) ? s : `${BACKEND_URL}${s.startsWith('/') ? '' : '/'}${s}`;
        };
        const mapped = items
          .filter((it) => it && it.name)
          .map((it) => ({
            src: resolveSrc(it.video_url || it.src),
            // First name only on the showcase card (e.g. "Deshna Shrimal" → "Deshna").
            name: String(it.name).replace(/^@+/, '').trim().split(/\s+/)[0] || it.name,
            category: it.category || '',
            earned: Number(it.earned) || 0,
            deals: Number(it.deals) || 0,
            rating: Number(it.rating) || 0,
            level: it.level || '',
          }));
        if (alive) setReels(mapped.length ? mapped : DEFAULT_REELS);
      })
      .catch(() => { if (alive) setReels(DEFAULT_REELS); });
    return () => { alive = false; };
  }, []);
  // Reel carousel driven by a FIXED TIMER, not video events. The old dual-layer
  // crossfade advanced only when the next clip fired onLoadedData / the current one
  // fired onEnded — so a short looping clip, a slow load, or a dead Cloudinary URL
  // froze it on one reel. Here each reel loops in its CLIP_SECONDS slot, a timer
  // advances, and the incoming reel fades in over the outgoing one (kept underneath
  // until the fade ends) so the background never flashes.
  const [cur, setCur] = useState(0);           // reel currently shown
  const [prev, setPrev] = useState(null);      // outgoing reel, held under the new one during the fade
  const [progress, setProgress] = useState(0); // 0→1 fill of the active reel dot
  const curRef = useRef(0);
  useEffect(() => { curRef.current = cur; }, [cur]);
  const deadSkipRef = useRef(0);               // consecutive reels that failed to load
  const idx = cur;                             // alias used by the dots + top-creator card

  const advance = () => {
    if (reels.length <= 1) return;
    setPrev(curRef.current);
    setCur((curRef.current + 1) % reels.length);
  };

  const goToReel = (i) => {
    if (i !== curRef.current) { setPrev(curRef.current); setCur(i); }
  };

  // Advance every CLIP_SECONDS. Recreated only when the reel count changes; reads the
  // live index from a ref so it never advances from a stale one.
  useEffect(() => {
    if (reels.length <= 1) return undefined;
    const t = setInterval(() => {
      setPrev(curRef.current);
      setCur((curRef.current + 1) % reels.length);
    }, CLIP_SECONDS * 1000);
    return () => clearInterval(t);
  }, [reels.length]);

  // Drop the outgoing reel once the fade is done (independent of any video event).
  useEffect(() => {
    if (prev == null) return undefined;
    const t = setTimeout(() => setPrev(null), 550);
    return () => clearTimeout(t);
  }, [prev]);

  // Time-based progress bar — fills smoothly even if the current clip failed to load.
  useEffect(() => {
    setProgress(0);
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const started = now();
    const t = setInterval(() => setProgress(Math.min(1, (now() - started) / (CLIP_SECONDS * 1000))), 100);
    return () => clearInterval(t);
  }, [cur, reels.length]);

  const tc = reels[idx] || reels[0] || null; // the top creator whose reel is currently playing (null until loaded)
  const photoSrc = photo ? (photo.startsWith('http') ? photo : `${BACKEND_URL}${photo}`) : null;
  const dealLogo = activeDeal?.logo
    ? (activeDeal.logo.startsWith('http') ? activeDeal.logo : `${BACKEND_URL}${activeDeal.logo}`)
    : null;

  return (
    <section className="chero">
      {/* ── LEFT — the signed-in creator's own details ── */}
      <div className="chero-left">
        <div className="chero-badge">
          <span className="chero-badge-ic"><Sparkles size={16} /></span>
          <div>
            <strong>Creator Studio</strong>
            <button type="button" onClick={() => navigate('/browse-briefs')}>Find new work</button>
          </div>
        </div>

        <h1 className="chero-title chero-fade"><span className="chero-hi">Hi!</span> {String(name || 'Creator').replace(/^@/, '').trim().split(/\s+/)[0]}</h1>

        <div className="chero-meta chero-fade" style={{ animationDelay: '.08s' }}>
          {level && <span className="chero-rank">{level}</span>}
          {category && <span className={`chero-cat ${CAT_CLASS(category)}`}>{category}</span>}
          {rating > 0 && (
            <span className="chero-rate"><Star size={14} fill="#f5b301" color="#f5b301" /> {rating.toFixed(1)}</span>
          )}
        </div>

        <div className="chero-rule" />

        <div className="chero-facts chero-fade" style={{ animationDelay: '.16s' }}>
          <div className="chero-fact"><label>Total earned</label><strong>{fmtMoney(totalEarned)}</strong></div>
          <div className="chero-fact"><label>Deals closed</label><strong>{completedDeals}</strong></div>
          {category && <div className="chero-fact"><label>Category</label><strong style={{ textTransform: 'capitalize' }}>{category}</strong></div>}
        </div>

        <p className="chero-sub">
          Your AI-matched brand deals and payouts, all in one place — keep creating to earn <b>up to 50× faster.</b>
        </p>

        <div className="chero-cta">
          <button type="button" className="chero-btn-dark" onClick={() => navigate('/browse-briefs')}>
            Browse Campaigns — It’s Free
          </button>
          <button type="button" className="chero-link" onClick={() => navigate('/my-active-work')}>
            My Deals <ArrowUpRight size={16} />
          </button>
        </div>

        {profilePct != null && profilePct < 100 && (
          <button type="button" className="chero-progress" onClick={() => navigate('/settings')}>
            <span className="chero-progress-top">
              <span>Profile {profilePct}% complete</span>
              <span className="chero-progress-cta">Finish it <ArrowUpRight size={13} /></span>
            </span>
            <span className="chero-progress-track"><span className="chero-progress-fill" style={{ width: `${profilePct}%` }} /></span>
          </button>
        )}
      </div>

      {/* ── RIGHT — auto-playing reel + the creator's floating cards ── */}
      <div className="chero-stage">
        <div className="chero-photo">
          <div className="chero-photo-bg" />
          {/* Timer-driven crossfade: the outgoing reel sits underneath while the new
              one fades in on top, so the background never flashes. Each reel LOOPS in
              its slot — the timer, not the video, decides when to advance. */}
          {reels.length > 0 && (() => {
            const top = reels[cur];
            const under = prev != null ? reels[prev] : null;
            return (
              <>
                {under && under.src && (
                  <video
                    key={`under-${prev}-${under.src}`}
                    className="chero-reel is-under"
                    src={under.src}
                    autoPlay muted loop playsInline preload="auto"
                  />
                )}
                {top && top.src && (
                  <video
                    // Keyed on the reel so the element remounts (and restarts) each change.
                    key={`top-${cur}-${top.src}`}
                    className="chero-reel is-top"
                    src={top.src}
                    autoPlay muted loop playsInline preload="auto"
                    // A dead/missing video (e.g. an old file wiped from Render's ephemeral
                    // disk) can't play — skip past it instead of showing a blank for the
                    // whole slot. Stop skipping once we've tried every reel (all dead).
                    onError={() => { if (deadSkipRef.current < reels.length) { deadSkipRef.current += 1; advance(); } }}
                    onPlaying={() => { deadSkipRef.current = 0; }}
                  />
                )}
              </>
            );
          })()}
          <span className="chero-reel-dots">
            {reels.map((_, i) => (
              <i
                key={i}
                className={i === idx ? 'on' : (i < idx ? 'done' : '')}
                onClick={() => goToReel(i)}
                role="button"
                aria-label={`Reel ${i + 1}`}
              >
                {i === idx && <b style={{ transform: `scaleX(${progress})` }} />}
              </i>
            ))}
          </span>
        </div>

        {tc && (
          /* On phones this wrapper stops being a passthrough and becomes the white
             sheet under the clip - see the max-width:560px block below. */
          <div className="chero-cards">
            <div className="chero-bubble chero-b1">
              <span className="chero-stars" style={{ display: 'inline-flex', gap: 1 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={12} fill={n <= Math.round(tc.rating) ? '#f5b301' : 'none'} color="#f5b301" />
                ))}
              </span>
              {Number(tc.rating || 0).toFixed(1)} rating
            </div>
            <div className="chero-bubble chero-b2"><i className="chero-chk blue"><Check size={11} /></i> {tc.deals} deals done</div>

            <div className="chero-stat chero-fade" style={{ animationDelay: '.1s' }}>
              <small>TOP EARNER</small>
              <strong>{fmtMoney(tc.earned)}</strong>
              <span>on UGCad</span>
            </div>

            <div className="chero-deal chero-fade" style={{ animationDelay: '.12s' }}>
              <span className="chero-deal-logo">{getInitial(String(tc.name || '').replace('@', ''))}</span>
              <div className="chero-deal-info">
                <strong>{tc.name}</strong>
                <small>{tc.category} creator</small>
                <b className="chero-deal-amt">{tc.level} level</b>
                <span className="chero-deal-rate"><Star size={12} fill="#f5b301" color="#f5b301" /> {Number(tc.rating || 0).toFixed(1)} · {tc.deals} deals</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .chero{position:relative;display:grid;grid-template-columns:1.05fr 1fr;gap:32px;align-items:center;
          background:linear-gradient(135deg,#f3f3ff,#ececfa 60%,#f5eee9);border:1px solid #e9e7f6;border-radius:26px;
          padding:42px 44px;transform:translate(40px,22px);overflow:hidden}
        .chero::before{content:"";position:absolute;inset:0;pointer-events:none;
          background:radial-gradient(520px 280px at 86% -10%,rgba(7,7,78,.16),transparent 60%)}
        .chero-left{position:relative;z-index:1}

        .chero-badge{display:inline-flex;align-items:center;gap:11px;margin-bottom:18px}
        .chero-badge-ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex:none;background:#07074e;color:#fff}
        .chero-badge strong{display:block;font-size:14px;color:#07074e;font-weight:800}
        .chero-badge button{background:none;border:none;padding:0;cursor:pointer;font:inherit;color:#5b6bff;font-size:13px;font-weight:700;text-decoration:underline;text-underline-offset:2px}

        .chero-title{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:44px;line-height:1;
          font-weight:800!important;letter-spacing:-1.5px;color:#07074e;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .chero-hi{color:#5b6bff}
        .chero-wave{-webkit-text-fill-color:initial}
        .chero-meta{display:flex;align-items:center;gap:12px;margin-top:14px}
        .chero-rank{display:inline-flex;align-items:center;padding:4px 13px;border-radius:30px;font-size:13px;font-weight:800;
          background:linear-gradient(100deg,#12124f,#07074e);color:#fff;box-shadow:0 8px 18px -8px rgba(7,7,78,.6);text-transform:capitalize}
        .chero-cat{display:inline-block;padding:4px 14px;border-radius:30px;font-size:13px;font-weight:700;text-transform:capitalize}
        .chero-rate{display:inline-flex;align-items:center;gap:5px;font-weight:800;color:#07074e;font-size:15px}
        .chero-rule{height:1px;background:#d8d6ee;margin:22px 0 18px;max-width:440px}

        .chero-facts{display:flex;align-items:center;gap:0}
        .chero-fact{display:flex;flex-direction:column-reverse;padding:0 24px}
        .chero-fact:first-child{padding-left:0}
        .chero-fact + .chero-fact{border-left:1px solid #dcdaef}
        .chero-fact strong{color:#07074e;font-size:19px;font-weight:800;white-space:nowrap}
        .chero-fact label{color:#9296ba;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}

        .chero-sub{color:#4b4f7e;font-size:15.5px;line-height:1.6;max-width:440px;margin:20px 0 0}
        .chero-sub b{color:#07074e;font-weight:800}

        .chero-cta{display:flex;align-items:center;gap:22px;margin-top:26px;flex-wrap:wrap}
        .chero-btn-dark{display:inline-flex;align-items:center;gap:8px;height:54px;padding:0 28px;border:none;border-radius:30px;
          background:#0c0c2e;color:#fff;font:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:.18s;box-shadow:0 16px 30px -14px rgba(12,12,46,.8)}
        .chero-btn-dark:hover{transform:translateY(-2px)}
        .chero-link{display:inline-flex;align-items:center;gap:5px;background:none;border:none;cursor:pointer;font:inherit;font-size:15px;font-weight:700;color:#07074e;text-decoration:underline;text-underline-offset:3px}

        .chero-progress{display:flex;flex-direction:column;gap:7px;width:100%;max-width:360px;margin-top:20px;
          padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.6);border:1px solid #e9e7f6;
          cursor:pointer;font:inherit;text-align:left;transition:.18s}
        .chero-progress:hover{background:#fff;border-color:#c9c6ee}
        .chero-progress-top{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13.5px;font-weight:700;color:#07074e}
        .chero-progress-cta{display:inline-flex;align-items:center;gap:3px;color:#5b6bff}
        .chero-progress-track{height:6px;border-radius:99px;background:#e2e0f5;overflow:hidden}
        .chero-progress-fill{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#5b6bff,#07074e);transition:width .3s ease}

        /* ── right stage ── */
        .chero-stage{position:relative;z-index:1;min-height:430px}
        .chero-photo{position:relative;width:74%;margin:0 auto;aspect-ratio:3/4;border-radius:26px;overflow:hidden;box-shadow:0 36px 70px -28px rgba(20,20,50,.5)}
        .chero-photo-bg{position:absolute;inset:0;background:linear-gradient(160deg,#20223f,#14152b 55%,#0d0e1f);z-index:0}
        .chero-reel{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:1}
        .chero-reel.is-under{z-index:1}
        .chero-reel.is-top{z-index:2;animation:cheroReelIn .5s ease}
        @keyframes cheroReelIn{from{opacity:0}to{opacity:1}}
        .chero-reel-dots{position:absolute;top:14px;left:0;right:0;z-index:3;display:flex;justify-content:center;gap:6px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.45))}
        .chero-reel-dots i{position:relative;overflow:hidden;width:18px;height:4px;border-radius:3px;background:rgba(255,255,255,.55);cursor:pointer;transition:width .35s ease}
        .chero-reel-dots i.done{background:#fff}
        .chero-reel-dots i.on{width:30px}
        .chero-reel-dots i b{position:absolute;left:0;top:0;bottom:0;right:0;background:#fff;border-radius:3px;transform-origin:left;transform:scaleX(0);transition:transform .12s linear}

        .chero-bubble{position:absolute;z-index:4;display:inline-flex;align-items:center;gap:9px;background:#fff;padding:11px 16px;border-radius:30px;
          font-size:14px;font-weight:700;color:#07074e;white-space:nowrap;box-shadow:0 14px 30px -12px rgba(20,20,50,.4);animation:cheroFloat 5s ease-in-out infinite}
        .chero-b1{top:20%;left:2%}
        .chero-b2{top:33%;left:-4%;animation-delay:-2.5s}
        .chero-chk{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;color:#fff;flex:none}
        .chero-chk.orange{background:#ff7a3d}
        .chero-chk.green{background:#15a35b}
        .chero-chk.blue{background:#4a90ff}

        .chero-stat{position:absolute;top:6%;right:-2%;z-index:4;width:auto;min-width:158px;max-width:220px;padding:16px 18px;border-radius:18px;
          background:rgba(255,255,255,.72);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.7);
          box-shadow:0 18px 40px -16px rgba(20,20,50,.4);animation:cheroFloat 6s ease-in-out infinite;animation-delay:-1s}
        .chero-stat small{color:#9296ba;font-size:11px;font-weight:700;letter-spacing:.06em}
        .chero-stat strong{display:block;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:32px;font-weight:800;color:#07074e;line-height:1;margin:4px 0;white-space:nowrap}
        .chero-stat span{color:#585c7e;font-size:12.5px;font-weight:600}

        .chero-deal{position:absolute;bottom:4%;right:-3%;z-index:4;display:flex;align-items:center;gap:13px;width:240px;padding:14px;border-radius:18px;
          background:rgba(255,255,255,.82);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.7);box-shadow:0 22px 44px -18px rgba(20,20,50,.45);
          animation:cheroFloat 5.5s ease-in-out infinite;animation-delay:-3s}
        .chero-deal-logo{width:54px;height:54px;border-radius:12px;flex:none;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#07074e,#23236a);color:#fff;font-weight:800;font-size:20px}
        .chero-deal-logo img{width:100%;height:100%;object-fit:cover}
        .chero-deal-info{min-width:0}
        .chero-deal-info strong{display:block;font-size:14px;color:#07074e;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .chero-deal-info small{display:block;color:#9296ba;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:capitalize}
        .chero-deal-amt{display:inline-block;margin-top:3px;color:#07074e;font-size:17px;font-weight:800}
        .chero-deal-rate{display:inline-flex;align-items:center;gap:4px;margin-left:8px;color:#585c7e;font-size:12.5px;font-weight:700}

        .chero-fade{animation:cheroIn .7s cubic-bezier(.22,.61,.36,1) both}
        @keyframes cheroIn{from{opacity:0;transform:translateY(14px);filter:blur(7px)}to{opacity:1;transform:none;filter:blur(0)}}
        @keyframes cheroFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}

        @media (max-width:980px){
          /* Reset the desktop offset transform — it pushed the card off-screen and
             caused horizontal scroll on phones. */
          .chero{grid-template-columns:1fr;gap:14px;padding:28px 22px;transform:none}
          .chero-title{font-size:34px}
          .chero-stage{min-height:360px;margin-top:8px}
          .chero-b2{left:0}
        }
        @media (max-width:560px){
          .chero{padding:22px 16px;border-radius:20px}
          .chero-title{font-size:26px;letter-spacing:-1px}
          .chero-badge{margin-bottom:14px}
          .chero-rule{margin:16px 0 14px}
          .chero-photo{width:100%}
          .chero-stage{min-height:0}

          /* PHONES: nothing sits ON the clip. Wherever the four cards are pinned, a
             portrait video on a 360px screen leaves no clear space - they always land
             on the creator's face or the product. So the wrapper stops being a
             passthrough and becomes a white sheet tucked under the video (rounded top
             corners, pulled up 18px so it reads as one unit), and the four cards flow
             into it as ordinary content. */
          .chero-cards{position:relative;z-index:4;margin:-18px 0 0;padding:15px 16px 14px;
            background:#fff;border-radius:24px 24px 18px 18px;box-shadow:0 18px 40px -22px rgba(20,20,50,.45);
            display:grid;grid-template-columns:1fr auto;gap:11px 10px;align-items:center;
            grid-template-areas:"deal deal" "stat b1" "stat b2"}
          /* Un-float the four: static flow, no glass, no shadow, no bobbing. Only DIRECT
             children are reset, so .chero-deal-logo keeps its gradient. Specific rules
             below re-add what each one still needs - they must stay AFTER this. */
          .chero-cards > *{position:static;inset:auto;width:auto;max-width:none;min-width:0;
            animation:none;background:none;border:none;box-shadow:none;backdrop-filter:none}

          .chero-deal{grid-area:deal;gap:12px;padding:0 0 12px;border-bottom:1px solid #eeecf9}
          .chero-deal-logo{width:44px;height:44px;font-size:16px}
          .chero-stat{grid-area:stat;padding:0}
          .chero-stat strong{font-size:27px;margin:2px 0 1px}
          /* Chips keep a tint so they still read as chips on the white sheet. */
          .chero-bubble{justify-self:end;padding:7px 12px;font-size:12.5px;gap:7px;background:#f4f5fc;border-radius:20px}
          .chero-b1{grid-area:b1}
          .chero-b2{grid-area:b2}

          .chero-facts{flex-wrap:wrap;gap:8px 0}
          .chero-fact{padding:0 14px}
          .chero-fact:first-child{padding-left:0}
        }
        @media (max-width:380px){
          .chero-title{font-size:22px}
          .chero-cards{padding:13px 13px 12px;gap:9px 8px}
          .chero-deal{gap:10px}
          .chero-deal-logo{width:38px;height:38px;font-size:15px}
          .chero-stat strong{font-size:23px}
          .chero-bubble{padding:6px 10px;font-size:12px}
        }
        @media (prefers-reduced-motion:reduce){.chero-bubble,.chero-stat,.chero-deal,.chero-fade{animation:none}}
      `}</style>
    </section>
  );
}
