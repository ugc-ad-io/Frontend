import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Star, BadgeCheck, MessageCircle, Info, Users } from 'lucide-react';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { ownsCampaign } from '../../../utils/brandWorkspace';
import { isOpenForBids, selectedCreators, creatorsWanted, slotsLeft, bidSplitLabel } from '../../../utils/campaignCreators';
import { apiErrorMessage } from '../../../utils/apiError';
import withBrandGate from '../../brandkit/withBrandGate';
import AppShell from '../../shell/AppShell';
import {
  API, ROUTES, inr, fmtDay, campaignThumb, assetUrl, bidName, bidFirstName, initialOf, backOr,
  Thumb, SkelCards, ErrorState, OfflineStrip, useBidActions,
} from './campaignKit';

const LEVEL = { new: 'New', verified: 'Verified', l1: 'Level 1', l2: 'Level 2', elite: 'Elite' };
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'responded', label: 'Responded' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'declined', label: 'Declined' },
];
const SORTS = [
  { id: 'match', label: 'Best match' },
  { id: 'price-low', label: 'Price: low to high' },
  { id: 'price-high', label: 'Price: high to low' },
  { id: 'delivery-fast', label: 'Fastest delivery' },
];
const idOf = (b) => b.id ?? b.creator_id;
const num = (v) => (v == null || v === '' ? null : Number(v));
const budgetRange = (c) => {
  const lo = Number(c.budget_min || 0);
  const hi = Number(c.budget_max || 0);
  if (!hi || lo === hi) return inr(lo || hi);
  if (!lo) return inr(hi);
  return `${inr(lo)}–${inr(hi)}`;
};

