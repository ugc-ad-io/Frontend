import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Check, Truck, ClipboardCheck, Users, AlertCircle, WifiOff } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import withBrandGate from '../../brandkit/withBrandGate';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { brandName } from '../../../utils/displayName';
import { campaignStage, campaignPill, campaignCta, budgetText } from '../../../utils/campaignStage';
import ReelCard from '../../brandkit/ReelCard';
import VideoViewer from '../../brandkit/VideoViewer';
import WalletChip, { useWalletBalance } from '../../brandkit/WalletChip';
import { API, assetUrl, creatorListFrom, loadErrorText } from '../../brandkit/kit';
import './home.css';

const IN_FLIGHT = ['active', 'in_progress', 'work_submitted', 'awaiting_brand_confirmation'];
const PILL = { ok: 'ap-pill--ok', warn: 'ap-pill--warn', bad: 'ap-pill--bad', muted: 'ap-pill--muted', info: '' };
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'GOOD MORNING' : h < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
};

// Brand home (boards M0 Home + M1 new-brand checklist). Same data as src/pages/BrandHome.js.
function BrandAppHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const company = user?.profile?.business_name || user?.business_name || brandName(user);
  const balance = useWalletBalance();

  const [campaigns, setCampaigns] = useState(null);
  const [creators, setCreators] = useState(null);
  const [shipped, setShipped] = useState({});
  const [campErr, setCampErr] = useState('');
  const [dirErr, setDirErr] = useState('');
  const [reload, setReload] = useState(0);
  const [viewer, setViewer] = useState(null);
  const [slide, setSlide] = useState(0);
  const heroRef = useRef(null);

  useLiveEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await axios.get(`${API}/campaigns`);
        const list = Array.isArray(r.data) ? r.data : (r.data?.campaigns || []);
        if (!live) return;
        setCampaigns(list);
        setCampErr('');
        // A shipping campaign with a hired creator needs its tracking looked up to know the real stage.
        const ship = list.filter((c) => (c.requires_shipment || c.shipment_option === 'yes') && c.selected_creator && IN_FLIGHT.includes(c.status)).slice(0, 8);
        const found = await Promise.allSettled(ship.map((c) => axios.get(`${API}/shipment/${c.id}`)));
        if (!live) return;
        const map = {};
        found.forEach((res, i) => { if (res.status === 'fulfilled' && (res.value.data?.tracking_number || res.value.data?.status)) map[ship[i].id] = true; });
        setShipped(map);
      } catch (e) {
        if (live) { setCampaigns((prev) => prev || []); setCampErr(loadErrorText(e, 'Could not load your campaigns.')); }
      }
    })();
    (async () => {
      try {
        const r = await axios.get(`${API}/business/creator-directory`, { params: { discovery_only: true } });
        if (live) { setCreators(creatorListFrom(r.data)); setDirErr(''); }
      } catch (e) {
        if (live) { setCreators((prev) => prev || []); setDirErr(loadErrorText(e, 'Could not load creators.')); }
      }
    })();
    return () => { live = false; };
  }, [reload]);

  const loading = campaigns === null;
  const live = useMemo(() => (campaigns || []).filter((c) => IN_FLIGHT.includes(c.status)), [campaigns]);
  const completed = useMemo(() => (campaigns || []).find((c) => c.status === 'completed'), [campaigns]);
  const isNewBrand = !loading && !campErr && (campaigns || []).length === 0;

  // "Needs your action": bids to compare, work to review, products to ship.
  const todos = useMemo(() => {
    const out = [];
    const withBids = live.filter((c) => c.status === 'active' && !c.selected_creator && (c.bids || []).length > 0);
    if (withBids.length) {
      const n = withBids.reduce((s, c) => s + c.bids.length, 0);
      out.push({ key: 'bids', badge: String(n), title: `${n} new bid${n === 1 ? '' : 's'} to compare`, sub: withBids.slice(0, 2).map((c) => c.title || c.product_name).join(' · '), cta: 'Compare', to: '/dashboard/business/pending-bids', Icon: Users });
    }
    live.filter((c) => c.status === 'work_submitted' || c.status === 'awaiting_brand_confirmation').slice(0, 2).forEach((c) => {
      out.push({ key: `rev-${c.id}`, title: 'Delivery ready to review', sub: c.title || c.product_name, cta: 'Review', to: '/dashboard/business/work-review', Icon: ClipboardCheck });
    });
    live.filter((c) => (c.requires_shipment || c.shipment_option === 'yes') && c.selected_creator && c.status !== 'work_submitted' && !shipped[c.id]).slice(0, 2).forEach((c) => {
      out.push({ key: `ship-${c.id}`, title: 'Ship product to start filming', sub: c.title || c.product_name, cta: 'Ship', to: '/dashboard/business/shipments', Icon: Truck });
    });
    return out;
  }, [live, shipped]);

  const choice = useMemo(() => (creators || []).filter((c) => c.ugcad_approved).slice(0, 6), [creators]);
  const mixed = useMemo(() => {
    const ids = new Set(choice.map((c) => c.id));
    return (creators || []).filter((c) => !ids.has(c.id)).slice(0, 6);
  }, [creators, choice]);

  // First-video checklist for brands with no campaigns yet (board M1 "Home - new brand").
  const approved = user?.approval_status === 'approved';
  const steps = useMemo(() => [
    { key: 'acct', title: 'Create account', sub: 'Done', done: true },
    { key: 'appr', title: 'Brand approved', sub: approved ? 'Approved by the UGCad team' : 'The UGCad team is reviewing your brand', done: approved, cta: 'Open settings', run: () => navigate('/settings') },
    { key: 'fund', title: 'Add ₹2,500 to your wallet', sub: '₹2,500 unlocks chat with creators. Held safely until you approve.', done: (balance || 0) > 0, cta: 'Add funds', run: () => navigate('/dashboard/business/wallet') },
    { key: 'post', title: 'Post your first campaign', sub: 'About 3 minutes · creators bid within a day', done: (campaigns || []).length > 0, cta: 'Post campaign', run: () => navigate('/dashboard/business/post-brief') },
    { key: 'ok', title: 'Approve your first video', sub: 'You only pay when you approve', done: Boolean(completed) },
  ], [approved, balance, campaigns, completed, navigate]);
  const doneCount = steps.filter((s) => s.done).length;
  const nowIdx = steps.findIndex((s) => !s.done);

  const view = (c) => navigate(`/dashboard/business/creator/${c.id}`);
  const cardProps = { onView: view, onInvite: view, onPlay: setViewer };
  const retry = () => { setCampaigns(null); setCreators(null); setReload((n) => n + 1); };

  // Hero cards (swipe). Upsells only appear once a campaign has completed, as on the website.
  const cards = [];
  if (loading) cards.push({ key: 'sk' });
  else if (isNewBrand) cards.push({ key: 'welcome', eyebrow: greeting(), title: `Welcome to UGCad, ${company}`, sub: creators ? `${creators.length.toLocaleString('en-IN')} vetted creators are taking briefs this week.` : 'Post a brief, vetted creators bid within hours, and you only pay when you approve the video.', cta: 'Post a campaign', to: '/dashboard/business/post-brief' });
  else cards.push({ key: 'welcome', eyebrow: greeting(), title: `Welcome back, ${company}`, sub: campErr ? 'Tell creators what you need and get bids within hours.' : `${live.length} live campaign${live.length === 1 ? '' : 's'} · ${todos.length} thing${todos.length === 1 ? '' : 's'} need${todos.length === 1 ? 's' : ''} you`, cta: 'Post a campaign', to: '/dashboard/business/post-brief' });
  if (completed) {
    cards.push({ key: 'plans', eyebrow: `${completed.title || completed.product_name} IS COMPLETE 🎉`, title: 'Pay less on every video', sub: '15% fee instead of 20% · A UGC expert at every step · 1 edited video every month', cta: 'See plans', to: '/dashboard/business/plans' });
    cards.push({ key: 'edit', eyebrow: 'EXPERT EDITING', title: 'Make raw videos ad-ready', sub: 'Hooks, captions, music, 3 sizes. ₹1,500 / video, back in 48h.', cta: 'Add editing', to: '/dashboard/business/edit-addon' });
  }
  const onHeroScroll = () => {
    const el = heroRef.current;
    const first = el?.firstElementChild;
    if (!el || !first) return;
    setSlide(Math.round(el.scrollLeft / (first.offsetWidth + 10)));
  };

  return (
    <AppShell title="Home" right={<WalletChip balance={balance} />}>
      <div className={`ap-home-hero${cards.length > 1 ? ' is-multi' : ''}`} ref={heroRef} onScroll={onHeroScroll}>
        {cards.map((c) => (c.key === 'sk' ? (
          <div key="sk" className="ap-skel ap-home-hero-sk" />
        ) : (
          <section key={c.key} className="ap-home-hc">
            <span className="ap-home-glow" aria-hidden="true" />
            <div className="ap-home-eyebrow">{c.eyebrow}</div>
            <h2>{c.title}</h2>
            <p>{c.sub}</p>
            <button type="button" className="ap-btn ap-btn--light" onClick={() => navigate(c.to)}>{c.cta}</button>
          </section>
        )))}
      </div>
      {cards.length > 1 && (
        <div className="ap-home-dots" aria-hidden="true">
          {cards.map((c, i) => <span key={c.key} className={i === Math.min(slide, cards.length - 1) ? 'on' : ''} />)}
        </div>
      )}

      {campErr && (
        <div className="ap-card ap-home-err" role="alert">
          {campErr.startsWith("You're offline") ? <WifiOff size={20} /> : <AlertCircle size={20} />}
          <div><b>Could not load your campaigns</b><p>{campErr}</p></div>
          <button type="button" className="ap-btn ap-btn--sm" onClick={retry}>Retry</button>
        </div>
      )}

      {isNewBrand && (
        <section className="ap-card ap-home-start" aria-labelledby="ap-home-start-t">
          <div className="ap-home-start-h">
            <span className="ap-home-ring" style={{ background: `conic-gradient(#7387ff 0 ${(doneCount / steps.length) * 100}%, #e4e5f5 0 100%)` }}><span>{doneCount}/{steps.length}</span></span>
            <div>
              <h2 id="ap-home-start-t">Get your first video</h2>
              <small>{steps.length - doneCount} step{steps.length - doneCount === 1 ? '' : 's'} left</small>
            </div>
          </div>
          <ol className="ap-home-steps">
            {steps.map((s, i) => {
              const now = i === nowIdx;
              return (
                <li key={s.key} className={`${s.done ? 'is-done' : ''}${now ? ' is-now' : ''}`}>
                  <span className="ap-home-dot">{s.done ? <Check size={15} strokeWidth={3} /> : i + 1}</span>
                  {now ? (
                    <div className="ap-home-next">
                      <small>NEXT STEP</small>
                      <b>{s.title}</b>
                      <p>{s.sub}</p>
                      {s.cta && <button type="button" className="ap-btn ap-btn--sm ap-home-grad" onClick={s.run}>{s.cta}</button>}
                    </div>
                  ) : (
                    <div className="ap-home-st"><b>{s.title}</b><small>{s.sub}</small></div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {!isNewBrand && !campErr && (
        <section className="ap-card" aria-labelledby="ap-home-needs">
          <h2 id="ap-home-needs" className="ap-card-h">Needs your action</h2>
          {loading ? (
            <div className="ap-home-skrows"><span className="ap-skel" /><span className="ap-skel" /></div>
          ) : todos.length === 0 ? (
            <p className="ap-home-caught"><Check size={16} /> You&rsquo;re all caught up. Nothing is waiting on you.</p>
          ) : todos.map((t) => (
            <button key={t.key} type="button" className="ap-row ap-home-row" onClick={() => navigate(t.to)}>
              <span className="ap-home-ic">{t.badge || <t.Icon size={18} />}</span>
              <span className="ap-row-t"><b>{t.title}</b><small>{t.sub}</small></span>
              <span className="ap-btn ap-btn--sm">{t.cta}</span>
            </button>
          ))}
        </section>
      )}

      {!isNewBrand && !campErr && !loading && live.length > 0 && (
        <section aria-labelledby="ap-home-act">
          <div className="ap-home-sh">
            <h2 id="ap-home-act">Active campaigns</h2>
            <button type="button" className="ap-link" onClick={() => navigate('/dashboard/business/all-campaigns')}>View all ({(campaigns || []).length})</button>
          </div>
          <div className="ap-home-list">
            {live.slice(0, 3).map((c) => {
              const st = campaignStage(c, shipped[c.id]);
              const pill = campaignPill(c, shipped[c.id]);
              const cta = campaignCta(c, shipped[c.id]);
              const thumb = c.product_image || (c.product_images || [])[0] || c.cover_image || c.image_url || c.brand_logo_url || c.brand_logo;
              const step = Math.min(st.step, 5);
              return (
                <article key={c.id} className="ap-card ap-home-camp">
                  <div className="ap-home-camp-top">
                    <span className="ap-home-thumb">{thumb ? <img src={assetUrl(thumb)} alt="" /> : null}</span>
                    <div className="ap-row-t">
                      <span className={`ap-pill ${PILL[pill.tone] || ''}`}>{pill.text}</span>
                      <b>{c.title || c.product_name}</b>
                      <small>{[c.product_category, budgetText(c)].filter(Boolean).join(' · ')}</small>
                    </div>
                  </div>
                  <div className="ap-home-bar5" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < step ? 'on' : ''} />)}</div>
                  <div className="ap-home-camp-foot">
                    <small>{`Step ${step} of 5 · ${st.label}`}</small>
                    <button type="button" className="ap-btn ap-btn--sm" onClick={() => navigate(cta.to)}>{cta.label}</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {!isNewBrand && !campErr && !loading && live.length === 0 && (
        <div className="ap-card ap-home-caught ap-home-caught--card">No live campaigns right now.{' '}
          <button type="button" className="ap-link" onClick={() => navigate('/dashboard/business/post-brief')}>Post one</button>
        </div>
      )}

      {(creators === null || choice.length > 0) && (
        <section aria-labelledby="ap-home-choice">
          <div className="ap-home-sh">
            <h2 id="ap-home-choice">UGCAD.IO Choice</h2>
            <button type="button" className="ap-link" onClick={() => navigate('/dashboard/business/browse-creator?collection=ugcad-approved')}>See all</button>
          </div>
          <div className="ap-home-hscroll">
            {creators === null
              ? [0, 1, 2].map((i) => <div key={i} className="ap-skel ap-home-cksk" />)
              : choice.map((c) => <div key={c.id} className="ap-home-hs-item"><ReelCard c={c} {...cardProps} /></div>)}
          </div>
        </section>
      )}

      <section aria-labelledby="ap-home-all">
        <div className="ap-home-sh">
          <h2 id="ap-home-all">All creators</h2>
          <button type="button" className="ap-link" onClick={() => navigate('/dashboard/business/browse-creator')}>See all</button>
        </div>
        {dirErr ? (
          <div className="ap-card ap-home-err" role="alert">
            {dirErr.startsWith("You're offline") ? <WifiOff size={20} /> : <AlertCircle size={20} />}
            <div><b>Could not load creators</b><p>{dirErr}</p></div>
            <button type="button" className="ap-btn ap-btn--sm" onClick={retry}>Retry</button>
          </div>
        ) : creators === null ? (
          <div className="ap-home-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="ap-skel ap-home-gsk" />)}</div>
        ) : mixed.length === 0 ? (
          <div className="ap-empty"><h3>No creators to show yet</h3><p>New creators join every week. Post a campaign and they will find you.</p>
            <button type="button" className="ap-btn" onClick={() => navigate('/dashboard/business/post-brief')}>Post a campaign</button>
          </div>
        ) : (
          <div className="ap-home-grid">{mixed.map((c) => <ReelCard key={c.id} c={c} {...cardProps} />)}</div>
        )}
      </section>

      {viewer && <VideoViewer items={[viewer]} onClose={() => setViewer(null)} />}
    </AppShell>
  );
}

export default withBrandGate(BrandAppHome);
