import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Star, Check, Sparkles } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const getInitial = (name) => (name || 'U').trim().charAt(0).toUpperCase();

// Trending UGC reels (high-res portrait clips from /public) + their details.
// The right-side reel auto-plays in rotation and the left details cycle with it.
const FEATURED = [
  { reel: '/17811912-uhd_2160_3840_24fps.mp4', creator: '@rohan.creator', category: 'Fashion',   price: 'Rs. 2,000', delivery: '1 day',  rating: 4.9 },
  { reel: '/7690504-hd_1080_1920_30fps.mp4',    creator: '@priya.moves',   category: 'Fitness',   price: 'Rs. 1,800', delivery: '2 days', rating: 4.8 },
  { reel: '/6944288-uhd_2160_3840_24fps-sm.mp4', creator: '@arjun.fit',    category: 'Lifestyle', price: 'Rs. 2,200', delivery: '1 day',  rating: 5.0 },
];

const CAT_CLASS = (c) => ({
  fashion: 'c-fashion', fitness: 'c-fitness', beauty: 'c-beauty', tech: 'c-tech',
  food: 'c-food', lifestyle: 'c-lifestyle', travel: 'c-travel',
}[String(c || '').toLowerCase()] || 'c-default');

/**
 * Creator dashboard hero — a live "Trending UGC" showcase: the featured reel's
 * details (creator · category · price · delivery) on the left, the auto-playing
 * reel with floating chat / stat cards on the right. Both cycle together.
 */
const CLIP_SECONDS = 4; // only show a short 4s snippet of each reel before moving on