function BidsBoard({ campaign, creatorsById, act, declined }) {
  const navigate = useNavigate();
  const hiredIds = selectedCreators(campaign);
  const bids = campaign.bids || [];
  const isHired = (b) => hiredIds.includes(String(b.creator_id));
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('match');
  // Shortlist is a local, per-visit helper (the website does not persist it either).
  const [shortlist, setShortlist] = useState(() => new Set());
  const hasResponded = (b) => !!(b.proposal && b.proposal.trim());

  const counts = {
    all: bids.filter((b) => !declined.has(idOf(b)) && !isHired(b)).length,
    shortlisted: bids.filter((b) => shortlist.has(idOf(b)) && !isHired(b)).length,
    responded: bids.filter((b) => hasResponded(b) && !declined.has(idOf(b)) && !isHired(b)).length,
    accepted: bids.filter(isHired).length,
    declined: bids.filter((b) => declined.has(idOf(b))).length,
  };

  const visible = bids.filter((b) => {
    const id = idOf(b);
    if (tab === 'shortlisted') return shortlist.has(id) && !isHired(b);
    if (tab === 'responded') return hasResponded(b) && !declined.has(id) && !isHired(b);
    if (tab === 'accepted') return isHired(b);
    if (tab === 'declined') return declined.has(id);
    return !declined.has(id) && !isHired(b);
  });
  if (sort !== 'match') {
    visible.sort((a, b) => {
      const key = sort === 'delivery-fast' ? 'estimated_delivery_days' : 'amount';
      const av = num(a[key]); const bv = num(b[key]);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sort === 'price-high' ? bv - av : av - bv;
    });
  }
  const toggleShort = (id) => setShortlist((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const wanted = creatorsWanted(campaign);
  const pickBy = fmtDay(campaign.due_date || campaign.deadline);
  const left = slotsLeft(campaign);

  return (
    <>
      <section className="ap-card ap-cp-bidhead">
        <div className="ap-cp-bidhead-top">
          <Thumb src={campaignThumb(campaign)} name={campaign.title} w={48} h={60} />
          <div className="ap-cp-grow">
            <b>{campaign.title || 'Untitled campaign'}</b>
            <small>Budget {budgetRange(campaign)} per video &middot; {bids.length} application{bids.length === 1 ? '' : 's'}</small>
          </div>
        </div>
        <div className="ap-cp-hired">
          <span className="ap-cp-dots" aria-hidden="true">
            {Array.from({ length: Math.min(wanted, 8) }).map((_, i) => <i key={i} className={i < hiredIds.length ? 'is-on' : ''} />)}
          </span>
          <span><strong>{hiredIds.length} of {wanted} hired</strong>{pickBy ? ` · pick by ${pickBy}` : ''}</span>
        </div>
        <div className="ap-cp-btnrow">
          <button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => navigate(ROUTES.campaign(campaign.id))}>View campaign</button>
          {hiredIds.length > 0 && left > 0 && (
            <button type="button" className="ap-btn ap-btn--sm" onClick={() => act.finish(campaign)}>Finish hiring</button>
          )}
        </div>
      </section>

      <div className="ap-chips" role="tablist" aria-label="Filter bids">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`ap-chip${tab === t.id ? ' is-on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}<span className="ap-cp-count">{counts[t.id]}</span>
          </button>
        ))}
      </div>
      <label className="ap-cp-sort">
        <span>Sort</span>
        <select className="ap-input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort bids">
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>

      {visible.length === 0 ? (
        <div className="ap-empty">
          <h3>No bids here yet</h3>
          <p>{tab === 'all' ? 'Every bid has been answered. New ones will show up here.' : 'Nothing in this tab right now.'}</p>
          {tab !== 'all' && <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setTab('all')}>See all bids</button>}
        </div>
      ) : (
        <div className="ap-cp-list">
          {visible.map((bid, idx) => {
            const id = idOf(bid);
            const d = creatorsById[String(bid.creator_id)] || {};
            const name = bidName(bid) || 'Creator';
            const first = bidFirstName(bid);
            const isTop = idx === 0 && tab === 'all' && sort === 'match' && counts.all > 1;
            const isShort = shortlist.has(id);
            const prev = d.portfolio_preview && !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(d.portfolio_preview) ? d.portfolio_preview : '';
            const poster = prev || bid.creator_photo || bid.profile_photo || d.profile_photo || '';
            const avatar = bid.creator_photo || bid.profile_photo || d.profile_photo || '';
            const lvl = d.ugcad_approved ? 'Choice' : (LEVEL[String(d.level || '').toLowerCase()] || '');
            const rating = Number(d.avg_rating || 0);
            const reviews = Number(d.review_count || 0);
            const days = Number(bid.estimated_delivery_days || 0);
            const line = [lvl, rating > 0 && reviews > 0 ? `★ ${rating.toFixed(1)} (${reviews})` : '', days ? `${days} day${days === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
            const split = bidSplitLabel(bid);
            return (
              <article key={id} className="ap-card ap-cp-bid">
                {isTop && <div className="ap-cp-best"><span className="ap-pill ap-cp-pill-ink">&#9733; Best match</span><small>Fits your budget and niche</small></div>}
                <div className="ap-cp-bid-body">
                  <button type="button" className="ap-cp-poster" aria-label={`View ${first}'s profile`} onClick={() => bid.creator_id && navigate(ROUTES.creator(bid.creator_id))}>
                    {poster ? <img src={assetUrl(poster)} alt="" /> : <b>{initialOf(name)}</b>}
                  </button>
                  <div className="ap-cp-bid-info">
                    <div className="ap-cp-bid-who">
                      <span className="ap-cp-ava" style={{ width: 24, height: 24, fontSize: 10 }}>{avatar ? <img src={assetUrl(avatar)} alt="" /> : initialOf(name)}</span>
                      <button type="button" className="ap-cp-namebtn" onClick={() => bid.creator_id && navigate(ROUTES.creator(bid.creator_id))}>{first}</button>
                      {d.kyc_verified && <BadgeCheck size={16} color="#4e60e6" aria-label="Identity verified" />}
                    </div>
                    {line && <div className="ap-cp-sub">{line}</div>}
                    <div className="ap-cp-bid-price">
                      <b>{inr(bid.amount)}</b>
                      <span>{split ? split : 'per video'}</span>
                    </div>
                  </div>
                </div>
                <div className="ap-cp-quote">{bid.proposal ? `“${bid.proposal}”` : 'No proposal message provided.'}</div>
                {isHired(bid) ? (
                  <div className="ap-cp-bid-act">
                    <span className="ap-pill ap-pill--ok">Accepted</span>
                    <button type="button" className="ap-btn ap-cp-42 ap-cp-soft" style={{ marginLeft: 'auto' }} onClick={() => navigate(ROUTES.chat(bid.creator_id))}><MessageCircle size={16} /> Chat</button>
                  </div>
                ) : declined.has(id) ? (
                  <div className="ap-cp-bid-act"><span className="ap-pill ap-pill--bad">Declined</span></div>
                ) : (
                  <div className="ap-cp-bid-act">
                    <button type="button" className="ap-cp-textbtn" onClick={() => act.decline(campaign, bid)}>Decline</button>
                    <button type="button" className={`ap-cp-circ${isShort ? ' is-on' : ''}`} aria-label={isShort ? 'Remove from shortlist' : 'Shortlist'} aria-pressed={isShort} onClick={() => toggleShort(id)}>
                      <Star size={18} fill={isShort ? 'currentColor' : 'none'} />
                    </button>
                    <button type="button" className="ap-btn ap-cp-42 ap-cp-soft" aria-label={`Chat with ${first}`} onClick={() => navigate(ROUTES.chat(bid.creator_id))}>Chat</button>
                    <button type="button" className="ap-btn ap-cp-42" onClick={() => act.hire(campaign, bid)}>Hire</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      <div className="ap-cp-note"><Info size={18} /><span>Accepting holds the bid plus the 20% platform fee in escrow. It&rsquo;s released to the creator only after you approve the video.</span></div>
    </>
  );
}

function Bids() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [campaignId, setCampaignId] = useState(null);
  const [creatorsById, setCreatorsById] = useState({});
  // Bids declined this visit (seeded from persisted status below so a decline survives a refresh).
  const [declinedNow, setDeclinedNow] = useState(() => new Set());

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/campaigns`);
      setCampaigns((Array.isArray(res.data) ? res.data : []).filter((c) => ownsCampaign(user, c)));
      setLoadError('');
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load your bids. Check your connection and try again.'));
    } finally { setLoading(false); }
  }, [user?.id, user?.team_of]); // eslint-disable-line react-hooks/exhaustive-deps

  useLiveEffect(() => { load(); }, [load]);

  // Photo / level / rating for the bid rows. Nice to have: a failure just leaves the initials.
  useEffect(() => {
    let live = true;
    axios.get(`${API}/business/creator-directory`, { params: { discovery_only: true } })
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.creators || []);
        if (live) setCreatorsById(Object.fromEntries(list.map((c) => [String(c.id), c])));
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const act = useBidActions((ev) => {
    if (ev.kind === 'decline') setDeclinedNow((prev) => new Set(prev).add(ev.bidId));
    load();
  });

  // A multi-creator brief keeps taking bids for its open slots after the first hire.
  const bidCampaigns = useMemo(() => campaigns.filter((c) => c.bids && c.bids.length > 0 && isOpenForBids(c)), [campaigns]);
  const hasOpenBids = (c) => (c.bids || []).some((b) => !selectedCreators(c).includes(String(b.creator_id)));
  const current = bidCampaigns.find((c) => c.id === campaignId) || bidCampaigns.find(hasOpenBids) || bidCampaigns[0];
  const declined = useMemo(() => {
    const s = new Set(declinedNow);
    (current?.bids || []).filter((b) => b.status === 'declined').forEach((b) => s.add(idOf(b)));
    return s;
  }, [current, declinedNow]);

  return (
    <AppShell title="Compare bids" back={backOr(ROUTES.campaigns)}>
      <div className="ap-cp-page">
        <OfflineStrip />
        {loading ? (
          <SkelCards n={3} h={190} />
        ) : loadError && !bidCampaigns.length ? (
          <ErrorState title={'Couldn’t load your bids'} message={loadError} onRetry={() => { setLoading(true); load(); }} />
        ) : bidCampaigns.length === 0 ? (
          <div className="ap-empty">
            <span className="ap-cp-emptyic"><Users size={30} /></span>
            <h3>No pending bids at the moment</h3>
            <p>When creators bid on your campaigns, you&rsquo;ll compare them here. Money only leaves your wallet when you accept.</p>
            <button type="button" className="ap-btn" onClick={() => navigate(ROUTES.campaigns)}>View campaigns</button>
          </div>
        ) : (
          <>
            {bidCampaigns.length > 1 && current && (
              <label className="ap-cp-sort ap-cp-sort--full">
                <span>Campaign</span>
                <select className="ap-input" value={current.id} onChange={(e) => setCampaignId(e.target.value)} aria-label="Campaign">
                  {bidCampaigns.map((c) => {
                    const hired = selectedCreators(c);
                    const n = (c.bids || []).filter((b) => !hired.includes(String(b.creator_id))).length;
                    return <option key={c.id} value={c.id}>{c.title} {'·'} {n} bid{n === 1 ? '' : 's'}</option>;
                  })}
                </select>
              </label>
            )}
            {current && <BidsBoard key={current.id} campaign={current} creatorsById={creatorsById} act={act} declined={declined} />}
          </>
        )}
      </div>
      {act.node}
    </AppShell>
  );
}

export default withBrandGate(Bids);
