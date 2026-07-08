import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { ArrowLeft, Package, Truck, AlertTriangle, ClipboardList } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

export default function ShipmentTracking({ embedCampaignId, autoShip, onClose }) {
  const [searchParams] = useSearchParams();
  const campaignId = embedCampaignId || searchParams.get('campaign');
  const navigate = useNavigate();
  const goBack = () => (onClose ? onClose() : navigate(-1));
  const { user } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shipmentLoaded, setShipmentLoaded] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [shipmentData, setShipmentData] = useState({
    tracking_number: '',
    expected_delivery: '',
    shipment_checklist: {
      sealed: false,
      correct_item: false,
      working: false
    }
  });
  const [receiveData, setReceiveData] = useState({
    unboxing_video: '',
    items_damaged: false,
    dispute_reason: ''
  });
  const [unboxingFile, setUnboxingFile] = useState(null);
  const [courierFile, setCourierFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  // "Ship Product" (Shiprocket) flow — brand enters product details + their pickup
  // address; the platform generates a pre-paid label. The creator's delivery address
  // is pulled server-side and never shown to the brand.
  const [showShipModal, setShowShipModal] = useState(false);
  const [shipForm, setShipForm] = useState({
    description: '', weight: '', length: '', width: '', height: '',
    full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '',
  });

  // Uploaded files come back as a relative "/uploads/..." path; absolute URLs
  // (legacy/cloud) are used as-is.
  const resolveMediaUrl = (u) => {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return `${BACKEND_URL}${u.startsWith('/') ? '' : '/'}${u}`;
  };

  // Upload a real file to the backend and return its stored URL.
  const uploadFile = async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await axios.post(`${API}/upload/file`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.file_url;
  };

  useEffect(() => {
    if (campaignId) {
      fetchCampaign();
      fetchShipment();
    }
  }, [campaignId]);

  // When opened via the "Ship" action, jump straight to the Ship Product form
  // (skip the tracking page) — but only if nothing has actually shipped yet.
  const autoShipDone = useRef(false);
  useEffect(() => {
    // Wait until BOTH campaign and the shipment lookup have resolved — otherwise
    // the form would flash open for an already-shipped deal (shipment still null).
    if (!autoShip || autoShipDone.current || loading || !shipmentLoaded || !campaign || !user) return;
    const isBrand = user.role === 'business' && campaign.business_id === user.id;
    const status = String(shipment?.status || '').toLowerCase();
    const alreadyShipped = !!shipment && (
      !!shipment.requested || !!shipment.tracking_number || !!shipment.label_url ||
      ['requested', 'awaiting_pickup', 'label_generated', 'shipped', 'in_transit', 'delivered', 'received'].includes(status)
    );
    if (isBrand && !alreadyShipped) {
      autoShipDone.current = true;
      setShowShipModal(true);
    }
  }, [autoShip, loading, shipmentLoaded, campaign, shipment, user]);

  const fetchCampaign = async () => {
    try {
      const response = await axios.get(`${API}/campaigns/${campaignId}`);
      setCampaign(response.data);
    } catch (error) {
      toast.error('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  const fetchShipment = async () => {
    try {
      const response = await axios.get(`${API}/shipment/${campaignId}`);
      setShipment(response.data);
    } catch (error) {
      // Shipment might not exist yet
      console.log('No shipment found yet');
    } finally {
      setShipmentLoaded(true);
    }
  };

  const handleUpdateShipment = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      // Upload the courier slip if the business attached one (it's optional).
      let courierSlip = '';
      if (courierFile) {
        courierSlip = await uploadFile(courierFile);
      }
      await axios.post(`${API}/shipment/update`, {
        campaign_id: campaignId,
        tracking_number: shipmentData.tracking_number,
        courier_slip: courierSlip,
        expected_delivery: shipmentData.expected_delivery,
        shipment_checklist: shipmentData.shipment_checklist
      });
      toast.success('Shipment details updated!');
      setShowUpdateModal(false);
      setCourierFile(null);
      fetchShipment();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to update shipment'));
    } finally {
      setUploading(false);
    }
  };

  const handleReceiveShipment = async (e) => {
    e.preventDefault();
    if (!unboxingFile) {
      toast.error('Please attach your unboxing video.');
      return;
    }
    setUploading(true);
    try {
      // Upload the real unboxing video and store its URL.
      const unboxingVideo = await uploadFile(unboxingFile);
      await axios.post(`${API}/shipment/receive`, {
        campaign_id: campaignId,
        unboxing_video: unboxingVideo,
        items_damaged: receiveData.items_damaged,
        dispute_reason: receiveData.items_damaged ? receiveData.dispute_reason : undefined
      });
      toast.success('Shipment marked as received!');
      setShowReceiveModal(false);
      setUnboxingFile(null);
      fetchShipment();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to mark as received'));
    } finally {
      setUploading(false);
    }
  };

  const setShip = (field, value) => setShipForm((f) => ({ ...f, [field]: value }));

  const handleShipProduct = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      await axios.post(`${API}/deals/${campaignId}/request-shipment`, {
        description: shipForm.description,
        weight: Number(shipForm.weight),
        dimensions: {
          length: shipForm.length ? Number(shipForm.length) : null,
          width: shipForm.width ? Number(shipForm.width) : null,
          height: shipForm.height ? Number(shipForm.height) : null,
        },
        pickup_address: {
          full_name: shipForm.full_name,
          phone: shipForm.phone,
          line1: shipForm.line1,
          line2: shipForm.line2,
          city: shipForm.city,
          state: shipForm.state,
          pincode: shipForm.pincode,
          country: 'India',
        },
      });
      toast.success('Shipment requested — our team will prepare your label shortly.');
      setShowShipModal(false);
      fetchShipment();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to generate shipping label'));
    } finally {
      setUploading(false);
    }
  };

  const handleChecklistChange = (field) => {
    setShipmentData({
      ...shipmentData,
      shipment_checklist: {
        ...shipmentData.shipment_checklist,
        [field]: !shipmentData.shipment_checklist[field]
      }
    });
  };

  if (loading) return <div className="loading-page">Loading...</div>;
  if (!campaign) return <div className="error-page">Campaign not found</div>;

  const isBusiness = user?.role === 'business' && campaign.business_id === user.id;
  const isCreator = user?.role === 'creator' && campaign.selected_creator === user.id;

  // What-to-do-next guidance based on who is viewing and the shipment status.
  const getNextSteps = () => {
    const status = shipment?.status;
    if (isCreator) {
      if (status === 'received') {
        return {
          title: 'What to do next',
          steps: [
            'Create the content exactly as described in the brief.',
            'Submit your work for review from "My Active Work".',
            'Wait for the brand to approve it — your payment is released on approval.',
          ],
        };
      }
      return {
        title: 'What to do next',
        steps: [
          'Watch for the package to arrive at your address.',
          'Record an unboxing video as you open it (you may need it if anything is wrong).',
          'Click "Mark as Received" once it arrives — report any damage or wrong item there.',
          'Then create your content and submit it from "My Active Work".',
        ],
      };
    }
    if (isBusiness) {
      if (status === 'received') {
        return {
          title: 'What to do next',
          steps: [
            'The creator has received the product.',
            'Wait for them to submit the content, then review it.',
            'Approve the work to release payment, or request changes.',
          ],
        };
      }
      if (status === 'requested') {
        return {
          title: 'What to do next',
          steps: [
            'Your shipment request has been submitted.',
            'Our team is preparing your pre-paid shipping label.',
            'Tracking will appear here once the package is dispatched.',
          ],
        };
      }
      return {
        title: 'What to do next',
        steps: [
          'The product is on its way to the creator.',
          'Wait for the creator to confirm receipt.',
          'Tracking updates will appear here as the courier scans the package.',
        ],
      };
    }
    return null;
  };

  const nextSteps = getNextSteps();

  // A shipment only counts as "real" once a label/tracking exists or it's actually
  // moving. A stale/empty record (e.g. an old "completed" doc with no tracking) still
  // needs shipping, so the brand should see the "Ship Product" action, not the details.
  const shipStatus = String(shipment?.status || '').toLowerCase();
  const hasRealShipment = !!shipment && (
    !!shipment.requested ||
    !!shipment.tracking_number ||
    !!shipment.label_url ||
    ['requested', 'awaiting_pickup', 'label_generated', 'shipped', 'in_transit', 'delivered', 'received'].includes(shipStatus)
  );
  // The brand is still waiting on the platform to generate the label.
  const awaitingLabel = shipStatus === 'requested' && !shipment?.label_url && !shipment?.tracking_number;

  const embedded = !!onClose;

  return (
    <div className={`shipment-page ${embedded ? 'is-embed' : ''}`}>
      <div className="page-header">
        <button className="back-btn" onClick={goBack} data-testid="back-btn">
          <ArrowLeft size={20} /> Back
        </button>
      </div>

      <div className="shipment-container fade-in">
        <div className="st-header">
          <span className="st-icon"><Package size={26} /></span>
          <div className="st-head-text">
            <h1>Shipment Tracking</h1>
            <p>Campaign: {campaign.title}</p>
          </div>
        </div>

        {!hasRealShipment ? (
          <div className="no-shipment">
            <Package size={64} />
            <p>{isBusiness ? 'Ready to ship — submit your product & pickup details and our team will prepare the shipping label.' : 'No shipment details available yet'}</p>
            {isBusiness && (
              <button
                className="btn-primary ship-cta"
                onClick={() => setShowShipModal(true)}
                data-testid="ship-product-btn"
              >
                <Package size={18} /> Ship Product
              </button>
            )}
          </div>
        ) : (
          <div className="shipment-details">
            <div className="status-card">
              <div className="status-icon">
                <Truck size={32} />
              </div>
              <div>
                <p className="status-label">Status</p>
                <p className="status-value">{awaitingLabel ? 'AWAITING LABEL' : String(shipment.status || '').replace(/_/g, ' ').toUpperCase()}</p>
              </div>
            </div>

            {awaitingLabel && (
              <div className="await-banner">
                <ClipboardList size={20} />
                <div>
                  <strong>Shipment requested</strong>
                  <p>Our team is preparing your pre-paid label. Tracking will appear here once the package is dispatched.</p>
                </div>
              </div>
            )}

            <div className="details-grid">
              <div className="detail-card">
                <h3>Tracking Information</h3>
                <div className="detail-item">
                  <span className="label">Tracking Number:</span>
                  <span className="value">{shipment.tracking_number || '—'}</span>
                </div>
                {shipment.courier_name && (
                  <div className="detail-item">
                    <span className="label">Courier:</span>
                    <span className="value">{shipment.courier_name}</span>
                  </div>
                )}
                {shipment.expected_delivery && (
                  <div className="detail-item">
                    <span className="label">Expected Delivery:</span>
                    <span className="value">{new Date(shipment.expected_delivery).toLocaleDateString()}</span>
                  </div>
                )}
                {shipment.label_url && isBusiness && (
                  <div className="detail-item">
                    <span className="label">Shipping Label:</span>
                    <a href={resolveMediaUrl(shipment.label_url)} target="_blank" rel="noopener noreferrer" className="link">
                      Download &amp; print
                    </a>
                  </div>
                )}
                {shipment.courier_slip && (
                  <div className="detail-item">
                    <span className="label">Courier Slip:</span>
                    <a href={resolveMediaUrl(shipment.courier_slip)} target="_blank" rel="noopener noreferrer" className="link">
                      View Document
                    </a>
                  </div>
                )}
              </div>

              <div className="detail-card">
                <h3>Shipment Checklist</h3>
                <div className="checklist">
                  <div className="checklist-item">
                    <input
                      type="checkbox"
                      checked={shipment.shipment_checklist?.sealed}
                      disabled
                      readOnly
                    />
                    <span>Package Sealed</span>
                  </div>
                  <div className="checklist-item">
                    <input
                      type="checkbox"
                      checked={shipment.shipment_checklist?.correct_item}
                      disabled
                      readOnly
                    />
                    <span>Correct Item</span>
                  </div>
                  <div className="checklist-item">
                    <input
                      type="checkbox"
                      checked={shipment.shipment_checklist?.working}
                      disabled
                      readOnly
                    />
                    <span>Working Condition</span>
                  </div>
                </div>
              </div>
            </div>

            {shipment.unboxing_video && (
              <div className="detail-card detail-card--row">
                <h3>Unboxing Video</h3>
                <a href={resolveMediaUrl(shipment.unboxing_video)} target="_blank" rel="noopener noreferrer" className="video-link">
                  View Unboxing Video
                </a>
              </div>
            )}

            {shipment.dispute && (
              <div className="dispute-alert">
                <AlertTriangle size={24} />
                <div>
                  <strong>Dispute Reported</strong>
                  <p>{shipment.dispute.reason}</p>
                </div>
              </div>
            )}

            {nextSteps && (
              <div className="next-steps" data-testid="next-steps">
                <div className="next-steps-header">
                  <ClipboardList size={22} />
                  <h3>{nextSteps.title}</h3>
                </div>
                <ol className="next-steps-list">
                  {nextSteps.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="action-buttons">
              {isCreator && shipment.status === 'shipped' && (
                <button
                  className="btn-primary"
                  onClick={() => setShowReceiveModal(true)}
                  data-testid="mark-received-btn"
                >
                  Mark as Received
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ship Product Modal — product details + pickup address → pre-paid label */}
      {showShipModal && (
        <div className="modal-overlay" onClick={() => !uploading && setShowShipModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Ship Product</h2>
            <p className="ship-help">Enter the product details and your pickup address. Our team will prepare a pre-paid label and dispatch it to the creator. The creator's delivery address is handled securely — you don't need it.</p>
            <form onSubmit={handleShipProduct} className="shipment-form">
              <div className="form-group">
                <label htmlFor="s-desc">Product description</label>
                <input id="s-desc" type="text" className="input-field" required
                  placeholder="e.g. Skincare gift box"
                  value={shipForm.description} onChange={(e) => setShip('description', e.target.value)} />
              </div>

              <div className="ship-row">
                <div className="form-group">
                  <label htmlFor="s-weight">Weight (kg)</label>
                  <input id="s-weight" type="number" step="0.01" min="0" className="input-field" required
                    placeholder="0.5" value={shipForm.weight} onChange={(e) => setShip('weight', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Dimensions L×W×H (cm)</label>
                  <div className="ship-dims">
                    <input type="number" min="0" className="input-field" placeholder="L" value={shipForm.length} onChange={(e) => setShip('length', e.target.value)} />
                    <input type="number" min="0" className="input-field" placeholder="W" value={shipForm.width} onChange={(e) => setShip('width', e.target.value)} />
                    <input type="number" min="0" className="input-field" placeholder="H" value={shipForm.height} onChange={(e) => setShip('height', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="ship-divider">Pickup address</div>

              <div className="ship-row">
                <div className="form-group">
                  <label htmlFor="s-name">Full name</label>
                  <input id="s-name" type="text" className="input-field" required
                    value={shipForm.full_name} onChange={(e) => setShip('full_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="s-phone">Phone</label>
                  <input id="s-phone" type="tel" className="input-field" required
                    value={shipForm.phone} onChange={(e) => setShip('phone', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="s-line1">Address line 1</label>
                <input id="s-line1" type="text" className="input-field" required
                  value={shipForm.line1} onChange={(e) => setShip('line1', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="s-line2">Address line 2 (optional)</label>
                <input id="s-line2" type="text" className="input-field"
                  value={shipForm.line2} onChange={(e) => setShip('line2', e.target.value)} />
              </div>

              <div className="ship-row ship-row--3">
                <div className="form-group">
                  <label htmlFor="s-city">City</label>
                  <input id="s-city" type="text" className="input-field" required
                    value={shipForm.city} onChange={(e) => setShip('city', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="s-state">State</label>
                  <input id="s-state" type="text" className="input-field" required
                    value={shipForm.state} onChange={(e) => setShip('state', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="s-pin">Pincode</label>
                  <input id="s-pin" type="text" className="input-field" required
                    value={shipForm.pincode} onChange={(e) => setShip('pincode', e.target.value)} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowShipModal(false)} disabled={uploading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" data-testid="submit-ship-btn" disabled={uploading}>
                  {uploading ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Shipment Modal */}
      {showUpdateModal && (
        <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Update Shipment Details</h2>
            <form onSubmit={handleUpdateShipment} className="shipment-form">
              <div className="form-group">
                <label htmlFor="tracking">Tracking Number</label>
                <input
                  id="tracking"
                  type="text"
                  value={shipmentData.tracking_number}
                  onChange={(e) => setShipmentData({ ...shipmentData, tracking_number: e.target.value })}
                  className="input-field"
                  placeholder="ABC123456789"
                  required
                  data-testid="tracking-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="delivery">Expected Delivery Date</label>
                <input
                  id="delivery"
                  type="date"
                  value={shipmentData.expected_delivery}
                  onChange={(e) => setShipmentData({ ...shipmentData, expected_delivery: e.target.value })}
                  className="input-field"
                  required
                  data-testid="delivery-input"
                />
              </div>

              <div className="form-group">
                <label>Shipment Checklist</label>
                <div className="checklist">
                  <label className="checklist-item">
                    <input
                      type="checkbox"
                      checked={shipmentData.shipment_checklist.sealed}
                      onChange={() => handleChecklistChange('sealed')}
                      data-testid="sealed-checkbox"
                    />
                    <span>Package is sealed properly</span>
                  </label>
                  <label className="checklist-item">
                    <input
                      type="checkbox"
                      checked={shipmentData.shipment_checklist.correct_item}
                      onChange={() => handleChecklistChange('correct_item')}
                      data-testid="correct-item-checkbox"
                    />
                    <span>Correct item included</span>
                  </label>
                  <label className="checklist-item">
                    <input
                      type="checkbox"
                      checked={shipmentData.shipment_checklist.working}
                      onChange={() => handleChecklistChange('working')}
                      data-testid="working-checkbox"
                    />
                    <span>Item is in working condition</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="courier-file">Courier Slip (PDF or image — optional)</label>
                <input
                  id="courier-file"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setCourierFile(e.target.files?.[0] || null)}
                  className="input-field"
                  data-testid="courier-file-input"
                />
                {courierFile && <span className="file-name">{courierFile.name}</span>}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowUpdateModal(false)} disabled={uploading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" data-testid="submit-shipment-btn" disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Update Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Shipment Modal */}
      {showReceiveModal && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Mark Shipment as Received</h2>
            <form onSubmit={handleReceiveShipment} className="receive-form">
              <div className="form-group">
                <label htmlFor="unboxing-file">Unboxing Video (max 50 MB, up to 30s)</label>
                <input
                  id="unboxing-file"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setUnboxingFile(e.target.files?.[0] || null)}
                  className="input-field"
                  required
                  data-testid="unboxing-file-input"
                />
                {unboxingFile && <span className="file-name">{unboxingFile.name}</span>}
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={receiveData.items_damaged}
                    onChange={(e) => setReceiveData({ ...receiveData, items_damaged: e.target.checked })}
                    data-testid="damaged-checkbox"
                  />
                  Report damaged or wrong items
                </label>
              </div>

              {receiveData.items_damaged && (
                <div className="form-group">
                  <label htmlFor="dispute">Describe the issue</label>
                  <textarea
                    id="dispute"
                    value={receiveData.dispute_reason}
                    onChange={(e) => setReceiveData({ ...receiveData, dispute_reason: e.target.value })}
                    className="textarea-field"
                    placeholder="Describe what's wrong with the shipment..."
                    required
                    data-testid="dispute-input"
                  />
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowReceiveModal(false)} disabled={uploading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" data-testid="submit-receive-btn" disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .shipment-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8f9ff 0%, #e8ecff 100%);
          padding: 40px 8%;
        }

        .loading-page,
        .error-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          color: #718096;
        }

        .page-header {
          max-width: 1000px;
          margin: 0 auto 24px;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          color: #4a5568;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .back-btn:hover {
          border-color: #667eea;
          color: #667eea;
          transform: translateX(-4px);
        }

        .shipment-container {
          max-width: 1000px;
          margin: 0 auto;
          background: white;
          padding: 26px 28px;
          border-radius: 24px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
        }

        .st-header {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 18px;
          padding-bottom: 16px;
          border-bottom: 1px solid #eef0f7;
        }

        .st-icon {
          flex-shrink: 0;
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border-radius: 13px;
          background: linear-gradient(135deg, #eef1ff 0%, #e6e9ff 100%);
          color: #667eea;
        }

        .st-head-text h1 {
          font-size: 1.3rem;
          font-weight: 700;
          color: #1a202c;
          margin: 0;
          line-height: 1.15;
        }

        .st-head-text p {
          color: #718096;
          font-size: 0.85rem;
          margin: 2px 0 0;
        }

        .no-shipment {
          text-align: center;
          padding: 80px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          color: #718096;
        }

        .shipment-details {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .status-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 14px;
          color: white;
        }

        .status-icon {
          width: 46px;
          height: 46px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .status-icon svg { width: 24px; height: 24px; }

        .status-label {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          opacity: 0.85;
          margin-bottom: 2px;
        }

        .status-value {
          font-size: 1.3rem;
          font-weight: 700;
          line-height: 1.1;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          align-items: start;
        }

        .detail-card {
          padding: 16px 18px;
          background: #fbfcff;
          border-radius: 14px;
          border: 1px solid #e8ebf5;
        }

        .detail-card h3 {
          font-size: 0.98rem;
          font-weight: 700;
          color: #2d3748;
          margin: 0 0 10px;
        }

        .detail-card--row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .detail-card--row h3 {
          margin: 0;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          font-size: 0.9rem;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid #eceef5;
        }

        .detail-item:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .detail-item .label {
          color: #718096;
          font-weight: 500;
        }

        .detail-item .value {
          color: #1a202c;
          font-weight: 600;
        }

        .link {
          color: #667eea;
          font-weight: 600;
          text-decoration: none;
        }

        .link:hover {
          text-decoration: underline;
        }

        .checklist {
          display: flex;
          flex-direction: column;
          gap: 9px;
          font-size: 0.9rem;
        }

        .checklist-item {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #4a5568;
          cursor: pointer;
        }

        .checklist-item input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .video-link {
          display: inline-block;
          padding: 12px 24px;
          background: #667eea;
          color: white;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .video-link:hover {
          background: #5568d3;
        }

        .dispute-alert {
          display: flex;
          align-items: start;
          gap: 16px;
          padding: 24px;
          background: #fef2f2;
          border-radius: 16px;
          border: 2px solid #ef4444;
          color: #991b1b;
        }

        .dispute-alert strong {
          display: block;
          margin-bottom: 8px;
          font-size: 1.1rem;
        }

        .next-steps {
          padding: 24px;
          background: #f0fdf4;
          border-radius: 16px;
          border: 2px solid #86efac;
          color: #14532d;
        }

        .next-steps-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .next-steps-header h3 {
          font-size: 1.2rem;
          font-weight: 600;
          color: #166534;
          margin: 0;
        }

        .next-steps-list {
          margin: 0;
          padding-left: 22px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .next-steps-list li {
          font-size: 0.98rem;
          line-height: 1.5;
        }

        .file-name {
          display: block;
          margin-top: 8px;
          font-size: 0.875rem;
          color: #4a5568;
          word-break: break-all;
        }

        .action-buttons {
          display: flex;
          gap: 16px;
          padding-top: 24px;
          border-top: 2px solid #e2e8f0;
        }

        .action-buttons button {
          flex: 1;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          padding: 26px 28px;
          border-radius: 22px;
          max-width: 600px;
          width: 100%;
          max-height: 94vh;
          overflow-y: auto;
        }

        .modal-content h2 {
          font-size: 1.45rem;
          font-weight: 800;
          color: #07074e;
          margin-bottom: 10px;
        }

        .shipment-form,
        .receive-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Scoped compression so the Ship Product form fits without scrolling */
        .modal-content .form-group { display: flex; flex-direction: column; gap: 5px; margin: 0; }
        .modal-content .form-group label { margin: 0; font-size: 0.9rem; font-weight: 700; color: #15163a; }
        .modal-content .input-field { padding: 9px 13px; font-size: 0.92rem; border-radius: 11px; }

        .info-note {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #e0e7ff;
          border-radius: 12px;
          color: #3730a3;
          font-size: 0.95rem;
        }

        .ship-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
        }

        .await-banner {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 18px;
          background: #fff8ec;
          border: 1px solid #f5d99b;
          border-radius: 14px;
          color: #92400e;
        }
        .await-banner strong { display: block; margin-bottom: 3px; font-size: 0.98rem; }
        .await-banner p { margin: 0; font-size: 0.88rem; line-height: 1.5; color: #a16207; }

        .ship-help {
          font-size: 0.85rem;
          color: #64748b;
          line-height: 1.45;
          margin: 0 0 2px;
        }
        .ship-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .ship-row--3 {
          grid-template-columns: 1fr 1fr 1fr;
        }
        .ship-dims {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }
        .ship-divider {
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #94a3b8;
          padding-top: 4px;
          margin-top: 2px;
          border-top: 1px solid #eceef5;
        }
        @media (max-width: 600px) {
          .ship-row, .ship-row--3 { grid-template-columns: 1fr; }
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.95rem;
          color: #2d3748;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .modal-actions button {
          flex: 1;
        }

        /* Embedded inside the dashboard PageModal — drop the full-page
           background and the redundant outer card so it sits flush. */
        .shipment-page.is-embed {
          min-height: 0;
          background: transparent;
          padding: 0;
        }

        .shipment-page.is-embed .page-header {
          max-width: none;
          margin: 0 0 18px;
        }

        .shipment-page.is-embed .shipment-container {
          max-width: none;
          padding: 0;
          border-radius: 0;
          box-shadow: none;
          background: transparent;
        }

        @media (max-width: 768px) {
          .shipment-container {
            padding: 32px 24px;
          }

          .shipment-page.is-embed .shipment-container {
            padding: 0;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .action-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}