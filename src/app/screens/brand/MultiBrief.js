import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { apiErrorMessage } from '../../../utils/apiError';
import { creatorFirstName } from '../../../utils/displayName';
import { creatorRateFromProfile } from '../../../utils/creatorRate';
import { useSavedCreatorIds, loadSavedCreators, isSavedCreatorsLoaded } from '../../../utils/savedCreators';
import { API, Avatar, assetUrl, money } from './workShared';
import './work.css';

const DEFAULT_FEE_PERCENT = 20;   // same fallback PlanBrief uses until the live rate loads
const DEFAULT_SLOT = '17:00 - 23:00';
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const LEVELS = { new: 'New', verified: 'Verified', l1: 'Level 1', l2: 'Level 2', elite: 'Elite' };
const levelLabel = (c) => (c?.ugcad_approved ? 'UGCAD.IO Choice' : (LEVELS[String(c?.level || '').toLowerCase()] || 'New'));

const itemOf = (campaign) => (Array.isArray(campaign?.deliverable_items) && campaign.deliverable_items[0]) || {};
const qtyOf = (campaign) => Math.max(1, Number(itemOf(campaign).quantity) || 1);
const editsByCreator = (campaign) => {
  const it = itemOf(campaign);
  return !!it.edited_required && (it.edited_by || 'creator') === 'creator';
};

// What the brief needs before it can go out (mirrors src/pages/BrandMultiBrief.js, same four fields PlanBrief requires).
export const missingBriefFields = (c) => [
  !String(c?.product_name || '').trim() && 'product name',
  String(c?.product_description || '').trim().length < 10 && 'product description',
  !String(c?.campaign_hook || '').trim() && 'hook',
  !String(c?.key_message || '').trim() && 'key message',
].filter(Boolean);

// Fields copied as they are from the chosen campaign into each private brief (mirrors the website page).
const COPIED = [
  'product_name', 'product_type', 'product_type_detail', 'category', 'product_category', 'product_description',
  'campaign_hook', 'key_message', 'video_format', 'aspect_ratio', 'duration_seconds',
  'creator_level', 'content_quality_tier', 'gender_preference', 'city_filter', 'script_provider', 'script_text',
  'target_audience', 'product_visible', 'product_visible_seconds', 'call_to_action', 'cta_link', 'hashtags',
  'brand_handle_tag', 'no_competitors', 'competitors_text', 'no_other_products', 'no_profanity', 'avoid_text',
  'usage_platforms', 'rights_duration', 'exclusivity', 'revision_limit', 'free_revisions',
  'requires_shipment', 'shipment_option',
];

// One private brief for one creator: the SAME request PlanBrief sends (POST /api/campaigns, pending_approval,
// visibility private, selected_creator), content from the chosen campaign, price from that creator's own rate.
export function buildPrivateBrief(campaign, creatorId, rate, deliverBy) {
  const item = itemOf(campaign);
  const qty = qtyOf(campaign);
  const editing = editsByCreator(campaign) ? (rate.editing || 0) : 0;
  const perVideo = (rate.price || 0) + editing;
  const aspect = campaign.aspect_ratio || (item.aspect_ratios && item.aspect_ratios[0]) || '9:16';
  const slot = campaign.delivery_slot || DEFAULT_SLOT;
  const payload = {};
  COPIED.forEach((k) => { if (campaign[k] !== undefined && campaign[k] !== null) payload[k] = campaign[k]; });
  const lines = [`Plan: ₹${rate.price}/video`, `Videos: ${qty}`, `Delivery: ${deliverBy}, ${slot}`];
  if (campaign.brief_text) lines.push('', campaign.brief_text);
  return {
    ...payload,
    title: campaign.title || campaign.product_name || 'Private brief',
    status: 'pending_approval',
    selected_creator: creatorId,
    visibility: 'private',
    brief_text: lines.join('\n'),
    deliverable_items: [{
      type: item.type || 'Reel', quantity: qty, duration: item.duration || '30 Sec', aspect_ratios: item.aspect_ratios || [aspect],
      raw_required: item.raw_required !== undefined ? item.raw_required : true,
      edited_required: !!item.edited_required, edited_by: item.edited_by || 'creator',
    }],
    budget_min: perVideo,
    budget_max: perVideo,
    per_video_budget: perVideo,
    editing_fee_per_video: editing,
    raw_payout_per_video: rate.price || 0,
    due_date: deliverBy,
    deadline: deliverBy,
    delivery_slot: slot,
  };
}