export default function CreatorHero({ name = 'Creator', photo, activeDeals = 0, newBriefs = 0, handle, category = 'UGC', price = 'On request', deliveryLabel = '1 day', rating = 4.9 }) {
  const navigate = useNavigate();
  const reelRef = useRef(null);
  const advancingRef = useRef(false);         // guard so one clip advances only once
  const [idx, setIdx] = useState(0);          // current featured reel
  const [progress, setProgress] = useState(0); // 0→1 fill of the active reel dot

  const nextReel = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setProgress(0);
    setIdx((i) => (i + 1) % FEATURED.length);
  };

  const goToReel = (i) => {
    advancingRef.current = false;
    setProgress(0);
    setIdx(i);
  };

  const f = FEATURED[idx];
  const firstName = String(name).replace(/^@/, '').split(' ')[0];
  const photoSrc = photo ? (photo.startsWith('http') ? photo : `${BACKEND_URL}${photo}`) : null;

  return (
    <section className="chero">
      {/* ── LEFT — featured UGC details (cycles with the reel) ── */}
      <div className="chero-left">
        <div className="chero-badge">
          <span className="chero-badge-ic"><Sparkles size={16} /></span>
          <div>
            <strong>Trending UGC</strong>
            <button type="button" onClick={() => navigate('/browse-briefs')}>Find work like this</button>
          </div>
        </div>

        <h1 key={`n-${idx}`} className="chero-title chero-fade">{f.creator}</h1>

        <div key={`m-${idx}`} className="chero-meta chero-fade" style={{ animationDelay: '.08s' }}>
          <span className={`chero-cat ${CAT_CLASS(f.category)}`}>{f.category}</span>
          <span className="chero-rate"><Star size={14} fill="#f5b301" color="#f5b301" /> {f.rating.toFixed(1)}</span>
        </div>

        <div className="chero-rule" />

        <div key={`f-${idx}`} className="chero-facts chero-fade" style={{ animationDelay: '.16s' }}>
          <div className="chero-fact"><label>Price</label><strong>{f.price}</strong></div>
          <div className="chero-fact"><label>Delivered in</label><strong>{f.delivery}</strong></div>
          <div className="chero-fact"><label>Category</label><strong>{f.category}</strong></div>
        </div>

        <p className="chero-sub">
          AI-matched brand deals and faster payouts — turn content like this into income, up to <b>50× faster.</b>
        </p>

        <div className="chero-cta">
          <button type="button" className="chero-btn-dark" onClick={() => navigate('/browse-briefs')}>
            Browse Campaigns — It’s Free
          </button>
          <button type="button" className="chero-link" onClick={() => navigate('/my-deals')}>
            My Deals <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {/* ── RIGHT — auto-playing reel + floating cards ── */}
      <div className="chero-stage">
        <div className="chero-photo">
          <div className="chero-photo-bg" />
          <video
            key={idx}
            ref={reelRef}
            src={`${f.reel}#t=0.1`}
            autoPlay
            muted
            playsInline
            preload="auto"
            onLoadedData={() => { advancingRef.current = false; setProgress(0); }}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              if (t >= CLIP_SECONDS) { nextReel(); return; }
              setProgress(t / CLIP_SECONDS);
            }}
            onEnded={nextReel}
          />
          <span className="chero-reel-dots">
            {FEATURED.map((_, i) => (
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

        <div className="chero-bubble chero-b1"><i className="chero-chk orange"><Check size={11} /></i> How is the fit?</div>
        <div className="chero-bubble chero-b2"><i className="chero-chk blue"><Check size={11} /></i> Do you like the design?</div>

        <div className="chero-stat">
          <small>UP TO</small>
          <strong>{activeDeals + newBriefs || 12}+</strong>
          <span>matches for you this week</span>
        </div>

        <div key={`d-${idx}`} className="chero-deal chero-fade" style={{ animationDelay: '.12s' }}>
          <span className="chero-deal-logo">{photoSrc ? <img src={photoSrc} alt="" /> : getInitial(f.creator.replace('@', ''))}</span>
          <div className="chero-deal-info">
            <strong>{f.creator}</strong>
            <small>{f.category} creator</small>
            <b className="chero-deal-amt">{f.price}</b>
            <span className="chero-deal-rate"><Star size={12} fill="#f5b301" color="#f5b301" /> {f.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <style>{`
        .chero{position:relative;display:grid;grid-template-columns:1.05fr 1fr;gap:32px;align-items:center;
          background:linear-gradient(135deg,#f3f3ff,#ececfa 60%,#f5eee9);border:1px solid #e9e7f6;border-radius:26px;
          padding:42px 44px;overflow:hidden;box-shadow:0 30px 60px -34px rgba(7,7,78,.35)}
        .chero::before{content:"";position:absolute;inset:0;pointer-events:none;
          background:radial-gradient(520px 280px at 86% -10%,rgba(7,7,78,.16),transparent 60%)}
        .chero-left{position:relative;z-index:1}

        .chero-badge{display:inline-flex;align-items:center;gap:11px;margin-bottom:18px}
        .chero-badge-ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex:none;background:#07074e;color:#fff}
        .chero-badge strong{display:block;font-size:14px;color:#07074e;font-weight:800}
        .chero-badge button{background:none;border:none;padding:0;cursor:pointer;font:inherit;color:#5b6bff;font-size:13px;font-weight:700;text-decoration:underline;text-underline-offset:2px}

        .chero-title{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:54px;line-height:1;
          font-weight:800!important;letter-spacing:-1.5px;color:#07074e;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .chero-meta{display:flex;align-items:center;gap:12px;margin-top:14px}
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

        /* ── right stage ── */
        .chero-stage{position:relative;z-index:1;min-height:430px}
        .chero-photo{position:relative;width:74%;margin:0 auto;aspect-ratio:3/4;border-radius:26px;overflow:hidden;box-shadow:0 36px 70px -28px rgba(20,20,50,.5)}
        .chero-photo-bg{position:absolute;inset:0;background:linear-gradient(160deg,#ff8a47,#ff6a3d 55%,#e85d35);z-index:0}
        .chero-photo video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1}
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
        .chero-chk.blue{background:#4a90ff}

        .chero-stat{position:absolute;top:6%;right:-2%;z-index:4;width:158px;padding:16px 18px;border-radius:18px;
          background:rgba(255,255,255,.72);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.7);
          box-shadow:0 18px 40px -16px rgba(20,20,50,.4);animation:cheroFloat 6s ease-in-out infinite;animation-delay:-1s}
        .chero-stat small{color:#9296ba;font-size:11px;font-weight:700;letter-spacing:.06em}
        .chero-stat strong{display:block;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:38px;font-weight:800;color:#07074e;line-height:1;margin:4px 0}
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
          .chero{grid-template-columns:1fr;gap:10px;padding:32px 26px}
          .chero-title{font-size:42px}
          .chero-stage{min-height:380px;margin-top:8px}
          .chero-b2{left:0}
        }
        @media (max-width:560px){
          .chero-title{font-size:34px}
          .chero-photo{width:88%}
          .chero-stat{right:0;width:140px}
          .chero-deal{right:0;width:210px}
          .chero-fact{padding:0 14px}
        }
        @media (prefers-reduced-motion:reduce){.chero-bubble,.chero-stat,.chero-deal,.chero-fade{animation:none}}
      `}</style>
    </section>
  );
}
