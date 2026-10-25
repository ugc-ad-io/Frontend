import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, X, SlidersHorizontal, SearchX, Bookmark, Play, WifiOff, AlertCircle } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import withBrandGate from '../../brandkit/withBrandGate';
import BottomSheet from '../../shell/BottomSheet';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { matchesCreatorSearch } from '../../../utils/creatorSearch';
import { toggleSavedCreator, useSavedCreatorIds } from '../../../utils/savedCreators';
import PhotoOrInitial from '../../../components/PhotoOrInitial';
import ReelCard from '../../brandkit/ReelCard';
import VideoViewer from '../../brandkit/VideoViewer';
import WalletChip, { useWalletBalance } from '../../brandkit/WalletChip';
import {
  API, CATEGORIES, BUDGET_OPTIONS, DETAIL_OPTIONS, assetUrl, creatorListFrom, loadErrorText, catsOf, catOf, matchesCategory,
  budgetOf, deliveryDaysOf, titleCase, nameOf, initialOf, inr, pfUrl, isVideo, playable, creatorVideoUrl, videoPoster,
  previewVideoUrl, browserCompatibleVideoUrl,
} from '../../brandkit/kit';
import './creators.css';

const PAGE = 20;

// Quick preview: a peek at a creator before opening the full profile (same facts as the website's QuickPreview card).
function Preview({ c, onClose, onMessage, onFull, onPlay }) {
  const name = nameOf(c);
  const saved = useSavedCreatorIds().has(String(c.id));
  const rating = c.avg_rating || c.rating;
  const clips = [...new Set((Array.isArray(c.portfolio) ? c.portfolio : []).map(pfUrl).filter((u) => u && (isVideo(u) || playable(u))))];
  const main = creatorVideoUrl(c);
  const all = (clips.length ? clips : (main ? [main] : [])).slice(0, 6);
  const cats = catsOf(c).map((v) => titleCase(v));
  const toggle = async () => {
    const now = await toggleSavedCreator({ id: c.id });
    toast.success(now ? 'Creator saved to your list' : 'Removed from saved');
  };
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={name}
      footer={(
        <>
          <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={onMessage}>Message</button>
          <button type="button" className="ap-btn" style={{ flex: 1 }} onClick={onFull}>View full profile</button>
        </>
      )}
    >
      <div className="ap-cr-pv-head">
        <span className="ap-cr-pv-ava"><PhotoOrInitial src={assetUrl(c.profile_photo)} initial={initialOf(c)} /></span>
        <div className="ap-chips">{(cats.length ? cats : [titleCase(catOf(c))]).map((t) => <span key={t} className="ap-pill">{t}</span>)}</div>
        <button type="button" className={`ap-cr-pv-save${saved ? ' is-on' : ''}`} onClick={toggle} aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`} aria-pressed={saved}>
          <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      {(c.bio || c.description) && <p className="ap-cr-pv-bio">{c.bio || c.description}</p>}
      <div className="ap-cr-pv-facts">
        <div><small>Price</small><b>{budgetOf(c) ? `${inr(budgetOf(c))} / video` : 'Rate on request'}</b></div>
        <div><small>Rating</small><b>{rating ? `★ ${Number(rating).toFixed(1)}` : 'New'}</b></div>
        <div><small>Deliverables</small><b>{c.deliverables_completed || 0}</b></div>
        <div><small>Location</small><b>{c.city_tier || c.location_region || 'India'}</b></div>
      </div>
      {all.length > 0 && (
        <>
          <div className="ap-cr-pv-work">Recent work</div>
          <div className="ap-cr-pv-thumbs">
            {all.map((u) => {
              const poster = videoPoster(u);
              return (
                <button key={u} type="button" className="ap-cr-pv-thumb" aria-label="Play video" onClick={() => onPlay({ src: browserCompatibleVideoUrl(u), name })}>
                  {poster ? <img src={poster} alt="" loading="lazy" /> : <video src={`${previewVideoUrl(u)}#t=0.5`} muted playsInline preload="metadata" />}
                  <span><Play size={14} fill="currentColor" /></span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </BottomSheet>
  );
}

