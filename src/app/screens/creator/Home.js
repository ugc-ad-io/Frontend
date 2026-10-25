import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { CalendarClock } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { creatorFirstName } from '../../../utils/displayName';
import { getProfilePct, getProfileNudge } from '../../../utils/creatorProfileCompletion';
import { isSelectedCreator, isOpenForBids } from '../../../utils/campaignCreators';
import { toggleSavedBrief, getSavedIds, hydrateSavedFromServer } from '../../../utils/savedBriefs';
import normalizeBrief from '../../../utils/normalizeBrief';
import { mediaUrl } from '../../../utils/mediaUrl';
import { inr, initialOf } from '../../../components/briefUi';
import RejectedGate from '../../../components/RejectedGate';
import MoreInfoGate from '../../../components/MoreInfoGate';
import CreatorPendingGate from '../../../components/CreatorPendingGate';
import { API, failText, Logo, BriefCard, BriefCardSkeleton, isInviteDeal } from './briefsShared';
import './home.css';

const orderPrice = (campaign, userId) => {
  const mine = (campaign?.bids || []).find((bid) => bid.creator_id === userId);
  return Number(mine?.amount ?? campaign?.budget_max ?? campaign?.budget ?? campaign?.budget_min ?? 0);
};
const dueDate = (campaign) => {
  const raw = campaign?.final_delivery_by || campaign?.draft_delivery_by || campaign?.due_date || campaign?.deadline;
  const ms = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(ms) ? new Date(ms) : null;
};
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysUntil = (d) => Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
function duePill(campaign) {
  const d = dueDate(campaign);
  if (!d) return null;
  const n = daysUntil(d);
  if (n < 0) return { text: 'Overdue', tone: 'bad' };
  if (n === 0) return { text: 'Due today', tone: 'warn' };
  if (n <= 3) return { text: `Due in ${n} day${n === 1 ? '' : 's'}`, tone: 'warn' };
  return { text: `Due ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, tone: '' };
}
const brandLabel = (c, fallback = 'Brand') =>
  String(c?.brand_name || c?.business_name || c?.company_name || c?.business_nickname || c?.brand_handle || '').replace(/^@+/, '').trim() || fallback;
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const getLevelInfo = (completedWorks) => {
  if (completedWorks >= 20) return { level: 'L2 Professional', nextLevel: null, currentWorks: completedWorks, nextWorks: null, benefits: '10% Higher Base Rates & Premium Support' };
  if (completedWorks >= 10) return { level: 'L1 Rising Star', nextLevel: 'L2 Professional', currentWorks: completedWorks, nextWorks: 20, benefits: 'Verified badge & Priority support' };
  return { level: 'New Creator', nextLevel: 'L1 Rising Star', currentWorks: completedWorks, nextWorks: 10, benefits: 'Complete 10 works to reach L1 Rising Star' };
};

function Bar({ label, value, pct }) {
  return (
    <div>
      <div className="ap-hm-bar-h"><span>{label}</span><strong>{value}</strong></div>
      <div className="ap-hm-bar"><span style={{ width: `${Math.min(100, Math.max(0, pct || 0))}%` }} /></div>
    </div>
  );
}

export default function CreatorAppHome() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [availableCampaigns, setAvailableCampaigns] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [deals, setDeals] = useState([]);
  const [dealsError, setDealsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [completedWorks, setCompletedWorks] = useState(0);
  const [payout, setPayout] = useState(null); // balance, pending_release, paid_this_month, pending_deals_count
  const [lifetimeEarned, setLifetimeEarned] = useState(null);
  const [briefTab, setBriefTab] = useState('match');
  const [savedIds, setSavedIds] = useState(() => getSavedIds());
  // "Later" on the complete-your-profile sheet hides it for this session only.
  const [nudgeLater, setNudgeLater] = useState(() => {
    try { return sessionStorage.getItem('profileNudgeLater') === '1'; } catch { return false; }
  });

  const fetchAllData = async () => {
    try {
      const [campaignsRes, reviewsRes, worksRes, payoutRes] = await Promise.all([
        axios.get(`${API}/campaigns?t=${Date.now()}`),
        axios.get(`${API}/reviews/creator/${user.id}`),
        axios.get(`${API}/campaigns?status=completed&creator_id=${user.id}`),
        axios.get(`${API}/payout/overview`).catch(() => null), // optional: hero falls back to the wallet balance
      ]);
      setLifetimeEarned(payoutRes?.data?.all_time_earnings ?? null);
      setPayout(payoutRes?.data || null);
      setLoadError('');
      const all = campaignsRes.data;
      // Only genuinely COMPLETED deals count as closed (the backend returns every campaign the creator is on).
      setCompletedWorks((worksRes.data || []).filter((c) => isSelectedCreator(c, user.id) && String(c.status).toLowerCase() === 'completed').length);
      setActiveCampaigns(all.filter((c) => isSelectedCreator(c, user.id) && (c.status === 'in_progress' || c.status === 'active')));
      setAvailableCampaigns(all.filter((c) => isOpenForBids(c) && !isSelectedCreator(c, user.id)));
      setMyBids(all.filter((c) => c.bids?.some((b) => b.creator_id === user.id)).map((c) => ({ ...c, myBid: c.bids.find((b) => b.creator_id === user.id) })));
      setReviews(reviewsRes.data || []);
    } catch (error) {
      // Keep whatever is already on screen; show a banner with Retry instead of silent zeros.
      setLoadError(error?.response ? 'Some of your dashboard data could not be loaded.' : "You're offline. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
    try {
      const r = await axios.get(`${API}/deals/my?summary=true`);
      setDeals(Array.isArray(r.data) ? r.data : (r.data?.deals || []));
      setDealsError('');
    } catch (err) {
      setDealsError(failText(err, 'Could not load your invites.'));
    }
  };

  useLiveEffect(() => {
    // Only skip when approval_status is explicitly set and not 'approved'.
    if (user && user.approval_status && user.approval_status !== 'approved') return undefined;
    if (user?.id) {
      fetchAllData();
      const interval = setInterval(fetchAllData, 60000); // live updates push changes; this is only a safety net
      return () => clearInterval(interval);
    }
    return undefined;
  }, [user?.approval_status, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useLiveEffect(() => {
    axios.get(`${API}/auth/me`).then((r) => setUser(r.data)).catch(() => {});
  }, [setUser]);

  useLiveEffect(() => {
    const sync = () => setSavedIds(getSavedIds());
    window.addEventListener('ugc-saved-changed', sync);
    hydrateSavedFromServer().then(sync).catch(() => {});
    return () => window.removeEventListener('ugc-saved-changed', sync);
  }, []);

  const levelInfo = getLevelInfo(completedWorks);
  const hasReceivedBriefs = activeCampaigns.length > 0 || myBids.length > 0;
  const isNewCreator = !loading && !loadError && !hasReceivedBriefs && completedWorks === 0;
  const briefs = useMemo(() => availableCampaigns.map((c, i) => normalizeBrief(c, i, myBids)), [availableCampaigns, myBids]);
  const shownBriefs = useMemo(() => {
    const list = briefTab === 'closing'
      ? [...briefs].sort((a, b) => (a.deliveryDays ?? 9999) - (b.deliveryDays ?? 9999))
      : [...briefs].sort((a, b) => b.matchScore - a.matchScore);
    return list.slice(0, isNewCreator ? 3 : 2);
  }, [briefs, briefTab, isNewCreator]);
  const invites = useMemo(() => deals.filter(isInviteDeal), [deals]);

  // Approval gates, same checks and components as the website dashboard.
  if (user?.approval_status === 'pending') return <CreatorPendingGate user={user} onLogout={logout} />;
  if (user?.approval_status === 'rejected') return <RejectedGate user={user} onHome={logout} kind="creator" />;
  if (user?.approval_status === 'more_info') return <MoreInfoGate kind="creator" user={user} onLogout={logout} />;
  if (user && user.approval_status && user.approval_status !== 'approved') {
    return (
      <AppShell title="Home" tabs={false}>
        <div className="ap-empty ap-card"><h3>Profile pending review</h3><p>Your creator profile is being reviewed by our team. You will get access to everything once approved.</p><button type="button" className="ap-btn" onClick={logout}>Log out</button></div>
      </AppShell>
    );
  }

  const displayName = creatorFirstName(user);
  const rating = Number(user?.average_rating || user?.avg_rating || 0);
  const profilePct = getProfilePct(user);
  const nudge = getProfileNudge(user);
  const balance = Number(payout?.balance ?? user?.balance ?? 0);
  const clearing = Number(payout?.pending_release || 0);
  const clearingOrders = Number(payout?.pending_deals_count || 0);
  const activeValue = activeCampaigns.reduce((sum, c) => sum + orderPrice(c, user?.id), 0);
  const progress = levelInfo.nextWorks ? Math.min(100, Math.max(0, (levelInfo.currentWorks / levelInfo.nextWorks) * 100)) : 100;
  const levelLabel = user?.level_label || levelInfo.level;
  const earnedLine = payout ? null : (lifetimeEarned ?? Number(user?.balance || 0));

  const today = startOfDay(new Date());
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const weekDue = activeCampaigns
    .map((c) => ({ c, d: dueDate(c) }))
    .filter(({ d }) => d && weekDays.some((w) => w.getTime() === startOfDay(d).getTime()))
    .sort((a, b) => a.d - b.d);

  const toggleSave = (b) => { const s = toggleSavedBrief(b); setSavedIds(getSavedIds()); toast.success(s ? 'Saved to your list' : 'Removed from saved'); };
  const openBrief = (b) => navigate(`/browse-briefs?open=${b.id}`);
  const briefCards = shownBriefs.map((b) => (
    <BriefCard key={b.id} brief={b} saved={savedIds.has(String(b.id))} onOpen={openBrief} onToggleSave={toggleSave} />
  ));
  const retry = () => { setLoading(true); fetchAllData(); };

  return (
    <AppShell className="ap-hm-shell" tone="dark" bare title={isNewCreator ? `Welcome, ${displayName}` : `${greeting()}, ${displayName}`}>
      <section className="ap-hero ap-hm-hero">
        <div className="ap-hm-who">
          <span>Level: {levelLabel}</span>
          {user?.ugcad_approved && <span className="ap-hm-choice">UGCAD.IO Choice</span>}
        </div>
        <div className="ap-hm-bal">
          <div>
            <div className="ap-hm-lbl">Available to withdraw</div>
            {loading && !payout ? <div className="ap-skel ap-hm-skel-dark" style={{ width: 150, height: 38, marginTop: 4 }} /> : <div className="ap-hm-big">{inr(balance)}</div>}
            <div className="ap-hm-sub">
              {payout
                ? (clearing > 0 ? `+ ${inr(clearing)} clearing${clearingOrders ? ` from ${clearingOrders} order${clearingOrders === 1 ? '' : 's'}` : ''}` : 'Nothing waiting to clear')
                : (earnedLine != null && !loading ? `${inr(earnedLine)} earned so far` : '')}
            </div>
          </div>
          <button type="button" className="ap-hm-wd" onClick={() => navigate('/withdrawal')}>Withdraw</button>
        </div>
        <div className="ap-hm-bars">
          <Bar label="Rating" value={rating ? `${rating.toFixed(1)}${reviews.length ? ` (${reviews.length})` : ''}` : 'New'} pct={(rating / 5) * 100} />
          <Bar label="Profile" value={`${profilePct}%`} pct={profilePct} />
          <Bar label="Level" value={levelInfo.nextWorks ? `${levelInfo.currentWorks}/${levelInfo.nextWorks}` : 'Top'} pct={progress} />
        </div>
      </section>

      <div className="ap-hm-pad">
        {loadError && (
          <div className="ap-hm-bannerr" role="alert"><span>{loadError}</span><button type="button" onClick={retry}>Retry</button></div>
        )}

        {loading && (
          <>
            <div className="ap-card" aria-hidden="true"><div className="ap-skel" style={{ height: 18, width: '40%' }} /><div className="ap-skel" style={{ height: 48, marginTop: 14 }} /><div className="ap-skel" style={{ height: 48, marginTop: 10 }} /></div>
            <BriefCardSkeleton />
          </>
        )}

        {!loading && isNewCreator && (
          <section className="ap-hm-welcome">
            <div style={{ fontSize: 12.5, color: '#c9ceff' }}>You're live · Level: {levelLabel}</div>
            <h2>{briefs.length ? `Next: apply to ${Math.min(3, briefs.length)} brief${Math.min(3, briefs.length) === 1 ? '' : 's'}` : 'Next: find your first brief'}</h2>
            <div style={{ fontSize: 12.5, color: '#c9ceff' }}>{briefs.length} open brief{briefs.length === 1 ? '' : 's'} right now</div>
            <ol className="ap-hm-steps" aria-label="Your first order">
              {[['Account', 1], ['Approved', 2], ['Apply', 3], ['Deliver', 4], ['Get paid', 5]].map(([label, n]) => (
                <li key={label} className={n < 3 ? 'is-done' : n === 3 ? 'is-now' : ''}><span>{n < 3 ? '✓' : n}</span><small>{label}</small></li>
              ))}
            </ol>
            <button type="button" className="ap-btn ap-btn--light ap-btn--block" onClick={() => navigate('/browse-briefs')}>Find briefs</button>
          </section>
        )}

        {!loading && !isNewCreator && (
          <>
            <section className="ap-card" style={{ paddingBottom: 4 }}>
              <div className="ap-hm-ch">
                <b>Active orders</b>
                <span>{activeCampaigns.length ? `${activeCampaigns.length} order${activeCampaigns.length === 1 ? '' : 's'}${activeValue > 0 ? ` · ${inr(activeValue)}` : ''}` : ''}</span>
              </div>
              {activeCampaigns.length ? activeCampaigns.map((c) => {
                const pill = duePill(c);
                const brand = brandLabel(c);
                const img = c.image_url || c.cover_image;
                return (
                  <div className="ap-hm-order" key={c.id}>
                    <span className="ap-hm-oimg">{img ? <img src={mediaUrl(img)} alt="" /> : initialOf(brand)}</span>
                    <div className="ap-hm-ot">
                      <small>{brand} · {inr(orderPrice(c, user?.id))}</small>
                      <b>{c.title || 'Active campaign'}</b>
                      {pill ? <span className={`ap-pill${pill.tone ? ` ap-pill--${pill.tone}` : ''}`}>{pill.tone && <CalendarClock size={12} />}{pill.text}</span> : <span className="ap-pill ap-pill--muted">No deadline</span>}
                    </div>
                    <button type="button" className="ap-hm-go" onClick={() => navigate(`/my-deals?campaign=${c.id}`)}>Open</button>
                  </div>
                );
              }) : (
                <div className="ap-hm-empty">No orders in progress. Apply to a brief below to get your next one.</div>
              )}
              {activeCampaigns.length > 0 && <div style={{ padding: '2px 0 10px' }}><button type="button" className="ap-link" style={{ minHeight: 44 }} onClick={() => navigate('/my-deals')}>All orders</button></div>}
            </section>

            <section className="ap-card">
              <div className="ap-hm-ch"><b>This week</b></div>
              <div className="ap-hm-week">
                {weekDays.map((d) => {
                  const has = weekDue.some(({ d: due }) => startOfDay(due).getTime() === d.getTime());
                  const isToday = d.getTime() === today.getTime();
                  return (
                    <div key={d.getTime()} className={isToday ? 'is-today' : has ? 'has' : ''}>
                      <small>{d.toLocaleDateString('en-US', { weekday: 'narrow' })}</small>
                      <b>{d.getDate()}</b>
                      <i style={has && isToday ? { background: '#fff' } : undefined} />
                    </div>
                  );
                })}
              </div>
              <ul className="ap-hm-wl">
                {weekDue.length ? weekDue.map(({ c, d }) => <li key={c.id}><strong>{d.getDate()}</strong>Deliver: {c.title || brandLabel(c)}</li>) : <li className="none">Nothing due this week.</li>}
              </ul>
            </section>

            {(invites.length > 0 || dealsError) && (
              <>
                <div className="ap-sec-h"><h2>Invited you</h2>{invites.length > 0 && <button type="button" className="ap-link" style={{ minHeight: 44 }} onClick={() => navigate('/browse-briefs?tab=invites')}>See all {invites.length}</button>}</div>
                {dealsError && !invites.length ? (
                  <div className="ap-hm-bannerr" role="alert"><span>{dealsError}</span><button type="button" onClick={fetchAllData}>Retry</button></div>
                ) : (
                  <div className="ap-hm-list">
                    {invites.slice(0, 2).map((d) => {
                      const c = d.campaign || {};
                      const brand = brandLabel({ ...c, brand_name: d?.brand?.name || c.brand_name });
                      const countered = c.booking_status === 'price_revision';
                      const amount = countered ? c.proposed_amount : (d?.escrow?.held_amount ?? c.budget_max ?? c.budget_min ?? d?.my_bid?.amount);
                      return (
                        <article className="ap-bf-inv" key={d.deal_id || c.id}>
                          <div className="ap-bf-inv-h">
                            <Logo name={brand} src={d?.brand?.logo_url || c.brand_logo_url} />
                            <div><small>{brand} {countered ? 'is reviewing your counter' : 'invited you'}</small><b>{c.title || 'Untitled brief'}</b></div>
                            <span className="ap-bf-inv-amt">{inr(amount)}</span>
                          </div>
                          <div className="ap-bf-inv-f">
                            <span><strong>{countered ? 'Counter sent, awaiting brand' : 'Awaiting your response'}</strong></span>
                            <button type="button" className="ap-bf-cta" onClick={() => navigate(`/my-deals?campaign=${c.id || d.deal_id}`)}>{countered ? 'View' : 'Review'}</button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!loading && (
          <>
            <div className="ap-sec-h">
              <h2>{isNewCreator ? 'Briefs for you' : 'New briefs for you'}</h2>
              {briefs.length > 0 && <button type="button" className="ap-link" style={{ minHeight: 44 }} onClick={() => navigate('/browse-briefs')}>See all {briefs.length}</button>}
            </div>
            {!isNewCreator && briefs.length > 1 && (
              <div className="ap-hm-seg" role="tablist">
                <button type="button" role="tab" aria-selected={briefTab === 'match'} className={`ap-chip${briefTab === 'match' ? ' is-on' : ''}`} style={{ minHeight: 44 }} onClick={() => setBriefTab('match')}>Best match</button>
                <button type="button" role="tab" aria-selected={briefTab === 'closing'} className={`ap-chip${briefTab === 'closing' ? ' is-on' : ''}`} style={{ minHeight: 44 }} onClick={() => setBriefTab('closing')}>Closing soon</button>
              </div>
            )}
            {briefs.length ? <div className="ap-hm-list">{briefCards}</div> : (
              <div className="ap-empty ap-card">
                <h3>No open briefs right now</h3>
                <p>New briefs show up here as brands post them.</p>
                <button type="button" className="ap-btn ap-btn--ghost" onClick={() => navigate('/browse-briefs')}>Find briefs</button>
              </div>
            )}
          </>
        )}
      </div>

      <BottomSheet
        open={!loading && nudge.left.length > 0 && !nudgeLater}
        onClose={() => { try { sessionStorage.setItem('profileNudgeLater', '1'); } catch { /* private mode */ } setNudgeLater(true); }}
        title="Complete your profile"
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={() => { try { sessionStorage.setItem('profileNudgeLater', '1'); } catch { /* private mode */ } setNudgeLater(true); }}>Later</button>
            <button type="button" className="ap-btn" style={{ flex: 1 }} onClick={() => navigate(nudge.to)}>Complete now</button>
          </>
        )}
      >
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: '#3a3a6a' }}>Add your {nudge.text} to finish setting up. Brands check these first before sending you deals.</p>
      </BottomSheet>
    </AppShell>
  );
}
