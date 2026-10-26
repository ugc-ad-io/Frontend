import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Check, ChevronDown } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import BrandPageHead from '../components/BrandPageHead';
import PhotoOrInitial from '../components/PhotoOrInitial';
import { apiErrorMessage } from '../utils/apiError';
import { creatorFirstName } from '../utils/displayName';
import { creatorRateFromProfile } from '../utils/creatorRate';
import { useSavedCreatorIds, loadSavedCreators } from '../utils/savedCreators';
import '../styles/brand-ui-pages.css';
import '../styles/brand-ui-multibrief.css';
import BackButton from '../components/BackButton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const DEFAULT_FEE_PERCENT = 20;   // same fallback PlanBrief uses until the live rate loads
const DEFAULT_SLOT = '17:00 - 23:00';

const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const LEVELS = { new: 'New', verified: 'Verified', l1: 'Level 1', l2: 'Level 2', elite: 'Elite' };
const levelLabel = (c) => (c?.ugcad_approved ? 'UGCAD.IO Choice' : (LEVELS[String(c?.level || '').toLowerCase()] || 'New'));

// The first deliverable line of a campaign: how many videos each creator makes, and who edits.
const itemOf = (campaign) => (Array.isArray(campaign?.deliverable_items) && campaign.deliverable_items[0]) || {};
const qtyOf = (campaign) => Math.max(1, Number(itemOf(campaign).quantity) || 1);
const editsByCreator = (campaign) => {
  const it = itemOf(campaign);
  return !!it.edited_required && (it.edited_by || 'creator') === 'creator';
};

// What the brief needs before it can go out (same four fields PlanBrief requires).
export const missingBriefFields = (c) => [
  !String(c?.product_name || '').trim() && 'product name',
  String(c?.product_description || '').trim().length < 10 && 'product description',
  !String(c?.campaign_hook || '').trim() && 'hook',
  !String(c?.key_message || '').trim() && 'key message',
].filter(Boolean);

// Fields copied as they are from the chosen campaign into each private brief. Everything that
// is specific to ONE creator (selected_creator, visibility, status, price, delivery date) is set below.
const COPIED = [
  'product_name', 'product_type', 'product_type_detail', 'category', 'product_category', 'product_description',
  'campaign_hook', 'key_message', 'video_format', 'aspect_ratio', 'duration_seconds',
  'creator_level', 'content_quality_tier', 'gender_preference', 'city_filter', 'script_provider', 'script_text',
  'target_audience', 'product_visible', 'product_visible_seconds', 'call_to_action', 'cta_link', 'hashtags',
  'brand_handle_tag', 'no_competitors', 'competitors_text', 'no_other_products', 'no_profanity', 'avoid_text',
  'usage_platforms', 'rights_duration', 'exclusivity', 'revision_limit', 'free_revisions',
  'requires_shipment', 'shipment_option',
];

// One private brief for one creator: the SAME request PlanBrief sends (POST /api/campaigns,
// status pending_approval, visibility private, selected_creator), with the content taken from
// the chosen campaign and the price from that creator's own rate.
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

