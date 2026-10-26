import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertTriangle, Check, Info, Package } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { apiErrorMessage } from '../../../utils/apiError';
import { ownsCampaign } from '../../../utils/brandWorkspace';
import { selectedCreators } from '../../../utils/campaignCreators';
import { API, Avatar, LoadError, Skeletons, assetUrl, firstWord, loadErrorText } from './workShared';
import './work.css';

const TABS = [['all', 'All'], ['pending', 'To ship'], ['transit', 'In transit'], ['delivered', 'Delivered']];
const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const statusOf = (s) => {
  const raw = String(s?.status || '').toLowerCase();
  if (['delivered', 'received'].includes(raw)) return 'delivered';
  if (['in_transit', 'shipped'].includes(raw)) return 'transit';
  return 'pending';
};
// A stale / empty shipment doc still needs shipping; only a label, tracking or a moving status counts as real.
const hasRealShipment = (s) => !!s && (
  !!s.requested || !!s.tracking_number || !!s.label_url
  || ['requested', 'awaiting_pickup', 'label_generated', 'shipped', 'in_transit', 'delivered', 'received'].includes(String(s.status || '').toLowerCase())
);
const awaitingLabel = (s) => String(s?.status || '').toLowerCase() === 'requested' && !s?.label_url && !s?.tracking_number;

// Resolve a 6-digit Indian PIN to { city, state } via India Post so City/State always match the Pincode.
const lookupPincode = async (pin) => {
  try {
    const json = await (await fetch(`https://api.postalpincode.in/pincode/${pin}`)).json();
    const office = json?.[0]?.PostOffice?.[0];
    return office ? { city: office.District || '', state: office.State || '' } : null;
  } catch { return null; }
};

