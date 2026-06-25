import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Package, Upload, Truck, X, MapPin, Clock3, CheckCircle, ExternalLink, Zap, Boxes } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const SLA_TARGET_HOURS = 4; // spec 11.9 — manual label SLA target
const SHIPROCKET_URL = 'https://app.shiprocket.in/'; // V0.5 — labels generated manually in Shiprocket dashboard

const getId = (r) => r?.id || r?.request_id || r?.deal_id;
const dealId = (r) => r?.deal_id || r?.dealId || r?.deal?.id || getId(r);
const productSummary = (r) =>
  r?.product_summary || r?.product || r?.product_name || r?.deal?.product || '—';
const weightDims = (r) => {
  const w = r?.weight || r?.package_weight;
  const d = r?.dimensions || r?.package_dimensions ||
    (r?.length && r?.width && r?.height ? `${r.length}×${r.width}×${r.height}` : '');
  const parts = [w ? `${w}${String(w).match(/[a-z]/i) ? '' : ' kg'}` : '', d ? `${d} cm` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
};
const hoursSince = (iso) => {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 36e5;
};

export default function AdminShipping() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null); // request being actioned
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [labelFile, setLabelFile] = useState(null);
  const [working, setWorking] = useState(false);

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/shipping/requests`);
      setRequests(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch {
      setRequests([]); // endpoint not live yet — empty queue
    } finally {
      setLoading(false);
    }
  };

  const slaInfo = (r) => {
    const h = hoursSince(r.requested_at || r.created_at);
    if (h == null) return { tone: 'muted', label: '—' };
    const remaining = SLA_TARGET_HOURS - h;
    if (remaining <= 0) return { tone: 'danger', label: `Breached ${Math.round(-remaining)}h` };
    if (remaining <= 1) return { tone: 'warn', label: `${remaining.toFixed(1)}h left` };
    return { tone: 'ok', label: `${remaining.toFixed(1)}h left` };
  };

  const openAction = (r) => {
    setActive(r);
    setCourier(r.courier || '');
    setTracking(r.tracking_number || '');
    setLabelFile(null);
  };

  const handleLabelUpload = async (file) => {
    if (!file || !active) return;
    setWorking(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/admin/shipping/${getId(active)}/label`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setLabelFile(res.data?.file_url || file.name);
      toast.success('Label uploaded');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Label upload failed'));
    } finally {
      setWorking(false);
    }
  };

  const handleMarkShipped = async () => {
    if (!courier.trim() || !tracking.trim()) {
      toast.error('Courier and tracking number are required');
      return;
    }
    setWorking(true);
    try {
      await axios.post(`${API}/admin/shipping/${getId(active)}/ship`, {
        courier: courier.trim(),
        tracking_number: tracking.trim(),
        label_url: typeof labelFile === 'string' ? labelFile : undefined
      });
      toast.success('Marked as shipped');
      setActive(null);
      fetchRequests();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to mark shipped'));
    } finally {
      setWorking(false);
    }
  };

  // spec 11.9 — queue sorted oldest request first
  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const ta = new Date(a.requested_at || a.created_at || 0).getTime();
      const tb = new Date(b.requested_at || b.created_at || 0).getTime();
      return ta - tb;
    });
  }, [requests]);

  const counts = useMemo(() => {
    const pending = requests.filter((r) => (r.status || 'pending') === 'pending');
    return {
      pending: pending.length,
      breached: pending.filter((r) => { const h = hoursSince(r.requested_at || r.created_at); return h != null && h >= SLA_TARGET_HOURS; }).length,
      shipped: requests.filter((r) => ['shipped', 'in_transit', 'delivered'].includes(r.status)).length,
      total: requests.length
    };
  }, [requests]);

  return (
    <AdminLayout>
      <div className="ash">
        <div className="ash-stats">
          {[
            ['Pending labels', counts.pending, 'neutral'],
            ['SLA breached', counts.breached, counts.breached ? 'danger' : 'neutral'],
            ['Shipped', counts.shipped, 'ok'],
            ['Total requests', counts.total, 'neutral']
          ].map(([label, value, tone]) => (
            <div key={label} className={`ash-stat ${tone}`}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div className="ash-v1note" role="note">
          <Zap size={15} />
          <span><strong>V1 preview:</strong> Shiprocket API integration will auto-generate labels in under 60s — this manual queue stays only for exceptions (missing address fields, oversize packages, restricted items).</span>
        </div>

        <div className="ash-table-wrap">
          {loading ? (
            <div className="ash-empty">Loading shipping queue…</div>
          ) : requests.length === 0 ? (
            <div className="ash-empty">
              <Package size={56} />
              <p>No label requests in the queue</p>
              <span>When a brand requests a manual shipping label it lands here. Target SLA: {SLA_TARGET_HOURS} hours.</span>
            </div>
          ) : (
            <table className="ash-table">
              <thead>
                <tr><th>Deal ID</th><th>Campaign</th><th>Brand → Creator</th><th>Product</th><th>Weight / dims</th><th>Ship to</th><th>Requested</th><th>SLA</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {sortedRequests.map((r) => {
                  const sla = slaInfo(r);
                  const status = r.status || 'pending';
                  return (
                    <tr key={getId(r)} data-testid={`shipping-row-${getId(r)}`}>
                      <td className="ash-mono">#{dealId(r)}</td>
                      <td className="ash-strong">{r.campaign_title || r.campaign?.title || 'Campaign'}</td>
                      <td>{(r.brand_handle || r.brand || '—')} → {(r.creator_handle || r.creator || '—')}</td>
                      <td className="ash-prod" title={productSummary(r)}>{productSummary(r)}</td>
                      <td className="ash-dims"><Boxes size={13} /> {weightDims(r)}</td>
                      <td className="ash-addr"><MapPin size={13} /> {r.ship_city || r.address?.city || r.shipping_city || 'Hidden until action'}</td>
                      <td>{(r.requested_at || r.created_at) ? new Date(r.requested_at || r.created_at).toLocaleString() : '—'}</td>
                      <td><span className={`ash-sla ${sla.tone}`}>{sla.label}</span></td>
                      <td><span className={`ash-badge ${['shipped','in_transit','delivered'].includes(status) ? 'ok' : 'warn'}`}>{status.replace('_', ' ')}</span></td>
                      <td>
                        {['shipped', 'in_transit', 'delivered'].includes(status) ? (
                          <span className="ash-done"><CheckCircle size={15} /> Done</span>
                        ) : (
                          <button className="ash-action" onClick={() => openAction(r)} data-testid={`action-shipping-${getId(r)}`}>Process</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {active && (
        <>
          <div className="ash-scrim" onClick={() => setActive(null)} />
          <div className="ash-modal" data-testid="shipping-modal">
            <header className="ash-modal-head">
              <h2><Truck size={18} /> Process shipment</h2>
              <button className="ash-icon" onClick={() => setActive(null)} aria-label="Close"><X size={18} /></button>
            </header>
            <div className="ash-modal-body">
              <div className="ash-meta">
                <p><strong>Campaign:</strong> {active.campaign_title || active.campaign?.title || 'Campaign'}</p>
                <p><strong>Deal:</strong> #{dealId(active)}</p>
                <p><strong>Product:</strong> {productSummary(active)}</p>
                <p><strong>Weight / dims:</strong> {weightDims(active)}</p>
                <p className="ash-sla-line"><Clock3 size={13} /> Requested {(active.requested_at || active.created_at) ? new Date(active.requested_at || active.created_at).toLocaleString() : '—'} · SLA target {SLA_TARGET_HOURS}h</p>
              </div>

              <div className="ash-addrbox">
                <span className="ash-internal">Internal only</span>
                <div className="ash-addrcol">
                  <span className="ash-addrlabel"><MapPin size={12} /> Brand pickup address</span>
                  <p>{active.pickup_address || active.brand_address || active.brand?.pickup_address || '—'}</p>
                </div>
                <div className="ash-addrcol">
                  <span className="ash-addrlabel"><MapPin size={12} /> Creator shipping address</span>
                  <p>{active.ship_address || active.address?.full || `${active.ship_city || active.shipping_city || ''}` || '—'}</p>
                </div>
              </div>

              <ol className="ash-steps">
                <li>Generate the label in the Shiprocket dashboard using the addresses above.</li>
                <li>Download the label PDF, then upload it below to attach it to the Deal Room.</li>
                <li>The brand is notified automatically once the shipment is marked shipped.</li>
              </ol>

              <a className="ash-shiprocket" href={SHIPROCKET_URL} target="_blank" rel="noopener noreferrer">
                <Truck size={15} /> Generate Shiprocket Label <ExternalLink size={13} />
              </a>

              <label className="ash-field">
                <span>Shipping label PDF (uploads to Deal Room)</span>
                <label className={`ash-upload ${labelFile ? 'is-set' : ''}`}>
                  <Upload size={16} />
                  {labelFile ? (typeof labelFile === 'string' ? 'Label uploaded' : labelFile.name) : 'Upload label'}
                  <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => handleLabelUpload(e.target.files?.[0])} />
                </label>
              </label>

              <label className="ash-field">
                <span>Courier</span>
                <input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. Delhivery, Bluedart" data-testid="ship-courier" />
              </label>
              <label className="ash-field">
                <span>Tracking number</span>
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking / AWB number" data-testid="ship-tracking" />
              </label>
            </div>
            <footer className="ash-modal-foot">
              <button className="ash-ghost" onClick={() => setActive(null)}>Cancel</button>
              <button className="ash-primary" disabled={working} onClick={handleMarkShipped} data-testid="ship-submit">
                <Truck size={16} /> Mark shipped
              </button>
            </footer>
          </div>
        </>
      )}

      <style>{`
        .ash { padding: 24px 28px; max-width: 1480px; margin: 0 auto; }
        .ash-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 18px; }
        .ash-stat { background: #fff; border: 1px solid #e6e8ec; border-radius: 12px; padding: 14px 16px; }
        .ash-stat.danger { border-color: #fecdca; background: #fef3f2; }
        .ash-stat.ok { border-color: #abefc6; background: #ecfdf3; }
        .ash-stat span { display: block; font-size: 0.72rem; color: #98a1ad; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
        .ash-stat strong { font-size: 1.6rem; color: #07074e; }
        .ash-stat.danger strong { color: #b42318; }
        .ash-v1note { display: flex; align-items: flex-start; gap: 9px; background: #eef0ff; border: 1px solid #d6dbff; color: #3b41a8; border-radius: 12px; padding: 11px 15px; margin-bottom: 16px; font-size: 0.82rem; line-height: 1.45; }
        .ash-v1note svg { flex: none; margin-top: 1px; color: #5b6bff; }
        .ash-v1note strong { color: #2b318f; }
        .ash-mono { font-variant-numeric: tabular-nums; color: #5b6573; font-weight: 600; }
        .ash-prod { max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
        .ash-dims { display: inline-flex; align-items: center; gap: 5px; color: #5b6573; }
        .ash-dims svg { color: #98a1ad; }
        .ash-table-wrap { background: #fff; border: 1px solid #e6e8ec; border-radius: 14px; overflow-x: auto; }
        .ash-table { width: 100%; border-collapse: collapse; }
        .ash-table th, .ash-table td { padding: 13px 18px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 0.88rem; white-space: nowrap; }
        .ash-table th { background: #f9fafb; font-size: 0.72rem; font-weight: 700; color: #5b6573; text-transform: uppercase; letter-spacing: 0.04em; }
        .ash-table tbody tr:last-child td { border-bottom: 0; }
        .ash-table tbody tr:hover { background: #f9fafb; }
        .ash-strong { font-weight: 600; color: #111827; }
        .ash-addr { display: inline-flex; align-items: center; gap: 5px; color: #5b6573; }
        .ash-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 600; text-transform: capitalize; }
        .ash-badge.ok { background: #ecfdf3; color: #067647; }
        .ash-badge.warn { background: #fffaeb; color: #b54708; }
        .ash-sla { font-weight: 700; font-size: 0.82rem; }
        .ash-sla.ok { color: #067647; } .ash-sla.warn { color: #b54708; } .ash-sla.danger { color: #b42318; } .ash-sla.muted { color: #98a1ad; }
        .ash-action { border: 1px solid transparent; background: linear-gradient(135deg, #5b6bff, #4452f0); color: #fff; font-weight: 600; padding: 7px 16px; border-radius: 8px; cursor: pointer; font-size: 0.82rem; box-shadow: 0 8px 18px -8px rgba(91,107,255,0.7); }
        .ash-action:hover { transform: translateY(-1px); }
        .ash-done { display: inline-flex; align-items: center; gap: 5px; color: #067647; font-weight: 600; font-size: 0.82rem; }
        .ash-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 70px 24px; color: #5b6573; text-align: center; }
        .ash-empty svg { color: #d4d8df; }
        .ash-empty p { margin: 0; font-weight: 600; color: #111827; }
        .ash-empty span { font-size: 0.85rem; color: #98a1ad; max-width: 420px; }

        .ash-scrim { position: fixed; inset: 0; background: rgba(16,24,40,0.4); z-index: 40; }
        .ash-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 460px; max-width: 92vw; max-height: 90vh; overflow-y: auto; background: #fff; border-radius: 16px; box-shadow: 0 24px 60px rgba(16,24,40,0.28); z-index: 50; }
        .ash-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid #e6e8ec; }
        .ash-modal-head h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 1rem; font-weight: 700; color: #07074e; }
        .ash-icon { border: 1px solid #e6e8ec; background: #fff; border-radius: 8px; padding: 6px; cursor: pointer; color: #5b6573; }
        .ash-modal-body { padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; }
        .ash-meta { background: #f9fafb; border: 1px solid #f1f5f9; border-radius: 10px; padding: 12px 14px; font-size: 0.82rem; color: #5b6573; }
        .ash-meta p { margin: 0 0 5px; } .ash-meta p:last-child { margin: 0; }
        .ash-meta strong { color: #111827; }
        .ash-sla-line { display: flex; align-items: center; gap: 5px; color: #98a1ad !important; }
        .ash-addrbox { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #fffaf2; border: 1px solid #fde6c8; border-radius: 10px; padding: 13px 14px 12px; }
        .ash-internal { position: absolute; top: 9px; right: 11px; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #b54708; background: #fff3e0; border: 1px solid #fde6c8; border-radius: 5px; padding: 2px 6px; }
        .ash-addrcol { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .ash-addrlabel { display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: #98a1ad; }
        .ash-addrlabel svg { color: #d4854a; }
        .ash-addrcol p { margin: 0; font-size: 0.82rem; color: #111827; line-height: 1.35; word-break: break-word; }
        .ash-steps { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 5px; font-size: 0.8rem; color: #5b6573; line-height: 1.4; }
        .ash-steps li::marker { color: #5b6bff; font-weight: 700; }
        .ash-shiprocket { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid #d6dbff; background: #eef0ff; color: #3b41a8; font-weight: 600; padding: 10px 14px; border-radius: 9px; font-size: 0.85rem; text-decoration: none; }
        .ash-shiprocket:hover { background: #e2e6ff; }
        @media (max-width: 520px) { .ash-addrbox { grid-template-columns: 1fr; } }
        .ash-field { display: flex; flex-direction: column; gap: 6px; }
        .ash-field span { font-size: 0.78rem; font-weight: 600; color: #5b6573; }
        .ash-field input { border: 1px solid #e6e8ec; border-radius: 8px; padding: 10px 12px; font-size: 0.88rem; color: #111827; }
        .ash-field input:focus { outline: none; border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,0.16); }
        .ash-upload { display: inline-flex; align-items: center; gap: 8px; border: 1.5px dashed #d4d8df; border-radius: 8px; padding: 11px 14px; font-size: 0.85rem; color: #5b6573; cursor: pointer; }
        .ash-upload.is-set { border-color: #5b6bff; color: #4452f0; background: #eef0ff; }
        .ash-modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 22px; border-top: 1px solid #e6e8ec; }
        .ash-ghost { border: 1px solid #e6e8ec; background: #fff; color: #5b6573; font-weight: 600; padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
        .ash-primary { display: inline-flex; align-items: center; gap: 7px; border: 1px solid transparent; background: linear-gradient(135deg, #5b6bff, #4452f0); color: #fff; font-weight: 600; padding: 9px 18px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; box-shadow: 0 8px 18px -8px rgba(91,107,255,0.7); }
        .ash-primary:hover { transform: translateY(-1px); }
        .ash-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
        @media (max-width: 720px) { .ash { padding: 18px; } }
      `}</style>
    </AdminLayout>
  );
}
