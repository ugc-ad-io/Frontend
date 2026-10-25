import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Check, X as XIcon, ShieldCheck, Wallet as WalletIcon, Zap } from 'lucide-react';
import { openHelpDialog } from '../components/HoverSideRail';
import { createPortal } from 'react-dom';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import ChatPopup from '../components/ChatPopup';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { useAuth } from '../App';
import { useLiveEffect } from '../lib/liveUpdates';
import { brandName } from '../utils/displayName';
import { campaignStage, campaignPill, campaignCta, budgetText } from '../utils/campaignStage';
import { ReelCard } from './BrandCreators';
import '../styles/brand-ui.css';
import '../styles/brand-ui-home.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
const creatorList = (p) => (Array.isArray(p) ? p : (p?.creators || p?.items || p?.results || p?.data || []));
const IN_FLIGHT = ['active', 'in_progress', 'work_submitted', 'awaiting_brand_confirmation'];

// Brand home (design boards 01 / 02): what needs doing, live campaigns, upsells and creators.
export default function BrandHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const company = user?.profile?.business_name || user?.business_name || brandName(user);

  const [campaigns, setCampaigns] = useState(null);
  const [creators, setCreators] = useState(null);
  const [shipped, setShipped] = useState({}); // campaignId -> true once tracking exists
  const [chatWith, setChatWith] = useState(null);
  const [balance, setBalance] = useState(null); // wallet balance, drives the first-video checklist
  const [videoCard, setVideoCard] = useState(null);
  const [error, setError] = useState('');

  useLiveEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await axios.get(`${API}/campaigns`);
        const list = Array.isArray(r.data) ? r.data : (r.data?.campaigns || []);
        if (!live) return;
        setCampaigns(list);
        // A shipping campaign with a hired creator needs its tracking looked up to know the real stage.
        const ship = list.filter((c) => (c.requires_shipment || c.shipment_option === 'yes') && c.selected_creator && IN_FLIGHT.includes(c.status)).slice(0, 8);
        const found = await Promise.allSettled(ship.map((c) => axios.get(`${API}/shipment/${c.id}`)));
        if (!live) return;
        const map = {};
        found.forEach((res, i) => { if (res.status === 'fulfilled' && (res.value.data?.tracking_number || res.value.data?.status)) map[ship[i].id] = true; });
        setShipped(map);
      } catch (e) {
        if (live) { setCampaigns([]); setError('Could not load your campaigns.'); }
      }
    })();
    axios.get(`${API}/business/wallet`)
      .then((r) => { if (live) setBalance(Number(r.data?.available_balance || 0)); })
      .catch(() => {});
    (async () => {
      try {
        const r = await axios.get(`${API}/business/creator-directory`, { params: { discovery_only: true } });
        if (live) setCreators(creatorList(r.data));
      } catch (e) {
        if (live) setCreators([]);
      }
    })();
    return () => { live = false; };
  }, []);

  const loading = campaigns === null;
  const live = useMemo(() => (campaigns || []).filter((c) => IN_FLIGHT.includes(c.status)), [campaigns]);
  const completed = useMemo(() => (campaigns || []).find((c) => c.status === 'completed'), [campaigns]);
  const isNewBrand = !loading && (campaigns || []).length === 0;

  // First-video checklist for brands with no campaigns yet (board 02).
  const startSteps = useMemo(() => [
    { key: 'profile', title: 'Set up your brand profile', sub: 'Approved by the UGCad team', done: user?.approval_status === 'approved', cta: 'Open settings', run: () => navigate('/settings') },
    { key: 'campaign', title: 'Post your first campaign', sub: 'Tell creators your product, budget and the video you need. Takes 3 minutes.', done: (campaigns || []).length > 0, cta: 'Post campaign', run: () => navigate('/dashboard/business/post-brief') },
    { key: 'wallet', title: 'Add funds to your wallet', sub: '\u20b92,500 unlocks chat with creators. Held safely until you approve.', done: (balance || 0) > 0, cta: 'Add funds', run: () => navigate('/dashboard/business/wallet') },
    { key: 'approve', title: 'Pick a creator & approve your video', sub: 'Compare bids, chat, then release payment when you love the result.', done: Boolean(completed), cta: 'How it works', run: () => openHelpDialog() },
  ], [user?.approval_status, campaigns, balance, completed, navigate]);

  // "Needs your action": bids to compare, work to review, products to ship.
  const todos = useMemo(() => {
    const out = [];
    const withBids = live.filter((c) => c.status === 'active' && !c.selected_creator && (c.bids || []).length > 0);
    if (withBids.length) {
      const n = withBids.reduce((s, c) => s + c.bids.length, 0);
      out.push({ key: 'bids', badge: String(n), title: `${n} new bid${n === 1 ? '' : 's'} to compare`, sub: withBids.slice(0, 2).map((c) => c.title || c.product_name).join(' · '), cta: 'Compare bids', to: '/dashboard/business/pending-bids', solid: true });
    }
    live.filter((c) => c.status === 'work_submitted' || c.status === 'awaiting_brand_confirmation').slice(0, 2).forEach((c) => {
      out.push({ key: `rev-${c.id}`, title: 'Delivery ready to review', sub: c.title || c.product_name, cta: 'Review', to: '/dashboard/business/work-review', solid: true });
    });
    live.filter((c) => (c.requires_shipment || c.shipment_option === 'yes') && c.selected_creator && c.status !== 'work_submitted' && !shipped[c.id]).slice(0, 2).forEach((c) => {
      out.push({ key: `ship-${c.id}`, title: 'Ship product to start filming', sub: c.title || c.product_name, cta: 'Add tracking', to: '/dashboard/business/shipments', solid: false });
    });
    return out;
  }, [live, shipped]);

  const choice = useMemo(() => (creators || []).filter((c) => c.ugcad_approved).slice(0, 4), [creators]);
  const mixed = useMemo(() => {
    const ids = new Set(choice.map((c) => c.id));
    return (creators || []).filter((c) => !ids.has(c.id)).slice(0, 5);
  }, [creators, choice]);
  const openChat = (c) => setChatWith({ id: c.id, name: String(c.nickname || c.name || 'Creator').replace('@', ''), photo: c.profile_photo });

  return (
    <BrandTopNavLayout>
      <div className="bui-main">
        <section className="bui-hero">
          <span className="bui-hero-glow" aria-hidden="true" />
          <div className="bui-hero-copy">
            <h1>{isNewBrand ? `Welcome to UGCad, ${company}` : `Welcome back, ${company}`}</h1>
            <p>
              {isNewBrand
                ? 'Your first UGC video is 4 steps away. Post a brief, vetted creators bid within hours, and you only pay when you approve the video.'
                : `Tell creators what you need and get bids within hours.${creators ? ` ${creators.length.toLocaleString('en-IN')} vetted creators are taking briefs this week.` : ''}`}
            </p>
          </div>
          <div className="bui-hero-cta">
            <Link className="bui-btn bui-btn--light" to="/dashboard/business/post-brief">{isNewBrand ? 'Post your first campaign' : 'Post a campaign'}</Link>
            <Link className="bui-btn bui-btn--outline" to="/dashboard/business/browse-creator">Browse creators</Link>
          </div>
        </section>

        {error && <EmptyState title="Something went wrong" message={error} />}

        {isNewBrand && (
          <>
            <div className="bui-two">
              <section className="bui-card bui-card--pad bui-start" aria-labelledby="start">
                <div className="bui-start-h">
                  <h2 id="start" className="bui-start-t">Get your first video</h2>
                  <span><strong>{startSteps.filter((x) => x.done).length} of {startSteps.length}</strong> done</span>
                </div>
                <div className="bui-start-bar" aria-hidden="true">
                  {startSteps.map((x, i) => <span key={i} className={x.done ? 'on' : ''} />)}
                </div>
                <ol className="bui-start-list">
                  {startSteps.map((x, i) => {
                    const current = !x.done && startSteps.findIndex((y) => !y.done) === i;
                    return (
                      <li key={x.key}>
                        <span className={`bui-dot-s${x.done ? ' is-done' : current ? ' is-now' : ''}`}>{x.done ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                        <div className="bui-start-tx">
                          <b className={x.done ? 'is-done' : ''}>{x.title}</b>
                          <small>{x.sub}</small>
                        </div>
                        {x.done ? <span className="bui-start-done">Done</span> : (
                          <button type="button" className={`bui-btn bui-btn--sm${current ? '' : ' bui-btn--ghost'}`} onClick={x.run}>{x.cta}</button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className="bui-card bui-card--pad bui-help" aria-labelledby="help">
                <div>
                  <h2 id="help" className="bui-start-t">Not sure where to start?</h2>
                  <p className="bui-muted-p bui-help-p">Our team will write your first brief with you and shortlist creators for your product. Free for new brands.</p>
                </div>
                <ul className="bui-help-list">
                  <li><Check size={16} /> 15-minute call, no commitment</li>
                  <li><Check size={16} /> Brief written for you</li>
                  <li><Check size={16} /> Creators picked for your niche</li>
                </ul>
                <button type="button" className="bui-btn bui-btn--ghost bui-btn--tall bui-btn--block" onClick={() => openHelpDialog()}>Talk to our team</button>
              </section>
            </div>

            <div className="bui-trust">
              <div><ShieldCheck size={20} /><span><b>Every creator is vetted</b><small>Each creator is checked by the UGCad team before they can take briefs.</small></span></div>
              <div><WalletIcon size={20} /><span><b>Your money is safe</b><small>Payment stays in escrow until you approve the final video.</small></span></div>
              <div><Zap size={20} /><span><b>Videos in days, not weeks</b><small>Most creators deliver within a few days of being hired.</small></span></div>
            </div>
          </>
        )}

        {!isNewBrand && (
          <div className="bui-two">
            <section className="bui-needs" aria-labelledby="needs">
              <div className="bui-card bui-card--pad">
                <h2 id="needs" className="bui-card-h">Needs your action</h2>
                {loading ? (
                  <div className="bui-row"><Skeleton width="100%" height={36} /></div>
                ) : todos.length === 0 ? (
                  <p className="bui-muted-p">You&rsquo;re all caught up. Nothing is waiting on you.</p>
                ) : todos.map((t) => (
                  <Link key={t.key} to={t.to} className="bui-row">
                    <span className="bui-row-ic">{t.badge || <Check size={16} />}</span>
                    <span className="bui-row-tx"><b>{t.title}</b><small>{t.sub}</small></span>
                    <span className={`bui-pillbtn${t.solid ? '' : ' bui-pillbtn--ghost'}`}>{t.cta}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="bui-active" aria-labelledby="active">
              <div className="bui-sec-head">
                <h2 id="active" className="bui-h2">Active campaigns</h2>
                <Link className="bui-link bui-link--lg" to="/dashboard/business/all-campaigns">View all ({(campaigns || []).length})</Link>
              </div>
              <div className="bui-stack">
                {loading ? <Skeleton width="100%" height={112} radius={12} /> : live.length === 0 ? (
                  <div className="bui-card bui-card--pad bui-muted-p">No live campaigns right now. <Link className="bui-link" to="/dashboard/business/post-brief">Post one</Link></div>
                ) : live.slice(0, 3).map((c) => {
                  const st = campaignStage(c, shipped[c.id]);
                  const pill = campaignPill(c, shipped[c.id]);
                  const cta = campaignCta(c, shipped[c.id]);
                  const thumb = c.product_image || (c.product_images || [])[0] || c.cover_image || c.image_url || c.brand_logo_url || c.brand_logo;
                  return (
                    <article key={c.id} className="bui-order">
                      <div className="bui-order-main">
                        <span className="bui-thumb">{thumb ? <img src={assetUrl(thumb)} alt="" /> : null}</span>
                        <div className="bui-order-tx">
                          <span className={`bui-status bui-status--${pill.tone}`}>{pill.text}</span>
                          <b>{c.title || c.product_name}</b>
                          <small>{[c.product_category, budgetText(c)].filter(Boolean).join(' · ')}</small>
                        </div>
                      </div>
                      <div className="bui-order-prog">
                        <div className="bui-bar5">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < Math.min(st.step, 5) ? 'on' : ''} />)}</div>
                        <small>{`Step ${Math.min(st.step, 5)} of 5 · ${st.label}`}</small>
                      </div>
                      <button type="button" className="bui-btn bui-btn--sm" onClick={() => navigate(cta.to)}>{cta.label}</button>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {completed && (
          <div className="bui-upsell">
            <section className="bui-promo">
              <span className="bui-hero-glow bui-hero-glow--sm" aria-hidden="true" />
              <div className="bui-promo-tx">
                <div className="bui-eyebrow">{`${completed.title || completed.product_name} is complete 🎉`}</div>
                <div className="bui-promo-h">Pay less on every video</div>
                <div className="bui-promo-list">
                  <span><Check size={14} /> 15% fee instead of 20%</span>
                  <span><Check size={14} /> A UGC expert at every step</span>
                  <span><Check size={14} /> 1 edited video every month</span>
                </div>
              </div>
              <div className="bui-promo-cta">
                <Link className="bui-btn bui-btn--light bui-btn--tall" to="/dashboard/business/plans">See plans</Link>
                <span>Growth from &#8377;4,999 / month</span>
              </div>
            </section>
            <section className="bui-card bui-edit">
              <div className="bui-edit-tx">
                <div className="bui-edit-h">Make raw videos ad-ready</div>
                <p>Expert editing by UGCad.io &mdash; hooks, captions, music, 3 sizes. &#8377;1,500 / video, back in 48h.</p>
                <Link className="bui-btn bui-btn--sm bui-btn--mt" to="/dashboard/business/edit-addon">Add editing</Link>
              </div>
            </section>
          </div>
        )}

        {(creators === null || choice.length > 0) && (
          <section className="bui-choice" aria-labelledby="choice">
            <div className="bui-reel-grid">
              <div className="bui-choice-intro">
                <span className="bui-hero-glow bui-hero-glow--intro" aria-hidden="true" />
                <span className="bui-choice-mark" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} aria-hidden="true" />
                <h2 id="choice">UGCAD.IO Choice</h2>
                <p>Hand-picked by our team for your next campaign.</p>
                <ul><li>&#10003; Top 5% of creators</li><li>&#10003; Vetted by the UGCad team</li><li>&#10003; Proven delivery record</li></ul>
                <Link className="bui-btn bui-btn--light bui-btn--sm bui-choice-link" to="/dashboard/business/browse-creator?collection=ugcad-approved">See all Choice &rarr;</Link>
              </div>
              {creators === null
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width="100%" height={420} radius={18} />)
                : choice.map((c) => <ReelCard key={c.id} c={c} onView={(x) => navigate(`/dashboard/business/creator/${x.id}`)} onMessage={openChat} onExpand={setVideoCard} />)}
            </div>
          </section>
        )}

        <section aria-labelledby="all">
          <div className="bui-sec-head bui-sec-head--end">
            <div>
              <h2 id="all" className="bui-h2">All creators</h2>
              <p className="bui-sub bui-sub--sm">Every level, including UGCAD.IO Choice</p>
            </div>
            <Link className="bui-link bui-link--lg" to="/dashboard/business/browse-creator">See all</Link>
          </div>
          <div className="bui-reel-grid">
            {creators === null
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} width="100%" height={420} radius={18} />)
              : mixed.map((c) => <ReelCard key={c.id} c={c} onView={(x) => navigate(`/dashboard/business/creator/${x.id}`)} onMessage={openChat} onExpand={setVideoCard} />)}
          </div>
        </section>
      </div>

      {videoCard && createPortal(
        <div className="bc-vid-overlay" onClick={() => setVideoCard(null)}>
          <div className="bc-vid-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="bc-vid-close" aria-label="Close" onClick={() => setVideoCard(null)}><XIcon size={20} /></button>
            <video src={videoCard.src} controls autoPlay playsInline className="bc-vid-el" />
            {videoCard.name && <div className="bc-vid-name">{videoCard.name}</div>}
          </div>
        </div>,
        document.body,
      )}
      {chatWith && <ChatPopup user={chatWith} onClose={() => setChatWith(null)} />}
    </BrandTopNavLayout>
  );
}