export default function BrandMultiBrief() {
  const navigate = useNavigate();
  const savedIds = useSavedCreatorIds();
  const saved = useMemo(() => [...savedIds].reverse(), [savedIds]);   // newest save first, like Saved creators

  const [dir, setDir] = useState({});          // { id: directory creator } for names, photos, levels
  const [rates, setRates] = useState({});      // { id: { price, editing } | { failed: true } } from each creator's profile
  const [campaigns, setCampaigns] = useState(null);   // null = loading
  const [campaignsFailed, setCampaignsFailed] = useState(false);
  const [campaignId, setCampaignId] = useState('');
  const [deliverBy, setDeliverBy] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [sentIds, setSentIds] = useState(() => new Set());
  const [feePercent, setFeePercent] = useState(DEFAULT_FEE_PERCENT);
  const [wallet, setWallet] = useState(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);   // a second click while requests are in flight must never start another round
  const [failures, setFailures] = useState([]);   // [{ id, name, msg }] from the last send

  useEffect(() => { loadSavedCreators(); }, []);

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
    axios.get(`${API}/campaigns`)
      .then((res) => { if (alive) { setCampaigns(Array.isArray(res.data) ? res.data : []); setCampaignsFailed(false); } })
      .catch(() => { if (alive) { setCampaigns([]); setCampaignsFailed(true); } });
    axios.get(`${API}/business/settings/billing`)
      .then((res) => { const r = Number(res.data?.commission_rate); if (alive && Number.isFinite(r) && r > 0) setFeePercent(r); })
      .catch(() => { /* keep the default */ });
    axios.get(`${API}/business/wallet`)
      .then((res) => { if (alive) setWallet(Number(res.data?.available_balance) || 0); })
      .catch(() => { if (alive) setWallet(null); });
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

  // Open campaigns the brand can brief creators about: live, and not themselves private briefs.
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
    // Start from the campaign's own deadline when it is still ahead; otherwise the brand picks one.
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

  // What each creator costs: their price (+ their editing fee when the campaign has them edit) x videos,
  // plus the platform fee. Same maths as PlanBrief's escrow card.
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
    const ids = [...chosen];   // snapshot: what was ticked when the button was pressed
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
        failed.push({ id, name: nameOf(id), msg: apiErrorMessage(e, 'could not be sent') });
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
  return (
    <BrandTopNavLayout>
      <div className="bui-main bui-main--tight">
        <BackButton fallback="/dashboard/business/saved-creators" />
        <BrandPageHead title="Brief to several creators" subtitle="Pick saved creators and send them all the same brief. Each one replies separately." />

        {saved.length === 0 ? (
          <div className="bui-empty">
            <h3>No saved creators yet</h3>
            <p>Tap the heart on any creator card or profile to save them, then brief them together here.</p>
            <button type="button" className="bui-btn" onClick={() => navigate('/dashboard/business/browse-creator')}>Browse creators</button>
          </div>
        ) : (
          <div className="bui-mb-grid">
            <section className="bui-mb-list" aria-label="Saved creators">
              <div className="bui-mb-listhead">
                <strong>Saved creators · {saved.length}</strong>
                <button type="button" className="bui-mb-link" onClick={toggleAll}>{allOn ? 'Clear all' : 'Select all'}</button>
              </div>
              {saved.map((id) => {
                const c = dir[id] || {};
                const r = rateOf(id);
                const on = selected.has(id) && selectable(id);
                const sent = sentIds.has(id);
                const nm = nameOf(id);
                return (
                  <button key={id} type="button" role="checkbox" aria-checked={on} disabled={!selectable(id)}
                    className={`bui-mb-row${on ? ' is-on' : ''}`} onClick={() => toggle(id)}>
                    <span className="bui-mb-box">{on && <Check size={15} strokeWidth={3} />}</span>
                    <span className="bui-mb-ava"><PhotoOrInitial src={assetUrl(c.profile_photo)} initial={(nm.charAt(0) || 'C').toUpperCase()} /></span>
                    <span className="bui-mb-who">
                      <b>{nm}</b>
                      <small>{levelLabel(c)}</small>
                    </span>
                    <span className="bui-mb-price">
                      {sent ? <em className="bui-mb-sent">Sent</em>
                        : r.loading || !rates[id] ? <small>Loading…</small>
                        : r.price > 0 ? <>{money(r.price)}<small> / video</small></>
                        : <small>Rate on request</small>}
                    </span>
                  </button>
                );
              })}
              {saved.some((id) => rates[id] && !rates[id].loading && !(rates[id].price > 0) && !sentIds.has(id)) && (
                <p className="bui-mb-note">Creators without a published rate can't be briefed here. Message them to agree on a price first.</p>
              )}
            </section>

            <aside className="bui-mb-side" aria-label="Brief summary">
              <div className="bui-mb-top">
                <small>Sending to</small>
                <b>{n} creator{n === 1 ? '' : 's'}</b>
              </div>
              <div className="bui-mb-body">
                <label className="bui-mb-field">
                  <span>Brief</span>
                  <span className="bui-mb-sel">
                    <select value={campaignId} onChange={(e) => pickCampaign(e.target.value)} disabled={campaigns === null}>
                      <option value="">{campaigns === null ? 'Loading campaigns…' : 'Choose a campaign'}</option>
                      {openCampaigns.map((c) => <option key={c.id} value={c.id}>{c.title || c.product_name || 'Untitled campaign'}</option>)}
                    </select>
                    <ChevronDown size={16} />
                  </span>
                </label>
                {campaigns !== null && openCampaigns.length === 0 && (
                  <p className="bui-mb-fine">
                    {campaignsFailed ? "Couldn't load your campaigns. Refresh and try again." : 'You have no open campaigns yet. Post a campaign first, then brief your saved creators about it.'}
                  </p>
                )}
                {campaign && missing.length > 0 && (
                  <p className="bui-mb-warn" role="alert">This campaign has no {missing.join(', ')}, so it can't be sent as a brief yet.</p>
                )}
                {campaign && (
                  <label className="bui-mb-field">
                    <span>Deliver by</span>
                    <input type="date" value={deliverBy} min={isoDay(new Date())} onChange={(e) => setDeliverBy(e.target.value)} />
                  </label>
                )}
                <div className="bui-mb-line">
                  <span>{campaign ? `${qty} video${qty === 1 ? '' : 's'} each · held on your wallet` : 'Held on your wallet'}</span>
                  <strong>{money(total)}</strong>
                </div>
                <p className="bui-mb-fine">Each creator's own price, plus the {feePercent}% platform fee. Our team reviews every brief before the creator sees it.</p>
                {wallet !== null && n > 0 && (
                  short
                    ? <div className="bui-mb-wallet bui-mb-wallet--short" role="status">Wallet {money(wallet)} - short by {money(total - wallet)}. <a href="/dashboard/business/wallet" onClick={(e) => { e.preventDefault(); navigate('/dashboard/business/wallet'); }}>Add funds</a></div>
                    : <div className="bui-mb-wallet" role="status"><Check size={15} /> Wallet {money(wallet)} - enough for these briefs</div>
                )}
                <button type="button" className="bui-mb-send" disabled={!canSend} onClick={send}>
                  {sending ? 'Sending…' : `Send brief to ${n}`}
                </button>
                {failures.length > 0 && (
                  <div className="bui-mb-warn" role="alert">
                    Not sent:
                    <ul>{failures.map((f) => <li key={f.id}>{f.name}: {f.msg}</li>)}</ul>
                    They stay ticked, so you can try again.
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </BrandTopNavLayout>
  );
}