function BrandAppCreators() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const balance = useWalletBalance();
  const approvedMode = searchParams.get('collection') === 'ugcad-approved';
  const categoryLabel = searchParams.get('category') || '';
  const urlQ = searchParams.get('q') || '';

  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [q, setQ] = useState(urlQ);
  const [sheet, setSheet] = useState(false);
  const [preview, setPreview] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [limit, setLimit] = useState(PAGE);
  const [fStyle, setFStyle] = useState('any');
  const [fDetails, setFDetails] = useState('any');
  const [fBudget, setFBudget] = useState('any');
  const [fLang, setFLang] = useState('any');
  const [fElite, setFElite] = useState(false);
  const [fVerified, setFVerified] = useState(false);
  const [fFast, setFFast] = useState(false);
  const tabsRef = useRef(null);

  useLiveEffect(() => {
    let active = true;
    (async () => {
      if (active) { setLoading(true); setLoadError(''); }
      try {
        // `discovery_only` marks this as the read/message discovery surface (pending-review brands may use it).
        const res = await axios.get(`${API}/business/creator-directory`, { params: { discovery_only: true } });
        if (active) setCreators(creatorListFrom(res.data));
      } catch (err) {
        if (active) { setCreators([]); setLoadError(loadErrorText(err, 'Creator profiles could not be loaded. Please try again.')); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => { setQ(urlQ); }, [urlQ]);
  useEffect(() => {
    tabsRef.current?.querySelector('.is-on')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [categoryLabel, approvedMode]);

  const hasDelivery = useMemo(() => creators.some((c) => deliveryDaysOf(c)), [creators]);
  const styleOptions = useMemo(() => [
    { key: 'any', label: 'Any' },
    ...Array.from(new Set(creators.map((c) => c.content_style).filter(Boolean))).map((s) => ({ key: s, label: titleCase(s) })),
  ], [creators]);
  const langOptions = useMemo(() => [
    { key: 'any', label: 'Any' },
    ...Array.from(new Set(creators.flatMap((c) => c.languages || []).filter(Boolean))).map((l) => ({ key: l, label: titleCase(l) })),
  ], [creators]);
  const GROUPS = [
    { id: 'style', label: 'Content style', options: styleOptions, value: fStyle, set: setFStyle },
    { id: 'details', label: 'Creator details', options: DETAIL_OPTIONS, value: fDetails, set: setFDetails },
    { id: 'budget', label: 'Budget per video', options: BUDGET_OPTIONS, value: fBudget, set: setFBudget },
    { id: 'language', label: 'Language', options: langOptions, value: fLang, set: setFLang },
  ];

  const filtered = useMemo(() => creators.filter((c) => {
    if (approvedMode && !c.ugcad_approved) return false;
    const cats = catsOf(c);
    if (!approvedMode && categoryLabel && !matchesCategory(cats, categoryLabel)) return false;
    if (!matchesCreatorSearch(c, q, cats)) return false;
    if (fStyle !== 'any' && c.content_style !== fStyle) return false;
    if (fLang !== 'any' && !(c.languages || []).includes(fLang)) return false;
    if (!BUDGET_OPTIONS.find((o) => o.key === fBudget).test(budgetOf(c))) return false;
    if (!DETAIL_OPTIONS.find((o) => o.key === fDetails).test(c)) return false;
    if (fElite && String(c.level).toLowerCase() !== 'elite') return false;
    if (fVerified && !c.kyc_verified) return false;
    if (fFast && !(deliveryDaysOf(c) > 0 && deliveryDaysOf(c) <= 3)) return false;
    return true;
  }), [creators, categoryLabel, q, approvedMode, fStyle, fLang, fBudget, fDetails, fElite, fVerified, fFast]);

  useEffect(() => { setLimit(PAGE); }, [categoryLabel, q, approvedMode, fStyle, fLang, fBudget, fDetails, fElite, fVerified, fFast]);

  // Active filters as removable chips (and the badge on the filter button).
  const active = [
    ...GROUPS.filter((g) => g.value !== 'any').map((g) => ({ key: g.id, label: g.options.find((o) => o.key === g.value)?.label || g.value, clear: () => g.set('any') })),
    ...(fElite ? [{ key: 'elite', label: 'Elite', clear: () => setFElite(false) }] : []),
    ...(fVerified ? [{ key: 'ver', label: 'ID verified', clear: () => setFVerified(false) }] : []),
    ...(fFast ? [{ key: 'fast', label: '≤ 3 days', clear: () => setFFast(false) }] : []),
  ];
  const clearFilters = () => active.forEach((a) => a.clear());

  const noResultCats = useMemo(() => {
    const m = new Map();
    creators.forEach((c) => new Set(catsOf(c)).forEach((k) => m.set(k, (m.get(k) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => titleCase(k));
  }, [creators]);
  const similar = useMemo(() => [...creators]
    .sort((a, b) => (Number(!!b.ugcad_approved) - Number(!!a.ugcad_approved)) || (Number(b.avg_rating || 0) - Number(a.avg_rating || 0)))
    .slice(0, 5), [creators]);

  const setParams = (mut) => {
    const p = new URLSearchParams(searchParams);
    mut(p);
    setSearchParams(p, { replace: true });
  };
  const submitSearch = (e) => {
    e?.preventDefault();
    setParams((p) => { if (q.trim()) p.set('q', q.trim()); else p.delete('q'); });
    document.activeElement?.blur?.();
  };
  const clearSearch = () => { setQ(''); setParams((p) => p.delete('q')); };
  const pickCategory = (label) => setSearchParams(label ? { category: label } : {}, { replace: true });
  const togglePreferred = (on) => setParams((p) => { if (on) p.set('collection', 'ugcad-approved'); else p.delete('collection'); });

  const view = (c) => setPreview(c);
  const profile = (c) => navigate(`/dashboard/business/creator/${c.id}`);
  const cardProps = { onView: view, onInvite: profile, onPlay: setViewer };
  const offline = loadError.startsWith("You're offline");
  const searching = q.trim().length > 0;

  return (
    <AppShell title="Creators" right={<WalletChip balance={balance} />}>
      <form className={`ap-cr-search${searching ? ' is-on' : ''}`} onSubmit={submitSearch} role="search">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          enterKeyHint="search"
          aria-label="Search creators"
          placeholder="Search creators or categories"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && <button type="button" className="ap-cr-x" aria-label="Clear search" onClick={clearSearch}><X size={18} /></button>}
        <button type="button" className="ap-cr-filter" aria-label={active.length ? `Filters, ${active.length} active` : 'Filters'} onClick={() => setSheet(true)}>
          <SlidersHorizontal size={18} />
          {active.length > 0 && <em>{active.length}</em>}
        </button>
      </form>

      <div className="ap-cr-tabs" ref={tabsRef} role="tablist" aria-label="Categories">
        {['All', ...CATEGORIES].map((label) => {
          const on = label === 'All' ? (!categoryLabel && !approvedMode) : (!approvedMode && categoryLabel.toLowerCase() === label.toLowerCase());
          return (
            <button key={label} type="button" role="tab" aria-selected={on} className={on ? 'is-on' : ''} onClick={() => pickCategory(label === 'All' ? '' : label)}>{label}</button>
          );
        })}
      </div>

      {approvedMode && (
        <section className="ap-cr-pref">
          <div>
            <h2>Preferred Creators by the UGCAD Team</h2>
            <p>Hand-picked by the UGCad team for your next campaign.</p>
          </div>
          <button type="button" className="ap-link" onClick={() => togglePreferred(false)}>Back to all creators</button>
        </section>
      )}

      {active.length > 0 && (
        <div className="ap-chips ap-cr-active">
          {active.map((a) => (
            <button key={a.key} type="button" className="ap-cr-ac" onClick={a.clear} aria-label={`Remove filter ${a.label}`}>{a.label}<X size={13} /></button>
          ))}
          <button type="button" className="ap-link" onClick={clearFilters}>Clear</button>
        </div>
      )}

      <div className="ap-cr-count">
        <span><strong>{loading ? '…' : filtered.length}</strong> creator{filtered.length === 1 ? '' : 's'}</span>
        {!approvedMode && <button type="button" className="ap-link" onClick={() => togglePreferred(true)}>Meet our Preferred Creators</button>}
      </div>

      {loading ? (
        <div className="ap-cr-grid" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="ap-skel ap-cr-sk" />)}
        </div>
      ) : loadError ? (
        <div className="ap-empty" role="alert">
          {offline ? <WifiOff size={30} color="#6e6e96" /> : <AlertCircle size={30} color="#e5484d" />}
          <h3>Could not load creators</h3>
          <p>{loadError}</p>
          <button type="button" className="ap-btn" onClick={() => setReloadKey((v) => v + 1)}>Try again</button>
        </div>
      ) : filtered.length === 0 && approvedMode ? (
        <div className="ap-empty">
          <h3>No preferred creators to show</h3>
          <p>{q ? 'None of the preferred creators match your search.' : 'The UGCAD team has not picked any preferred creators yet. Check back soon.'}</p>
          <button type="button" className="ap-btn" onClick={() => togglePreferred(false)}>Back to all creators</button>
        </div>
      ) : filtered.length === 0 ? (
        <>
          <section className="ap-cr-nr">
            <span className="ap-cr-nr-ic" aria-hidden="true"><SearchX size={38} strokeWidth={1.8} /></span>
            <h2>{searching ? `No creators for “${q.trim()}” yet` : 'No creators found'}</h2>
            <p>{searching
              ? 'Try a broader search, or post a campaign and let creators come to you.'
              : 'No creators match your current filters. Clear them, or post a campaign and let creators come to you.'}</p>
            {noResultCats.length > 0 && (
              <div className="ap-cr-nr-chips">
                {noResultCats.map((c) => <button key={c} type="button" className="ap-chip" onClick={() => { setQ(''); pickCategory(c); }}>{c}</button>)}
              </div>
            )}
            {(active.length > 0 || categoryLabel || searching) && (
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--block" onClick={() => { clearFilters(); setQ(''); setSearchParams({}, { replace: true }); }}>Clear search and filters</button>
            )}
            <button type="button" className="ap-btn ap-btn--block" onClick={() => navigate('/dashboard/business/post-brief')}>Post a campaign</button>
          </section>
          {similar.length > 0 && (
            <section>
              <div className="ap-cr-sh"><h2>Similar creators</h2></div>
              <div className="ap-cr-hscroll">
                {similar.map((c) => <div key={c.id} className="ap-cr-hs-item"><ReelCard c={c} {...cardProps} /></div>)}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <div className="ap-cr-grid">
            {filtered.slice(0, limit).map((c) => <ReelCard key={c.id} c={c} {...cardProps} />)}
          </div>
          {filtered.length > limit && (
            <button type="button" className="ap-btn ap-btn--ghost ap-btn--block" onClick={() => setLimit((n) => n + PAGE)}>
              Show more ({filtered.length - limit} left)
            </button>
          )}
        </>
      )}

      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filters"
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={() => { clearFilters(); }}>Clear</button>
            <button type="button" className="ap-btn" style={{ flex: 2 }} onClick={() => setSheet(false)}>Show {filtered.length} creator{filtered.length === 1 ? '' : 's'}</button>
          </>
        )}
      >
        {GROUPS.map((g) => (
          <fieldset key={g.id} className="ap-cr-fs">
            <legend>{g.label}</legend>
            <div className="ap-cr-opts">
              {g.options.map((o) => (
                <button key={o.key} type="button" aria-pressed={g.value === o.key} className={`ap-cr-opt${g.value === o.key ? ' is-on' : ''}`} onClick={() => g.set(o.key)}>{o.label}</button>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset className="ap-cr-fs">
          <legend>Quick filters</legend>
          <div className="ap-cr-opts">
            <button type="button" aria-pressed={fElite} className={`ap-cr-opt${fElite ? ' is-on' : ''}`} onClick={() => setFElite((v) => !v)}>Elite creators</button>
            {hasDelivery ? (
              <button type="button" aria-pressed={fFast} className={`ap-cr-opt${fFast ? ' is-on' : ''}`} onClick={() => setFFast((v) => !v)}>Delivers in 3 days</button>
            ) : (
              <button type="button" aria-pressed={fVerified} className={`ap-cr-opt${fVerified ? ' is-on' : ''}`} onClick={() => setFVerified((v) => !v)}>ID verified</button>
            )}
          </div>
        </fieldset>
      </BottomSheet>

      {preview && (
        <Preview
          c={preview}
          onClose={() => setPreview(null)}
          onMessage={() => navigate(`/messages?conv=${preview.id}`)}
          onFull={() => navigate(`/dashboard/business/creator/${preview.id}`)}
          onPlay={setViewer}
        />
      )}
      {viewer && <VideoViewer items={[viewer]} onClose={() => setViewer(null)} />}
    </AppShell>
  );
}

export default withBrandGate(BrandAppCreators);