const EMPTY_SHIP = { description: '', weight: '', length: '', width: '', height: '', full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

function ShipSheet({ row, onClose, onDone }) {
  const [form, setForm] = useState(EMPTY_SHIP);
  const [fromAccount, setFromAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/shipping/account-address`).then(({ data }) => {
      const a = data?.address;
      if (!alive || !a) return;
      setForm((f) => (f.line1 || f.pincode ? f : { ...f, full_name: a.full_name || '', phone: a.phone || '', line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', pincode: a.pincode || '' }));
      setFromAccount(true);
    }).catch(() => { /* no saved address - the brand types it */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const pin = String(form.pincode || '').replace(/\D/g, '');
    if (pin.length !== 6) return undefined;
    let cancelled = false;
    lookupPincode(pin).then((info) => {
      if (cancelled || !info) return;
      setForm((f) => ({ ...f, city: info.city || f.city, state: info.state || f.state }));
    });
    return () => { cancelled = true; };
  }, [form.pincode]);

  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      // A creator-suffixed deal id tells the backend WHICH hired creator on a multi-creator brief.
      const dealId = row.multi ? `${row.c.id}~${row.creatorId}` : row.c.id;
      await axios.post(`${API}/deals/${dealId}/request-shipment`, {
        description: form.description,
        weight: Number(form.weight),
        dimensions: {
          length: form.length ? Number(form.length) : null,
          width: form.width ? Number(form.width) : null,
          height: form.height ? Number(form.height) : null,
        },
        pickup_address: {
          full_name: form.full_name, phone: form.phone, line1: form.line1, line2: form.line2,
          city: form.city, state: form.state, pincode: form.pincode, country: 'India',
        },
      });
      toast.success('Shipment requested - our team will prepare your label shortly.');
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to generate shipping label'));
    } finally { lock.current = false; setBusy(false); }
  };

  return (
    <BottomSheet
      open
      tall
      onClose={busy ? undefined : onClose}
      title={`Ship to ${row.name}`}
      subtitle={row.c.title}
      footer={(
        <>
          <button type="button" className="ap-btn" style={{ flex: 1, height: 50, background: '#eef0ff', color: 'var(--ap-ink)' }} disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" form="ap-ship-form" className="ap-btn" style={{ flex: 1.4, height: 50 }} disabled={busy} data-testid="submit-ship-btn">{busy ? 'Submitting…' : 'Request pickup'}</button>
        </>
      )}
    >
      <form id="ap-ship-form" onSubmit={submit}>
        <div className="ap-wk-info">
          <Info size={16} />
          <span>Enter the product and your pickup address. Our team prepares a pre-paid label and sends it to the creator. Their delivery address stays private - you don’t need it.</span>
        </div>
        <label className="ap-wk-field">What you’re sending
          <input className="ap-input" required placeholder="e.g. Skincare gift box" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <div className="ap-wk-two">
          <label className="ap-wk-field">Weight (kg)
            <input className="ap-input" type="number" inputMode="decimal" step="0.01" min="0" required placeholder="0.5" value={form.weight} onChange={(e) => set('weight', e.target.value)} />
          </label>
          <div className="ap-wk-field">Size L×W×H (cm)
            <div className="ap-wk-three">
              <input className="ap-input" aria-label="Length (cm)" type="number" inputMode="numeric" min="0" placeholder="L" value={form.length} onChange={(e) => set('length', e.target.value)} style={{ padding: '0 8px' }} />
              <input className="ap-input" aria-label="Width (cm)" type="number" inputMode="numeric" min="0" placeholder="W" value={form.width} onChange={(e) => set('width', e.target.value)} style={{ padding: '0 8px' }} />
              <input className="ap-input" aria-label="Height (cm)" type="number" inputMode="numeric" min="0" placeholder="H" value={form.height} onChange={(e) => set('height', e.target.value)} style={{ padding: '0 8px' }} />
            </div>
          </div>
        </div>

        <div className="ap-wk-sechead">Pickup from</div>
        {fromAccount && <p className="ap-wk-sub" style={{ margin: '6px 0 0' }}>Filled in from your account (Settings → Company). Change anything if the pickup is from a different place.</p>}
        <div className="ap-wk-two">
          <label className="ap-wk-field">Full name
            <input className="ap-input" required autoComplete="name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </label>
          <label className="ap-wk-field">Phone
            <input className="ap-input" type="tel" inputMode="numeric" maxLength={15} required autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/[^0-9]/g, ''))} />
          </label>
        </div>
        <label className="ap-wk-field">Address line 1
          <input className="ap-input" required autoComplete="address-line1" value={form.line1} onChange={(e) => set('line1', e.target.value)} />
        </label>
        <label className="ap-wk-field">Address line 2 (optional)
          <input className="ap-input" autoComplete="address-line2" value={form.line2} onChange={(e) => set('line2', e.target.value)} />
        </label>
        <div className="ap-wk-two">
          <label className="ap-wk-field">Pincode
            <input className="ap-input" inputMode="numeric" maxLength={6} required autoComplete="postal-code" value={form.pincode} onChange={(e) => set('pincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} />
          </label>
          <label className="ap-wk-field">City
            <input className="ap-input" required autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} />
          </label>
        </div>
        <label className="ap-wk-field">State
          <input className="ap-input" required autoComplete="address-level1" value={form.state} onChange={(e) => set('state', e.target.value)} />
        </label>
      </form>
    </BottomSheet>
  );
}

function TrackSheet({ row, ship, loading, onClose, onShip }) {
  const real = hasRealShipment(ship);
  const status = statusOf(ship);
  const checklist = ship?.shipment_checklist || {};
  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Shipment tracking"
      subtitle={`${row.name} · ${row.c.title}`}
      footer={!real && !loading ? <button type="button" className="ap-btn ap-btn--block" style={{ height: 50 }} onClick={onShip}><Package size={18} /> Ship product</button> : null}
    >
      {loading && !ship ? <div className="ap-skel" style={{ height: 160 }} aria-hidden="true" /> : !real ? (
        <div className="ap-empty" style={{ padding: '18px 0' }}>
          <h3>Ready to ship</h3>
          <p>Submit your product and pickup details and our team will prepare the shipping label.</p>
        </div>
      ) : (
        <>
          {awaitingLabel(ship) && (
            <div className="ap-wk-info"><Package size={16} /><span><strong>Shipment requested.</strong> Our team is preparing your pre-paid label. Tracking will appear here once the package is dispatched.</span></div>
          )}
          <div className="ap-wk-kv" style={{ marginTop: 6 }}>
            <div><span>Status</span><b>{awaitingLabel(ship) ? 'Awaiting label' : String(ship.status || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}</b></div>
            <div><span>Tracking number</span><b>{ship.tracking_number || '-'}</b></div>
            {(ship.courier_name || ship.courier) ? <div><span>Courier</span><b>{ship.courier_name || ship.courier}</b></div> : null}
            {ship.expected_delivery ? <div><span>Expected delivery</span><b>{fmtDate(ship.expected_delivery)}</b></div> : null}
            {ship.label_url ? <div><span>Shipping label</span><a className="ap-link" href={assetUrl(ship.label_url)} target="_blank" rel="noopener noreferrer">Download &amp; print</a></div> : null}
            {ship.courier_slip ? <div><span>Courier slip</span><a className="ap-link" href={assetUrl(ship.courier_slip)} target="_blank" rel="noopener noreferrer">View document</a></div> : null}
          </div>
          {ship.shipment_checklist ? (
            <div className="ap-wk-checklist" aria-label="Shipment checklist">
              {[['sealed', 'Package sealed'], ['correct_item', 'Correct item'], ['working', 'Working condition']].map(([k, l]) => (
                <span key={k} className={checklist[k] ? '' : 'is-off'}><Check size={16} /> {l}</span>
              ))}
            </div>
          ) : null}
          {ship.unboxing_video ? (
            <div style={{ marginTop: 12 }}>
              <div className="ap-label" style={{ marginBottom: 6 }}>Unboxing video</div>
              <video src={assetUrl(ship.unboxing_video)} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 280, borderRadius: 14, background: '#000' }} />
            </div>
          ) : null}
          {ship.dispute ? (
            <div className="ap-wk-warn" role="alert"><AlertTriangle size={16} /><span><strong>Dispute reported.</strong> {ship.dispute.reason}</span></div>
          ) : null}
          <div className="ap-wk-info" style={{ marginTop: 12 }}>
            <Info size={16} />
            <span>{status === 'delivered'
              ? 'The creator has received the product. Wait for them to submit the content, then review it and approve to release payment.'
              : awaitingLabel(ship)
                ? 'Our team is preparing your label. You will see the tracking ID here once the package is dispatched.'
                : 'The product is on its way. Wait for the creator to confirm receipt; tracking updates appear here as the courier scans the package.'}</span>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

export default function BrandShipmentsApp() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [shipments, setShipments] = useState({});
  const [dir, setDir] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [track, setTrack] = useState(null);     // row whose details sheet is open
  const [trackLoading, setTrackLoading] = useState(false);
  const [shipRow, setShipRow] = useState(null);
  const [pickup, setPickup] = useState(null);   // row after a successful request

  const fetchShipment = async (r) => {
    try {
      const res = await axios.get(`${API}/shipment/${r.c.id}`, r.multi ? { params: { creator_id: r.creatorId } } : undefined);
      return res.data;
    } catch { return null; }
  };

  const rowsOf = (list) => list
    .filter((c) => c.requires_shipment || c.shipment_option === 'yes')
    .flatMap((c) => {
      const ids = selectedCreators(c);
      const multi = ids.length > 1;
      const mk = (cid) => {
        const bid = (c.bids || []).find((b) => String(b.creator_id) === String(cid)) || {};
        const d = dir[cid] || {};
        const nm = String(d.handle || bid.creator_name || bid.creator_nickname || (cid ? 'Creator' : 'Not selected')).replace(/^@+/, '').trim();
        return {
          c, creatorId: cid, multi, key: multi ? `${c.id}~${cid}` : c.id,
          name: cid ? (nm.split(/\s+/)[0] || nm) : nm,
          photo: d.avatar || bid.creator_photo || bid.profile_photo || '',
        };
      };
      return multi ? ids.map(mk) : [mk(ids[0])];
    });

  const load = async () => {
    try {
      const res = await axios.get(`${API}/campaigns`);
      const mine = (Array.isArray(res.data) ? res.data : []).filter((c) => ownsCampaign(user, c));
      setCampaigns(mine);
      setError('');
      setLoading(false);
      // Preload every shipment record (courier / tracking / status / ETA) so the list is accurate at once.
      const jobs = rowsOf(mine);
      const entries = await Promise.all(jobs.map(async (r) => [r.key, await fetchShipment(r)]));
      setShipments(Object.fromEntries(entries));
    } catch (e) {
      setError(loadErrorText(e, 'Could not load your shipments. Check your connection and try again.'));
      setLoading(false);
    }
  };
  useLiveEffect(() => { if (user?.id) load(); /* eslint-disable-next-line */ }, [user?.id]);
  useEffect(() => {
    let live = true;
    axios.get(`${API}/business/creator-directory`).then((r) => {
      const list = Array.isArray(r.data) ? r.data : (r.data?.creators || []);
      if (live) setDir(Object.fromEntries(list.map((c) => [String(c.id), c])));
    }).catch(() => { /* names fall back to the bid */ });
    return () => { live = false; };
  }, []);

  const rows = rowsOf(campaigns);
  const stOf = (r) => statusOf(shipments[r.key]);
  const counts = { all: rows.length, pending: rows.filter((r) => r.creatorId && stOf(r) === 'pending').length, transit: rows.filter((r) => stOf(r) === 'transit').length, delivered: rows.filter((r) => stOf(r) === 'delivered').length };
  const shown = rows.filter((r) => (tab === 'all' ? true : tab === 'pending' ? r.creatorId && stOf(r) === 'pending' : stOf(r) === tab));
  const toShip = rows.filter((r) => r.creatorId && stOf(r) === 'pending' && !hasRealShipment(shipments[r.key]));
  const retry = () => { setLoading(true); load(); };

  const openTrack = async (r) => {
    setTrack(r);
    setTrackLoading(true);
    const fresh = await fetchShipment(r);
    if (fresh) setShipments((m) => ({ ...m, [r.key]: fresh }));
    setTrackLoading(false);
  };
  const openShip = (r) => { setTrack(null); setShipRow(r); };
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(String(text)); toast.success('Tracking ID copied'); } catch { toast.error('Could not copy - press and hold the number to copy it'); }
  };

  return (
    <AppShell back title="Shipments" subtitle="Products you send to creators">
      <div className="ap-wk">
        {loading ? <Skeletons n={3} h={140} />
          : error && campaigns.length === 0 ? <LoadError title="Couldn't load your shipments" message={error} onRetry={retry} />
          : rows.length === 0 ? (
            <div className="ap-card ap-empty">
              <h3>No campaigns requiring shipment</h3>
              <p>When a campaign needs a product sent to the creator, it will show up here with live tracking.</p>
              <button type="button" className="ap-btn" onClick={() => navigate('/dashboard/business/all-campaigns')}>View campaigns</button>
            </div>
          ) : (
            <>
              {error && <div className="ap-wk-err" role="alert"><span>{error}</span><button type="button" className="ap-btn ap-btn--sm" onClick={retry}>Retry</button></div>}
              <div className="ap-chips ap-wk-chips" role="tablist" aria-label="Shipment status">
                {TABS.map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} className={`ap-chip${tab === k ? ' is-on' : ''}`} onClick={() => setTab(k)}>
                    {l}<span className="ap-wk-cnt">{counts[k]}</span>
                  </button>
                ))}
              </div>

              {toShip.length > 0 && (
                <section className="ap-wk-ship-hero" aria-label="Waiting to ship">
                  <div className="ap-wk-ship-k">{toShip.length} PRODUCT{toShip.length === 1 ? '' : 'S'} WAITING TO SHIP</div>
                  <div className="ap-wk-ship-who">
                    <Avatar name={toShip[0].name} src={toShip[0].photo ? assetUrl(toShip[0].photo) : ''} size={44} />
                    <div>
                      <h3>{toShip[0].name}</h3>
                      <small>{toShip[0].c.title}</small>
                    </div>
                  </div>
                  <button type="button" className="ap-btn" onClick={() => openShip(toShip[0])}><Package size={18} /> Ship product</button>
                </section>
              )}

              {shown.length === 0 ? (
                <div className="ap-card ap-empty">
                  <h3>Nothing in “{TABS.find(([k]) => k === tab)[1]}” yet</h3>
                  <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setTab('all')}>Show all</button>
                </div>
              ) : (
                <div className="ap-wk-list">
                  {shown.map((r) => {
                    const s = shipments[r.key];
                    const st = stOf(r);
                    const real = hasRealShipment(s);
                    const pill = st === 'delivered' ? { t: 'Delivered', c: 'ap-pill--ok' }
                      : st === 'transit' ? { t: 'In transit', c: '' }
                        : !r.creatorId ? { t: 'Awaiting creator', c: 'ap-pill--muted' }
                          : awaitingLabel(s) ? { t: 'Pickup requested', c: 'ap-pill--warn' } : { t: 'Ready to ship', c: 'ap-pill--warn' };
                    const eta = s?.expected_delivery ? fmtDate(s.expected_delivery) : '';
                    const courier = s?.courier || s?.courier_name;
                    return (
                      <article key={r.key} className="ap-card" data-testid={`shipment-${r.key}`}>
                        <div className="ap-wk-ship-top">
                          <Avatar name={r.name} src={r.photo ? assetUrl(r.photo) : ''} size={40} />
                          <div><b>{r.name}</b><small>{r.c.title}</small></div>
                          {eta ? <div className="ap-wk-ship-eta">{st === 'delivered' ? 'Delivered' : 'Arrives'}<br />{eta}</div> : <span className={`ap-pill ${pill.c}`}>{pill.t}</span>}
                        </div>
                        {real && st !== 'pending' ? (
                          <div className="ap-wk-steps" aria-label={`Status: ${pill.t}`}>
                            <span className="ap-wk-steps-line" />
                            <span className="ap-wk-steps-fill" style={{ width: st === 'delivered' ? 'calc(100% - 12px)' : 'calc(50% - 12px)' }} />
                            <div className="ap-wk-steps-g">
                              <div className="ap-wk-step is-done"><i />Picked up</div>
                              <div className={`ap-wk-step ${st === 'delivered' ? 'is-done' : 'is-now'}`}><i />In transit</div>
                              <div className={`ap-wk-step ${st === 'delivered' ? 'is-now' : ''}`}><i />Delivered</div>
                            </div>
                          </div>
                        ) : null}
                        {eta ? <div style={{ marginTop: 10 }}><span className={`ap-pill ${pill.c}`}>{pill.t}</span></div> : null}
                        {s?.tracking_number ? (
                          <div className="ap-wk-track">
                            <span>{courier ? `${courier} · ` : ''}<strong>{s.tracking_number}</strong></span>
                            <button type="button" onClick={() => copy(s.tracking_number)}>Copy</button>
                          </div>
                        ) : null}
                        <div className="ap-wk-ship-acts">
                          {r.creatorId ? (
                            <button type="button" className={`ap-btn${st === 'pending' && !real ? '' : ' ap-btn--ghost'}`} onClick={() => (st === 'pending' && !real ? openShip(r) : openTrack(r))}>
                              {st === 'delivered' ? 'View' : st === 'transit' ? 'Track' : real ? 'Track' : 'Ship'}
                            </button>
                          ) : (
                            <button type="button" className="ap-btn ap-btn--ghost" onClick={() => navigate(`/dashboard/business/campaign/${r.c.id}`)}>Select creator</button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
      </div>

      {track && <TrackSheet row={track} ship={shipments[track.key]} loading={trackLoading} onClose={() => setTrack(null)} onShip={() => openShip(track)} />}
      {shipRow && (
        <ShipSheet
          row={shipRow}
          onClose={() => setShipRow(null)}
          onDone={async () => {
            const r = shipRow;
            setShipRow(null);
            setPickup(r);
            const fresh = await fetchShipment(r);
            if (fresh) setShipments((m) => ({ ...m, [r.key]: fresh }));
          }}
        />
      )}
      {pickup && (
        <BottomSheet open onClose={() => setPickup(null)}>
          <div className="ap-wk-done">
            <span className="ap-wk-done-ic"><Package size={30} /></span>
            <h3>Pickup requested</h3>
            <p>We’re creating your pre-paid label. You’ll see the tracking ID here and {pickup.name} gets notified.</p>
            <div className="ap-wk-done-acts"><button type="button" className="ap-btn ap-btn--block" style={{ height: 50 }} onClick={() => setPickup(null)}>Done</button></div>
          </div>
        </BottomSheet>
      )}
    </AppShell>
  );
}