export default function BrandMultiBriefApp() {
  const navigate = useNavigate();
  const savedIds = useSavedCreatorIds();
  const saved = useMemo(() => [...savedIds].reverse(), [savedIds]);   // newest save first
  const [savedState, setSavedState] = useState(isSavedCreatorsLoaded() ? 'ok' : 'loading');

  const [dir, setDir] = useState({});
  const [rates, setRates] = useState({});
  const [campaigns, setCampaigns] = useState(null);
  const [campaignsFailed, setCampaignsFailed] = useState(false);
  const [campaignId, setCampaignId] = useState('');
  const [deliverBy, setDeliverBy] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [sentIds, setSentIds] = useState(() => new Set());
  const [feePercent, setFeePercent] = useState(DEFAULT_FEE_PERCENT);
  const [wallet, setWallet] = useState(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);   // a second tap while requests are in flight must never start another round
  const [failures, setFailures] = useState([]);

  const loadSaved = () => { setSavedState('loading'); loadSavedCreators().then(() => setSavedState(isSavedCreatorsLoaded() ? 'ok' : 'failed')); };
  useEffect(() => { loadSaved(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const loadCampaigns = () => {
    setCampaigns(null);
    axios.get(`${API}/campaigns`)
      .then((res) => { setCampaigns(Array.isArray(res.data) ? res.data : []); setCampaignsFailed(false); })
      .catch(() => { setCampaigns([]); setCampaignsFailed(true); });
  };
  useEffect(() => {
    let alive = true;
    axios.get(`${API}/business/creator-directory`)
      .then((res) => {
        if (!alive) return;
        const list = Array.isArray(res.data) ? res.data : (res.data?.creators || []);
        const map = {};
        list.forEach((c) => { if (c?.id) map[c.id] = c; });
        setDir(map);
      }).catch(() => { /* rows fall back to a bare "Creator" */ });
    axios.get(`${API}/business/settings/billing`)
      .then((res) => { const r = Number(res.data?.commission_rate); if (alive && Number.isFinite(r) && r > 0) setFeePercent(r); })
      .catch(() => { /* keep the default */ });
    axios.get(`${API}/business/wallet`)
      .then((res) => { if (alive) setWallet(Number(res.data?.available_balance) || 0); })
      .catch(() => { if (alive) setWallet(null); });
    loadCampaigns();
    return () => { alive = false; };
  }, []);

  // Each saved creator's own price, fetched once (same source PlanBrief reads).
  useEffect(() => {
    saved.filter((id) => !rates[id]).forEach((id) => {
      setRates((r) => (r[id] ? r : { ...r, [id]: { loading: true } }));
      axios.get(`${API}/profile/${id}`)
        .then((res) => setRates((r) => ({ ...r, [id]: creatorRateFromProfile(res.data) })))
        .catch(() => setRates((r) => ({ ...r, [id]: { failed: true } })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const openCampaigns = useMemo(
    () => (campaigns || []).filter((c) => c?.id && c.status === 'active' && c.visibility !== 'private'),
    [campaigns],
  );
  const campaign = openCampaigns.find((c) => c.id === campaignId) || null;
  const missing = campaign ? missingBriefFields(campaign) : [];
  const qty = campaign ? qtyOf(campaign) : 1;

  const pickCampaign = (id) => {
    setCampaignId(id);
    const c = openCampaigns.find((x) => x.id === id);
    const d = String(c?.due_date || c?.deadline || '').slice(0, 10);
    setDeliverBy(d && d >= isoDay(new Date()) ? d : '');
  };

  const rateOf = (id) => rates[id] || {};
  const priced = (id) => (rateOf(id).price || 0) > 0;
  const selectable = (id) => priced(id) && !sentIds.has(id);
  const nameOf = (id) => (dir[id] ? creatorFirstName(dir[id]) : 'Creator');
  const chosen = saved.filter((id) => selected.has(id) && selectable(id));

  const toggle = (id) => {
    if (!selectable(id)) return;
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const allOn = saved.filter(selectable).length > 0 && saved.filter(selectable).every((id) => selected.has(id));
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(saved.filter(selectable)));

  // Each creator's price (+ their editing fee when the campaign has them edit) x videos, plus the platform fee.
  const costOf = (id) => {
    const r = rateOf(id);
    const sub = ((r.price || 0) + (editsByCreator(campaign) ? (r.editing || 0) : 0)) * qty;
    return Math.round((sub + Math.round(sub * (feePercent / 100) * 100) / 100) * 100) / 100;
  };
  const total = chosen.reduce((a, id) => a + costOf(id), 0);
  const short = wallet !== null && total > wallet;
  const canSend = !sending && chosen.length > 0 && !!campaign && missing.length === 0 && !!deliverBy;

  const send = async () => {
    if (sendingRef.current || !canSend) return;
    sendingRef.current = true;
    setSending(true);
    setFailures([]);
    const ids = [...chosen];
    const done = [];
    const failed = [];
    let blocked = false;
    for (const id of ids) {
      if (blocked) { failed.push({ id, name: nameOf(id), msg: 'not sent (wallet too low)' }); continue; }
      try {
        await axios.post(`${API}/campaigns`, buildPrivateBrief(campaign, id, rateOf(id), deliverBy));
        done.push(id);
        setSentIds((s) => new Set(s).add(id));
        setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
      } catch (e) {
        // A short wallet fails every remaining brief the same way, so stop instead of hammering the API.
        if (e?.response?.status === 402) blocked = true;
        failed.push({ id, name: nameOf(id), msg: e?.response ? apiErrorMessage(e, 'could not be sent') : "you're offline - try again" });
      }
    }
    setFailures(failed);
    sendingRef.current = false;
    setSending(false);
    if (done.length) {
      axios.get(`${API}/business/wallet`).then((res) => setWallet(Number(res.data?.available_balance) || 0)).catch(() => {});
    }
    if (!failed.length) {
      toast.success(`Brief sent for review to ${done.length} creator${done.length === 1 ? '' : 's'}. Once our team approves it, each creator can accept or decline.`);
    } else if (done.length) {
      toast.error(`Sent to ${done.length} of ${ids.length}. Not sent: ${failed.map((f) => `${f.name} (${f.msg})`).join('; ')}`);
    } else {
      toast.error(`No briefs were sent. ${failed.map((f) => `${f.name}: ${f.msg}`).join('; ')}`);
    }
  };

  const n = chosen.length;
  const unpricedLeft = saved.some((id) => rates[id] && !rates[id].loading && !(rates[id].price > 0) && !sentIds.has(id));

  return (
    <AppShell title="Brief several creators" subtitle="Everyone gets the same brief, each replies separately" back="/dashboard/business/saved-creators" tabs={false}>
      <div className="ap-wk">
        {savedState === 'loading' ? (
          <>
            <div className="ap-skel" style={{ height: 90, borderRadius: 20 }} aria-hidden="true" />
            <div className="ap-skel" style={{ height: 200, borderRadius: 20 }} aria-hidden="true" />
          </>
        ) : savedState === 'failed' ? (
          <div className="ap-card ap-empty" role="alert">
            <h3>Couldn't load your saved creators</h3>
            <p>Check your connection and try again.</p>
            <button type="button" className="ap-btn" onClick={loadSaved}>Try again</button>
          </div>
        ) : saved.length === 0 ? (
          <div className="ap-card ap-empty">
            <h3>No saved creators yet</h3>
            <p>Tap the heart on any creator card or profile to save them, then brief them together here.</p>
            <button type="button" className="ap-btn" onClick={() => navigate('/dashboard/business/browse-creator')}>Browse creators</button>
          </div>
        ) : (
          <>
            <div className="ap-card">
              <label className="ap-wk-field" style={{ marginTop: 0 }}>
                Which campaign is this brief about?
                <select className="ap-input" value={campaignId} onChange={(e) => pickCampaign(e.target.value)} disabled={campaigns === null}>
                  <option value="">{campaigns === null ? 'Loading campaigns…' : 'Choose a campaign'}</option>
                  {openCampaigns.map((c) => <option key={c.id} value={c.id}>{c.title || c.product_name || 'Untitled campaign'}</option>)}
                </select>
              </label>
              {campaigns !== null && openCampaigns.length === 0 && (
                <p className="ap-wk-sub" style={{ marginTop: 10 }}>
                  {campaignsFailed
                    ? <>Couldn't load your campaigns. <button type="button" className="ap-link" onClick={loadCampaigns}>Try again</button></>
                    : <>You have no open campaigns yet. <button type="button" className="ap-link" onClick={() => navigate('/dashboard/business/post-brief')}>Post a campaign</button> first, then brief your saved creators about it.</>}
                </p>
              )}
              {campaign && missing.length > 0 && (
                <div className="ap-wk-warn" role="alert"><span>This campaign has no {missing.join(', ')}, so it can’t be sent as a brief yet.</span></div>
              )}
              {campaign && (
                <label className="ap-wk-field">Deliver by
                  <input type="date" className="ap-input" value={deliverBy} min={isoDay(new Date())} onChange={(e) => setDeliverBy(e.target.value)} />
                </label>
              )}
            </div>

            <div className="ap-sec-h">
              <h2>{n} of {saved.length} picked</h2>
              <button type="button" className="ap-link" style={{ minHeight: 44 }} onClick={toggleAll}>{allOn ? 'Clear all' : 'Select all'}</button>
            </div>
            <div className="ap-card ap-wk-mb-pick" role="group" aria-label="Saved creators">
              {saved.map((id) => {
                const c = dir[id] || {};
                const r = rateOf(id);
                const on = selected.has(id) && selectable(id);
                const sent = sentIds.has(id);
                const nm = nameOf(id);
                return (
                  <button key={id} type="button" role="checkbox" aria-checked={on} disabled={!selectable(id)} className={`ap-wk-mb-row${on ? ' is-on' : ''}`} onClick={() => toggle(id)}>
                    <span className="ap-wk-mb-box">{on && <Check size={15} strokeWidth={3} />}</span>
                    <Avatar name={nm} src={assetUrl(c.profile_photo)} size={44} />
                    <span className="ap-wk-mb-who"><b>{nm}</b><small>{levelLabel(c)}</small></span>
                    <span className="ap-wk-mb-price">
                      {sent ? <em className="ap-wk-mb-sent">Sent</em>
                        : r.loading || !rates[id] ? <small>Loading…</small>
                          : r.price > 0 ? <>{money(r.price)}<small>/ video</small></>
                            : <small>{r.failed ? "Couldn't load rate" : 'Rate on request'}</small>}
                    </span>
                  </button>
                );
              })}
            </div>
            {unpricedLeft && <p className="ap-wk-sub">Creators without a published rate can’t be briefed here. Message them to agree on a price first.</p>}

            <div className="ap-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="ap-wk-mb-line">
                <span>{campaign ? `${qty} video${qty === 1 ? '' : 's'} each · held on your wallet` : 'Held on your wallet'}</span>
                <strong>{money(total)}</strong>
              </div>
              <p className="ap-wk-sub" style={{ margin: 0 }}>Each creator’s own price, plus the {feePercent}% platform fee. Our team reviews every brief before the creator sees it.</p>
              {wallet !== null && n > 0 && (short
                ? <div className="ap-wk-mb-wallet ap-wk-mb-wallet--short" role="status">Wallet {money(wallet)} - short by {money(total - wallet)}. <a href="/dashboard/business/wallet" onClick={(e) => { e.preventDefault(); navigate('/dashboard/business/wallet'); }}>Add funds</a></div>
                : <div className="ap-wk-mb-wallet" role="status"><Check size={15} /> Wallet {money(wallet)} - enough for these briefs</div>)}
              {failures.length > 0 && (
                <div className="ap-wk-warn ap-wk-fail" role="alert" style={{ marginTop: 0, display: 'block' }}>
                  Not sent:
                  <ul>{failures.map((f) => <li key={f.id}>{f.name}: {f.msg}</li>)}</ul>
                  They stay ticked, so you can try again.
                </div>
              )}
            </div>

            <div className="ap-wk-mb-bar">
              <button type="button" className="ap-btn ap-btn--block" style={{ height: 54, fontSize: 16, background: 'var(--ap-grad)' }} disabled={!canSend} onClick={send}>
                {sending ? 'Sending…' : `Send brief to ${n} creator${n === 1 ? '' : 's'}`}
              </button>
              <div className="ap-wk-sub" style={{ textAlign: 'center', marginTop: 8 }}>
                {!campaign ? 'Choose a campaign to brief about' : !deliverBy ? 'Pick a delivery date' : n === 0 ? 'Tick at least one creator' : 'Our team reviews every brief before creators see it'}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
